const DefaultSetting = require("../models/Setting");
const DefaultCommission = require("../models/Commission");
const DefaultCommissionPeriod = require("../models/CommissionPeriod");
const DefaultCustomerPackage = require("../models/CustomerPackage");
const DefaultAuditLog = require("../models/AuditLog");

const resolveModels = (models = {}) => ({
  Setting: models.Setting || DefaultSetting,
  Commission: models.Commission || DefaultCommission,
  CommissionPeriod: models.CommissionPeriod || DefaultCommissionPeriod,
  CustomerPackage: models.CustomerPackage || DefaultCustomerPackage,
  AuditLog: models.AuditLog || DefaultAuditLog,
});

const recordFailure = async ({ AuditLog, action, path, details }) => {
  try {
    await AuditLog.create({
      action,
      method: "SYSTEM",
      path,
      severity: "critical",
      details,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Lỗi ghi AuditLog hoa hồng:", error.message);
  }
};

const createSaleCommission = async ({
  models,
  staffId,
  customerPackageId,
  customerId,
  packagePrice,
  contractType,
}) => {
  const resolved = resolveModels(models);
  try {
    const setting = await resolved.Setting.findOne();
    let rate = 0;
    if (contractType === "new") rate = setting?.saleNewContractRate || 5;
    else if (contractType === "renew") rate = setting?.saleRenewRate || 3;
    else if (contractType === "upgrade") rate = setting?.saleUpsellRate || 4;

    const now = new Date();
    const commission = await resolved.Commission.create({
      type: "sale",
      staff: staffId,
      amount: Number(packagePrice || 0) * (rate / 100),
      rate,
      baseAmount: Number(packagePrice || 0),
      customerPackage: customerPackageId,
      customer: customerId,
      contractType,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    });
    if (customerPackageId) {
      await resolved.CustomerPackage.findByIdAndUpdate(customerPackageId, {
        appliedCommissionRate: rate,
      }).catch(() => {});
    }
    return commission;
  } catch (error) {
    const details = {
      staffId,
      customerPackageId,
      customerId,
      packagePrice,
      contractType,
      error: error.message,
      timestamp: new Date(),
    };
    console.error("[CRITICAL_COMMISSION_FAILED]", JSON.stringify(details));
    await recordFailure({
      AuditLog: resolved.AuditLog,
      action: "COMMISSION_FAILED",
      path: "/commissions/createSaleCommission",
      details,
    });
    return null;
  }
};

const handleUpgradeCommission = async ({
  models,
  oldPackage,
  newPackageId,
  newPackagePrice,
  newCustomerPackageId,
  customerId,
  upgradeSaleStaffId,
  priceDiff,
}) => {
  const resolved = resolveModels(models);
  try {
    const setting = await resolved.Setting.findOne();
    const rate = setting?.saleUpsellRate || 4;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const oldSaleStaffId = oldPackage.assignedStaff
      ? oldPackage.assignedStaff.toString()
      : null;
    const newSaleStaffId = upgradeSaleStaffId
      ? upgradeSaleStaffId.toString()
      : null;
    const oldCommission = await resolved.Commission.findOne({
      customerPackage: oldPackage._id,
      type: "sale",
      status: "active",
    });
    const isSameSale = oldSaleStaffId && newSaleStaffId && oldSaleStaffId === newSaleStaffId;

    if (isSameSale) {
      let isPeriodClosed = false;
      if (oldCommission) {
        const period = await resolved.CommissionPeriod.findOne({
          month: oldCommission.month,
          year: oldCommission.year,
          type: "sale",
        });
        isPeriodClosed = Boolean(period && ["approved", "paid"].includes(period.status));
      }
      if (!isPeriodClosed && oldCommission) {
        oldCommission.status = "revoked";
        oldCommission.revokedReason = "Nâng cấp gói (Cùng Sale recalculate)";
        oldCommission.revokedAt = now;
        await oldCommission.save();
        return resolved.Commission.create({
          type: "sale",
          staff: newSaleStaffId,
          amount: Number(newPackagePrice || 0) * (rate / 100),
          rate,
          baseAmount: Number(newPackagePrice || 0),
          customerPackage: newCustomerPackageId,
          customer: customerId,
          contractType: "upgrade_full_recalc",
          month: currentMonth,
          year: currentYear,
        });
      }
      if (oldCommission) {
        await resolved.Commission.create({
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
      return resolved.Commission.create({
        type: "sale",
        staff: newSaleStaffId,
        amount: Number(newPackagePrice || 0) * (rate / 100),
        rate,
        baseAmount: Number(newPackagePrice || 0),
        customerPackage: newCustomerPackageId,
        customer: customerId,
        contractType: "upgrade_full_recalc",
        originalCommission: oldCommission?._id,
        month: currentMonth,
        year: currentYear,
      });
    }

    if (newSaleStaffId) {
      return resolved.Commission.create({
        type: "sale",
        staff: newSaleStaffId,
        amount: Number(priceDiff || 0) * (rate / 100),
        rate,
        baseAmount: Number(priceDiff || 0),
        customerPackage: newCustomerPackageId,
        customer: customerId,
        contractType: "upgrade_delta",
        month: currentMonth,
        year: currentYear,
      });
    }
    return null;
  } catch (error) {
    const details = {
      oldPackageId: oldPackage?._id,
      newPackageId,
      newCustomerPackageId,
      customerId,
      upgradeSaleStaffId,
      priceDiff,
      error: error.message,
      timestamp: new Date(),
    };
    console.error("[CRITICAL_COMMISSION_FAILED] [UPGRADE]", JSON.stringify(details));
    await recordFailure({
      AuditLog: resolved.AuditLog,
      action: "COMMISSION_UPGRADE_FAILED",
      path: "/commissions/handleUpgradeCommission",
      details,
    });
    return null;
  }
};

module.exports = {
  createSaleCommission,
  handleUpgradeCommission,
};
