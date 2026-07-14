/**
 * utils/generateTokens.js — Tiện ích tạo và xử lý JWT Token
 *
 * Export:
 *   generateAccessToken(userId)  — Tạo Access Token ngắn hạn (15 phút)
 *   generateRefreshToken(userId) — Tạo Refresh Token dài hạn (7 ngày)
 *   hashToken(token)             — Hash SHA-256 một chiều để lưu vào DB
 */
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

/**
 * Tạo Access Token ngắn hạn (15 phút).
 * Chứa: id, role của user để Frontend có thể dùng ngay mà không cần query DB.
 */
const generateAccessToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });
};

/**
 * Tạo Refresh Token dài hạn (7 ngày).
 * Chỉ chứa id, không chứa role để giảm rủi ro nếu bị lộ.
 * Sử dụng JWT_REFRESH_SECRET riêng biệt với JWT_SECRET.
 */
const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });
};

/**
 * Hash một chiều (SHA-256) để lưu token vào DB.
 * Đảm bảo ngay cả khi DB bị rò rỉ, kẻ tấn công cũng không thể dùng lại hash.
 */
const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

module.exports = { generateAccessToken, generateRefreshToken, hashToken };
