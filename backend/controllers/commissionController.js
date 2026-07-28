const Commission = require("../models/Commission");
const CommissionPeriod = require("../models/CommissionPeriod");
const WorkoutSession = require("../models/WorkoutSession");
const CustomerPackage = require("../models/CustomerPackage");
const Setting = require("../models/Setting");
const User = require("../models/User");
const { startOfMonth, endOfMonth } = require("date-fns");

/**
 * ===================== HOA HỒNG PT =====================
 */

// @desc    Lấy hoa hồng PT theo tháng (cho 1 PT hoặc tất cả)
// @route   GET /api/v1/commissions/pt?month=&year=&staffId=
// @access  Private
const getPTCommissions = async (req, res) => {
  try {
    const { month, year, staffId } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    const query = { type: "pt", month: m, year: y, status: "active" };
    if (staffId) query.staff = staffId;

    const commissions = await Commission.find(query)
      .populate("staff", "fullName username role")
      .populate("customer", "name code phone")
      .populate("workoutSession", "date ptName note")
      .sort({ createdAt: -1 });

    // Aggregate theo từng PT
    const byStaff = {};
    commissions.forEach((c) => {
      const sid = c.staff._id.toString();
      if (!byStaff[sid]) {
        byStaff[sid] = {
          staff: c.staff,
          totalSessions: 0,
          totalAmount: 0,
          records: [],
        };
      }
      byStaff[sid].totalSessions += 1;
      byStaff[sid].totalAmount += c.amount;
      byStaff[sid].records.push(c);
    });

    const summary = Object.values(byStaff);
    const grandTotal = summary.reduce((sum, s) => sum + s.totalAmount, 0);

    res.json({
      success: true,
      data: {
        month: m,
        year: y,
        staffSummary: summary,
        grandTotal,
        totalRecords: commissions.length,
      },
      message: "Lấy hoa hồng PT thành công",
    });
  } catch (error) {
    console.error("Lỗi lấy hoa hồng PT:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

/**
 * ===================== HOA HỒNG SALE =====================
 */

// @desc    Lấy hoa hồng Sale theo tháng
// @route   GET /api/v1/commissions/sale?month=&year=&staffId=
// @access  Private
const getSaleCommissions = async (req, res) => {
  try {
    const { month, year, staffId } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    const query = { type: "sale", month: m, year: y, status: "active" };
    if (staffId) query.staff = staffId;

    const commissions = await Commission.find(query)
      .populate("staff", "fullName username role")
      .populate("customer", "name code phone")
      .populate("customerPackage", "packageName price contractType contractCode startDate endDate")
      .sort({ createdAt: -1 });

    // Aggregate theo từng Sale
    const byStaff = {};
    commissions.forEach((c) => {
      const sid = c.staff._id.toString();
      if (!byStaff[sid]) {
        byStaff[sid] = {
          staff: c.staff,
          totalContracts: 0,
          newContracts: 0,
          renewContracts: 0,
          upgradeContracts: 0,
          totalAmount: 0,
          totalBaseValue: 0,
          records: [],
        };
      }
      byStaff[sid].totalContracts += 1;
      byStaff[sid].totalAmount += c.amount;
      byStaff[sid].totalBaseValue += c.baseAmount;

      if (c.contractType === "new") byStaff[sid].newContracts += 1;
      else if (c.contractType === "renew") byStaff[sid].renewContracts += 1;
      else if (c.contractType === "upgrade") byStaff[sid].upgradeContracts += 1;

      byStaff[sid].records.push(c);
    });

    const summary = Object.values(byStaff);
    const grandTotal = summary.reduce((sum, s) => sum + s.totalAmount, 0);

    res.json({
      success: true,
      data: {
        month: m,
        year: y,
        staffSummary: summary,
        grandTotal,
        totalRecords: commissions.length,
      },
      message: "Lấy hoa hồng Sale thành công",
    });
  } catch (error) {
    console.error("Lỗi lấy hoa hồng Sale:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

/**
 * ===================== TỔNG HỢP =====================
 */

// @desc    Lấy tổng hợp hoa hồng tháng (cả PT + Sale)
// @route   GET /api/v1/commissions/summary?month=&year=
// @access  Private (Admin/Accountant/Manager)
const getCommissionSummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    const [ptAgg, saleAgg, period] = await Promise.all([
      Commission.aggregate([
        { $match: { type: "pt", month: m, year: y, status: "active" } },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
            totalRecords: { $sum: 1 },
            staffCount: { $addToSet: "$staff" },
          },
        },
      ]),
      Commission.aggregate([
        { $match: { type: "sale", month: m, year: y, status: "active" } },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
            totalRecords: { $sum: 1 },
            totalBaseValue: { $sum: "$baseAmount" },
            staffCount: { $addToSet: "$staff" },
          },
        },
      ]),
      CommissionPeriod.find({ month: m, year: y }),
    ]);

    const ptSummary = ptAgg[0] || { totalAmount: 0, totalRecords: 0, staffCount: [] };
    const saleSummary = saleAgg[0] || { totalAmount: 0, totalRecords: 0, totalBaseValue: 0, staffCount: [] };

    // Tìm trạng thái period
    const ptPeriod = period.find((p) => p.type === "pt") || null;
    const salePeriod = period.find((p) => p.type === "sale") || null;

    res.json({
      success: true,
      data: {
        month: m,
        year: y,
        pt: {
          totalAmount: ptSummary.totalAmount,
          totalSessions: ptSummary.totalRecords,
          staffCount: ptSummary.staffCount?.length || 0,
          periodStatus: ptPeriod?.status || "draft",
          periodId: ptPeriod?._id || null,
        },
        sale: {
          totalAmount: saleSummary.totalAmount,
          totalContracts: saleSummary.totalRecords,
          totalBaseValue: saleSummary.totalBaseValue || 0,
          staffCount: saleSummary.staffCount?.length || 0,
          periodStatus: salePeriod?.status || "draft",
          periodId: salePeriod?._id || null,
        },
        grandTotal: ptSummary.totalAmount + saleSummary.totalAmount,
      },
      message: "Lấy tổng hợp hoa hồng thành công",
    });
  } catch (error) {
    console.error("Lỗi lấy tổng hợp hoa hồng:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

/**
 * ===================== WORKFLOW KỲ HOA HỒNG =====================
 */

// @desc    Tạo hoặc lấy kỳ hoa hồng cho tháng/loại
// @route   POST /api/v1/commissions/period
// @access  Private (Admin/Accountant)
const createOrGetPeriod = async (req, res) => {
  try {
    const { month, year, type } = req.body;
    if (!month || !year || !type) {
      return res.status(400).json({ success: false, message: "Thiếu month, year, hoặc type" });
    }

    let period = await CommissionPeriod.findOne({ month, year, type });
    if (!period) {
      // Tính tổng hoa hồng cho kỳ
      const agg = await Commission.aggregate([
        { $match: { type, month, year: parseInt(year), status: "active" } },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
            totalRecords: { $sum: 1 },
          },
        },
      ]);

      period = await CommissionPeriod.create({
        month,
        year,
        type,
        totalAmount: agg[0]?.totalAmount || 0,
        totalRecords: agg[0]?.totalRecords || 0,
        status: "draft",
      });
    }

    res.status(201).json({
      success: true,
      data: period,
      message: "Lấy/tạo kỳ hoa hồng thành công",
    });
  } catch (error) {
    console.error("Lỗi tạo kỳ hoa hồng:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

// @desc    Duyệt kỳ hoa hồng (Admin/Accountant)
// @route   PUT /api/v1/commissions/period/:id/approve
// @access  Private (Admin/Accountant)
const approvePeriod = async (req, res) => {
  try {
    const period = await CommissionPeriod.findById(req.params.id);
    if (!period) {
      return res.status(404).json({ success: false, message: "Không tìm thấy kỳ hoa hồng" });
    }

    if (period.status === "paid") {
      return res.status(400).json({ success: false, message: "Kỳ hoa hồng đã thanh toán, không thể sửa đổi" });
    }

    // Cập nhật lại tổng trước khi duyệt
    const agg = await Commission.aggregate([
      { $match: { type: period.type, month: period.month, year: period.year, status: "active" } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalRecords: { $sum: 1 },
        },
      },
    ]);

    period.totalAmount = agg[0]?.totalAmount || 0;
    period.totalRecords = agg[0]?.totalRecords || 0;
    period.status = "approved";
    period.approvedBy = req.user._id;
    period.approvedAt = new Date();
    await period.save();

    res.json({
      success: true,
      data: period,
      message: "Duyệt kỳ hoa hồng thành công",
    });
  } catch (error) {
    console.error("Lỗi duyệt kỳ hoa hồng:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

// @desc    Đánh dấu đã thanh toán
// @route   PUT /api/v1/commissions/period/:id/pay
// @access  Private (Admin/Accountant)
const markPeriodPaid = async (req, res) => {
  try {
    const period = await CommissionPeriod.findById(req.params.id);
    if (!period) {
      return res.status(404).json({ success: false, message: "Không tìm thấy kỳ hoa hồng" });
    }

    if (period.status !== "approved") {
      return res.status(400).json({
        success: false,
        message: "Chỉ có thể thanh toán kỳ đã được duyệt",
      });
    }

    period.status = "paid";
    period.paidBy = req.user._id;
    period.paidAt = new Date();
    if (req.body.note) period.note = req.body.note;
    await period.save();

    res.json({
      success: true,
      data: period,
      message: "Đánh dấu đã thanh toán hoa hồng thành công",
    });
  } catch (error) {
    console.error("Lỗi thanh toán hoa hồng:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

// @desc    Mở lại kỳ hoa hồng (chuyển từ approved/paid về pending) khi lỡ tay chốt sớm hoặc cần điều chỉnh
// @route   PUT /api/v1/commissions/period/:id/reopen
// @access  Private (Admin/Accountant/Manager)
const reopenPeriod = async (req, res) => {
  try {
    const period = await CommissionPeriod.findById(req.params.id);
    if (!period) {
      return res.status(404).json({ success: false, message: "Không tìm thấy kỳ hoa hồng" });
    }

    period.status = "pending";
    period.approvedBy = undefined;
    period.approvedAt = undefined;
    period.paidBy = undefined;
    period.paidAt = undefined;
    if (req.body.note) period.note = `[Mở lại kỳ] ${req.body.note}`;
    await period.save();

    res.json({
      success: true,
      data: period,
      message: `Đã mở lại kỳ hoa hồng Tháng ${period.month}/${period.year} thành công. Bạn hiện có thể điều chỉnh dữ liệu.`,
    });
  } catch (error) {
    console.error("Lỗi mở lại kỳ hoa hồng:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

// @desc    Lấy danh sách kỳ hoa hồng
// @route   GET /api/v1/commissions/periods?year=
// @access  Private
const getPeriods = async (req, res) => {
  try {
    const { year } = req.query;
    const query = {};
    if (year) query.year = parseInt(year);

    const periods = await CommissionPeriod.find(query)
      .populate("approvedBy", "fullName username")
      .populate("paidBy", "fullName username")
      .sort({ year: -1, month: -1 });

    res.json({
      success: true,
      data: periods,
      message: "Lấy danh sách kỳ hoa hồng thành công",
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách kỳ:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

/**
 * ===================== THU HỒI HOA HỒNG =====================
 */

// @desc    Thu hồi hoa hồng của 1 hợp đồng (khi hủy HĐ)
// @route   PUT /api/v1/commissions/revoke/:customerPackageId
// @access  Private (Admin)
const revokeByPackage = async (req, res) => {
  try {
    const { customerPackageId } = req.params;
    const { reason } = req.body;

    const result = await Commission.updateMany(
      { customerPackage: customerPackageId, status: "active" },
      {
        status: "revoked",
        revokedReason: reason || "Hủy hợp đồng",
        revokedAt: new Date(),
        revokedBy: req.user._id,
      }
    );

    res.json({
      success: true,
      data: { revokedCount: result.modifiedCount },
      message: `Thu hồi ${result.modifiedCount} bản ghi hoa hồng thành công`,
    });
  } catch (error) {
    console.error("Lỗi thu hồi hoa hồng:", error);
    res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
};

/**
 * ===================== TẠO HOA HỒNG SALE (được gọi khi bán gói) =====================
 */

// @desc    Tạo bản ghi hoa hồng Sale cho 1 hợp đồng
//          Gọi nội bộ từ customerController khi tạo/gia hạn/nâng gói
const createSaleCommission = async ({ staffId, customerPackageId, customerId, packagePrice, contractType }) => {
  try {
    const setting = await Setting.findOne();

    let rate = 0;
    if (contractType === "new") rate = setting?.saleNewContractRate || 5;
    else if (contractType === "renew") rate = setting?.saleRenewRate || 3;
    else if (contractType === "upgrade") rate = setting?.saleUpsellRate || 4;

    const amount = packagePrice * (rate / 100);
    const now = new Date();

    const commission = await Commission.create({
      type: "sale",
      staff: staffId,
      amount,
      rate,
      baseAmount: packagePrice,
      customerPackage: customerPackageId,
      customer: customerId,
      contractType,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    });

    return commission;
  } catch (error) {
    console.error("Lỗi tạo hoa hồng Sale:", error);
    return null; // Không block flow chính
  }
};

/**
 * Xử lý hoa hồng khi Nâng cấp Hợp đồng:
 * - Cùng Sale: Recalculate 100% gói mới (Kỳ mở: thu hồi cũ & tạo mới; Kỳ đóng: giữ cũ + tạo âm điều chỉnh + tạo mới gói VIP)
 * - Khác Sale: Sale cũ giữ nguyên, Sale mới nhận hoa hồng trên phần chênh lệch (priceDiff)
 */
const handleUpgradeCommission = async ({
  oldPackage,
  newPackageId,
  newPackagePrice,
  newCustomerPackageId,
  customerId,
  upgradeSaleStaffId,
  priceDiff,
}) => {
  try {
    const setting = await Setting.findOne();
    const rate = setting?.saleUpsellRate || 4;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const oldSaleStaffId = oldPackage.assignedStaff ? oldPackage.assignedStaff.toString() : null;
    const newSaleStaffId = upgradeSaleStaffId ? upgradeSaleStaffId.toString() : null;

    // Tìm bản ghi hoa hồng của gói cũ
    const oldCommission = await Commission.findOne({
      customerPackage: oldPackage._id,
      type: "sale",
      status: "active",
    });

    const isSameSale = oldSaleStaffId && newSaleStaffId && oldSaleStaffId === newSaleStaffId;

    if (isSameSale) {
      // Kiếm tra kỳ hoa hồng của gói cũ có bị chốt/đã chi trả không
      let isPeriodClosed = false;
      if (oldCommission) {
        const period = await CommissionPeriod.findOne({
          month: oldCommission.month,
          year: oldCommission.year,
          type: "sale",
        });
        if (period && (period.status === "approved" || period.status === "paid")) {
          isPeriodClosed = true;
        }
      }

      if (!isPeriodClosed && oldCommission) {
        // KỲ CHƯA ĐÓNG: Thu hồi bản ghi cũ, tạo bản ghi mới recalculate trên 100% giá gói mới
        oldCommission.status = "revoked";
        oldCommission.revokedReason = "Nâng cấp gói (Cùng Sale recalculate)";
        oldCommission.revokedAt = now;
        await oldCommission.save();

        const amount = newPackagePrice * (rate / 100);
        return await Commission.create({
          type: "sale",
          staff: newSaleStaffId,
          amount,
          rate,
          baseAmount: newPackagePrice,
          customerPackage: newCustomerPackageId,
          customer: customerId,
          contractType: "upgrade_full_recalc",
          month: currentMonth,
          year: currentYear,
        });
      } else {
        // KỲ ĐÃ ĐÓNG (Hoặc không có oldCommission): Tạo bút toán điều chỉnh âm + tạo mới full recalc
        if (oldCommission) {
          await Commission.create({
            type: "sale",
            staff: oldSaleStaffId,
            amount: -oldCommission.amount,
            rate: oldCommission.rate,
            baseAmount: -oldCommission.baseAmount,
            customerPackage: newCustomerPackageId,
            customer: customerId,
            contractType: "upgrade_adjustment_minus",
            originalCommission: oldCommission._id,
            month: currentMonth,
            year: currentYear,
          });
        }

        const newAmount = newPackagePrice * (rate / 100);
        return await Commission.create({
          type: "sale",
          staff: newSaleStaffId,
          amount: newAmount,
          rate,
          baseAmount: newPackagePrice,
          customerPackage: newCustomerPackageId,
          customer: customerId,
          contractType: "upgrade_full_recalc",
          originalCommission: oldCommission ? oldCommission._id : undefined,
          month: currentMonth,
          year: currentYear,
        });
      }
    } else {
      // KHÁC SALE: Sale cũ giữ nguyên hoa hồng gói 4tr. Sale mới nhận hoa hồng trên phần chênh lệch priceDiff
      if (newSaleStaffId) {
        const amount = priceDiff * (rate / 100);
        return await Commission.create({
          type: "sale",
          staff: newSaleStaffId,
          amount,
          rate,
          baseAmount: priceDiff,
          customerPackage: newCustomerPackageId,
          customer: customerId,
          contractType: "upgrade_delta",
          month: currentMonth,
          year: currentYear,
        });
      }
    }
  } catch (error) {
    console.error("Lỗi xử lý hoa hồng nâng cấp:", error);
    return null;
  }
};

module.exports = {
  getPTCommissions,
  getSaleCommissions,
  getCommissionSummary,
  createOrGetPeriod,
  approvePeriod,
  markPeriodPaid,
  reopenPeriod,
  getPeriods,
  revokeByPackage,
  createSaleCommission,
  handleUpgradeCommission,
};
