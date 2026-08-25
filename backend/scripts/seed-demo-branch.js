/**
 * backend/scripts/seed-demo-branch.js
 * Script tạo dữ liệu giả lập cho Chi nhánh TP.HCM (HCM01) phục vụ demo liên chi nhánh
 *
 * Chức năng:
 * 1. Đăng ký nhân viên chi nhánh HCM01 (sm, pt, sale, reception)
 * 2. Cập nhật LoginIndex ở Central DB
 * 3. Tạo 20-30 Hội viên mẫu với các gói tập khác nhau
 * 4. Tạo lịch sử Check-in và Hóa đơn POS mẫu
 * 5. Tự động áp dụng toàn bộ Compound Indexes cho gympro_branch_hcm01
 *
 * Chạy: node backend/scripts/seed-demo-branch.js
 */
const dotenv = require("dotenv");
dotenv.config();

const bcrypt = require("bcryptjs");
const { initCentralConnection, getCentralModels, getBranchModels, ensureBranchIndexes } = require("../db/branchConnectionManager");

const seedDemoBranch = async () => {
  console.log("=== BẮT ĐẦU SEED DỮ LIỆU DEMO CHI NHÁNH TP.HCM (HCM01) ===");

  try {
    await initCentralConnection();
    const centralModels = await getCentralModels();
    const hcmModels = await getBranchModels("HCM01");

    // 1. Tạo nhân viên mẫu chi nhánh HCM01
    console.log("[1/4] Khởi tạo nhân sự cơ sở HCM01...");
    const salt = await bcrypt.genSalt(10);
    const defaultPassword = await bcrypt.hash("123456", salt);

    const staffList = [
      { username: "manager_hcm", fullName: "Nguyễn Văn Hùng", role: "sm", phone: "0901112233" },
      { username: "sale_hcm_01", fullName: "Trần Thị Mai", role: "sale", phone: "0902223344" },
      { username: "pt_hcm_01", fullName: "Lê Hoàng Nam (PT)", role: "pt", phone: "0903334455", specialty: "Tăng cơ - Giảm mỡ" },
      { username: "reception_hcm_01", fullName: "Phạm Quỳnh Chi", role: "reception", phone: "0904445566" },
    ];

    const createdStaff = [];
    for (const s of staffList) {
      const user = await hcmModels.User.findOneAndUpdate(
        { username: s.username },
        {
          $set: {
            username: s.username,
            password: defaultPassword,
            fullName: s.fullName,
            role: s.role,
            phone: s.phone,
            specialty: s.specialty || "",
            isActive: true,
          },
        },
        { upsert: true, new: true }
      );

      // Đăng ký vào Central LoginIndex
      await centralModels.LoginIndex.findOneAndUpdate(
        { username: s.username },
        {
          $set: {
            username: s.username,
            branchCode: "HCM01",
            role: s.role,
            userId: user._id,
          },
        },
        { upsert: true }
      );

      createdStaff.push(user);
      console.log(`  [Staff OK] ${s.fullName} (${s.username}) -> HCM01`);
    }

    // 2. Tạo bảng giá gói tập cho HCM01
    console.log("[2/4] Tạo bảng giá gói tập riêng tại cơ sở HCM01...");
    const packageTemplates = [
      { name: "Gói 1 Tháng HCM", type: "monthly", duration: 30, price: 650000 },
      { name: "Gói 3 Tháng HCM", type: "monthly", duration: 90, price: 1800000 },
      { name: "Gói 1 Năm VIP HCM", type: "monthly", duration: 365, price: 6000000 },
      { name: "Gói PT 12 Buổi HCM", type: "session", duration: 60, sessions: 12, price: 4200000 },
    ];

    for (const p of packageTemplates) {
      await hcmModels.Package.findOneAndUpdate(
        { name: p.name },
        { $set: p },
        { upsert: true }
      );
    }

    // 3. Tạo Hội viên mẫu tại HCM01
    console.log("[3/4] Tạo 15 khách hàng & gói tập mẫu tại cơ sở HCM01...");
    const sampleNames = [
      "Nguyễn Minh Anh", "Lê Quốc Bảo", "Trần Hoài An", "Vũ Tuấn Kiệt",
      "Đặng Thanh Trúc", "Phan Gia Huy", "Bùi Khánh Linh", "Đỗ Nhật Minh",
      "Hoàng Kim Ngân", "Ngô Đức Trọng", "Lý Hải Đăng", "Dương Ngọc Hân",
      "Phạm Văn Thắng", "Võ Mỹ Duyên", "Trịnh Đình Quang"
    ];

    const ptUser = createdStaff.find((s) => s.role === "pt");
    const saleUser = createdStaff.find((s) => s.role === "sale");

    for (let i = 0; i < sampleNames.length; i++) {
      const name = sampleNames[i];
      const phone = `0987${String(i + 1).padStart(6, "0")}`;
      const code = `KH-HCM-${String(i + 1).padStart(4, "0")}`;
      const startDate = new Date(Date.now() - (i % 20) * 24 * 3600 * 1000);
      const endDate = new Date(startDate.getTime() + 90 * 24 * 3600 * 1000);

      const customer = await hcmModels.Customer.findOneAndUpdate(
        { phone },
        {
          $set: {
            name,
            code,
            phone,
            gender: i % 2 === 0 ? "Nam" : "Nữ",
            packageType: i % 3 === 0 ? "Gói PT 12 Buổi HCM" : "Gói 3 Tháng HCM",
            startDate,
            endDate,
            trainer: i % 3 === 0 ? ptUser?._id : null,
            assignedStaff: saleUser?._id,
            price: i % 3 === 0 ? 4200000 : 1800000,
            remainingSessions: i % 3 === 0 ? 10 : 0,
            paymentStatus: "paid",
            source: "facebook",
            contractCode: `HĐ-HCM-${String(i + 1).padStart(4, "0")}`,
          },
        },
        { upsert: true, new: true }
      );

      const customerPackage = await hcmModels.CustomerPackage.findOneAndUpdate(
        { customer: customer._id },
        {
          $set: {
            customer: customer._id,
            packageName: customer.packageType,
            startDate,
            endDate,
            price: customer.price,
            contractCode: customer.contractCode,
            status: "active",
            trainer: customer.trainer,
            assignedStaff: customer.assignedStaff,
            remainingSessions: customer.remainingSessions,
            paymentStatus: "paid",
            paidAmount: customer.price,
          },
        },
        { upsert: true, new: true }
      );

      customer.activePackage = customerPackage._id;
      await customer.save();

      // Tạo một số lượt Check-in mẫu
      if (i % 2 === 0) {
        await hcmModels.CheckIn.create({
          customerId: customer._id,
          customerName: customer.name,
          customerCode: customer.code,
          packageType: customer.packageType,
          time: new Date(Date.now() - (i * 2) * 3600 * 1000),
        });
      }
    }

    // 4. Áp dụng toàn bộ Compound Indexes cho gympro_branch_hcm01
    console.log("[4/4] Áp dụng Compound Indexes cho CSDL gympro_branch_hcm01...");
    await ensureBranchIndexes(hcmModels);

    console.log("\n=== HOÀN TẤT SEED CHI NHÁNH TP.HCM (HCM01) ===");
    console.log("- Database: gympro_branch_hcm01");
    console.log(`- Nhân viên: ${staffList.length} tài khoản (Pass mặc định: 123456)`);
    console.log(`- Hội viên: ${sampleNames.length} hội viên đang hoạt động`);
    console.log("- Compound Indexes: ĐÃ ĐỒNG BỘ ĐẦY ĐỦ");
    console.log("================================================");

    process.exit(0);
  } catch (error) {
    console.error("[LỖI SEED HCM01]:", error);
    process.exit(1);
  }
};

seedDemoBranch();
