const express = require("express");
const router = express.Router();
const kpiController = require("../controllers/kpiController");
const { protect, authorize } = require("../middleware/authMiddleware");

// === Leaderboard (xếp hạng doanh số) ===
router.get("/leaderboard", protect, kpiController.getKPILeaderboard);

// === Xem tiến độ KPI cá nhân ===
router.get("/:userId", protect, kpiController.getKPIProgress);

// === Cập nhật chỉ tiêu KPI (Chỉ Admin/Manager) ===
router.post("/target", protect, authorize("admin", "manager"), kpiController.updateKPITarget);

module.exports = router;
