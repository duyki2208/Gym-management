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
      console.error(error);
      return res
        .status(401)
        .json({ message: "Không được phép truy cập, token không hợp lệ" });
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
    // Nếu allowedRoles được truyền vào là mảng (ví dụ ['admin']), dùng allowedRoles[0] hoặc thay đổi cách gọi
    // Ở đây dùng rest parameter nên allowedRoles sẽ là một mảng ['admin', 'manager', ...]
    const roles = Array.isArray(allowedRoles[0])
      ? allowedRoles[0]
      : allowedRoles;

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
