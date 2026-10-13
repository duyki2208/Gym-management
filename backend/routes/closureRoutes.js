const express = require("express");
const router = express.Router();
const {
  DOCUMENT_UPLOAD_TYPES,
  createMemoryUpload,
  validateUploadedFile,
} = require("../middleware/secureUpload");
const closureController = require("../controllers/closureController");
const { protect } = require("../middleware/authMiddleware");
const { PERMISSIONS, requirePermission } = require("../middleware/permissions");

// Cấu hình Multer lưu file vào bộ nhớ (memoryStorage) để chuyển base64 sang Brevo API
const upload = createMemoryUpload({
  maxBytes: 10 * 1024 * 1024,
  allowedTypes: DOCUMENT_UPLOAD_TYPES,
});

// GET /api/v1/closures - Danh sách sự kiện đóng cửa
router.get("/", protect, requirePermission(PERMISSIONS.CLOSURE_MANAGE), closureController.getAllClosures);

// POST /api/v1/closures/preview - Xem trước tính toán bù hạn
router.post("/preview", protect, requirePermission(PERMISSIONS.CLOSURE_MANAGE), closureController.previewClosureCompensation);

// POST /api/v1/closures - Tạo sự kiện đóng cửa & bù hạn
router.post("/", protect, requirePermission(PERMISSIONS.CLOSURE_MANAGE), closureController.createClosure);

// GET /api/v1/closures/:id - Chi tiết sự kiện & danh sách gói tập
router.get("/:id", protect, requirePermission(PERMISSIONS.CLOSURE_MANAGE), closureController.getClosureDetails);

// POST /api/v1/closures/:id/reverse - Hoàn tác bù hạn
router.post("/:id/reverse", protect, requirePermission(PERMISSIONS.CLOSURE_MANAGE), closureController.reverseClosure);

// POST /api/v1/closures/:id/send-email - Gửi email thông báo (kèm file)
router.post(
  "/:id/send-email",
  protect,
  requirePermission(PERMISSIONS.CLOSURE_MANAGE),
  upload.single("attachment"),
  validateUploadedFile(DOCUMENT_UPLOAD_TYPES),
  closureController.sendClosureNotificationEmail
);

// GET /api/v1/closures/:id/mail-progress - Lấy tiến độ gửi email
router.get("/:id/mail-progress", protect, requirePermission(PERMISSIONS.CLOSURE_MANAGE), closureController.getMailProgress);

module.exports = router;
