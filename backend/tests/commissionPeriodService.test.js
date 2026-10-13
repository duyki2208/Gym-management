const mongoose = require("mongoose");
require("../models/Counter");
const User = require("../models/User");
const Customer = require("../models/Customer");
const CustomerPackage = require("../models/CustomerPackage");
const Commission = require("../models/Commission");
const CommissionPeriod = require("../models/CommissionPeriod");
const {
  CommissionPeriodError,
  createOrGetCommissionPeriod,
  approveCommissionPeriod,
  payCommissionPeriod,
  revokePackageCommissions,
} = require("../services/commissionPeriodService");
const {
  resolveMonthYear,
  resolveVisibleCommissionTypes,
} = require("../services/commissionQueryService");

const createCommissionFixture = async () => {
  const staff = await User.create({
    username: `commission_${new mongoose.Types.ObjectId()}`,
    password: "password123",
    role: "sale",
  });
  const customer = await Customer.create({
    name: "Hội viên hoa hồng",
    phone: `09${String(new mongoose.Types.ObjectId()).slice(-8)}`,
    packageType: "Member",
    endDate: new Date("2026-12-31T00:00:00.000Z"),
  });
  const customerPackage = await CustomerPackage.create({
    customer: customer._id,
    packageName: "Member",
    startDate: new Date("2026-09-01T00:00:00.000Z"),
    endDate: new Date("2026-12-31T00:00:00.000Z"),
    price: 2000000,
    contractCode: `HD-${new mongoose.Types.ObjectId()}`,
  });
  const commission = await Commission.create({
    type: "sale",
    staff: staff._id,
    amount: 100000,
    rate: 5,
    baseAmount: 2000000,
    customerPackage: customerPackage._id,
    customer: customer._id,
    contractType: "new",
    month: 9,
    year: 2026,
  });
  return { staff, customerPackage, commission };
};

describe("commission query and period services", () => {
  test("validates month/year and derives visible types from scope", () => {
    expect(resolveMonthYear({ month: "9", year: "2026" })).toEqual({
      month: 9,
      year: 2026,
    });
    expect(() => resolveMonthYear({ month: "13", year: "2026" })).toThrow(
      expect.objectContaining({ code: "INVALID_COMMISSION_QUERY" })
    );
    expect(resolveVisibleCommissionTypes({ role: "pt", canReadAll: false })).toEqual(["pt"]);
    expect(resolveVisibleCommissionTypes({ role: "manager", canReadAll: true })).toEqual(["pt", "sale"]);
  });

  test("creates a period once and returns the existing record on retry", async () => {
    await createCommissionFixture();
    const request = {
      Commission,
      CommissionPeriod,
      data: { month: 9, year: 2026, type: "sale" },
    };
    const first = await createOrGetCommissionPeriod(request);
    const retry = await createOrGetCommissionPeriod(request);

    expect(first.created).toBe(true);
    expect(retry.created).toBe(false);
    expect(String(retry.period._id)).toBe(String(first.period._id));
    expect(first.period.totalAmount).toBe(100000);
    expect(first.period.totalRecords).toBe(1);
  });

  test("approves and pays a period through explicit state transitions", async () => {
    const { staff } = await createCommissionFixture();
    const { period } = await createOrGetCommissionPeriod({
      Commission,
      CommissionPeriod,
      data: { month: 9, year: 2026, type: "sale" },
    });
    const approved = await approveCommissionPeriod({
      Commission,
      CommissionPeriod,
      periodId: period._id,
      actorId: staff._id,
    });
    const paid = await payCommissionPeriod({
      CommissionPeriod,
      periodId: period._id,
      actorId: staff._id,
      note: "Đã chuyển khoản",
    });

    expect(approved.status).toBe("approved");
    expect(paid.status).toBe("paid");
    expect(paid.note).toBe("Đã chuyển khoản");
  });

  test("blocks revocation when a related commission period is approved", async () => {
    const { staff, customerPackage, commission } = await createCommissionFixture();
    await CommissionPeriod.create({
      month: 9,
      year: 2026,
      type: "sale",
      status: "approved",
      approvedBy: staff._id,
    });

    await expect(revokePackageCommissions({
      Commission,
      CommissionPeriod,
      customerPackageId: customerPackage._id,
      actorId: staff._id,
    })).rejects.toBeInstanceOf(CommissionPeriodError);
    expect((await Commission.findById(commission._id)).status).toBe("active");
  });
});
