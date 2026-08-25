/**
 * backend/routes/branchTransferRoutes.js
 * Routes for Branch Transfers
 */
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  transferCustomerBranch,
  getPendingTransfers,
} = require("../controllers/branchTransferController");

// POST /api/v1/branch-transfers/transfer — Thực hiện chuyển cơ sở hội viên
router.post("/transfer", protect, authorize("admin", "manager", "om", "sm", "pm", "reception"), transferCustomerBranch);

// GET /api/v1/branch-transfers/pending — Danh sách chuyển nhượng đang pending
router.get("/pending", protect, authorize("admin", "manager", "om", "sm", "pm"), getPendingTransfers);

module.exports = router;
