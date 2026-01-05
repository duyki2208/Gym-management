const express = require("express");
const router = express.Router();
const {
  getSummary,
  getRevenueChart,
  getPackageDistribution,
  getExpiringMembers
} = require("../controllers/reportController");
const { protect } = require("../middleware/authMiddleware"); // Giả sử có middleware này

// Tất cả route báo cáo nên được bảo vệ
// router.use(protect); 

router.get("/summary", getSummary);
router.get("/revenue", getRevenueChart);
router.get("/packages", getPackageDistribution);
router.get("/expiring", getExpiringMembers);

module.exports = router;
