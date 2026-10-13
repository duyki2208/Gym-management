import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/ProtectedRoute';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import Layout from './components/layout'; // Sử dụng Layout mới
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Tùy chọn: không tải lại data khi focus lại cửa sổ
      retry: (failureCount, error) => error?.response?.status !== 429 && failureCount < 1,
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
const BranchClosures = lazy(() => import('./pages/BranchClosures'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

const withPermission = (permission, element) => (
  <ProtectedRoute permission={permission}>{element}</ProtectedRoute>
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
                        <RouteErrorBoundary>
                          <Suspense fallback={<PageLoader />}>
                            <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/customers" element={withPermission('customer.read', <CustomerList />)} />
                            <Route path="/checkin" element={withPermission('checkin.use', <CheckIn />)} />
                            <Route path="/history" element={withPermission('checkin.use', <History />)} />
                            <Route path="/packages" element={<Packages />} />
                            <Route path="/staff" element={<Staff />} />
                            <Route path="/reports/pt-sessions" element={<Reports />} />
                            <Route path="/reports/*" element={withPermission('report.read_all', <Reports />)} />
                            <Route path="/commissions" element={withPermission('commission.read', <Commissions />)} />
                            <Route path="/settings" element={withPermission('settings.read', <Settings />)} />
                            <Route path="/products/inventory" element={withPermission('inventory.read', <ProductsMain />)} />
                            <Route path="/products/import" element={withPermission('inventory.import', <ProductsMain />)} />
                            <Route path="/products/*" element={<ProductsMain />} />
                            <Route path="/leads" element={withPermission('lead.read', <Leads />)} />
                            <Route path="/branch-closures" element={withPermission('closure.manage', <BranchClosures />)} />
                            
                            {/* Fallback cho route sai */}
                            <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                          </Suspense>
                        </RouteErrorBoundary>
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
