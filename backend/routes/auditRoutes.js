const router = require("express").Router();
const { getAuditLogs } = require("../controllers/auditController");
const { protect, authorize } = require("../middleware/authMiddleware");

// Chỉ có Admin hoặc Manager mới có quyền truy cập nhật ký hệ thống
router.get("/", protect, authorize("admin", "manager"), getAuditLogs);

module.exports = router;
