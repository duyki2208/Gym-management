const mongoose = require('mongoose');
const { initCentralConnection } = require('../db/branchConnectionManager');

let transactionCapable = false;

const getDatabaseTopologyStatus = () => ({
  transactionRequired: String(process.env.REQUIRE_MONGO_TRANSACTIONS || '').toLowerCase() === 'true',
  transactionCapable,
});

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("Chưa tìm thấy biến MONGO_URI trong file .env!");
    }

    // 1. Kết nối default mongoose (hỗ trợ legacy)
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Default Connected: ${conn.connection.host}`);
    const hello = await conn.connection.db.admin().command({ hello: 1 });
    transactionCapable = Boolean(hello.setName || hello.msg === 'isdbgrid');
    if (getDatabaseTopologyStatus().transactionRequired && !transactionCapable) {
      const topologyError = new Error('MongoDB replica set or mongos is required for production transactions');
      topologyError.code = 'MONGO_REPLICA_SET_REQUIRED';
      throw topologyError;
    }

    // 2. Khởi tạo kết nối Central DB (gympro_central)
    await initCentralConnection();

  } catch (error) {
    const connectionError = new Error("Không thể kết nối MongoDB");
    connectionError.name = "DatabaseConnectionError";
    connectionError.code = error.code || "DATABASE_CONNECTION_FAILED";
    throw connectionError;
  }
};

module.exports = connectDB;
module.exports.getDatabaseTopologyStatus = getDatabaseTopologyStatus;
