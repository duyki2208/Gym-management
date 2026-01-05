const mongoose = require('mongoose');
const User = require('./models/User'); // Đảm bảo đường dẫn đúng
require('dotenv').config();

const dbURL = process.env.MONGO_URI;

const fixRole = async () => {
  try {
    // 1. Kết nối DB
    await mongoose.connect(dbURL);
    console.log("--> Đã kết nối Database thành công!");

    // 2. Lấy danh sách TẤT CẢ user đang có
    const users = await User.find({});
    
    if (users.length === 0) {
      console.log("❌ LỖI: Database của bạn đang TRỐNG RỖNG (chưa có user nào).");
      console.log("--> Hãy quay lại trang web và Đăng ký (Register) một tài khoản trước!");
      return;
    }

    console.log("\n=== DANH SÁCH USER HIỆN CÓ ===");
    users.forEach((u, index) => {
      console.log(`${index + 1}. Username: ${u.username} | Role hiện tại: ${u.role || 'Chưa có'}`);
    });
    console.log("==============================\n");

    // 3. Chọn user để set Admin
    // MẶC ĐỊNH: Lấy user đầu tiên trong danh sách để set làm Admin
    // Nếu bạn muốn chọn người khác, hãy sửa số 0 ở dưới thành 1, 2... tùy ý
    const targetUser = users[0]; 

    console.log(`--> Đang tiến hành cấp quyền ADMIN cho: [ ${targetUser.username} ] ...`);

    // 4. Cập nhật Role
    targetUser.role = "admin";
    await targetUser.save();

    console.log(`\n✅ THÀNH CÔNG RỰC RỠ!`);
    console.log(`User [ ${targetUser.username} ] bây giờ đã là ADMIN.`);
    
  } catch (error) {
    console.error("❌ Có lỗi xảy ra:", error);
  } finally {
    await mongoose.connection.close();
    console.log("--> Đã đóng kết nối.");
  }
};

fixRole();