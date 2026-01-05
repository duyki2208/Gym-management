const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

// Import cả protect (xác thực) và authorize (phân quyền) từ authMiddleware
const { protect, authorize } = require('../middleware/authMiddleware'); 

// --- CÁC ROUTES ---

// 1. Xem danh sách: Ai cũng xem được (Admin, Manager, Staff, PT, Sale...)
// protect: Đảm bảo đã đăng nhập
// authorize: Đảm bảo có role hợp lệ
router.get('/', protect, authorize('admin', 'manager', 'staff', 'pt', 'sale', 'reception'), customerController.getAll);

// 2. Thêm khách hàng mới
router.post('/', protect, authorize('admin', 'manager', 'sale', 'reception'), customerController.create);

// 3. Sửa khách hàng: Admin và Manager được sửa
router.put('/:id', protect, authorize('admin', 'manager'), customerController.update);

// 4. Xóa khách hàng: Chỉ Admin được xóa
router.delete('/:id', protect, authorize('admin'), customerController.delete);

module.exports = router;