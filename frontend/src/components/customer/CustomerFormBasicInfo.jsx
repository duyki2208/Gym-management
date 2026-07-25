import React from "react";
import { Upload, Image as ImageIcon } from "lucide-react";

const CustomerFormBasicInfo = ({ formData, handleChange, isEdit, onAvatarFileChange, avatarPreview }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-border-light dark:border-border-dark pb-2">
        1. Thông tin cơ bản hội viên
      </h3>

      {/* Upload Ảnh đại diện (Cloudinary Migration Support) */}
      <div className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-2xl border border-gray-300 dark:border-gray-600 flex-shrink-0">
          {avatarPreview ? (
            <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
          ) : formData.avatarUrl ? (
            <img src={formData.avatarUrl} alt="Cloudinary Avatar" className="w-full h-full object-cover" />
          ) : (
            <span>{formData.avatar || "👤"}</span>
          )}
        </div>
        
        <div className="flex-1">
          <label className="block text-xs font-semibold text-text-primary-light dark:text-text-primary-dark mb-1">
            Ảnh đại diện (Tải ảnh từ máy tính ➔ Cloudinary)
          </label>
          <div className="flex items-center gap-2">
            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-medium rounded-lg transition-colors">
              <Upload size={14} />
              <span>Chọn ảnh mới</span>
              <input 
                type="file" 
                accept="image/*" 
                onChange={onAvatarFileChange} 
                className="hidden" 
              />
            </label>
            <span className="text-[11px] text-gray-400">Tự động chuyển đổi Base64 sang CDN Cloudinary</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-1">
            Mã Khách Hàng <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            name="code"
            value={formData.code}
            onChange={handleChange}
            placeholder="Tự động sinh (KH0001)"
            className="w-full px-3 py-2 text-sm rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark focus:ring-2 focus:ring-primary outline-none"
            readOnly={isEdit}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-1">
            Họ và Tên <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Nguyễn Văn A"
            className="w-full px-3 py-2 text-sm rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark focus:ring-2 focus:ring-primary outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-1">
            Số Điện Thoại <span className="text-rose-500">*</span>
          </label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="0987654321"
            className="w-full px-3 py-2 text-sm rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark focus:ring-2 focus:ring-primary outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-1">
            Email
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="example@gmail.com"
            className="w-full px-3 py-2 text-sm rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark focus:ring-2 focus:ring-primary outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-1">
            Ngày Sinh
          </label>
          <input
            type="date"
            name="dob"
            value={formData.dob}
            onChange={handleChange}
            className="w-full px-3 py-2 text-sm rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark focus:ring-2 focus:ring-primary outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-1">
            Giới Tính
          </label>
          <select
            name="gender"
            value={formData.gender}
            onChange={handleChange}
            className="w-full px-3 py-2 text-sm rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark focus:ring-2 focus:ring-primary outline-none"
          >
            <option value="Nam">Nam</option>
            <option value="Nữ">Nữ</option>
            <option value="Khác">Khác</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default CustomerFormBasicInfo;
