const mongoose = require("mongoose");

const customerPackageSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    package: { type: mongoose.Schema.Types.ObjectId, ref: "Package" },
    packageName: { type: String, required: true }, // Tên gói (e.g. "Gói 1 Tháng", "PT 12 Buổi")
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    price: { type: Number, required: true, default: 0 },
    contractCode: { type: String, required: true, default: "HĐ-CŨ" }, // Mã hợp đồng
    packageNote: { type: String, default: "" }, // Ghi chú gói tập
    remainingSessions: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "expired", "frozen", "pending"],
      default: "active",
    },
    trainer: { type: String, default: "" }, // Tên PT riêng (nếu có)
    assignedStaff: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Nhân viên bán gói
    hasLocker: { type: Boolean, default: false },
    hasWater: { type: Boolean, default: false },
    contractType: {
      type: String,
      enum: ["new", "renew", "upgrade"],
      default: "new",
    },
    paymentStatus: {
      type: String,
      enum: ["paid", "deposit", "unpaid"],
      default: "paid",
    },
    paidAmount: { type: Number, default: 0 },
    frozenPeriods: [
      {
        startDate: { type: Date, required: true },
        endDate: { type: Date },
        reason: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

customerPackageSchema.index({ customer: 1 });
customerPackageSchema.index({ status: 1 });

module.exports = mongoose.model("CustomerPackage", customerPackageSchema);
