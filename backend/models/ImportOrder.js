const mongoose = require('mongoose');

const importOrderSchema = new mongoose.Schema({
  supplier: { type: String, default: 'Nhà cung cấp lẻ' },
  totalAmount: { type: Number, required: true, default: 0 },
  details: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    importPrice: { type: Number, required: true } // Lưu lịch sử giá nhập lúc đó
  }],
  note: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('ImportOrder', importOrderSchema);
