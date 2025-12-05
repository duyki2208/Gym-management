const mongoose = require('mongoose');

const checkInSchema = mongoose.Schema(
  {
    customerId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Customer', // Liên kết với bảng Customer
      required: true 
    },
    customerName: { type: String, required: true }, // Lưu đệm tên để đỡ phải query lại
    customerCode: { type: String, required: true },
    packageType: { type: String },
    time: { type: Date, default: Date.now }, // Thời gian check-in
  },
  {
    timestamps: true,
  }
);

const CheckIn = mongoose.model('CheckIn', checkInSchema);

module.exports = CheckIn;