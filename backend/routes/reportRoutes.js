const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const { ipKeyGenerator } = rateLimit;
const {
  getSummary,
  getRevenueChart,
  getPackageDistribution,
  getExpiringMembers,
  getRevenueDetails,
  getInventoryReport,
  getChurnPrediction,
  getRevenueAdvanced,
  getHRSummary,
  getCustomerAnalytics,
  getNotificationsSummary,
  getPTSessionsReport,
  exportPTSessionsExcel,
  submitPTDispute,
  updatePeriodStatus,
  getLeadConversionReport,
  getContractStatusBreakdown,
} = require("../controllers/reportController");
const { protect } = require("../middleware/authMiddleware");
const { PERMISSIONS, requirePermission } = require("../middleware/permissions");
const { getAccessTokenState } = require("../middleware/accessTokenContext");
const CacheRateLimitStore = require("../utils/rateLimitStore");

const reportLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: Number(process.env.REPORT_RATE_LIMIT_MAX || 120),
  keyGenerator: (req) => {
    const authState = getAccessTokenState(req);
    if (authState.status === "authenticated" && authState.claims?.id) {
      const branchCode = authState.claims.branchCode || authState.claims.activeBranch || "central";
      return `report:${branchCode}:${authState.claims.id}`;
    }
    return `report-ip:${ipKeyGenerator(req.ip)}`;
  },
  handler: (req, res, _next, options) => {
    const resetTime = req.rateLimit?.resetTime;
    const retryAfterSeconds = resetTime
      ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
      : Math.ceil(options.windowMs / 1000);
    res.status(options.statusCode).json({
      success: false,
      code: "RATE_LIMITED",
      message: "Bạn đang tải báo cáo quá nhanh. Vui lòng chờ trước khi thử lại.",
      retryAfterSeconds,
      requestId: req.id,
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS",
  store: new CacheRateLimitStore({ prefix: "rate-limit:report:" }),
});

router.use(reportLimiter);

router.get("/summary", protect, requirePermission(PERMISSIONS.REPORT_READ_ALL), getSummary);
router.get("/revenue", protect, requirePermission(PERMISSIONS.REPORT_READ_ALL), getRevenueChart);
router.get("/packages", protect, requirePermission(PERMISSIONS.REPORT_READ_ALL), getPackageDistribution);
router.get("/expiring", protect, requirePermission(PERMISSIONS.REPORT_READ_ALL), getExpiringMembers);
router.get("/revenue-details", protect, requirePermission(PERMISSIONS.REPORT_READ_ALL), getRevenueDetails);
router.get("/inventory", protect, requirePermission(PERMISSIONS.REPORT_READ_ALL), getInventoryReport);
router.get("/churn-prediction", protect, requirePermission(PERMISSIONS.REPORT_READ_ALL), getChurnPrediction);

// Advanced Reports
router.get("/revenue-advanced", protect, requirePermission(PERMISSIONS.REPORT_READ_ALL), getRevenueAdvanced);
router.get("/hr-summary", protect, requirePermission(PERMISSIONS.REPORT_READ_ALL), getHRSummary);
router.get("/customer-analytics", protect, requirePermission(PERMISSIONS.REPORT_READ_ALL), getCustomerAnalytics);
router.get("/notifications-summary", protect, requirePermission(PERMISSIONS.REPORT_READ_ALL), getNotificationsSummary);

// PT Sessions & Dispute Workflow
router.get("/pt-sessions", protect, getPTSessionsReport);
router.get("/pt-sessions/export-excel", protect, exportPTSessionsExcel);
router.post(
  "/pt-sessions/dispute",
  protect,
  requirePermission(PERMISSIONS.PT_DISPUTE),
  submitPTDispute
);
router.put(
  "/commission-period/status",
  protect,
  requirePermission(PERMISSIONS.COMMISSION_MANAGE),
  updatePeriodStatus
);

// Leads & Contract Status Analytics
router.get("/leads-conversion", protect, requirePermission(PERMISSIONS.REPORT_READ_ALL), getLeadConversionReport);
router.get("/contract-status-breakdown", protect, requirePermission(PERMISSIONS.REPORT_READ_ALL), getContractStatusBreakdown);

module.exports = router;
