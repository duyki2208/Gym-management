/**
 * backend/scripts/migrate-to-multibranch.js
 * Script chuyển đổi hệ thống từ Single-DB sang Multi-Branch Architecture
 *
 * Chức năng:
 * 1. Khởi tạo CSDL Trung tâm (gympro_central)
 * 2. Đăng ký các chi nhánh ban đầu (HN01 - Trụ sở Hà Nội, HCM01 - Chi nhánh TP.HCM)
 * 3. Trích xuất tài khoản admin & accountant sang gympro_central.centralusers
 * 4. Tạo bản ghi LoginIndex cho tất cả nhân viên cấp chi nhánh (om, sm, pm, pt, sale, reception)
 * 5. Khởi tạo và đồng bộ compound indexes cho database chi nhánh (gympro_branch_hn01)
 *
 * Chạy: node backend/scripts/migrate-to-multibranch.js
 */
const dotenv = require("dotenv");
dotenv.config();

const mongoose = require("mongoose");
const { initCentralConnection, getCentralModels, getBranchModels } = require("../db/branchConnectionManager");

const migrate = async () => {
  console.log("=== BẮT ĐẦU CHUYỂN ĐỔI SANG KIẾN TRÚC MULTI-BRANCH ===");

  if (!process.env.MONGO_URI) {
    console.error("[LỖI] MONGO_URI chưa được cấu hình trong .env");
    process.exit(1);
  }

  try {
    // 1. Kết nối đến DB cũ để đọc dữ liệu User hiện tại
    console.log("[1/5] Đọc dữ liệu từ Database hiện tại...");
    const legacyConn = await mongoose.createConnection(process.env.MONGO_URI).asPromise();
    
    // Lấy collection users thô từ DB hiện tại
    const legacyUsersCollection = legacyConn.collection("users");
    const legacyUsers = await legacyUsersCollection.find({}).toArray();
    console.log(`  -> Tìm thấy ${legacyUsers.length} tài khoản người dùng trong database gốc.`);

    // 2. Khởi tạo kết nối CSDL Trung tâm (gympro_central)
    console.log("[2/5] Khởi tạo CSDL Trung tâm (gympro_central)...");
    await initCentralConnection();
    const centralModels = await getCentralModels();

    // 3. Khởi tạo các Chi nhánh mặc định trong Central DB
    console.log("[3/5] Đăng ký danh mục Chi nhánh vào gympro_central.branches...");
    const defaultBranches = [
      {
        code: "HN01",
        name: "Cầu Giấy - Hà Nội",
        address: "Số 123 Đường Cầu Giấy, Quận Cầu Giấy, Hà Nội",
        phone: "024.3333.8888",
        hotline: "1900.6868",
        managerName: "Quản lý Cơ sở Cầu Giấy",
        dbName: "gym_management",
        isActive: true,
      },
      {
        code: "HCM01",
        name: "Quận 1 - Hồ Chí Minh",
        address: "Số 456 Đường Nguyễn Thị Minh Khai, Quận 1, TP.HCM",
        phone: "028.7777.9999",
        hotline: "1900.6869",
        managerName: "Quản lý Cơ sở Quận 1",
        dbName: "gympro_branch_hcm01",
        isActive: true,
      },
    ];

    for (const b of defaultBranches) {
      await centralModels.Branch.findOneAndUpdate(
        { code: b.code },
        { $set: b },
        { upsert: true, new: true }
      );
      console.log(`  [OK] Chi nhánh: ${b.name} (${b.code})`);
    }

    // 4. Phân loại tài khoản: CentralUser vs Branch User (LoginIndex)
    console.log("[4/5] Phân loại & đồng bộ tài khoản người dùng...");
    let centralUsersCount = 0;
    let loginIndexCount = 0;

    // Chuẩn bị models cho chi nhánh mặc định HN01
    const hnModels = await getBranchModels("HN01");

    for (const u of legacyUsers) {
      const isCentralRole = u.role === "admin" || u.role === "accountant";

      if (isCentralRole) {
        // Đưa vào gympro_central.centralusers (giữ nguyên _id gốc)
        await centralModels.CentralUser.deleteOne({ username: u.username });
        await centralModels.CentralUser.create({
          _id: u._id,
          username: u.username,
          password: u.password,
          fullName: u.fullName || u.username,
          role: u.role,
          allowedBranches: ["*"],
          phone: u.phone || "",
          isActive: u.isActive !== undefined ? u.isActive : true,
        });
        centralUsersCount++;
        console.log(`  -> CentralUser: ${u.username} (${u.role}) -> gympro_central.centralusers (ID: ${u._id})`);
      } else {
        // Ghi vào gympro_central.loginindexes (tra cứu nhanh username -> HN01)
        await centralModels.LoginIndex.findOneAndUpdate(
          { username: u.username },
          {
            $set: {
              username: u.username,
              branchCode: "HN01",
              role: u.role || "reception",
              userId: u._id,
            },
          },
          { upsert: true, new: true }
        );
        loginIndexCount++;
        console.log(`  -> Branch User: ${u.username} (${u.role}) -> LoginIndex (HN01)`);
      }

      // Đảm bảo User cũng có trong DB branch HN01
      await hnModels.User.findOneAndUpdate(
        { username: u.username },
        {
          $set: {
            username: u.username,
            password: u.password,
            fullName: u.fullName || u.username,
            role: u.role || "reception",
            dob: u.dob,
            phone: u.phone,
            specialty: u.specialty,
            isActive: u.isActive !== undefined ? u.isActive : true,
          },
        },
        { upsert: true }
      );
    }

    // 5. Đồng bộ compound index cho branch HN01
    console.log("[5/5] Tự động áp dụng Compound Indexes cho CSDL chi nhánh gympro_branch_hn01...");
    const { ensureBranchIndexes } = require("../db/branchConnectionManager");
    await ensureBranchIndexes(hnModels);

    console.log("\n=== KẾT QUẢ CHUYỂN ĐỔI (MIGRATION SUMMARY) ===");
    console.log(`- Chi nhánh hoạt động: ${defaultBranches.length} (HN01, HCM01)`);
    console.log(`- Tài khoản Trung tâm (CentralUser): ${centralUsersCount}`);
    console.log(`- Chỉ mục đăng nhập cục bộ (LoginIndex): ${loginIndexCount}`);
    console.log("- Database Trung tâm: gympro_central");
    console.log("- Database Chi nhánh Hà Nội: gympro_branch_hn01");
    console.log("- Trạng thái Compound Indexes: ĐÃ ÁP DỤNG THÀNH CÔNG");
    console.log("================================================");

    await legacyConn.close();
    process.exit(0);
  } catch (error) {
    console.error("[LỖI CHUYỂN ĐỔI]:", error);
    process.exit(1);
  }
};

migrate();
