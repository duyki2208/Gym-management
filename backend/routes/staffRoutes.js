const express = require("express");
const router = express.Router();
const staffController = require("../controllers/staffController");
const { protect } = require("../middleware/authMiddleware");
const { PERMISSIONS, requirePermission } = require("../middleware/permissions");

router.get("/schedules", protect, requirePermission(PERMISSIONS.STAFF_READ), staffController.getSchedules);
router.post("/:id/schedule", protect, requirePermission(PERMISSIONS.STAFF_SCHEDULE), staffController.updateSchedule);

router.get("/", protect, requirePermission(PERMISSIONS.STAFF_READ), staffController.getAll);
router.post("/", protect, requirePermission(PERMISSIONS.STAFF_CREATE), staffController.create);
router.put(
  "/:id",
  protect,
  requirePermission(PERMISSIONS.STAFF_UPDATE),
  staffController.update
);
router.delete("/:id", protect, requirePermission(PERMISSIONS.STAFF_DELETE), staffController.remove);

module.exports = router;
