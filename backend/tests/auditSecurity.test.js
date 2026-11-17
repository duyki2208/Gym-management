process.env.TEST_MONGO_REPLICA_SET = "true";
jest.unmock("../middleware/auditLogger");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const auditLogger = jest.requireActual("../middleware/auditLogger");
const { sanitizeAuditValue } = require("../utils/auditSanitizer");
const AuditLog = require("../models/AuditLog");
const User = require("../models/User");
const Product = require("../models/Product");
const SaleOrder = require("../models/SaleOrder");
const Setting = require("../models/Setting");
const app = require("../server");
const manager = require("../db/branchConnectionManager");
const logger = require("../utils/logger");

const secrets = {
  sepayApiKey: "private-provider-value", cameraRtspUrl: "rtsp://camera-user:camera-password@camera.local/live",
  vietqrAccountNo: "00123456789", vietqrAccountName: "PRIVATE ACCOUNT NAME",
};
const actorToken = async (role = "admin") => {
  const user = await User.create({ username: `audit-${role}`, password: "test-password", role });
  return { user, token: jwt.sign({ id: user._id, branchCode: "HN01", isCentral: false }, process.env.JWT_SECRET, { expiresIn: "1h" }) };
};
const waitForLog = async (filter) => {
  // The middleware writes after response.finish; wait for persistence, not just HTTP completion.
  for (let attempt = 0; attempt < 100; attempt++) {
    const log = await AuditLog.findOne(filter).lean();
    if (log) return log;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error("Expected audit row was not persisted");
};
beforeAll(async () => { await manager.ensureBranchIndexes(await manager.getBranchModels("HN01")); });

test("real settings update persists sanitized metadata while settings keep their actual values", async () => {
  const { token, user } = await actorToken();
  const result = await request(app).put("/api/v1/settings?token=query-private-value")
    .set("Authorization", `Bearer ${token}`).set("x-request-id", "audit-settings-123").send({ ...secrets, targetRevenue: 12345 });
  expect(result.status).toBe(200);
  const log = await waitForLog({ method: "PUT", path: "/api/v1/settings" });
  expect(log.details).toMatchObject({ targetRevenue: 12345, sepayApiKey: "[FILTERED]", cameraRtspUrl: "[FILTERED]",
    vietqrAccountNo: "[FILTERED]", vietqrAccountName: "[FILTERED]" });
  expect(log.statusCode).toBe(200); expect(log.requestId).toBe("audit-settings-123");
  expect(String(log.user)).toBe(String(user._id));
  const stored = await Setting.findOne().lean();
  expect(stored.sepayApiKey).toBe(secrets.sepayApiKey);
  for (const value of [...Object.values(secrets), "query-private-value"]) expect(JSON.stringify(log)).not.toContain(value);
});

test.each(["confirm", "cancel"])("real PATCH %s records actor, target order and success status", async (operation) => {
  const { token, user } = await actorToken();
  const product = await Product.create({ name: "Water", sellPrice: 10000, stockQuantity: 10 });
  const order = await SaleOrder.create({ totalAmount: 10000, paymentMethod: "Chuyển khoản QR", status: "Chờ thanh toán",
    details: [{ product: product._id, quantity: 1, sellPrice: 10000 }] });
  const path = `/api/v1/pos/orders/${order._id}/${operation}`;
  const result = await request(app).patch(path).set("Authorization", `Bearer ${token}`).send({ note: "Counter operation" });
  expect(result.status).toBe(200);
  const log = await waitForLog({ method: "PATCH", path });
  expect(log.action).toBe(operation === "confirm" ? "Xác nhận thanh toán POS" : "Hủy đơn hàng POS");
  expect(log.statusCode).toBe(200); expect(String(log.user)).toBe(String(user._id));
  expect(await AuditLog.countDocuments({ method: "PATCH", path })).toBe(1);
});

test("manager API reads redact historical rows without exposing or silently rewriting stored evidence", async () => {
  const { token } = await actorToken("om");
  const _id = new mongoose.Types.ObjectId();
  // Simulate a row written before redaction existed, bypassing the new model save hook.
  await AuditLog.collection.insertOne({ _id, action: "PUT /api/v1/settings?token=legacy-query-private", path: "/api/v1/settings?token=legacy-query-private",
    method: "PUT", details: { ...secrets, nested: [{ "API_KEY": "legacy-private-key", faceEmbedding: [0.12, 0.23] }] }, createdAt: new Date() });
  const response = await request(app).get("/api/v1/audit-logs").set("Authorization", `Bearer ${token}`);
  expect(response.status).toBe(200);
  const row = response.body.data.logs.find(log => log._id === String(_id));
  expect(row.details.nested[0]).toEqual({ API_KEY: "[FILTERED]", faceEmbedding: "[FILTERED]" });
  expect(row.path).toBe("/api/v1/settings"); expect(row.action).toBe("PUT /api/v1/settings");
  for (const value of [...Object.values(secrets), "legacy-query-private", "legacy-private-key"]) expect(JSON.stringify(row)).not.toContain(value);
  expect((await AuditLog.collection.findOne({ _id })).details.sepayApiKey).toBe(secrets.sepayApiKey);
});

test("internal model writes also redact nested credentials and preserve useful identifiers", async () => {
  const targetId = new mongoose.Types.ObjectId();
  const row = await AuditLog.create({ action: "SYSTEM /repair?accessToken=private", path: "/repair?secret=private",
    details: { targetId, amount: 12345, rows: [{ refresh_token: "internal-private", phone: "0912345678" }] } });
  const stored = await AuditLog.findById(row._id).lean();
  expect(stored.path).toBe("/repair"); expect(stored.action).toBe("SYSTEM /repair");
  expect(stored.details).toEqual({ targetId: String(targetId), amount: 12345,
    rows: [{ refresh_token: "[FILTERED]", phone: "091****678" }] });
  const descriptive = await AuditLog.create({ action: "Đóng cửa cơ sở: Vì sao? Kiểm tra #1" });
  expect(descriptive.action).toBe("Đóng cửa cơ sở: Vì sao? Kiểm tra #1");
});

test("redaction handles cycles, URLs and nested arrays without mutating input", () => {
  const input = { ...secrets, nested: [{ password: "nested-private", url: "https://name:url-password@example.com/file?signature=url-private#private" }], phone: "0912345678" };
  input.circular = input;
  const safe = sanitizeAuditValue(input);
  expect(safe.nested[0]).toEqual({ password: "[FILTERED]", url: "https://example.com/file" });
  expect(safe.circular).toBe("[Circular]"); expect(input.nested[0].password).toBe("nested-private");
  expect(sanitizeAuditValue(safe)).toEqual(safe);
});

test("DELETE snapshots pass through the same redaction and use the injected tenant model", async () => {
  const create = jest.fn().mockResolvedValue({}); let finish;
  const req = { method: "DELETE", path: "/customers/contract", originalUrl: "/api/v1/customers/contract?token=private",
    deletedCustomerDetails: { customer: { faceDescriptor: [1, 2], ...secrets }, package: { contractCode: "HD-001", price: 1000 } },
    models: { AuditLog: { create } }, ip: "127.0.0.1", user: { _id: "actor", username: "staff" } };
  const next = jest.fn();
  auditLogger(req, { statusCode: 200, on: (_event, callback) => { finish = callback; } }, next);
  await finish();
  expect(next).toHaveBeenCalledTimes(1);
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ path: "/api/v1/customers/contract",
    details: { customer: { faceDescriptor: "[FILTERED]", sepayApiKey: "[FILTERED]", cameraRtspUrl: "[FILTERED]", vietqrAccountNo: "[FILTERED]", vietqrAccountName: "[FILTERED]" }, package: { contractCode: "HD-001", price: 1000 } } }));
  expect(req.deletedCustomerDetails.customer.sepayApiKey).toBe(secrets.sepayApiKey);
});

test.each([400, 401, 403, 500])("failed HTTP status %s is not recorded as a successful mutation", async (statusCode) => {
  const create = jest.fn(); let finish;
  auditLogger({ method: "PATCH", path: "/pos/orders/order/confirm", models: { AuditLog: { create } } },
    { statusCode, on: (_event, callback) => { finish = callback; } }, () => {});
  await finish(); expect(create).not.toHaveBeenCalled();
});

test("failed audit persistence logs only error metadata, not the failed secret-bearing document", async () => {
  const create = jest.fn().mockRejectedValue(new Error("private-provider-value in validation payload"));
  const logError = jest.spyOn(logger, "error").mockImplementation(() => {}); let finish;
  try {
    auditLogger({ method: "PUT", path: "/settings", body: secrets, id: "audit-error-123", models: { AuditLog: { create } } },
      { statusCode: 200, on: (_event, callback) => { finish = callback; } }, () => {});
    await finish();
    expect(logError).toHaveBeenCalledWith("audit_log_write_failed", { requestId: "audit-error-123", errorName: "Error", errorCode: undefined });
    expect(JSON.stringify(logError.mock.calls)).not.toContain("private-provider-value");
  } finally { logError.mockRestore(); }
});
