const request = require("supertest");
const app = require("../server");
const Customer = require("../models/Customer");
const CustomerPackage = require("../models/CustomerPackage");
const Lead = require("../models/Lead");
const WorkoutSession = require("../models/WorkoutSession");
const CommissionPeriod = require("../models/CommissionPeriod");
const { createTestUserAndGetToken } = require("./testSetup");

describe("Reports & Excel Export API", () => {
  let adminToken;

  beforeEach(async () => {
    const admin = await createTestUserAndGetToken("admin");
    adminToken = admin.token;
  });

  describe("GET /api/v1/customers/export-excel", () => {
    it("xuất file Excel danh sách khách hàng thành công", async () => {
      const res = await request(app)
        .get("/api/v1/customers/export-excel")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("spreadsheetml.sheet");
    });
  });

  describe("GET /api/v1/reports/pt-sessions", () => {
    it("lấy báo cáo đối soát buổi tập PT thành công", async () => {
      const res = await request(app)
        .get("/api/v1/reports/pt-sessions?month=7&year=2026")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("totalSessions");
      expect(res.body.data).toHaveProperty("estimatedCommission");
    });
  });

  describe("GET /api/v1/reports/leads-conversion", () => {
    it("lấy báo cáo phễu chuyển đổi Lead thành công", async () => {
      await Lead.create({
        name: "Nguyễn Văn Lead",
        phone: "0912345678",
        source: "facebook",
        status: "converted",
      });

      const res = await request(app)
        .get("/api/v1/reports/leads-conversion")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalLeads).toBeGreaterThanOrEqual(1);
    });
  });

  describe("GET /api/v1/reports/contract-status-breakdown", () => {
    it("lấy báo cáo tỷ lệ loại hợp đồng thành công", async () => {
      const res = await request(app)
        .get("/api/v1/reports/contract-status-breakdown")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("statusChartData");
    });
  });
});
