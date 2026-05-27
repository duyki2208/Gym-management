const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    username: { type: String, default: "Hệ thống" },
    action: { type: String, required: true }, // mô tả ngắn gọn
    method: { type: String, required: true }, // GET, POST, PUT, DELETE...
    path: { type: String, required: true }, // Route thực thi
    details: { type: mongoose.Schema.Types.Mixed }, // JSON chi tiết về body/params (ẩn password)
    ipAddress: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);
