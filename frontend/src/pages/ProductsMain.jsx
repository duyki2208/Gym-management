import React, { useState } from 'react';
import PointOfSale from './PointOfSale';
import ProductList from './ProductList';
import ImportGoods from './ImportGoods';
import { Store, ShoppingCart, Download, PackageSearch } from 'lucide-react';

const ProductsMain = () => {
  const [activeTab, setActiveTab] = useState('pos');

  return (
    <div className="flex flex-col h-full rounded-2xl bg-white shadow-sm overflow-hidden">
      {/* Tabs Header */}
      <div className="bg-white border-b border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center z-10 w-full mb-0 px-6 py-4">
         <h1 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-3">
            <Store className="text-primary w-8 h-8" /> Cửa Hàng & Kho
         </h1>
         <div className="flex bg-gray-100/80 p-1.5 rounded-xl border border-gray-200/50">
             <button
               onClick={() => setActiveTab('pos')}
               className={`flex items-center gap-2 px-6 py-2.5 font-bold rounded-lg transition-all ${
                 activeTab === 'pos' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
               }`}
             >
                <ShoppingCart size={18} /> Bán Hàng 
             </button>
             <button
               onClick={() => setActiveTab('inventory')}
               className={`flex items-center gap-2 px-6 py-2.5 font-bold rounded-lg transition-all ${
                 activeTab === 'inventory' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
               }`}
             >
                <PackageSearch size={18} /> Kho Hàng
             </button>
             <button
               onClick={() => setActiveTab('import')}
               className={`flex items-center gap-2 px-6 py-2.5 font-bold rounded-lg transition-all ${
                 activeTab === 'import' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
               }`}
             >
                <Download size={18} /> Lập Phiếu Nhập
             </button>
         </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden bg-gray-50/30">
         {activeTab === 'pos' && <PointOfSale />}
         {activeTab === 'inventory' && <ProductList />}
         {activeTab === 'import' && <ImportGoods onFinish={() => setActiveTab('inventory')} />}
      </div>
    </div>
  );
};

export default ProductsMain;
