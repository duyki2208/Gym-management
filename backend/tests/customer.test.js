const request = require("supertest");
const app = require("../server");
const Customer = require("../models/Customer");
const CustomerPackage = require("../models/CustomerPackage");
const { createTestUserAndGetToken } = require("./testSetup");

describe("Customer API Tests", () => {
  let adminToken, staffToken;
  let testCustomerPackage;

  beforeEach(async () => {
    // Tạo user giả lập cho test
    const admin = await createTestUserAndGetToken("admin");
    adminToken = admin.token;

    const staff = await createTestUserAndGetToken("reception");
    staffToken = staff.token;
  });

  describe("POST /api/v1/customers - Tạo khách hàng mới", () => {
    it("Tạo khách hàng và gói tập kèm hóa đơn thành công nếu có đủ quyền admin", async () => {
      const customerData = {
        name: "Nguyễn Văn A",
        phone: "0987654321",
        dob: "1995-10-15",
        gender: "male",
        address: "123 Đường Lớn, Hà Nội",
        packageType: "Gói 3 Tháng",
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        price: 1500000,
        paidAmount: 1500000,
        paymentStatus: "paid",
        contractType: "new",
        contractCode: "HD0001",
        remainingSessions: 0
      };

      const res = await request(app)
        .post("/api/v1/customers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(customerData);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("_id");
      expect(res.body.name).toBe("Nguyễn Văn A");
      expect(res.body.phone).toBe("0987654321");
      expect(res.body.packageType).toBe("Gói 3 Tháng");

      // Kiểm tra DB xem customer và customerPackage có được tạo đồng thời
      const dbCustomer = await Customer.findOne({ phone: "0987654321" });
      expect(dbCustomer).toBeDefined();
      expect(dbCustomer.name).toBe("Nguyễn Văn A");

      const dbPackage = await CustomerPackage.findOne({ customer: dbCustomer._id });
      expect(dbPackage).toBeDefined();
      expect(dbPackage.packageName).toBe("Gói 3 Tháng");
      expect(dbPackage.status).toBe("active");
    });

    it("Trả về 403 nếu quyền không đủ (ví dụ PT không thể tạo khách hàng)", async () => {
      const pt = await createTestUserAndGetToken("pt");
      const res = await request(app)
        .post("/api/v1/customers")
        .set("Authorization", `Bearer ${pt.token}`)
        .send({ name: "Hội Viên Mới", phone: "0123456789" });

      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/v1/customers/:id/freeze - Bảo lưu gói tập", () => {
    let customerId, packageId;

    beforeEach(async () => {
      // Setup sẵn một khách hàng và gói tập active
      const customer = new Customer({
        name: "Hội Viên Test",
        code: "KH9999",
        phone: "0909090909",
        packageType: "Gói 1 Tháng",
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      await customer.save();
      customerId = customer._id;

      const pkg = new CustomerPackage({
        customer: customerId,
        packageName: "Gói 1 Tháng",
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        price: 500000,
        status: "active",
      });
      await pkg.save();
      packageId = pkg._id;

      customer.activePackage = packageId;
      await customer.save();
    });

    it("Bảo lưu gói tập thành công và cộng thêm ngày vào endDate", async () => {
      const nowMs = Date.now();
      const freezeData = {
        startDate: new Date(nowMs).toISOString(),
        endDate: new Date(nowMs + 10 * 24 * 60 * 60 * 1000).toISOString(), // Bảo lưu 10 ngày
        reason: "Bận đi học quân sự"
      };

      const originalPkg = await CustomerPackage.findById(packageId);
      const originalEndDate = new Date(originalPkg.endDate).getTime();

      const res = await request(app)
        .post(`/api/v1/customers/${packageId}/freeze`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(freezeData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("frozen");

      // Kiểm tra xem hạn gói tập ở DB có được cộng thêm 10 ngày
      const updatedPkg = await CustomerPackage.findById(packageId);
      expect(updatedPkg.status).toBe("frozen");
      expect(updatedPkg.frozenPeriods).toHaveLength(1);
      expect(updatedPkg.frozenPeriods[0].reason).toBe("Bận đi học quân sự");

      const newEndDate = new Date(updatedPkg.endDate).getTime();
      const diffDays = Math.round((newEndDate - originalEndDate) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(10);
    });
  });

  describe("POST /api/v1/customers/:id/unfreeze - Hủy bảo lưu / Kích hoạt lại", () => {
    let customerId, packageId, freezeStart, freezeEnd;

    beforeEach(async () => {
      customerId = new Customer({
        name: "Hội Viên Frozen",
        code: "KH7777",
        phone: "0777777777",
        packageType: "Gói 1 Tháng",
        startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000), // đã cộng 15 ngày bảo lưu
      });
      await customerId.save();

      freezeStart = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 60 * 1000); // bắt đầu bảo lưu 2 ngày trước (bù 1 phút tránh lệch ms)
      freezeEnd = new Date(Date.now() + 13 * 24 * 60 * 60 * 1000); // dự kiến bảo lưu 15 ngày

      const pkg = new CustomerPackage({
        customer: customerId._id,
        packageName: "Gói 1 Tháng",
        startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
        price: 500000,
        status: "frozen",
        frozenPeriods: [{
          startDate: freezeStart,
          endDate: freezeEnd,
          reason: "Yêu cầu bảo lưu"
        }]
      });
      await pkg.save();
      packageId = pkg._id;

      customerId.activePackage = packageId;
      await customerId.save();
    });

    it("Kích hoạt lại gói tập thành công và hiệu chỉnh endDate theo thời gian thực tế", async () => {
      // Kích hoạt lại vào ngày hôm nay (tức là chỉ bảo lưu thực tế 2 ngày thay vì 15 ngày dự kiến)
      // Dư ra 13 ngày bảo lưu chưa dùng, cần trừ lại 13 ngày này khỏi endDate
      const unfreezeData = {
        actualUnfreezeDate: new Date().toISOString()
      };

      const pkgBefore = await CustomerPackage.findById(packageId);
      const endBefore = new Date(pkgBefore.endDate).getTime();

      const res = await request(app)
        .post(`/api/v1/customers/${packageId}/unfreeze`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(unfreezeData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("active");

      const pkgAfter = await CustomerPackage.findById(packageId);
      expect(pkgAfter.status).toBe("active");
      
      // Ngày hết hạn mới phải sớm hơn ngày hết hạn cũ khoảng 13 ngày
      const endAfter = new Date(pkgAfter.endDate).getTime();
      const diffDays = Math.ceil((endBefore - endAfter) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(13);
    });
  });

  describe("DELETE /api/v1/customers/:id - Xóa hội viên mềm và thu hồi quà giới thiệu", () => {
    let referrerId, referrerPkgId, customerId, packageId;

    beforeEach(async () => {
      // 1. Tạo người giới thiệu A
      const referrer = new Customer({
        name: "Người Giới Thiệu A",
        code: "KH8881",
        phone: "0888111111",
        packageType: "Gói 3 Tháng",
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });
      await referrer.save();
      referrerId = referrer._id;

      const referrerPkg = new CustomerPackage({
        customer: referrerId,
        packageName: "Gói 3 Tháng",
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        price: 1500000,
        status: "active",
      });
      await referrerPkg.save();
      referrerPkgId = referrerPkg._id;

      referrer.activePackage = referrerPkgId;
      await referrer.save();

      // 2. Tạo hội viên mới B được A giới thiệu
      const customerData = {
        name: "Hội Viên B",
        phone: "0999222222",
        dob: "1998-05-20",
        gender: "female",
        packageType: "Gói 1 Tháng",
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        price: 500000,
        paidAmount: 500000,
        paymentStatus: "paid",
        contractType: "new",
        contractCode: "HD0002",
        referredBy: referrerId.toString(),
        source: "referral",
      };

      const res = await request(app)
        .post("/api/v1/customers")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(customerData);

      expect(res.status).toBe(201);
      customerId = res.body.customerId;
      packageId = res.body._id;
    });

    it("Xóa mềm gói tập và hội viên, đồng thời thu hồi 30 ngày thưởng của người giới thiệu", async () => {
      // Xác nhận người giới thiệu đã được cộng 30 ngày
      const refPkgBefore = await CustomerPackage.findById(referrerPkgId);
      const originalEndDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      const addedEndDate = new Date(refPkgBefore.endDate);
      const diffDaysBefore = Math.ceil((addedEndDate.getTime() - originalEndDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDaysBefore).toBe(30);
      const createdCustomer = await Customer.findById(customerId);
      const customerCode = createdCustomer.code;
      expect(refPkgBefore.packageNote).toContain(`+1T giới thiệu HV(${customerCode})`);

      // Thực hiện xóa
      const res = await request(app)
        .delete(`/api/v1/customers/${packageId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Đã xóa gói tập thành công");

      // Kiểm tra gói tập của B đã bị xóa mềm
      const pkgAfter = await CustomerPackage.findById(packageId);
      expect(pkgAfter).toBeNull();

      const rawPkg = await CustomerPackage.findOne({ _id: packageId }).setOptions({ withDeleted: true });
      expect(rawPkg.isDeleted).toBe(true);

      const rawCust = await Customer.findOne({ _id: customerId }).setOptions({ withDeleted: true });
      expect(rawCust.isDeleted).toBe(true);

      // Kiểm tra người giới thiệu đã bị thu hồi 30 ngày và xóa ghi chú
      const refPkgAfter = await CustomerPackage.findById(referrerPkgId);
      const endAfter = new Date(refPkgAfter.endDate);
      const diffDaysAfter = Math.round((endAfter.getTime() - originalEndDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(Math.abs(diffDaysAfter)).toBe(0); // Trở về hạn ban đầu
      expect(refPkgAfter.packageNote).not.toContain(`+1T giới thiệu HV(${customerCode})`);
    });
  });
});
