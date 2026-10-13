/**
 * backend/routes/branchTransferRoutes.js
 * Routes for Branch Transfers
 */
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { PERMISSIONS, requirePermission } = require("../middleware/permissions");
const {
  transferCustomerBranch,
  getPendingTransfers,
} = require("../controllers/branchTransferController");

// POST /api/v1/branch-transfers/transfer — Thực hiện chuyển cơ sở hội viên
router.post("/transfer", protect, requirePermission(PERMISSIONS.BRANCH_TRANSFER_CREATE), transferCustomerBranch);

// GET /api/v1/branch-transfers/pending — Danh sách chuyển nhượng đang pending
router.get("/pending", protect, requirePermission(PERMISSIONS.BRANCH_TRANSFER_READ), getPendingTransfers);

module.exports = router;
