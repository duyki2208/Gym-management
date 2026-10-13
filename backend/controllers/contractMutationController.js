const {
  ContractMutationError,
  upgradeContract,
  transferContract,
} = require("../services/contractMutationService");
const { getCustomerDomainModels } = require("../utils/customerDomainModels");

const sendMutationError = (res, error) =>
  res.status(error instanceof ContractMutationError ? error.statusCode : 500).json({
    success: false,
    code: error.code,
    message: error.message,
  });

const upgrade = async (req, res) => {
  try {
    const result = await upgradeContract({
      models: getCustomerDomainModels(req),
      packageId: req.params.id,
      data: req.body,
      actorId: req.user?._id,
    });
    return res.status(200).json({
      success: true,
      message: result.isReplay
        ? "Yêu cầu nâng cấp đã được xử lý trước đó."
        : `Nâng cấp hợp đồng lên gói [${result.targetPackageName}] thành công! Thu thêm ${result.priceDiff.toLocaleString("vi-VN")} VNĐ.`,
      data: result.newCustomerPackage,
      replayed: result.isReplay,
    });
  } catch (error) {
    console.error("Lỗi nâng cấp hợp đồng:", error);
    return sendMutationError(res, error);
  }
};

const transfer = async (req, res) => {
  try {
    const result = await transferContract({
      models: getCustomerDomainModels(req),
      packageId: req.params.id,
      data: req.body,
      actorId: req.user?._id,
      audit: {
        username: req.user?.fullName || req.user?.username,
        method: req.method,
        path: req.originalUrl || req.path,
      },
    });
    return res.status(200).json({
      success: true,
      message: result.isReplay
        ? "Yêu cầu chuyển nhượng đã được xử lý trước đó."
        : `Chuyển nhượng hợp đồng [${result.originalPkg.contractCode}] sang hội viên [${result.targetCustomer.name}] thành công! Phí dịch vụ: ${result.transferFee.toLocaleString("vi-VN")} VNĐ.`,
      data: {
        contract: result.newCustomerPackage,
        oldContract: result.originalPkg,
        transferRecord: result.transferRecord,
      },
      replayed: result.isReplay,
    });
  } catch (error) {
    console.error("Lỗi chuyển nhượng hợp đồng:", error);
    return sendMutationError(res, error);
  }
};

module.exports = { upgrade, transfer };
