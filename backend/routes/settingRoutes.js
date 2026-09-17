const express = require("express");
const router = express.Router();
const { getSettings, getFacilityKey, updateSettings } = require("../controllers/settingController");
const { protect, authorize } = require("../middleware/authMiddleware");
const cacheMiddleware = require("../middleware/cacheMiddleware");

// Route lấy cấu hình (Yêu cầu đăng nhập - Cache 10 phút)
router.get("/", protect, cacheMiddleware(600, "settings"), getSettings);

// Mã đăng nhập cơ sở là dữ liệu nhạy cảm: chỉ admin, không đưa qua cache dùng chung.
router.get("/facility-key", protect, authorize("admin"), getFacilityKey);

// Route cập nhật cấu hình (Chỉ dành cho Admin)
router.put("/", protect, authorize("admin"), updateSettings);

module.exports = router;
