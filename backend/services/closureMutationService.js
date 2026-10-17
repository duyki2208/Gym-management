const { runWithRequiredTransaction } = require("../utils/dbTransaction");
const syncCustomerFields = require("../utils/syncCustomer");
const DAY_MS = 86400000;
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const day = (value, end = false) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw fail("Ngày đóng cửa không hợp lệ.");
  date.setHours(end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0);
  return date;
};

const createClosure = async ({ models, data, branchCode, actorId }) => {
  if (!data.title?.trim() || !data.reason?.trim() || !data.startDate || !data.endDate) throw fail("Vui lòng nhập đầy đủ tiêu đề, ngày và lý do.");
  const start = day(data.startDate), end = day(data.endDate, true);
  if (end < start) throw fail("Ngày kết thúc phải sau ngày bắt đầu.");
  return runWithRequiredTransaction(models.connection, async session => {
    if (await models.ClosureEvent.findOne({ branchCode, status: "active", startDate: { $lte: end }, endDate: { $gte: start } }).session(session)) {
      throw fail("Khoảng ngày trùng với một sự kiện đóng cửa đang hoạt động.");
    }
    const [closure] = await models.ClosureEvent.create([{
      branchCode, title: data.title.trim(), reason: data.reason.trim(), startDate: start, endDate: end,
      type: data.type === "emergency" ? "emergency" : "planned", status: "active", createdBy: actorId,
    }], { session });
    const packages = await models.CustomerPackage.find({ status: "active", startDate: { $lte: end }, endDate: { $gte: start } }).session(session);
    let totalDaysAdded = 0;
    const customers = new Set();
    for (const pkg of packages) {
      const daysAdded = Math.floor((Math.min(day(pkg.endDate, true), end) - Math.max(day(pkg.startDate), start)) / DAY_MS) + 1;
      const previousEndDate = new Date(pkg.endDate);
      pkg.endDate = new Date(pkg.endDate.getTime() + daysAdded * DAY_MS);
      pkg.appliedClosures.push({ closureEventId: closure._id, daysAdded, previousEndDate, newEndDate: pkg.endDate });
      await pkg.save({ session });
      customers.add(String(pkg.customer)); totalDaysAdded += daysAdded;
    }
    for (const id of customers) await syncCustomerFields(id, { session }, models);
    closure.compensationStats = { totalPackagesAffected: packages.length, totalCustomersAffected: customers.size, totalDaysAdded, executedAt: new Date() };
    await closure.save({ session });
    return closure;
  });
};

const reverseClosure = async ({ models, id, actorId }) => runWithRequiredTransaction(models.connection, async session => {
  const closure = await models.ClosureEvent.findById(id).session(session);
  if (!closure) throw fail("Không tìm thấy sự kiện đóng cửa.", 404);
  if (closure.status === "reversed") return closure;
  const packages = await models.CustomerPackage.find({ "appliedClosures.closureEventId": closure._id }).session(session);
  const customers = new Set();
  for (const pkg of packages) {
    const entry = pkg.appliedClosures.find(item => String(item.closureEventId) === String(closure._id));
    pkg.endDate = new Date(pkg.endDate.getTime() - entry.daysAdded * DAY_MS);
    pkg.appliedClosures = pkg.appliedClosures.filter(item => String(item.closureEventId) !== String(closure._id));
    await pkg.save({ session });
    customers.add(String(pkg.customer));
  }
  for (const customerId of customers) await syncCustomerFields(customerId, { session }, models);
  closure.status = "reversed";
  closure.compensationStats.reversedAt = new Date();
  closure.compensationStats.reversedBy = actorId;
  await closure.save({ session });
  return closure;
});

module.exports = { createClosure, reverseClosure };
