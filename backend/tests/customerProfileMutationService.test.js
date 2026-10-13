const mongoose = require("mongoose");
require("../models/Counter");
const Customer = require("../models/Customer");
const CustomerPackage = require("../models/CustomerPackage");
const Package = require("../models/Package");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Invoice = require("../models/Invoice");
const Commission = require("../models/Commission");
const CommissionPeriod = require("../models/CommissionPeriod");
const {
  CustomerProfileMutationError,
  updateCustomerProfile,
  deleteCustomerPackage,
} = require("../services/customerProfileMutationService");

const models = {
  connection: mongoose.connection,
  Customer,
  CustomerPackage,
  Package,
  User,
  Transaction,
  Invoice,
  Commission,
  CommissionPeriod,
};

const createFixture = async () => {
  const staff = await User.create({
    username: `sale_${new mongoose.Types.ObjectId()}`,
    password: "password123",
    fullName: "Sale Test",
    role: "sale",
  });
  const packageDefinition = await Package.create({
    name: "Member 30",
    type: "monthly",
    duration: 30,
    price: 1000000,
  });
  const startDate = new Date("2026-09-01T00:00:00.000Z");
  const endDate = new Date("2026-10-01T00:00:00.000Z");
  const customer = await Customer.create({
    name: "Hội viên cũ",
    phone: `09${String(new mongoose.Types.ObjectId()).slice(-8)}`,
    packageType: packageDefinition.name,
    startDate,
    endDate,
    price: packageDefinition.price,
    paidAmount: packageDefinition.price,
    paymentStatus: "paid",
  });
  const customerPackage = await CustomerPackage.create({
    customer: customer._id,
    package: packageDefinition._id,
    packageName: packageDefinition.name,
    startDate,
    endDate,
    price: packageDefinition.price,
    paidAmount: packageDefinition.price,
    paymentStatus: "paid",
    contractCode: `HD-${new mongoose.Types.ObjectId()}`,
    assignedStaff: staff._id,
  });
  customer.activePackage = customerPackage._id;
  await customer.save();
  return { staff, packageDefinition, customer, customerPackage };
};

describe("customer profile mutation service", () => {
  test("updates the profile and synchronizes financial records through injected models", async () => {
    const { staff, customer, customerPackage } = await createFixture();
    await Commission.create({
      type: "sale",
      staff: staff._id,
      amount: 50000,
      rate: 5,
      baseAmount: 1000000,
      customerPackage: customerPackage._id,
      customer: customer._id,
      month: 9,
      year: 2026,
      contractType: "new",
    });

    const updated = await updateCustomerProfile({
      models,
      packageId: customerPackage._id,
      actorId: staff._id,
      data: {
        name: "Hội viên mới",
        price: 2000000,
        paymentStatus: "deposit",
        paidAmount: 500000,
        assignedStaff: staff._id,
      },
    });

    const [storedCustomer, storedPackage, transaction, invoice, commission] = await Promise.all([
      Customer.findById(customer._id),
      CustomerPackage.findById(customerPackage._id),
      Transaction.findOne({ customerPackage: customerPackage._id }),
      Invoice.findOne({ referenceId: customerPackage._id }),
      Commission.findOne({ customerPackage: customerPackage._id }),
    ]);
    expect(updated.customer.name).toBe("Hội viên mới");
    expect(storedCustomer.name).toBe("Hội viên mới");
    expect(storedCustomer.price).toBe(2000000);
    expect(storedPackage.paidAmount).toBe(500000);
    expect(transaction.amount).toBe(500000);
    expect(invoice.total).toBe(2000000);
    expect(commission.baseAmount).toBe(2000000);
    expect(commission.amount).toBe(100000);
  });

  test("rejects an invalid deposit before changing customer or package data", async () => {
    const { customer, customerPackage } = await createFixture();

    await expect(updateCustomerProfile({
      models,
      packageId: customerPackage._id,
      data: {
        name: "Không được lưu",
        paymentStatus: "deposit",
        price: 1000000,
        paidAmount: 1000000,
      },
    })).rejects.toMatchObject({
      code: "INVALID_DEPOSIT",
      statusCode: 400,
    });

    expect((await Customer.findById(customer._id)).name).toBe("Hội viên cũ");
    expect((await CustomerPackage.findById(customerPackage._id)).paymentStatus).toBe("paid");
    expect(await Transaction.countDocuments()).toBe(0);
    expect(await Invoice.countDocuments()).toBe(0);
  });

  test("blocks deletion after the sale commission period is locked", async () => {
    const { staff, customerPackage } = await createFixture();
    const createdAt = new Date(customerPackage.createdAt);
    await CommissionPeriod.create({
      month: createdAt.getMonth() + 1,
      year: createdAt.getFullYear(),
      type: "sale",
      status: "approved",
      approvedBy: staff._id,
    });

    await expect(deleteCustomerPackage({
      models,
      packageId: customerPackage._id,
      actorId: staff._id,
    })).rejects.toBeInstanceOf(CustomerProfileMutationError);
    expect(await CustomerPackage.findById(customerPackage._id)).not.toBeNull();
  });

  test("soft-deletes the last package and revokes dependent financial records", async () => {
    const { staff, customer, customerPackage } = await createFixture();
    const transaction = await Transaction.create({
      type: "package_purchase",
      amount: customerPackage.price,
      paymentMethod: "Tiền mặt",
      customer: customer._id,
      customerPackage: customerPackage._id,
      status: "success",
    });
    const commission = await Commission.create({
      type: "sale",
      staff: staff._id,
      amount: 50000,
      rate: 5,
      baseAmount: customerPackage.price,
      customerPackage: customerPackage._id,
      customer: customer._id,
      month: 9,
      year: 2026,
      contractType: "new",
    });

    const result = await deleteCustomerPackage({
      models,
      packageId: customerPackage._id,
      actorId: staff._id,
    });

    const deletedPackage = await CustomerPackage.findOne(
      { _id: customerPackage._id },
      null,
      { withDeleted: true }
    );
    const deletedCustomer = await Customer.findOne(
      { _id: customer._id },
      null,
      { withDeleted: true }
    );
    expect(result.deletedCustomerDetails.package.contractCode).toBe(customerPackage.contractCode);
    expect(deletedPackage.isDeleted).toBe(true);
    expect(deletedCustomer.isDeleted).toBe(true);
    expect((await Transaction.findById(transaction._id)).status).toBe("failed");
    expect((await Commission.findById(commission._id)).status).toBe("revoked");
  });
});
