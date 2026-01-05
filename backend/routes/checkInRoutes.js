const express = require("express");
const router = express.Router();
const checkInController = require("../controllers/checkInController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.get(
  "/",
  protect,
  authorize("admin", "manager", "staff", "pt", "sale", "reception"),
  checkInController.getAll
);
router.post(
  "/",
  protect,
  authorize("admin", "manager", "staff", "pt", "sale", "reception"),
  checkInController.create
);

module.exports = router;
