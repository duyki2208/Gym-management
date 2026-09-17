import React, { useState, useEffect } from "react";
import { UserCog } from "lucide-react";
import BaseModal from "../common/BaseModal";
import FormField, { inputClassName } from "../common/FormField";
import Button from "../common/Button";

const StaffModal = ({ staff, onSave, onClose }) => {
  const formatDateForInput = (dateValue) => {
    if (!dateValue) return "";
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return "";
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
        password: "",
        role: staff.role || "pt",
        phone: staff.phone || "",
        dob: formatDateForInput(staff.dob),
        specialty: staff.specialty || "",
        activeCustomers: staff.activeCustomers || 0,
      });
    } else {
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
    const dataToSend = {
      fullName: formData.name,
      username: formData.username,
      role: formData.role,
      dob: formData.dob || undefined,
      phone: formData.phone || undefined,
      specialty: formData.specialty || undefined,
    };

    if (formData.password) {
      dataToSend.password = formData.password;
    }

    if (staff && staff._id) {
      dataToSend._id = staff._id;
    }

    onSave(dataToSend);
  };

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title={staff ? "Cập nhật nhân viên" : "Thêm nhân viên mới"}
      subtitle="Thiết lập tài khoản, vai trò và thông tin cá nhân của nhân sự"
      icon={<UserCog size={22} />}
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy bỏ
          </Button>
          <Button type="submit" form="staffModalForm" variant="primary">
            Lưu thông tin
          </Button>
        </>
      }
    >
      <form id="staffModalForm" onSubmit={handleSubmit} className="space-y-4">
        <FormField id="staff_name" label="Họ và tên" required>
          <input
            id="staff_name"
            name="name"
            type="text"
            required
            className={inputClassName}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Nguyễn Văn A"
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField id="staff_username" label="Tên đăng nhập" required>
            <input
              id="staff_username"
              name="username"
              type="text"
              required={!staff}
              disabled={!!staff}
              className={`${inputClassName} ${staff ? "opacity-75 cursor-not-allowed" : ""}`}
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              placeholder="username"
            />
          </FormField>

          <FormField
            id="staff_password"
            label={staff ? "Mật khẩu mới" : "Mật khẩu"}
            required={!staff}
          >
            <input
              id="staff_password"
              name="password"
              type="password"
              required={!staff}
              className={inputClassName}
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              placeholder={staff ? "Để trống nếu không đổi" : "••••••••"}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField id="staff_role" label="Chức vụ" required>
            <select
              id="staff_role"
              name="role"
              required
              className={inputClassName}
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              <option value="pt">PT</option>
              <option value="sale">Sale</option>
              <option value="reception">Lễ tân</option>
              <option value="sm">SM (Sale Manager)</option>
              <option value="pm">PM (PT Manager)</option>
              <option value="om">OM (Operation Manager)</option>
            </select>
          </FormField>

          <FormField id="staff_phone" label="Số điện thoại">
            <input
              id="staff_phone"
              name="phone"
              type="tel"
              className={inputClassName}
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              placeholder="0987654321"
            />
          </FormField>
        </div>

        <FormField id="staff_dob" label="Ngày sinh">
          <input
            id="staff_dob"
            name="dob"
            type="date"
            className={inputClassName}
            value={formData.dob}
            onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
          />
        </FormField>

        <FormField id="staff_specialty" label="Chuyên môn / Mô tả">
          <input
            id="staff_specialty"
            name="specialty"
            type="text"
            className={inputClassName}
            value={formData.specialty}
            onChange={(e) =>
              setFormData({ ...formData, specialty: e.target.value })
            }
            placeholder="Ví dụ: Giảm cân, Tăng cơ, Yoga..."
          />
        </FormField>
      </form>
    </BaseModal>
  );
};

export default StaffModal;
