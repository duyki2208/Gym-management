const mongoose = require("mongoose");

const scheduleSchema = new mongoose.Schema({
  staff: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: String, required: true }, // Format: YYYY-MM-DD
  shiftType: { type: String, enum: ["Sáng", "Chiều", "Hành chính", "Nghỉ"], required: true }
}, { timestamps: true });

// Ensure a staff member only has one shift per day
scheduleSchema.index({ staff: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Schedule", scheduleSchema);
