const express = require("express");
const router = express.Router();
const commissionController = require("../controllers/commissionController");
const { protect, authorize } = require("../middleware/authMiddleware");

// === Tra cứu hoa hồng ===
// PT commission — PT/Manager/Admin đều có thể xem
router.get("/pt", protect, commissionController.getPTCommissions);

// Sale commission — Sale/Manager/Admin đều có thể xem
router.get("/sale", protect, commissionController.getSaleCommissions);

// Tổng hợp tháng — Manager/Admin/Accountant
router.get("/summary", protect, authorize("admin", "manager", "accountant"), commissionController.getCommissionSummary);

// === Workflow kỳ hoa hồng ===
// Danh sách kỳ
router.get("/periods", protect, authorize("admin", "manager", "accountant"), commissionController.getPeriods);

// Tạo kỳ hoa hồng
router.post("/period", protect, authorize("admin", "accountant"), commissionController.createOrGetPeriod);

// Duyệt kỳ hoa hồng (Admin hoặc Accountant)
router.put("/period/:id/approve", protect, authorize("admin", "accountant"), commissionController.approvePeriod);

// Đánh dấu đã thanh toán
router.put("/period/:id/pay", protect, authorize("admin", "accountant"), commissionController.markPeriodPaid);

// === Thu hồi ===
// Thu hồi hoa hồng theo hợp đồng (khi hủy HĐ)
router.put("/revoke/:customerPackageId", protect, authorize("admin"), commissionController.revokeByPackage);

module.exports = router;
