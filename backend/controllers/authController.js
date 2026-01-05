const User = require('../models/User'); // Đảm bảo đường dẫn đúng
const bcrypt = require('bcryptjs'); // Nhớ import cái này
const jwt = require('jsonwebtoken'); // Nếu bạn có dùng JWT

const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Tìm user trong DB
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: "Tài khoản không tồn tại!" });
    }

    // 2. SO SÁNH MẬT KHẨU (PHẦN QUAN TRỌNG NHẤT)
    // Dùng bcrypt.compare để so sánh mật khẩu nhập vào (plain) với mật khẩu trong DB (hashed)
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Mật khẩu không đúng!" });
    }

    // 3. Nếu đúng hết thì trả về thông tin user và Token (nếu có)
    // Tùy vào cách bạn tạo token, đây là ví dụ cơ bản:
    const token = jwt.sign(
      { id: user._id, role: user.role }, 
      process.env.JWT_SECRET || "secret_key_tam_thoi", // Nhớ cấu hình cái này trong .env
      { expiresIn: '1d' }
    );

    // Trả về cho Frontend
    res.status(200).json({
      message: "Đăng nhập thành công",
      token,
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        role: user.role // Quan trọng để FE phân quyền
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi Server" });
  }
};

module.exports = { loginUser };