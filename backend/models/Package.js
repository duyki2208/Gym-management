const mongoose = require("mongoose");

const packageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    duration: { type: Number, required: true }, // số ngày
    price: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Package", packageSchema);
