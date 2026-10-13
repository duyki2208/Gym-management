import React from 'react';
import { useLocation } from 'react-router-dom';
import SalesOrderList from './SalesOrderList';
import ProductList from './ProductList';
import ImportGoods from './ImportGoods';

const ProductsMain = () => {
  const location = useLocation();

  // Nhận diện subpath từ URL: /products/pos, /products/inventory, /products/import
  const subPath = location.pathname.split('/')[2] || 'pos';
  const activeTab = ['pos', 'inventory', 'import'].includes(subPath) ? subPath : 'pos';

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'pos' && <SalesOrderList />}
        {activeTab === 'inventory' && <ProductList />}
        {activeTab === 'import' && <ImportGoods onFinish={() => {}} />}
      </div>
    </div>
  );
};

export default ProductsMain;
