const express = require("express");
const router = express.Router();
const { getSettings, updateSettings } = require("../controllers/settingController");
const { protect, authorize } = require("../middleware/authMiddleware");

// Route lấy cấu hình (Yêu cầu đăng nhập)
router.get("/", protect, getSettings);

// Route cập nhật cấu hình (Chỉ dành cho Admin)
router.put("/", protect, authorize("admin"), updateSettings);

module.exports = router;
