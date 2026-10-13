const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const contractLifecycleController = require('../controllers/contractLifecycleController');
const customerRegistrationController = require('../controllers/customerRegistrationController');
const contractMutationController = require('../controllers/contractMutationController');
const { protect } = require('../middleware/authMiddleware');
const { PERMISSIONS, requirePermission } = require('../middleware/permissions');
const { createCustomerValidator, updateCustomerValidator } = require('../validators/customerValidator');
const validate = require('../middleware/validate');
const {
  IMAGE_UPLOAD_TYPES,
  createMemoryUpload,
  validateUploadedFile,
} = require('../middleware/secureUpload');

// Multer cho upload ảnh khuôn mặt
const upload = createMemoryUpload({
  maxBytes: 5 * 1024 * 1024,
  allowedTypes: IMAGE_UPLOAD_TYPES,
});

// GET  /api/v1/customers — Xem danh sách
router.get('/',
  protect,
  requirePermission(PERMISSIONS.CUSTOMER_READ),
  customerController.getAll
);

// GET  /api/v1/customers/check-existing — Kiểm tra khách cũ real-time (KHÔNG ghi dữ liệu)
router.get('/check-existing',
  protect,
  requirePermission(PERMISSIONS.CUSTOMER_CHECK_EXISTING),
  customerController.checkExisting
);

// GET  /api/v1/customers/export-excel — Xuất file Excel danh sách khách hàng
router.get('/export-excel',
  protect,
  requirePermission(PERMISSIONS.CUSTOMER_EXPORT),
  customerController.exportExcel
);

// POST /api/v1/customers — Thêm khách hàng mới (chỉ Admin)
router.post('/',
  protect,
  requirePermission(PERMISSIONS.CUSTOMER_CREATE),
  createCustomerValidator,
  validate,
  customerRegistrationController.create
);

// PUT  /api/v1/customers/:id — Sửa khách hàng (chỉ Admin)
router.put('/:id',
  protect,
  requirePermission(PERMISSIONS.CUSTOMER_UPDATE),
  updateCustomerValidator,
  validate,
  customerController.update
);

// DELETE /api/v1/customers/:id — Xóa khách hàng (chỉ Admin)
router.delete('/:id',
  protect,
  requirePermission(PERMISSIONS.CUSTOMER_DELETE),
  customerController.delete
);

// POST /api/v1/customers/:id/freeze — Tạm dừng gói tập (Hỗ trợ Admin, Manager, Reception, Sale, Staff)
router.post('/:id/freeze',
  protect,
  requirePermission(PERMISSIONS.CONTRACT_MANAGE),
  contractLifecycleController.freeze
);

router.post('/packages/:id/freeze',
  protect,
  requirePermission(PERMISSIONS.CONTRACT_MANAGE),
  contractLifecycleController.freeze
);

// POST /api/v1/customers/:id/unfreeze — Kích hoạt lại gói tập
router.post('/:id/unfreeze',
  protect,
  requirePermission(PERMISSIONS.CONTRACT_MANAGE),
  contractLifecycleController.unfreeze
);

router.post('/packages/:id/unfreeze',
  protect,
  requirePermission(PERMISSIONS.CONTRACT_MANAGE),
  contractLifecycleController.unfreeze
);

// POST /api/v1/customers/packages/:id/upgrade — Nâng cấp hợp đồng
router.post('/packages/:id/upgrade',
  protect,
  requirePermission(PERMISSIONS.CONTRACT_MANAGE),
  contractMutationController.upgrade
);

router.post('/:id/upgrade',
  protect,
  requirePermission(PERMISSIONS.CONTRACT_MANAGE),
  contractMutationController.upgrade
);

// POST /api/v1/customers/packages/:id/transfer — Chuyển nhượng hợp đồng
router.post('/packages/:id/transfer',
  protect,
  requirePermission(PERMISSIONS.CONTRACT_TRANSFER),
  contractMutationController.transfer
);

router.post('/:id/transfer',
  protect,
  requirePermission(PERMISSIONS.CONTRACT_TRANSFER),
  contractMutationController.transfer
);

// POST /api/v1/customers/:id/enroll-face — Đăng ký khuôn mặt qua InsightFace
router.post('/:id/enroll-face',
  protect,
  requirePermission(PERMISSIONS.CUSTOMER_FACE_ENROLL),
  upload.single('image'),
  validateUploadedFile(IMAGE_UPLOAD_TYPES),
  customerController.enrollFace
);

// PUT /api/v1/customers/packages/:id/adjust-expiry — Admin điều chỉnh ngày hết hạn gói tập thủ công
router.put('/packages/:id/adjust-expiry',
  protect,
  requirePermission(PERMISSIONS.CONTRACT_EXPIRY_ADJUST),
  contractLifecycleController.adjustExpiry
);

// GET /api/v1/customers/packages/:id/extension-history — Lịch sử điều chỉnh ngày hết hạn
router.get('/packages/:id/extension-history',
  protect,
  requirePermission(PERMISSIONS.CONTRACT_HISTORY_READ),
  contractLifecycleController.getExtensionHistory
);

module.exports = router;
