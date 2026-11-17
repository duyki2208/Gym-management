const AuditLog = require("../models/AuditLog");
const { sanitizeAuditValue, auditPath } = require("../utils/auditSanitizer");
const logger = require("../utils/logger");

const auditLogger = (req, res, next) => {
  // Include PATCH confirmations/cancellations in the mutation audit trail.
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return next();
  }

  // Bỏ qua một số route không cần thiết
  if (/^\/(?:audit-logs|pos\/webhook)(?:\/|$)/i.test(req.path)) {
    return next();
  }
  // Express rewrites req.url/path while nested routers finish the response.
  const routePath = req.path;
  const path = auditPath(req.originalUrl || routePath);

  res.on("finish", async () => {
    // Chỉ ghi log khi request thành công (status code 2xx)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        let userId = null;
        let username = "Hệ thống";

        // Lấy thông tin user từ middleware protect (nếu có)
        if (req.user) {
          userId = req.user._id;
          username = req.user.name || req.user.username || req.user.email || "Nhân viên";
        } else if (routePath.includes("/login") && req.body) {
          username = req.body.username || req.body.email || "Đăng nhập";
        }

        // Lọc bỏ password và thông tin nhạy cảm trước khi ghi log
        const details = sanitizeAuditValue(
          req.method === "DELETE" && req.deletedCustomerDetails
            ? req.deletedCustomerDetails : (req.body || {})
        );

        // Tạo nội dung action mô tả thân thiện
        let action = `${req.method} ${path}`;
        if (routePath.includes("/login")) {
          action = `Đăng nhập hệ thống`;
        } else if (routePath.includes("/customers")) {
          if (req.method === "POST") {
            if (routePath.includes("/freeze")) action = `Tạm dừng (Freeze) gói tập hội viên`;
            else if (routePath.includes("/unfreeze")) action = `Kích hoạt lại (Unfreeze) gói tập hội viên`;
            else action = `Thêm mới/Gia hạn hội viên`;
          }
          if (req.method === "PUT") action = `Cập nhật thông tin hội viên`;
          if (req.method === "DELETE") action = `Xóa hội viên`;
        } else if (routePath.includes("/pos")) {
          if (req.method === "POST" && routePath.includes("/checkout")) action = `Bán hàng lẻ tại POS`;
          if (req.method === "PATCH" && /\/orders\/[^/]+\/confirm\/?$/.test(routePath)) action = "Xác nhận thanh toán POS";
          if (req.method === "PATCH" && /\/orders\/[^/]+\/cancel\/?$/.test(routePath)) action = "Hủy đơn hàng POS";
        }

        const AuditLogModel = req.models?.AuditLog || AuditLog;
        await AuditLogModel.create({
          user: userId,
          username,
          action,
          method: req.method,
          path,
          details,
          statusCode: res.statusCode,
          requestId: req.id,
          ipAddress: req.ip || req.connection?.remoteAddress,
        });
      } catch (err) {
        logger.error("audit_log_write_failed", { requestId: req.id, errorName: err.name, errorCode: err.code });
      }
    }
  });

  next();
};

module.exports = auditLogger;
