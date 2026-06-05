const mongoose = require("mongoose");

const teamTaskSchema = new mongoose.Schema(
  {
    timeSlot: { type: String, required: true }, // Khung giờ (ví dụ: "08:00 - 10:00")
    task: { type: String, required: true },     // Nội dung công việc
    isCompleted: { type: Boolean, default: false }, // Trạng thái hoàn thành
    date: { type: String, required: true },      // Ngày thực hiện (Format: YYYY-MM-DD)
    team: { type: String, enum: ["sale", "pt", "reception"], default: "reception" } // Đội thực hiện
  },
  { timestamps: true }
);

// Tạo index để tìm kiếm nhanh theo ngày
teamTaskSchema.index({ date: 1 });

module.exports = mongoose.model("TeamTask", teamTaskSchema);
