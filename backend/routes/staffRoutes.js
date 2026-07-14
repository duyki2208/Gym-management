const express = require("express");
const router = express.Router();
const staffController = require("../controllers/staffController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.get("/schedules", protect, staffController.getSchedules);
router.post("/:id/schedule", protect, authorize("admin", "manager", "pm", "om", "sm", "sale", "pt", "reception"), staffController.updateSchedule);

router.get("/", protect, staffController.getAll);
router.post("/", protect, authorize("admin"), staffController.create);
router.put(
  "/:id",
  protect,
  authorize("admin", "manager"),
  staffController.update
);
router.delete("/:id", protect, authorize("admin"), staffController.remove);

module.exports = router;
