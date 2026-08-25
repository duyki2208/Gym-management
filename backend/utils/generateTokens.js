/**
 * utils/generateTokens.js — Tiện ích tạo và xử lý JWT Token
 *
 * Export:
 *   generateAccessToken(userId, role, extraPayload)  — Tạo Access Token ngắn hạn (15 phút)
 *   generateRefreshToken(userId, extraPayload)       — Tạo Refresh Token dài hạn (7 ngày)
 *   hashToken(token)                                — Hash SHA-256 một chiều để lưu vào DB
 */
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

/**
 * Tạo Access Token ngắn hạn (15 phút).
 * Chứa: id, role, kèm thông tin chi nhánh (branchCode hoặc activeBranch/allowedBranches, isCentral).
 */
const generateAccessToken = (userId, role, extraPayload = {}) => {
  return jwt.sign(
    {
      id: userId,
      role,
      ...extraPayload,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "15m",
    }
  );
};

/**
 * Tạo Refresh Token dài hạn (7 ngày).
 * Chứa: id, isCentral, branchCode để định tuyến DB đúng khi refresh token.
 */
const generateRefreshToken = (userId, extraPayload = {}) => {
  return jwt.sign(
    {
      id: userId,
      ...extraPayload,
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

/**
 * Hash một chiều (SHA-256) để lưu token vào DB.
 * Đảm bảo ngay cả khi DB bị rò rỉ, kẻ tấn công cũng không thể dùng lại hash.
 */
const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

module.exports = { generateAccessToken, generateRefreshToken, hashToken };
