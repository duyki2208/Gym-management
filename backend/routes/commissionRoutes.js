const express = require("express");
const router = express.Router();
const commissionController = require("../controllers/commissionController");
const { protect } = require("../middleware/authMiddleware");
const { PERMISSIONS, requirePermission } = require("../middleware/permissions");

// === Tra cứu hoa hồng ===
// PT commission — PT/Manager/Admin đều có thể xem
router.get("/pt", protect, requirePermission(PERMISSIONS.COMMISSION_READ), commissionController.getPTCommissions);

// Sale commission — Sale/Manager/Admin đều có thể xem
router.get("/sale", protect, requirePermission(PERMISSIONS.COMMISSION_READ), commissionController.getSaleCommissions);

// Tổng hợp tháng — Manager/Admin/Accountant
router.get("/summary", protect, requirePermission(PERMISSIONS.COMMISSION_READ_ALL), commissionController.getCommissionSummary);

// === Workflow kỳ hoa hồng ===
// Danh sách kỳ
router.get("/periods", protect, requirePermission(PERMISSIONS.COMMISSION_READ), commissionController.getPeriods);

// Tạo kỳ hoa hồng
router.post("/period", protect, requirePermission(PERMISSIONS.COMMISSION_MANAGE), commissionController.createOrGetPeriod);

// Duyệt kỳ hoa hồng (Admin hoặc Accountant)
router.put("/period/:id/approve", protect, requirePermission(PERMISSIONS.COMMISSION_MANAGE), commissionController.approvePeriod);

// Đánh dấu đã thanh toán
router.put("/period/:id/pay", protect, requirePermission(PERMISSIONS.COMMISSION_MANAGE), commissionController.markPeriodPaid);

// Mở lại kỳ hoa hồng (nếu bấm lỡ chốt nhầm)
router.put("/period/:id/reopen", protect, requirePermission(PERMISSIONS.COMMISSION_MANAGE), commissionController.reopenPeriod);

// === Thu hồi ===
// Thu hồi hoa hồng theo hợp đồng (khi hủy HĐ)
router.put("/revoke/:customerPackageId", protect, requirePermission(PERMISSIONS.COMMISSION_REVOKE), commissionController.revokeByPackage);

module.exports = router;
