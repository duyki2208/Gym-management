const router = require("express").Router();
const { getAuditLogs } = require("../controllers/auditController");
const { protect } = require("../middleware/authMiddleware");
const { PERMISSIONS, requirePermission } = require("../middleware/permissions");

// Chỉ có Admin hoặc Manager mới có quyền truy cập nhật ký hệ thống
router.get("/", protect, requirePermission(PERMISSIONS.AUDIT_READ), getAuditLogs);

module.exports = router;
