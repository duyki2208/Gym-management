const express = require("express");
const router = express.Router();
const {
  getAllLeads,
  createLead,
  updateLead,
  convertLead,
  deleteLead,
} = require("../controllers/leadController");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getAllLeads);
router.post("/", protect, createLead);
router.put("/:id", protect, updateLead);
router.post("/:id/convert", protect, convertLead);
router.delete("/:id", protect, deleteLead);

module.exports = router;
