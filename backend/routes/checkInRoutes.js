const express = require("express");
const router = express.Router();
const checkInController = require("../controllers/checkInController");
const { protect } = require("../middleware/authMiddleware");
const { PERMISSIONS, requirePermission } = require("../middleware/permissions");
const { createCheckInValidator } = require("../validators/checkInValidator");
const validate = require("../middleware/validate");
const {
  IMAGE_UPLOAD_TYPES,
  createMemoryUpload,
  validateUploadedFile,
} = require("../middleware/secureUpload");

// Multer config: lưu trong memory (không ghi ra disk)
const upload = createMemoryUpload({
  maxBytes: 5 * 1024 * 1024,
  allowedTypes: IMAGE_UPLOAD_TYPES,
});


// Danh sách khách hàng cho trang Check-in — KHÔNG có faceDescriptor, có phân trang
router.get(
  "/checkin-list",
  protect,
  requirePermission(PERMISSIONS.CHECKIN_USE),
  checkInController.getCheckInList
);

// Lịch sử check-in (có phân trang)
router.get(
  "/",
  protect,
  requirePermission(PERMISSIONS.CHECKIN_USE),
  checkInController.getAll
);

router.post(
  "/",
  protect,
  requirePermission(PERMISSIONS.CHECKIN_USE),
  createCheckInValidator,
  validate,
  checkInController.create
);

// POST /api/v1/checkins/recognize — Nhận diện khuôn mặt qua InsightFace
router.post(
  "/recognize",
  protect,
  requirePermission(PERMISSIONS.CHECKIN_USE),
  upload.single("image"),
  validateUploadedFile(IMAGE_UPLOAD_TYPES),
  checkInController.recognizeFace
);

module.exports = router;
