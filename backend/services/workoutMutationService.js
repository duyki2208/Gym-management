const { runWithRequiredTransaction } = require("../utils/dbTransaction");
const syncCustomerFields = require("../utils/syncCustomer");
const fail = (message, statusCode = 400, code = "WORKOUT_OPERATION_FAILED") => Object.assign(new Error(message), { statusCode, code });

const deductSession = async ({ models, id, data, actorId, operationKey }) =>
  runWithRequiredTransaction(models.connection, async session => {
    if (operationKey) {
      const existing = await models.WorkoutSession.findOne({ operationKey }).session(session);
      if (existing) {
        if (String(existing.confirmedBy) !== String(actorId)) throw fail("Mã thao tác đã được sử dụng.", 409);
        const customer = await models.Customer.findById(existing.customer).session(session);
        return { workout: existing, customer, duplicate: true };
      }
    }
    let ptName = data.ptName;
    if (data.ptId) {
      const pt = await models.User.findById(data.ptId).session(session);
      if (!pt || !["pt", "pm"].includes(pt.role)) throw fail("Nhân viên được chọn không phải PT hoặc PM");
      ptName = pt.fullName || pt.username;
    }
    if (!ptName) throw fail("Vui lòng chọn Huấn luyện viên (PT)");
    let customer = await models.Customer.findById(id).session(session);
    let pkg;
    if (!customer) {
      pkg = await models.CustomerPackage.findById(id).session(session);
      if (pkg) customer = await models.Customer.findById(pkg.customer).session(session);
    }
    if (!customer) throw fail("Không tìm thấy khách hàng", 404);
    // Select the canonical contract without saving a stale Customer projection.
    if (!pkg) pkg = await syncCustomerFields.findCanonicalPackage(models.CustomerPackage, customer._id, session);
    const payPerSession = data.payPerSession === true;
    if (!payPerSession) {
      const source = pkg ? models.CustomerPackage : models.Customer;
      const updated = await source.findOneAndUpdate(
        { _id: pkg?._id || customer._id, remainingSessions: { $gt: 0 } },
        { $inc: { remainingSessions: -1 } }, { session, returnDocument: "after" }
      );
      if (!updated) throw fail("Khách hàng đã hết số buổi tập trong hệ thống");
    }
    const [workout] = await models.WorkoutSession.create([{
      customer: customer._id, pt: data.ptId || null, ptName, confirmedBy: actorId, note: data.note || "",
      customerPackage: payPerSession ? null : pkg?._id || null,
      deductionSource: payPerSession ? "none" : pkg ? "package" : "customer",
      deductedSessions: payPerSession ? 0 : 1, operationKey,
    }], { session });
    const setting = await models.Setting.findOne().session(session);
    const sessionPrice = setting?.ptSessionPrice ?? 500000;
    if (payPerSession) await models.Transaction.create([{
      type: "pt_session", amount: sessionPrice, paymentMethod: data.paymentMethod || "Tiền mặt",
      customer: customer._id, customerName: customer.name, workoutSession: workout._id, status: "success", staff: actorId,
    }], { session });
    if (data.ptId) {
      const now = new Date();
      const rate = setting?.ptCommissionRate ?? 10;
      const locked = await models.CommissionPeriod.findOne({ type: "pt", month: now.getMonth() + 1, year: now.getFullYear(), status: { $in: ["approved", "paid"] } }).session(session);
      if (locked) throw fail("Kỳ hoa hồng PT đã khóa.", 409, "COMMISSION_PERIOD_LOCKED");
      await models.Commission.create([{
        type: "pt", staff: data.ptId, amount: sessionPrice * rate / 100, rate, baseAmount: sessionPrice,
        workoutSession: workout._id, customer: customer._id, month: now.getMonth() + 1, year: now.getFullYear(),
      }], { session });
    }
    if (!payPerSession && pkg) {
      await syncCustomerFields(customer._id, { session }, models);
    }
    customer = await models.Customer.findById(customer._id).session(session);
    await workout.populate([{ path: "pt", select: "fullName username role" }, { path: "confirmedBy", select: "fullName username role" }]);
    return { workout, customer, duplicate: false };
  });

const deleteSession = async ({ models, id, actorId }) => runWithRequiredTransaction(models.connection, async session => {
  const workout = await models.WorkoutSession.findById(id).session(session);
  if (!workout) throw fail("Không tìm thấy buổi tập", 404);
  const date = new Date(workout.date);
  if (await models.CommissionPeriod.findOne({ month: date.getMonth() + 1, year: date.getFullYear(), type: "pt", status: { $in: ["approved", "paid"] } }).session(session)) {
    throw fail("Kỳ thanh toán hoa hồng PT đã khóa, không thể xóa.", 400, "COMMISSION_PERIOD_LOCKED");
  }
  // Old rows did not record which contract was charged. Never invent a refund target.
  if (!workout.deductionSource || workout.deductedSessions === undefined) {
    throw fail("Buổi tập cũ thiếu thông tin trừ buổi. Cần đối soát trước khi xóa.", 409, "WORKOUT_RECONCILIATION_REQUIRED");
  }
  const customer = await models.Customer.findById(workout.customer).session(session);
  if (!customer) throw fail("Không tìm thấy khách hàng của buổi tập này", 404);
  await models.Commission.updateMany({ workoutSession: id, status: "active" }, { $set: { status: "revoked", revokedReason: "Xóa buổi tập", revokedAt: new Date(), revokedBy: actorId } }, { session });
  await models.Transaction.updateMany({ workoutSession: id }, { $set: { status: "failed" } }, { session });
  if (workout.deductedSessions > 0) {
    const source = workout.deductionSource === "package" ? models.CustomerPackage : models.Customer;
    const filter = workout.deductionSource === "package" ? { _id: workout.customerPackage, customer: customer._id } : { _id: customer._id };
    const restored = await source.updateOne(filter, { $inc: { remainingSessions: workout.deductedSessions } }, { session });
    if (restored.matchedCount !== 1) throw fail("Không tìm thấy gói gốc để hoàn buổi. Cần đối soát.", 409, "WORKOUT_RECONCILIATION_REQUIRED");
    if (workout.deductionSource === "package") await syncCustomerFields(customer._id, { session }, models);
  }
  await workout.deleteOne({ session });
  return { customer: await models.Customer.findById(customer._id).session(session), refunded: workout.deductedSessions };
});

module.exports = { deductSession, deleteSession };
