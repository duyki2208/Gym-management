import React from 'react';
import { useLocation } from 'react-router-dom';
import SalesOrderList from './SalesOrderList';
import ProductList from './ProductList';
import ImportGoods from './ImportGoods';
import { Store, ShoppingCart, Download, PackageSearch } from 'lucide-react';

const titleMap = {
  pos: { label: 'Bán Hàng', icon: ShoppingCart },
  inventory: { label: 'Quản Lý Tồn Kho', icon: PackageSearch },
  import: { label: 'Lập Phiếu Nhập Hàng', icon: Download },
};

const ProductsMain = () => {
  const location = useLocation();

  // Nhận diện subpath từ URL: /products/pos, /products/inventory, /products/import
  const subPath = location.pathname.split('/')[2] || 'pos';
  const activeTab = ['pos', 'inventory', 'import'].includes(subPath) ? subPath : 'pos';

  const CurrentIcon = titleMap[activeTab]?.icon || Store;
  const currentLabel = titleMap[activeTab]?.label || 'Cửa Hàng';

  return (
    <div className="flex flex-col h-full rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
      {/* Header trang cửa hàng - Không còn tab thừa ở giữa */}
      <div className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark flex items-center justify-between z-10 w-full px-6 py-4">
        <h1 className="text-2xl font-bold text-text-light dark:text-text-dark tracking-tight flex items-center gap-3">
          <CurrentIcon className="text-primary w-7 h-7" />
          {currentLabel}
        </h1>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-background-light dark:bg-background-dark p-6">
        {activeTab === 'pos' && <SalesOrderList />}
        {activeTab === 'inventory' && <ProductList />}
        {activeTab === 'import' && <ImportGoods onFinish={() => {}} />}
      </div>
    </div>
  );
};

export default ProductsMain;
