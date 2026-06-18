const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { createCustomerValidator, updateCustomerValidator } = require('../validators/customerValidator');
const validate = require('../middleware/validate');
const multer = require('multer');

// Multer cho upload ảnh khuôn mặt
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Chỉ chấp nhận file ảnh'));
  },
});

// GET  /api/v1/customers — Xem danh sách
router.get('/',
  protect,
  authorize('admin', 'manager', 'staff', 'pt', 'sale', 'reception'),
  customerController.getAll
);

// POST /api/v1/customers — Thêm khách hàng mới
router.post('/',
  protect,
  authorize('admin', 'manager', 'sale', 'reception'),
  createCustomerValidator,
  validate,
  customerController.create
);

// PUT  /api/v1/customers/:id — Sửa khách hàng
router.put('/:id',
  protect,
  authorize('admin', 'manager'),
  updateCustomerValidator,
  validate,
  customerController.update
);

// DELETE /api/v1/customers/:id — Xóa khách hàng (chỉ Admin)
router.delete('/:id',
  protect,
  authorize('admin'),
  customerController.delete
);

// POST /api/v1/customers/:id/freeze — Tạm dừng gói tập
router.post('/:id/freeze',
  protect,
  authorize('admin', 'manager'),
  customerController.freeze
);

// POST /api/v1/customers/:id/unfreeze — Kích hoạt lại gói tập
router.post('/:id/unfreeze',
  protect,
  authorize('admin', 'manager'),
  customerController.unfreeze
);

// POST /api/v1/customers/:id/enroll-face — Đăng ký khuôn mặt qua InsightFace
router.post('/:id/enroll-face',
  protect,
  authorize('admin', 'manager', 'reception'),
  upload.single('image'),
  customerController.enrollFace
);

module.exports = router;