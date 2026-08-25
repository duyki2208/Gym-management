/**
 * backend/middleware/attachBranchContext.js
 * Middleware to attach Central and Branch DB Models to req context and AsyncLocalStorage
 *
 * Provides:
 *   req.centralModels - Central DB Models (Branch, CentralUser, LoginIndex, CentralSession)
 *   req.models - Active Branch DB Models (User, Customer, Invoice, etc.)
 *   req.branchCode - Active branch code (e.g. "HN01")
 */
const jwt = require("jsonwebtoken");
const { getCentralModels, getBranchModels } = require("../db/branchConnectionManager");
const { runWithContext } = require("../utils/context");

const DEFAULT_BRANCH_CODE = process.env.DEFAULT_BRANCH_CODE || "HN01";

const attachBranchContext = async (req, res, next) => {
  try {
    // 1. Luôn attach Central Models
    req.centralModels = await getCentralModels();

    let resolvedBranchCode = null;

    // 2. Kiểm tra JWT token nếu có trong Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      try {
        const token = req.headers.authorization.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded) {
          if (decoded.isCentral || decoded.role === "admin" || decoded.role === "accountant") {
            // Với Central User: Cho phép chọn chi nhánh qua header X-Branch-Code, fallback về activeBranch trong token hoặc mặc định
            resolvedBranchCode =
              req.headers["x-branch-code"] ||
              req.query.branchCode ||
              decoded.activeBranch ||
              DEFAULT_BRANCH_CODE;
          } else if (decoded.branchCode) {
            // Với Branch User: Bị khóa chặt với branchCode trong token (chống can thiệp chéo)
            resolvedBranchCode = decoded.branchCode;
          }
        }
      } catch (tokenErr) {
        // Token lỗi hoặc hết hạn — sẽ được middleware `protect` xử lý chi tiết nếu route yêu cầu auth
      }
    }

    // 3. Fallback cho các request không có token hoặc public routes
    if (!resolvedBranchCode) {
      resolvedBranchCode =
        req.headers["x-branch-code"] ||
        req.query.branchCode ||
        DEFAULT_BRANCH_CODE;
    }

    // 4. Chuẩn hóa mã chi nhánh
    req.branchCode = String(resolvedBranchCode).trim().toUpperCase();

    // 5. Nạp Branch Models tương ứng cho request
    req.models = await getBranchModels(req.branchCode);

    // 6. Đưa context vào AsyncLocalStorage để các models Proxy và services ngầm tự động nhận đúng DB
    runWithContext(
      {
        models: req.models,
        centralModels: req.centralModels,
        branchCode: req.branchCode,
        req,
      },
      () => {
        next();
      }
    );
  } catch (error) {
    console.error(`[attachBranchContext Error] ${error.message}`);
    return res.status(500).json({
      success: false,
      message: `Lỗi kết nối cơ sở dữ liệu chi nhánh: ${error.message}`,
    });
  }
};

module.exports = attachBranchContext;
