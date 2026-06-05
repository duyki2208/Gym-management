import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSidebar } from '../../context/SidebarContext';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  QrCode,
  History,
  Package,
  UserCog,
  BarChart3,
  Settings,
  Store,
  Dumbbell,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// ── Menu cấu trúc theo nhóm ─────────────────────────────────────
const menuGroups = [
  {
    label: 'Chính',
    items: [
      { path: '/',          icon: LayoutDashboard, label: 'Tổng quan' },
      { path: '/customers', icon: Users,            label: 'Khách hàng' },
      { path: '/checkin',   icon: QrCode,           label: 'Check-in'   },
    ],
  },
  {
    label: 'Quản lý',
    items: [
      { path: '/packages',  icon: Package,  label: 'Gói tập'   },
      { path: '/products',  icon: Store,    label: 'Sản phẩm'  },
      { path: '/history',   icon: History,  label: 'Lịch sử'   },
      { path: '/staff',     icon: UserCog,  label: 'Nhân viên' },
    ],
  },
  {
    label: 'Phân tích',
    items: [
      { path: '/reports', icon: BarChart3, label: 'Báo cáo ' },
    ],
  },
];

// Danh sách role có quyền xem từng route
const rolePermissions = {
  '/':          ['admin', 'accountant', 'manager', 'sm', 'pm', 'om', 'staff', 'pt', 'sale', 'reception'],
  '/customers': ['admin', 'accountant', 'manager', 'sm', 'pm', 'om', 'staff', 'pt', 'sale', 'reception'],
  '/checkin':   ['admin', 'accountant', 'manager', 'sm', 'pm', 'om', 'staff', 'pt', 'sale', 'reception'],
  '/packages':  ['admin', 'accountant', 'manager', 'sm', 'pm', 'om', 'staff', 'pt', 'sale', 'reception'],
  '/products':  ['admin', 'accountant', 'manager', 'sm', 'pm', 'om', 'staff', 'pt', 'sale', 'reception'],
  '/history':   ['admin', 'accountant', 'manager', 'sm', 'pm', 'om', 'staff', 'pt', 'sale', 'reception'],
  '/staff':     ['admin', 'accountant', 'manager', 'sm', 'pm', 'om', 'staff', 'pt', 'sale', 'reception'],
  '/reports':   ['admin', 'accountant', 'manager', 'sm', 'pm', 'om'],
  '/settings':  ['admin', 'accountant'],
};

// ── NavItem ──────────────────────────────────────────────────────
const NavItem = ({ item, isActive, isCollapsed }) => {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      className={`
        relative flex items-center gap-3 px-3 py-2.5 rounded-lg
        transition-all duration-200 group/item
        ${isActive
          ? 'bg-primary/15 text-gray-900 dark:text-gray-100 font-bold'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-100 font-medium'
        }
        ${isCollapsed ? 'justify-center' : ''}
      `}
    >
      {/* Active indicator bar */}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
      )}

      <Icon
        size={20}
        className={`shrink-0 transition-colors ${isActive ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}
      />

      {/* Label — ẩn khi collapsed */}
      {!isCollapsed && (
        <span className="text-sm truncate">{item.label}</span>
      )}

      {/* Tooltip khi collapsed */}
      {isCollapsed && (
        <span className="
          absolute left-full ml-3 px-2.5 py-1.5 rounded-md
          bg-gray-900 dark:bg-gray-700 text-white text-xs font-medium
          opacity-0 pointer-events-none whitespace-nowrap z-50
          group-hover/item:opacity-100
          transition-opacity duration-150
        ">
          {item.label}
        </span>
      )}
    </Link>
  );
};

// ── Sidebar ──────────────────────────────────────────────────────
const Sidebar = () => {
  const { isCollapsed, toggle } = useSidebar();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const role = user?.role || 'staff';

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const canView = (path) => {
    const allowed = rolePermissions[path];
    if (!allowed) return true;
    return allowed.includes(role);
  };

  return (
    <aside
      className={`
        fixed top-0 left-0 h-full z-40 flex flex-col
        bg-white dark:bg-gray-900
        border-r border-gray-200 dark:border-gray-800
        transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-16' : 'w-64'}
      `}
    >
      {/* ── Logo area — bấm về dashboard ── */}
      <button
        onClick={() => navigate('/')}
        className={`
          h-16 flex items-center shrink-0 w-full
          hover:bg-gray-50 dark:hover:bg-white/5
          transition-colors duration-200
          ${isCollapsed ? 'justify-center px-2' : 'gap-2.5 px-5'}
        `}
        aria-label="Về trang tổng quan"
      >
        <div className="bg-primary/10 p-1.5 rounded-lg shrink-0">
          <Dumbbell className="text-primary w-5 h-5" />
        </div>
        {!isCollapsed && (
          <span className="font-black text-lg tracking-tight text-primary leading-none">
            Gym Fitness
          </span>
        )}
      </button>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2 space-y-4 custom-scrollbar">
        {menuGroups.map((group) => {
          const visibleItems = group.items.filter(item => canView(item.path));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label}>
              {/* Group header — chỉ hiện khi expanded */}
              {!isCollapsed && (
                <p className="px-3 mb-1.5 text-[11px] font-bold text-gray-400 dark:text-gray-600 select-none">
                  {group.label}
                </p>
              )}
              {/* Separator mỏng khi collapsed */}
              {isCollapsed && (
                <div className="border-t border-gray-100 dark:border-gray-800 mx-2 mb-2" />
              )}

              <div className="space-y-0.5">
                {visibleItems.map(item => (
                  <NavItem
                    key={item.path}
                    item={item}
                    isActive={isActive(item.path)}
                    isCollapsed={isCollapsed}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Settings — admin only */}
        {canView('/settings') && (
          <div>
            {!isCollapsed && (
              <p className="px-3 mb-1.5 text-[11px] font-bold text-gray-400 dark:text-gray-600 select-none">
                Hệ thống
              </p>
            )}
            {isCollapsed && (
              <div className="border-t border-gray-100 dark:border-gray-800 mx-2 mb-2" />
            )}
            <NavItem
              item={{ path: '/settings', icon: Settings, label: 'Cài đặt' }}
              isActive={isActive('/settings')}
              isCollapsed={isCollapsed}
            />
          </div>
        )}
      </nav>

      {/* ── Toggle arrow button — nằm giữa cạnh phải sidebar ── */}
      <button
        onClick={toggle}
        className="
          absolute -right-3 top-1/2 -translate-y-1/2
          w-6 h-6 rounded-full
          bg-white dark:bg-gray-800
          border border-gray-200 dark:border-gray-700
          flex items-center justify-center
          text-gray-500 dark:text-gray-400
          hover:text-primary hover:border-primary
          shadow-sm hover:shadow-md
          transition-all duration-200 z-50
        "
        aria-label={isCollapsed ? 'Mở sidebar' : 'Thu sidebar'}
      >
        {isCollapsed
          ? <ChevronRight size={13} strokeWidth={2.5} />
          : <ChevronLeft  size={13} strokeWidth={2.5} />
        }
      </button>
    </aside>
  );
};

export default Sidebar;
