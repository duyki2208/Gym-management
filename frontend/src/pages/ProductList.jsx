import React, { useState, useEffect } from 'react';
import { productService } from '../services/productService';
import ProductModal from '../components/product/ProductModal';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Search, Edit, Trash2, Package } from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext';

const ProductList = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const navigate = useNavigate();
  const confirm = useConfirm();

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const data = await productService.getAll(search);
      setProducts(data);
    } catch (error) {
      toast.error('Lỗi khi tải danh sách sản phẩm');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchProducts(), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSave = async (data) => {
    try {
      if (selectedProduct) {
        await productService.update(selectedProduct._id, data);
        toast.success('Cập nhật thành công');
      } else {
        await productService.create(data);
        toast.success('Thêm mới thành công');
      }
      setShowModal(false);
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const handleDelete = async (id) => {
    const isConfirmed = await confirm({
      title: "Xóa sản phẩm",
      message: "Bạn có chắc chắn muốn xóa sản phẩm này không?",
      type: "danger"
    });
    if (isConfirmed) {
      try {
        await productService.delete(id);
        toast.success('Đã xóa sản phẩm thành công');
        fetchProducts();
      } catch (error) {
        toast.error('Không thể xóa sản phẩm');
      }
    }
  };

  return (
    <div className="flex flex-col gap-6 font-display bg-transparent h-full overflow-y-auto custom-scrollbar">
      {/* ── Card bao quanh: Search + Add Product ── */}
      <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-xl">
            search
          </span>
          <input
            className="w-full pl-10 pr-4 h-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm bg-white text-gray-800 transition-colors"
            placeholder="Tìm theo tên sản phẩm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1" />

        {/* Nút Thêm Sản Phẩm Mới */}
        <button
          onClick={() => {
            setSelectedProduct(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 h-10 px-4 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-90 shrink-0 shadow-sm transition-all"
        >
          <span
            className="material-symbols-outlined text-base"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            add_circle
          </span>
          <span>Thêm Sản Phẩm Mới</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {loading ? (
             <div className="col-span-full py-10 text-center text-gray-500">Đang tải...</div>
        ) : products.length > 0 ? (
             products.map((p) => (
                <div 
                  key={p._id} 
                  className="aspect-square bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all group flex flex-col justify-between relative overflow-hidden"
                >
                    {/* Header: Category & Action buttons */}
                    <div className="flex justify-between items-center gap-2 min-w-0">
                        <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md uppercase tracking-wider truncate shrink">
                          {p.category}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                             <button 
                               onClick={() => { setSelectedProduct(p); setShowModal(true); }} 
                               className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                               title="Sửa"
                             >
                               <Edit size={15}/>
                             </button>
                             <button 
                               onClick={() => handleDelete(p._id)} 
                               className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                               title="Xóa"
                             >
                               <Trash2 size={15}/>
                             </button>
                        </div>
                    </div>

                    {/* Middle: Icon + Product Name */}
                    <div className="flex flex-col items-center justify-center my-auto py-1 text-center min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary mb-2 group-hover:scale-110 transition-transform">
                            <Package size={22} />
                        </div>
                        <h3 className="font-bold text-sm text-gray-800 line-clamp-2 leading-snug px-1 break-words" title={p.name}>
                          {p.name}
                        </h3>
                    </div>

                    {/* Footer: Price & Stock */}
                    <div className="flex justify-between items-center pt-2.5 border-t border-gray-100 min-w-0">
                        <div className="min-w-0">
                            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Giá bán</p>
                            <p className="font-black text-xs sm:text-sm text-gray-900 truncate">{p.sellPrice.toLocaleString()} đ</p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Tồn kho</p>
                            <span className={`inline-block font-black px-2 py-0.5 rounded-md text-xs ${p.stockQuantity <= 10 ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                {p.stockQuantity}
                            </span>
                        </div>
                    </div>
                </div>
             ))
        ) : (
            <div className="col-span-full py-16 text-center text-gray-500">
                <Package size={48} className="mx-auto text-gray-300 mb-3" />
                <p>Không tìm thấy sản phẩm nào.</p>
            </div>
        )}
      </div>

      {showModal && (
        <ProductModal 
           product={selectedProduct}
           onSave={handleSave}
           onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

export default ProductList;
