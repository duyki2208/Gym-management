const Customer = require("../models/Customer");
const CheckIn = require("../models/CheckIn");
const {
  startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths
} = require("date-fns");

const getStats = async (req, res) => {
  try {
    const today = new Date();

    // -- Dates for Check-ins --
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);
    const yesterdayStart = startOfDay(subDays(today, 1));
    const yesterdayEnd = endOfDay(subDays(today, 1));

    // -- Dates for Revenue --
    const thisMonthStart = startOfMonth(today);
    const thisMonthEnd = endOfMonth(today);
    const lastMonthStart = startOfMonth(subMonths(today, 1));
    const lastMonthEnd = endOfMonth(subMonths(today, 1));

    // -- Dates for New Customers --
    const thisWeekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
    const thisWeekEnd = endOfWeek(today, { weekStartsOn: 1 });
    const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
    const lastWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });

    // 3. Expiring Customers
    const next7Days = new Date(today);
    next7Days.setDate(next7Days.getDate() + 7);

    // Thực thi tất cả truy vấn song song
    const [
      totalCustomers,
      activeCustomers,
      expiringCustomers,
      todayCheckInDocs,
      yesterdayCheckIns,
      newCustomersThisMonth,
      newCustomersLastMonth,
      newCustomersThisWeek,
      newCustomersLastWeek,
      recentActivities
    ] = await Promise.all([
      Customer.countDocuments(),
      Customer.countDocuments({ endDate: { $gte: today } }),
      Customer.countDocuments({ endDate: { $gte: today, $lte: next7Days } }),
      CheckIn.find({ time: { $gte: todayStart, $lte: todayEnd } }).lean(),
      CheckIn.countDocuments({ time: { $gte: yesterdayStart, $lte: yesterdayEnd } }),
      Customer.find({ startDate: { $gte: thisMonthStart, $lte: thisMonthEnd } }).lean(),
      Customer.find({ startDate: { $gte: lastMonthStart, $lte: lastMonthEnd } }).lean(),
      Customer.countDocuments({ startDate: { $gte: thisWeekStart, $lte: thisWeekEnd } }),
      Customer.countDocuments({ startDate: { $gte: lastWeekStart, $lte: lastWeekEnd } }),
      CheckIn.find().sort({ time: -1 }).limit(5).lean()
    ]);

    const todayCheckInsCount = todayCheckInDocs.length;
    let checkInChange = todayCheckInsCount - yesterdayCheckIns;

    // Calculate Peak Hours for Today
    const hoursCount = new Array(24).fill(0);
    todayCheckInDocs.forEach((doc) => {
      const hour = new Date(doc.time).getHours();
      if (!isNaN(hour)) hoursCount[hour]++;
    });

    const peakHours = hoursCount.slice(6, 22).map((count, i) => ({
      hour: i + 6,
      count,
    }));

    // Calculate Revenue
    const revenueThisMonth = newCustomersThisMonth.reduce((sum, c) => sum + (c.price || 0), 0);
    const revenueLastMonth = newCustomersLastMonth.reduce((sum, c) => sum + (c.price || 0), 0);
    
    let revenueChangePercent = 0;
    if (revenueLastMonth > 0) {
      revenueChangePercent = ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100;
    } else if (revenueThisMonth > 0) {
      revenueChangePercent = 100;
    }

    // New Customers Change
    const newCustomersChange = newCustomersThisWeek - newCustomersLastWeek;

    // Active Percentage
    let activePercentage = 0;
    if (totalCustomers > 0) {
      activePercentage = (activeCustomers / totalCustomers) * 100;
    }

    res.json({
      total: totalCustomers,
      active: activeCustomers,
      activePercentage: Math.round(activePercentage),
      expiring: expiringCustomers,
      
      todayCheckIns: todayCheckInsCount,
      checkInChange: checkInChange, // > 0 positive, < 0 negative
      
      revenue: revenueThisMonth,
      revenueChangePercent: Math.round(revenueChangePercent),
      
      newCustomersThisWeek: newCustomersThisWeek,
      newCustomersChange: newCustomersChange,

      peakHours: peakHours,
      recentActivities: recentActivities.map(ci => ({
          ...ci,
          id: ci._id,
          customerName: ci.customerName,
          time: ci.time,
          type: ci.type || 'in'
      }))
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    res.status(500).json({ message: "Lỗi lấy dữ liệu thống kê" });
  }
};

module.exports = { getStats };
