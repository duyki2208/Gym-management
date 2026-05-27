require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Customer = require("../models/Customer");
const CustomerPackage = require("../models/CustomerPackage");

async function migrate() {
  console.log("=== BẮT ĐẦU DI TRÚ DỮ LIỆU HỘI VIÊN CŨ ===");
  await connectDB();

  try {
    const customers = await Customer.find({});
    console.log(`Tìm thấy tổng cộng ${customers.length} khách hàng trong database.`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const customer of customers) {
      // Kiểm tra xem khách hàng này đã có gói tập nào trong CustomerPackage chưa
      const existingPackage = await CustomerPackage.findOne({ customer: customer._id });

      if (existingPackage) {
        skippedCount++;
        // Nếu đã có gói tập nhưng chưa liên kết activePackage trên Customer, cập nhật liên kết
        if (!customer.activePackage) {
          customer.activePackage = existingPackage._id;
          await customer.save();
        }
        continue;
      }

      // Nếu chưa có, tạo mới gói tập dựa trên thông tin gói cũ của Customer
      const packageName = customer.packageType || "Gói Mặc Định";
      const startDate = customer.startDate || customer.createdAt || new Date();
      const endDate = customer.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      
      let status = "active";
      const now = new Date();
      if (endDate < now) {
        status = "expired";
      }

      const newPackage = new CustomerPackage({
        customer: customer._id,
        packageName: packageName,
        startDate: startDate,
        endDate: endDate,
        price: customer.price || 0,
        remainingSessions: customer.remainingSessions || 0,
        trainer: customer.trainer || "",
        assignedStaff: customer.assignedStaff || undefined,
        hasLocker: customer.hasLocker || false,
        hasWater: customer.hasWater || false,
        contractType: customer.contractType || "new",
        paymentStatus: customer.paymentStatus || "paid",
        paidAmount: customer.paidAmount || customer.price || 0,
        status: status,
      });

      await newPackage.save();

      // Cập nhật liên kết trên Customer
      customer.activePackage = newPackage._id;
      await customer.save();
      
      migratedCount++;
    }

    console.log(`\n=== DI TRÚ HOÀN THÀNH ===`);
    console.log(`- Đã tạo gói tập cho: ${migratedCount} hội viên cũ.`);
    console.log(`- Bỏ qua (đã có gói tập): ${skippedCount} hội viên.`);

  } catch (error) {
    console.error("Lỗi khi di trú dữ liệu:", error);
  } finally {
    await mongoose.connection.close();
    console.log("Đã đóng kết nối MongoDB.");
  }
}

migrate();
