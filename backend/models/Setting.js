const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
    gymName: { type: String, default: "Gym Admin Fitness" },
    address: { type: String, default: "123 Đường ABC, Quận 1" },
    targetRevenue: { type: Number, default: 100000000 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Setting", settingSchema);
