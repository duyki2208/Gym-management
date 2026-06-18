const Customer = require("../models/Customer");
const Package = require("../models/Package");
const CheckIn = require("../models/CheckIn");
const Transaction = require("../models/Transaction");
const { startOfMonth, endOfMonth, subDays, addDays, startOfDay, endOfDay, eachDayOfInterval, format } = require("date-fns");


// @desc    Get dashboard summary statistics
// @route   GET /api/reports/summary
// @access  Private
const getSummary = async (req, res) => {
  try {
    const today = new Date();
    const firstDayOfMonth = startOfMonth(today);
    const lastDayOfMonth = endOfMonth(today);

    // Tính doanh thu từ Transaction (tiền thực thu) thay vì Customer.price (giá gói)
    const [revenueAggregation, newMembersCount, activeMembers, totalEverMembers] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            type: { $in: ["package_purchase", "pos_sale"] },
            status: "success",
            createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$amount" }, // Tiền thực thu (paidAmount)
          },
        },
      ]),
      // Đếm khách mới trong tháng từ Customer
      Customer.countDocuments({
        createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth },
      }),
      Customer.countDocuments({ endDate: { $gte: today } }),
      Customer.countDocuments(),
    ]);

    const totalRevenue = revenueAggregation[0]?.totalRevenue || 0;
    const newMembers = newMembersCount;
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
      churnRate,
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

    // Tính doanh thu từ Transaction (tiền thực thu) theo ngày
    const revenueByDay = await Transaction.aggregate([
      {
        $match: {
          type: { $in: ["package_purchase", "pos_sale"] },
          status: "success",
          createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Fill missing days with 0
    const allDays = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });
    const chartData = allDays.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const found = revenueByDay.find((r) => r._id === dayStr);
      return {
        date: format(day, "dd/MM"),
        revenue: found ? found.revenue : 0,
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

    // Lấy chi tiết giao dịch từ Transaction (tiền thực thu)
    const transactions = await Transaction.find({
      type: "package_purchase",
      status: "success",
      createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth },
    })
      .select("code customerName amount paymentMethod createdAt")
      .populate("customer", "name phone code")
      .sort({ createdAt: -1 })
      .lean();

    // Format để tương thích với frontend export Excel
    const details = transactions.map((t) => ({
      name: t.customer?.name || t.customerName,
      phone: t.customer?.phone || "",
      code: t.customer?.code || "",
      transactionCode: t.code,
      price: t.amount, // Tiền thực thu
      paymentMethod: t.paymentMethod,
      startDate: t.createdAt,
    }));

    res.json(details);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


const Product = require("../models/Product");
const SaleOrder = require("../models/SaleOrder");

// @desc    Get inventory and POS sales report
// @route   GET /api/reports/inventory
// @access  Private
const getInventoryReport = async (req, res) => {
  try {
    const today = new Date();
    const firstDayOfMonth = startOfMonth(today);
    const lastDayOfMonth = endOfMonth(today);

    const [posRevenueAggregation, products] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            type: "pos_sale",
            status: "success",
            createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
          }
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$amount" }
          }
        }
      ]),
      Product.find().lean()
    ]);

    const posRevenue = posRevenueAggregation[0]?.totalRevenue || 0;
    
    let totalStockValue = 0;
    const lowStockProducts = [];

    products.forEach(p => {
        totalStockValue += (p.stockQuantity || 0) * (p.sellPrice || 0);
        if (p.stockQuantity <= 10) {
            lowStockProducts.push(p);
        }
    });
    
    lowStockProducts.sort((a, b) => a.stockQuantity - b.stockQuantity);

    res.json({
        posRevenue,
        totalStockValue,
        lowStockProducts: lowStockProducts.slice(0, 10)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// @desc    Get Churn Prediction list
// @route   GET /api/v1/reports/churn-prediction
// @access  Private
const getChurnPrediction = async (req, res) => {
  try {
    const today = new Date();
    
    // 1. Lấy tất cả khách hàng có gói tập chưa hết hạn
    const activeCustomers = await Customer.find({
      endDate: { $gte: today }
    }).select("name code phone endDate packageType email avatar").lean();

    if (!activeCustomers || activeCustomers.length === 0) {
      return res.status(200).json({
        success: true,
        data: { highRisk: [], mediumRisk: [], lowRisk: [] },
        message: "Không có khách hàng nào đang active"
      });
    }

    // 2. Tối ưu hiệu suất: Query ngày check-in mới nhất của mỗi người bằng aggregation
    const customerIds = activeCustomers.map(c => c._id);
    const latestCheckIns = await CheckIn.aggregate([
      { $match: { customerId: { $in: customerIds } } },
      { $sort: { time: -1 } },
      { $group: { _id: "$customerId", latestCheckIn: { $first: "$time" } } }
    ]);

    // Tạo Map tra cứu
    const checkInMap = new Map();
    latestCheckIns.forEach(item => {
      checkInMap.set(item._id.toString(), new Date(item.latestCheckIn));
    });

    const highRisk = [];
    const mediumRisk = [];
    const lowRisk = [];

    // 3. Phân loại theo Risk Logic
    activeCustomers.forEach(customer => {
      const lastCheckIn = checkInMap.get(customer._id.toString()) || null;
      
      const daysUntilExpiration = Math.ceil((new Date(customer.endDate) - today) / (1000 * 60 * 60 * 24));
      
      const daysSinceLastCheckIn = lastCheckIn 
        ? Math.floor((today - lastCheckIn) / (1000 * 60 * 60 * 24))
        : 999;

      const customerData = {
        ...customer,
        daysUntilExpiration,
        daysSinceLastCheckIn,
        lastCheckInDate: lastCheckIn
      };

      if ((daysUntilExpiration < 14 && daysSinceLastCheckIn > 7) || daysSinceLastCheckIn > 21) {
        highRisk.push(customerData);
      } else if (daysUntilExpiration < 30 || daysSinceLastCheckIn > 14) {
        mediumRisk.push(customerData);
      } else {
        lowRisk.push(customerData);
      }
    });

    // Sắp xếp người rủi ro nhất (bỏ tập lâu nhất) lên đầu
    highRisk.sort((a, b) => b.daysSinceLastCheckIn - a.daysSinceLastCheckIn);
    mediumRisk.sort((a, b) => b.daysSinceLastCheckIn - a.daysSinceLastCheckIn);

    return res.status(200).json({
      success: true,
      data: {
        highRisk,
        mediumRisk,
        lowRisk
      },
      message: "Lấy dữ liệu Churn Prediction thành công"
    });
    
  } catch (error) {
    console.error("Error in getChurnPrediction:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ khi phân tích dữ liệu"
    });
  }
};


module.exports = {
  getSummary,
  getRevenueChart,
  getPackageDistribution,
  getExpiringMembers,
  getRevenueDetails,
  getInventoryReport,
  getChurnPrediction
};
