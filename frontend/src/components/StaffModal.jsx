import React, { useState, useEffect } from "react";
import { X } from "lucide-react";

const StaffModal = ({ staff, onSave, onClose }) => {
  // Hàm helper mạnh mẽ hơn để xử lý ngày tháng
  const formatDateForInput = (dateValue) => {
    if (!dateValue) return "";
    try {
      const date = new Date(dateValue);
      // Kiểm tra tính hợp lệ của ngày
      if (isNaN(date.getTime())) return "";
      // Trả về định dạng YYYY-MM-DD chuẩn cho input date
      return date.toISOString().split("T")[0];
    } catch (e) {
      return "";
    }
  };

  const [formData, setFormData] = useState({
    name: "",
    username: "",
    password: "",
    role: "pt",
    phone: "",
    dob: "",
    specialty: "",
    activeCustomers: 0,
  });

  useEffect(() => {
    if (staff) {
      setFormData({
        name: staff.fullName || staff.name || "",
        username: staff.username || "",
        password: "", // Không hiển thị password khi sửa
        role: staff.role || "pt",
        phone: staff.phone || "",
        dob: formatDateForInput(staff.dob),
        specialty: staff.specialty || "",
        activeCustomers: staff.activeCustomers || 0,
      });
    } else {
      // Reset form khi tạo mới
      setFormData({
        name: "",
        username: "",
        password: "",
        role: "pt",
        phone: "",
        dob: "",
        specialty: "",
        activeCustomers: 0,
      });
    }
  }, [staff]);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Chuẩn bị dữ liệu để gửi lên server
    const dataToSend = {
      fullName: formData.name,
      username: formData.username,
      role: formData.role,
      dob: formData.dob || undefined,
      phone: formData.phone || undefined,
      specialty: formData.specialty || undefined,
    };

    // Chỉ thêm password nếu có (khi tạo mới hoặc khi sửa và có nhập password mới)
    if (formData.password) {
      dataToSend.password = formData.password;
    }

    // Nếu đang sửa, thêm _id
    if (staff && staff._id) {
      dataToSend._id = staff._id;
    }

    onSave(dataToSend);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-lg w-full max-w-md p-6 shadow-xl relative">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">
            {staff ? "Cập nhật nhân viên" : "Thêm nhân viên mới"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Tên */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-700">
              Họ và tên <span className="text-red-500">*</span>
            </label>
            <input
              required
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Ví dụ: Nguyễn Văn A"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">
                Tên đăng nhập <span className="text-red-500">*</span>
              </label>
              <input
                required={!staff}
                disabled={!!staff}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:bg-gray-100 disabled:text-gray-500"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                placeholder="username"
              />
              {staff && (
                <p className="text-xs text-gray-500 mt-1">
                  Không thể thay đổi username
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">
                {staff
                  ? "Mật khẩu mới (để trống nếu không đổi)"
                  : 'Mật khẩu <span className="text-red-500">*</span>'}
              </label>
              <input
                type="password"
                required={!staff}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder={staff ? "Nhập mật khẩu mới..." : "Mật khẩu"}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Chức vụ */}
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">
                Chức vụ <span className="text-red-500">*</span>
              </label>
              <select
                required
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value })
                }
              >
                <option value="pt">PT (HLV)</option>
                <option value="sale">Sale</option>
                <option value="reception">Lễ tân</option>
                <option value="manager">Quản lý</option>
              </select>
            </div>

            {/* SĐT */}
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700">
                Số điện thoại
              </label>
              <input
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="09xx..."
              />
            </div>
          </div>

          {/* Ngày sinh */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-700">
              Ngày sinh
            </label>
            <input
              type="date"
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-700"
              value={formData.dob}
              onChange={(e) =>
                setFormData({ ...formData, dob: e.target.value })
              }
            />
          </div>

          {/* Chuyên môn */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-700">
              Chuyên môn / Mô tả
            </label>
            <input
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={formData.specialty}
              onChange={(e) =>
                setFormData({ ...formData, specialty: e.target.value })
              }
              placeholder="VD: Yoga, Bodybuilding..."
            />
          </div>

          <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-lg shadow-blue-500/30 transition-colors"
            >
              Lưu thông tin
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default StaffModal;
