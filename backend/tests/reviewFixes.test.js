process.env.TEST_MONGO_REPLICA_SET = "true";
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const schemas = require("../models/schemas/branchSchemas");
const names = ["User", "Counter", "Customer", "CustomerPackage", "Product", "SaleOrder", "Invoice", "Transaction", "Setting", "Commission", "CommissionPeriod", "WorkoutSession", "ClosureEvent", "Package", "CheckIn"];
const models = { connection: mongoose.connection };
for (const name of names) {
  const schemaName = name[0].toLowerCase() + name.slice(1) + "Schema";
  models[name] = mongoose.models[name] || mongoose.model(name, schemas[schemaName]);
}
const app = require("../server");
const manager = require("../db/branchConnectionManager");
const { createCheckout, cancelOrder } = require("../services/posOrderService");
const { completePosPayment } = require("../services/posPaymentService");
const workouts = require("../services/workoutMutationService");
const closures = require("../services/closureMutationService");
const { updateCustomerProfile } = require("../services/customerProfileMutationService");
const { generateAccessToken, generateRefreshToken, hashToken } = require("../utils/generateTokens");
const { resolvePermissionsForRole } = require("../middleware/permissions");
const faceClient = require("../utils/faceServiceClient");
const checkins = require("../controllers/checkInController");
const queue = require("../utils/queueService");
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
let actor;
const token = () => generateAccessToken(actor._id, actor.role, { branchCode: "HN01", isCentral: false });
const fixture = async () => {
  const c = await models.Customer.create({ name: "Review member", phone: "0909999999", packageType: "PT", startDate: new Date("2026-01-01"), endDate: new Date("2027-01-01"), faceEmbedding: [0.1, 0.2] });
  const p = await models.CustomerPackage.create({ customer: c._id, packageName: "PT", startDate: c.startDate, endDate: c.endDate, price: 1000, paidAmount: 1000, remainingSessions: 5 });
  c.activePackage = p._id; c.remainingSessions = 5; await c.save();
  return { c, p };
};
const product = () => models.Product.create({ name: "Water", stockQuantity: 10, sellPrice: 100 });
const checkout = (p, extra = {}) => createCheckout({ models, actorId: actor._id, data: { paymentMethod: "Tiền mặt", details: [{ product: p._id, quantity: 2 }], ...extra } });

