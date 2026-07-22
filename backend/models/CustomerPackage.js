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
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // PT phụ trách (ObjectId)
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
    // Xóa mềm
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Middleware query tự động lọc các bản ghi bị xóa mềm (trừ khi gọi populate hoặc có tùy chọn withDeleted)
const queryMethods = ["find", "findOne", "findOneAndUpdate", "updateMany", "updateOne", "countDocuments"];
queryMethods.forEach((method) => {
  customerPackageSchema.pre(method, function () {
    const options = this.getOptions();
    if (options.withDeleted || options._populatePlanner) {
      return;
    }
    this.where({ isDeleted: { $ne: true } });
  });
});

// Middleware aggregation tự động lọc các bản ghi bị xóa mềm
customerPackageSchema.pre("aggregate", function () {
  this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
});

customerPackageSchema.index({ customer: 1 });
customerPackageSchema.index({ status: 1 });

module.exports = mongoose.model("CustomerPackage", customerPackageSchema);
