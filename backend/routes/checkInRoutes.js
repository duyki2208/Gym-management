const express = require("express");
const router = express.Router();
const checkInController = require("../controllers/checkInController");
const { protect, authorize } = require("../middleware/authMiddleware");
const { createCheckInValidator } = require("../validators/checkInValidator");
const validate = require("../middleware/validate");
const multer = require("multer");

// Multer config: lưu trong memory (không ghi ra disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Chỉ chấp nhận file ảnh'));
  },
});


// Danh sách khách hàng cho trang Check-in — KHÔNG có faceDescriptor, có phân trang
router.get(
  "/checkin-list",
  protect,
  authorize("admin", "manager", "staff", "pt", "sale", "reception"),
  checkInController.getCheckInList
);

// Lịch sử check-in (có phân trang)
router.get(
  "/",
  protect,
  authorize("admin", "manager", "staff", "pt", "sale", "reception"),
  checkInController.getAll
);

router.post(
  "/",
  protect,
  authorize("admin", "manager", "staff", "pt", "sale", "reception"),
  createCheckInValidator,
  validate,
  checkInController.create
);

// POST /api/v1/checkins/recognize — Nhận diện khuôn mặt qua InsightFace
router.post(
  "/recognize",
  protect,
  authorize("admin", "manager", "staff", "pt", "sale", "reception"),
  upload.single("image"),
  checkInController.recognizeFace
);

module.exports = router;
