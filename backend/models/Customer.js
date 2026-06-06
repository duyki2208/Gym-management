const mongoose = require("mongoose");

const customerSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true },
    phone: { type: String, required: true },
    dob: { type: Date }, // Ngày sinh
    gender: { type: String },
    address: { type: String },
    avatar: { type: String, default: "👤" }, // Icon mặc định

    // Thông tin gói tập
    packageType: { type: String, required: true }, // Tên gói (1 Tháng, 1 Năm...)
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
    activePackage: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerPackage' },

    // Các dịch vụ đi kèm
    trainer: { type: String, default: "" }, // Tên PT riêng
    assignedStaff: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Nhân viên tư vấn bán gói
    hasLocker: { type: Boolean, default: false },
    hasWater: { type: Boolean, default: false },
    healthNote: { type: String, default: "" }, // Ghi chú sức khỏe
    packageNote: { type: String, default: "" }, // Ghi chú gói tập
    email: { type: String, default: "" }, // Email
    price: { type: Number, default: 0 }, // Giá gói
    remainingSessions: { type: Number, default: 0 }, // Số buổi còn lại
    contractCode: { type: String, default: "" }, // Mã hợp đồng
    identityCard: { type: String, default: "" }, // Số CCCD
    emergencyContactName: { type: String, default: "" }, // Tên người liên hệ khẩn cấp
    emergencyContactPhone: { type: String, default: "" }, // SĐT người liên hệ khẩn cấp

    // Thanh toán và Nguồn khách
    paymentStatus: { type: String, enum: ['paid', 'deposit', 'unpaid'], default: 'paid' },
    paidAmount: { type: Number, default: 0 },
    contractType: { type: String, enum: ['new', 'renew', 'upgrade'], default: 'new' },

    // Sinh trắc học
    faceDescriptor: { type: [Number], default: [] }, // Vector 128 chiều
    // Trạng thái (Active/Inactive tính theo endDate ở Frontend hoặc Backend đều được)
  },
  {
    timestamps: true, // Tự động tạo createdAt, updatedAt
  }
);

// Middleware: Tự động sinh mã code nếu chưa có khi tạo mới
const Counter = require("./Counter");

// Middleware: Tự động sinh mã code nếu chưa có khi tạo mới
customerSchema.pre("validate", async function () {
  if (this.isNew && !this.code) {
    try {
      const counter = await Counter.findByIdAndUpdate(
        { _id: "customerId" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      // Format: KH + 4 digits (e.g., KH0001, KH0002...)
      this.code = "KH" + counter.seq.toString().padStart(4, "0");
    } catch (error) {
      throw error;
    }
  }
});

const Customer = mongoose.model("Customer", customerSchema);

module.exports = Customer;
