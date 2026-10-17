const { getCentralModels, getBranchModels } = require("../db/branchConnectionManager");
const { runWithContext } = require("../utils/context");
const { getAccessTokenState } = require("./accessTokenContext");

const PUBLIC_AUTH_PATHS = new Set([
  "/auth/login",
  "/auth/refresh-token",
  "/auth/logout",
]);
const BRANCH_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,31}$/;

/** Load the model set selected by `resolveTenant` and bind it to this request. */
const loadTenantContext = async (req, res, next) => {
  try {
    req.centralModels = await getCentralModels();

    // Public authentication endpoints only need the central catalog. Loading a
    // branch here would let an anonymous X-Branch-Code create/cache arbitrary
    // database model sets before authentication has run.
    if (PUBLIC_AUTH_PATHS.has(req.path)) {
      return runWithContext(
        { centralModels: req.centralModels, branchCode: null, req },
        next
      );
    }

    const authState = getAccessTokenState(req);
    const branchWasRequested = Boolean(
      req.headers?.["x-branch-code"] || req.query?.branchCode
    );
    if (!BRANCH_CODE_PATTERN.test(req.branchCode || "")) {
      return res.status(400).json({
        code: "INVALID_BRANCH_CODE",
        message: "Mã chi nhánh không hợp lệ",
      });
    }
    if (authState.status === "authenticated" || branchWasRequested) {
      const branch = await req.centralModels.Branch.findOne({ code: req.branchCode })
        .select("code isActive")
        .lean();
      const isLegacyDefault = !branch && req.branchCode === (process.env.DEFAULT_BRANCH_CODE || "HN01") && !branchWasRequested;
      if ((!branch || branch.isActive === false) && !isLegacyDefault) {
        return res.status(403).json({
          code: "BRANCH_ACCESS_DENIED",
          message: `Chi nhánh ${req.branchCode} không tồn tại hoặc đã ngừng hoạt động`,
        });
      }
    }

    req.models = await getBranchModels(req.branchCode);

    return runWithContext(
      {
        models: req.models,
        centralModels: req.centralModels,
        branchCode: req.branchCode,
        req,
      },
      next
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = loadTenantContext;
