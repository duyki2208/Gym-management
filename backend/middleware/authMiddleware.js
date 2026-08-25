/**
 * authMiddleware.js — Middleware xác thực & phân quyền Đa chi nhánh
 * Export: { protect, authorize }
 */
const jwt = require("jsonwebtoken");

// Middleware xác thực token (protect)
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // 1. Lấy token từ header
      token = req.headers.authorization.split(" ")[1];

      // 2. Giải mã token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const { getCentralModels, getBranchModels } = require("../db/branchConnectionManager");
      if (!req.centralModels) {
        req.centralModels = await getCentralModels();
      }

      let user = null;
      let isCentral = false;

      // 1. Thử tìm trong CentralUser trước (nếu là role admin/accountant hoặc token isCentral)
      if (decoded.isCentral || decoded.role === "admin" || decoded.role === "accountant") {
        user = await req.centralModels.CentralUser.findById(decoded.id).select("-password");
        if (user) {
          isCentral = true;
        }
      }

      // 2. Nếu chưa thấy, tìm trong Branch DB hiện tại
      if (!user) {
        const targetBranch = decoded.branchCode || req.branchCode || "HN01";
        const branchModels = await getBranchModels(targetBranch);
        user = await branchModels.User.findById(decoded.id).select("-password");
      }

      // 3. Fallback: Nếu vẫn chưa thấy, tìm trong CentralUser theo ID bất kể role
      if (!user) {
        user = await req.centralModels.CentralUser.findById(decoded.id).select("-password");
        if (user) isCentral = true;
      }

      // 4. Fallback: Tìm qua LoginIndex theo username (nếu token cũ có username hoặc tra cứu)
      if (!user && decoded.username) {
        const loginEntry = await req.centralModels.LoginIndex.findOne({ username: decoded.username });
        if (loginEntry) {
          const branchModels = await getBranchModels(loginEntry.branchCode);
          user = await branchModels.User.findById(loginEntry.userId).select("-password");
        }
      }

      // 5. Nếu hoàn toàn không tìm thấy
      if (!user) {
        return res.status(401).json({
          code: "USER_NOT_FOUND",
          message: "Phiên đăng nhập không hợp lệ hoặc tài khoản không tồn tại. Vui lòng đăng nhập lại.",
        });
      }

      if (user.isActive === false) {
        return res.status(401).json({
          code: "USER_DEACTIVATED",
          message: "Tài khoản của bạn đã bị vô hiệu hóa / khóa.",
        });
      }

      req.user = user;
      req.user.isCentral = isCentral || user.role === "admin" || user.role === "accountant";
      req.user.activeBranch = req.branchCode || decoded.activeBranch || "HN01";
      req.user.allowedBranches = user.allowedBranches || ["*"];
      req.user.branchCode = req.branchCode || decoded.branchCode || "HN01";

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
  return (req, res, next) => {
    // 1. Kiểm tra xem request đã có thông tin user chưa
    if (!req.user) {
      return res
        .status(401)
        .json({ message: "Chưa xác thực danh tính (No User Found)" });
    }

    // Admin luôn có toàn quyền
    if (req.user.role === "admin") {
      return next();
    }

    // 2. Lấy role của user hiện tại
    let roles = Array.isArray(allowedRoles[0])
      ? [...allowedRoles[0]]
      : [...allowedRoles];

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

