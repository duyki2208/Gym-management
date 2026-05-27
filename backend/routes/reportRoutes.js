const express = require("express");
const router = express.Router();
const {
  getSummary,
  getRevenueChart,
  getPackageDistribution,
  getExpiringMembers,
  getRevenueDetails,
  getInventoryReport,
  getChurnPrediction
} = require("../controllers/reportController");
const { protect } = require("../middleware/authMiddleware"); 

router.get("/summary", getSummary);
router.get("/revenue", getRevenueChart);
router.get("/packages", getPackageDistribution);
router.get("/expiring", getExpiringMembers);
router.get("/revenue-details", getRevenueDetails);
router.get("/inventory", getInventoryReport);
router.get("/churn-prediction", getChurnPrediction);

module.exports = router;
