import React, { useState, useEffect } from 'react';
import { productService } from '../services/productService';
import ProductModal from '../components/product/ProductModal';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Search, Edit, Trash2, Package, PlusCircle, PackageSearch } from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext';
import { getIconTone } from '../utils/iconTone';

const ProductList = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
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

  const filteredProducts = products.filter(
    (p) => selectedCategory === "all" || p.category === selectedCategory
  );

  return (
    <div className="flex flex-col gap-6 font-display bg-transparent h-full overflow-y-auto custom-scrollbar">
      {/* Page header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-light dark:bg-surface-dark p-5 rounded-xl border border-border-light dark:border-border-dark shadow-sm">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2.5 text-text-light dark:text-text-dark">
            <PackageSearch size={24} className="text-primary" /> Quản lý sản phẩm & dịch vụ
          </h2>
          <p className="text-subtle-light dark:text-subtle-dark text-sm mt-1">
            Theo dõi đồ uống, thực phẩm bổ sung, phụ kiện tập luyện và tồn kho chi nhánh
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedProduct(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 h-10 px-4 bg-primary text-text-light rounded-xl text-xs md:text-sm font-semibold hover:bg-primary/90 shrink-0 shadow-sm transition-all cursor-pointer"
        >
          <Plus size={18} />
          <span>Thêm sản phẩm</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex items-center gap-3 p-4 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={18} className="absolute left-3.5 top-3 text-gray-400" />
          <input
            id="productListSearchInput"
            name="productListSearch"
            type="text"
            aria-label="Tìm theo tên sản phẩm"
            className="w-full pl-10 pr-4 h-10 border border-border-light dark:border-border-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary text-sm bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark placeholder:text-gray-400 transition-colors"
            placeholder="Tìm theo tên sản phẩm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-48">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full h-10 px-3 text-xs font-bold rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-gray-700 dark:text-gray-300"
          >
            <option value="all">Tất cả danh mục</option>
            <option value="Đồ uống">Đồ uống</option>
            <option value="Thực phẩm bổ sung">Thực phẩm bổ sung</option>
            <option value="Dụng cụ tập">Dụng cụ tập</option>
            <option value="Khác">Khác</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
             <div className="col-span-full py-10 text-center text-subtle-light dark:text-subtle-dark">Đang tải...</div>
        ) : filteredProducts.length > 0 ? (
             filteredProducts.map((p) => (
                <div 
                  key={p._id} 
                  className="aspect-square bg-surface-light dark:bg-surface-dark rounded-xl p-4 border border-border-light dark:border-border-dark shadow-sm hover:shadow-md hover:border-primary/30 transition-all group flex flex-col justify-between relative overflow-hidden"
                >
                    {/* Header: Category & Action buttons */}
                    <div className="flex justify-between items-center gap-2 min-w-0">
                        <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md truncate shrink">
                          {p.category}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                             <button 
                               onClick={() => { setSelectedProduct(p); setShowModal(true); }} 
                               className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                               title="Sửa"
                             >
                               <Edit size={15}/>
                             </button>
                             <button 
                               onClick={() => handleDelete(p._id)} 
                               className="p-1 text-negative-light dark:text-negative-dark hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                               title="Xóa"
                             >
                               <Trash2 size={15}/>
                             </button>
                        </div>
                    </div>

                    {/* Middle: Icon + Product Name */}
                    <div className="flex flex-col items-center justify-center my-auto py-1 text-center min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 transition-transform ${getIconTone(Package)}`}>
                            <Package size={22} />
                        </div>
                        <h3 className="font-semibold text-sm text-text-light dark:text-text-dark line-clamp-2 leading-snug px-1 break-words" title={p.name}>
                          {p.name}
                        </h3>
                    </div>

                    {/* Footer: Price & Stock */}
                    <div className="flex justify-between items-center pt-2.5 border-t border-border-light dark:border-border-dark min-w-0">
                        <div className="min-w-0">
                            <p className="text-[10px] text-subtle-light dark:text-subtle-dark font-medium">Giá bán</p>
                            <p className="font-bold text-xs sm:text-sm text-text-light dark:text-text-dark truncate">{p.sellPrice.toLocaleString()} đ</p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-[10px] text-subtle-light dark:text-subtle-dark font-medium">Tồn kho</p>
                            <span className={`inline-block font-bold px-2 py-0.5 rounded-md text-xs ${p.stockQuantity <= 10 ? 'bg-red-50 dark:bg-red-950/50 text-negative-light dark:text-negative-dark border border-red-200 dark:border-red-900/50' : 'bg-emerald-50 dark:bg-emerald-950/50 text-positive-light dark:text-positive-dark border border-emerald-200 dark:border-emerald-900/50'}`}>
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
