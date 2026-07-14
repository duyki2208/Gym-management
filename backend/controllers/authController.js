/**
 * authController.js — Xử lý xác thực người dùng
 *
 * Export: { loginUser, refreshToken, logoutUser }
 *
 * Luồng xác thực:
 *   Login → Access Token (15p, JSON) + Refresh Token (7d, HTTP-only Cookie)
 *   Access Token hết hạn → FE gọi /refresh-token → nhận Access Token mới
 *   Refresh Token hết hạn → Yêu cầu login lại
 *   Logout → Xóa đúng Session của thiết bị đó, các thiết bị khác không bị ảnh hưởng
 */
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Session = require("../models/Session");
const {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} = require("../utils/generateTokens");

// Cấu hình cookie chung — tái sử dụng để tránh lặp code
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", // true khi deploy HTTPS
  sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày (ms)
  path: "/api/v1/auth", // Cookie chỉ gửi kèm khi gọi các route /auth
};

// -----------------------------------------------------------------------
// POST /api/v1/auth/login
// -----------------------------------------------------------------------
const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Tìm user trong DB
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: "Tài khoản không tồn tại!" });
    }

    // 2. Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Mật khẩu không đúng!" });
    }

    // 3. Kiểm tra JWT_REFRESH_SECRET đã được cấu hình chưa
    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      console.error("LỖI NGHIÊM TRỌNG: JWT_SECRET hoặc JWT_REFRESH_SECRET chưa được cấu hình.");
      return res.status(500).json({ message: "Lỗi cấu hình server nội bộ (Auth)." });
    }

    // 4. Tạo cặp token mới
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    // 5. Lưu Session mới vào DB (hỗ trợ đăng nhập đa thiết bị)
    await Session.create({
      userId: user._id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngày
      userAgent: req.headers["user-agent"] || null,
      ipAddress: req.ip || null,
    });

    // 6. Gửi Refresh Token qua HTTP-only Cookie
    res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);

    // 7. Trả về Access Token + thông tin user qua JSON
    res.status(200).json({
      message: "Đăng nhập thành công",
      token: accessToken, // Giữ tên "token" để tương thích với FE hiện tại
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Lỗi login:", error);
    res.status(500).json({ message: "Lỗi Server" });
  }
};

// -----------------------------------------------------------------------
// POST /api/v1/auth/refresh-token
// Cấp Access Token mới dựa trên Refresh Token từ Cookie.
// Áp dụng Rotation: refresh token cũ bị vô hiệu, cặp token mới được cấp.
// -----------------------------------------------------------------------
const refreshToken = async (req, res) => {
  const token = req.cookies?.refreshToken;

  if (!token) {
    return res.status(401).json({
      code: "NO_REFRESH_TOKEN",
      message: "Không tìm thấy phiên đăng nhập",
    });
  }

  try {
    // 1. Xác minh chữ ký và thời hạn của refresh token
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    // 2. Tìm Session tương ứng trong DB (khớp cả userId và hash)
    const session = await Session.findOne({
      userId: decoded.id,
      tokenHash: hashToken(token),
    });

    if (!session) {
      // Token hợp lệ về chữ ký nhưng không có trong DB
      // → Có thể là token cũ đã bị xoay vòng (rotation reuse attack)
      // → Thu hồi toàn bộ session của user này để đảm bảo an toàn
      console.warn(`[Security] Phát hiện Refresh Token tái sử dụng cho user ${decoded.id}. Thu hồi toàn bộ session.`);
      await Session.deleteMany({ userId: decoded.id });

      return res.status(401).json({
        code: "REFRESH_TOKEN_REUSE",
        message: "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.",
      });
    }

    // 3. Lấy thông tin user để đưa vào Access Token mới
    const user = await User.findById(decoded.id);
    if (!user) {
      await Session.findByIdAndDelete(session._id);
      return res.status(401).json({
        code: "USER_NOT_FOUND",
        message: "Không tìm thấy người dùng",
      });
    }

    // 4. Rotation: Tạo cặp token mới, cập nhật hash trong DB
    const newAccessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);

    await Session.findByIdAndUpdate(session._id, {
      tokenHash: hashToken(newRefreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userAgent: req.headers["user-agent"] || session.userAgent,
    });

    // 5. Cập nhật Cookie và trả về Access Token mới
    res.cookie("refreshToken", newRefreshToken, REFRESH_COOKIE_OPTIONS);
    res.json({ token: newAccessToken }); // Giữ tên "token" để tương thích với FE

  } catch (error) {
    // Refresh Token hết hạn hoặc chữ ký sai → yêu cầu đăng nhập lại
    return res.status(401).json({
      code: "REFRESH_TOKEN_EXPIRED",
      message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    });
  }
};

// -----------------------------------------------------------------------
// POST /api/v1/auth/logout
// Xóa đúng Session của thiết bị đang đăng xuất.
// Các thiết bị khác của cùng user KHÔNG bị ảnh hưởng.
// -----------------------------------------------------------------------
const logoutUser = async (req, res) => {
  const token = req.cookies?.refreshToken;

  if (token) {
    try {
      // Chỉ xóa đúng session tương ứng với thiết bị đang logout
      await Session.deleteOne({
        userId: req.user._id, // req.user được set bởi middleware protect
        tokenHash: hashToken(token),
      });
    } catch (e) {
      // Token đã invalid thì bỏ qua, vẫn tiến hành clear cookie
    }
  }

  res.clearCookie("refreshToken", { path: "/api/v1/auth" });
  res.json({ message: "Đã đăng xuất thành công" });
};

module.exports = { loginUser, refreshToken, logoutUser };