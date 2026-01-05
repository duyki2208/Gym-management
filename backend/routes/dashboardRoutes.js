const express = require("express");
const router = express.Router();
const { getStats } = require("../controllers/dashboardController");
const { protect, authorize } = require("../middleware/authMiddleware");

// Route lấy thống kê (Yêu cầu đăng nhập)
router.get("/", protect, getStats);

module.exports = router;
