const { startOfMonth, endOfMonth, differenceInDays } = require("date-fns");
const { getVisibleTeams } = require("./teamTaskAccessService");

const DAY_MS = 24 * 60 * 60 * 1000;

const formatCurrency = (amount) => new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
}).format(amount || 0);

const toVietnamTime = (date) => {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc + 7 * 60 * 60 * 1000);
};

const getShiftStartTime = (timeSlot) => {
  if (!timeSlot) return null;
  const match = String(timeSlot).match(/(\d+)(?::(\d+))?/);
  if (!match) return null;
  let hour = Number.parseInt(match[1], 10);
  const minute = match[2] ? Number.parseInt(match[2], 10) : 0;
  if (hour < 5) hour += 24;
  return { hour, minute };
};

const loadExpiringCustomerNotifications = async ({ Customer, now }) => {
  const fourteenDaysLater = new Date(now.getTime() + 14 * DAY_MS);
  const customers = await Customer.find({
    startDate: { $lte: now },
    endDate: { $gte: now, $lte: fourteenDaysLater },
  })
    .select("name phone packageType endDate code")
    .sort({ endDate: 1 })
    .limit(20)
    .lean();

  return customers.map((customer) => {
    const daysLeft = Math.ceil((new Date(customer.endDate) - now) / DAY_MS);
    return {
      id: customer._id,
      type: "expiring_customer",
      title: customer.name,
      subtitle: `${customer.phone} • ${customer.packageType}`,
      daysLeft,
      endDate: customer.endDate,
      code: customer.code,
      severity: daysLeft <= 3 ? "high" : "medium",
    };
  });
};

