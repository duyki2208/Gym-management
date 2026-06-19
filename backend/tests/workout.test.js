const request = require("supertest");
const app = require("../server");
const Customer = require("../models/Customer");
const CustomerPackage = require("../models/CustomerPackage");
const WorkoutSession = require("../models/WorkoutSession");
const { createTestUserAndGetToken } = require("./testSetup");

describe("Workout Session API Tests", () => {
  let adminToken, staffToken, customerId, packageId;

  beforeEach(async () => {
    // Tạo token người dùng
    const admin = await createTestUserAndGetToken("admin");
    adminToken = admin.token;

    const staff = await createTestUserAndGetToken("reception");
    staffToken = staff.token;

    // Thiết lập dữ liệu khách hàng mẫu có gói PT 12 buổi
    const customer = new Customer({
      name: "Khách hàng PT",
      code: "KH8888",
      phone: "0888888888",
      packageType: "PT 12 Buổi",
      startDate: new Date(),
      endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      remainingSessions: 12
    });
    await customer.save();
    customerId = customer._id;

    const pkg = new CustomerPackage({
      customer: customerId,
      packageName: "PT 12 Buổi",
      startDate: new Date(),
      endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      price: 3600000,
      remainingSessions: 12,
      status: "active"
    });
    await pkg.save();
    packageId = pkg._id;

    customer.activePackage = packageId;
    await customer.save();
  });

  describe("POST /api/v1/workouts/:id/deduct - Trừ buổi tập PT", () => {
    it("Trừ buổi tập thành công và giảm số lượng remainingSessions ở cả Customer và CustomerPackage", async () => {
      const deductData = {
        ptName: "PT Hùng",
        note: "Tập đùi và ngực"
      };

      const res = await request(app)
        .post(`/api/v1/workouts/${customerId}/deduct`)
        .set("Authorization", `Bearer ${staffToken}`)
        .send(deductData);

      expect(res.status).toBe(201);
      expect(res.body.message).toBe("Trừ buổi tập thành công");
      expect(res.body.remainingSessions).toBe(11);

      // Xác minh trong DB
      const updatedCustomer = await Customer.findById(customerId);
      expect(updatedCustomer.remainingSessions).toBe(11);

      const updatedPkg = await CustomerPackage.findById(packageId);
      expect(updatedPkg.remainingSessions).toBe(11);

      const session = await WorkoutSession.findOne({ customer: customerId });
      expect(session).toBeDefined();
      expect(session.ptName).toBe("PT Hùng");
      expect(session.status).toBe("completed");
    });

    it("Trả về lỗi 400 nếu khách hàng đã hết số buổi tập (remainingSessions === 0)", async () => {
      // Set remaining sessions to 0
      await Customer.findByIdAndUpdate(customerId, { remainingSessions: 0 });
      await CustomerPackage.findByIdAndUpdate(packageId, { remainingSessions: 0 });

      const res = await request(app)
        .post(`/api/v1/workouts/${customerId}/deduct`)
        .set("Authorization", `Bearer ${staffToken}`)
        .send({ ptName: "PT Hùng" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Khách hàng đã hết số buổi tập trong hệ thống");
    });
  });

  describe("DELETE /api/v1/workouts/:id - Xóa buổi tập (Hoàn buổi tập)", () => {
    let sessionId;

    beforeEach(async () => {
      // Tạo sẵn 1 buổi tập PT đã tập và trừ còn 11 buổi
      await Customer.findByIdAndUpdate(customerId, { remainingSessions: 11 });
      await CustomerPackage.findByIdAndUpdate(packageId, { remainingSessions: 11 });

      const session = new WorkoutSession({
        customer: customerId,
        ptName: "PT Hùng",
        confirmedBy: (await Customer.findOne())._id, // Lấy đại một ID user hợp lệ
        note: "Tập thử"
      });
      await session.save();
      sessionId = session._id;
    });

    it("Admin xóa buổi tập thành công và khôi phục remainingSessions lên 12", async () => {
      const res = await request(app)
        .delete(`/api/v1/workouts/${sessionId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Xóa buổi tập thành công và đã hoàn lại 1 buổi");
      expect(res.body.remainingSessions).toBe(12);

      // Xác minh buổi tập đã bị xóa khỏi DB
      const dbSession = await WorkoutSession.findById(sessionId);
      expect(dbSession).toBeNull();

      // Xác minh remainingSessions được hoàn lại lên 12
      const updatedCustomer = await Customer.findById(customerId);
      expect(updatedCustomer.remainingSessions).toBe(12);

      const updatedPkg = await CustomerPackage.findById(packageId);
      expect(updatedPkg.remainingSessions).toBe(12);
    });

    it("Trả về 403 nếu nhân viên thường (không phải admin) cố xóa buổi tập", async () => {
      const res = await request(app)
        .delete(`/api/v1/workouts/${sessionId}`)
        .set("Authorization", `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
    });
  });
});
