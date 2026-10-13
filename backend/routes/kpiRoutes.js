const express = require("express");
const router = express.Router();
const kpiController = require("../controllers/kpiController");
const { protect } = require("../middleware/authMiddleware");
const { PERMISSIONS, requirePermission, requireSelfOrPermission } = require("../middleware/permissions");

// === Leaderboard (xếp hạng doanh số) ===
router.get("/leaderboard", protect, kpiController.getKPILeaderboard);

// === Xem tiến độ KPI cá nhân ===
router.get(
  "/:userId",
  protect,
  requireSelfOrPermission("userId", PERMISSIONS.KPI_READ_ALL),
  kpiController.getKPIProgress
);

// === Cập nhật chỉ tiêu KPI (Chỉ Admin/Manager) ===
router.post("/target", protect, requirePermission(PERMISSIONS.KPI_MANAGE), kpiController.updateKPITarget);

module.exports = router;
