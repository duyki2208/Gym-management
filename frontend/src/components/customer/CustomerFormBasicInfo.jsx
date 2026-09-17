import React from "react";
import { Upload, User } from "lucide-react";
import FormField, { inputClassName } from "../common/FormField";

const CustomerFormBasicInfo = ({
  formData,
  handleChange,
  isEdit,
  onAvatarFileChange,
  avatarPreview,
}) => {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-border-light dark:border-border-dark pb-2">
        1. Thông tin cơ bản hội viên
      </h3>

      {/* Upload Ảnh đại diện */}
      <div className="flex items-center gap-4 p-3.5 bg-background-light dark:bg-background-dark/50 rounded-xl border border-dashed border-border-light dark:border-border-dark">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-2xl border border-gray-300 dark:border-gray-600 shrink-0">
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt="Avatar Preview"
              className="w-full h-full object-cover"
            />
          ) : formData.avatarUrl ? (
            <img
              src={formData.avatarUrl}
              alt="Cloudinary Avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-xl">{formData.avatar || "👤"}</span>
          )}
        </div>

        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Ảnh đại diện
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <label
              htmlFor="customerAvatarInput"
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 text-text-light dark:text-primary hover:bg-primary/25 text-xs font-bold rounded-xl transition-colors"
            >
              <Upload size={14} />
              <span>Chọn ảnh mới</span>
              <input
                id="customerAvatarInput"
                name="avatar"
                type="file"
                accept="image/*"
                onChange={onAvatarFileChange}
                className="hidden"
              />
            </label>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              Hỗ trợ ảnh JPG, PNG tự động tối ưu
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField id="cf_code" label="Mã Khách Hàng">
          <input
            id="cf_code"
            type="text"
            name="code"
            value={formData.code}
            onChange={handleChange}
            placeholder="Tự động sinh (KH0001)"
            className={`${inputClassName} ${isEdit ? "opacity-75 cursor-not-allowed" : ""}`}
            readOnly={isEdit}
          />
        </FormField>

        <FormField id="cf_name" label="Họ và Tên" required>
          <input
            id="cf_name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Nguyễn Văn A"
            className={inputClassName}
            required
          />
        </FormField>

        <FormField id="cf_phone" label="Số Điện Thoại" required>
          <input
            id="cf_phone"
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="0987654321"
            className={inputClassName}
            required
          />
        </FormField>

        <FormField id="cf_email" label="Email">
          <input
            id="cf_email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="example@gmail.com"
            className={inputClassName}
          />
        </FormField>

        <FormField id="cf_dob" label="Ngày Sinh">
          <input
            id="cf_dob"
            type="date"
            name="dob"
            value={formData.dob}
            onChange={handleChange}
            className={inputClassName}
          />
        </FormField>

        <FormField id="cf_gender" label="Giới Tính">
          <select
            id="cf_gender"
            name="gender"
            value={formData.gender}
            onChange={handleChange}
            className={inputClassName}
          >
            <option value="Nam">Nam</option>
            <option value="Nữ">Nữ</option>
            <option value="Khác">Khác</option>
          </select>
        </FormField>
      </div>
    </div>
  );
};

export default CustomerFormBasicInfo;
