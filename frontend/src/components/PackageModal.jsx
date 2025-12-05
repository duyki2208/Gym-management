import React, { useState } from 'react';
import { X } from 'lucide-react';

const PackageModal = ({ pkg, onSave, onClose }) => {
  const [formData, setFormData] = useState(pkg || { 
    name: '', 
    duration: 30, 
    price: 0 
    // sessions không cần init ở đây, sẽ tính khi save
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // LOGIC: Tự động gán số buổi (sessions) bằng số ngày (duration)
    const duration = parseInt(formData.duration) || 0;
    
    onSave({
      ...formData,
      duration: duration,
      price: parseInt(formData.price) || 0,
      sessions: duration // <-- Quan trọng: Gán buổi bằng ngày
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-lg w-full max-w-md p-6 shadow-xl animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">{pkg ? 'Sửa Gói Tập' : 'Thêm Gói Mới'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <X className="text-gray-500" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-700">Tên gói tập</label>
            <input 
              required 
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              placeholder="Ví dụ: Gói 1 tháng" 
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-700">Thời hạn (ngày)</label>
            <input 
              type="number" 
              required 
              min="1"
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
              value={formData.duration} 
              onChange={e => setFormData({...formData, duration: e.target.value})} 
              placeholder="30" 
            />
            <p className="text-xs text-gray-500 mt-1">Hệ thống sẽ tự động tạo số buổi tập tương ứng.</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-700">Giá bán (VNĐ)</label>
            <input 
              type="number" 
              required 
              min="0"
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-600" 
              value={formData.price} 
              onChange={e => setFormData({...formData, price: e.target.value})} 
              placeholder="500000" 
            />
          </div>
          
          <div className="flex justify-end gap-3 mt-8 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors">
              Hủy bỏ
            </button>
            <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-lg shadow-blue-500/30 transition-colors">
              Lưu Gói Tập
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default PackageModal;