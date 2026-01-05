import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  Users,
  QrCode,
  History,
  Package,
  UserCog,
  Bell,
  BarChart3,
  Settings,
  LogOut,
  Dumbbell
} from "lucide-react";

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const menuItems = [
    { path: "/", icon: LayoutDashboard, label: "Tổng quan" },
    { path: "/customers", icon: Users, label: "Khách hàng" },
    { path: "/checkin", icon: QrCode, label: "Check-in" },
    { path: "/history", icon: History, label: "Lịch sử" },
    { path: "/packages", icon: Package, label: "Gói tập" },
    { path: "/staff", icon: UserCog, label: "Nhân viên" },
    { path: "/notifications", icon: Bell, label: "Thông báo" },
    { path: "/reports", icon: BarChart3, label: "Báo cáo" },
  ];

  // Filter menu items based on role
  const filteredMenuItems = menuItems.filter((item) => {
    const role = user?.role;
    
    // Admin: Show All
    if (role === 'admin') return true;

    // Manager: Show specific items (Hide Notifications)
    if (role === 'manager') {
       return ['/', '/customers', '/checkin', '/history', '/packages', '/staff', '/reports'].includes(item.path);
    }

    // Staff (PT, Sale, Reception): Show limited items
    // Hide Packages, Staff, Notifications, Reports
    return ['/', '/customers', '/checkin', '/history'].includes(item.path);
  });

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 font-display text-gray-900 dark:text-gray-100">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col fixed h-full z-10 transition-all">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-100 dark:border-gray-700">
          <div className="bg-primary/10 p-2 rounded-lg">
             <Dumbbell className="text-primary w-6 h-6" />
          </div>
          <span className="font-black text-xl tracking-tight text-primary">Gym Fitness</span>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
              {user?.name ? user.name.charAt(0).toUpperCase() : "A"}
            </div>
            <div className="overflow-hidden">
              <p className="font-bold text-sm truncate">{user?.name || "Account"}</p>
              <p className="text-xs text-gray-500 truncate capitalize">{user?.role || "Quản lý"}</p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
          {filteredMenuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? "bg-primary text-white shadow-lg shadow-primary/30 font-bold"
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              >
                <item.icon
                  size={20}
                  className={`transition-colors ${isActive ? "text-white" : "text-gray-400 group-hover:text-gray-600"}`}
                />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer Sidebar */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 space-y-1">
          {user?.role === 'admin' && (
            <Link
                to="/settings"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === "/settings" 
                    ? "bg-primary/10 text-primary" 
                    : "text-gray-500 hover:bg-gray-100"
                }`}
            >
                <Settings size={20} />
                Cài đặt
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm font-medium"
          >
            <LogOut size={20} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 ml-64 h-full overflow-y-auto bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-7xl mx-auto min-h-[calc(100vh-4rem)]">
           {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;