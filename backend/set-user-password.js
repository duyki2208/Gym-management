const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI;

// Lấy tham số từ dòng lệnh: node set-user-password.js <username> <new_password>
const args = process.argv.slice(2);
const targetUsername = args[0];
const newPassword = args[1];

if (!targetUsername || !newPassword) {
  console.log('Cách dùng: node set-user-password.js <username> <mật_khẩu_mới>');
  process.exit(1);
}

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected!');

    const user = await User.findOne({ username: targetUsername });
    if (!user) {
      console.error(`❌ Không tìm thấy người dùng có username: "${targetUsername}"`);
      process.exit(1);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    user.password = hashedPassword;
    await user.save();

    console.log(`✅ Đã đổi mật khẩu thành công cho tài khoản "${targetUsername}"!`);
  } catch (err) {
    console.error('❌ Lỗi:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected!');
  }
}

run();
