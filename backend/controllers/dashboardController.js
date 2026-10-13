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
const { PERMISSIONS, userHasPermission } = require("../middleware/permissions");
const { getVisibleTeams } = require("../services/teamTaskAccessService");

const defaultModels = {
  Customer,
  CheckIn,
  Invoice,
  Setting,
  TeamTask,
  Transaction,
  KPITarget,
  CustomerPackage,
  WorkoutSession,
};

const getDashboardModels = (req) => req.models || defaultModels;

const resolveDashboardView = ({ role, canReadAllReports }) => {
  if (role === "pt") return "pt";
  if (role === "sale") return "sale";
  if (canReadAllReports) return "branch";
  return "operations";
};

const buildDashboardTaskQuery = ({ date, role }) => {
  const visibleTeams = getVisibleTeams(role);
  if (visibleTeams.length === 0) return null;
  return {
    date,
    isCompleted: false,
    team: { $in: visibleTeams },
  };
};

const getStats = async (req, res) => {
  try {
    const {
      Customer,
      CheckIn,
      Setting,
      TeamTask,
      Transaction,
      KPITarget,
      CustomerPackage,
      WorkoutSession,
    } = getDashboardModels(req);
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
    const nextSevenDaysEnd = new Date(todayEnd.getTime() + 7 * 24 * 3600000);

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
    const role = req.user?.role;
    const userId = req.user?._id;

    // Lấy cấu hình hệ thống
    let setting = await Setting.findOne();
    if (!setting) {
      setting = new Setting();
      await setting.save();
    }
    const targetRevenue = setting.targetRevenue || 100000000;

    // Lấy toàn bộ công việc chưa hoàn thành hôm nay để phân tích
    const taskQuery = buildDashboardTaskQuery({ date: todayStr, role });
    const todayTasks = taskQuery
      ? await TeamTask.find(taskQuery).lean()
      : [];
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

    const canReadAllReports = await userHasPermission(req, PERMISSIONS.REPORT_READ_ALL);
    const dashboardView = resolveDashboardView({ role, canReadAllReports });

    if (dashboardView === "pt") {
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

    if (dashboardView === "sale") {
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
    const activeMemberPackages = await CustomerPackage.find({
      isDeleted: { $ne: true },
      status: "active",
      endDate: { $gte: todayStart },
    })
      .select("customer packageName startDate createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const activeCustomerById = new Map();
    activeMemberPackages.forEach((item) => {
      const customerId = item.customer ? String(item.customer) : null;
      if (customerId && !activeCustomerById.has(customerId)) {
        activeCustomerById.set(customerId, item);
      }
    });
    const activeCustomerIds = [...activeCustomerById.values()].map((item) => item.customer);
    const dayInMs = 24 * 3600000;
    const trendStart = new Date(todayStart.getTime() - 6 * dayInMs);
    const trendDays = Array.from({ length: 7 }, (_, index) => {
      const start = new Date(trendStart.getTime() + index * dayInMs);
      const vnDate = new Date(start.getTime() + 7 * 3600000);
      const year = vnDate.getUTCFullYear();
      const month = String(vnDate.getUTCMonth() + 1).padStart(2, "0");
      const day = String(vnDate.getUTCDate()).padStart(2, "0");
      return {
        date: `${year}-${month}-${day}`,
        start,
        end: new Date(start.getTime() + dayInMs - 1),
      };
    });
    const [
      newCustomersCount,
      uniqueCheckInCustomerIds,
      uniqueCheckInYesterdayCustomerIds,
      todayCheckInDocs,
      revenueAggregation,
      todayRevenueAggregation,
      weeklyRevenueAggregation,
      newCustomersList,
      latestCheckIns,
      newContractsCount,
      renewContractsCount,
      expiringContractsCount,
      paymentAttentionSummary,
      activeCustomerDocs,
      activeCustomerLastCheckIns,
      revenueByPackage,
      latestRegisteredCustomers,
      latestTransactions,
      revenueTrendAggregation,
      checkInTrendAggregation,
      newContractTrendAggregation,
      trendMemberPackages,
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

      // Doanh thu thực thu trong ngày hôm nay
      Transaction.aggregate([
        {
          $match: {
            createdAt: { $gte: todayStart, $lte: todayEnd },
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
      CheckIn.find().sort({ time: -1 }).limit(5).lean(),

      CustomerPackage.countDocuments({
        contractType: "new",
        createdAt: { $gte: thisMonthStart, $lte: thisMonthEnd },
      }),

      CustomerPackage.countDocuments({
        contractType: "renew",
        createdAt: { $gte: thisMonthStart, $lte: thisMonthEnd },
      }),

      CustomerPackage.countDocuments({
        status: "active",
        endDate: { $gte: todayStart, $lte: nextSevenDaysEnd },
      }),

      CustomerPackage.aggregate([
        {
          $match: {
            isDeleted: { $ne: true },
            status: { $in: ["active", "pending"] },
            paymentStatus: { $in: ["deposit", "unpaid"] },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalOutstanding: {
              $sum: {
                $max: [
                  { $subtract: [{ $ifNull: ["$price", 0] }, { $ifNull: ["$paidAmount", 0] }] },
                  0,
                ],
              },
            },
          },
        },
      ]),

      Customer.find({ _id: { $in: activeCustomerIds } })
        .select("name code phone packageType")
        .lean(),

      CheckIn.aggregate([
        { $match: { customerId: { $in: activeCustomerIds } } },
        { $group: { _id: "$customerId", lastCheckIn: { $max: "$time" } } },
      ]),

      Transaction.aggregate([
        {
          $match: {
            createdAt: { $gte: thisMonthStart, $lte: thisMonthEnd },
            status: "success",
            type: "package_purchase",
          },
        },
        {
          $lookup: {
            from: CustomerPackage.collection.name,
            localField: "customerPackage",
            foreignField: "_id",
            as: "packageDoc",
          },
        },
        {
          $set: {
            packageName: {
              $ifNull: [{ $arrayElemAt: ["$packageDoc.packageName", 0] }, "Gói tập khác"],
            },
          },
        },
        { $group: { _id: "$packageName", revenue: { $sum: "$amount" } } },
        { $sort: { revenue: -1 } },
        { $limit: 6 },
      ]),

      Customer.find()
        .select("name packageType createdAt")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),

      Transaction.find({ status: "success" })
        .select("customerName amount type createdAt")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),

      Transaction.aggregate([
        {
          $match: {
            createdAt: { $gte: thisMonthStart, $lte: todayEnd },
            status: "success",
            type: { $in: ["package_purchase", "pos_sale", "pt_session"] },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+07:00" } },
            value: { $sum: "$amount" },
          },
        },
      ]),

      CheckIn.aggregate([
        { $match: { time: { $gte: trendStart, $lte: todayEnd } } },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: "%Y-%m-%d", date: "$time", timezone: "+07:00" } },
              customerId: "$customerId",
            },
          },
        },
        { $group: { _id: "$_id.date", value: { $sum: 1 } } },
      ]),

      CustomerPackage.aggregate([
        {
          $match: {
            contractType: "new",
            createdAt: { $gte: thisMonthStart, $lte: todayEnd },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+07:00" } },
            value: { $sum: 1 },
          },
        },
      ]),

      CustomerPackage.find({
        status: { $in: ["active", "expired", "frozen"] },
        startDate: { $lte: todayEnd },
        endDate: { $gte: trendStart },
      })
        .select("customer startDate endDate frozenPeriods")
        .lean(),
    ]);

    const activeMembersCount = activeCustomerIds.length;
    const lastCheckInByCustomer = new Map(
      activeCustomerLastCheckIns.map((item) => [String(item._id), item.lastCheckIn])
    );
    const longAbsentMembersAll = activeCustomerDocs
      .map((customer) => {
        const lastCheckIn = lastCheckInByCustomer.get(String(customer._id)) || null;
        const packageInfo = activeCustomerById.get(String(customer._id));
        const absenceSince = lastCheckIn || packageInfo?.startDate || packageInfo?.createdAt || null;
        const daysAbsent = absenceSince
          ? Math.max(0, Math.floor((todayStart.getTime() - new Date(absenceSince).getTime()) / (24 * 3600000)))
          : 0;
        return {
          _id: customer._id,
          name: customer.name,
          code: customer.code,
          phone: customer.phone,
          packageName: packageInfo?.packageName || customer.packageType || "Gói tập",
          lastCheckIn,
          daysAbsent,
        };
      })
      .filter((customer) => customer.daysAbsent > 14)
      .sort((a, b) => b.daysAbsent - a.daysAbsent || a.name.localeCompare(b.name, "vi"));
    const longAbsentMembers = longAbsentMembersAll.slice(0, 6);

    const paymentAttention = paymentAttentionSummary[0] || { count: 0, totalOutstanding: 0 };

    const recentActivities = [
      ...latestCheckIns.map((item) => ({
        id: item._id,
        customerName: item.customerName,
        time: item.time,
        type: "checkin",
        note: "Check-in thành công",
      })),
      ...latestRegisteredCustomers.map((item) => ({
        id: item._id,
        customerName: item.name,
        time: item.createdAt,
        type: "registration",
        note: item.packageType ? `Đăng ký ${item.packageType}` : "Đăng ký hội viên mới",
      })),
      ...latestTransactions.map((item) => ({
        id: item._id,
        customerName: item.customerName || "Khách lẻ",
        time: item.createdAt,
        type: "payment",
        note: `Thanh toán ${new Intl.NumberFormat("vi-VN").format(Number(item.amount || 0))}đ`,
      })),
    ]
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 6);

    const todayCheckInsCount = uniqueCheckInCustomerIds.length;
    const yesterdayCheckInsCount = uniqueCheckInYesterdayCustomerIds.length;
    const checkInChange = todayCheckInsCount - yesterdayCheckInsCount;
    
    const revenueThisMonth = revenueAggregation[0]?.totalRevenue || 0;
    const revenueToday = todayRevenueAggregation[0]?.totalRevenue || 0;
    
    // Tính % hoàn thành chỉ tiêu doanh thu
    const revenuePercentage = Math.round((revenueThisMonth / targetRevenue) * 100);

    const toTrendMap = (items) => new Map(items.map((item) => [item._id, Number(item.value || 0)]));
    const buildDailyTrend = (items) => {
      const valuesByDate = toTrendMap(items);
      return trendDays.map((day) => ({ date: day.date, value: valuesByDate.get(day.date) || 0 }));
    };
    const buildCumulativeMonthTrend = (items) => {
      const valuesByDate = toTrendMap(items);
      let runningTotal = 0;
      const totalsByDate = new Map();
      const cursor = new Date(thisMonthStart);
      while (cursor <= todayEnd) {
        const vnDate = new Date(cursor.getTime() + 7 * 3600000);
        const date = `${vnDate.getUTCFullYear()}-${String(vnDate.getUTCMonth() + 1).padStart(2, "0")}-${String(vnDate.getUTCDate()).padStart(2, "0")}`;
        runningTotal += valuesByDate.get(date) || 0;
        totalsByDate.set(date, runningTotal);
        cursor.setTime(cursor.getTime() + dayInMs);
      }
      return trendDays.map((day) => ({ date: day.date, value: totalsByDate.get(day.date) || 0 }));
    };
    const activeMemberTrend = trendDays.map((day) => {
      const customerIds = new Set();
      trendMemberPackages.forEach((item) => {
        const isWithinContract = new Date(item.startDate) <= day.end && new Date(item.endDate) >= day.start;
        const isFrozen = (item.frozenPeriods || []).some((period) => {
          const freezeStart = period.startDate ? new Date(period.startDate) : null;
          const freezeEnd = period.endDate ? new Date(period.endDate) : todayEnd;
          return freezeStart && freezeStart <= day.end && freezeEnd >= day.start;
        });
        if (isWithinContract && !isFrozen && item.customer) customerIds.add(String(item.customer));
      });
      return { date: day.date, value: customerIds.size };
    });
    if (activeMemberTrend.length) activeMemberTrend[activeMemberTrend.length - 1].value = activeMembersCount;

    const kpiTrends = {
      revenue: buildCumulativeMonthTrend(revenueTrendAggregation),
      activeMembers: activeMemberTrend,
      checkIns: buildDailyTrend(checkInTrendAggregation),
      newContracts: buildCumulativeMonthTrend(newContractTrendAggregation),
    };

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
      const time = new Date(doc.time);
      const hour = (time.getUTCHours() + 7) % 24;
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
        newCustomersThisMonth: newCustomersCount,
        newCustomersList: newCustomersList,
        todayCheckIns: todayCheckInsCount,
        yesterdayCheckIns: yesterdayCheckInsCount,
        checkInChange: checkInChange,
        activeMembers: activeMembersCount,
        newContractsThisMonth: newContractsCount,
        renewContractsThisMonth: renewContractsCount,
        expiringContracts7Days: expiringContractsCount,
        paymentAttentionCount: paymentAttention.count,
        paymentAttentionValue: paymentAttention.totalOutstanding,
        longAbsentMembers,
        longAbsentCount: longAbsentMembersAll.length,
        revenueByPackage: revenueByPackage.map((item) => ({
          packageName: item._id,
          revenue: item.revenue,
        })),
        peakHours: peakHours,
        recentActivities,
        kpiTrends,
        ...(canReadAllReports ? {
          revenue: revenueThisMonth,
          todayRevenue: revenueToday,
          targetRevenue,
          revenuePercentage,
          weeklyRevenue,
        } : {}),
      }
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    res.status(500).json({ success: false, message: "Lỗi lấy dữ liệu thống kê tổng quan" });
  }
};

module.exports = { getStats, resolveDashboardView, buildDashboardTaskQuery };
