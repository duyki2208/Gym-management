import React, { useState } from 'react';
import { X } from 'lucide-react';

const StaffModal = ({ staff, onSave, onClose }) => {
  const [formData, setFormData] = useState(staff || {
    name: '',
    role: 'PT',
    phone: '',
    specialty: '',
    activeCustomers: 0
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">{staff ? 'Sửa Nhân Viên' : 'Thêm Nhân Viên'}</h2>
          <button onClick={onClose}><X className="text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Họ tên</label>
            <input required className="w-full p-2 border rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Chức vụ</label>
              <select className="w-full p-2 border rounded" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                <option value="PT">PT (HLV)</option>
                <option value="Staff">Nhân viên</option>
                <option value="Manager">Quản lý</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Số điện thoại</label>
              <input required className="w-full p-2 border rounded" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Chuyên môn / Mô tả</label>
            <input className="w-full p-2 border rounded" value={formData.specialty} onChange={e => setFormData({...formData, specialty: e.target.value})} placeholder="VD: Yoga, Bodybuilding..." />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded">Hủy</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Lưu</button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default StaffModal;