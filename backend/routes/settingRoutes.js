const express = require("express");
const router = express.Router();
const { getSettings, getFacilityKey, updateSettings } = require("../controllers/settingController");
const { protect } = require("../middleware/authMiddleware");
const { PERMISSIONS, requirePermission } = require("../middleware/permissions");

// Route lấy cấu hình (Yêu cầu đăng nhập - Cache 10 phút)
router.get(
  "/",
  protect,
  requirePermission(PERMISSIONS.SETTINGS_READ),
  getSettings
);

// Mã đăng nhập cơ sở là dữ liệu nhạy cảm: chỉ admin, không đưa qua cache dùng chung.
router.get("/facility-key", protect, requirePermission(PERMISSIONS.SETTINGS_SENSITIVE_READ), getFacilityKey);

// Route cập nhật cấu hình (Chỉ dành cho Admin)
router.put("/", protect, requirePermission(PERMISSIONS.SETTINGS_UPDATE), updateSettings);

module.exports = router;
