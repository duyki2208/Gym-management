const express = require("express");
const router = express.Router();
const { getSettings, updateSettings } = require("../controllers/settingController");
const { protect, authorize } = require("../middleware/authMiddleware");
const cacheMiddleware = require("../middleware/cacheMiddleware");

// Route lấy cấu hình (Yêu cầu đăng nhập - Cache 10 phút)
router.get("/", protect, cacheMiddleware(600, "settings"), getSettings);

// Route cập nhật cấu hình (Chỉ dành cho Admin)
router.put("/", protect, authorize("admin"), updateSettings);

module.exports = router;
