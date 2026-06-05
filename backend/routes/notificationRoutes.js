const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const TeamTask = require('../models/TeamTask');
const { protect } = require('../middleware/authMiddleware');

/**
 * GET /api/notifications
 * Trả về danh sách thông báo:
 * 1. Khách hàng sắp hết hạn (trong 14 ngày)
 * 2. Công việc ca trực sắp tới (trước 15 phút)
 */
router.get('/', protect, async (req, res) => {
  try {
    const now = new Date();
    const fourteenDaysLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    // 1. Khách hàng sắp hết hạn: đã kích hoạt + endDate trong 14 ngày tới
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

    // 2. Lấy thông báo công việc ca trực sắp tới trong vòng 15 phút (cho nhân viên vận hành & quản lý)
    const userRole = req.user.role;
    let taskNotifications = [];
    if (['pt', 'sale', 'reception', 'manager', 'sm', 'pm', 'om', 'accountant', 'admin'].includes(userRole)) {
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const vnTime = new Date(utc + (3600000 * 7));
      const currentHour = vnTime.getHours();
      const currentMinute = vnTime.getMinutes();
      
      // Quy đổi giờ hiện tại theo mốc 5h sáng chuẩn ca trực
      let currentHourShift = currentHour;
      if (currentHourShift < 5) {
        currentHourShift += 24;
      }
      const currentTotalMinutes = currentHourShift * 60 + currentMinute;
      
      const year = vnTime.getFullYear();
      const month = String(vnTime.getMonth() + 1).padStart(2, '0');
      const day = String(vnTime.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      const pendingTasks = await TeamTask.find({ date: todayStr, isCompleted: false }).lean();

      // Quy đổi giờ bắt đầu theo mốc 5h sáng chuẩn ca trực
      const getStartTime = (timeSlot) => {
        if (!timeSlot) return null;
        const match = timeSlot.match(/(\d+)(?::(\d+))?/);
        if (match) {
          let hour = parseInt(match[1], 10);
          const minute = match[2] ? parseInt(match[2], 10) : 0;
          if (hour < 5) {
            hour += 24; // Đẩy mốc 0h-4h sáng xuống sau 23h đêm
          }
          return { hour, minute };
        }
        return null;
      };

      pendingTasks.forEach(t => {
        const taskTime = getStartTime(t.timeSlot);
        if (taskTime) {
          const taskTotalMinutes = taskTime.hour * 60 + taskTime.minute;
          const diff = taskTotalMinutes - currentTotalMinutes;
          // Hiển thị thông báo bắt đầu từ trước 15 phút đến khi hoàn thành
          if (diff <= 15) {
            taskNotifications.push({
              id: t._id,
              type: 'team_task',
              title: `Công việc lúc ${t.timeSlot}`,
              subtitle: t.task,
              daysLeft: 0,
              endDate: t.createdAt,
              code: 'TASK',
              severity: diff <= 0 ? 'high' : 'medium',
              sortMinutes: taskTotalMinutes
            });
          }
        }
      });

      // Sắp xếp các thông báo công việc theo thứ tự thời gian ca trực tăng dần
      taskNotifications.sort((a, b) => a.sortMinutes - b.sortMinutes);
      taskNotifications.forEach(tn => delete tn.sortMinutes);
    }

    const allNotifications = [...taskNotifications, ...notifications];

    res.json({
      total: allNotifications.length,
      notifications: allNotifications,
    });
  } catch (error) {
    console.error('Lỗi lấy notifications:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
