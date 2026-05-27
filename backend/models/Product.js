const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['Đồ uống', 'Thực phẩm bổ sung', 'Dụng cụ tập', 'Khác'],
    default: 'Đồ uống'
  },
  importPrice: { type: Number, required: true, default: 0 },
  sellPrice: { type: Number, required: true, default: 0 },
  stockQuantity: { type: Number, required: true, default: 0 },
  imageUrl: { type: String, default: '' },
  description: { type: String }
}, { timestamps: true });

// Tự động tìm kiếm bằng index trên field name
productSchema.index({ name: 'text' });

module.exports = mongoose.model('Product', productSchema);
