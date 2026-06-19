const request = require("supertest");
const app = require("../server");
const Customer = require("../models/Customer");
const CustomerPackage = require("../models/CustomerPackage");
const CheckIn = require("../models/CheckIn");
const faceClient = require("../utils/faceServiceClient");
const { invalidateEmbeddingCache } = require("../controllers/checkInController");
const { createTestUserAndGetToken } = require("./testSetup");

describe("CheckIn API Tests", () => {
  let staffToken, customerId, packageId;

  beforeEach(async () => {
    // Xóa cache embedding trước mỗi test case để tránh dữ liệu cũ
    invalidateEmbeddingCache();

    // Tạo token nhân viên
    const staff = await createTestUserAndGetToken("reception");
    staffToken = staff.token;

    // Tạo khách hàng
    const customer = new Customer({
      name: "Hội Viên CheckIn",
      code: "KH6666",
      phone: "0666666666",
      packageType: "Gói 1 Tháng",
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      faceEmbedding: Array(512).fill(0.1) // có embedding để check-in FaceID
    });
    await customer.save();
    customerId = customer._id;

    const pkg = new CustomerPackage({
      customer: customerId,
      packageName: "Gói 1 Tháng",
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      price: 500000,
      status: "active"
    });
    await pkg.save();
    packageId = pkg._id;

    customer.activePackage = packageId;
    await customer.save();
  });

  describe("POST /api/v1/checkins - Check-in thủ công", () => {
    it("Tạo bản ghi check-in thành công", async () => {
      const res = await request(app)
        .post("/api/v1/checkins")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({ customerId: customerId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customerName).toBe("Hội Viên CheckIn");
      expect(res.body.data.customerCode).toBe("KH6666");

      const dbCheckIn = await CheckIn.findOne({ customerId: customerId });
      expect(dbCheckIn).toBeDefined();
    });
  });

  describe("POST /api/v1/checkins/recognize - Check-in tự động (FaceID)", () => {
    it("Nhận diện khuôn mặt thành công và không có cảnh báo đối với gói active", async () => {
      // Mock result match thành công
      faceClient.recognize.mockResolvedValueOnce({
        matched: true,
        member_id: customerId.toString(),
        confidence: 0.92
      });

      const res = await request(app)
        .post("/api/v1/checkins/recognize")
        .set("Authorization", `Bearer ${staffToken}`)
        .attach("image", Buffer.from("fake-image-bytes"), "frame.jpg");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.matched).toBe(true);
      expect(res.body.warning).toBeNull();
      expect(res.body.member.name).toBe("Hội Viên CheckIn");

      // Đảm bảo check-in được lưu vào DB
      const dbCheckIn = await CheckIn.findOne({ customerId: customerId });
      expect(dbCheckIn).toBeDefined();
    });

    it("Trả về cờ cảnh báo 'expired' nếu gói tập của khách hàng đã quá hạn", async () => {
      // Sửa gói tập hết hạn
      await Customer.findByIdAndUpdate(customerId, { endDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) });
      await CustomerPackage.findByIdAndUpdate(packageId, { 
        endDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        status: "expired" 
      });

      faceClient.recognize.mockResolvedValueOnce({
        matched: true,
        member_id: customerId.toString(),
        confidence: 0.95
      });

      const res = await request(app)
        .post("/api/v1/checkins/recognize")
        .set("Authorization", `Bearer ${staffToken}`)
        .attach("image", Buffer.from("fake-image-bytes"), "frame.jpg");

      expect(res.status).toBe(200);
      expect(res.body.matched).toBe(true);
      expect(res.body.warning).toBe("expired");
    });

    it("Trả về cờ cảnh báo 'frozen' nếu gói tập của khách hàng đang bảo lưu", async () => {
      // Sửa gói tập bảo lưu
      await CustomerPackage.findByIdAndUpdate(packageId, { status: "frozen" });

      faceClient.recognize.mockResolvedValueOnce({
        matched: true,
        member_id: customerId.toString(),
        confidence: 0.94
      });

      const res = await request(app)
        .post("/api/v1/checkins/recognize")
        .set("Authorization", `Bearer ${staffToken}`)
        .attach("image", Buffer.from("fake-image-bytes"), "frame.jpg");

      expect(res.status).toBe(200);
      expect(res.body.matched).toBe(true);
      expect(res.body.warning).toBe("frozen");
    });
  });
});
