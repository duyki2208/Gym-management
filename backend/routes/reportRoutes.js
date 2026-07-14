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
  getNotificationsSummary
} = require("../controllers/reportController");
const { protect } = require("../middleware/authMiddleware"); 

router.get("/summary", getSummary);
router.get("/revenue", getRevenueChart);
router.get("/packages", getPackageDistribution);
router.get("/expiring", getExpiringMembers);
router.get("/revenue-details", getRevenueDetails);
router.get("/inventory", getInventoryReport);
router.get("/churn-prediction", getChurnPrediction);

// Advanced Reports
router.get("/revenue-advanced", getRevenueAdvanced);
router.get("/hr-summary", getHRSummary);
router.get("/customer-analytics", getCustomerAnalytics);
router.get("/notifications-summary", getNotificationsSummary);

module.exports = router;
