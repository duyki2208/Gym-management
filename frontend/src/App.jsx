import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/layout'; // Sử dụng Layout mới
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Tùy chọn: không tải lại data khi focus lại cửa sổ
      retry: 1, // Tùy chọn: Thử lại 1 lần nếu lỗi
    },
  },
});

// Import Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CustomerList from './pages/CustomerList';
import CheckIn from './pages/CheckIn';
import History from './pages/History';
import Packages from './pages/Packages';
import Staff from './pages/Staff';
import Reports from './pages/Reports';
import Commissions from './pages/Commissions';
import Settings from './pages/Settings';
import ProductsMain from './pages/ProductsMain';
import Leads from './pages/Leads';

const App = () => {

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" reverseOrder={false} />
      <ConfirmProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Route */}
              <Route path="/login" element={<Login />} />
              
              {/* Protected Routes (Bọc bởi Layout) */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/customers" element={<CustomerList />} />
                        <Route path="/checkin" element={<CheckIn />} />
                        <Route path="/history" element={<History />} />
                        <Route path="/packages" element={<Packages />} />
                        <Route path="/staff" element={<Staff />} />
                        <Route path="/reports/*" element={<Reports />} />
                        <Route path="/commissions" element={<Commissions />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/products/*" element={<ProductsMain />} />
                        <Route path="/leads" element={<Leads />} />
                        
                        {/* Fallback cho route sai */}
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </Layout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ConfirmProvider>
    </QueryClientProvider>
  );
};

export default App;