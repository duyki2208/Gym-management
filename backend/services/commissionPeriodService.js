class CommissionPeriodError extends Error {
  constructor(message, statusCode = 400, code = "COMMISSION_PERIOD_OPERATION_FAILED") {
    super(message);
    this.name = "CommissionPeriodError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const validatePeriodInput = ({ month, year, type }) => {
  const parsedMonth = Number(month);
  const parsedYear = Number(year);
  if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
    throw new CommissionPeriodError("Tháng không hợp lệ.", 400, "INVALID_COMMISSION_MONTH");
  }
  if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2200) {
    throw new CommissionPeriodError("Năm không hợp lệ.", 400, "INVALID_COMMISSION_YEAR");
  }
  if (!["pt", "sale"].includes(type)) {
    throw new CommissionPeriodError("Loại hoa hồng không hợp lệ.", 400, "INVALID_COMMISSION_TYPE");
  }
  return { month: parsedMonth, year: parsedYear, type };
};

const aggregatePeriod = async (Commission, period) => {
  const aggregation = await Commission.aggregate([
    { $match: { ...period, status: "active" } },
    { $group: {
      _id: null,
      totalAmount: { $sum: "$amount" },
      totalRecords: { $sum: 1 },
    } },
  ]);
  return {
    totalAmount: aggregation[0]?.totalAmount || 0,
    totalRecords: aggregation[0]?.totalRecords || 0,
  };
};

const createOrGetCommissionPeriod = async ({ Commission, CommissionPeriod, data }) => {
  const periodKey = validatePeriodInput(data);
  let period = await CommissionPeriod.findOne(periodKey);
  if (period) return { period, created: false };
  const totals = await aggregatePeriod(Commission, periodKey);
  try {
    period = await CommissionPeriod.create({
      ...periodKey,
      ...totals,
      status: "draft",
    });
    return { period, created: true };
  } catch (error) {
    if (error?.code !== 11000) throw error;
    period = await CommissionPeriod.findOne(periodKey);
    if (!period) throw error;
    return { period, created: false };
  }
};

const requirePeriod = async (CommissionPeriod, periodId) => {
  const period = await CommissionPeriod.findById(periodId);
  if (!period) {
    throw new CommissionPeriodError(
      "Không tìm thấy kỳ hoa hồng",
      404,
      "COMMISSION_PERIOD_NOT_FOUND"
    );
  }
  return period;
};

const approveCommissionPeriod = async ({ Commission, CommissionPeriod, periodId, actorId }) => {
  const period = await requirePeriod(CommissionPeriod, periodId);
  if (period.status === "paid") {
    throw new CommissionPeriodError(
      "Kỳ hoa hồng đã thanh toán, không thể sửa đổi",
      400,
      "COMMISSION_PERIOD_ALREADY_PAID"
    );
  }
  const totals = await aggregatePeriod(Commission, {
    type: period.type,
    month: period.month,
    year: period.year,
  });
  Object.assign(period, totals, {
    status: "approved",
    approvedBy: actorId,
    approvedAt: new Date(),
  });
  await period.save();
  return period;
};

const payCommissionPeriod = async ({ CommissionPeriod, periodId, actorId, note }) => {
  const period = await requirePeriod(CommissionPeriod, periodId);
  if (period.status !== "approved") {
    throw new CommissionPeriodError(
      "Chỉ có thể thanh toán kỳ đã được duyệt",
      400,
      "COMMISSION_PERIOD_NOT_APPROVED"
    );
  }
  period.status = "paid";
  period.paidBy = actorId;
  period.paidAt = new Date();
  if (note) period.note = note;
  await period.save();
  return period;
};

const reopenCommissionPeriod = async ({ CommissionPeriod, periodId, note }) => {
  const period = await requirePeriod(CommissionPeriod, periodId);
  period.status = "pending";
  period.approvedBy = undefined;
  period.approvedAt = undefined;
  period.paidBy = undefined;
  period.paidAt = undefined;
  if (note) period.note = `[Mở lại kỳ] ${note}`;
  await period.save();
  return period;
};

const revokePackageCommissions = async ({
  Commission,
  CommissionPeriod,
  customerPackageId,
  reason,
  actorId,
}) => {
  const commissions = await Commission.find({
    customerPackage: customerPackageId,
    status: "active",
  }).select("type month year").lean();
  if (commissions.length === 0) return { revokedCount: 0 };
  const periodKeys = commissions.map(({ type, month, year }) => ({ type, month, year }));
  const lockedPeriod = await CommissionPeriod.findOne({
    status: { $in: ["approved", "paid"] },
    $or: periodKeys,
  }).lean();
  if (lockedPeriod) {
    throw new CommissionPeriodError(
      "Kỳ hoa hồng liên quan đã được duyệt hoặc chi trả, không thể thu hồi.",
      409,
      "COMMISSION_PERIOD_LOCKED"
    );
  }
  const result = await Commission.updateMany(
    { customerPackage: customerPackageId, status: "active" },
    {
      status: "revoked",
      revokedReason: reason || "Hủy hợp đồng",
      revokedAt: new Date(),
      revokedBy: actorId,
    }
  );
  return { revokedCount: result.modifiedCount };
};

module.exports = {
  CommissionPeriodError,
  validatePeriodInput,
  createOrGetCommissionPeriod,
  approveCommissionPeriod,
  payCommissionPeriod,
  reopenCommissionPeriod,
  revokePackageCommissions,
};
