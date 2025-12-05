const mongoose = require("mongoose");

const customerSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    dob: { type: Date }, // Ngày sinh
    gender: { type: String },
    address: { type: String },
    avatar: { type: String, default: "👤" }, // Icon mặc định

    // Thông tin gói tập
    packageType: { type: String, required: true }, // Tên gói (1 Tháng, 1 Năm...)
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },

    // Các dịch vụ đi kèm
    trainer: { type: String, default: "" }, // Tên PT riêng
    hasLocker: { type: Boolean, default: false },
    hasWater: { type: Boolean, default: false },
    healthNote: { type: String, default: "" }, // Ghi chú sức khỏe
    email: { type: String, default: "" }, // Email
    price: { type: Number, default: 0 }, // Giá gói
    remainingSessions: { type: Number, default: 0 }, // Số buổi còn lại

    // Trạng thái (Active/Inactive tính theo endDate ở Frontend hoặc Backend đều được)
  },
  {
    timestamps: true, // Tự động tạo createdAt, updatedAt
  }
);

const Customer = mongoose.model("Customer", customerSchema);

module.exports = Customer;
