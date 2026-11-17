process.env.TEST_MONGO_REPLICA_SET = "true";
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const manager = require("../db/branchConnectionManager");
const { transferBranch } = require("../services/branchTransferService");
const app = require("../server");
const checkins = require("../controllers/checkInController");
const faceClient = require("../utils/faceServiceClient");
const queueService = require("../utils/queueService");
let central, source, target, other, customer, pkg;
const modelNames = ["Customer", "CustomerPackage", "Invoice", "Transaction", "Counter", "User", "CheckIn", "Setting"];
beforeAll(async () => {
  central = await manager.getCentralModels();
  for (const [code, dbName] of [["HN01", "gym_management"], ["HCM01", "transfer_target"], ["DAN01", "transfer_other"]]) {
    await central.Branch.updateOne({ code }, { $set: { name: code, dbName, isActive: true } }, { upsert: true });
  }
  source = await manager.getBranchModels("HN01"); target = await manager.getBranchModels("HCM01"); other = await manager.getBranchModels("DAN01");
  for (const models of [source, target, other]) await Promise.all(modelNames.map(name => models[name].init()));
});
beforeEach(async () => {
  for (const models of [source, target, other]) await Promise.all(modelNames.map(name => models[name].deleteMany({})));
  await central.Branch.updateMany({}, { $set: { isActive: true } });
  customer = await source.Customer.create({ name: "Transfer member", phone: "0901234567", packageType: "PT", endDate: new Date("2028-01-01"), faceEmbedding: [0.1, 0.2] });
  pkg = await source.CustomerPackage.create({ customer: customer._id, packageName: "PT", contractCode: "SOURCE-001", startDate: new Date("2026-01-01"),
    endDate: customer.endDate, remainingSessions: 10, price: 1000, paidAmount: 500, paymentStatus: "deposit" });
  customer.activePackage = pkg._id; await customer.save();
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => { await manager.closeAllConnections(); });
const input = (changes = {}) => ({ customerId: String(customer._id), packageId: String(pkg._id), targetBranchCode: "HCM01", transferFee: 100, ...changes });
const execute = (changes = {}, options = {}) => transferBranch({ sourceModels: source, centralModels: central, getTargetModels: manager.getBranchModels,
  sourceBranchCode: "HN01", actorId: new mongoose.Types.ObjectId(), data: input(changes), ...options });
const expectUntouched = async () => {
  const stored = await source.CustomerPackage.findById(pkg._id);
  expect(stored.status).toBe("active"); expect(stored.transferStatus).toBe("none");
  expect(stored.branchTransfer?.fingerprint).toBeUndefined();
  expect(String((await source.Customer.findById(customer._id)).activePackage)).toBe(String(pkg._id));
  expect(await source.Invoice.countDocuments()).toBe(0); expect(await source.Transaction.countDocuments()).toBe(0);
  expect(await source.Counter.findById("invoiceId")).toBeNull();
  expect(await source.Counter.findById("transactionId")).toBeNull();
  expect(await target.Customer.countDocuments()).toBe(0); expect(await target.CustomerPackage.countDocuments()).toBe(0);
};

test("commits both databases, fee and receipt atomically and retains deposit balances", async () => {
  const result = await execute();
  const moved = await target.CustomerPackage.findById(result.targetPackageId);
  expect(result.atomic).toBe(true); expect(result.idempotent).toBe(false);
  expect(moved.remainingSessions).toBe(10); expect(moved.paidAmount).toBe(500); expect(moved.paymentStatus).toBe("deposit");
  expect((await source.CustomerPackage.findById(pkg._id)).status).toBe("transferred");
  expect((await source.Customer.findById(customer._id)).activePackage).toBeNull();
  expect(String((await target.Customer.findById(result.targetCustomerId)).activePackage)).toBe(String(moved._id));
  expect(await source.Invoice.countDocuments({ type: "transfer" })).toBe(1);
  expect(await source.Transaction.countDocuments({ type: "service_fee", amount: 100 })).toBe(1);
});

test("five concurrent requests and a later retry return one target package and one fee", async () => {
  const replies = await Promise.all(Array.from({ length: 5 }, () => execute()));
  const replay = await execute();
  expect(new Set([...replies, replay].map(row => String(row.targetPackageId))).size).toBe(1);
  expect(replay.idempotent).toBe(true);
  expect(await target.Customer.countDocuments()).toBe(1); expect(await target.CustomerPackage.countDocuments()).toBe(1);
  expect(await source.Invoice.countDocuments()).toBe(1); expect(await source.Transaction.countDocuments()).toBe(1);
});

test.each(["target customer", "target package", "fee invoice", "fee transaction", "source close", "projection"])("failure at %s rolls back both databases; retry completes once", async (stage) => {
  const [model, method] = {
    "target customer": [target.Customer, "create"], "target package": [target.CustomerPackage, "create"],
    "fee invoice": [source.Invoice, "create"], "fee transaction": [source.Transaction, "create"],
    "source close": [source.CustomerPackage.prototype, "save"], "projection": [target.Customer.prototype, "save"],
  }[stage];
  // Projection stage must fail after customer insertion rather than on its initial save.
  const original = model[method];
  const spy = jest.spyOn(model, method).mockImplementationOnce(function (...args) {
    if (stage === "projection" && this.isNew) {
      spy.mockImplementationOnce(() => { throw new Error("INJECTED_TRANSFER_FAILURE"); });
      return original.apply(this, args);
    }
    throw new Error("INJECTED_TRANSFER_FAILURE");
  });
  await expect(execute()).rejects.toThrow("INJECTED_TRANSFER_FAILURE");
  spy.mockRestore();
  await expectUntouched();
  const result = await execute(); expect(result.idempotent).toBe(false);
  expect(await target.CustomerPackage.countDocuments()).toBe(1); expect(await source.Transaction.countDocuments()).toBe(1);
});

test("an idempotency key resolves the original package after the active projection changes", async () => {
  const result = await execute({ packageId: undefined }, { requestKey: "move-001" });
  const replay = await execute({ packageId: undefined }, { requestKey: "move-001" });
  expect(String(replay.targetPackageId)).toBe(String(result.targetPackageId)); expect(replay.idempotent).toBe(true);
});

test.each([{ targetBranchCode: "DAN01" }, { transferFee: 200 }, { note: "changed" }, { paymentMethod: "Chuyển khoản QR" }])("changed request after completion is a conflict: %p", async changes => {
  await execute({}, { requestKey: "immutable-move" });
  await expect(execute(changes, { requestKey: "immutable-move" })).rejects.toMatchObject({ code: "TRANSFER_REQUEST_CONFLICT", statusCode: 409 });
  expect(await target.CustomerPackage.countDocuments()).toBe(1); expect(await other.CustomerPackage.countDocuments()).toBe(0);
  expect(await source.Transaction.countDocuments()).toBe(1);
});

test("one key cannot concurrently move two different source packages", async () => {
  const second = await source.CustomerPackage.create({ customer: customer._id, packageName: "Gym", contractCode: "SOURCE-002", startDate: pkg.startDate, endDate: pkg.endDate, price: 100 });
  const results = await Promise.allSettled([execute({}, { requestKey: "unique-move" }), execute({ packageId: String(second._id) }, { requestKey: "unique-move" })]);
  expect(results.filter(row => row.status === "fulfilled")).toHaveLength(1);
  expect(results.find(row => row.status === "rejected").reason).toMatchObject({ code: "TRANSFER_REQUEST_CONFLICT" });
  expect(await target.CustomerPackage.countDocuments()).toBe(1); expect(await source.Transaction.countDocuments()).toBe(1);
});

test.each([-1, NaN, Infinity, 0.5, "100", Number.MAX_SAFE_INTEGER + 1])("invalid fee %s creates no side effects", async transferFee => {
  await expect(execute({ transferFee })).rejects.toMatchObject({ code: "INVALID_BRANCH_TRANSFER", statusCode: 400 });
  await expectUntouched();
});

test("legacy pending packages are blocked without adding another fee", async () => {
  await source.CustomerPackage.updateOne({ _id: pkg._id }, { $set: { transferStatus: "transfer_pending" } });
  await expect(execute()).rejects.toMatchObject({ code: "LEGACY_TRANSFER_PENDING", statusCode: 409 });
  expect(await target.CustomerPackage.countDocuments()).toBe(0); expect(await source.Invoice.countDocuments()).toBe(0);
});

test("standalone or a different MongoClient is rejected before mutation", async () => {
  await expect(execute({}, { sourceModels: { ...source, connection: {} } })).rejects.toMatchObject({ code: "MONGO_TRANSACTIONS_REQUIRED", statusCode: 503 });
  await expect(execute({}, { getTargetModels: async () => ({ ...target, connection: mongoose.connection }) })).rejects.toMatchObject({ code: "TRANSFER_TOPOLOGY_UNSUPPORTED", statusCode: 503 });
  await expectUntouched();
});

test("zero fee creates no invoice or transaction", async () => {
  const result = await execute({ transferFee: 0 });
  expect(result.invoiceCode).toBeNull(); expect(await source.Transaction.countDocuments()).toBe(0); expect(await source.Invoice.countDocuments()).toBe(0);
  expect(await target.CustomerPackage.countDocuments()).toBe(1);
});

test("missing unique key index fails closed before financial writes", async () => {
  jest.spyOn(source.CustomerPackage.collection, "indexes").mockResolvedValueOnce([]);
  await expect(execute({}, { requestKey: "requires-index" })).rejects.toMatchObject({ code: "TRANSFER_INDEX_REQUIRED", statusCode: 503 });
  await expectUntouched();
});

test("existing target member is reused and its longer active contract is retained", async () => {
  const existing = await target.Customer.create({ name: customer.name, phone: customer.phone, packageType: "Gym", endDate: new Date("2029-01-01") });
  const retained = await target.CustomerPackage.create({ customer: existing._id, packageName: "Gym", startDate: pkg.startDate, endDate: existing.endDate, price: 500 });
  existing.activePackage = retained._id; await existing.save();
  const result = await execute();
  expect(String(result.targetCustomerId)).toBe(String(existing._id)); expect(await target.Customer.countDocuments()).toBe(1);
  expect(String((await target.Customer.findById(existing._id)).activePackage)).toBe(String(retained._id));
  expect(await target.CustomerPackage.countDocuments()).toBe(2);
});

test("a stale recognition cache cannot admit a member after its source contract moved", async () => {
  checkins.invalidateEmbeddingCache();
  faceClient.recognize.mockResolvedValue({ matched: true, member_id: String(customer._id), confidence: 0.95 });
  const enqueue = jest.spyOn(queueService, "enqueue").mockReturnValue("disabled");
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  const req = { models: source, branchCode: "HN01", file: { buffer: Buffer.from("test-frame") } };
  const before = response(); await checkins.recognizeFace(req, before);
  expect(before.body.checkinId).toBeDefined();
  // Direct service call deliberately does not invalidate the controller's local cache.
  await execute();
  const after = response(); await checkins.recognizeFace(req, after);
  expect(after.body.rejected).toBe(true); expect(after.body.warning).toBe("transferred");
  expect(await source.CheckIn.countDocuments()).toBe(1); expect(enqueue).toHaveBeenCalledTimes(1);
});

test("ambiguous target phone numbers and inactive target branches cannot incur a fee", async () => {
  await central.Branch.updateOne({ code: "HCM01" }, { $set: { isActive: false } });
  await expect(execute()).rejects.toMatchObject({ code: "TARGET_BRANCH_NOT_FOUND" });
  await expectUntouched();
  await central.Branch.updateOne({ code: "HCM01" }, { $set: { isActive: true } });
  for (const name of ["First", "Second"]) await target.Customer.create({ name, phone: customer.phone, packageType: "Gym", endDate: pkg.endDate });
  await expect(execute()).rejects.toMatchObject({ code: "AMBIGUOUS_TARGET_CUSTOMER" });
  expect(await source.Invoice.countDocuments()).toBe(0); expect(await source.Transaction.countDocuments()).toBe(0);
  expect((await source.CustomerPackage.findById(pkg._id)).transferStatus).toBe("none");
  expect(await target.CustomerPackage.countDocuments()).toBe(0);
});

test("real HTTP requests with an idempotency key replay the same committed transfer", async () => {
  const actor = await source.User.create({ username: "transfer-admin", password: "test-password", role: "admin" });
  const token = jwt.sign({ id: actor._id, branchCode: "HN01", isCentral: false }, process.env.JWT_SECRET, { expiresIn: "1h" });
  const send = () => request(app).post("/api/v1/branch-transfers/transfer").set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", "http-move-001").send(input({ packageId: undefined }));
  const [first, concurrent] = await Promise.all([send(), send()]);
  const replay = await send();
  for (const response of [first, concurrent, replay]) { expect(response.status).toBe(200); expect(response.body.data.atomic).toBe(true); }
  expect(first.body.data.targetPackageId).toBe(replay.body.data.targetPackageId);
  expect(replay.body.data.idempotent).toBe(true);
  expect(await source.Transaction.countDocuments()).toBe(1); expect(await target.CustomerPackage.countDocuments()).toBe(1);
  const stored = await source.CustomerPackage.findById(pkg._id);
  expect(String(stored.branchTransfer.actorId)).toBe(String(actor._id));
});

test("HTTP validation and permissions reject invalid or unauthorized transfers without writes", async () => {
  const actor = await source.User.create({ username: "transfer-pt", password: "test-password", role: "pt" });
  const token = jwt.sign({ id: actor._id, branchCode: "HN01", isCentral: false }, process.env.JWT_SECRET, { expiresIn: "1h" });
  expect((await request(app).post("/api/v1/branch-transfers/transfer").set("Authorization", `Bearer ${token}`).send(input())).status).toBe(403);
  actor.role = "admin"; await actor.save();
  const invalid = await request(app).post("/api/v1/branch-transfers/transfer").set("Authorization", `Bearer ${token}`).send(input({ transferFee: -1 }));
  expect(invalid.status).toBe(400); await expectUntouched();
  const unstable = await request(app).post("/api/v1/branch-transfers/transfer").set("Authorization", `Bearer ${token}`).send(input({ packageId: undefined }));
  expect(unstable.status).toBe(400); await expectUntouched();
});
