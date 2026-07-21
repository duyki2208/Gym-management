const Customer = require("../models/Customer");
const CheckIn = require("../models/CheckIn");
const Invoice = require("../models/Invoice");
const Setting = require("../models/Setting");
const TeamTask = require("../models/TeamTask");
const Transaction = require("../models/Transaction");
const KPITarget = require("../models/KPITarget");
const CustomerPackage = require("../models/CustomerPackage");
const WorkoutSession = require("../models/WorkoutSession");
const {
  startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, eachDayOfInterval, format, startOfMonth, endOfMonth
} = require("date-fns");

const getStats = async (req, res) => {
  try {
    const today = new Date();
    const utcTime = today.getTime() + (today.getTimezoneOffset() * 60000);
    const vnTime = new Date(utcTime + (7 * 3600000));
    
    const vnYear = vnTime.getFullYear();
    const vnMonth = vnTime.getMonth();
    const vnDay = vnTime.getDate();

    const todayStart = new Date(Date.UTC(vnYear, vnMonth, vnDay, -7, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(vnYear, vnMonth, vnDay, 16, 59, 59, 999));

    const yesterdayStart = new Date(todayStart.getTime() - 24 * 3600000);
    const yesterdayEnd = new Date(todayEnd.getTime() - 24 * 3600000);

    const thisMonthStart = new Date(Date.UTC(vnYear, vnMonth, 1, -7, 0, 0, 0));
    const lastDay = new Date(vnYear, vnMonth + 1, 0).getDate();
    const thisMonthEnd = new Date(Date.UTC(vnYear, vnMonth, lastDay, 16, 59, 59, 999));

    // Tuần này (Thứ 2 -> Chủ Nhật) theo GMT+7
    const dayOfWeek = vnTime.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const mondayDate = new Date(vnTime.getTime() + diffToMonday * 24 * 3600000);
    
    const thisWeekStart = new Date(Date.UTC(mondayDate.getFullYear(), mondayDate.getMonth(), mondayDate.getDate(), -7, 0, 0, 0));
    const thisWeekEnd = new Date(thisWeekStart.getTime() + 7 * 24 * 3600000 - 1);

    const monthStr = String(vnMonth + 1).padStart(2, '0');
    const dayStr = String(vnDay).padStart(2, '0');
    const todayStr = `${vnYear}-${monthStr}-${dayStr}`;
    const currentMonth = vnMonth + 1;
    const currentYear = vnYear;

    // Lấy cấu hình hệ thống
    let setting = await Setting.findOne();
    if (!setting) {
      setting = new Setting();
      await setting.save();
    }
    const targetRevenue = setting.targetRevenue || 100000000;

    // Lấy toàn bộ công việc chưa hoàn thành hôm nay để phân tích
    const todayTasks = await TeamTask.find({ date: todayStr, isCompleted: false }).lean();
    const pendingTasksCount = todayTasks.length;
    
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

    const currentHour = vnTime.getHours();
    const currentMinute = vnTime.getMinutes();
    
    // Quy đổi giờ hiện tại theo mốc 5h sáng chuẩn ca trực
    let currentHourShift = currentHour;
    if (currentHourShift < 5) {
      currentHourShift += 24;
    }
    const currentTotalMinutes = currentHourShift * 60 + currentMinute;

    let upcomingTask = null;
    let minTaskMinutes = Infinity;

    todayTasks.forEach(task => {
      const taskTime = getStartTime(task.timeSlot);
      if (taskTime) {
        const taskTotalMinutes = taskTime.hour * 60 + taskTime.minute;
        const diff = taskTotalMinutes - currentTotalMinutes;
        // Việc cận giờ: trước giờ bắt đầu <= 30 phút và chưa hoàn thành, nhưng trễ không quá 5 phút (nếu trễ > 5p sẽ bị khóa)
        if (diff <= 30 && diff >= -5) {
          if (taskTotalMinutes < minTaskMinutes) {
            minTaskMinutes = taskTotalMinutes;
            upcomingTask = task;
          }
        }
      }
    });

    const commonData = {
      pendingTasksCount,
      upcomingTask: upcomingTask ? {
        _id: upcomingTask._id,
        timeSlot: upcomingTask.timeSlot,
        task: upcomingTask.task
      } : null,
    };

    const role = req.user?.role;
    const userId = req.user?._id;

    if (role === "pt") {
      // === 🏋️ DASHBOARD PT (Xem chỉ số & KPI của PT) ===
      const [customTarget, actualSessions, assignedCustomers, sessionCustomers, newClientsCount] = await Promise.all([
        KPITarget.findOne({ staff: userId, month: currentMonth, year: currentYear }),
        WorkoutSession.countDocuments({
          pt: userId,
          status: "completed",
          date: { $gte: thisMonthStart, $lte: thisMonthEnd },
        }),
        Customer.find({ assignedStaff: userId, endDate: { $gte: today } }).select("_id"),
        WorkoutSession.distinct("customer", {
          pt: userId,
          date: { $gte: thisMonthStart, $lte: thisMonthEnd },
        }),
        Customer.countDocuments({
          assignedStaff: userId,
          createdAt: { $gte: thisMonthStart, $lte: thisMonthEnd },
        }),
      ]);

      const sessionTarget = customTarget?.ptSessionTarget !== undefined
        ? customTarget.ptSessionTarget
        : setting.ptMonthlySessionTarget || 80;

      const activeClientIds = new Set();
      assignedCustomers.forEach((c) => activeClientIds.add(c._id.toString()));
      sessionCustomers.forEach((id) => activeClientIds.add(id.toString()));
      const activeClientsCount = activeClientIds.size;

      const totalClientsEver = await WorkoutSession.distinct("customer", { pt: userId });
      const activeClientsEver = await Customer.countDocuments({
        _id: { $in: totalClientsEver },
        endDate: { $gte: today },
      });

      const retentionRate = totalClientsEver.length > 0
        ? Math.round((activeClientsEver / totalClientsEver.length) * 100)
        : 100;

      // Lấy 5 buổi dạy gần nhất của PT này
      const recentWorkouts = await WorkoutSession.find({ pt: userId })
        .populate("customer", "name code phone")
        .sort({ date: -1 })
        .limit(5)
        .lean();

      return res.json({
        success: true,
        data: {
          ...commonData,
          isPT: true,
          ptStats: {
            target: sessionTarget,
            achieved: actualSessions,
            percentage: sessionTarget > 0 ? Math.round((actualSessions / sessionTarget) * 100) : 0,
            activeClients: activeClientsCount,
            newClients: newClientsCount,
            retentionRate,
          },
          recentActivities: recentWorkouts.map(w => ({
            id: w._id,
            customerName: w.customer?.name || w.ptName,
            time: w.date ? new Date(w.date).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "--:--",
            type: "workout",
            note: w.note || "Dạy buổi tập"
          }))
        }
      });
    }

    if (role === "sale" || role === "sm") {
      // === 💰 DASHBOARD SALE (Xem chỉ số doanh số & hợp đồng) ===
      const [customTarget, packagesSoldBySale, actualNewContracts, actualRenewContracts] = await Promise.all([
        KPITarget.findOne({ staff: userId, month: currentMonth, year: currentYear }),
        CustomerPackage.find({
          assignedStaff: userId,
          createdAt: { $gte: thisMonthStart, $lte: thisMonthEnd },
        }).select("_id"),
        CustomerPackage.countDocuments({
          assignedStaff: userId,
          contractType: "new",
          createdAt: { $gte: thisMonthStart, $lte: thisMonthEnd },
        }),
        CustomerPackage.countDocuments({
          assignedStaff: userId,
          contractType: "renew",
          createdAt: { $gte: thisMonthStart, $lte: thisMonthEnd },
        }),
      ]);

      const packageIds = packagesSoldBySale.map((p) => p._id);

      // Doanh thu thực tế do Sale mang lại
      const revenueAgg = await Transaction.aggregate([
        {
          $match: {
            status: "success",
            $or: [
              { staff: userId },
              { customerPackage: { $in: packageIds } },
            ],
            createdAt: { $gte: thisMonthStart, $lte: thisMonthEnd },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$amount" },
          },
        },
      ]);

      const actualRevenue = revenueAgg[0]?.totalRevenue || 0;

      const revenueTarget = customTarget?.saleRevenueTarget !== undefined
        ? customTarget.saleRevenueTarget
        : setting.saleMonthlyRevenueTarget || 100000000;

      const newContractTarget = customTarget?.saleNewContractTarget !== undefined
        ? customTarget.saleNewContractTarget
        : setting.saleMonthlyContractTarget || 20;

      const renewTarget = customTarget?.saleRenewTarget !== undefined
        ? customTarget.saleRenewTarget
        : setting.saleMonthlyRenewTarget || 15;

      // Lấy 5 hợp đồng gần nhất do Sale này chốt
      const recentContracts = await CustomerPackage.find({ assignedStaff: userId })
        .populate("customer", "name code phone")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      return res.json({
        success: true,
        data: {
          ...commonData,
          isSale: true,
          saleStats: {
            revenue: {
              target: revenueTarget,
              achieved: actualRevenue,
              percentage: revenueTarget > 0 ? Math.round((actualRevenue / revenueTarget) * 100) : 0,
            },
            newContracts: {
              target: newContractTarget,
              achieved: actualNewContracts,
              percentage: newContractTarget > 0 ? Math.round((actualNewContracts / newContractTarget) * 100) : 0,
            },
            renewContracts: {
              target: renewTarget,
              achieved: actualRenewContracts,
              percentage: renewTarget > 0 ? Math.round((actualRenewContracts / renewTarget) * 100) : 0,
            },
          },
          recentActivities: recentContracts.map(c => ({
            id: c._id,
            customerName: c.customer?.name || "N/A",
            time: c.createdAt ? new Date(c.createdAt).toLocaleDateString("vi-VN") : "--/--",
            type: "sale",
            note: `${c.packageName} - ${c.contractType === 'new' ? 'HĐ mới' : 'Gia hạn'}`
          }))
        }
      });
    }

    // === 📊 DASHBOARD ADMIN / MANAGER / RECEPTIONIST (Tổng quan toàn phòng tập) ===
    const [
      newCustomersCount,
      uniqueCheckInCustomerIds,
      uniqueCheckInYesterdayCustomerIds,
      todayCheckInDocs,
      revenueAggregation,
      weeklyRevenueAggregation,
      newCustomersList,
      recentCheckIns
    ] = await Promise.all([
      // Đếm hội viên mới trong tháng hiện tại (dựa trên createdAt)
      Customer.countDocuments({ createdAt: { $gte: thisMonthStart, $lte: thisMonthEnd } }),
      
      // Lấy danh sách ID khách hàng check-in độc nhất hôm nay
      CheckIn.distinct("customerId", { time: { $gte: todayStart, $lte: todayEnd } }),
      
      // Lấy danh sách ID khách hàng check-in độc nhất hôm qua
      CheckIn.distinct("customerId", { time: { $gte: yesterdayStart, $lte: yesterdayEnd } }),
      
      // Lấy toàn bộ lượt check-in hôm nay để vẽ biểu đồ giờ cao điểm
      CheckIn.find({ time: { $gte: todayStart, $lte: todayEnd } }).lean(),
      
      // Tính doanh thu thực tế từ Transaction (tiền thực thu)
      Transaction.aggregate([
        {
          $match: {
            createdAt: { $gte: thisMonthStart, $lte: thisMonthEnd },
            status: "success",
            type: { $in: ["package_purchase", "pos_sale", "pt_session"] }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$amount" }
          }
        }
      ]),

      // Lấy doanh thu từng ngày trong tuần này từ Transaction
      Transaction.aggregate([
        {
          $match: {
            createdAt: { $gte: thisWeekStart, $lte: thisWeekEnd },
            status: "success",
            type: { $in: ["package_purchase", "pos_sale", "pt_session"] }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+07:00" } },
            revenue: { $sum: "$amount" }
          }
        }
      ]),

      // Lấy danh sách 20 hội viên đăng ký mới gần nhất trong tháng hiện tại
      Customer.find({ createdAt: { $gte: thisMonthStart, $lte: thisMonthEnd } })
        .select("name code phone packageType startDate avatar price")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      
      // Lấy 5 hoạt động check-in gần nhất cho panel vận hành
      CheckIn.find().sort({ time: -1 }).limit(5).lean()
    ]);

    const todayCheckInsCount = uniqueCheckInCustomerIds.length;
    const yesterdayCheckInsCount = uniqueCheckInYesterdayCustomerIds.length;
    const checkInChange = todayCheckInsCount - yesterdayCheckInsCount;
    
    const revenueThisMonth = revenueAggregation[0]?.totalRevenue || 0;
    
    // Tính % hoàn thành chỉ tiêu doanh thu
    const revenuePercentage = Math.round((revenueThisMonth / targetRevenue) * 100);

    // Map doanh thu tuần này
    const allDaysInWeek = eachDayOfInterval({ start: thisWeekStart, end: thisWeekEnd });
    const dayNames = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"];
    const weeklyRevenue = allDaysInWeek.map((day, idx) => {
      const formattedDate = format(day, "yyyy-MM-dd");
      const found = weeklyRevenueAggregation.find(r => r._id === formattedDate);
      return {
        dayName: dayNames[idx] || format(day, "EEEE"),
        date: formattedDate,
        revenue: found ? found.revenue : 0
      };
    });

    // Tính toán giờ cao điểm hôm nay (Peak Hours)
    const hoursCount = new Array(24).fill(0);
    todayCheckInDocs.forEach((doc) => {
      const hour = new Date(doc.time).getHours();
      if (!isNaN(hour)) hoursCount[hour]++;
    });

    const peakHours = hoursCount.slice(6, 22).map((count, i) => ({
      hour: i + 6,
      count,
    }));

    res.json({
      success: true,
      data: {
        ...commonData,
        revenue: revenueThisMonth,
        targetRevenue: targetRevenue,
        revenuePercentage: revenuePercentage,
        newCustomersThisMonth: newCustomersCount,
        newCustomersList: newCustomersList,
        todayCheckIns: todayCheckInsCount,
        yesterdayCheckIns: yesterdayCheckInsCount,
        checkInChange: checkInChange,
        weeklyRevenue: weeklyRevenue,
        peakHours: peakHours,
        recentActivities: recentCheckIns.map(ci => ({
          id: ci._id,
          customerName: ci.customerName,
          time: ci.time,
          type: ci.type || 'in'
        }))
      }
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    res.status(500).json({ success: false, message: "Lỗi lấy dữ liệu thống kê tổng quan" });
  }
};

module.exports = { getStats };
