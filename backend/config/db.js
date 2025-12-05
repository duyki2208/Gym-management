const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Debug: In ra xem nó đọc được gì từ file .env
    console.log("Đang thử kết nối tới:", process.env.MONGO_URI);

    // Kiểm tra nếu chưa có URI
    if (!process.env.MONGO_URI) {
      throw new Error("Chưa tìm thấy biến MONGO_URI trong file .env!");
    }

    // Kết nối (Bỏ luôn đoạn || localhost để tránh nhầm lẫn)
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Lỗi kết nối MongoDB: ${error.message}`);
    // Nếu lỗi này hiện ra, nghĩa là file .env chưa được đọc đúng
    process.exit(1);
  }
};

module.exports = connectDB;