const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const TeamTask = require('../models/TeamTask');
const Product = require('../models/Product');
const Setting = require('../models/Setting');
const KPITarget = require('../models/KPITarget');
const CommissionPeriod = require('../models/CommissionPeriod');
const WorkoutSession = require('../models/WorkoutSession');
const Transaction = require('../models/Transaction');
const CustomerPackage = require('../models/CustomerPackage');
const { protect } = require('../middleware/authMiddleware');
const { startOfMonth, endOfMonth, differenceInDays } = require("date-fns");

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
};

/**
 * GET /api/notifications
 * Trả về danh sách thông báo:
 * 1. Khách hàng sắp hết hạn (trong 14 ngày)
 * 2. Công việc ca trực sắp tới (trước 15 phút)
 * 3. KPI Warning (daysLeft <= 7, KPI < 50%)
 * 4. Commission Period Ready (approved / paid)
 * 5. Stock Alert (stock <= minStockAlert)
 * 6. Revenue Milestone (revenue >= 80% target)
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

      taskNotifications.sort((a, b) => a.sortMinutes - b.sortMinutes);
      taskNotifications.forEach(tn => delete tn.sortMinutes);
    }

    // 3. Cảnh báo KPI Warning (daysLeft <= 7, KPI < 50%)
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const monthEnd = endOfMonth(now);
    const daysLeft = differenceInDays(monthEnd, now) + 1;

    if (daysLeft <= 7 && ['pt', 'sale', 'sm', 'pm'].includes(userRole)) {
      try {
        const setting = await Setting.findOne() || {};
        const target = await KPITarget.findOne({ staff: req.user._id, month: currentMonth, year: currentYear });
        
        let pct = 0;
        if (req.user.role === 'pt' || req.user.role === 'pm') {
          const sessionTarget = target?.ptSessionTarget !== undefined
            ? target.ptSessionTarget
            : setting.ptMonthlySessionTarget || 80;
          const actual = await WorkoutSession.countDocuments({
            pt: req.user._id,
            status: "completed",
            date: { $gte: startOfMonth(now), $lte: monthEnd }
          });
          pct = sessionTarget > 0 ? (actual / sessionTarget) * 100 : 100;
        } else {
          const revenueTarget = target?.saleRevenueTarget !== undefined
            ? target.saleRevenueTarget
            : setting.saleMonthlyRevenueTarget || 100000000;
          const packagesSold = await CustomerPackage.find({
            assignedStaff: req.user._id,
            createdAt: { $gte: startOfMonth(now), $lte: monthEnd }
          }).select("_id");
          const packageIds = packagesSold.map(p => p._id);
          const revenueAgg = await Transaction.aggregate([
            {
              $match: {
                status: "success",
                $or: [
                  { staff: req.user._id },
                  { customerPackage: { $in: packageIds } }
                ],
                createdAt: { $gte: startOfMonth(now), $lte: monthEnd }
              }
            },
            {
              $group: {
                _id: null,
                total: { $sum: "$amount" }
              }
            }
          ]);
          const actual = revenueAgg[0]?.total || 0;
          pct = revenueTarget > 0 ? (actual / revenueTarget) * 100 : 100;
        }

        if (pct < 50) {
          taskNotifications.push({
            id: 'kpi_warning',
            type: 'kpi_warning',
            title: 'Cảnh báo chỉ tiêu KPI',
            subtitle: `Bạn mới hoàn thành ${Math.round(pct)}% chỉ tiêu tháng này. Còn ${daysLeft} ngày để đạt mục tiêu!`,
            severity: 'high'
          });
        }
      } catch (kpiErr) {
        console.error("Lỗi tạo thông báo KPI Warning:", kpiErr);
      }
    }

    // 4. Commission Period Ready
    try {
      const prevMonth = currentMonth - 1 === 0 ? 12 : currentMonth - 1;
      const prevYear = currentMonth - 1 === 0 ? currentYear - 1 : currentYear;

      const periods = await CommissionPeriod.find({
        status: { $in: ["approved", "paid"] },
        $or: [
          { month: currentMonth, year: currentYear },
          { month: prevMonth, year: prevYear }
        ]
      }).lean();

      periods.forEach(p => {
        const isPT = p.type === 'pt' && ['pt', 'pm'].includes(req.user.role);
        const isSale = p.type === 'sale' && ['sale', 'sm'].includes(req.user.role);
        const isAdmin = ['admin', 'manager', 'accountant'].includes(req.user.role);

        if (isPT || isSale || isAdmin) {
          taskNotifications.push({
            id: `commission_${p._id}`,
            type: 'commission_ready',
            title: `Hoa hồng T${p.month}/${p.year}`,
            subtitle: `Kỳ hoa hồng ${p.type.toUpperCase()} đã được ${p.status === 'paid' ? 'thanh toán' : 'duyệt'}.`,
            severity: 'medium'
          });
        }
      });
    } catch (cErr) {
      console.error("Lỗi tạo thông báo hoa hồng:", cErr);
    }

    // 5. Stock Alert
    if (['admin', 'manager', 'reception', 'accountant'].includes(userRole)) {
      try {
        const setting = await Setting.findOne() || {};
        const minAlert = setting.minStockAlert || 5;
        const lowStockProducts = await Product.find({ stockQuantity: { $lte: minAlert } }).select('name stockQuantity').lean();

        lowStockProducts.forEach(p => {
          taskNotifications.push({
            id: `stock_${p._id}`,
            type: 'stock_alert',
            title: `Sản phẩm ${p.name} sắp hết`,
            subtitle: `Chỉ còn ${p.stockQuantity} sản phẩm trong kho. Vui lòng nhập hàng thêm!`,
            severity: 'medium'
          });
        });
      } catch (stErr) {
        console.error("Lỗi tạo thông báo tồn kho:", stErr);
      }
    }

    // 6. Revenue Milestone
    if (['admin', 'manager', 'accountant'].includes(userRole)) {
      try {
        const setting = await Setting.findOne() || {};
        const targetRev = setting.targetRevenue || 100000000;

        const currentRevenueAgg = await Transaction.aggregate([
          {
            $match: {
              type: { $in: ["package_purchase", "pos_sale", "pt_session"] },
              status: "success",
              createdAt: { $gte: startOfMonth(now), $lte: monthEnd }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$amount" }
            }
          }
        ]);
        const totalRev = currentRevenueAgg[0]?.total || 0;
        const revPct = targetRev > 0 ? (totalRev / targetRev) * 100 : 0;

        if (revPct >= 80) {
          taskNotifications.push({
            id: 'revenue_milestone',
            type: 'revenue_milestone',
            title: `Mốc doanh thu: ${Math.round(revPct)}%`,
            subtitle: `Doanh thu phòng tập đạt ${formatCurrency(totalRev)} / ${formatCurrency(targetRev)}.`,
            severity: 'medium'
          });
        }
      } catch (revErr) {
        console.error("Lỗi tạo thông báo cột mốc doanh thu:", revErr);
      }
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
