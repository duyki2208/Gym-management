const mongoose = require("mongoose");

const packageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ["monthly", "session"], default: "monthly" }, // monthly | session
    duration: { type: Number, required: true }, // số ngày
    sessions: { type: Number, default: 0 }, // Tổng số buổi tối đa của gói
    price: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Package", packageSchema);
