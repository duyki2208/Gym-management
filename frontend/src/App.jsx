import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { initializeData } from './services/customerService';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Dashboard from './pages/Dashboard';
import CustomerList from './pages/CustomerList';
import CheckIn from './pages/CheckIn';
import History from './pages/History';
import Notifications from './pages/Notifications';
import Packages from './pages/Packages';
import Staff from './pages/Staff';
import Reports from './pages/Reports'; // Mới
import Settings from './pages/Settings'; // Mới

const Sidebar = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  
  const menuItems = [
    { path: '/', label: 'Tổng quan', icon: 'dashboard' },
    { path: '/customers', label: 'Khách hàng', icon: 'group' },
    { path: '/checkin', label: 'Check-in', icon: 'check_circle' },
    { path: '/history', label: 'Lịch sử', icon: 'history' },
    { path: '/packages', label: 'Gói tập', icon: 'fitness_center' },
    { path: '/staff', label: 'Nhân viên', icon: 'badge' },
    { path: '/notifications', label: 'Thông báo', icon: 'notifications' },
    { path: '/reports', label: 'Báo cáo', icon: 'bar_chart' },
  ];

  return (
    <aside className="sticky top-0 h-screen w-64 flex-col border-r border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4 hidden lg:flex font-display">
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 bg-primary/20 text-primary flex items-center justify-center font-bold text-xl">
           {user?.avatar || 'G'}
        </div>
        <div className="flex flex-col">
          <h1 className="text-text-light dark:text-text-dark text-base font-bold truncate w-32">{user?.name || 'Admin'}</h1>
          <p className="text-text-muted-light dark:text-text-muted-dark text-sm font-normal capitalize">{user?.role || 'Quản lý'}</p>
        </div>
      </div>

      <nav className="flex flex-col gap-2">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link 
              key={item.path} 
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-primary/20 text-text-light dark:text-text-dark font-medium' 
                  : 'text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <span className={`material-symbols-outlined ${isActive ? 'fill' : ''}`} style={{ fontSize: '20px' }}>
                {item.icon}
              </span>
              <p className="text-sm leading-normal">{item.label}</p>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-2">
        <Link to="/settings" className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${location.pathname === '/settings' ? 'bg-primary/20' : 'hover:bg-gray-100'}`}>
          <span className="material-symbols-outlined text-text-light dark:text-text-dark" style={{ fontSize: '20px' }}>settings</span>
          <p className="text-text-light dark:text-text-dark text-sm font-medium leading-normal">Cài đặt</p>
        </Link>
        <button onClick={logout} className="flex items-center gap-3 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 w-full text-left transition-colors">
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>logout</span>
          <p className="text-sm font-medium leading-normal">Đăng xuất</p>
        </button>
      </div>
    </aside>
  );
};

const MainLayout = ({ children }) => (
  <div className="flex min-h-screen w-full bg-background-light dark:bg-background-dark font-display text-text-light dark:text-text-dark">
    <Sidebar />
    <main className="flex-1 p-6 lg:p-8 overflow-y-auto overflow-x-hidden">
      <div className="w-full max-w-7xl mx-auto">
         {children}
      </div>
    </main>
  </div>
);

const App = () => {
  useEffect(() => { initializeData(); }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={<ProtectedRoute><MainLayout><Dashboard /></MainLayout></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute><MainLayout><CustomerList /></MainLayout></ProtectedRoute>} />
          <Route path="/packages" element={<ProtectedRoute><MainLayout><Packages /></MainLayout></ProtectedRoute>} />
          <Route path="/staff" element={<ProtectedRoute><MainLayout><Staff /></MainLayout></ProtectedRoute>} />
          <Route path="/checkin" element={<ProtectedRoute><MainLayout><CheckIn /></MainLayout></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><MainLayout><History /></MainLayout></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><MainLayout><Notifications /></MainLayout></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><MainLayout><Reports /></MainLayout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><MainLayout><Settings /></MainLayout></ProtectedRoute>} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;