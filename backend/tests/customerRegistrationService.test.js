const mongoose = require("mongoose");
require("../models/Counter");
const Customer = require("../models/Customer");
const CustomerPackage = require("../models/CustomerPackage");
const Package = require("../models/Package");
const User = require("../models/User");
const Invoice = require("../models/Invoice");
const Transaction = require("../models/Transaction");
const {
  registerCustomer,
  CustomerRegistrationError,
} = require("../services/customerRegistrationService");

const models = {
  connection: mongoose.connection,
  Customer,
  CustomerPackage,
  Package,
  User,
  Invoice,
  Transaction,
};

describe("customer registration service", () => {
  beforeAll(async () => {
    await Promise.all([
      Customer.syncIndexes(),
      CustomerPackage.syncIndexes(),
      Invoice.syncIndexes(),
      Transaction.syncIndexes(),
    ]);
  });

  test("same idempotency key creates one contract, invoice, transaction and referral reward", async () => {
    const template = await Package.create({
      name: "Member 3 tháng",
      type: "monthly",
      duration: 90,
      price: 3000000,
    });
    const referrer = await Customer.create({
      name: "Người giới thiệu",
      phone: "0901111111",
      packageType: template.name,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-12-31T00:00:00.000Z"),
    });
    const referrerPackage = await CustomerPackage.create({
      customer: referrer._id,
      package: template._id,
      packageName: template.name,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-12-31T00:00:00.000Z"),
      price: template.price,
      contractCode: "HD-REFERRER",
      status: "active",
      paymentStatus: "paid",
      paidAmount: template.price,
    });
    const request = {
      models,
      actorId: new mongoose.Types.ObjectId(),
      idempotencyKey: "registration-test-001",
      data: {
        name: "Khách đăng ký",
        phone: "0902222222",
        packageType: template.name,
        startDate: "2026-03-01T00:00:00.000Z",
        endDate: "2026-06-01T00:00:00.000Z",
        price: template.price,
        paymentStatus: "paid",
        contractCode: "HD-NEW-001",
        contractType: "new",
        source: "referral",
        referredBy: referrer._id,
      },
    };

    const first = await registerCustomer(request);
    const retry = await registerCustomer(request);

    expect(first.isReplay).toBe(false);
    expect(retry.isReplay).toBe(true);
    expect(String(first.customerPackage._id)).toBe(String(retry.customerPackage._id));
    expect(await CustomerPackage.countDocuments({ operationKey: "customer-registration:registration-test-001" })).toBe(1);
    expect(await Invoice.countDocuments({ referenceId: first.customerPackage._id })).toBe(1);
    expect(await Transaction.countDocuments({ operationKey: "customer-registration:registration-test-001" })).toBe(1);

    const rewarded = await CustomerPackage.findById(referrerPackage._id);
    expect(rewarded.endDate.toISOString()).toBe("2027-01-30T00:00:00.000Z");
    expect(rewarded.packageNote.match(/\+1T giới thiệu/g)).toHaveLength(1);
  });

  test("registration requires a bounded idempotency key", async () => {
    await expect(registerCustomer({
      models,
      idempotencyKey: "",
      data: {
        name: "A",
        phone: "0903333333",
        packageType: "Basic",
        endDate: "2026-06-01",
      },
    })).rejects.toEqual(expect.objectContaining({
      constructor: CustomerRegistrationError,
      code: "INVALID_IDEMPOTENCY_KEY",
    }));
  });
});
