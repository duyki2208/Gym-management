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
      enum: ["admin", "accountant", "sm", "pm", "om", "pt", "sale", "reception", "manager"],
      default: "reception", // Mặc định là lễ tân cho an toàn
    },
    dob: { type: Date },
    phone: { type: String },
    specialty: { type: String },
    // -------------------------
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
