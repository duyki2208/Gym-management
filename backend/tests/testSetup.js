const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

let mongoServer;

// Windows CI/desktop hosts can take over 30 seconds to spawn mongod when the
// binary is cold or antivirus is scanning it. Keep the suite deterministic
// without weakening individual assertions.
jest.setTimeout(60000);

// Khởi chạy cơ sở dữ liệu giả lập trong RAM trước khi chạy các file test
beforeAll(async () => {
  const useReplicaSet = process.env.TEST_MONGO_REPLICA_SET === "true";
  mongoServer = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000, ...(useReplicaSet ? { replSet: "reviewTests" } : {}) },
  });
  // HN01 resolves to the database name from MONGO_URI. Keeping the default
  // mongoose connection on the same database makes legacy model proxies and
  // request-scoped branch models observe the same test data.
  let mongoUri = mongoServer.getUri("gym_management");
  if (useReplicaSet) {
    // Use the same driver as Mongoose for replica initialization and application queries.
    const bootstrap = await mongoose.createConnection(`${mongoUri}?directConnection=true`).asPromise();
    try {
      await bootstrap.db.admin().command({ replSetInitiate: {
        _id: "reviewTests", members: [{ _id: 0, host: new URL(mongoUri).host }],
      } });
    } finally {
      await bootstrap.close();
    }
    mongoUri += "?replicaSet=reviewTests";
  }
  
  // Gán URI giả lập vào environment để connectDB đọc
  process.env.MONGO_URI = mongoUri;
  process.env.JWT_SECRET = "testsecret123";
  process.env.NODE_ENV = "test";
  
  // Đóng kết nối cũ nếu có
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  await mongoose.connect(mongoUri);
});

// Đóng kết nối và tắt Mongo ảo sau khi kết thúc toàn bộ test
afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

// Dọn dẹp dữ liệu các collections giữa các test case để đảm bảo tính độc lập
beforeEach(async () => {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany();
    }
  }
});

// Mock email service và face service để tránh kết nối thật khi test
jest.mock("../utils/emailService", () => ({
  sendRegistrationEmail: jest.fn().mockResolvedValue(true),
  sendExpirationReminderEmail: jest.fn().mockResolvedValue(true),
  sendUnfreezeNotificationEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock("../utils/faceServiceClient", () => ({
  getEmbedding: jest.fn().mockResolvedValue({ found: true, embedding: Array(512).fill(0.1) }),
  recognize: jest.fn(),
  isHealthy: jest.fn().mockResolvedValue(true)
}));

jest.mock("../middleware/auditLogger", () => (req, res, next) => next());

// Helper tạo Token giả lập cho các vai trò
const createTestUserAndGetToken = async (role) => {
  const user = new User({
    username: `test_${role}`,
    fullName: `Test ${role.toUpperCase()}`,
    password: "password123",
    role: role,
    status: "active"
  });
  await user.save();
  
  const token = jwt.sign(
    {
      id: user._id,
      role,
      branchCode: "HN01",
      activeBranch: "HN01",
      allowedBranches: role === "admin" ? ["*"] : ["HN01"],
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
  return { token, user };
};

module.exports = {
  createTestUserAndGetToken
};
