const mongoose = require("mongoose");

/**
 * CommissionPeriod — Kỳ thanh toán hoa hồng theo tháng
 * Workflow: draft → pending → approved → paid
 *
 * - draft:    Đang tính toán, có thể chỉnh sửa
 * - pending:  Đã chốt sổ, chờ duyệt
 * - approved: Đã được admin/accountant duyệt
 * - paid:     Đã thanh toán cho nhân viên
 */
const commissionPeriodSchema = new mongoose.Schema(
  {
    month: { type: Number, required: true, min: 1, max: 12 },   // Tháng (1-12)
    year: { type: Number, required: true },                       // Năm
    type: {
      type: String,
      enum: ["pt", "sale"],
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "pending", "approved", "paid"],
      default: "draft",
    },

    // Tổng hợp
    totalAmount: { type: Number, default: 0 },    // Tổng hoa hồng phải trả trong kỳ
    totalRecords: { type: Number, default: 0 },    // Tổng số bản ghi hoa hồng

    // Duyệt
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },

    // Thanh toán
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    paidAt: { type: Date },

    note: { type: String, default: "" },
  },
  { timestamps: true }
);

// Mỗi tháng chỉ có 1 kỳ cho mỗi loại (pt/sale)
commissionPeriodSchema.index({ month: 1, year: 1, type: 1 }, { unique: true });

module.exports = mongoose.model("CommissionPeriod", commissionPeriodSchema);
