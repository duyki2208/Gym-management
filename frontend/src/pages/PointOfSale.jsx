import React, { useState, useEffect } from 'react';
import { productService, posService } from '../services/productService';
import { customerService } from '../services/customerService';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, User, Package, QrCode, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';

const PointOfSale = ({ onFinish, onClose }) => {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  
  const [cart, setCart] = useState([]); // { product, quantity, sellPrice }
  const [isWalkIn, setIsWalkIn] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  const [showInvoice, setShowInvoice] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [orderStatus, setOrderStatus] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    const initFetch = async () => {
       try {
          const prods = await productService.getAll('');
          setProducts(prods);
          
          const custData = await customerService.getAll({ page: 1, limit: 100 });
          setCustomers(custData.customers || []);
       } catch(e) {}
    };
    initFetch();
  }, []);

  const filteredProducts = products.filter(p => {
     const matchName = p.name.toLowerCase().includes(searchTerm.toLowerCase());
     const matchCat = categoryFilter === 'All' || p.category === categoryFilter;
     return matchName && matchCat;
  });

  const addToCart = (p) => {
     if (p.stockQuantity <= 0) {
        toast.error("Sản phẩm đã hết hàng!");
        return;
     }
     
     const existing = cart.find(c => c.product._id === p._id);
     if (existing) {
         if (existing.quantity >= p.stockQuantity) {
             toast.error("Không đủ tồn kho!");
             return;
         }
         updateCart(p._id, existing.quantity + 1);
     } else {
         setCart([...cart, { product: p, quantity: 1, sellPrice: p.sellPrice }]);
     }
  };

  const updateCart = (id, newQty) => {
     if (newQty <= 0) {
         removeFromCart(id);
         return;
     }
     const newCart = cart.map(c => c.product._id === id ? { ...c, quantity: newQty } : c);
     setCart(newCart);
  };

  const removeFromCart = (id) => {
     setCart(cart.filter(c => c.product._id !== id));
  };
  
  const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.sellPrice), 0);

  const handleCheckout = async (paymentMethod) => {
     if (cart.length === 0) return toast.error("Giỏ hàng trống!");
     
     let custId = null;
     if (!isWalkIn) {
         if (!selectedCustomer) return toast.error("Vui lòng chọn hội viên!");
         custId = selectedCustomer._id;
     }
     
     try {
         const payload = {
             customerId: custId,
             paymentMethod,
             details: cart.map(c => ({ product: c.product._id, quantity: c.quantity }))
         };
         
         const res = await posService.checkout(payload);
         const currentStatus = res.saleOrder.status;
         toast.success(currentStatus === 'Đã thanh toán' ? "Thanh toán thành công" : "Đã tạo đơn hàng chờ thanh toán");
         
         // Show Invoice Modal
         setLastOrder({ ...res.saleOrder, cartClone: [...cart] });
         setOrderStatus(currentStatus);
         setShowInvoice(true);
         
         // Reset state
         setCart([]);
         setIsWalkIn(true);
         setSelectedCustomer(null);
         
         // re-fetch product stock
         const prods = await productService.getAll('');
         setProducts(prods);

         if (onFinish) onFinish();
     } catch (err) {
         toast.error(err.response?.data?.message || "Lỗi thanh toán");
     }
  };

  // Đóng hoá đơn: nếu đơn chưa thanh toán thì tự động hủy và hoàn lại tồn kho
  const handleCloseInvoice = async () => {
     if (lastOrder && orderStatus === 'Chờ thanh toán') {
        try {
           setIsCancelling(true);
           await posService.cancelOrder(lastOrder._id);
           toast('Đã hủy đơn hàng và hoàn trả tồn kho.', { icon: '↩️' });
           // Re-fetch stock
           const prods = await productService.getAll('');
           setProducts(prods);
        } catch (err) {
           console.error('Lỗi hủy đơn:', err);
           toast.error('Không thể hủy đơn hàng.');
        } finally {
           setIsCancelling(false);
        }
     }
     setShowInvoice(false);
     setLastOrder(null);
     setOrderStatus('');
     if (onFinish) onFinish();
  };

  // Polling tự động kiểm tra trạng thái thanh toán mỗi 3 giây
  useEffect(() => {
     let intervalId;
     if (showInvoice && lastOrder && orderStatus === 'Chờ thanh toán') {
        intervalId = setInterval(async () => {
           try {
              const res = await posService.getOrderStatus(lastOrder._id);
              if (res.status === 'Đã thanh toán') {
                 setOrderStatus('Đã thanh toán');
                 toast.success('✅ Hệ thống: Đã nhận được tiền chuyển khoản!', { duration: 5000 });
                 // Re-fetch stock (không cần hoàn lại, đơn đã được xác nhận)
                 const prods = await productService.getAll('');
                 setProducts(prods);
                 try {
                   const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-84.wav");
                   audio.play();
                 } catch (e) {
                   console.log("Không thể phát âm thanh", e);
                 }
              }
           } catch (err) {
              console.error("Lỗi đối soát đơn hàng:", err);
           }
        }, 3000);
     }
     return () => {
        if (intervalId) clearInterval(intervalId);
     };
  }, [showInvoice, lastOrder, orderStatus]);

  return (
    <div className="flex flex-col gap-6 font-display bg-transparent h-full">
      {onClose && (
        <div className="flex justify-between items-center bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-border-light dark:border-border-dark shadow-sm">
           <h2 className="text-xl font-bold text-text-light dark:text-text-dark flex items-center gap-2">
             <ShoppingCart className="text-primary" /> Bán Hàng (POS)
           </h2>
           <button onClick={onClose} className="px-4 py-2 bg-background-light dark:bg-background-dark hover:bg-border-light dark:hover:bg-border-dark text-text-light dark:text-text-dark font-bold rounded-lg text-xs transition-colors flex items-center gap-1 border border-border-light dark:border-border-dark cursor-pointer">
              ✕ Đóng POS
           </button>
        </div>
      )}
      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${onClose ? 'h-[calc(100vh-280px)]' : 'h-[calc(100vh-230px)]'} min-h-[520px]`}>
         {/* Left Side: Product Grid */}
         <div className="lg:col-span-2 bg-surface-light dark:bg-surface-dark rounded-xl p-5 shadow-sm border border-border-light dark:border-border-dark flex flex-col h-full">
            <div className="flex gap-4 mb-5">
               <div className="relative flex-1">
                   <Search className="absolute left-3 top-3 text-subtle-light dark:text-subtle-dark" size={18} />
                   <input 
                      id="pos_search_input"
                      name="posSearch"
                      type="text" 
                      placeholder="Tìm tên..." 
                      aria-label="Tìm kiếm sản phẩm"
                      className="w-full pl-9 pr-3 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark placeholder:text-subtle-light dark:placeholder:text-subtle-dark rounded-lg outline-none focus:ring-2 focus:ring-primary text-sm" 
                      value={searchTerm} 
                      onChange={(e) => setSearchTerm(e.target.value)} 
                   />
               </div>
               <select 
                 id="pos_category_filter"
                 name="posCategory"
                 aria-label="Lọc theo danh mục sản phẩm"
                 className="border border-border-light dark:border-border-dark rounded-lg px-4 py-2.5 outline-none bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark focus:ring-2 focus:ring-primary text-sm" 
                 value={categoryFilter} 
                 onChange={(e) => setCategoryFilter(e.target.value)}
               >
                   <option value="All">Tất cả danh mục</option>
                   <option value="Đồ uống">Đồ uống</option>
                   <option value="Thực phẩm bổ sung">Thực phẩm bổ sung</option>
                   <option value="Dụng cụ tập">Dụng cụ tập</option>
                   <option value="Khác">Khác</option>
               </select>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 overflow-y-auto pr-2 custom-scrollbar flex-1 pb-4">
                {filteredProducts.map(p => (
                   <div 
                      key={p._id} 
                      onClick={() => addToCart(p)}
                      className={`aspect-square relative border rounded-xl p-3 bg-surface-light dark:bg-surface-dark cursor-pointer hover:shadow-lg transition-all group flex flex-col justify-between overflow-hidden ${p.stockQuantity <= 0 ? 'opacity-50 grayscale border-border-light dark:border-border-dark' : 'border-border-light dark:border-border-dark hover:border-primary/40'}`}
                   >
                       <div className="absolute top-2 right-2 z-10 bg-surface-light/90 dark:bg-surface-dark/90 backdrop-blur-xs px-2 py-0.5 rounded-md text-[10px] font-bold shadow-sm border border-border-light dark:border-border-dark text-subtle-light dark:text-subtle-dark">
                          Kho: {p.stockQuantity}
                       </div>
                       <div className="flex-1 w-full bg-background-light dark:bg-background-dark rounded-lg flex items-center justify-center overflow-hidden mb-2 relative">
                          {p.imageUrl ? (
                             <img src={p.imageUrl} alt={p.name} className="object-cover h-full w-full group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                             <Package className="text-subtle-light dark:text-subtle-dark group-hover:scale-110 transition-transform duration-300" size={36}/>
                          )}
                       </div>
                       <div>
                          <p className="font-bold text-text-light dark:text-text-dark text-xs sm:text-sm line-clamp-1">{p.name}</p>
                          <p className="font-black text-primary text-xs sm:text-sm mt-0.5">{p.sellPrice.toLocaleString()} đ</p>
                       </div>
                   </div>
                ))}
            </div>
         </div>

         {/* Right Side: Cart Workspace */}
         <div className="lg:col-span-1 bg-surface-light dark:bg-surface-dark rounded-xl flex flex-col shadow-sm border border-border-light dark:border-border-dark h-full overflow-hidden relative">
            <div className="p-4 bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark">
               <h3 className="font-bold text-xl text-text-light dark:text-text-dark flex items-center gap-2 mb-4">Giỏ Hàng <span className="bg-primary text-text-light text-xs font-bold px-2 py-1 rounded-full">{cart.length}</span></h3>
               <div className="flex gap-2 p-1 bg-background-light dark:bg-background-dark rounded-lg w-full border border-border-light dark:border-border-dark">
                  <button 
                     className={`flex-1 py-2 text-sm font-bold text-center rounded-lg transition-all cursor-pointer ${isWalkIn ? 'bg-surface-light dark:bg-surface-dark text-primary shadow-sm' : 'text-subtle-light dark:text-subtle-dark hover:text-text-light dark:hover:text-text-dark'}`} 
                     onClick={() => setIsWalkIn(true)}>Khách Lẻ</button>
                  <button 
                     className={`flex-1 py-2 text-sm font-bold text-center rounded-lg transition-all cursor-pointer ${!isWalkIn ? 'bg-surface-light dark:bg-surface-dark text-primary shadow-sm' : 'text-subtle-light dark:text-subtle-dark hover:text-text-light dark:hover:text-text-dark'}`} 
                     onClick={() => setIsWalkIn(false)}>Hội Viên</button>
               </div>
               {!isWalkIn && (
                  <select 
                     id="pos_customer_select"
                     name="posCustomer"
                     aria-label="Chọn hội viên mua hàng"
                     className="w-full mt-3 p-2.5 border border-border-light dark:border-border-dark rounded-lg outline-none text-sm bg-surface-light dark:bg-surface-dark text-text-light dark:text-text-dark focus:ring-2 focus:ring-primary"
                     onChange={(e) => setSelectedCustomer(customers.find(c => c._id === e.target.value))}
                  >
                     <option value="">-- Chọn Hội Viên --</option>
                     {customers.map(c => <option key={c._id} value={c._id}>{c.name} ({c.phone})</option>)}
                  </select>
               )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-surface-light dark:bg-surface-dark divide-y divide-border-light dark:divide-border-dark">
               {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full opacity-40 text-center p-6 text-subtle-light dark:text-subtle-dark">
                     <ShoppingCart size={48} className="mb-2" />
                     <p className="font-bold text-sm">Chưa có sản phẩm.</p>
                  </div>
               ) : (
                  cart.map(c => (
                     <div key={c.product._id} className="p-4 flex gap-3 group hover:bg-background-light/50 dark:hover:bg-background-dark/50 transition-colors">
                        <div className="flex-1">
                           <h4 className="font-bold text-text-light dark:text-text-dark text-sm line-clamp-1">{c.product.name}</h4>
                           <p className="text-xs text-subtle-light dark:text-subtle-dark">{c.sellPrice.toLocaleString()} đ</p>
                           <div className="flex items-center gap-3 mt-2">
                              <button onClick={() => updateCart(c.product._id, c.quantity - 1)} className="w-6 h-6 rounded bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark flex items-center justify-center hover:bg-border-light dark:hover:bg-border-dark text-text-light dark:text-text-dark transition-colors cursor-pointer"><Minus size={14}/></button>
                              <span className="font-bold text-sm w-4 text-center text-text-light dark:text-text-dark">{c.quantity}</span>
                              <button onClick={() => updateCart(c.product._id, c.quantity + 1)} className="w-6 h-6 rounded bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark flex items-center justify-center hover:bg-border-light dark:hover:bg-border-dark text-text-light dark:text-text-dark transition-colors cursor-pointer"><Plus size={14}/></button>
                           </div>
                        </div>
                        <div className="flex flex-col items-end justify-between">
                           <button onClick={() => removeFromCart(c.product._id)} className="text-red-400 hover:text-red-600 transition-colors p-1 cursor-pointer"><Trash2 size={16}/></button>
                           <p className="font-black text-text-light dark:text-text-dark text-sm">{(c.sellPrice * c.quantity).toLocaleString()} đ</p>
                        </div>
                     </div>
                  ))
               )}
            </div>

            <div className="p-5 bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark mt-auto">
               <div className="flex justify-between items-end mb-4">
                  <span className="text-subtle-light dark:text-subtle-dark font-bold uppercase tracking-wide text-xs">Thanh toán</span>
                  <span className="text-3xl font-black text-primary">{totalAmount.toLocaleString()} <span className="text-lg opacity-70">đ</span></span>
               </div>
               <div className="grid grid-cols-2 gap-3">
                   <button 
                     onClick={() => handleCheckout('Tiền mặt')}
                     className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3 font-bold flex flex-col items-center justify-center shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                     disabled={cart.length === 0}
                   >
                     <Banknote size={20} className="mb-1" />
                     Tiền Mặt
                   </button>
                   <button 
                     onClick={() => handleCheckout('Chuyển khoản QR')}
                     className="bg-primary hover:bg-primary/90 text-text-light rounded-xl py-3 font-bold flex flex-col items-center justify-center shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                     disabled={cart.length === 0}
                   >
                     <CreditCard size={20} className="mb-1" />
                     Mã VietQR
                   </button>
               </div>
            </div>
         </div>
      </div>

      {/* INVOICE MODAL (Thanh toán xong hiện Bill kèm QR) */}
      {showInvoice && lastOrder && (
         <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-center items-center p-4">
             <div className="bg-surface-light dark:bg-surface-dark rounded-xl w-full max-w-sm shadow-2xl overflow-hidden border border-border-light dark:border-border-dark animate-in fade-in zoom-in duration-300">
                 {orderStatus === 'Chờ thanh toán' ? (
                      <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-center text-white">
                          <p className="text-white font-bold text-lg">Đơn hàng: {lastOrder._id?.substr(-8).toUpperCase()}</p>
                      </div>
                  ) : (
                     <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-center text-white">
                         <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                            <CheckCircle size={32} className="text-white" />
                         </div>
                         <h2 className="text-2xl font-black">HÓA ĐƠN ({lastOrder._id?.substr(-4)})</h2>
                         <p className="text-emerald-50 mt-1">Gym Fitness Center • Đã thanh toán</p>
                     </div>
                  )}
                 
                 <div className="p-6">
                     <div className="max-h-48 overflow-y-auto mb-4 border-b border-border-light dark:border-border-dark pb-4 text-sm font-medium text-text-light dark:text-text-dark">
                        {lastOrder.cartClone?.map(c => (
                           <div key={c.product._id} className="flex justify-between mb-2">
                              <span><span className="text-subtle-light dark:text-subtle-dark">{c.quantity}x</span> {c.product.name}</span>
                              <span className="font-bold">{(c.quantity * c.sellPrice).toLocaleString()} đ</span>
                           </div>
                        ))}
                     </div>
                     <div className="flex justify-between items-center mb-4 text-lg">
                        <span className="font-bold text-subtle-light dark:text-subtle-dark">Tổng cộng</span>
                        <span className="font-black text-text-light dark:text-text-dark">{lastOrder.totalAmount.toLocaleString()} đ</span>
                     </div>

                     {/* Dynamic QR Code VietQR - chỉ hiện mã QR thuần */}
                     {lastOrder.paymentMethod === 'Chuyển khoản QR' && (
                         orderStatus === 'Chờ thanh toán' ? (
                            <div className="flex flex-col items-center">
                               <img 
                                  src={`https://img.vietqr.io/image/970422-0344075790-qr_only.png?amount=${lastOrder.totalAmount}&addInfo=GYM${lastOrder._id?.slice(-8).toUpperCase()}`} 
                                  alt="VietQR MBBank" 
                                  className="w-64 h-64 rounded-xl object-contain bg-white p-2"
                               />
                               {/* Trạng thái chờ - tự động xác nhận */}
                               <div className="w-full mt-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5 flex items-center gap-2">
                                  <Loader2 size={16} className="text-amber-500 animate-spin flex-shrink-0" />
                                  <div>
                                     <p className="text-amber-600 dark:text-amber-400 font-bold text-xs">Đang chờ thanh toán...</p>
                                     <p className="text-amber-600/80 dark:text-amber-400/80 text-[10px] mt-0.5">Hệ thống tự động xác nhận khi nhận được tiền</p>
                                  </div>
                               </div>
                            </div>
                         ) : (
                            <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl flex flex-col items-center justify-center">
                               <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                                  <CheckCircle className="text-emerald-500" size={24} />
                               </div>
                               <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Thanh toán hoàn tất!</p>
                               <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1 text-center font-medium">Hệ thống đã nhận được tiền chuyển khoản.</p>
                            </div>
                         )
                     )}
                     
                     {/* Nút đóng: nếu chưa thanh toán sẽ tự hủy đơn và hoàn stock */}
                     <button 
                        onClick={handleCloseInvoice}
                        disabled={isCancelling}
                        className={`w-full mt-6 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                           orderStatus === 'Chờ thanh toán'
                              ? 'bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30'
                              : 'bg-background-light dark:bg-background-dark hover:bg-border-light dark:hover:bg-border-dark text-text-light dark:text-text-dark border border-border-light dark:border-border-dark'
                        }`}
                     >
                        {isCancelling ? (
                           <><Loader2 size={16} className="animate-spin" /> Đang hủy đơn...</>
                        ) : orderStatus === 'Chờ thanh toán' ? (
                           <><AlertTriangle size={16} /> Hủy & Đóng Hoá Đơn</>
                        ) : (
                           'Đóng Hoá Đơn'
                        )}
                     </button>
                 </div>
             </div>
         </div>
      )}
    </div>
  );
};

export default PointOfSale;
