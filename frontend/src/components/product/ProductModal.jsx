import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Package } from "lucide-react";
import BaseModal from "../common/BaseModal";
import FormField, { inputClassName } from "../common/FormField";
import Button from "../common/Button";

const ProductModal = ({ product, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: "",
    category: "Đồ uống",
    importPrice: 0,
    sellPrice: 0,
    stockQuantity: 0,
    imageUrl: "",
    description: "",
  });

  useEffect(() => {
    if (product) {
      setFormData(product);
    }
  }, [product]);

  const handleNumberChange = (field, val) => {
    setFormData((prev) => ({
      ...prev,
      [field]: val === "" ? "" : Math.max(0, Number(val)),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalData = {
      ...formData,
      stockQuantity: Number(formData.stockQuantity) || 0,
      importPrice: Number(formData.importPrice) || 0,
      sellPrice: Number(formData.sellPrice) || 0,
    };
    if (!finalData.name || finalData.sellPrice < 0) {
      toast.error("Vui lòng điền thông tin hợp lệ");
      return;
    }
    onSave(finalData);
  };

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title={product ? "Sửa sản phẩm" : "Thêm sản phẩm mới"}
      subtitle="Thiết lập tên, giá bán và quản lý tồn kho sản phẩm"
      icon={<Package size={22} />}
      maxWidth="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy bỏ
          </Button>
          <Button type="submit" form="productModalForm" variant="primary">
            Lưu Sản Phẩm
          </Button>
        </>
      }
    >
      <form id="productModalForm" onSubmit={handleSubmit} className="space-y-4">
        <FormField id="prod_name" label="Tên sản phẩm" required>
          <input
            id="prod_name"
            name="name"
            type="text"
            className={inputClassName}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="Ví dụ: Nước khoáng Lavie 500ml"
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField id="prod_category" label="Phân loại">
            <select
              id="prod_category"
              name="category"
              className={inputClassName}
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
            >
              <option value="Đồ uống">Đồ uống</option>
              <option value="Thực phẩm bổ sung">Thực phẩm bổ sung</option>
              <option value="Dụng cụ tập">Dụng cụ tập</option>
              <option value="Khác">Khác</option>
            </select>
          </FormField>

          <FormField id="prod_stockQuantity" label="Tồn kho ban đầu">
            <input
              id="prod_stockQuantity"
              name="stockQuantity"
              type="number"
              min="0"
              className={`${inputClassName} ${product ? "opacity-75 cursor-not-allowed" : ""}`}
              value={formData.stockQuantity}
              onChange={(e) =>
                handleNumberChange("stockQuantity", e.target.value)
              }
              disabled={!!product}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField id="prod_importPrice" label="Giá nhập (VNĐ)">
            <input
              id="prod_importPrice"
              name="importPrice"
              type="number"
              min="0"
              className={inputClassName}
              value={formData.importPrice}
              onChange={(e) =>
                handleNumberChange("importPrice", e.target.value)
              }
            />
          </FormField>

          <FormField id="prod_sellPrice" label="Giá bán (VNĐ)" required>
            <input
              id="prod_sellPrice"
              name="sellPrice"
              type="number"
              min="0"
              className={`${inputClassName} font-bold text-primary`}
              value={formData.sellPrice}
              onChange={(e) => handleNumberChange("sellPrice", e.target.value)}
              required
            />
          </FormField>
        </div>
      </form>
    </BaseModal>
  );
};

export default ProductModal;
