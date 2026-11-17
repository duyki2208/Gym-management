const request = require("supertest");
const app = require("../server");
const Product = require("../models/Product");
const Lead = require("../models/Lead");
const AuditLog = require("../models/AuditLog");
const Customer = require("../models/Customer");
require("../models/Counter");
const faceClient = require("../utils/faceServiceClient");
const { invalidateEmbeddingCache } = require("../controllers/checkInController");
const { createTestUserAndGetToken } = require("./testSetup");
let token;
beforeEach(async () => { ({ token } = await createTestUserAndGetToken("admin")); });
const get = path => request(app).get(path).set("Authorization", `Bearer ${token}`);

test("product pages remain bounded and non-overlapping and expose totals to browser clients", async () => {
  await Product.insertMany(Array.from({ length: 105 }, (_, i) => ({ name: `Product ${i}`, sellPrice: 100 })));
  const first = await get("/api/v1/products?limit=100000").set("Origin", "http://localhost:5173");
  const second = await get("/api/v1/products?page=2&limit=100");
  expect(first.status).toBe(200); expect(first.body).toHaveLength(100); expect(second.body).toHaveLength(5);
  expect(first.headers["x-total-pages"]).toBe("2"); expect(first.headers["access-control-expose-headers"]).toContain("X-Total-Pages");
  expect(new Set([...first.body, ...second.body].map(row => row._id)).size).toBe(105);
});

test("regex metacharacters are literal across products, leads, check-in and audit search", async () => {
  await Product.create([{ name: "Literal .*", sellPrice: 100 }, { name: "Other", sellPrice: 100 }]);
  await Lead.create([{ name: "Literal .*", phone: "0900000001" }, { name: "Other", phone: "0900000002" }]);
  await Customer.create([{ name: "Literal .*", phone: "0900000001", packageType: "Gym", endDate: new Date("2028-01-01") },
    { name: "Other", phone: "0900000002", packageType: "Gym", endDate: new Date("2028-01-01") }]);
  await AuditLog.create([{ action: "Literal .*" }, { action: "Other" }]);
  expect((await get("/api/v1/products?search=.*")).body).toHaveLength(1);
  expect((await get("/api/v1/leads?search=.*")).body.data).toHaveLength(1);
  expect((await get("/api/v1/checkins/checkin-list?search=.*")).body.data.customers).toHaveLength(1);
  expect((await get("/api/v1/audit-logs?search=.*")).body.data.logs).toHaveLength(1);
});

test.each(["products", "leads", "checkins", "checkins/checkin-list", "audit-logs", "customers"])("%s rejects unsafe pagination and malformed/oversized search", async route => {
  for (const query of ["limit=0", "limit=-1", "page=-1", "page=10001", "limit=1.5", "limit=2oops", "search=a&search=b", `search=${"x".repeat(101)}`]) {
    // The check-in history endpoint has no search parameter; all its pagination cases still apply.
    if (route === "checkins" && query.startsWith("search")) continue;
    const response = await get(`/api/v1/${route}?${query}`);
    expect({ route, query, status: response.status }).toMatchObject({ status: 400 });
  }
});

test("lead pagination retains per-owner authorization and totals", async () => {
  const { user, token: saleToken } = await createTestUserAndGetToken("sale");
  await Lead.create([{ name: "Own 1", phone: "0900000001", assignedSale: user._id }, { name: "Own 2", phone: "0900000002", assignedSale: user._id },
    { name: "Other", phone: "0900000003" }]);
  const result = await request(app).get("/api/v1/leads?limit=1&page=2").set("Authorization", `Bearer ${saleToken}`);
  expect(result.status).toBe(200); expect(result.body.data).toHaveLength(1);
  expect(result.body.pagination).toMatchObject({ page: 2, totalItems: 2, totalPages: 2 });
  expect(result.body.data[0].assignedSale._id).toBe(String(user._id));
});

test("global search rejects negative limits, repeated q and oversized q", async () => {
  for (const query of ["q=test&limit=-1", "q=a&q=b", `q=${"x".repeat(101)}`]) {
    expect((await get(`/api/v1/search?${query}`)).status).toBe(400);
  }
});

test("multipart file, field count and field byte limits return 413 before uploading", async () => {
  const send = () => request(app).post("/api/v1/upload/avatar").set("Authorization", `Bearer ${token}`);
  expect((await send().attach("avatar", Buffer.alloc(5 * 1024 * 1024 + 1), { filename: "avatar.jpg", contentType: "image/jpeg" })).status).toBe(413);
  expect((await send().field("note", "x".repeat(64 * 1024 + 1))).status).toBe(413);
  let fields = send();
  for (let i = 0; i < 21; i++) fields = fields.field(`field${i}`, "value");
  expect((await fields).status).toBe(413);
});

test("candidate overflow fails explicitly without sending a partial face roster", async () => {
  invalidateEmbeddingCache(); faceClient.recognize.mockClear();
  await Customer.insertMany(Array.from({ length: 2001 }, (_, i) => ({ name: `Member ${i}`, code: `KH_LIMIT_${i}`, phone: "0900000000",
    packageType: "Gym", endDate: new Date("2028-01-01"), faceEmbedding: [0.1, 0.2] })));
  const image = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("test-image")]);
  const response = await request(app).post("/api/v1/checkins/recognize").set("Authorization", `Bearer ${token}`)
    .attach("image", image, { filename: "face.jpg", contentType: "image/jpeg" });
  expect(response.status).toBe(503); expect(response.body.code).toBe("FACE_CANDIDATE_LIMIT");
  expect(faceClient.recognize).not.toHaveBeenCalled();
});