const loadTeamTaskNotifications = async ({ TeamTask, role, now }) => {
  const visibleTeams = getVisibleTeams(role);
  if (visibleTeams.length === 0) return [];

  const vietnamTime = toVietnamTime(now);
  let currentHour = vietnamTime.getHours();
  if (currentHour < 5) currentHour += 24;
  const currentTotalMinutes = currentHour * 60 + vietnamTime.getMinutes();
  const today = [
    vietnamTime.getFullYear(),
    String(vietnamTime.getMonth() + 1).padStart(2, "0"),
    String(vietnamTime.getDate()).padStart(2, "0"),
  ].join("-");

  const tasks = await TeamTask.find({
    date: today,
    isCompleted: false,
    team: visibleTeams.length === 1 ? visibleTeams[0] : { $in: visibleTeams },
  }).lean();

  return tasks
    .map((task) => {
      const startTime = getShiftStartTime(task.timeSlot);
      if (!startTime) return null;
      const sortMinutes = startTime.hour * 60 + startTime.minute;
      const difference = sortMinutes - currentTotalMinutes;
      if (difference > 15) return null;
      return {
        id: task._id,
        type: "team_task",
        title: `Công việc lúc ${task.timeSlot}`,
        subtitle: task.task,
        daysLeft: 0,
        endDate: task.createdAt,
        code: "TASK",
        severity: difference <= 0 ? "high" : "medium",
        sortMinutes,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.sortMinutes - right.sortMinutes)
    .map(({ sortMinutes, ...notification }) => notification);
};

const resolveKpiMetric = (role) => {
  if (["pt", "pm"].includes(role)) return "pt";
  if (["sale", "sm"].includes(role)) return "sale";
  return null;
};

const loadKpiNotification = async ({ models, user, now }) => {
  const metric = resolveKpiMetric(user.role);
  if (!metric) return null;
  const monthEnd = endOfMonth(now);
  const daysLeft = differenceInDays(monthEnd, now) + 1;
  if (daysLeft > 7) return null;

  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const [setting, target] = await Promise.all([
    models.Setting.findOne().lean(),
    models.KPITarget.findOne({
      staff: user._id,
      month: currentMonth,
      year: currentYear,
    }).lean(),
  ]);
  let percentage;
  if (metric === "pt") {
    const sessionTarget = target?.ptSessionTarget !== undefined
      ? target.ptSessionTarget
      : setting?.ptMonthlySessionTarget || 80;
    const actual = await models.WorkoutSession.countDocuments({
      pt: user._id,
      status: "completed",
      date: { $gte: startOfMonth(now), $lte: monthEnd },
    });
    percentage = sessionTarget > 0 ? (actual / sessionTarget) * 100 : 100;
  } else {
    const revenueTarget = target?.saleRevenueTarget !== undefined
      ? target.saleRevenueTarget
      : setting?.saleMonthlyRevenueTarget || 100000000;
    const packages = await models.CustomerPackage.find({
      assignedStaff: user._id,
      createdAt: { $gte: startOfMonth(now), $lte: monthEnd },
    }).select("_id").lean();
    const revenue = await models.Transaction.aggregate([
      {
        $match: {
          status: "success",
          $or: [
            { staff: user._id },
            { customerPackage: { $in: packages.map((item) => item._id) } },
          ],
          createdAt: { $gte: startOfMonth(now), $lte: monthEnd },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const actual = revenue[0]?.total || 0;
    percentage = revenueTarget > 0 ? (actual / revenueTarget) * 100 : 100;
  }

  if (percentage >= 50) return null;
  return {
    id: "kpi_warning",
    type: "kpi_warning",
    title: "Cảnh báo chỉ tiêu KPI",
    subtitle: `Bạn mới hoàn thành ${Math.round(percentage)}% chỉ tiêu tháng này. Còn ${daysLeft} ngày để đạt mục tiêu!`,
    severity: "high",
  };
};

const resolveCommissionTypes = ({ role, canReadCommissions, canReadAllCommissions }) => {
  if (canReadAllCommissions) return ["pt", "sale"];
  if (!canReadCommissions) return [];
  if (["pt", "pm"].includes(role)) return ["pt"];
  if (["sale", "sm"].includes(role)) return ["sale"];
  return [];
};

const loadCommissionNotifications = async ({ CommissionPeriod, user, capabilities, now }) => {
  const visibleTypes = resolveCommissionTypes({ role: user.role, ...capabilities });
  if (visibleTypes.length === 0) return [];
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const periods = await CommissionPeriod.find({
    type: { $in: visibleTypes },
    status: { $in: ["approved", "paid"] },
    $or: [
      { month: currentMonth, year: currentYear },
      { month: previousMonth, year: previousYear },
    ],
  }).lean();

  return periods.map((period) => ({
    id: `commission_${period._id}`,
    type: "commission_ready",
    title: `Hoa hồng T${period.month}/${period.year}`,
    subtitle: `Kỳ hoa hồng ${period.type.toUpperCase()} đã được ${period.status === "paid" ? "thanh toán" : "duyệt"}.`,
    severity: "medium",
  }));
};

const loadStockNotifications = async ({ Product, Setting }) => {
  const setting = await Setting.findOne().lean();
  const minimum = setting?.minStockAlert || 5;
  const products = await Product.find({ stockQuantity: { $lte: minimum } })
    .select("name stockQuantity")
    .lean();
  return products.map((product) => ({
    id: `stock_${product._id}`,
    type: "stock_alert",
    title: `Sản phẩm ${product.name} sắp hết`,
    subtitle: `Chỉ còn ${product.stockQuantity} sản phẩm trong kho. Vui lòng nhập hàng thêm!`,
    severity: "medium",
  }));
};

const loadRevenueNotification = async ({ Transaction, Setting, now }) => {
  const monthEnd = endOfMonth(now);
  const setting = await Setting.findOne().lean();
  const target = setting?.targetRevenue || 100000000;
  const revenue = await Transaction.aggregate([
    {
      $match: {
        type: { $in: ["package_purchase", "pos_sale", "pt_session"] },
        status: "success",
        createdAt: { $gte: startOfMonth(now), $lte: monthEnd },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const total = revenue[0]?.total || 0;
  const percentage = target > 0 ? (total / target) * 100 : 0;
  if (percentage < 80) return null;
  return {
    id: "revenue_milestone",
    type: "revenue_milestone",
    title: `Mốc doanh thu: ${Math.round(percentage)}%`,
    subtitle: `Doanh thu phòng tập đạt ${formatCurrency(total)} / ${formatCurrency(target)}.`,
    severity: "medium",
  };
};

const safelyLoad = async (label, loader, fallback) => {
  try {
    return await loader();
  } catch (error) {
    console.error(`Lỗi tạo thông báo ${label}:`, error);
    return fallback;
  }
};

const buildNotificationFeed = async ({ models, user, capabilities, now = new Date() }) => {
  const notifications = [];
  if (capabilities.canReadCustomers) {
    notifications.push(...await loadExpiringCustomerNotifications({ Customer: models.Customer, now }));
  }
  if (capabilities.canReadTeamTasks) {
    notifications.push(...await loadTeamTaskNotifications({
      TeamTask: models.TeamTask,
      role: user.role,
      now,
    }));
  }

  const kpi = await safelyLoad("KPI", () => loadKpiNotification({ models, user, now }), null);
  if (kpi) notifications.push(kpi);
  notifications.push(...await safelyLoad(
    "hoa hồng",
    () => loadCommissionNotifications({ CommissionPeriod: models.CommissionPeriod, user, capabilities, now }),
    []
  ));
  if (capabilities.canReadInventory) {
    notifications.push(...await safelyLoad(
      "tồn kho",
      () => loadStockNotifications({ Product: models.Product, Setting: models.Setting }),
      []
    ));
  }
  if (capabilities.canReadReports) {
    const revenue = await safelyLoad(
      "cột mốc doanh thu",
      () => loadRevenueNotification({ Transaction: models.Transaction, Setting: models.Setting, now }),
      null
    );
    if (revenue) notifications.push(revenue);
  }
  return { total: notifications.length, notifications };
};

module.exports = {
  buildNotificationFeed,
  getShiftStartTime,
  resolveCommissionTypes,
  resolveKpiMetric,
};
