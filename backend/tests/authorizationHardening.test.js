const express = require("express");
const jwt = require("jsonwebtoken");
const request = require("supertest");

const mockFindById = jest.fn();

jest.mock("../db/branchConnectionManager", () => ({
  getCentralModels: jest.fn().mockResolvedValue({
    CentralUser: { findById: mockFindById },
    LoginIndex: { findOne: jest.fn().mockResolvedValue(null) },
  }),
  getBranchModels: jest.fn().mockResolvedValue({
    User: { findById: mockFindById },
  }),
}));

jest.mock("../controllers/productController", () => ({
  getProducts: jest.fn((req, res) => res.json([])),
  getProductById: jest.fn((req, res) => res.json({})),
  createProduct: jest.fn((req, res) => res.status(201).json({})),
  updateProduct: jest.fn((req, res) => res.json({})),
  deleteProduct: jest.fn((req, res) => res.status(204).end()),
}));

jest.mock("../controllers/inventoryController", () => ({
  createImport: jest.fn((req, res) => res.status(201).json({})),
  getImports: jest.fn((req, res) => res.json([])),
}));

jest.mock("../controllers/posController", () => ({
  createCheckout: jest.fn((req, res) => res.status(201).json({})),
  getSales: jest.fn((req, res) => res.json([])),
  getOrderStatus: jest.fn((req, res) => res.json({ status: "Chờ thanh toán" })),
  confirmPayment: jest.fn((req, res) => res.json({})),
  cancelOrder: jest.fn((req, res) => res.json({})),
  handleWebhook: jest.fn((req, res) => res.json({})),
}));

const productRoutes = require("../routes/productRoutes");
const inventoryRoutes = require("../routes/inventoryRoutes");
const reportRoutes = require("../routes/reportRoutes");
const notificationRoutes = require("../routes/notificationRoutes");
const posRoutes = require("../routes/posRoutes");

const app = express();
app.use(express.json());
app.use("/products", productRoutes);
app.use("/inventory", inventoryRoutes);
app.use("/reports", reportRoutes);
app.use("/notifications", notificationRoutes);
app.use("/pos", posRoutes);

const tokenFor = (role) =>
  jwt.sign(
    { id: `${role}_1`, role, branchCode: "HN01" },
    process.env.JWT_SECRET || "testsecret123"
  );

describe("Authorization hardening regression", () => {
  beforeEach(() => {
    mockFindById.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: "user_1",
        role: "reception",
        isActive: true,
      }),
    });
  });

  test("anonymous POST /products is rejected", async () => {
    await request(app).post("/products").send({ name: "Unsafe product" }).expect(401);
  });

  test("anonymous POST /inventory/import is rejected", async () => {
    await request(app).post("/inventory/import").send({ details: [] }).expect(401);
  });

  test("PT cannot mark a commission period as paid", async () => {
    mockFindById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: "pt_1", role: "pt", isActive: true }),
    });

    await request(app)
      .put("/reports/commission-period/status")
      .set("Authorization", `Bearer ${tokenFor("pt")}`)
      .send({ periodId: "507f1f77bcf86cd799439011", status: "paid" })
      .expect(403);
  });

  test("reception cannot broadcast manual notifications", async () => {
    await request(app)
      .post("/notifications/send-manual")
      .set("Authorization", `Bearer ${tokenFor("reception")}`)
      .send({ targetAudience: "all", subject: "Test", body: "Test" })
      .expect(403);
  });

  test("anonymous users cannot poll an order status", async () => {
    await request(app)
      .get("/pos/order-status/507f1f77bcf86cd799439011")
      .expect(401);
  });

  test("PT cannot manually confirm a POS payment", async () => {
    mockFindById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: "pt_1", role: "pt", isActive: true }),
    });

    await request(app)
      .patch("/pos/orders/507f1f77bcf86cd799439011/confirm")
      .set("Authorization", `Bearer ${tokenFor("pt")}`)
      .expect(403);
  });
});
