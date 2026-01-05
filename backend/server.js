const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");

// Import Routes
const customerRoutes = require("./routes/customerRoutes"); // Import file route khách hàng
const packageRoutes = require("./routes/packageRoutes");

const authRoutes = require("./routes/authRoutes");

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());

// --- ROUTES ---
// Sử dụng các routes đã import
app.use("/api/customers", customerRoutes); // Gắn route /api/customers vào customerRoutes
app.use("/api/packages", packageRoutes);
const staffRoutes = require("./routes/staffRoutes");
const checkInRoutes = require("./routes/checkInRoutes");
app.use("/api/staff", staffRoutes);
app.use("/api", authRoutes); // Đăng nhập qua /api/login
app.use("/api/checkins", checkInRoutes);
const dashboardRoutes = require("./routes/dashboardRoutes");
app.use("/api/dashboard", dashboardRoutes);

const reportRoutes = require("./routes/reportRoutes");
app.use("/api/reports", reportRoutes);

app.get("/", (req, res) => {
  res.send("API is running...");
});

// Middleware xử lý lỗi (Optional nhưng recommended)
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, console.log(`Server running on port ${PORT}`));
