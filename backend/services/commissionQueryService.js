class CommissionQueryError extends Error {
  constructor(message, statusCode = 400, code = "INVALID_COMMISSION_QUERY") {
    super(message);
    this.name = "CommissionQueryError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const parseInteger = (value, fallback, label, minimum, maximum) => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new CommissionQueryError(`${label} không hợp lệ.`);
  }
  return parsed;
};

const resolveMonthYear = ({ month, year, now = new Date() }) => ({
  month: parseInteger(month, now.getMonth() + 1, "Tháng", 1, 12),
  year: parseInteger(year, now.getFullYear(), "Năm", 2000, 2200),
});

const resolveVisibleCommissionTypes = ({ role, canReadAll }) => {
  if (canReadAll) return ["pt", "sale"];
  if (["pt", "pm"].includes(role)) return ["pt"];
  if (["sale", "sm"].includes(role)) return ["sale"];
  return [];
};

const buildStaffScope = ({ actorId, requestedStaffId, canReadAll }) => {
  if (canReadAll) return requestedStaffId || undefined;
  return actorId;
};

const summarizeByStaff = (commissions, type) => {
  const byStaff = new Map();
  for (const commission of commissions) {
    if (!commission.staff?._id) continue;
    const staffId = String(commission.staff._id);
    if (!byStaff.has(staffId)) {
      byStaff.set(staffId, type === "pt" ? {
        staff: commission.staff,
        totalSessions: 0,
        totalAmount: 0,
        records: [],
      } : {
        staff: commission.staff,
        totalContracts: 0,
        newContracts: 0,
        renewContracts: 0,
        upgradeContracts: 0,
        totalAmount: 0,
        totalBaseValue: 0,
        records: [],
      });
    }
    const summary = byStaff.get(staffId);
    summary.totalAmount += Number(commission.amount || 0);
    summary.records.push(commission);
    if (type === "pt") {
      summary.totalSessions += 1;
    } else {
      summary.totalContracts += 1;
      summary.totalBaseValue += Number(commission.baseAmount || 0);
      if (commission.contractType === "new") summary.newContracts += 1;
      else if (commission.contractType === "renew") summary.renewContracts += 1;
      else if (String(commission.contractType || "").startsWith("upgrade")) {
        summary.upgradeContracts += 1;
      }
    }
  }
  const staffSummary = [...byStaff.values()];
  return {
    staffSummary,
    grandTotal: staffSummary.reduce((total, item) => total + item.totalAmount, 0),
  };
};

const listCommissions = async ({
  Commission,
  type,
  filters = {},
  actorId,
  canReadAll,
  now,
}) => {
  if (!['pt', 'sale'].includes(type)) {
    throw new CommissionQueryError("Loại hoa hồng không hợp lệ.");
  }
  const period = resolveMonthYear({ ...filters, now });
  const staff = buildStaffScope({
    actorId,
    requestedStaffId: filters.staffId,
    canReadAll,
  });
  const query = { type, ...period, status: "active" };
  if (staff) query.staff = staff;

  let databaseQuery = Commission.find(query)
    .populate("staff", "fullName username role")
    .populate("customer", "name code phone");
  databaseQuery = type === "pt"
    ? databaseQuery.populate("workoutSession", "date ptName note")
    : databaseQuery.populate(
        "customerPackage",
        "packageName price contractType contractCode startDate endDate"
      );
  const commissions = await databaseQuery.sort({ createdAt: -1 });
  const summary = summarizeByStaff(commissions, type);
  return {
    ...period,
    ...summary,
    totalRecords: commissions.length,
  };
};

const getCommissionSummary = async ({ Commission, CommissionPeriod, filters = {}, now }) => {
  const period = resolveMonthYear({ ...filters, now });
  const { month, year } = period;
  const [ptAgg, saleAgg, periods] = await Promise.all([
    Commission.aggregate([
      { $match: { type: "pt", month, year, status: "active" } },
      { $group: {
        _id: null,
        totalAmount: { $sum: "$amount" },
        totalRecords: { $sum: 1 },
        staffCount: { $addToSet: "$staff" },
      } },
    ]),
    Commission.aggregate([
      { $match: { type: "sale", month, year, status: "active" } },
      { $group: {
        _id: null,
        totalAmount: { $sum: "$amount" },
        totalRecords: { $sum: 1 },
        totalBaseValue: { $sum: "$baseAmount" },
        staffCount: { $addToSet: "$staff" },
      } },
    ]),
    CommissionPeriod.find({ month, year }),
  ]);
  const pt = ptAgg[0] || { totalAmount: 0, totalRecords: 0, staffCount: [] };
  const sale = saleAgg[0] || {
    totalAmount: 0,
    totalRecords: 0,
    totalBaseValue: 0,
    staffCount: [],
  };
  const ptPeriod = periods.find((item) => item.type === "pt");
  const salePeriod = periods.find((item) => item.type === "sale");
  return {
    month,
    year,
    pt: {
      totalAmount: pt.totalAmount,
      totalSessions: pt.totalRecords,
      staffCount: pt.staffCount?.length || 0,
      periodStatus: ptPeriod?.status || "draft",
      periodId: ptPeriod?._id || null,
    },
    sale: {
      totalAmount: sale.totalAmount,
      totalContracts: sale.totalRecords,
      totalBaseValue: sale.totalBaseValue || 0,
      staffCount: sale.staffCount?.length || 0,
      periodStatus: salePeriod?.status || "draft",
      periodId: salePeriod?._id || null,
    },
    grandTotal: Number(pt.totalAmount || 0) + Number(sale.totalAmount || 0),
  };
};

const listCommissionPeriods = async ({ CommissionPeriod, filters = {}, visibleTypes }) => {
  const query = {};
  if (filters.year !== undefined && filters.year !== "") {
    query.year = parseInteger(filters.year, undefined, "Năm", 2000, 2200);
  }
  if (!visibleTypes?.length) return [];
  query.type = { $in: visibleTypes };
  return CommissionPeriod.find(query)
    .populate("approvedBy", "fullName username")
    .populate("paidBy", "fullName username")
    .sort({ year: -1, month: -1 });
};

module.exports = {
  CommissionQueryError,
  resolveMonthYear,
  resolveVisibleCommissionTypes,
  buildStaffScope,
  summarizeByStaff,
  listCommissions,
  getCommissionSummary,
  listCommissionPeriods,
};
