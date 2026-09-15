const express = require("express");
const router = express.Router();
const multer = require("multer");
const closureController = require("../controllers/closureController");
const { protect, authorize } = require("../middleware/authMiddleware");

// Cấu hình Multer lưu file vào bộ nhớ (memoryStorage) để chuyển base64 sang Brevo API
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // Tối đa 10MB
  fileFilter: (req, file, cb) => {
    // Chấp nhận các loại tài liệu: .doc, .docx, .pdf, .png, .jpg
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(pdf|doc|docx|png|jpg|jpeg)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file Word (.doc, .docx), PDF (.pdf) hoặc hình ảnh"));
    }
  },
});

const ALLOWED_ROLES = ["admin", "manager", "sm", "pm", "om"];

// GET /api/v1/closures - Danh sách sự kiện đóng cửa
router.get("/", protect, authorize(...ALLOWED_ROLES), closureController.getAllClosures);

// POST /api/v1/closures/preview - Xem trước tính toán bù hạn
router.post("/preview", protect, authorize(...ALLOWED_ROLES), closureController.previewClosureCompensation);

// POST /api/v1/closures - Tạo sự kiện đóng cửa & bù hạn
router.post("/", protect, authorize(...ALLOWED_ROLES), closureController.createClosure);

// GET /api/v1/closures/:id - Chi tiết sự kiện & danh sách gói tập
router.get("/:id", protect, authorize(...ALLOWED_ROLES), closureController.getClosureDetails);

// POST /api/v1/closures/:id/reverse - Hoàn tác bù hạn
router.post("/:id/reverse", protect, authorize(...ALLOWED_ROLES), closureController.reverseClosure);

// POST /api/v1/closures/:id/send-email - Gửi email thông báo (kèm file)
router.post(
  "/:id/send-email",
  protect,
  authorize(...ALLOWED_ROLES),
  upload.single("attachment"),
  closureController.sendClosureNotificationEmail
);

// GET /api/v1/closures/:id/mail-progress - Lấy tiến độ gửi email
router.get("/:id/mail-progress", protect, authorize(...ALLOWED_ROLES), closureController.getMailProgress);

module.exports = router;
