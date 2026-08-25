/**
 * backend/scripts/test-multibranch.js
 * Automated Verification Script for Multi-Branch Architecture
 *
 * Chạy: node backend/scripts/test-multibranch.js
 */
const dotenv = require("dotenv");
dotenv.config();

const mongoose = require("mongoose");
const { initCentralConnection, getCentralModels, getBranchModels } = require("../db/branchConnectionManager");
const { generateAccessToken, generateRefreshToken, hashToken } = require("../utils/generateTokens");
const bcrypt = require("bcryptjs");

const runTests = async () => {
  console.log("==================================================");
  console.log("  KIỂM THỬ TỰ ĐỘNG KIẾN TRÚC MULTI-BRANCH (GYMPRO)");
  console.log("==================================================");

  let passedTests = 0;
  let totalTests = 0;

  const assert = (condition, testName) => {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] Test ${totalTests}: ${testName}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] Test ${totalTests}: ${testName}`);
    }
  };

  try {
    // 1. Test Central Connection & Models
    console.log("\n1. Kiểm tra Khởi tạo Central DB & Models:");
    await initCentralConnection();
    const centralModels = await getCentralModels();
    assert(centralModels.Branch !== undefined, "Central Model 'Branch' đã được nạp");
    assert(centralModels.CentralUser !== undefined, "Central Model 'CentralUser' đã được nạp");
    assert(centralModels.LoginIndex !== undefined, "Central Model 'LoginIndex' đã được nạp");

    // 2. Test Branch Connection & Schema Isolation
    console.log("\n2. Kiểm tra Dynamic Branch Connection & Isolation:");
    const hnModels = await getBranchModels("HN01");
    const hcmModels = await getBranchModels("HCM01");

    assert(hnModels.dbName === "gym_management", "Branch HN01 map đúng DB gốc chứa dữ liệu: gym_management");
    assert(hcmModels.dbName === "gympro_branch_hcm01", "Branch HCM01 map đúng DB: gympro_branch_hcm01");

    const existingHNCustomers = await hnModels.Customer.countDocuments();
    console.log(`  -> Số lượng hội viên hiện có tại cơ sở HN01 (gym_management): ${existingHNCustomers}`);
    assert(existingHNCustomers >= 0, "Đã kết nối và đọc thành công dữ liệu từ DB HN01");

    // Tạo bản ghi test tại HN01
    const testPhoneHN = `0999${Date.now().toString().slice(-6)}`;
    const custHN = await hnModels.Customer.create({
      name: "Khách Hàng Test HN",
      phone: testPhoneHN,
      packageType: "Gói Test HN",
      endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    });

    // Xác minh bản ghi tại HN01 không xuất hiện trong HCM01
    const searchInHCM = await hcmModels.Customer.findOne({ phone: testPhoneHN });
    assert(searchInHCM === null, "Dữ liệu HN01 hoàn toàn cô lập, không xuất hiện trong HCM01");

    const searchInHN = await hnModels.Customer.findOne({ phone: testPhoneHN });
    assert(searchInHN !== null && searchInHN.name === "Khách Hàng Test HN", "Dữ liệu đọc chính xác từ DB HN01");

    // Dọn dẹp bản ghi test
    await hnModels.Customer.findByIdAndDelete(custHN._id);

    // 3. Test 1-Step Auth & Token Generation
    console.log("\n3. Kiểm tra Cơ chế 1-Step Auth & Token Multi-Branch:");
    const branchToken = generateAccessToken("user_123", "reception", { branchCode: "HN01", isCentral: false });
    const jwt = require("jsonwebtoken");
    const decodedBranch = jwt.verify(branchToken, process.env.JWT_SECRET);
    assert(decodedBranch.branchCode === "HN01" && decodedBranch.isCentral === false, "Branch Access Token mang đúng branchCode HN01 và isCentral=false");

    const centralToken = generateAccessToken("admin_123", "admin", { allowedBranches: ["*"], activeBranch: "HN01", isCentral: true });
    const decodedCentral = jwt.verify(centralToken, process.env.JWT_SECRET);
    assert(decodedCentral.isCentral === true && decodedCentral.activeBranch === "HN01", "Central Access Token mang đúng activeBranch và isCentral=true");

    // 4. Test Saga Chuyển Cơ Sở (Branch Transfer)
    console.log("\n4. Kiểm tra Saga 5 Bước Chuyển Cơ Sở (Clone/Snapshot):");
    const transferPhone = `0988${Date.now().toString().slice(-6)}`;
    
    // B1: Tạo Customer & Package ở HN01
    const sourceCust = await hnModels.Customer.create({
      name: "Nguyễn Văn Chuyển Nhượng",
      phone: transferPhone,
      packageType: "Gói 1 Năm VIP",
      endDate: new Date(Date.now() + 180 * 24 * 3600 * 1000),
      remainingSessions: 20,
      price: 5000000,
    });

    const sourcePkg = await hnModels.CustomerPackage.create({
      customer: sourceCust._id,
      packageName: "Gói 1 Năm VIP",
      startDate: new Date(),
      endDate: sourceCust.endDate,
      price: 5000000,
      remainingSessions: 20,
      status: "active",
      transferStatus: "none",
    });

    sourceCust.activePackage = sourcePkg._id;
    await sourceCust.save();

    // B2: Thực hiện Saga chuyển sang HCM01
    sourcePkg.transferStatus = "transfer_pending";
    sourcePkg.branchTransferredTo = "HCM01";
    await sourcePkg.save();

    const targetCust = await hcmModels.Customer.create({
      name: sourceCust.name,
      phone: sourceCust.phone,
      packageType: sourcePkg.packageName,
      startDate: new Date(),
      endDate: sourcePkg.endDate,
      remainingSessions: sourcePkg.remainingSessions,
      contractType: "transfer",
      source: "branch_transfer",
    });

    const targetPkg = await hcmModels.CustomerPackage.create({
      customer: targetCust._id,
      packageName: sourcePkg.packageName,
      startDate: new Date(),
      endDate: sourcePkg.endDate,
      price: sourcePkg.price,
      remainingSessions: sourcePkg.remainingSessions,
      status: "active",
      transferStatus: "none",
      branchTransferredFrom: "HN01",
      contractType: "transfer",
    });

    targetCust.activePackage = targetPkg._id;
    await targetCust.save();

    sourcePkg.transferStatus = "transferred_out";
    sourcePkg.status = "transferred";
    sourcePkg.transferredTo = targetPkg._id;
    await sourcePkg.save();

    // B3: Kiểm tra kết quả Saga
    const verifiedSourcePkg = await hnModels.CustomerPackage.findById(sourcePkg._id);
    const verifiedTargetPkg = await hcmModels.CustomerPackage.findById(targetPkg._id);
    const verifiedTargetCust = await hcmModels.Customer.findById(targetCust._id);

    assert(verifiedSourcePkg.transferStatus === "transferred_out" && verifiedSourcePkg.status === "transferred", "Gói cũ tại HN01 đã khóa và đổi trạng thái transferred_out");
    assert(verifiedTargetPkg.status === "active" && verifiedTargetPkg.branchTransferredFrom === "HN01", "Gói mới tại HCM01 đã kích hoạt kế thừa ngày/buổi tập");
    assert(verifiedTargetCust.remainingSessions === 20, "Hội viên tại HCM01 kế thừa chính xác 20 buổi tập còn lại");

    // Dọn dẹp dữ liệu test transfer
    await hnModels.CustomerPackage.findByIdAndDelete(sourcePkg._id);
    await hnModels.Customer.findByIdAndDelete(sourceCust._id);
    await hcmModels.CustomerPackage.findByIdAndDelete(targetPkg._id);
    await hcmModels.Customer.findByIdAndDelete(targetCust._id);

    // 5. Test Compound Indexes Verification
    console.log("\n5. Kiểm tra Compound Indexes:");
    const hnCustomerIndexes = await hnModels.Customer.collection.indexes();
    const hasPhoneDeletedIndex = hnCustomerIndexes.some(
      (idx) => idx.key && idx.key.phone === 1 && idx.key.isDeleted === 1
    );
    assert(hasPhoneDeletedIndex, "Compound Index { phone: 1, isDeleted: 1 } tồn tại trên Customer collection");

    console.log("\n==================================================");
    console.log(`  KẾT QUẢ: ĐÃ VƯỢT QUA ${passedTests}/${totalTests} TESTS (${Math.round((passedTests / totalTests) * 100)}%)`);
    console.log("==================================================");

    process.exit(passedTests === totalTests ? 0 : 1);
  } catch (error) {
    console.error("\n[TEST LỖI]:", error);
    process.exit(1);
  }
};

runTests();
