const express = require("express");
const router = express.Router();
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

router.get("/summary", protect, getSummary);
router.get("/revenue", protect, getRevenueChart);
router.get("/packages", protect, getPackageDistribution);
router.get("/expiring", protect, getExpiringMembers);
router.get("/revenue-details", protect, getRevenueDetails);
router.get("/inventory", protect, getInventoryReport);
router.get("/churn-prediction", protect, getChurnPrediction);

// Advanced Reports
router.get("/revenue-advanced", protect, getRevenueAdvanced);
router.get("/hr-summary", protect, getHRSummary);
router.get("/customer-analytics", protect, getCustomerAnalytics);
router.get("/notifications-summary", protect, getNotificationsSummary);

// PT Sessions & Dispute Workflow
router.get("/pt-sessions", protect, getPTSessionsReport);
router.get("/pt-sessions/export-excel", protect, exportPTSessionsExcel);
router.post("/pt-sessions/dispute", protect, submitPTDispute);
router.put("/commission-period/status", protect, updatePeriodStatus);

// Leads & Contract Status Analytics
router.get("/leads-conversion", protect, getLeadConversionReport);
router.get("/contract-status-breakdown", protect, getContractStatusBreakdown);

module.exports = router;
