const express = require("express");
const router = express.Router();
const workoutController = require("../controllers/workoutController");
const { protect } = require("../middleware/authMiddleware");
const { PERMISSIONS, requirePermission } = require("../middleware/permissions");

// Get workout sessions (All staff can view history)
router.get(
  "/:id",
  protect,
  requirePermission(PERMISSIONS.CUSTOMER_READ),
  workoutController.getWorkoutsByCustomer
);

// Deduct a session (Only Reception/Manager/Admin)
router.post(
  "/:id/deduct",
  protect,
  requirePermission(PERMISSIONS.WORKOUT_DEDUCT),
  workoutController.deductSession
);

// Delete a session (Only Admin)
router.delete(
  "/:id",
  protect,
  requirePermission(PERMISSIONS.WORKOUT_DELETE),
  workoutController.deleteSession
);

module.exports = router;
