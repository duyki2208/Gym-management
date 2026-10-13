/**
 * authMiddleware.js — Middleware xác thực & phân quyền Đa chi nhánh
 * Export: { protect, authorize }
 */
const { getAccessTokenState } = require("./accessTokenContext");

// Middleware xác thực token (protect)
const protect = async (req, res, next) => {
  const authState = getAccessTokenState(req);

  if (authState.status === "authenticated") {
    try {
      const decoded = authState.claims;

      const { getCentralModels, getBranchModels } = require("../db/branchConnectionManager");
      if (!req.centralModels) {
        req.centralModels = await getCentralModels();
      }

      let user = null;
      let isCentral = false;

      // 1. Central/branch is an identity property, not an inference from role.
      if (decoded.isCentral === true) {
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
      req.user.isCentral = isCentral;
      req.user.activeBranch = req.branchCode || decoded.activeBranch || "HN01";
      req.user.allowedBranches =
        Array.isArray(user.allowedBranches) && user.allowedBranches.length > 0
          ? user.allowedBranches
          : (req.user.isCentral && user.role === "admin" ? ["*"] : []);
      req.user.branchCode = req.branchCode || decoded.branchCode || "HN01";

      if (
        req.user.isCentral &&
        !req.user.allowedBranches.includes("*") &&
        !req.user.allowedBranches.includes(req.user.branchCode)
      ) {
        return res.status(403).json({
          code: "BRANCH_ACCESS_DENIED",
          message: `Bạn không có quyền truy cập dữ liệu chi nhánh ${req.user.branchCode}`,
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  }

  if (authState.status === "invalid") {
    if (authState.error?.name === "TokenExpiredError") {
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

  if (authState.status === "anonymous") {
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

