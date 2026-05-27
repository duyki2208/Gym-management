const mongoose = require('mongoose');

const saleOrderSchema = new mongoose.Schema({
  customer: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Customer', // Link đến ID hội viên 
    default: null 
  },
  isWalkIn: { type: Boolean, default: true },
  totalAmount: { type: Number, required: true, default: 0 },
  paymentMethod: { 
    type: String, 
    enum: ['Tiền mặt', 'Chuyển khoản QR'],
    default: 'Chuyển khoản QR' 
  },
  status: {
    type: String,
    enum: ['Chờ thanh toán', 'Đã thanh toán', 'Đã huỷ'],
    default: 'Đã thanh toán'
  },
  details: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    sellPrice: { type: Number, required: true } // Giá chốt lúc khách mua
  }],
  note: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('SaleOrder', saleOrderSchema);