beforeAll(async () => {
  await Promise.all(names.map(name => models[name].init()));
  const branchModels = await manager.getBranchModels("HN01");
  await manager.ensureBranchIndexes(branchModels);
});
beforeEach(async () => {
  actor = await models.User.create({ username: "review-admin", password: "test-hash", role: "admin" });
  checkins.invalidateEmbeddingCache();
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => manager.closeAllConnections());

test("empty current permission override grants no permissions", async () => {
  await models.Setting.create({ rolePermissionsVersion: 4, rolePermissions: { reception: [] } });
  expect(await resolvePermissionsForRole("reception", models.Setting)).toEqual([]);
});

test("switch then refresh keeps selected branch through authenticated HTTP", async () => {
  process.env.JWT_REFRESH_SECRET = "review-test-refresh-secret";
  const central = await manager.getCentralModels();
  await central.Branch.updateOne({ code: "HCM01" }, { $set: { name: "Target", dbName: "review_hcm", isActive: true } }, { upsert: true });
  const user = await central.CentralUser.create({ username: `central-${new mongoose.Types.ObjectId()}`, password: "test", fullName: "Central", role: "admin", allowedBranches: ["*"] });
  const access = generateAccessToken(user._id, user.role, { isCentral: true, allowedBranches: ["*"], activeBranch: "HN01" });
  const refresh = generateRefreshToken(user._id, { isCentral: true, activeBranch: "HN01" });
  await central.CentralSession.create({ userId: user._id, tokenHash: hashToken(refresh), expiresAt: new Date(Date.now() + 86400000) });
  const switched = await request(app).post("/api/v1/auth/switch-branch").set("Authorization", `Bearer ${access}`).set("Cookie", `refreshToken=${refresh}`).send({ branchCode: "HCM01" });
  expect(switched.status).toBe(200);
  const refreshed = await request(app).post("/api/v1/auth/refresh-token").set("Cookie", switched.headers["set-cookie"][0].split(";")[0]).send({});
  expect(refreshed.status).toBe(200);
  expect(jwt.decode(refreshed.body.token).activeBranch).toBe("HCM01");
  const me = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${refreshed.body.token}`);
  expect(me.status).toBe(200); expect(me.body.user.activeBranch).toBe("HCM01");
});

test("concurrent refresh requests keep the winning session usable", async () => {
  process.env.JWT_REFRESH_SECRET = "review-test-refresh-secret";
  const central = await manager.getCentralModels();
  await central.Branch.updateOne(
    { code: "HN01" },
    { $set: { name: "Default", dbName: "gym_management", isActive: true } },
    { upsert: true }
  );
  const user = await central.CentralUser.create({
    username: `race-${new mongoose.Types.ObjectId()}`,
    password: "test",
    fullName: "Race user",
    role: "admin",
    allowedBranches: ["*"],
  });
  const refresh = generateRefreshToken(user._id, { isCentral: true, activeBranch: "HN01" });
  await central.CentralSession.create({
    userId: user._id,
    tokenHash: hashToken(refresh),
    expiresAt: new Date(Date.now() + 86400000),
  });
  const refreshRequest = () => request(app)
    .post("/api/v1/auth/refresh-token")
    .set("Cookie", `refreshToken=${refresh}`)
    .send({});

  const [first, second] = await Promise.all([refreshRequest(), refreshRequest()]);
  const winner = [first, second].find((result) => result.status === 200);
  const loser = [first, second].find((result) => result.status === 401);
  expect(winner).toBeDefined();
  expect(loser).toBeDefined();
  expect(await central.CentralSession.countDocuments({ userId: user._id })).toBe(1);

  const continued = await request(app)
    .post("/api/v1/auth/refresh-token")
    .set("Cookie", winner.headers["set-cookie"][0].split(";")[0])
    .send({});
  expect(continued.status).toBe(200);
});

test("branch transfer rejects a package owned by another customer before any write", async () => {
  const a = await fixture(), b = await fixture();
  const central = await manager.getCentralModels();
  await central.Branch.updateOne({ code: "HCM01" }, { $set: { name: "Target", dbName: "review_hcm", isActive: true } }, { upsert: true });
  const res = response();
  await require("../controllers/branchTransferController").transferCustomerBranch({ branchCode: "HN01", models, centralModels: central, user: actor,
    body: { customerId: a.c._id, packageId: b.p._id, targetBranchCode: "HCM01", transferFee: 100 } }, res);
  expect(res.statusCode).toBe(404);
  expect((await models.CustomerPackage.findById(b.p._id)).status).toBe("active");
  expect(await models.Transaction.countDocuments()).toBe(0);
});

test.each([-2, 0, 1.5, "2", null])("checkout rejects quantity %p without changing stock", async quantity => {
  const p = await product();
  await expect(checkout(p, { details: [{ product: p._id, quantity }] })).rejects.toMatchObject({ statusCode: 400 });
  expect((await models.Product.findById(p._id)).stockQuantity).toBe(10);
});

test("standalone checkout is rejected before any mutation", async () => {
  const p = await product();
  await expect(createCheckout({ models: { ...models, connection: {} }, data: { paymentMethod: "Tiền mặt", details: [{ product: p._id, quantity: 1 }] } })).rejects.toMatchObject({ code: "MONGO_TRANSACTIONS_REQUIRED", statusCode: 503 });
  expect((await models.Product.findById(p._id)).stockQuantity).toBe(10);
});

test("checkout rolls back earlier stock writes when a later item fails", async () => {
  const p = await product();
  await expect(checkout(p, { details: [{ product: p._id, quantity: 2 }, { product: new mongoose.Types.ObjectId(), quantity: 1 }] })).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
  expect((await models.Product.findById(p._id)).stockQuantity).toBe(10);
  expect(await models.SaleOrder.countDocuments()).toBe(0);
});

test("invoice failure rolls back order, payment and stock", async () => {
  const p = await product();
  jest.spyOn(models.Invoice, "create").mockRejectedValueOnce(new Error("injected invoice failure"));
  await expect(checkout(p)).rejects.toThrow("injected invoice failure");
  expect((await models.Product.findById(p._id)).stockQuantity).toBe(10);
  expect(await models.SaleOrder.countDocuments()).toBe(0);
  expect(await models.Transaction.countDocuments()).toBe(0);
});

test("QR uses configured account and full payment reference; absent config writes nothing", async () => {
  const p = await product();
  await expect(checkout(p, { paymentMethod: "Chuyển khoản QR" })).rejects.toMatchObject({ code: "PAYMENT_ACCOUNT_NOT_CONFIGURED" });
  expect((await models.Product.findById(p._id)).stockQuantity).toBe(10);
  await models.Setting.create({ vietqrBank: "Vietcombank", vietqrAccountNo: "123456789", vietqrAccountName: "REVIEW" });
  const order = await checkout(p, { paymentMethod: "Chuyển khoản QR" });
  expect(order.paymentAccount.bank).toBe("VCB"); expect(order.paymentAccount.accountNo).toBe("123456789");
  expect(order.paymentReference).toBe(`GYM${String(order._id).toUpperCase()}`);
});

test("member checkout rejects a contract ID and accepts actual customer ID", async () => {
  const { c, p } = await fixture(); const item = await product();
  await expect(checkout(item, { customerId: p._id })).rejects.toMatchObject({ code: "CUSTOMER_NOT_FOUND" });
  const order = await checkout(item, { customerId: c._id });
  expect(order.isWalkIn).toBe(false); expect(String(order.customer)).toBe(String(c._id));
});

test("checkout retry with same key does not debit stock twice", async () => {
  const p = await product();
  const input = { models, actorId: actor._id, idempotencyKey: "same-checkout", data: { paymentMethod: "Tiền mặt", details: [{ product: p._id, quantity: 2 }] } };
  const first = await createCheckout(input), second = await createCheckout(input);
  expect(String(second._id)).toBe(String(first._id)); expect((await models.Product.findById(p._id)).stockQuantity).toBe(8);
});

test("concurrent cancellations restore stock once", async () => {
  const p = await product();
  await models.Setting.create({ vietqrBank: "MBBank", vietqrAccountNo: "12345678" });
  const order = await checkout(p, { paymentMethod: "Chuyển khoản QR" });
  await Promise.all([cancelOrder({ models, orderId: order._id }), cancelOrder({ models, orderId: order._id })]);
  expect((await models.Product.findById(p._id)).stockQuantity).toBe(10);
});

test("cancellation racing payment commits only one consistent outcome", async () => {
  const p = await product();
  await models.Setting.create({ vietqrBank: "MBBank", vietqrAccountNo: "12345678" });
  const order = await checkout(p, { paymentMethod: "Chuyển khoản QR" });
  await Promise.allSettled([cancelOrder({ models, orderId: order._id }), completePosPayment({ models, orderId: order._id, amount: 200 })]);
  const stored = await models.SaleOrder.findById(order._id);
  const paid = stored.status === "Đã thanh toán";
  expect(["Đã thanh toán", "Đã huỷ"]).toContain(stored.status);
  expect((await models.Product.findById(p._id)).stockQuantity).toBe(paid ? 8 : 10);
  expect(await models.Transaction.countDocuments({ saleOrder: order._id })).toBe(paid ? 1 : 0);
  expect(await models.Invoice.countDocuments({ referenceId: order._id })).toBe(paid ? 1 : 0);
});

test("profile-only edit preserves upgrade delta and service-fee transactions", async () => {
  const { c, p } = await fixture(); p.contractType = "upgrade"; p.upgradeDeltaPrice = 200; await p.save();
  const fee = await models.Transaction.create({ type: "service_fee", amount: 50, customerPackage: p._id, paymentMethod: "Tiền mặt" });
  const payment = await models.Transaction.create({ type: "package_purchase", amount: 200, customerPackage: p._id, paymentMethod: "Tiền mặt" });
  await updateCustomerProfile({ models, packageId: p._id, actorId: actor._id, data: { name: "Updated" } });
  expect((await models.Transaction.findById(payment._id)).amount).toBe(200);
  expect((await models.Transaction.findById(fee._id)).amount).toBe(50);
  expect((await models.Customer.findById(c._id)).name).toBe("Updated");
});

test("locked commission blocks edit before profile, price or commission changes", async () => {
  const { c, p } = await fixture();
  const commission = await models.Commission.create({ type: "sale", staff: actor._id, customer: c._id, customerPackage: p._id, rate: 10, amount: 100, baseAmount: 1000, month: 9, year: 2026 });
  await models.CommissionPeriod.create({ type: "sale", month: 9, year: 2026, status: "paid" });
  await expect(updateCustomerProfile({ models, packageId: p._id, actorId: actor._id, data: { name: "Blocked", price: 2000 } })).rejects.toMatchObject({ code: "COMMISSION_PERIOD_LOCKED" });
  expect((await models.CustomerPackage.findById(p._id)).price).toBe(1000);
  expect((await models.Commission.findById(commission._id)).amount).toBe(100);
  expect((await models.Customer.findById(c._id)).name).not.toBe("Blocked");
});

test("deleting a pay-per-session workout refunds no package sessions", async () => {
  const { c, p } = await fixture();
  const result = await workouts.deductSession({ models, id: c._id, data: { ptName: "PT", payPerSession: true }, actorId: actor._id });
  await workouts.deleteSession({ models, id: result.workout._id, actorId: actor._id });
  expect((await models.CustomerPackage.findById(p._id)).remainingSessions).toBe(5);
});

test("last session can be consumed by only one concurrent request", async () => {
  const { c, p } = await fixture(); p.remainingSessions = 1; await p.save();
  const results = await Promise.allSettled(Array.from({ length: 3 }, () => workouts.deductSession({ models, id: c._id, data: { ptName: "PT" }, actorId: actor._id })));
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect(await models.WorkoutSession.countDocuments({ customer: c._id })).toBe(1);
  expect((await models.CustomerPackage.findById(p._id)).remainingSessions).toBe(0);
});

test("refund targets original package even after another package becomes active", async () => {
  const { c, p } = await fixture();
  const result = await workouts.deductSession({ models, id: c._id, data: { ptName: "PT" }, actorId: actor._id });
  const newer = await models.CustomerPackage.create({ customer: c._id, packageName: "New", startDate: p.startDate, endDate: new Date("2028-01-01"), price: 2000, remainingSessions: 20 });
  c.activePackage = newer._id; await c.save();
  await workouts.deleteSession({ models, id: result.workout._id, actorId: actor._id });
  expect((await models.CustomerPackage.findById(p._id)).remainingSessions).toBe(5);
  expect((await models.CustomerPackage.findById(newer._id)).remainingSessions).toBe(20);
});

test("closure reversal retains later extensions and synchronizes customer projection", async () => {
  const { c, p } = await fixture();
  const closure = await closures.createClosure({ models, data: { title: "Closed", reason: "Repair", startDate: "2026-05-01", endDate: "2026-05-02" }, branchCode: "HN01", actorId: actor._id });
  const changed = await models.CustomerPackage.findById(p._id);
  expect((await models.Customer.findById(c._id)).endDate.getTime()).toBe(changed.endDate.getTime());
  changed.endDate = new Date(changed.endDate.getTime() + 10 * 86400000); await changed.save();
  await closures.reverseClosure({ models, id: closure._id, actorId: actor._id });
  const expected = p.endDate.getTime() + 10 * 86400000;
  expect((await models.CustomerPackage.findById(p._id)).endDate.getTime()).toBe(expected);
  expect((await models.Customer.findById(c._id)).endDate.getTime()).toBe(expected);
});

test("staff update response excludes password", async () => {
  const res = await request(app).put(`/api/v1/staff/${actor._id}`).set("Authorization", `Bearer ${token()}`).send({ phone: "0909999999" });
  expect(res.status).toBe(200); expect(res.body.password).toBeUndefined();
});

test("parallel camera matches persist one check-in and send one notification", async () => {
  const { c } = await fixture();
  faceClient.recognize.mockResolvedValue({ matched: true, member_id: String(c._id), confidence: 0.95 });
  const enqueue = jest.spyOn(queue, "enqueue").mockReturnValue("disabled");
  const replies = [response(), response(), response()];
  await Promise.all(replies.map(res => checkins.recognizeFace({ models, branchCode: "HN01", file: { buffer: Buffer.from("test") } }, res)));
  expect(await models.CheckIn.countDocuments({ customerId: c._id })).toBe(1);
  expect(enqueue).toHaveBeenCalledTimes(1);
  expect(replies.filter(res => res.body.duplicate)).toHaveLength(2);
});

test("webhook finds legacy order older than 100 newer orders", async () => {
  const p = await product();
  const old = await models.SaleOrder.create({ totalAmount: 100, paymentMethod: "Chuyển khoản QR", status: "Chờ thanh toán", details: [{ product: p._id, quantity: 1, sellPrice: 100 }], createdAt: new Date("2020-01-01") });
  await models.SaleOrder.insertMany(Array.from({ length: 101 }, () => ({ totalAmount: 100, details: [], status: "Chờ thanh toán" })));
  const res = response();
  await require("../controllers/posController").handleWebhook({ models, branchCode: "HN01", centralModels: { Branch: { find: () => ({ select: () => ({ lean: async () => [] }) }) } },
    body: { id: "review-legacy-event", content: `GYM${String(old._id).slice(-8)}`, transferAmount: 100 } }, res);
  expect(res.statusCode).toBe(200); expect(res.body.success).toBe(true);
  expect((await models.SaleOrder.findById(old._id)).status).toBe("Đã thanh toán");
});
