const User = require("../models/User");
const KPITarget = require("../models/KPITarget");
const Setting = require("../models/Setting");
const WorkoutSession = require("../models/WorkoutSession");
const Transaction = require("../models/Transaction");
const Customer = require("../models/Customer");
const CustomerPackage = require("../models/CustomerPackage");
const { startOfMonth, endOfMonth, differenceInDays } = require("date-fns");

// @desc    Lấy KPI cá nhân theo tháng
// @route   GET /api/v1/kpi/:userId?month=&year=
// @access  Private
const getKPIProgress = async (req, res) => {
  try {
    const { userId } = req.params;
    const { month, year } = req.query;

    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    const staff = await User.findById(userId).select("fullName username role");
    if (!staff) {
      return res.status(404).json({ success: false, message: "Không tìm thấy nhân viên" });
    }

    // Lấy cấu hình mặc định & Target cấu hình riêng
    const [setting, customTarget] = await Promise.all([
      Setting.findOne(),
      KPITarget.findOne({ staff: userId, month: m, year: y }),
    ]);

    const defaultSetting = setting || {};
    const hasCustom = !!customTarget;

    const today = new Date();
    const start = startOfMonth(new Date(y, m - 1, 1));
    const end = endOfMonth(new Date(y, m - 1, 1));

    // Tính số ngày còn lại trong tháng
    let daysLeft = 0;
    if (today.getMonth() + 1 === m && today.getFullYear() === y) {
      daysLeft = differenceInDays(end, today) + 1;
    }

    let responseData = {
      staff,
      month: m,
      year: y,
      role: staff.role,
      daysLeft,
    };

    if (staff.role === "pt") {
      // KPI của PT: Target buổi dạy
      const sessionTarget = hasCustom && customTarget.ptSessionTarget !== undefined
        ? customTarget.ptSessionTarget
        : defaultSetting.ptMonthlySessionTarget || 80;

      // Thực tế buổi dạy đã thực hiện (WorkoutSession status = completed)
      const actualSessions = await WorkoutSession.countDocuments({
        pt: userId,
        status: "completed",
        date: { $gte: start, $lte: end },
      });

      // Số khách hàng đang phụ trách:
      // 1. Khách hàng có active package được bán bởi PT này
      // 2. Khách hàng có workout session được dạy bởi PT này
      const [assignedCustomers, sessionCustomers] = await Promise.all([
        Customer.find({ assignedStaff: userId, endDate: { $gte: today } }).select("_id"),
        WorkoutSession.distinct("customer", {
          pt: userId,
          date: { $gte: start, $lte: end },
        }),
      ]);

      const activeClientIds = new Set();
      assignedCustomers.forEach((c) => activeClientIds.add(c._id.toString()));
      sessionCustomers.forEach((id) => activeClientIds.add(id.toString()));
      const activeClientsCount = activeClientIds.size;

      // Khách hàng mới nhận trong tháng (tạo mới trong tháng & có assignedStaff = PT)
      const newClientsCount = await Customer.countDocuments({
        assignedStaff: userId,
        createdAt: { $gte: start, $lte: end },
      });

      // Tỷ lệ giữ chân khách (retention rate):
      // Số khách vẫn đang hoạt động (endDate >= today) / Tổng số khách từng tập với PT này
      const totalClientsEver = await WorkoutSession.distinct("customer", { pt: userId });
      const activeClientsEver = await Customer.countDocuments({
        _id: { $in: totalClientsEver },
        endDate: { $gte: today },
      });

      const retentionRate = totalClientsEver.length > 0
        ? Math.round((activeClientsEver / totalClientsEver.length) * 100)
        : 100; // Mặc định 100% nếu chưa có khách nào

      responseData.kpi = {
        target: sessionTarget,
        achieved: actualSessions,
        percentage: sessionTarget > 0 ? Math.round((actualSessions / sessionTarget) * 100) : 0,
        activeClients: activeClientsCount,
        newClients: newClientsCount,
        retentionRate,
      };
    } else if (staff.role === "sale" || staff.role === "sm") {
      // KPI của Sale: Target doanh thu, hợp đồng mới, gia hạn
      const revenueTarget = hasCustom && customTarget.saleRevenueTarget !== undefined
        ? customTarget.saleRevenueTarget
        : defaultSetting.saleMonthlyRevenueTarget || 100000000;

      const newContractTarget = hasCustom && customTarget.saleNewContractTarget !== undefined
        ? customTarget.saleNewContractTarget
        : defaultSetting.saleMonthlyContractTarget || 20;

      const renewTarget = hasCustom && customTarget.saleRenewTarget !== undefined
        ? customTarget.saleRenewTarget
        : defaultSetting.saleMonthlyRenewTarget || 15;

      // Doanh thu thực tế (Từ Transaction thành công của các gói tập do Sale này phụ trách bán)
      // Tìm các customer packages mà Sale này được phân công bán
      const packagesSoldBySale = await CustomerPackage.find({
        assignedStaff: userId,
        createdAt: { $gte: start, $lte: end },
      }).select("_id");

      const packageIds = packagesSoldBySale.map((p) => p._id);

      // Aggregate doanh thu thực tế từ Transactions
      const revenueAgg = await Transaction.aggregate([
        {
          $match: {
            status: "success",
            $or: [
              { staff: userId }, // Giao dịch thực hiện bởi Sale này
              { customerPackage: { $in: packageIds } }, // Hoặc giao dịch mua gói do Sale phụ trách
            ],
            createdAt: { $gte: start, $lte: end },
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

      // Đếm số lượng hợp đồng mới và gia hạn thực tế
      const [actualNewContracts, actualRenewContracts] = await Promise.all([
        CustomerPackage.countDocuments({
          assignedStaff: userId,
          contractType: "new",
          createdAt: { $gte: start, $lte: end },
        }),
        CustomerPackage.countDocuments({
          assignedStaff: userId,
          contractType: "renew",
          createdAt: { $gte: start, $lte: end },
        }),
      ]);

      // So sánh với cùng kỳ tháng trước (m - 1)
      let prevM = m - 1;
      let prevY = y;
      if (prevM === 0) {
        prevM = 12;
        prevY = y - 1;
      }
      const prevStart = startOfMonth(new Date(prevY, prevM - 1, 1));
      const prevEnd = endOfMonth(new Date(prevY, prevM - 1, 1));

      // Lấy danh sách gói tháng trước của Sale
      const prevPackagesSold = await CustomerPackage.find({
        assignedStaff: userId,
        createdAt: { $gte: prevStart, $lte: prevEnd },
      }).select("_id");

      const prevPackageIds = prevPackagesSold.map((p) => p._id);

      const prevRevenueAgg = await Transaction.aggregate([
        {
          $match: {
            status: "success",
            $or: [
              { staff: userId },
              { customerPackage: { $in: prevPackageIds } },
            ],
            createdAt: { $gte: prevStart, $lte: prevEnd },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$amount" },
          },
        },
      ]);

      const prevRevenue = prevRevenueAgg[0]?.totalRevenue || 0;

      responseData.kpi = {
        revenue: {
          target: revenueTarget,
          achieved: actualRevenue,
          percentage: revenueTarget > 0 ? Math.round((actualRevenue / revenueTarget) * 100) : 0,
          compareLastMonth: prevRevenue > 0 ? Math.round(((actualRevenue - prevRevenue) / prevRevenue) * 100) : 0,
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
      };
    } else {
      // Các role khác không tính KPI đặc thù PT/Sale
      responseData.message = "Không hỗ trợ tính toán KPI đặc thù cho chức vụ này";
    }

    res.json({
      success: true,
      data: responseData,
      message: "Lấy dữ liệu KPI thành công",
    });
  } catch (error) {
    console.error("Lỗi lấy KPI:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy KPI" });
  }
};

// @desc    Cập nhật hoặc tạo KPI Target tùy chỉnh cho 1 nhân viên
// @route   POST /api/v1/kpi/target
// @access  Private (Admin/Manager)
const updateKPITarget = async (req, res) => {
  try {
    const { staffId, month, year, ptSessionTarget, saleRevenueTarget, saleNewContractTarget, saleRenewTarget, note } = req.body;

    if (!staffId || !month || !year) {
      return res.status(400).json({ success: false, message: "Thiếu staffId, month hoặc year" });
    }

    const staff = await User.findById(staffId);
    if (!staff) {
      return res.status(404).json({ success: false, message: "Không tìm thấy nhân viên" });
    }

    let target = await KPITarget.findOne({ staff: staffId, month, year });
    if (!target) {
      target = new KPITarget({
        staff: staffId,
        month,
        year,
        setBy: req.user._id,
      });
    }

    if (ptSessionTarget !== undefined) target.ptSessionTarget = Number(ptSessionTarget);
    if (saleRevenueTarget !== undefined) target.saleRevenueTarget = Number(saleRevenueTarget);
    if (saleNewContractTarget !== undefined) target.saleNewContractTarget = Number(saleNewContractTarget);
    if (saleRenewTarget !== undefined) target.saleRenewTarget = Number(saleRenewTarget);
    if (note !== undefined) target.note = note;

    target.setBy = req.user._id;
    await target.save();

    res.json({
      success: true,
      data: target,
      message: "Cập nhật chỉ tiêu KPI thành công",
    });
  } catch (error) {
    console.error("Lỗi cập nhật KPI Target:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

// @desc    Lấy bảng xếp hạng KPI doanh số của Sale trong tháng
// @route   GET /api/v1/kpi/leaderboard?month=&year=
// @access  Private
const getKPILeaderboard = async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    const start = startOfMonth(new Date(y, m - 1, 1));
    const end = endOfMonth(new Date(y, m - 1, 1));

    // Lấy tất cả nhân viên có vai trò Sale/SM/Manager
    const salesStaff = await User.find({
      role: { $in: ["sale", "sm", "manager"] },
    }).select("fullName username role");

    const leaderboard = await Promise.all(
      salesStaff.map(async (staff) => {
        // Tìm các customer packages mà Sale này được phân công bán
        const packagesSold = await CustomerPackage.find({
          assignedStaff: staff._id,
          createdAt: { $gte: start, $lte: end },
        }).select("_id");

        const packageIds = packagesSold.map((p) => p._id);

        // Tổng doanh số của Sale
        const revenueAgg = await Transaction.aggregate([
          {
            $match: {
              status: "success",
              $or: [
                { staff: staff._id },
                { customerPackage: { $in: packageIds } },
              ],
              createdAt: { $gte: start, $lte: end },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$amount" },
            },
          },
        ]);

        const totalRevenue = revenueAgg[0]?.total || 0;

        // KPI Target của Sale
        const target = await KPITarget.findOne({ staff: staff._id, month: m, year: y });
        const setting = await Setting.findOne();
        const targetRevenue = target?.saleRevenueTarget !== undefined
          ? target.saleRevenueTarget
          : setting?.saleMonthlyRevenueTarget || 100000000;

        return {
          staff,
          totalRevenue,
          targetRevenue,
          percentage: targetRevenue > 0 ? Math.round((totalRevenue / targetRevenue) * 100) : 0,
        };
      })
    );

    // Sắp xếp giảm dần theo doanh số thực tế
    leaderboard.sort((a, b) => b.totalRevenue - a.totalRevenue);

    res.json({
      success: true,
      data: leaderboard,
      message: "Lấy bảng xếp hạng doanh số thành công",
    });
  } catch (error) {
    console.error("Lỗi lấy bảng xếp hạng KPI:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

module.exports = {
  getKPIProgress,
  updateKPITarget,
  getKPILeaderboard,
};
