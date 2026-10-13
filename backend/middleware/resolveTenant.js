const { getAccessTokenState } = require("./accessTokenContext");

const DEFAULT_BRANCH_CODE = process.env.DEFAULT_BRANCH_CODE || "HN01";

const normalizeBranchCode = (value) => String(value).trim().toUpperCase();

/**
 * Resolve the requested tenant from verified claims and request input.
 * This middleware deliberately does not open a database connection.
 */
const resolveTenant = (req, res, next) => {
  let resolvedBranchCode = null;
  const authState = getAccessTokenState(req);
  const headers = req.headers || {};
  const query = req.query || {};

  if (authState.status === "authenticated") {
    const claims = authState.claims;
    const requestedBranch = headers["x-branch-code"] || query.branchCode;

    if (claims.isCentral === true) {
      const normalizedTarget = normalizeBranchCode(
        requestedBranch || claims.activeBranch || DEFAULT_BRANCH_CODE
      );
      const allowedBranches = Array.isArray(claims.allowedBranches)
        ? claims.allowedBranches
        : [];

      if (!allowedBranches.includes("*") && !allowedBranches.includes(normalizedTarget)) {
        return res.status(403).json({
          code: "BRANCH_ACCESS_DENIED",
          message: `Bạn không có quyền truy cập dữ liệu chi nhánh ${normalizedTarget}`,
        });
      }
      resolvedBranchCode = normalizedTarget;
    } else if (claims.branchCode) {
      const tokenBranch = normalizeBranchCode(claims.branchCode);
      if (requestedBranch && normalizeBranchCode(requestedBranch) !== tokenBranch) {
        return res.status(403).json({
          code: "BRANCH_ACCESS_DENIED",
          message: `Tài khoản chi nhánh ${tokenBranch} không được phép truy cập chi nhánh ${normalizeBranchCode(requestedBranch)}`,
        });
      }
      resolvedBranchCode = tokenBranch;
    }
  }

  // Public routes have no access-token claims, so they use the explicit or
  // configured default tenant. Invalid tokens are rejected later by `protect`.
  req.branchCode = normalizeBranchCode(
    resolvedBranchCode ||
      headers["x-branch-code"] ||
      query.branchCode ||
      DEFAULT_BRANCH_CODE
  );
  return next();
};

module.exports = resolveTenant;
