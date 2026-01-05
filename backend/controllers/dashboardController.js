const Customer = require("../models/Customer");
const CheckIn = require("../models/CheckIn");

const getStats = async (req, res) => {
  try {
    const today = new Date();
    // Reset time to start of today for comparison
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    // Start of current month for revenue
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    // 1. Total Customers
    const totalCustomers = await Customer.countDocuments();

    // 2. Active Customers (endDate >= now)
    const activeCustomers = await Customer.countDocuments({
      endDate: { $gte: today },
    });

    // 3. Expiring Customers (endDate between now and 7 days from now)
    const next7Days = new Date(today);
    next7Days.setDate(next7Days.getDate() + 7);
    const expiringCustomers = await Customer.countDocuments({
      endDate: { $gte: today, $lte: next7Days },
    });

    // 4. Today's Check-ins & Peak Hours
    // Get all check-ins for today to calculate count and peak hours
    const todayCheckInDocs = await CheckIn.find({
      time: { $gte: startOfToday, $lt: startOfTomorrow },
    });

    const todayCheckInsCount = todayCheckInDocs.length;

    // Calculate Peak Hours for Today from the docs we just fetched
    const hoursCount = new Array(24).fill(0);
    todayCheckInDocs.forEach((doc) => {
      const date = new Date(doc.time);
      const hour = date.getHours();
      if (!isNaN(hour)) hoursCount[hour]++;
    });

    // Map to the format expected by Frontend: { hour: 6, count: X }...
    // Showing roughly 6:00 to 22:00
    const peakHours = hoursCount.slice(6, 22).map((count, i) => ({
      hour: i + 6,
      count,
    }));

    // 5. Monthly Revenue
    // Sum 'price' of all Customers with startDate in current month
    const newCustomersThisMonth = await Customer.find({
      startDate: { $gte: startOfMonth, $lt: startOfNextMonth },
    });
    
    const revenue = newCustomersThisMonth.reduce((sum, customer) => {
        return sum + (customer.price || 0);
    }, 0);

    // 6. Recent Activities (Last 5 check-ins)
    const recentActivities = await CheckIn.find()
      .sort({ time: -1 })
      .limit(5)
      .lean();

    // Format recent activities for frontend (optional, or let frontend format)
    // We'll send raw and let frontend format to match existing structure easily, 
    // or just return as is. Let's return as is and ensure Frontend adapts.
    
    res.json({
      total: totalCustomers,
      active: activeCustomers,
      expiring: expiringCustomers,
      todayCheckIns: todayCheckInsCount,
      revenue: revenue,
      peakHours: peakHours,
      recentActivities: recentActivities.map(ci => ({
          ...ci,
          // Frontend expects these specific fields if we want to reuse existing map
          // But better to send clean data and update frontend mapping
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
