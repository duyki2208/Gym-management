const mongoose = require("mongoose");

const workoutSessionSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    // PT phụ trách buổi tập — liên kết trực tiếp đến User (role: pt)
    pt: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Giữ lại ptName để backward compat với dữ liệu cũ và hiển thị nhanh
    ptName: {
      type: String,
      required: true, // Tên PT hướng dẫn (ví dụ: PT Minh)
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // Lễ tân/Quản lý xác nhận
    },
    date: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["completed", "cancelled"],
      default: "completed",
    },
    note: {
      type: String,
    },
  },
  { timestamps: true }
);

workoutSessionSchema.index({ customer: 1 });
workoutSessionSchema.index({ date: -1 });
workoutSessionSchema.index({ pt: 1, date: -1 }); // Index mới cho aggregate hoa hồng PT

module.exports = mongoose.model("WorkoutSession", workoutSessionSchema);
