const AuditLog = require("../models/AuditLog");

const auditLogger = (req, res, next) => {
  // Chỉ log các request làm thay đổi dữ liệu: POST, PUT, DELETE
  if (!["POST", "PUT", "DELETE"].includes(req.method)) {
    return next();
  }

  // Bỏ qua một số route không cần thiết
  if (req.path.includes("/audit-logs") || req.path.includes("/pos/webhook")) {
    return next();
  }

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
        } else if (req.path.includes("/login") && req.body) {
          username = req.body.username || req.body.email || "Đăng nhập";
        }

        // Lọc bỏ password và thông tin nhạy cảm trước khi ghi log
        const details = { ...req.body };
        const sensitiveKeys = ["password", "token", "accessToken", "refreshToken", "faceDescriptor"];
        sensitiveKeys.forEach((key) => {
          if (details[key] !== undefined) {
            details[key] = "[FILTERED]";
          }
        });

        // Tạo nội dung action mô tả thân thiện
        let action = `${req.method} ${req.originalUrl}`;
        if (req.path.includes("/login")) {
          action = `Đăng nhập hệ thống`;
        } else if (req.path.includes("/customers")) {
          if (req.method === "POST") {
            if (req.path.includes("/freeze")) action = `Tạm dừng (Freeze) gói tập hội viên`;
            else if (req.path.includes("/unfreeze")) action = `Kích hoạt lại (Unfreeze) gói tập hội viên`;
            else action = `Thêm mới/Gia hạn hội viên`;
          }
          if (req.method === "PUT") action = `Cập nhật thông tin hội viên`;
          if (req.method === "DELETE") action = `Xóa hội viên`;
        } else if (req.path.includes("/pos")) {
          if (req.method === "POST" && req.path.includes("/checkout")) action = `Bán hàng lẻ tại POS`;
        }

        await AuditLog.create({
          user: userId,
          username,
          action,
          method: req.method,
          path: req.originalUrl || req.path,
          details,
          ipAddress: req.ip || req.connection.remoteAddress,
        });
      } catch (err) {
        console.error("Lỗi ghi nhận Audit Log:", err);
      }
    }
  });

  next();
};

module.exports = auditLogger;
