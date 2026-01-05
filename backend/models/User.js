const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    fullName: {
      type: String,
    },
    // --- CẬP NHẬT ROLE MỚI ---
    role: {
      type: String,
      // Danh sách các quyền hợp lệ trong hệ thống của bạn
      enum: ["admin", "manager", "pt", "sale", "reception"],
      default: "reception", // Mặc định là lễ tân cho an toàn
    },
    dob: { type: Date },
    // -------------------------
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
