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
      <div className="flex justify-end gap-3 mb-2">
          {/* Nút Thêm SP */}
          <button
            onClick={() => {
              setSelectedProduct(null);
              setShowModal(true);
            }}
            className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold hover:bg-primary/90 flex items-center gap-2 shadow-lg shadow-primary/20 transition-all"
          >
            <Plus size={20} />
            Thêm Sản Phẩm Mới
          </button>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
         <Search className="text-gray-400" />
         <input 
            type="text" 
            placeholder="Tìm theo tên sản phẩm..."
            className="w-full bg-transparent outline-none text-gray-700"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
         />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
             <div className="col-span-full py-10 text-center text-gray-500">Đang tải...</div>
        ) : products.length > 0 ? (
             products.map((p) => (
                <div key={p._id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between min-w-0 w-full">
                    <div>
                        <div className="h-40 bg-gray-50 rounded-xl mb-4 overflow-hidden flex items-center justify-center">
                            {p.imageUrl ? (
                                <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            ) : (
                                <Package size={48} className="text-gray-300" />
                            )}
                        </div>
                        <div className="flex justify-between items-start mb-2 gap-2 min-w-0">
                            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-md uppercase tracking-wider truncate shrink-0">{p.category}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                 <button onClick={() => { setSelectedProduct(p); setShowModal(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded text-sm"><Edit size={16}/></button>
                                 <button onClick={() => handleDelete(p._id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded text-sm"><Trash2 size={16}/></button>
                            </div>
                        </div>
                        <h3 className="font-bold text-base text-gray-800 leading-snug mb-1 line-clamp-2 min-h-[3rem] flex items-center break-words" title={p.name}>{p.name}</h3>
                    </div>
                    <div className="flex justify-between items-end mt-4 gap-2 border-t border-gray-50 pt-3 min-w-0">
                        <div className="min-w-0">
                            <p className="text-xs text-gray-500 mb-0.5 break-words">Giá bán</p>
                            <p className="font-black text-gray-900 border-b-2 border-primary/20 pb-0.5 inline-block break-words break-all">{p.sellPrice.toLocaleString()} đ</p>
                        </div>
                        <div className={`text-right min-w-0 ${p.stockQuantity <= 10 ? 'text-red-600' : 'text-green-600'}`}>
                            <p className="text-xs mb-0.5 break-words">Tồn kho</p>
                            <p className="font-black text-lg bg-gray-50 px-2 py-0.5 rounded-md break-words break-all">{p.stockQuantity}</p>
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
