const mongoose = require("mongoose");
require("../models/Counter");
const Customer = require("../models/Customer");
const CustomerPackage = require("../models/CustomerPackage");
const Transaction = require("../models/Transaction");
const PackageExtensionHistory = require("../models/PackageExtensionHistory");
const AuditLog = require("../models/AuditLog");
const {
  freezeContract,
  unfreezeContract,
  adjustContractExpiry,
  loadPackageExtensionHistory,
  recordExpiryAdjustmentAudit,
} = require("../services/contractLifecycleService");

const models = {
  connection: mongoose.connection,
  Customer,
  CustomerPackage,
  Transaction,
  PackageExtensionHistory,
  AuditLog,
};

const createContract = async () => {
  const customer = await Customer.create({
    name: "Trần Thị B",
    phone: "0900000002",
    packageType: "Gói năm",
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: new Date("2026-12-31T00:00:00.000Z"),
  });
  const customerPackage = await CustomerPackage.create({
    customer: customer._id,
    packageName: "Gói năm",
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: new Date("2026-12-31T00:00:00.000Z"),
    price: 12000000,
    paidAmount: 12000000,
    paymentStatus: "paid",
    contractCode: `HD-${new mongoose.Types.ObjectId()}`,
    status: "active",
  });
  return { customer, customerPackage };
};

describe("contract lifecycle service", () => {
  beforeAll(async () => {
    await Promise.all([
      Transaction.syncIndexes(),
      PackageExtensionHistory.syncIndexes(),
    ]);
  });

  test("freeze is retry-safe and keeps the customer projection consistent", async () => {
    const { customer, customerPackage } = await createContract();
    const actorId = new mongoose.Types.ObjectId();
    const data = {
      startDate: "2026-06-01T00:00:00.000Z",
      endDate: "2026-06-11T00:00:00.000Z",
      reasonType: "other",
      freezeFee: 200000,
      paymentMethod: "Tiền mặt",
    };

    await freezeContract({
      models,
      packageId: customerPackage._id,
      data,
      actorId,
    });
    await freezeContract({
      models,
      packageId: customerPackage._id,
      data,
      actorId,
    });

    const updatedPackage = await CustomerPackage.findById(customerPackage._id);
    const updatedCustomer = await Customer.findById(customer._id);
    expect(updatedPackage.status).toBe("frozen");
    expect(updatedPackage.frozenPeriods).toHaveLength(1);
    expect(updatedPackage.endDate.toISOString()).toBe("2027-01-10T00:00:00.000Z");
    expect(updatedCustomer.endDate.toISOString()).toBe("2027-01-10T00:00:00.000Z");
    expect(
      await Transaction.countDocuments({ customerPackage: customerPackage._id })
    ).toBe(1);
  });

  test("early unfreeze shortens the extension and updates the projection", async () => {
    const { customer, customerPackage } = await createContract();
    await freezeContract({
      models,
      packageId: customerPackage._id,
      data: {
        startDate: "2026-06-01T00:00:00.000Z",
        endDate: "2026-06-11T00:00:00.000Z",
        reasonType: "medical",
      },
      actorId: new mongoose.Types.ObjectId(),
    });

    await unfreezeContract({
      models,
      packageId: customerPackage._id,
      actualUnfreezeDate: "2026-06-06T00:00:00.000Z",
    });

    const updatedPackage = await CustomerPackage.findById(customerPackage._id);
    const updatedCustomer = await Customer.findById(customer._id);
    expect(updatedPackage.status).toBe("active");
    expect(updatedPackage.frozenPeriods[0].endDate.toISOString()).toBe(
      "2026-06-06T00:00:00.000Z"
    );
    expect(updatedPackage.endDate.toISOString()).toBe("2027-01-05T00:00:00.000Z");
    expect(updatedCustomer.endDate.toISOString()).toBe("2027-01-05T00:00:00.000Z");
  });

  test("expiry adjustment creates one history record across retries", async () => {
    const { customer, customerPackage } = await createContract();
    const request = {
      models,
      packageId: customerPackage._id,
      newEndDate: "2027-02-01T00:00:00.000Z",
      reason: "Bù ngày đóng cửa",
      actorId: new mongoose.Types.ObjectId(),
    };

    await adjustContractExpiry(request);
    await adjustContractExpiry(request);

    const updatedPackage = await CustomerPackage.findById(customerPackage._id);
    const updatedCustomer = await Customer.findById(customer._id);
    const histories = await PackageExtensionHistory.find({
      packageId: customerPackage._id,
    });
    expect(histories).toHaveLength(1);
    expect(updatedPackage.endDate.toISOString()).toBe("2027-02-01T00:00:00.000Z");
    expect(updatedCustomer.endDate.toISOString()).toBe("2027-02-01T00:00:00.000Z");
    expect(histories[0].daysDifference).toBe(32);
  });

  test("rejects an actual unfreeze date before the freeze starts", async () => {
    const { customerPackage } = await createContract();
    await freezeContract({
      models,
      packageId: customerPackage._id,
      data: {
        startDate: "2026-06-10T00:00:00.000Z",
        endDate: "2026-06-20T00:00:00.000Z",
        reasonType: "medical",
      },
      actorId: new mongoose.Types.ObjectId(),
    });

    await expect(unfreezeContract({
      models,
      packageId: customerPackage._id,
      actualUnfreezeDate: "2026-06-09T00:00:00.000Z",
    })).rejects.toMatchObject({
      code: "UNFREEZE_BEFORE_FREEZE_START",
      statusCode: 400,
    });
    const storedPackage = await CustomerPackage.findById(customerPackage._id);
    expect(storedPackage.status).toBe("frozen");
    expect(storedPackage.frozenPeriods[0].endDate.toISOString()).toBe(
      "2026-06-20T00:00:00.000Z"
    );
  });

  test("loads extension history from the injected model and records its audit", async () => {
    const { customerPackage } = await createContract();
    const actorId = new mongoose.Types.ObjectId();
    const result = await adjustContractExpiry({
      models,
      packageId: customerPackage._id,
      newEndDate: "2027-01-31T00:00:00.000Z",
      reason: "Bù ngày bảo trì",
      actorId,
    });
    const audit = await recordExpiryAdjustmentAudit({
      AuditLog,
      pkg: result.pkg,
      history: result.history,
      actorId,
      reason: "Bù ngày bảo trì",
      ipAddress: "127.0.0.1",
    });
    const history = await loadPackageExtensionHistory({
      PackageExtensionHistory,
      packageId: customerPackage._id,
    });

    expect(audit.recorded).toBe(true);
    expect(history).toHaveLength(1);
    expect(history[0].reason).toBe("Bù ngày bảo trì");
    expect(await AuditLog.countDocuments({ user: actorId })).toBe(1);
  });
});
