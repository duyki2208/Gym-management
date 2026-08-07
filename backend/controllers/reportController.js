const Customer = require("../models/Customer");
const Package = require("../models/Package");
const CheckIn = require("../models/CheckIn");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const Commission = require("../models/Commission");
const KPITarget = require("../models/KPITarget");
const Setting = require("../models/Setting");
const CustomerPackage = require("../models/CustomerPackage");
const WorkoutSession = require("../models/WorkoutSession");
const Product = require("../models/Product");
const TeamTask = require("../models/TeamTask");
const CommissionPeriod = require("../models/CommissionPeriod");
const Lead = require("../models/Lead");
const ExcelJS = require("exceljs");
const { startOfMonth, endOfMonth, subDays, subMonths, addDays, startOfDay, endOfDay, eachDayOfInterval, format } = require("date-fns");


// @desc    Get dashboard summary statistics
// @route   GET /api/reports/summary
// @access  Private
const getSummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    const today = new Date();
    const m = parseInt(month) || today.getMonth() + 1;
    const y = parseInt(year) || today.getFullYear();
    // Mốc thời gian theo GMT+7 (quy đổi về UTC để truy vấn)
    const firstDayOfMonth = new Date(Date.UTC(y, m - 1, 1, -7, 0, 0, 0));
    const lastDay = new Date(y, m, 0).getDate();
    const lastDayOfMonth = new Date(Date.UTC(y, m - 1, lastDay, 16, 59, 59, 999));

    // Tính doanh thu từ Transaction (tiền thực thu) phân rạch ròi 3 dòng tiền
    const [revenueAggregation, streamAggregation, newMembersCount, activeMembers, totalEverMembers] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            type: { $in: ["package_purchase", "pos_sale", "pt_session", "service_fee"] },
            status: "success",
            createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$amount" },
          },
        },
      ]),
      Transaction.aggregate([
        {
          $match: {
            type: { $in: ["package_purchase", "pos_sale", "pt_session", "service_fee"] },
            status: "success",
            createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth },
          },
        },
        {
          $group: {
            _id: "$type",
            total: { $sum: "$amount" },
          },
        },
      ]),
      // Đếm khách mới trong tháng từ Customer
      Customer.countDocuments({
        createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth },
      }),
      // Hội viên hoạt động tại thời điểm đó (có gói bao phủ kỳ báo cáo)
      Customer.countDocuments({
        startDate: { $lte: lastDayOfMonth },
        endDate: { $gte: firstDayOfMonth }
      }),
      Customer.countDocuments({
        createdAt: { $lte: lastDayOfMonth }
      }),
    ]);

    const totalRevenue = revenueAggregation[0]?.totalRevenue || 0;
    const streamMap = {};
    streamAggregation.forEach(item => {
      streamMap[item._id] = item.total;
    });

    const revenueStreams = {
      packageSales: streamMap["package_purchase"] || 0,
      posSales: streamMap["pos_sale"] || 0,
      serviceFees: streamMap["service_fee"] || 0,
      ptSessions: streamMap["pt_session"] || 0,
    };

    const newMembers = newMembersCount;
    let retentionRate = 0;
    let churnRate = 0;

    if (totalEverMembers > 0) {
       retentionRate = Math.round((activeMembers / totalEverMembers) * 100);
       churnRate = 100 - retentionRate;
    }

    res.json({
      totalRevenue,
      revenueStreams,
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
    const { month, year } = req.query;
    const today = new Date();
    const m = parseInt(month) || today.getMonth() + 1;
    const y = parseInt(year) || today.getFullYear();
    const firstDayOfMonth = new Date(Date.UTC(y, m - 1, 1, -7, 0, 0, 0));
    const lastDay = new Date(y, m, 0).getDate();
    const lastDayOfMonth = new Date(Date.UTC(y, m - 1, lastDay, 16, 59, 59, 999));

    // Tính doanh thu từ Transaction (tiền thực thu) theo ngày và phân loại nguồn tiền
    const revenueByDay = await Transaction.aggregate([
      {
        $match: {
          type: { $in: ["package_purchase", "pos_sale", "pt_session", "service_fee"] },
          status: "success",
          createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+07:00" } },
            type: "$type",
          },
          amount: { $sum: "$amount" },
        },
      },
    ]);

    const dayMap = {};
    revenueByDay.forEach(r => {
      const d = r._id.date;
      if (!dayMap[d]) dayMap[d] = { total: 0, package: 0, pos: 0, service: 0 };
      dayMap[d].total += r.amount;
      if (r._id.type === "package_purchase") dayMap[d].package += r.amount;
      else if (r._id.type === "pos_sale") dayMap[d].pos += r.amount;
      else if (r._id.type === "service_fee") dayMap[d].service += r.amount;
    });

    // Fill missing days with 0
    const allDays = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });
    const chartData = allDays.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const found = dayMap[dayStr];
      return {
        date: format(day, "dd/MM"),
        revenue: found ? found.total : 0,
        packageSales: found ? found.package : 0,
        posSales: found ? found.pos : 0,
        serviceFees: found ? found.service : 0,
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
    const { month, year } = req.query;
    const today = new Date();
    const m = parseInt(month) || today.getMonth() + 1;
    const y = parseInt(year) || today.getFullYear();
    // Mốc thời gian theo GMT+7 (quy đổi về UTC để truy vấn)
    const firstDayOfMonth = new Date(Date.UTC(y, m - 1, 1, -7, 0, 0, 0));
    const lastDay = new Date(y, m, 0).getDate();
    const lastDayOfMonth = new Date(Date.UTC(y, m - 1, lastDay, 16, 59, 59, 999));

    // Lấy chi tiết giao dịch từ Transaction (tiền thực thu)
    const transactions = await Transaction.find({
      type: { $in: ["package_purchase", "pos_sale", "pt_session", "service_fee"] },
      status: "success",
      createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth },
    })
      .select("code customerName amount paymentMethod createdAt customerPackage type note")
      .populate("customer", "name phone code")
      .populate("customerPackage", "packageName endDate")
      .sort({ createdAt: -1 })
      .lean();

    // Helper format loại giao dịch theo yêu cầu
    const getPackageTypeLabel = (t) => {
      if (t.customerPackage?.packageName) return t.customerPackage.packageName;
      if (t.type === "pos_sale") return "Bán lẻ";
      if (t.type === "service_fee") return "Phí dịch vụ";
      if (t.type === "pt_session") return "Buổi PT";
      return "Gói tập";
    };

    // Format để tương thích với frontend export Excel
    const details = transactions.map((t) => ({
      name: t.customer?.name || t.customerName,
      phone: t.customer?.phone || "",
      code: t.customer?.code || "",
      transactionCode: t.code,
      price: t.amount, // Tiền thực thu
      paymentMethod: t.paymentMethod,
      startDate: t.createdAt,
      packageType: getPackageTypeLabel(t),
      endDate: t.customerPackage?.endDate || t.createdAt,
    }));

    res.json(details);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


