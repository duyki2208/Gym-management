import React, { useState, useEffect } from 'react';
import { productService, inventoryService } from '../services/productService';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Search } from 'lucide-react';

const ImportGoods = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [supplier, setSupplier] = useState('');
  const [note, setNote] = useState('');
  const [importDetails, setImportDetails] = useState([]); // { product: obj, quantity, importPrice }

  useEffect(() => {
    const fetchProds = async () => {
      try {
        const data = await productService.getAll(searchTerm);
        setProducts(data);
      } catch(e) {}
    };
    const t = setTimeout(() => fetchProds(), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const addProductToImport = (p) => {
    const existing = importDetails.find(item => item.product._id === p._id);
    if (existing) {
       toast.error("Sản phẩm đã có trong danh sách nhập");
       return;
    }
    setImportDetails([...importDetails, { product: p, quantity: 1, importPrice: p.importPrice || 0 }]);
  };

  const updateDetail = (idx, field, value) => {
    const newDetails = [...importDetails];
    newDetails[idx][field] = value === '' ? '' : Math.max(0, Number(value));
    setImportDetails(newDetails);
  };

  const removeDetail = (idx) => {
    setImportDetails(importDetails.filter((_, i) => i !== idx));
  };

  const calculateTotal = () => {
    return importDetails.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.importPrice) || 0)), 0);
  };

  const handleSave = async () => {
    if (importDetails.length === 0) {
      toast.error('Chưa có sản phẩm nào để nhập');
      return;
    }
    try {
      const payload = {
        supplier: supplier || 'Nhà cung cấp lẻ',
        note,
        details: importDetails.map(d => ({
           product: d.product._id,
           quantity: Number(d.quantity) || 1,
           importPrice: Number(d.importPrice) || 0
        }))
      };
      await inventoryService.importGoods(payload);
      toast.success('Nhập kho thành công!');
      navigate('/products');
    } catch(err) {
      toast.error('Lỗi khi lưu phiếu nhập');
    }
  };

  return (
    <div className="flex flex-col gap-6 font-display h-full bg-transparent">
      <div className="flex justify-end p-2">
         <button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-text-light px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all">
             <Save size={20} />
             Xác Nhận & Lưu Phiếu Nhập
         </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-250px)] min-h-[520px]">
         {/* Left Side: Product Selection */}
         <div className="lg:col-span-1 bg-surface-light dark:bg-surface-dark rounded-xl p-5 shadow-sm border border-border-light dark:border-border-dark flex flex-col h-[70vh]">
             <h3 className="font-bold text-text-light dark:text-text-dark mb-4 bg-background-light dark:bg-background-dark p-2 rounded-lg text-center border border-border-light dark:border-border-dark">Tìm Sản Phẩm</h3>
             <div className="relative mb-4">
                 <Search className="absolute left-3 top-3 text-subtle-light dark:text-subtle-dark" size={18} />
                 <input 
                    id="import_search_product"
                    name="importSearchProduct"
                    type="text" 
                    placeholder="Tên sản phẩm..."
                    aria-label="Tìm sản phẩm để nhập kho"
                    className="w-full pl-9 pr-3 py-2.5 border border-border-light dark:border-border-dark rounded-lg outline-none focus:ring-2 focus:ring-primary bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark placeholder:text-subtle-light dark:placeholder:text-subtle-dark text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                 />
             </div>
             
             <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                 {products.map(p => (
                    <div key={p._id} className="p-3 border border-border-light dark:border-border-dark rounded-lg flex items-center justify-between hover:bg-background-light dark:hover:bg-background-dark transition-colors">
                       <div className="flex gap-3 items-center">
                          <img src={p.imageUrl || "https://placehold.co/100x100?text=SP"} alt="" className="w-10 h-10 rounded-md object-cover" />
                          <div>
                             <p className="font-bold text-sm text-text-light dark:text-text-dark line-clamp-1">{p.name}</p>
                             <p className="text-xs text-subtle-light dark:text-subtle-dark">Kho: {p.stockQuantity}</p>
                          </div>
                       </div>
                       <button onClick={() => addProductToImport(p)} className="p-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg cursor-pointer transition-colors">
                          <Plus size={16} />
                       </button>
                    </div>
                 ))}
             </div>
         </div>

         {/* Right Side: Form & List */}
         <div className="lg:col-span-2 bg-surface-light dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-border-light dark:border-border-dark flex flex-col h-[70vh]">
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                   <label htmlFor="import_supplier" className="text-sm font-semibold text-text-light dark:text-text-dark block mb-1">Nhà cung cấp</label>
                   <input 
                      id="import_supplier"
                      name="supplier"
                      type="text" 
                      className="w-full p-2.5 border border-border-light dark:border-border-dark rounded-lg outline-none focus:ring-2 focus:ring-primary bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark placeholder:text-subtle-light dark:placeholder:text-subtle-dark text-sm"
                      value={supplier} onChange={(e) => setSupplier(e.target.value)}
                      placeholder="Tên hoặc SĐT nhà cung cấp" 
                   />
                </div>
                <div>
                   <label htmlFor="import_note" className="text-sm font-semibold text-text-light dark:text-text-dark block mb-1">Ghi chú</label>
                   <input 
                      id="import_note"
                      name="note"
                      type="text" 
                      className="w-full p-2.5 border border-border-light dark:border-border-dark rounded-lg outline-none focus:ring-2 focus:ring-primary bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark placeholder:text-subtle-light dark:placeholder:text-subtle-dark text-sm"
                      value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder="Ghi chú nhập hàng..." 
                   />
                </div>
            </div>

            <h3 className="font-bold text-text-light dark:text-text-dark mb-3 border-b border-border-light dark:border-border-dark pb-2">Danh sách nhập</h3>
            
            <div className="flex-1 overflow-y-auto mb-4 custom-scrollbar">
                <table className="w-full text-left">
                   <thead className="text-xs uppercase font-bold text-text-light dark:text-text-dark bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark">
                       <tr>
                           <th className="p-2">SẢN PHẨM</th>
                           <th className="p-2 w-24">SỐ LƯỢNG</th>
                           <th className="p-2 w-32">GIÁ NHẬP (Đ)</th>
                           <th className="p-2 w-32 text-right">THÀNH TIỀN</th>
                           <th className="p-2 w-10"></th>
                       </tr>
                   </thead>
                   <tbody>
                       {importDetails.map((item, idx) => (
                           <tr key={item.product._id} className="border-b border-border-light dark:border-border-dark last:border-0 hover:bg-background-light/50 dark:hover:bg-background-dark/50">
                               <td className="p-2 py-3">
                                   <p className="font-bold text-text-light dark:text-text-dark text-sm">{item.product.name}</p>
                                   <p className="text-xs text-subtle-light dark:text-subtle-dark">Tồn: {item.product.stockQuantity}</p>
                               </td>
                               <td className="p-2">
                                   <input 
                                      id={`import_qty_${idx}`}
                                      name={`import_qty_${idx}`}
                                      aria-label={`Số lượng nhập cho ${item.product.name}`}
                                      type="number" min="1"
                                      className="w-full p-1.5 border border-border-light dark:border-border-dark rounded-lg focus:ring-1 focus:ring-primary outline-none bg-surface-light dark:bg-surface-dark text-text-light dark:text-text-dark text-sm"
                                      value={item.quantity}
                                      onChange={(e) => updateDetail(idx, 'quantity', e.target.value)}
                                   />
                               </td>
                               <td className="p-2">
                                   <input 
                                      id={`import_price_${idx}`}
                                      name={`import_price_${idx}`}
                                      aria-label={`Giá nhập cho ${item.product.name}`}
                                      type="number" min="0" step="1000"
                                      className="w-full p-1.5 border border-border-light dark:border-border-dark rounded-lg focus:ring-1 focus:ring-primary outline-none bg-surface-light dark:bg-surface-dark text-text-light dark:text-text-dark text-sm"
                                      value={item.importPrice}
                                      onChange={(e) => updateDetail(idx, 'importPrice', e.target.value)}
                                   />
                               </td>
                               <td className="p-2 text-right font-bold text-text-light dark:text-text-dark">
                                   {(item.quantity * item.importPrice).toLocaleString()}
                               </td>
                               <td className="p-2 text-right">
                                   <button onClick={() => removeDetail(idx)} className="text-red-400 hover:text-red-600 p-1 cursor-pointer transition-colors">
                                      <Trash2 size={16} />
                                   </button>
                               </td>
                           </tr>
                       ))}
                       {importDetails.length === 0 && (
                           <tr>
                               <td colSpan={5} className="py-10 text-center text-subtle-light dark:text-subtle-dark">
                                   Chưa có sản phẩm nào
                               </td>
                           </tr>
                       )}
                   </tbody>
                </table>
            </div>

            <div className="bg-primary/10 p-4 rounded-xl border border-primary/20 flex justify-between items-center mt-auto">
               <span className="font-bold text-text-light dark:text-text-dark text-lg">Tổng cộng:</span>
               <span className="text-3xl font-bold text-primary">{calculateTotal().toLocaleString()} <span className="text-lg opacity-70">VNĐ</span></span>
            </div>
         </div>
      </div>
    </div>
  );
};

export default ImportGoods;
