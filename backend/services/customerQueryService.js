const { CUSTOMER_STATUS } = require("../utils/constants");

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseDate = (value, field) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`${field} không phải ngày hợp lệ`);
    error.code = "INVALID_DATE_FILTER";
    throw error;
  }
  return date;
};

const flattenPackage = (pkg) => {
  if (!pkg) return null;
  const trainer = pkg.trainer
    ? (pkg.trainer.fullName ? { _id: pkg.trainer._id, fullName: pkg.trainer.fullName } : pkg.trainer)
    : null;
  return {
    _id: pkg._id,
    customerId: pkg.customer?._id,
    name: pkg.customer?.name || "",
    code: pkg.customer?.code || "",
    phone: pkg.customer?.phone || "",
    dob: pkg.customer?.dob,
    gender: pkg.customer?.gender || "",
    address: pkg.customer?.address || "",
    avatar: pkg.customer?.avatar || "👤",
    email: pkg.customer?.email || "",
    healthNote: pkg.customer?.healthNote || "",
    faceDescriptor: pkg.customer?.faceDescriptor || [],
    faceEmbedding: pkg.customer?.faceEmbedding || [],
    identityCard: pkg.customer?.identityCard || "",
    emergencyContactName: pkg.customer?.emergencyContactName || "",
    emergencyContactPhone: pkg.customer?.emergencyContactPhone || "",
    source: pkg.customer?.source || "other",
    referredBy: pkg.customer?.referredBy || null,
    packageType: pkg.packageName,
    startDate: pkg.startDate,
    endDate: pkg.endDate,
    price: pkg.price,
    remainingSessions: pkg.remainingSessions,
    trainer,
    assignedStaff: pkg.assignedStaff,
    hasLocker: pkg.hasLocker,
    hasWater: pkg.hasWater,
    contractType: pkg.contractType,
    paymentStatus: pkg.paymentStatus,
    paidAmount: pkg.paidAmount,
    contractCode: pkg.contractCode || "",
    packageNote: pkg.packageNote || "",
    status: pkg.status,
    frozenPeriods: pkg.frozenPeriods,
    createdAt: pkg.createdAt,
    updatedAt: pkg.updatedAt,
  };
};

const listCustomers = async ({ Customer, CustomerPackage, filters = {}, now = new Date() }) => {
  const page = Math.max(1, Number.parseInt(filters.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(filters.limit, 10) || 10));
  const conditions = [];

  const search = String(filters.search || "").trim();
  if (search) {
    const pattern = escapeRegex(search.slice(0, 100));
    const customers = await Customer.find({
      $or: ["name", "phone", "code"].map((field) => ({
        [field]: { $regex: pattern, $options: "i" },
      })),
    }).select("_id");
    conditions.push({ customer: { $in: customers.map((customer) => customer._id) } });
  }

  for (const [filterName, fieldName] of [
    ["paymentStatus", "paymentStatus"],
    ["contractType", "contractType"],
    ["packageType", "packageName"],
    ["assignedStaff", "assignedStaff"],
  ]) {
    if (filters[filterName] && filters[filterName] !== "all") {
      conditions.push({ [fieldName]: filters[filterName] });
    }
  }

  for (const [field, fromName, toName] of [
    ["startDate", "startDateFrom", "startDateTo"],
    ["endDate", "endDateFrom", "endDateTo"],
  ]) {
    const range = {};
    const from = parseDate(filters[fromName], fromName);
    const to = parseDate(filters[toName], toName);
    if (from) range.$gte = from;
    if (to) range.$lte = to;
    if (Object.keys(range).length) conditions.push({ [field]: range });
  }

  const status = filters.status || "all";
  if (status === "active" || status === CUSTOMER_STATUS.ACTIVE) {
    conditions.push({ startDate: { $lte: now } }, { endDate: { $gte: now } }, { status: "active" });
  } else if (status === "not_activated" || status === CUSTOMER_STATUS.NOT_ACTIVATED) {
    conditions.push({ startDate: { $gt: now } }, { status: "active" });
  } else if (status === "expired" || status === CUSTOMER_STATUS.EXPIRED) {
    conditions.push({ $or: [{ endDate: { $lt: now } }, { status: "expired" }] });
  } else if (status === "frozen") {
    conditions.push({ status: "frozen" });
  } else if (status === "expiring" || status === CUSTOMER_STATUS.EXPIRING) {
    const fourteenDaysLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    conditions.push({ endDate: { $gte: now, $lte: fourteenDaysLater } }, { status: "active" });
  }

  const query = conditions.length ? { $and: conditions } : {};
  const [totalCustomers, packages] = await Promise.all([
    CustomerPackage.countDocuments(query),
    CustomerPackage.find(query)
      .populate({ path: "customer", populate: { path: "referredBy", select: "name code phone" } })
      .populate("assignedStaff", "fullName role")
      .populate("trainer", "fullName username role")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  return {
    customers: packages.map(flattenPackage).filter(Boolean),
    totalCustomers,
    totalPages: Math.ceil(totalCustomers / limit),
    currentPage: page,
    limit,
  };
};

module.exports = { escapeRegex, flattenPackage, listCustomers };
