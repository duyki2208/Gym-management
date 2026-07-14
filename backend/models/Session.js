const mongoose = require("mongoose");

/**
 * Session.js — Lưu trữ phiên đăng nhập của người dùng (Refresh Token)
 *
 * Mỗi lần người dùng đăng nhập từ một thiết bị, một Session mới được tạo.
 * Điều này cho phép nhân viên đăng nhập đồng thời trên nhiều thiết bị
 * (máy tính + điện thoại) mà không bị đăng xuất lẫn nhau.
 *
 * MongoDB TTL Index sẽ tự động xóa các session hết hạn khỏi DB.
 */
const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // Index để query nhanh theo userId
    },
    tokenHash: {
      type: String,
      required: true,
      // Lưu hash SHA-256 của refresh token, không lưu plaintext
      // Đảm bảo an toàn nếu DB bị rò rỉ
    },
    expiresAt: {
      type: Date,
      required: true,
      // TTL Index: MongoDB tự động xóa document khi expiresAt đã qua
      index: { expireAfterSeconds: 0 },
    },
    userAgent: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Session", sessionSchema);
