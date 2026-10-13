const express = require("express");
const dotenv = require("dotenv");
dotenv.config({ quiet: true });
const { validateEnvironment } = require("./config/validateEnv");
validateEnvironment();

const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = rateLimit;
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const { closeAllConnections } = require("./db/branchConnectionManager");
const requestContext = require("./middleware/requestContext");
const logger = require("./utils/logger");
const cacheService = require("./utils/cacheService");
const CacheRateLimitStore = require("./utils/rateLimitStore");
const { getAccessTokenState } = require("./middleware/accessTokenContext");

const app = express();
app.use(requestContext);

// Trust reverse proxy (Render) to get real client IP for rate limiting
app.set("trust proxy", 1);

// --- SECURITY HEADERS ---
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// --- CORS ---
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
  : ["http://localhost:5173"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Cho phép request không có origin (mobile app, Postman, curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS policy: origin ${origin} không được phép`));
    },
    credentials: true,
  })
);

// --- RATE LIMITING ---
const getRateLimitKey = (req) => {
  const authState = getAccessTokenState(req);
  if (authState.status === "authenticated" && authState.claims?.id) {
    const branchCode = authState.claims.branchCode || authState.claims.activeBranch || "central";
    return `user:${branchCode}:${authState.claims.id}`;
  }
  return `ip:${ipKeyGenerator(req.ip)}`;
};

const rateLimitHandler = (message) => (req, res, _next, options) => {
  const resetTime = req.rateLimit?.resetTime;
  const retryAfterSeconds = resetTime
    ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
    : Math.ceil(options.windowMs / 1000);

  res.status(options.statusCode).json({
    success: false,
    code: "RATE_LIMITED",
    message,
    retryAfterSeconds,
    requestId: req.id,
  });
};

// Giới hạn nghiêm cho login endpoint (chống brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 20),
  handler: rateLimitHandler("Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau."),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS",
  store: new CacheRateLimitStore({ prefix: "rate-limit:auth:" }),
});

// Lớp chống flood tổng quát. Request có token hợp lệ được tính theo tài khoản + chi nhánh
// để nhân viên dùng chung mạng nội bộ không khóa nhầm lẫn nhau.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_MAX || 1200),
  keyGenerator: getRateLimitKey,
  handler: rateLimitHandler("Bạn đang gửi yêu cầu quá nhanh. Vui lòng thử lại sau."),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS",
  store: new CacheRateLimitStore({ prefix: "rate-limit:api:" }),
});

app.use("/api/v1/system/health", require("./routes/healthRoutes"));
app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1", apiLimiter);

app.use(cookieParser());
app.use(
  express.json({
    limit: "5mb",
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

// Health check endpoint cho UptimeRobot / Render keep-alive (không qua rate limit nặng)
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    data: { status: "live", timestamp: new Date().toISOString() },
    message: "Service is live",
  });
});

// --- ROUTES ---
// Tất cả routes được gom qua prefix /api/v1/
app.use("/api/v1", require("./routes"));

// Legacy redirect: giữ /api/login để tương thích ngắn hạn (xóa sau khi frontend đã update hoàn toàn)
// app.use("/api", require("./routes/authRoutes"));

app.get("/", (req, res) => {
  res.json({ success: true, message: "Gym Management API v1 is running..." });
});

// --- GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  logger.error("http_request_failed", {
    requestId: req.id,
    method: req.method,
    path: req.originalUrl?.split("?")[0],
    statusCode,
    errorName: err.name,
    errorCode: err.code,
  });
  res.status(statusCode).json({
    success: false,
    code: err.code,
    message:
      process.env.NODE_ENV === "production" && statusCode >= 500
        ? "Lỗi máy chủ nội bộ"
        : err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
    requestId: req.id,
  });
});

let httpServer = null;
let shutdownStarted = false;

const shutdown = async (signal) => {
  if (shutdownStarted) return;
  shutdownStarted = true;
  logger.info("server_shutdown_started", { signal });

  const forceExitTimer = setTimeout(() => {
    logger.fatal("server_shutdown_timeout", { signal });
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve));
  }
  await closeAllConnections();
  await cacheService.close();
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  clearTimeout(forceExitTimer);
  logger.info("server_shutdown_completed", { signal });
  if (process.env.NODE_ENV !== "test") process.exit(0);
};

const startServer = async () => {
  await connectDB();
  await cacheService.waitForReady();
  const startExpirationCron = require("./jobs/expirationCron");
  const { startTransferPendingWatcher } = require("./jobs/transferPendingWatcher");
  startExpirationCron();
  startTransferPendingWatcher();

  const port = process.env.PORT || 5000;
  httpServer = app.listen(port, () =>
    logger.info("server_started", { port: Number(port) })
  );
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
  return httpServer;
};

if (process.env.NODE_ENV !== "test") {
  startServer().catch((error) => {
    logger.fatal("server_start_failed", {
      errorName: error.name,
      errorCode: error.code,
    });
    process.exit(1);
  });
}

module.exports = app;
module.exports.startServer = startServer;
module.exports.shutdown = shutdown;
