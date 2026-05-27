const express = require("express");
const dotenv = require("dotenv");
dotenv.config();

const cors = require("cors");
const connectDB = require("./config/db");

// Initialize Cron Jobs
const startExpirationCron = require("./jobs/expirationCron");
startExpirationCron();

connectDB();

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
