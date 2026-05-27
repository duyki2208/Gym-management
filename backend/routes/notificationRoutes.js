const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const { protect } = require('../middleware/authMiddleware');

/**
 * GET /api/notifications
 * Trả về danh sách thông báo:
 * 1. Khách hàng sắp hết hạn (trong 14 ngày)
 * 2. Sản phẩm sắp hết hàng (tồn kho <= 10) — nếu cần mở rộng sau
 */
router.get('/', protect, async (req, res) => {
  try {
    const now = new Date();
    const fourteenDaysLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    // Khách hàng sắp hết hạn: đã kích hoạt + endDate trong 14 ngày tới
    const expiringCustomers = await Customer.find({
      startDate: { $lte: now },
      endDate: { $gte: now, $lte: fourteenDaysLater },
    })
      .select('name phone packageType endDate code')
      .sort({ endDate: 1 }) // Gần hết hạn nhất lên đầu
      .limit(20)
      .lean();

    const notifications = expiringCustomers.map(c => {
      const daysLeft = Math.ceil((new Date(c.endDate) - now) / (1000 * 60 * 60 * 24));
      return {
        id: c._id,
        type: 'expiring_customer',
        title: c.name,
        subtitle: `${c.phone} • ${c.packageType}`,
        daysLeft,
        endDate: c.endDate,
        code: c.code,
        severity: daysLeft <= 3 ? 'high' : 'medium',
      };
    });

    res.json({
      total: notifications.length,
      notifications,
    });
  } catch (error) {
    console.error('Lỗi lấy notifications:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
