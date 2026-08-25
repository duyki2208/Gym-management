const mongoose = require('mongoose');
const { initCentralConnection } = require('../db/branchConnectionManager');

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("Chưa tìm thấy biến MONGO_URI trong file .env!");
    }

    // 1. Kết nối default mongoose (hỗ trợ legacy)
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Default Connected: ${conn.connection.host}`);

    // 2. Khởi tạo kết nối Central DB (gympro_central)
    await initCentralConnection();

  } catch (error) {
    console.error(`Lỗi kết nối MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;