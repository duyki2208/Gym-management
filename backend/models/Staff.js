const mongoose = require("mongoose");

const staffSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ["PT", "Staff", "Manager"],
      default: "Staff",
    },
    phone: { type: String, required: true },
    specialty: { type: String, default: "" }, // Chuyên môn
    activeCustomers: { type: Number, default: 0 },
    shift: { type: String, default: "" }, // Ca làm việc
  },
  {
    timestamps: true, // Tự động tạo createdAt, updatedAt
  }
);

const Staff = mongoose.model("Staff", staffSchema);

module.exports = Staff;
