import React, { useEffect, lazy, Suspense } from 'react';
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

// Lazy load các trang để giảm initial bundle size & tăng tốc độ tải ứng dụng
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CustomerList = lazy(() => import('./pages/CustomerList'));
const CheckIn = lazy(() => import('./pages/CheckIn'));
const History = lazy(() => import('./pages/History'));
const Packages = lazy(() => import('./pages/Packages'));
const Staff = lazy(() => import('./pages/Staff'));
const Reports = lazy(() => import('./pages/Reports'));
const Commissions = lazy(() => import('./pages/Commissions'));
const Settings = lazy(() => import('./pages/Settings'));
const ProductsMain = lazy(() => import('./pages/ProductsMain'));
const Leads = lazy(() => import('./pages/Leads'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" reverseOrder={false} />
      <ConfirmProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public Route */}
                <Route path="/login" element={<Login />} />
                
                {/* Protected Routes (Bọc bởi Layout) */}
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Suspense fallback={<PageLoader />}>
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
                        </Suspense>
                      </Layout>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </ConfirmProvider>
    </QueryClientProvider>
  );
};

export default App;