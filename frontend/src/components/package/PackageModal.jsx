import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const PackageModal = ({ pkg, onSave, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const [formData, setFormData] = useState(pkg || { 
    name: '', 
    type: 'monthly',
    category: 'maintenance',
    duration: 30, 
    price: 0 
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const duration = parseInt(formData.duration) || 0;
    const sessions = parseInt(formData.sessions) || 0;
    
    onSave({
      ...formData,
      type: formData.type,
      category: formData.category || 'maintenance',
      duration: duration,
      price: parseInt(formData.price) || 0,
      sessions: formData.type === 'session' ? sessions : 0 
    });
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg w-full max-w-md p-6 shadow-xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">{pkg ? 'Sửa Gói Tập' : 'Thêm Gói Mới'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <X className="text-gray-500" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="pkg_name" className="block text-sm font-medium mb-1.5 text-gray-700">Tên gói tập</label>
            <input 
              id="pkg_name"
              name="name"
              type="text" 
              required 
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pkg_type" className="block text-sm font-medium mb-1.5 text-gray-700">Hình thức tập</label>
              <select
                id="pkg_type"
                name="type"
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
                value={formData.type || 'monthly'}
                onChange={e => setFormData({...formData, type: e.target.value})}
              >
                <option value="monthly">Theo ngày</option>
                <option value="session">Theo buổi</option>
              </select>
            </div>

            <div>
              <label htmlFor="pkg_category" className="block text-sm font-medium mb-1.5 text-gray-700">Mục đích gói</label>
              <select
                id="pkg_category"
                name="category"
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm font-medium"
                value={formData.category || 'maintenance'}
                onChange={e => setFormData({...formData, category: e.target.value})}
              >
                <option value="maintenance">Gói duy trì </option>
                <option value="trial">Gói trải nghiệm</option>
              </select>
            </div>
          </div>
          
          {formData.type === 'session' && (
            <div className="animate-fade-in-up">
              <label htmlFor="pkg_sessions" className="block text-sm font-medium mb-1.5 text-gray-700">Tổng số buổi tập <span className="text-red-500">*</span></label>
              <input 
                id="pkg_sessions"
                name="sessions"
                type="number" 
                required 
                min="1"
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-900" 
                value={formData.sessions} 
                onChange={e => setFormData({...formData, sessions: e.target.value})} 
                placeholder="Ví dụ: 12" 
              />
            </div>
          )}

          <div>
            <label htmlFor="pkg_duration" className="block text-sm font-medium mb-1.5 text-gray-700">Thời hạn sử dụng gói (tính theo ngày)</label>
            <input 
              id="pkg_duration"
              name="duration"
              type="number" 
              required 
              min="1"
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
              value={formData.duration} 
              onChange={e => setFormData({...formData, duration: e.target.value})} 
              placeholder="Ví dụ: 90 ngày" 
            />
          </div>
          
          <div>
            <label htmlFor="pkg_price" className="block text-sm font-medium mb-1.5 text-gray-700">Giá bán (VNĐ)</label>
            <input 
              id="pkg_price"
              name="price"
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
            <button type="submit" className="px-5 py-2.5 bg-primary text-background-dark rounded-lg hover:bg-primary/90 font-bold shadow-lg shadow-primary/25 transition-colors">
              Lưu Gói Tập
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default PackageModal;