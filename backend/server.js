const express = require("express");
const dotenv = require("dotenv");
dotenv.config();

const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");

// Initialize Cron Jobs after DB Connection
if (process.env.NODE_ENV !== "test") {
  const startExpirationCron = require("./jobs/expirationCron");
  const { startTransferPendingWatcher } = require("./jobs/transferPendingWatcher");
  connectDB().then(() => {
    startExpirationCron();
    startTransferPendingWatcher();
  });
}

const app = express();

// Trust reverse proxy (Render) to get real client IP for rate limiting
app.set("trust proxy", 1);

// --- SECURITY HEADERS ---
app.use(helmet());

// --- CORS ---
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
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
// Giới hạn nghiêm cho login endpoint (chống brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 20,
  message: { success: false, message: "Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Giới hạn chung cho toàn bộ API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { success: false, message: "Quá nhiều yêu cầu. Vui lòng thử lại sau." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1", apiLimiter);

app.use(cookieParser());
app.use(express.json({ limit: "5mb" }));

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
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    success: false,
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
});

if (process.env.NODE_ENV !== "test") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
