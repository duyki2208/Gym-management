const crypto = require("crypto");
const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const Product = require("../models/Product");
require("../models/Customer");
require("../models/Counter");
const SaleOrder = require("../models/SaleOrder");
const Transaction = require("../models/Transaction");
const Invoice = require("../models/Invoice");
const { verifySepayWebhook } = require("../middleware/webhookVerifier");
const { handleWebhook } = require("../controllers/posController");

const models = { Product, SaleOrder, Transaction, Invoice, connection: mongoose.connection };
const centralModels = { Branch: { find: () => ({ select: () => ({ lean: async () => [] }) }) } };
const app = express();
app.use(express.json({ verify: (req, _res, bytes) => { req.rawBody = bytes.toString(); } }));
app.post("/webhook", (req, _res, next) => {
  req.branchCode = "HN01"; req.models = models; req.centralModels = centralModels; next();
}, verifySepayWebhook, handleWebhook);

const deliver = (event) => {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const raw = JSON.stringify(event);
  const signature = crypto.createHmac("sha256", process.env.SEPAY_WEBHOOK_SECRET).update(`${timestamp}.${raw}`).digest("hex");
  return request(app).post("/webhook").set("Content-Type", "application/json")
    .set("X-SePay-Timestamp", timestamp).set("X-SePay-Signature", `sha256=${signature}`).send(raw);
};

let order, event;
beforeEach(async () => {
  process.env.SEPAY_WEBHOOK_SECRET = "webhook-test-secret-for-integration";
  delete process.env.SEPAY_WEBHOOK_AUTH_MODE;
  await Promise.all([SaleOrder.syncIndexes(), Transaction.syncIndexes(), Invoice.syncIndexes()]);
  const product = await Product.create({ name: "Water", sellPrice: 20000, stockQuantity: 10 });
  order = new SaleOrder({ totalAmount: 20000, paymentMethod: "Chuyển khoản QR", status: "Chờ thanh toán",
    paymentAccount: { bank: "VCB", accountNo: "00123456789" }, details: [{ product: product._id, quantity: 1, sellPrice: 20000 }] });
  order.paymentReference = `GYM${String(order._id).toUpperCase()}`;
  await order.save();
  event = { id: 92704, gateway: "Vietcombank", accountNumber: "00123456789", transferType: "in",
    transferAmount: 20000, content: `Thanh toan ${order.paymentReference}` };
});
afterEach(() => { delete process.env.SEPAY_WEBHOOK_SECRET; delete process.env.SEPAY_WEBHOOK_AUTH_MODE; });

const expectUnpaid = async () => {
  expect((await SaleOrder.findById(order._id)).status).toBe("Chờ thanh toán");
  expect(await Transaction.countDocuments()).toBe(0);
  expect(await Invoice.countDocuments()).toBe(0);
};

test("signed incoming event for the saved bank account settles once across repeated deliveries", async () => {
  const first = await deliver(event), second = await deliver(event);
  expect(first.status).toBe(200); expect(first.body.success).toBe(true);
  expect(second.body.success).toBe(true); expect(second.body.idempotent).toBe(true);
  expect((await SaleOrder.findById(order._id)).status).toBe("Đã thanh toán");
  expect(await Transaction.countDocuments()).toBe(1);
  expect(await Invoice.countDocuments()).toBe(1);
});

test.each([
  ["outgoing", { transferType: "out" }, "PAYMENT_NOT_INCOMING"],
  ["missing direction", { transferType: undefined }, "PAYMENT_NOT_INCOMING"],
  ["wrong account", { accountNumber: "00999999999" }, "PAYMENT_ACCOUNT_MISMATCH"],
  ["wrong bank", { gateway: "MBBank" }, "PAYMENT_ACCOUNT_MISMATCH"],
  ["missing bank", { gateway: undefined }, "INVALID_PAYMENT_EVENT"],
  ["missing account", { accountNumber: undefined }, "INVALID_PAYMENT_EVENT"],
  ["missing id", { id: undefined }, "INVALID_PAYMENT_EVENT"],
  ["mock id", { id: 0 }, "INVALID_PAYMENT_EVENT"],
  ["missing amount", { transferAmount: undefined }, "INVALID_PAYMENT_AMOUNT"],
  ["non-numeric amount", { transferAmount: "NaN" }, "INVALID_PAYMENT_AMOUNT"],
  ["infinite amount", { transferAmount: "Infinity" }, "INVALID_PAYMENT_AMOUNT"],
  ["negative amount", { transferAmount: -20000 }, "INVALID_PAYMENT_AMOUNT"],
  ["zero amount", { transferAmount: 0 }, "INVALID_PAYMENT_AMOUNT"],
  ["fractional amount", { transferAmount: 20000.5 }, "INVALID_PAYMENT_AMOUNT"],
  ["unsafe amount", { transferAmount: Number.MAX_SAFE_INTEGER + 1 }, "INVALID_PAYMENT_AMOUNT"],
  ["underpayment", { transferAmount: 10000 }, "PAYMENT_AMOUNT_MISMATCH"],
])("%s is rejected without any payment writes", async (_label, changes, code) => {
  const result = await deliver({ ...event, ...changes });
  expect(result.body.success).toBe(false); expect(result.body.code).toBe(code);
  await expectUnpaid();
});

test("missing account snapshot is not replaced by current settings", async () => {
  await SaleOrder.updateOne({ _id: order._id }, { $unset: { paymentAccount: 1 } });
  const result = await deliver(event);
  expect(result.body.code).toBe("PAYMENT_ACCOUNT_UNVERIFIABLE");
  await expectUnpaid();
});

test("an old short reference still settles when account snapshot is verifiable", async () => {
  const result = await deliver({ ...event, content: `GYM${String(order._id).slice(-8)}` });
  expect(result.body.success).toBe(true);
});

test("explicit API key mode settles a valid event and still rejects the wrong receiver", async () => {
  process.env.SEPAY_WEBHOOK_AUTH_MODE = "apikey";
  const send = (payload) => request(app).post("/webhook")
    .set("Authorization", `Apikey ${process.env.SEPAY_WEBHOOK_SECRET}`).send(payload);
  const rejected = await send({ ...event, accountNumber: "9999999999" });
  expect(rejected.body.code).toBe("PAYMENT_ACCOUNT_MISMATCH");
  await expectUnpaid();
  const accepted = await send(event);
  expect(accepted.body.success).toBe(true);
});

test("a captured signature cannot authorize a modified payment body", async () => {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto.createHmac("sha256", process.env.SEPAY_WEBHOOK_SECRET).update(`${timestamp}.${JSON.stringify(event)}`).digest("hex");
  const result = await request(app).post("/webhook").set("X-SePay-Timestamp", timestamp)
    .set("X-SePay-Signature", `sha256=${signature}`).send({ ...event, transferAmount: 40000 });
  expect(result.status).toBe(401);
  await expectUnpaid();
});
