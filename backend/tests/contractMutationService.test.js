const mongoose = require("mongoose");
require("../models/Counter");
const Customer = require("../models/Customer");
const CustomerPackage = require("../models/CustomerPackage");
const Package = require("../models/Package");
const Transaction = require("../models/Transaction");
const ContractTransfer = require("../models/ContractTransfer");
const Setting = require("../models/Setting");
const {
  upgradeContract,
  transferContract,
} = require("../services/contractMutationService");

const models = {
  connection: mongoose.connection,
  Customer,
  CustomerPackage,
  Package,
  Transaction,
  ContractTransfer,
  Setting,
};

const createCustomer = (suffix) => Customer.create({
  name: `Hội viên ${suffix}`,
  phone: `090${String(new mongoose.Types.ObjectId()).slice(-7)}`,
  dob: new Date("1995-01-01T00:00:00.000Z"),
  packageType: "Basic",
  startDate: new Date(),
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
});

const createActiveContract = async (customer) => {
  const basic = await Package.create({
    name: "Basic",
    type: "monthly",
    duration: 30,
    price: 1000000,
  });
  const contract = await CustomerPackage.create({
    customer: customer._id,
    package: basic._id,
    packageName: basic.name,
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    price: basic.price,
    paidAmount: basic.price,
    paymentStatus: "paid",
    contractCode: `HD-${new mongoose.Types.ObjectId()}`,
    status: "active",
  });
  return { basic, contract };
};

describe("contract mutation service", () => {
  beforeAll(async () => {
    await Promise.all([
      CustomerPackage.syncIndexes(),
      Transaction.syncIndexes(),
      ContractTransfer.syncIndexes(),
    ]);
  });

  test("upgrade is retry-safe and repairs the customer projection", async () => {
    const customer = await createCustomer("upgrade");
    const { contract } = await createActiveContract(customer);
    const premium = await Package.create({
      name: "Premium",
      type: "monthly",
      duration: 90,
      price: 3000000,
    });
    const request = {
      models,
      packageId: contract._id,
      data: { newPackageId: premium._id, paymentMethod: "Tiền mặt" },
      actorId: new mongoose.Types.ObjectId(),
    };

    const first = await upgradeContract(request);
    const retry = await upgradeContract(request);

    expect(first.isReplay).toBe(false);
    expect(retry.isReplay).toBe(true);
    expect(String(retry.newCustomerPackage._id)).toBe(String(first.newCustomerPackage._id));
    expect(await CustomerPackage.countDocuments({ operationKey: `contract-upgrade:${contract._id}` })).toBe(1);
    expect(await Transaction.countDocuments({ operationKey: `contract-upgrade:${contract._id}` })).toBe(1);

    const oldContract = await CustomerPackage.findOne(
      { _id: contract._id },
      null,
      { withDeleted: true }
    );
    const updatedCustomer = await Customer.findById(customer._id);
    expect(oldContract.status).toBe("upgraded");
    expect(oldContract.isDeleted).toBe(true);
    expect(String(updatedCustomer.activePackage)).toBe(String(first.newCustomerPackage._id));
  });

  test("transfer is retry-safe across contract, fee and history records", async () => {
    const sourceCustomer = await createCustomer("source");
    const targetCustomer = await createCustomer("target");
    const { contract } = await createActiveContract(sourceCustomer);
    await Setting.create({ transferFee: 750000 });
    const request = {
      models,
      packageId: contract._id,
      data: {
        targetCustomerId: targetCustomer._id,
        paymentMethod: "Chuyển khoản",
      },
      actorId: new mongoose.Types.ObjectId(),
    };

    const first = await transferContract(request);
    const retry = await transferContract(request);

    expect(first.isReplay).toBe(false);
    expect(retry.isReplay).toBe(true);
    expect(String(retry.newCustomerPackage._id)).toBe(String(first.newCustomerPackage._id));
    expect(await CustomerPackage.countDocuments({ operationKey: `contract-transfer:${contract._id}` })).toBe(1);
    expect(await ContractTransfer.countDocuments({ contract: contract._id })).toBe(1);
    expect(await Transaction.countDocuments({ operationKey: `contract-transfer:${contract._id}` })).toBe(1);

    const oldContract = await CustomerPackage.findById(contract._id);
    const updatedSource = await Customer.findById(sourceCustomer._id);
    const updatedTarget = await Customer.findById(targetCustomer._id);
    expect(oldContract.status).toBe("transferred");
    expect(String(oldContract.transferredTo)).toBe(String(first.newCustomerPackage._id));
    expect(updatedSource.activePackage).toBeNull();
    expect(String(updatedTarget.activePackage)).toBe(String(first.newCustomerPackage._id));
  });
});
