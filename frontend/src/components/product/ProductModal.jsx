import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const ProductModal = ({ product, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    category: 'Đồ uống',
    importPrice: 0,
    sellPrice: 0,
    stockQuantity: 0,
    imageUrl: '',
    description: ''
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (product) {
      setFormData(product);
    }
  }, [product]);

  const handleNumberChange = (field, val) => {
    setFormData((prev) => ({
      ...prev,
      [field]: val === '' ? '' : Math.max(0, Number(val))
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalData = {
      ...formData,
      stockQuantity: Number(formData.stockQuantity) || 0,
      importPrice: Number(formData.importPrice) || 0,
      sellPrice: Number(formData.sellPrice) || 0
    };
    if (!finalData.name || finalData.sellPrice < 0) {
      toast.error("Vui lòng điền thông tin hợp lệ");
      return;
    }
    onSave(finalData);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-xl font-bold text-gray-800">
            {product ? 'Sửa Sản Phẩm' : 'Thêm Sản Phẩm Mới'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Tên sản phẩm *</label>
            <input
              type="text"
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Phân loại</label>
              <select
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none bg-white"
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
              >
                <option value="Đồ uống">Đồ uống</option>
                <option value="Thực phẩm bổ sung">Thực phẩm bổ sung</option>
                <option value="Dụng cụ tập">Dụng cụ tập</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Tồn kho ban đầu</label>
              <input
                type="number"
                min="0"
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                value={formData.stockQuantity}
                onChange={(e) => handleNumberChange('stockQuantity', e.target.value)}
                disabled={!!product} // Chỉ cho nhập lúc tạo mới, sau này phải qua phiếu nhập
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Giá nhập (VNĐ)</label>
              <input
                type="number"
                min="0"
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                value={formData.importPrice}
                onChange={(e) => handleNumberChange('importPrice', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Giá bán (VNĐ) *</label>
              <input
                type="number"
                min="0"
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                value={formData.sellPrice}
                onChange={(e) => handleNumberChange('sellPrice', e.target.value)}
                required
              />
            </div>
          </div>



          <div className="pt-4 flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl font-bold bg-primary text-white hover:bg-primary/90 transition-colors shadow-lg shadow-primary/30"
            >
              Lưu Sản Phẩm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductModal;
