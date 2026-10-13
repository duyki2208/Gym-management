const mongoose = require("mongoose");
require("../models/Counter");
const Customer = require("../models/Customer");
const CustomerPackage = require("../models/CustomerPackage");
const syncCustomerFields = require("../utils/syncCustomer");
const {
  buildCustomerProjection,
} = require("../utils/syncCustomer");

const createCustomer = (overrides = {}) =>
  Customer.create({
    name: "Nguyễn Văn A",
    phone: "0900000001",
    packageType: "Dữ liệu cũ",
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: new Date("2026-02-01T00:00:00.000Z"),
    ...overrides,
  });

const createPackage = (customer, overrides = {}) =>
  CustomerPackage.create({
    customer: customer._id,
    packageName: "Gói chuẩn",
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: new Date("2026-12-31T00:00:00.000Z"),
    price: 12000000,
    paidAmount: 6000000,
    paymentStatus: "deposit",
    contractCode: `HD-${new mongoose.Types.ObjectId()}`,
    ...overrides,
  });

describe("CustomerPackage -> Customer projection", () => {
  test("transferred package clears benefits that cannot remain active", () => {
    const projection = buildCustomerProjection({
      _id: new mongoose.Types.ObjectId(),
      packageName: "Gói chuyển nhượng",
      category: "maintenance",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-12-31T00:00:00.000Z"),
      status: "transferred",
      remainingSessions: 20,
      trainer: new mongoose.Types.ObjectId(),
      hasLocker: true,
      hasWater: true,
    });

    expect(projection.remainingSessions).toBe(0);
    expect(projection.activePackage).toBeNull();
    expect(projection.trainer).toBeNull();
    expect(projection.hasLocker).toBe(false);
    expect(projection.hasWater).toBe(false);
  });

  test("active package is canonical even when another package was created later", async () => {
    const customer = await createCustomer();
    const activePackage = await createPackage(customer, {
      packageName: "Gói đang hoạt động",
      status: "active",
      endDate: new Date("2027-01-01T00:00:00.000Z"),
    });
    await createPackage(customer, {
      packageName: "Gói đã chuyển",
      status: "transferred",
    });

    await syncCustomerFields(customer._id, {}, { Customer, CustomerPackage });
    const updated = await Customer.findById(customer._id);

    expect(updated.activePackage.toString()).toBe(activePackage._id.toString());
    expect(updated.packageType).toBe("Gói đang hoạt động");
    expect(updated.endDate.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  test("absence of packages clears every cached contract field", async () => {
    const staleStaff = new mongoose.Types.ObjectId();
    const customer = await createCustomer({
      packageCategory: "trial",
      remainingSessions: 12,
      price: 5000000,
      paymentStatus: "paid",
      paidAmount: 5000000,
      contractType: "transfer",
      trainer: staleStaff,
      assignedStaff: staleStaff,
      hasLocker: true,
      hasWater: true,
      packageNote: "stale",
      contractCode: "STALE",
    });

    await syncCustomerFields(customer._id, {}, { Customer, CustomerPackage });
    const updated = await Customer.findById(customer._id);

    expect(updated.packageType).toBe("Không có");
    expect(updated.packageCategory).toBe("maintenance");
    expect(updated.trainer).toBeNull();
    expect(updated.assignedStaff).toBeNull();
    expect(updated.hasLocker).toBe(false);
    expect(updated.hasWater).toBe(false);
    expect(updated.contractType).toBe("new");
    expect(updated.contractCode).toBe("");
    expect(updated.packageNote).toBe("");
  });
});
