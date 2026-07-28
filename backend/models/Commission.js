const mongoose = require("mongoose");

/**
 * Commission — Bản ghi hoa hồng chi tiết cho từng giao dịch
 *
 * Loại PT:  Mỗi buổi dạy tạo 1 bản ghi, amount = sessionPrice × rate%
 * Loại Sale: Mỗi hợp đồng bán tạo 1 bản ghi, amount = packagePrice × rate%
 */
const commissionSchema = new mongoose.Schema(
  {
    // Loại hoa hồng
    type: {
      type: String,
      enum: ["pt", "sale"],
      required: true,
    },

    // Nhân viên được tính hoa hồng
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Kỳ thanh toán
    period: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommissionPeriod",
    },

    // === Thông tin tính toán ===
    amount: { type: Number, required: true, default: 0 },     // Số tiền hoa hồng
    rate: { type: Number, required: true },                     // % hoa hồng áp dụng
    baseAmount: { type: Number, required: true, default: 0 },  // Giá trị gốc (giá buổi PT hoặc giá trị HĐ)

    // === Nguồn gốc (Reference) ===
    // Cho PT: liên kết đến WorkoutSession
    workoutSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkoutSession",
    },
    // Cho Sale: liên kết đến CustomerPackage (hợp đồng)
    customerPackage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomerPackage",
    },
    // Loại hợp đồng (chỉ dùng cho Sale)
    contractType: {
      type: String,
      enum: ["new", "renew", "upgrade", "upgrade_delta", "upgrade_full_recalc", "upgrade_adjustment_minus"],
    },

    // Liên kết ngược về bản ghi hoa hồng gốc (khi tạo bút toán điều chỉnh)
    originalCommission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Commission",
    },

    // Khách hàng liên quan
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },

    // Tháng/năm tính hoa hồng (để aggregate nhanh)
    month: { type: Number, required: true },
    year: { type: Number, required: true },

    // Trạng thái duyệt chi
    approvalStatus: {
      type: String,
      enum: ["pending", "approved"],
      default: "pending",
    },

    // Trạng thái
    status: {
      type: String,
      enum: ["active", "revoked"],    // revoked = thu hồi (khi hủy HĐ)
      default: "active",
    },
    revokedReason: { type: String },   // Lý do thu hồi
    revokedAt: { type: Date },
    revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Indexes cho aggregate hiệu quả
commissionSchema.index({ staff: 1, month: 1, year: 1 });
commissionSchema.index({ type: 1, month: 1, year: 1 });
commissionSchema.index({ period: 1 });
commissionSchema.index({ customerPackage: 1 });
commissionSchema.index({ workoutSession: 1 });

module.exports = mongoose.model("Commission", commissionSchema);
