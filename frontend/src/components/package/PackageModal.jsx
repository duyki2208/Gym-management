import React, { useState, useEffect } from "react";
import { Package } from "lucide-react";
import BaseModal from "../common/BaseModal";
import FormField, { inputClassName } from "../common/FormField";
import Button from "../common/Button";

const PackageModal = ({ pkg, onSave, onClose }) => {
  const [formData, setFormData] = useState(
    pkg || {
      name: "",
      type: "monthly",
      category: "maintenance",
      duration: 30,
      price: 0,
      sessions: 0,
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    const duration = parseInt(formData.duration) || 0;
    const sessions = parseInt(formData.sessions) || 0;

    onSave({
      ...formData,
      type: formData.type,
      category: formData.category || "maintenance",
      duration: duration,
      price: parseInt(formData.price) || 0,
      sessions: formData.type === "session" ? sessions : 0,
    });
  };

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title={pkg ? "Cập nhật gói tập" : "Thêm gói tập mới"}
      subtitle="Cấu hình tên gói, hình thức tập, thời hạn và đơn giá"
      icon={<Package size={22} />}
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy bỏ
          </Button>
          <Button type="submit" form="packageModalForm" variant="primary">
            Lưu Gói Tập
          </Button>
        </>
      }
    >
      <form id="packageModalForm" onSubmit={handleSubmit} className="space-y-4">
        <FormField id="pkg_name" label="Tên gói tập" required>
          <input
            id="pkg_name"
            name="name"
            type="text"
            required
            placeholder="Ví dụ: Gói 3 Tháng Tiết Kiệm"
            className={inputClassName}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField id="pkg_type" label="Hình thức tập" required>
            <select
              id="pkg_type"
              name="type"
              className={inputClassName}
              value={formData.type || "monthly"}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              <option value="monthly">Theo ngày (Tháng)</option>
              <option value="session">Theo buổi (PT)</option>
            </select>
          </FormField>

          <FormField id="pkg_category" label="Mục đích gói">
            <select
              id="pkg_category"
              name="category"
              className={inputClassName}
              value={formData.category || "maintenance"}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
            >
              <option value="maintenance">Gói duy trì</option>
              <option value="trial">Gói trải nghiệm</option>
            </select>
          </FormField>
        </div>

        {formData.type === "session" && (
          <FormField id="pkg_sessions" label="Tổng số buổi tập" required>
            <input
              id="pkg_sessions"
              name="sessions"
              type="number"
              required
              min="1"
              className={`${inputClassName} font-bold`}
              value={formData.sessions || ""}
              onChange={(e) =>
                setFormData({ ...formData, sessions: e.target.value })
              }
              placeholder="Ví dụ: 12 hoặc 24"
            />
          </FormField>
        )}

        <FormField id="pkg_duration" label="Thời hạn sử dụng (ngày)" required>
          <input
            id="pkg_duration"
            name="duration"
            type="number"
            required
            min="1"
            className={inputClassName}
            value={formData.duration}
            onChange={(e) =>
              setFormData({ ...formData, duration: e.target.value })
            }
            placeholder="Ví dụ: 30, 90, 365"
          />
        </FormField>

        <FormField id="pkg_price" label="Giá bán (VNĐ)" required>
          <input
            id="pkg_price"
            name="price"
            type="number"
            required
            min="0"
            className={`${inputClassName} font-bold text-primary`}
            value={formData.price}
            onChange={(e) =>
              setFormData({ ...formData, price: e.target.value })
            }
            placeholder="500000"
          />
        </FormField>
      </form>
    </BaseModal>
  );
};

export default PackageModal;