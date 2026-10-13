import React, { useState, useEffect, useCallback } from 'react';
import { productService } from '../services/productService';
import ProductModal from '../components/product/ProductModal';
import toast from 'react-hot-toast';
import { Plus, Download, Search, Edit, Trash2, Package, PlusCircle, PackageSearch } from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext';
import { getIconTone } from '../utils/iconTone';
import PageHeader from '../components/common/PageHeader';

const ProductList = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const confirm = useConfirm();

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await productService.getAll(search);
      setProducts(data);
    } catch {
      toast.error('Lỗi khi tải danh sách sản phẩm');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => fetchProducts(), 500);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

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
      } catch {
        toast.error('Không thể xóa sản phẩm');
      }
    }
  };

  const filteredProducts = products.filter(
    (p) => selectedCategory === "all" || p.category === selectedCategory
  );

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto bg-transparent font-display custom-scrollbar">
      <PageHeader
        meta="Cửa hàng & kho"
        title="Sản phẩm và tồn kho"
        description="Theo dõi danh mục bán lẻ, giá bán và lượng hàng hiện có tại chi nhánh."
        icon={PackageSearch}
        actions={(
        <button
          onClick={() => {
            setSelectedProduct(null);
            setShowModal(true);
          }}
          className="flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-text-light transition-colors hover:bg-primary/90"
        >
          <Plus size={18} />
          <span>Thêm sản phẩm</span>
        </button>
        )}
      />

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border-light bg-surface-light p-3 dark:border-border-dark dark:bg-surface-dark">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={18} className="absolute left-3.5 top-3 text-gray-400" />
          <input
            id="productListSearchInput"
            name="productListSearch"
            type="text"
            aria-label="Tìm theo tên sản phẩm"
            className="h-10 w-full rounded-lg border border-border-light bg-background-light pl-10 pr-4 text-sm text-text-light outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-background-dark dark:text-text-dark"
            placeholder="Tìm theo tên sản phẩm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-48">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-10 w-full rounded-lg border border-border-light bg-background-light px-3 text-sm font-medium text-gray-700 dark:border-border-dark dark:bg-background-dark dark:text-gray-300"
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
                  className="group relative flex aspect-square flex-col justify-between overflow-hidden rounded-lg border border-border-light bg-surface-light p-4 transition-colors hover:border-primary/40 dark:border-border-dark dark:bg-surface-dark"
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