const SaleOrder = require("../models/SaleOrder");

// @desc    Get inventory and POS sales report
// @route   GET /api/reports/inventory
// @access  Private
const getInventoryReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    const today = new Date();
    const m = parseInt(month) || today.getMonth() + 1;
    const y = parseInt(year) || today.getFullYear();
    const firstDayOfMonth = new Date(Date.UTC(y, m - 1, 1, -7, 0, 0, 0));
    const lastDay = new Date(y, m, 0).getDate();
    const lastDayOfMonth = new Date(Date.UTC(y, m - 1, lastDay, 16, 59, 59, 999));

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

// @desc    Báo cáo doanh thu nâng cao
// @route   GET /api/reports/revenue-advanced
// @access  Private
const getRevenueAdvanced = async (req, res) => {
  try {
    const { month, year } = req.query;
    const today = new Date();
    const m = parseInt(month) || today.getMonth() + 1;
    const y = parseInt(year) || today.getFullYear();

    const firstDay = 1;
    const lastDay = new Date(y, m, 0).getDate();
    const start = new Date(Date.UTC(y, m - 1, firstDay, -7, 0, 0, 0));
    const end = new Date(Date.UTC(y, m - 1, lastDay, 16, 59, 59, 999));

    // 1. Phân chia nguồn doanh thu trong tháng này
    const revenueBySource = await Transaction.aggregate([
      {
        $match: {
          status: "success",
          createdAt: { $gte: start, $lte: end },
          type: { $in: ["package_purchase", "pos_sale", "pt_session", "service_fee"] }
        }
      },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" }
        }
      }
    ]);

    const sources = {
      package_purchase: 0,
      pos_sale: 0,
      pt_session: 0,
      service_fee: 0
    };
    revenueBySource.forEach(item => {
      if (sources[item._id] !== undefined) {
        sources[item._id] = item.total;
      }
    });

    const totalRevenueThisMonth = sources.package_purchase + sources.pos_sale + sources.pt_session + sources.service_fee;

    // 2. Doanh thu tháng trước (MoM)
    let prevM = m - 1;
    let prevY = y;
    if (prevM === 0) {
      prevM = 12;
      prevY = y - 1;
    }
    const prevLastDay = new Date(prevY, prevM, 0).getDate();
    const prevStart = new Date(Date.UTC(prevY, prevM - 1, 1, -7, 0, 0, 0));
    const prevEnd = new Date(Date.UTC(prevY, prevM - 1, prevLastDay, 16, 59, 59, 999));

    const revenuePrevMonthAgg = await Transaction.aggregate([
      {
        $match: {
          status: "success",
          createdAt: { $gte: prevStart, $lte: prevEnd },
          type: { $in: ["package_purchase", "pos_sale", "pt_session", "service_fee"] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);
    const totalRevenuePrevMonth = revenuePrevMonthAgg[0]?.total || 0;
    const momGrowth = totalRevenuePrevMonth > 0 
      ? Math.round(((totalRevenueThisMonth - totalRevenuePrevMonth) / totalRevenuePrevMonth) * 100)
      : 0;

    // 3. Doanh thu cùng kỳ năm ngoái (YoY)
    const lyLastDay = new Date(y - 1, m, 0).getDate();
    const lastYearStart = new Date(Date.UTC(y - 1, m - 1, 1, -7, 0, 0, 0));
    const lastYearEnd = new Date(Date.UTC(y - 1, m - 1, lyLastDay, 16, 59, 59, 999));
    const revenueLastYearAgg = await Transaction.aggregate([
      {
        $match: {
          status: "success",
          createdAt: { $gte: lastYearStart, $lte: lastYearEnd },
          type: { $in: ["package_purchase", "pos_sale", "pt_session", "service_fee"] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);
    const totalRevenueLastYear = revenueLastYearAgg[0]?.total || 0;
    const yoyGrowth = totalRevenueLastYear > 0
      ? Math.round(((totalRevenueThisMonth - totalRevenueLastYear) / totalRevenueLastYear) * 100)
      : 0;

    // 4. Xuuyên 6 tháng gần nhất
    const trendData = [];
    for (let i = 5; i >= 0; i--) {
      let dateTarget = new Date(y, m - 1 - i, 1);
      const tY = dateTarget.getFullYear();
      const tM = dateTarget.getMonth() + 1;
      const tLastDay = new Date(tY, tM, 0).getDate();
      const startT = new Date(Date.UTC(tY, tM - 1, 1, -7, 0, 0, 0));
      const endT = new Date(Date.UTC(tY, tM - 1, tLastDay, 16, 59, 59, 999));
      const label = format(dateTarget, "MM/yyyy");

      const monthlyRevAgg = await Transaction.aggregate([
        {
          $match: {
            status: "success",
            createdAt: { $gte: startT, $lte: endT },
            type: { $in: ["package_purchase", "pos_sale", "pt_session", "service_fee"] }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" }
          }
        }
      ]);

      trendData.push({
        month: label,
        revenue: monthlyRevAgg[0]?.total || 0
      });
    }

    res.json({
      success: true,
      data: {
        month: m,
        year: y,
        sources: [
          { name: "Gói tập", value: sources.package_purchase },
          { name: "Cửa hàng (POS)", value: sources.pos_sale },
          { name: "Buổi PT lẻ", value: sources.pt_session }
        ],
        totalRevenue: totalRevenueThisMonth,
        compareLastMonth: {
          value: totalRevenuePrevMonth,
          growthPercent: momGrowth
        },
        compareLastYear: {
          value: totalRevenueLastYear,
          growthPercent: yoyGrowth
        },
        trend: trendData
      }
    });
  } catch (error) {
    console.error("Lỗi lấy báo cáo doanh thu nâng cao:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

// @desc    Báo cáo nhân sự tổng hợp lương, KPI, hoa hồng
// @route   GET /api/reports/hr-summary
// @access  Private
const getHRSummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    const today = new Date();
    const m = parseInt(month) || today.getMonth() + 1;
    const y = parseInt(year) || today.getFullYear();

    const start = startOfMonth(new Date(y, m - 1, 1));
    const end = endOfMonth(new Date(y, m - 1, 1));

    // Lấy danh sách nhân viên PT và Sale
    const staffList = await User.find({
      role: { $in: ["pt", "sale", "sm", "pm"] }
    }).select("fullName username role").lean();

    // Mặc định lương cơ bản: 5 triệu VND
    const defaultBasicSalary = 5000000;

    const hrData = await Promise.all(staffList.map(async (staff) => {
      // 1. Tính tổng hoa hồng trong tháng của nhân viên này
      const commissionAgg = await Commission.aggregate([
        {
          $match: {
            staff: staff._id,
            month: m,
            year: y,
            status: "active"
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" }
          }
        }
      ]);
      const totalCommission = commissionAgg[0]?.total || 0;

      // 2. Tính hiệu suất KPI đạt được
      const target = await KPITarget.findOne({ staff: staff._id, month: m, year: y });
      const setting = await Setting.findOne();

      let kpiPercentage = 0;
      if (staff.role === "pt" || staff.role === "pm") {
        const sessionTarget = target?.ptSessionTarget !== undefined
          ? target.ptSessionTarget
          : setting?.ptMonthlySessionTarget || 80;

        const actualSessions = await WorkoutSession.countDocuments({
          pt: staff._id,
          status: "completed",
          date: { $gte: start, $lte: end }
        });
        kpiPercentage = sessionTarget > 0 ? Math.round((actualSessions / sessionTarget) * 100) : 100;
      } else {
        // Sale/SM
        const revenueTarget = target?.saleRevenueTarget !== undefined
          ? target.saleRevenueTarget
          : setting?.saleMonthlyRevenueTarget || 100000000;

        // Doanh số thực đạt
        const packagesSold = await CustomerPackage.find({
          assignedStaff: staff._id,
          createdAt: { $gte: start, $lte: end }
        }).select("_id");
        const packageIds = packagesSold.map(p => p._id);

        const revenueAgg = await Transaction.aggregate([
          {
            $match: {
              status: "success",
              $or: [
                { staff: staff._id },
                { customerPackage: { $in: packageIds } }
              ],
              createdAt: { $gte: start, $lte: end }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$amount" }
            }
          }
        ]);
        const actualRevenue = revenueAgg[0]?.total || 0;
        kpiPercentage = revenueTarget > 0 ? Math.round((actualRevenue / revenueTarget) * 100) : 100;
      }

      const totalSalary = defaultBasicSalary + totalCommission;

      return {
        _id: staff._id,
        fullName: staff.fullName || staff.username,
        role: staff.role,
        basicSalary: defaultBasicSalary,
        commission: totalCommission,
        kpiProgress: kpiPercentage,
        totalSalary
      };
    }));

    res.json({
      success: true,
      data: hrData
    });
  } catch (error) {
    console.error("Lỗi lấy báo cáo nhân sự:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

// @desc    Báo cáo khách hàng chuyên sâu
// @route   GET /api/reports/customer-analytics
// @access  Private
const getCustomerAnalytics = async (req, res) => {
  try {
    const today = new Date();

    // 1. Phân bổ giới tính
    const genderDist = await Customer.aggregate([
      {
        $group: {
          _id: { $toLower: "$gender" },
          count: { $sum: 1 }
        }
      }
    ]);

    const genderData = [
      { name: "Nam", value: 0 },
      { name: "Nữ", value: 0 },
      { name: "Khác", value: 0 }
    ];
    genderDist.forEach(item => {
      const g = item._id ? item._id.trim() : "";
      if (g === "nam" || g === "male") {
        genderData[0].value += item.count;
      } else if (g === "nữ" || g === "female") {
        genderData[1].value += item.count;
      } else {
        genderData[2].value += item.count;
      }
    });

    // 2. Phân bổ độ tuổi
    const customers = await Customer.find({}).select("dob").lean();
    const ageData = [
      { name: "Dưới 18 tuổi", value: 0 },
      { name: "18 - 35 tuổi", value: 0 },
      { name: "36 - 50 tuổi", value: 0 },
      { name: "Trên 50 tuổi", value: 0 }
    ];

    customers.forEach(c => {
      if (c.dob) {
        const age = today.getFullYear() - new Date(c.dob).getFullYear();
        if (age < 18) ageData[0].value += 1;
        else if (age <= 35) ageData[1].value += 1;
        else if (age <= 50) ageData[2].value += 1;
        else ageData[3].value += 1;
      }
    });

    // 3. Khách hàng inactive (Không check-in và không tập PT trong 30 ngày gần đây)
    const thirtyDaysAgo = subDays(today, 30);

    const activeCheckIns = await CheckIn.distinct("customerId", {
      time: { $gte: thirtyDaysAgo }
    });

    const activeWorkouts = await WorkoutSession.distinct("customer", {
      date: { $gte: thirtyDaysAgo }
    });

    const activeIds = new Set([
      ...activeCheckIns.map(id => id.toString()),
      ...activeWorkouts.map(id => id.toString())
    ]);

    const inactiveCustomers = await Customer.find({
      _id: { $nin: Array.from(activeIds) },
      endDate: { $gte: today }
    })
      .select("name code phone endDate packageType remainingSessions")
      .lean();

    // 4. Phân bổ gói tập (Package Popularity)
    const packageDist = await CustomerPackage.aggregate([
      { $match: { status: "active" } },
      { $group: { _id: "$packageName", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const packageData = packageDist.map(item => ({
      name: item._id || "Khác",
      value: item.count
    }));

    // 5. Phân bổ nguồn khách hàng (Acquisition Channels)
    const sourceDist = await Customer.aggregate([
      { $group: { _id: { $ifNull: ["$source", "other"] }, count: { $sum: 1 } } }
    ]);
    const sourceMap = {
      facebook: "Facebook",
      hotline: "Hotline",
      referral: "Hội viên giới thiệu",
      web: "Website",
      other: "Khác/Trực tiếp"
    };
    const sourceData = sourceDist.map(item => ({
      name: sourceMap[item._id] || item._id || "Khác/Trực tiếp",
      value: item.count
    }));

    // 6. Phân khúc tần suất tập luyện (Workout Intensity last 30 days)
    const intensityData = [
      { name: "Tập luyện cao (>15 ngày)", value: 0 },
      { name: "Tập vừa (5-15 ngày)", value: 0 },
      { name: "Tập ít (1-4 ngày)", value: 0 },
      { name: "Không đi tập (0 ngày)", value: 0 }
    ];

    const activeCustomers = await Customer.find({ endDate: { $gte: today } }).select("_id").lean();
    const activeCustIds = activeCustomers.map(c => c._id.toString());

    const checkinCounts = await CheckIn.aggregate([
      { $match: { time: { $gte: thirtyDaysAgo } } },
      { $group: { _id: "$customerId", count: { $sum: 1 } } }
    ]);

    const checkinMap = new Map();
    checkinCounts.forEach(c => {
      if (c._id) checkinMap.set(c._id.toString(), c.count);
    });

    activeCustIds.forEach(id => {
      const count = checkinMap.get(id) || 0;
      if (count > 15) intensityData[0].value += 1;
      else if (count >= 5) intensityData[1].value += 1;
      else if (count >= 1) intensityData[2].value += 1;
      else intensityData[3].value += 1;
    });

    // 7. Tỷ lệ có PT huấn luyện vs Tự tập (tính trên toàn bộ các gói tập active)
    const withTrainerCount = await CustomerPackage.countDocuments({
      status: "active",
      trainer: { $ne: null }
    });
    const soloCount = await CustomerPackage.countDocuments({
      status: "active",
      trainer: null
    });

    // 8. Thống kê số khách theo từng PT (trainer breakdown) (chỉ tính trên các gói theo buổi)
    const trainerStatsAgg = await CustomerPackage.aggregate([
      { $match: { status: "active", trainer: { $ne: null } } },
      { $lookup: { from: "packages", localField: "packageName", foreignField: "name", as: "pkgInfo" } },
      { $unwind: { path: "$pkgInfo", preserveNullAndEmptyArrays: true } },
      { $match: { "pkgInfo.type": "session" } },
      { $group: { _id: "$trainer", count: { $sum: 1 } } },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "ptInfo" } },
      { $unwind: "$ptInfo" },
      { $project: { _id: 1, name: "$ptInfo.fullName", role: "$ptInfo.role", count: 1 } },
      { $sort: { count: -1 } }
    ]);
    const trainerStats = trainerStatsAgg.map(item => ({
      _id: item._id,
      name: item.name,
      role: item.role,
      count: item.count
    }));

    // 8. Chi tiêu trung bình của mỗi hội viên (ARPU - Average Revenue Per User)
    const totalPaymentsAgg = await Transaction.aggregate([
      { $match: { status: "success", type: { $in: ["package_purchase", "pos_sale", "pt_session", "service_fee"] } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalPayments = totalPaymentsAgg[0]?.total || 0;
    const totalCustCount = await Customer.countDocuments({});
    const arpu = totalCustCount > 0 ? Math.round(totalPayments / totalCustCount) : 0;

    res.json({
      success: true,
      data: {
        gender: genderData,
        age: ageData,
        inactive: inactiveCustomers,
        packagePopularity: packageData,
        sources: sourceData,
        intensity: intensityData,
        trainerRatio: {
          withTrainer: withTrainerCount,
          solo: soloCount
        },
        trainerStats,
        arpu
      }
    });
  } catch (error) {
    console.error("Lỗi lấy phân tích khách hàng:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

// @desc    Báo cáo tổng hợp cảnh báo & thông báo vận hành
// @route   GET /api/reports/notifications-summary
// @access  Private
const getNotificationsSummary = async (req, res) => {
  try {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    // 1. Khách hàng sắp hết hạn (trong 14 ngày)
    const fourteenDaysLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const expiringCustomers = await Customer.find({
      endDate: { $gte: todayStart, $lte: fourteenDaysLater }
    }).select("name phone code endDate packageType").sort({ endDate: 1 }).lean();

    // 2. Sản phẩm sắp hết hàng (tồn kho <= minStockAlert)
    const setting = await Setting.findOne() || {};
    const minAlert = setting.minStockAlert || 5;
    const lowStockProducts = await Product.find({
      stockQuantity: { $lte: minAlert }
    }).select("name stockQuantity minStockAlert").sort({ stockQuantity: 1 }).lean();

    // 3. Công việc ca trực chưa hoàn thành hôm nay
    const yearStr = now.getFullYear();
    const monthStr = String(now.getMonth() + 1).padStart(2, '0');
    const dayStr = String(now.getDate()).padStart(2, '0');
    const todayStr = `${yearStr}-${monthStr}-${dayStr}`;

    const pendingTasks = await TeamTask.find({
      date: todayStr,
      isCompleted: false
    }).select("title timeSlot staffName").lean();

    // 4. Kỳ lương hoa hồng chờ duyệt (pending)
    const pendingCommissions = await CommissionPeriod.find({
      status: "pending"
    }).select("month year type status totalAmount").lean();

    // 5. Nhân viên có KPI tháng đạt thấp (< 50% chỉ tiêu)
    const m = now.getMonth() + 1;
    const y = now.getFullYear();
    const start = startOfMonth(now);
    const end = endOfMonth(now);

    const staffList = await User.find({
      role: { $in: ["pt", "sale", "sm", "pm"] }
    }).select("fullName username role").lean();

    const lowKPIStaff = [];
    const daysInMonth = new Date(y, m, 0).getDate();
    const daysLeft = daysInMonth - now.getDate();

    // Luôn quét chỉ tiêu, nhưng đánh dấu cảnh báo
    for (const staff of staffList) {
      const target = await KPITarget.findOne({ staff: staff._id, month: m, year: y });
      let kpiPercentage = 0;
      let targetVal = 0;
      let actualVal = 0;

      if (staff.role === "pt" || staff.role === "pm") {
        targetVal = target?.ptSessionTarget !== undefined
          ? target.ptSessionTarget
          : setting?.ptMonthlySessionTarget || 80;

        actualVal = await WorkoutSession.countDocuments({
          pt: staff._id,
          status: "completed",
          date: { $gte: start, $lte: end }
        });
        kpiPercentage = targetVal > 0 ? Math.round((actualVal / targetVal) * 100) : 100;
      } else {
        targetVal = target?.saleRevenueTarget !== undefined
          ? target.saleRevenueTarget
          : setting?.saleMonthlyRevenueTarget || 100000000;

        const packagesSold = await CustomerPackage.find({
          assignedStaff: staff._id,
          createdAt: { $gte: start, $lte: end }
        }).select("_id");
        const packageIds = packagesSold.map(p => p._id);

        const revenueAgg = await Transaction.aggregate([
          {
            $match: {
              status: "success",
              $or: [
                { staff: staff._id },
                { customerPackage: { $in: packageIds } }
              ],
              createdAt: { $gte: start, $lte: end }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$amount" }
            }
          }
        ]);
        actualVal = revenueAgg[0]?.total || 0;
        kpiPercentage = targetVal > 0 ? Math.round((actualVal / targetVal) * 100) : 100;
      }

      if (kpiPercentage < 50 && targetVal > 0) {
        lowKPIStaff.push({
          _id: staff._id,
          fullName: staff.fullName || staff.username,
          role: staff.role,
          target: targetVal,
          actual: actualVal,
          percentage: kpiPercentage
        });
      }
    }

    res.json({
      success: true,
      data: {
        expiringCustomers,
        lowStockProducts,
        pendingTasks,
        pendingCommissions,
        lowKPIStaff,
        expiringCustomersCount: expiringCustomers.length,
        lowStockProductsCount: lowStockProducts.length,
        pendingTasksCount: pendingTasks.length,
        pendingCommissionsCount: pendingCommissions.length,
        lowKPIStaffCount: lowKPIStaff.length
      }
    });
  } catch (error) {
    console.error("Lỗi lấy báo cáo tổng hợp thông báo:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

// @desc    Báo cáo chi tiết buổi tập của PT trong tháng (kèm trạng thái đối soát & khiếu nại)
// @route   GET /api/reports/pt-sessions
const getPTSessionsReport = async (req, res) => {
  try {
    const { month, year, ptId, status } = req.query;
    const m = month ? parseInt(month) : new Date().getMonth() + 1;
    const y = year ? parseInt(year) : new Date().getFullYear();

    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59, 999);

    const baseQuery = {
      date: { $gte: startDate, $lte: endDate },
    };
    if (ptId && ptId !== "all") {
      baseQuery.pt = ptId;
    }

    // Query lọc theo trạng thái nếu có
    const filterQuery = { ...baseQuery };
    if (status && status !== "all") {
      filterQuery.status = status;
    }

    const sessions = await WorkoutSession.find(filterQuery)
      .populate("customer", "name code phone")
      .populate("confirmedBy", "fullName role")
      .populate("pt", "fullName username role")
      .sort({ date: -1 })
      .lean();

    // Đếm tổng số buổi hoàn thành & bị huỷ trong kỳ (để thống kê độc lập)
    const completedCount = await WorkoutSession.countDocuments({ ...baseQuery, status: "completed" });
    const cancelledCount = await WorkoutSession.countDocuments({ ...baseQuery, status: "cancelled" });

    // Lấy thông tin gói tập của từng khách hàng (populate package để lấy tổng số buổi gốc của gói)
    const customerIds = [...new Set(sessions.map((s) => s.customer?._id).filter(Boolean))];
    const customerPackages = await CustomerPackage.find({
      customer: { $in: customerIds },
      isDeleted: { $ne: true },
    })
      .populate("package", "name sessions type")
      .sort({ createdAt: -1 })
      .lean();

    // Mapping customerId -> gói tập phù hợp nhất (ưu tiên active)
    const packageMap = {};
    customerPackages.forEach((pkg) => {
      const custIdStr = pkg.customer.toString();
      if (!packageMap[custIdStr] || (pkg.status === "active" && packageMap[custIdStr].status !== "active")) {
        packageMap[custIdStr] = pkg;
      }
    });

    // Thống kê số buổi tập PT đã hoàn thành (completed) trong lịch sử tập luyện của từng khách hàng
    const completedHistoryAgg = await WorkoutSession.aggregate([
      {
        $match: {
          customer: { $in: customerIds },
          status: "completed",
        },
      },
      {
        $group: {
          _id: "$customer",
          completedCount: { $sum: 1 },
        },
      },
    ]);

    const completedHistoryMap = {};
    completedHistoryAgg.forEach((item) => {
      completedHistoryMap[item._id.toString()] = item.completedCount;
    });

    const enrichedSessions = sessions.map((s) => {
      const custId = s.customer?._id?.toString();
      const pkg = packageMap[custId];

      // Số buổi đã tập trong lịch sử của hội viên này
      const usedSessions = custId ? (completedHistoryMap[custId] || 0) : 0;

      // Tổng số buổi của gói đăng ký
      let totalSessions = 0;
      if (pkg?.package?.sessions && pkg.package.sessions > 0) {
        totalSessions = pkg.package.sessions;
      } else if (pkg) {
        totalSessions = Math.max(usedSessions, usedSessions + (pkg.remainingSessions || 0));
      }

      // Tên gói tập chính xác khách đăng ký
      const packageName = pkg?.packageName || pkg?.package?.name || "Gói PT";

      return {
        ...s,
        packageName,
        totalSessions,
        usedSessions,
        remaining: pkg ? pkg.remainingSessions : 0,
      };
    });

    // Thống kê số lượng khách sắp hết buổi (<= 2 buổi còn lại)
    const atRiskPackages = await CustomerPackage.countDocuments({
      status: "active",
      remainingSessions: { $gte: 0, $lte: 2 },
    });

    // Bảng xếp hạng PT theo số buổi hoàn thành (không tính buổi huỷ/vi phạm)
    const leaderboardAgg = await WorkoutSession.aggregate([
      { $match: { date: { $gte: startDate, $lte: endDate }, status: "completed" } },
      {
        $group: {
          _id: "$pt",
          completedSessions: { $sum: 1 },
        },
      },
      { $sort: { completedSessions: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "ptInfo",
        },
      },
      { $unwind: { path: "$ptInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: { $ifNull: ["$ptInfo.fullName", "$ptInfo.username", "PT Khác"] },
          sessions: "$completedSessions",
          completion: { $literal: 95 }, // Tỉ lệ hoàn thành tham chiếu
        },
      },
    ]);

    const settings = await Setting.findOne().lean();
    const defaultRate = settings?.ptCommissionRate || 10;
    const sessionRate = 500000;

    const period = await CommissionPeriod.findOne({ month: m, year: y, type: "pt" }).lean();

    // QUAN TRỌNG: Buổi bị huỷ (cancelled) do PT gian lận/vi phạm -> TUYỆT ĐỐI KHÔNG TÍNH HOA HỒNG
    const estimatedCommission = completedCount * sessionRate * (defaultRate / 100);

    res.json({
      success: true,
      data: {
        month: m,
        year: y,
        sessions: enrichedSessions,
        totalSessions: sessions.length,
        completedCount,
        cancelledCount,
        atRiskCount: atRiskPackages,
        sessionRate,
        commissionRate: defaultRate,
        estimatedCommission,
        periodStatus: period?.status || "draft",
        periodId: period?._id || null,
        disputes: period?.disputes || [],
        leaderboard: leaderboardAgg,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy báo cáo buổi tập PT:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy báo cáo buổi tập" });
  }
};

// @desc    Xuất file Excel đối soát buổi tập PT
// @route   GET /api/reports/pt-sessions/export-excel
const exportPTSessionsExcel = async (req, res) => {
  try {
    const { month, year, ptId } = req.query;
    const m = month ? parseInt(month) : new Date().getMonth() + 1;
    const y = year ? parseInt(year) : new Date().getFullYear();

    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59, 999);

    const query = {
      date: { $gte: startDate, $lte: endDate },
      status: "completed",
    };

    let ptUser = null;
    if (ptId && ptId !== "all") {
      query.pt = ptId;
      ptUser = await User.findById(ptId).select("fullName username").lean();
    }

    const sessions = await WorkoutSession.find(query)
      .populate("customer", "name code phone")
      .populate("confirmedBy", "fullName role")
      .populate("pt", "fullName username role")
      .sort({ date: 1 })
      .lean();

    const settings = await Setting.findOne().lean();
    const defaultRate = settings?.ptCommissionRate || 10;
    const sessionRate = 500000;
    const totalSessions = sessions.length;
    const estimatedCommission = totalSessions * sessionRate * (defaultRate / 100);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`PT_DoiSoat_${m}_${y}`);

    worksheet.mergeCells("A1:G1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = `BÁO CÁO BUỔI TẬP CHI TIẾT PT — THÁNG ${m}/${y}`;
    titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "047857" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(1).height = 40;

    worksheet.mergeCells("A2:G2");
    const subCell = worksheet.getCell("A2");
    subCell.value = `PT: ${ptUser ? ptUser.fullName : "Tất cả PT"} | Thời gian xuất: ${new Date().toLocaleString("vi-VN")}`;
    subCell.font = { name: "Calibri", size: 11, italic: true, color: { argb: "374151" } };
    subCell.alignment = { horizontal: "center", vertical: "middle" };
    worksheet.getRow(2).height = 22;

    worksheet.addRow([]);

    const headers = ["STT", "Ngày", "Giờ", "Khách hàng", "Mã KH", "Xác nhận bởi", "Trạng thái"];
    const headerRow = worksheet.addRow(headers);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "059669" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "D1D5DB" } },
        bottom: { style: "medium", color: { argb: "065F46" } },
        left: { style: "thin", color: { argb: "D1D5DB" } },
        right: { style: "thin", color: { argb: "D1D5DB" } },
      };
    });

    sessions.forEach((s, index) => {
      const dt = new Date(s.date);
      const rowData = [
        index + 1,
        dt.toLocaleDateString("vi-VN"),
        dt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        s.customer?.name || "N/A",
        s.customer?.code || "N/A",
        s.confirmedBy?.fullName || "Lễ tân",
        "Confirmed",
      ];
      const row = worksheet.addRow(rowData);
      row.height = 22;
      row.eachCell((cell, col) => {
        cell.font = { name: "Calibri", size: 11 };
        cell.border = {
          top: { style: "thin", color: { argb: "E5E7EB" } },
          bottom: { style: "thin", color: { argb: "E5E7EB" } },
          left: { style: "thin", color: { argb: "E5E7EB" } },
          right: { style: "thin", color: { argb: "E5E7EB" } },
        };
        if ([1, 2, 3, 5, 7].includes(col)) {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        }
      });
    });

    worksheet.addRow([]);

    const summaryRow1 = worksheet.addRow(["", "", "", "", "Tổng số buổi:", totalSessions, ""]);
    summaryRow1.getCell(5).font = { bold: true };
    summaryRow1.getCell(6).font = { bold: true, color: { argb: "047857" } };

    const summaryRow2 = worksheet.addRow(["", "", "", "", "Đơn giá trung bình:", `${sessionRate.toLocaleString("vi-VN")}đ`, ""]);
    summaryRow2.getCell(5).font = { bold: true };

    const summaryRow3 = worksheet.addRow(["", "", "", "", "Hoa hồng dự kiến:", `${estimatedCommission.toLocaleString("vi-VN")}đ`, ""]);
    summaryRow3.getCell(5).font = { bold: true, size: 12 };
    summaryRow3.getCell(6).font = { bold: true, size: 12, color: { argb: "DC2626" } };

    worksheet.columns.forEach((column) => {
      let maxLen = 12;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const len = cell.value ? String(cell.value).length : 0;
        if (len > maxLen) maxLen = len;
      });
      column.width = Math.min(maxLen + 4, 30);
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="GymPro_PT_Sessions_${m}_${y}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Lỗi xuất Excel buổi tập PT:", error);
    res.status(500).json({ success: false, message: "Lỗi xuất file đối soát buổi tập PT" });
  }
};

// @desc    PT gửi khiếu nại đối soát buổi tập
// @route   POST /api/reports/pt-sessions/dispute
const submitPTDispute = async (req, res) => {
  try {
    const { month, year, workoutLogId, reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập lý do khiếu nại" });
    }

    const m = parseInt(month);
    const y = parseInt(year);

    let period = await CommissionPeriod.findOne({ month: m, year: y, type: "pt" });
    if (!period) {
      period = new CommissionPeriod({
        month: m,
        year: y,
        type: "pt",
        status: "disputed",
      });
    } else {
      period.status = "disputed";
    }

    period.disputes.push({
      workoutLogId: workoutLogId || null,
      ptUser: req.user?._id,
      reason: reason.trim(),
      status: "pending",
    });

    await period.save();

    res.json({
      success: true,
      message: "Đã gửi khiếu nại buổi tập thành công. Admin sẽ xem xét đối soát.",
      data: period,
    });
  } catch (error) {
    console.error("Lỗi khiếu nại đối soát PT:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi gửi khiếu nại" });
  }
};

// @desc    Admin cập nhật trạng thái kỳ đối soát hoa hồng
// @route   PUT /api/reports/commission-period/status
const updatePeriodStatus = async (req, res) => {
  try {
    const { periodId, month, year, type = "pt", status, note } = req.body;

    let period;
    if (periodId) {
      period = await CommissionPeriod.findById(periodId);
    } else if (month && year) {
      period = await CommissionPeriod.findOne({ month: parseInt(month), year: parseInt(year), type });
    }

    if (!period) {
      period = new CommissionPeriod({
        month: parseInt(month),
        year: parseInt(year),
        type,
        status: status || "draft",
      });
    }

    period.status = status;
    if (note !== undefined) period.note = note;

    if (status === "approved") {
      period.approvedBy = req.user?._id;
      period.approvedAt = new Date();
    } else if (status === "paid") {
      period.paidBy = req.user?._id;
      period.paidAt = new Date();
    }

    await period.save();

    res.json({
      success: true,
      message: `Đã cập nhật trạng thái kỳ đối soát thành ${status}`,
      data: period,
    });
  } catch (error) {
    console.error("Lỗi cập nhật trạng thái kỳ đối soát:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi cập nhật kỳ đối soát" });
  }
};

// @desc    Báo cáo tỷ lệ chuyển đổi Lead theo Sale & Nguồn
// @route   GET /api/reports/leads-conversion
const getLeadConversionReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {};

    if (startDate || endDate) {
      const createdAtCond = {};
      if (startDate) createdAtCond.$gte = new Date(startDate);
      if (endDate) createdAtCond.$lte = new Date(endDate);
      query.createdAt = createdAtCond;
    }

    const leads = await Lead.find(query).populate("assignedSale", "fullName role").lean();

    const totalLeads = leads.length;
    const statusCounts = {
      new: 0,
      contacted: 0,
      trial: 0,
      converted: 0,
      lost: 0,
    };

    const sourceCounts = {
      facebook: 0,
      hotline: 0,
      referral: 0,
      web: 0,
      other: 0,
    };

    const saleMap = {};

    leads.forEach((l) => {
      if (statusCounts[l.status] !== undefined) {
        statusCounts[l.status]++;
      }
      if (sourceCounts[l.source] !== undefined) {
        sourceCounts[l.source]++;
      }

      const saleId = l.assignedSale?._id?.toString() || "unassigned";
      const saleName = l.assignedSale?.fullName || "Chưa phân công";

      if (!saleMap[saleId]) {
        saleMap[saleId] = {
          saleName,
          total: 0,
          contacted: 0,
          trial: 0,
          converted: 0,
          lost: 0,
        };
      }

      saleMap[saleId].total++;
      if (l.status === "contacted") saleMap[saleId].contacted++;
      if (l.status === "trial") saleMap[saleId].trial++;
      if (l.status === "converted") saleMap[saleId].converted++;
      if (l.status === "lost") saleMap[saleId].lost++;
    });

    const salePerformance = Object.values(saleMap).map((item) => ({
      ...item,
      conversionRate: item.total > 0 ? Math.round((item.converted / item.total) * 100) : 0,
    }));

    const conversionRateOverall = totalLeads > 0 ? Math.round((statusCounts.converted / totalLeads) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalLeads,
        statusCounts,
        sourceCounts,
        salePerformance,
        conversionRateOverall,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy báo cáo chuyển đổi Lead:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy báo cáo Lead" });
  }
};

// @desc    Báo cáo tỷ lệ loại hợp đồng & dòng tiền hợp đồng
// @route   GET /api/reports/contract-status-breakdown
const getContractStatusBreakdown = async (req, res) => {
  try {
    const packages = await CustomerPackage.find({ isDeleted: { $ne: true } }).lean();
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const breakdown = {
      active: { count: 0, totalValue: 0 },
      frozen: { count: 0, totalValue: 0 },
      pending: { count: 0, totalValue: 0 },
      expiringSoon: { count: 0, totalValue: 0 },
      expired: { count: 0, totalValue: 0 },
    };

    let totalContracts = packages.length;
    let grandTotalValue = 0;

    packages.forEach((pkg) => {
      const price = pkg.price || 0;
      grandTotalValue += price;
      const endDate = pkg.endDate ? new Date(pkg.endDate) : null;

      if (pkg.status === "frozen") {
        breakdown.frozen.count++;
        breakdown.frozen.totalValue += price;
      } else if (pkg.status === "pending" || (pkg.startDate && new Date(pkg.startDate) > now)) {
        breakdown.pending.count++;
        breakdown.pending.totalValue += price;
      } else if (endDate && endDate < now) {
        breakdown.expired.count++;
        breakdown.expired.totalValue += price;
      } else if (endDate && endDate >= now && endDate <= sevenDaysLater) {
        breakdown.expiringSoon.count++;
        breakdown.expiringSoon.totalValue += price;
      } else {
        breakdown.active.count++;
        breakdown.active.totalValue += price;
      }
    });

    const statusChartData = [
      { name: "Đang hoạt động", key: "active", count: breakdown.active.count, value: breakdown.active.totalValue, color: "#10B981" },
      { name: "Bảo lưu (Frozen)", key: "frozen", count: breakdown.frozen.count, value: breakdown.frozen.totalValue, color: "#3B82F6" },
      { name: "Chưa kích hoạt", key: "pending", count: breakdown.pending.count, value: breakdown.pending.totalValue, color: "#F59E0B" },
      { name: "Sắp hết hạn (<7d)", key: "expiringSoon", count: breakdown.expiringSoon.count, value: breakdown.expiringSoon.totalValue, color: "#EF4444" },
      { name: "Đã hết hạn", key: "expired", count: breakdown.expired.count, value: breakdown.expired.totalValue, color: "#6B7280" },
    ].map((item) => ({
      ...item,
      percentage: totalContracts > 0 ? Math.round((item.count / totalContracts) * 100) : 0,
    }));

    res.json({
      success: true,
      data: {
        totalContracts,
        grandTotalValue,
        breakdown,
        statusChartData,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy báo cáo trạng thái hợp đồng:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy báo cáo hợp đồng" });
  }
};

module.exports = {
  getSummary,
  getRevenueChart,
  getPackageDistribution,
  getExpiringMembers,
  getRevenueDetails,
  getInventoryReport,
  getChurnPrediction,
  getRevenueAdvanced,
  getHRSummary,
  getCustomerAnalytics,
  getNotificationsSummary,
  getPTSessionsReport,
  exportPTSessionsExcel,
  submitPTDispute,
  updatePeriodStatus,
  getLeadConversionReport,
  getContractStatusBreakdown,
};
