const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Thư viện vừa cài
const User = require('./models/User'); // Đảm bảo đường dẫn đúng tới Model User
require('dotenv').config();

const dbURL = process.env.MONGO_URI;

const createFirstAdmin = async () => {
  try {
    // 1. Kết nối Database
    if (!dbURL) {
      console.error("❌ Lỗi: Không tìm thấy biến MONGO_URI trong file .env");
      return;
    }
    
    await mongoose.connect(dbURL);
    console.log("--> Đã kết nối Database thành công!");

    // --- THÔNG TIN ADMIN MỚI ---
    const newAdminData = {
      username: "admin",       // Tên đăng nhập
      password: "Duyki0949823609",         // Mật khẩu
      fullName: "Super Admin",
      role: "admin"            // QUAN TRỌNG: Quyền Admin
    };

    // 2. Kiểm tra user đã tồn tại chưa
    const existingUser = await User.findOne({ username: newAdminData.username });
    if (existingUser) {
      console.log(`❌ User [${newAdminData.username}] đã tồn tại. Không tạo mới.`);
      return;
    }

    // 3. Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newAdminData.password, salt);

    // 4. Lưu vào DB
    const newAdmin = new User({
      ...newAdminData,
      password: hashedPassword 
    });

    await newAdmin.save();

    console.log("\n✅ TẠO ADMIN THÀNH CÔNG!");
    console.log(`Username: ${newAdminData.username}`);
    console.log(`Password: ${newAdminData.password}`);
    console.log("--> Hãy dùng tài khoản này để đăng nhập.");

  } catch (error) {
    console.error("❌ Có lỗi xảy ra:", error);
  } finally {
    await mongoose.connection.close();
  }
};

createFirstAdmin();