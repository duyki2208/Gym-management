const Commission = require("../models/Commission");
const CommissionPeriod = require("../models/CommissionPeriod");
const { PERMISSIONS, userHasPermission } = require("../middleware/permissions");
const {
  CommissionQueryError,
  resolveVisibleCommissionTypes,
  listCommissions,
  getCommissionSummary: loadCommissionSummary,
  listCommissionPeriods,
} = require("../services/commissionQueryService");
const {
  CommissionPeriodError,
  createOrGetCommissionPeriod,
  approveCommissionPeriod,
  payCommissionPeriod,
  reopenCommissionPeriod,
  revokePackageCommissions,
} = require("../services/commissionPeriodService");
const {
  createSaleCommission,
  handleUpgradeCommission,
} = require("../services/commissionMutationService");

const getCommissionModels = (req) => ({
  Commission: req.models?.Commission || Commission,
  CommissionPeriod: req.models?.CommissionPeriod || CommissionPeriod,
});

const sendCommissionError = (res, error) => {
  const isKnown = error instanceof CommissionQueryError || error instanceof CommissionPeriodError;
  return res.status(isKnown ? error.statusCode : 500).json({
    success: false,
    code: error.code,
    message: isKnown ? error.message : "Lỗi máy chủ",
  });
};

const loadReadScope = async (req) => ({
  actorId: req.user?._id,
  canReadAll: await userHasPermission(req, PERMISSIONS.COMMISSION_READ_ALL),
});

const getCommissions = (type, successMessage) => async (req, res) => {
  try {
    const models = getCommissionModels(req);
    const scope = await loadReadScope(req);
    const data = await listCommissions({
      Commission: models.Commission,
      type,
      filters: req.query,
      ...scope,
    });
    return res.json({ success: true, data, message: successMessage });
  } catch (error) {
    console.error(`Lỗi lấy hoa hồng ${type}:`, error);
    return sendCommissionError(res, error);
  }
};

const getPTCommissions = getCommissions("pt", "Lấy hoa hồng PT thành công");
const getSaleCommissions = getCommissions("sale", "Lấy hoa hồng Sale thành công");

const getCommissionSummary = async (req, res) => {
  try {
    const models = getCommissionModels(req);
    const data = await loadCommissionSummary({ ...models, filters: req.query });
    return res.json({
      success: true,
      data,
      message: "Lấy tổng hợp hoa hồng thành công",
    });
  } catch (error) {
    console.error("Lỗi lấy tổng hợp hoa hồng:", error);
    return sendCommissionError(res, error);
  }
};

const getPeriods = async (req, res) => {
  try {
    const models = getCommissionModels(req);
    const canReadAll = await userHasPermission(req, PERMISSIONS.COMMISSION_READ_ALL);
    const visibleTypes = resolveVisibleCommissionTypes({
      role: req.user?.role,
      canReadAll,
    });
    const data = await listCommissionPeriods({
      CommissionPeriod: models.CommissionPeriod,
      filters: req.query,
      visibleTypes,
    });
    return res.json({
      success: true,
      data,
      message: "Lấy danh sách kỳ hoa hồng thành công",
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách kỳ:", error);
    return sendCommissionError(res, error);
  }
};

const createOrGetPeriod = async (req, res) => {
  try {
    const models = getCommissionModels(req);
    const result = await createOrGetCommissionPeriod({ ...models, data: req.body });
    return res.status(result.created ? 201 : 200).json({
      success: true,
      data: result.period,
      created: result.created,
      message: "Lấy/tạo kỳ hoa hồng thành công",
    });
  } catch (error) {
    console.error("Lỗi tạo kỳ hoa hồng:", error);
    return sendCommissionError(res, error);
  }
};

const approvePeriod = async (req, res) => {
  try {
    const models = getCommissionModels(req);
    const period = await approveCommissionPeriod({
      ...models,
      periodId: req.params.id,
      actorId: req.user?._id,
    });
    return res.json({ success: true, data: period, message: "Duyệt kỳ hoa hồng thành công" });
  } catch (error) {
    console.error("Lỗi duyệt kỳ hoa hồng:", error);
    return sendCommissionError(res, error);
  }
};

const markPeriodPaid = async (req, res) => {
  try {
    const models = getCommissionModels(req);
    const period = await payCommissionPeriod({
      CommissionPeriod: models.CommissionPeriod,
      periodId: req.params.id,
      actorId: req.user?._id,
      note: req.body.note,
    });
    return res.json({
      success: true,
      data: period,
      message: "Đánh dấu đã thanh toán hoa hồng thành công",
    });
  } catch (error) {
    console.error("Lỗi thanh toán hoa hồng:", error);
    return sendCommissionError(res, error);
  }
};

const reopenPeriod = async (req, res) => {
  try {
    const models = getCommissionModels(req);
    const period = await reopenCommissionPeriod({
      CommissionPeriod: models.CommissionPeriod,
      periodId: req.params.id,
      note: req.body.note,
    });
    return res.json({
      success: true,
      data: period,
      message: `Đã mở lại kỳ hoa hồng Tháng ${period.month}/${period.year} thành công. Bạn hiện có thể điều chỉnh dữ liệu.`,
    });
  } catch (error) {
    console.error("Lỗi mở lại kỳ hoa hồng:", error);
    return sendCommissionError(res, error);
  }
};

const revokeByPackage = async (req, res) => {
  try {
    const models = getCommissionModels(req);
    const data = await revokePackageCommissions({
      ...models,
      customerPackageId: req.params.customerPackageId,
      reason: req.body.reason,
      actorId: req.user?._id,
    });
    return res.json({
      success: true,
      data,
      message: `Thu hồi ${data.revokedCount} bản ghi hoa hồng thành công`,
    });
  } catch (error) {
    console.error("Lỗi thu hồi hoa hồng:", error);
    return sendCommissionError(res, error);
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
