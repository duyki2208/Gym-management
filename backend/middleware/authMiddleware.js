/**
 * authMiddleware.js — Middleware xác thực & phân quyền DUY NHẤT
 * Không tạo thêm file auth middleware khác.
 * Export: { protect, authorize }
 */
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Middleware xác thực token (protect)
const protect = async (req, res, next) => {
  // console.log("--- Executing: protect middleware ---"); // remove in production
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Lấy token từ header
      token = req.headers.authorization.split(" ")[1];

      // Giải mã token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Lấy thông tin user từ token (trừ password)
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(401).json({ message: "Không tìm thấy người dùng" });
      }

      return next();
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          code: "TOKEN_EXPIRED",
          message: "Access token đã hết hạn",
        });
      }
      return res.status(401).json({
        code: "INVALID_TOKEN",
        message: "Không được phép truy cập, token không hợp lệ",
      });
    }
  }

  if (!token) {
    return res
      .status(401)
      .json({ message: "Không được phép truy cập, không có token" });
  }
};

// Middleware phân quyền (authorize)
const authorize = (...allowedRoles) => {
  // Sử dụng rest parameter để nhận danh sách role
  return (req, res, next) => {
    // console.log("--- Executing: authorize middleware ---"); // remove in production
    // 1. Kiểm tra xem request đã có thông tin user chưa
    if (!req.user) {
      return res
        .status(401)
        .json({ message: "Chưa xác thực danh tính (No User Found)" });
    }

    // 2. Lấy role của user hiện tại
    let roles = Array.isArray(allowedRoles[0])
      ? [...allowedRoles[0]]
      : [...allowedRoles];

    // 3. Tự động ánh xạ quyền cho các vai trò mới
    // Kế toán (accountant) có quyền ngang Admin
    if (roles.includes("admin") && !roles.includes("accountant")) {
      roles.push("accountant");
    }

    // Các quản lý mới (sm, pm, om) có quyền ngang quản lý chung (manager)
    if (roles.includes("manager")) {
      ["sm", "pm", "om"].forEach((r) => {
        if (!roles.includes(r)) {
          roles.push(r);
        }
      });
    }

    if (roles.includes(req.user.role)) {
      next();
    } else {
      return res.status(403).json({
        message: `Role ${req.user.role} không có quyền thực hiện thao tác này!`,
      });
    }
  };
};

module.exports = { protect, authorize };
