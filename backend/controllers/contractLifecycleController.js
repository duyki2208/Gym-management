const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const CustomerPackage = require("../models/CustomerPackage");
const Transaction = require("../models/Transaction");
const PackageExtensionHistory = require("../models/PackageExtensionHistory");
const AuditLog = require("../models/AuditLog");
const { flattenPackage } = require("../services/customerQueryService");
const {
  ContractLifecycleError,
  freezeContract,
  unfreezeContract,
  adjustContractExpiry,
  loadContractPackageView,
  loadPackageExtensionHistory,
  recordExpiryAdjustmentAudit,
} = require("../services/contractLifecycleService");

const getContractLifecycleModels = (req) => ({
  ...(req.models || {}),
  connection: req.models?.connection || mongoose.connection,
  Customer: req.models?.Customer || Customer,
  CustomerPackage: req.models?.CustomerPackage || CustomerPackage,
  Transaction: req.models?.Transaction || Transaction,
  PackageExtensionHistory:
    req.models?.PackageExtensionHistory || PackageExtensionHistory,
  AuditLog: req.models?.AuditLog || AuditLog,
});

const sendLifecycleError = (res, error, fallbackMessage) =>
  res.status(error instanceof ContractLifecycleError ? error.statusCode : 500).json({
    success: false,
    code: error.code,
    message: error.message || fallbackMessage,
  });

const freeze = async (req, res) => {
  try {
    const models = getContractLifecycleModels(req);
    const { customerPackage, actualFreezeFee } = await freezeContract({
      models,
      packageId: req.params.id,
      data: req.body,
      actorId: req.user?._id,
    });
    const populatedPackage = await loadContractPackageView({
      CustomerPackage: models.CustomerPackage,
      packageId: customerPackage._id,
    });
    return res.status(200).json({
      success: true,
      message: actualFreezeFee > 0
        ? `Tạm dừng gói tập thành công (Đã thu phí bảo lưu ${actualFreezeFee.toLocaleString("vi-VN")} VNĐ).`
        : "Tạm dừng gói tập thành công (Miễn phí bảo lưu lý do y tế/thương tích).",
      data: flattenPackage(populatedPackage),
    });
  } catch (error) {
    console.error("Lỗi đóng băng gói tập:", error);
    return sendLifecycleError(res, error, "Lỗi đóng băng gói tập");
  }
};

const unfreeze = async (req, res) => {
  try {
    const models = getContractLifecycleModels(req);
    const { customerPackage } = await unfreezeContract({
      models,
      packageId: req.params.id,
      actualUnfreezeDate: req.body.actualUnfreezeDate,
    });
    const populatedPackage = await loadContractPackageView({
      CustomerPackage: models.CustomerPackage,
      packageId: customerPackage._id,
    });
    return res.status(200).json({
      success: true,
      message: "Kích hoạt lại gói tập thành công. Hạn gói tập đã được điều chỉnh theo thời gian bảo lưu thực tế.",
      data: flattenPackage(populatedPackage),
    });
  } catch (error) {
    console.error("Lỗi kích hoạt lại gói tập:", error);
    return sendLifecycleError(res, error, "Lỗi kích hoạt lại gói tập");
  }
};

const adjustExpiry = async (req, res) => {
  try {
    const models = getContractLifecycleModels(req);
    const result = await adjustContractExpiry({
      models,
      packageId: req.params.id,
      newEndDate: req.body.newEndDate,
      reason: req.body.reason,
      actorId: req.user?._id,
    });
    const direction = result.history.daysDifference >= 0 ? "+" : "";
    if (!result.isReplay) {
      const audit = await recordExpiryAdjustmentAudit({
        AuditLog: models.AuditLog,
        pkg: result.pkg,
        history: result.history,
        actorId: req.user?._id,
        reason: req.body.reason,
        ipAddress: req.ip,
      });
      if (!audit.recorded) {
        console.warn("Lỗi ghi AuditLog điều chỉnh hạn gói:", audit.error?.message);
      }
    }
    return res.status(200).json({
      success: true,
      data: { package: result.pkg, history: result.history },
      message: result.isReplay
        ? `Yêu cầu đã được xử lý trước đó (${direction}${result.history.daysDifference} ngày)`
        : `Đã điều chỉnh ngày hết hạn thành công (${direction}${result.history.daysDifference} ngày)`,
    });
  } catch (error) {
    console.error("Lỗi adjustPackageExpiry:", error);
    return sendLifecycleError(res, error, "Lỗi máy chủ khi điều chỉnh hạn gói tập");
  }
};

const getExtensionHistory = async (req, res) => {
  try {
    const models = getContractLifecycleModels(req);
    const history = await loadPackageExtensionHistory({
      PackageExtensionHistory: models.PackageExtensionHistory,
      packageId: req.params.id,
    });
    return res.status(200).json({
      success: true,
      data: history,
      message: "Lấy lịch sử điều chỉnh hạn thành công",
    });
  } catch (error) {
    console.error("Lỗi getPackageExtensionHistory:", error);
    return sendLifecycleError(res, error, "Lỗi máy chủ khi lấy lịch sử điều chỉnh hạn");
  }
};

module.exports = {
  freeze,
  unfreeze,
  adjustExpiry,
  getExtensionHistory,
  getContractLifecycleModels,
};
