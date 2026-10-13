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
const { PERMISSIONS, requirePermission } = require("../middleware/permissions");

router.get("/", protect, requirePermission(PERMISSIONS.LEAD_READ), getAllLeads);
router.post("/", protect, requirePermission(PERMISSIONS.LEAD_CREATE), createLead);
router.put("/:id", protect, requirePermission(PERMISSIONS.LEAD_UPDATE), updateLead);
router.post("/:id/convert", protect, requirePermission(PERMISSIONS.LEAD_CONVERT), convertLead);
router.delete("/:id", protect, requirePermission(PERMISSIONS.LEAD_DELETE), deleteLead);

module.exports = router;
