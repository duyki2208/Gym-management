const express = require("express");
const router = express.Router();
const workoutController = require("../controllers/workoutController");
const { protect, authorize } = require("../middleware/authMiddleware");

// Get workout sessions (All staff can view history)
router.get("/:id", protect, workoutController.getWorkoutsByCustomer);

// Deduct a session (Only Reception/Manager/Admin)
router.post(
  "/:id/deduct",
  protect,
  authorize("admin", "manager", "reception"),
  workoutController.deductSession
);

// Delete a session (Only Admin)
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  workoutController.deleteSession
);

module.exports = router;
