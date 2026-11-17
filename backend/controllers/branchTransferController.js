const { getBranchModels, getCentralModels } = require("../db/branchConnectionManager");
const { transferBranch } = require("../services/branchTransferService");
const { invalidateEmbeddingCache } = require("./checkInController");
const logger = require("../utils/logger");

const transferCustomerBranch = async (req, res) => {
  try {
    const data = await transferBranch({ sourceModels: req.models,
      centralModels: req.centralModels || await getCentralModels(), getTargetModels: getBranchModels,
      sourceBranchCode: req.branchCode, data: req.body, actorId: req.user?._id,
      requestKey: req.headers?.["idempotency-key"] });
    invalidateEmbeddingCache(data.sourceBranchCode);
    invalidateEmbeddingCache(data.targetBranchCode);
    return res.status(200).json({ success: true, message: data.idempotent
      ? "Giao dịch chuyển cơ sở đã hoàn tất trước đó" : "Chuyển cơ sở thành công", data });
  } catch (error) {
    logger.error("branch_transfer_failed", { requestId: req.id, errorName: error.name, errorCode: error.code });
    return res.status(error.statusCode || 500).json({ success: false, code: error.code,
      message: error.statusCode ? error.message : "Không thể hoàn tất chuyển cơ sở. Vui lòng gửi lại cùng mã thao tác." });
  }
};

// Historical pending transfers are exposed for reconciliation, never auto-replayed.
const getPendingTransfers = async (req, res) => {
  try {
    const pendingPackages = await req.models.CustomerPackage.find({ transferStatus: "transfer_pending" })
      .populate("customer", "name phone code").sort({ updatedAt: -1 });
    return res.json({ success: true, count: pendingPackages.length, data: pendingPackages });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Không thể tải danh sách chuyển cơ sở đang chờ đối soát" });
  }
};

module.exports = { transferCustomerBranch, getPendingTransfers };
