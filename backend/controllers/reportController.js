const Customer = require("../models/Customer");
const Package = require("../models/Package");
const { startOfMonth, endOfMonth, subDays, addDays, startOfDay, endOfDay, eachDayOfInterval, format } = require("date-fns");

// @desc    Get dashboard summary statistics
// @route   GET /api/reports/summary
// @access  Private
const getSummary = async (req, res) => {
  try {
    const today = new Date();
    const firstDayOfMonth = startOfMonth(today);
    const lastDayOfMonth = endOfMonth(today);

    // Thực thi các truy vấn thống kê song song với Promise.all
    const [revenueAggregation, activeMembers, totalEverMembers] = await Promise.all([
      Customer.aggregate([
        {
          $match: {
            startDate: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$price" },
            newMembers: { $sum: 1 }
          }
        }
      ]),
      Customer.countDocuments({ endDate: { $gte: today } }),
      Customer.countDocuments()
    ]);

    const totalRevenue = revenueAggregation[0]?.totalRevenue || 0;
    const newMembers = revenueAggregation[0]?.newMembers || 0;
    let retentionRate = 0;
    let churnRate = 0;
    
    if (totalEverMembers > 0) {
       retentionRate = Math.round((activeMembers / totalEverMembers) * 100);
       churnRate = 100 - retentionRate;
    }

    res.json({
      totalRevenue,
      activeMembers,
      newMembers,
      retentionRate,
      churnRate
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get daily revenue chart for current month
// @route   GET /api/reports/revenue
// @access  Private
const getRevenueChart = async (req, res) => {
  try {
    const today = new Date();
    const firstDayOfMonth = startOfMonth(today);
    const lastDayOfMonth = endOfMonth(today);

    const revenueByDay = await Customer.aggregate([
      {
        $match: {
          startDate: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$startDate" } },
          revenue: { $sum: "$price" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill missing days with 0
    const allDays = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });
    const chartData = allDays.map(day => {
      const dayStr = format(day, "yyyy-MM-dd");
      const found = revenueByDay.find(r => r._id === dayStr);
      return {
        date: format(day, "dd/MM"),
        revenue: found ? found.revenue : 0
      };
    });

    res.json(chartData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get package distribution stats
// @route   GET /api/reports/packages
// @access  Private
const getPackageDistribution = async (req, res) => {
  try {
    const distribution = await Customer.aggregate([
      {
        $group: {
          _id: "$packageType",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Format cho Recharts PieChart (name, value)
    const chartData = distribution.map(item => ({
      name: item._id,
      value: item.count
    }));

    res.json(chartData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get members expiring in next 14 days
// @route   GET /api/reports/expiring
// @access  Private
const getExpiringMembers = async (req, res) => {
  try {
    const today = startOfDay(new Date());
    const next14Days = endOfDay(addDays(new Date(), 14));

    const expiringMembers = await Customer.find({
      endDate: { $gte: today, $lte: next14Days }
    }).select("name phone endDate packageType remainingSessions").lean();

    res.json(expiringMembers);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get detailed revenue/customer list for Excel export
// @route   GET /api/reports/revenue-details
// @access  Private
const getRevenueDetails = async (req, res) => {
  try {
    const today = new Date();
    const firstDayOfMonth = startOfMonth(today);
    const lastDayOfMonth = endOfMonth(today);

    const details = await Customer.find({
      startDate: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
    }).select("customerId name phone packageType startDate endDate price")
      .sort({ startDate: -1 }).lean();

    res.json(details);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getSummary,
  getRevenueChart,
  getPackageDistribution,
  getExpiringMembers,
  getRevenueDetails
};
