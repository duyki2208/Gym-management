import React, { useState, useEffect, useMemo } from 'react';
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
  Coins,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Target,
  ShoppingCart,
  PackageSearch,
  Download,
  TrendingUp,
  UserSearch,
  AlertTriangle,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   1. HẰNG SỐ ROLE
═══════════════════════════════════════════════════════════ */
const ALL_ROLES = ['admin', 'accountant', 'manager', 'sm', 'pm', 'om', 'staff', 'pt', 'sale', 'reception'];
const MANAGER_ROLES = ['admin', 'accountant', 'manager', 'sm', 'pm', 'om'];

/* ═══════════════════════════════════════════════════════════
   2. CẤU TRÚC SIDEBAR (5 BÁO CÁO TINH GỌN, KHÔNG BADGE)
═══════════════════════════════════════════════════════════ */
const menuStructure = [
  {
    section: 'Chính',
    items: [
      { type: 'link', path: '/', icon: LayoutDashboard, label: 'Tổng quan', roles: ALL_ROLES },
      {
        type: 'group',
        key: 'crm',
        icon: Users,
        label: 'Khách hàng',
        children: [
          { path: '/leads', icon: Target, label: 'Khách tiềm năng', roles: ['admin', 'accountant', 'manager', 'sm', 'pm', 'om', 'staff', 'sale'] },
          { path: '/customers', icon: Users, label: 'Hội viên', roles: ALL_ROLES },
        ],
      },
      { type: 'link', path: '/checkin', icon: QrCode, label: 'Check-in', roles: ALL_ROLES },
      { type: 'link', path: '/history', icon: History, label: 'Lịch sử ', roles: ALL_ROLES },
    ],
  },
  {
    section: 'Nghiệp vụ',
    items: [
      { type: 'link', path: '/packages', icon: Package, label: 'Gói tập', roles: ALL_ROLES },
      {
        type: 'group',
        key: 'store',
        icon: Store,
        label: 'Cửa hàng',
        children: [
          { path: '/products/pos', icon: ShoppingCart, label: 'Bán hàng', roles: ALL_ROLES },
          { path: '/products/inventory', icon: PackageSearch, label: 'Tồn kho', roles: ALL_ROLES },
          { path: '/products/import', icon: Download, label: 'Nhập hàng', roles: ALL_ROLES },
        ],
      },
      {
        type: 'group',
        key: 'hr',
        icon: UserCog,
        label: 'Nhân sự',
        children: [
          { path: '/staff', icon: UserCog, label: 'Nhân viên', roles: ALL_ROLES },
          { path: '/commissions', icon: Coins, label: 'Hoa hồng', roles: ['admin', 'accountant', 'manager', 'sm', 'pm', 'om', 'pt', 'sale'] },
        ],
      },
    ],
  },
  {
    section: 'Phân tích',
    items: [
      {
        type: 'group',
        key: 'reports',
        icon: BarChart3,
        label: 'Báo cáo ',
        children: [
          { path: '/reports/revenue', icon: TrendingUp, label: 'Doanh thu', roles: MANAGER_ROLES },
          { path: '/reports/pt-sessions', icon: Dumbbell, label: 'Buổi tập PT', roles: ALL_ROLES },
          { path: '/reports/sales-funnel', icon: Target, label: 'Hợp đồng', roles: MANAGER_ROLES },
          { path: '/reports/customer-analytics', icon: UserSearch, label: 'Phân tích khách hàng', roles: MANAGER_ROLES },
          { path: '/reports/inventory', icon: PackageSearch, label: 'Phân tích kho hàng', roles: MANAGER_ROLES },
          { path: '/reports/logs', icon: AlertTriangle, label: 'Nhật ký & Cảnh báo', roles: MANAGER_ROLES },
        ],
      },
    ],
  },
  {
    section: 'Hệ thống',
    items: [
      { type: 'link', path: '/settings', icon: Settings, label: 'Cài đặt', roles: ['admin', 'accountant'] },
    ],
  },
];

const findGroupKeyForPath = (path) => {
  for (const section of menuStructure) {
    for (const item of section.items) {
      if (item.type === 'group' && item.children.some((c) => path === c.path || (c.path !== '/' && path.startsWith(c.path)))) {
        return item.key;
      }
    }
  }
  return null;
};

/* ═══════════════════════════════════════════════════════════
   3. SUB COMPONENTS
═══════════════════════════════════════════════════════════ */
const NavItem = ({ path, icon: Icon, label, isActive, isChild, isCollapsed }) => (
  <Link
    to={path}
    className={`relative w-full flex items-center gap-2.5 rounded-lg text-left transition-all duration-150 group/item
      ${isChild ? 'pl-7 pr-3 py-1.5' : 'px-3 py-2.5'}
      ${isCollapsed ? 'justify-center px-0' : ''}
      ${
        isActive
          ? 'bg-primary/15 text-gray-900 dark:text-gray-100 font-bold'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-100 font-medium'
      }`}
  >
    {isActive && !isChild && (
      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
    )}
    {isActive && isChild && !isCollapsed && (
      <span className="absolute left-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-primary rounded-full" />
    )}
    {!isChild && Icon && (
      <Icon
        size={20}
        className={`shrink-0 ${isActive ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}
      />
    )}
    {!isCollapsed && <span className={`truncate flex-1 ${isChild ? 'text-[13px]' : 'text-sm'}`}>{label}</span>}
    {isCollapsed && (
      <span className="absolute left-full ml-3 px-2.5 py-1.5 rounded-md bg-gray-900 dark:bg-gray-700 text-white text-xs font-medium opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover/item:opacity-100 transition-opacity duration-150">
        {label}
      </span>
    )}
  </Link>
);

const GroupNavItem = ({ group, activePath, isOpen, isCollapsed, onToggle }) => {
  const Icon = group.icon;
  const hasActiveChild = group.children.some((c) => activePath === c.path || (c.path !== '/' && activePath.startsWith(c.path)));

  if (isCollapsed) {
    return (
      <div className="relative group">
        <button
          className={`w-full flex items-center justify-center px-0 py-2.5 rounded-lg transition-all duration-150
            ${hasActiveChild ? 'bg-primary/10 text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}
        >
          <Icon size={20} className={hasActiveChild ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'} />
        </button>
        <div className="absolute left-full top-0 ml-3 w-56 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg py-2 z-50 opacity-0 pointer-events-none translate-x-1 group-hover:opacity-100 group-hover:pointer-events-auto group-hover:translate-x-0 transition-all duration-150">
          <p className="px-3 pb-1.5 text-[11px] font-bold text-gray-400 dark:text-gray-500">{group.label}</p>
          {group.children.map((child) => {
            const isChildActive = activePath === child.path || (child.path !== '/' && activePath.startsWith(child.path));
            return (
              <Link
                key={child.path}
                to={child.path}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors
                  ${isChildActive ? 'bg-primary/10 text-gray-900 dark:text-gray-100 font-bold' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`}
              >
                <span className="truncate flex-1">{child.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150
          ${
            hasActiveChild
              ? 'bg-primary/10 text-gray-900 dark:text-gray-100 font-bold'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-100 font-medium'
          }`}
      >
        <Icon size={20} className={hasActiveChild ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'} />
        <span className="text-sm truncate flex-1">{group.label}</span>
        {isOpen ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
      </button>

      <div className={`overflow-hidden transition-all duration-200 ease-in-out ${isOpen ? 'max-h-[560px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
        <div className="space-y-0.5">
          {group.children.map((child, idx) => (
            <React.Fragment key={child.path}>
              {child.section && idx !== 0 && <div className="h-2.5" />}
              <NavItem
                path={child.path}
                icon={child.icon}
                label={child.label}
                isChild
                isActive={activePath === child.path || (child.path !== '/' && activePath.startsWith(child.path))}
                isCollapsed={isCollapsed}
              />
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   4. CHÍNH - SIDEBAR COMPONENT
═══════════════════════════════════════════════════════════ */
const Sidebar = () => {
  const { isCollapsed, toggle } = useSidebar();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const role = user?.role || 'staff';
  const activePath = location.pathname;

  const [openGroups, setOpenGroups] = useState({});

  useEffect(() => {
    const key = findGroupKeyForPath(activePath);
    if (key) setOpenGroups((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }, [activePath]);

  const toggleGroup = (key) => setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  const canView = (roles) => !roles || roles.includes(role);

  const visibleMenu = useMemo(() => {
    return menuStructure
      .map((section) => {
        const items = section.items
          .map((item) => {
            if (item.type === 'link') return canView(item.roles) ? item : null;
            const visibleChildren = item.children.filter((c) => canView(c.roles));
            return visibleChildren.length > 0 ? { ...item, children: visibleChildren } : null;
          })
          .filter(Boolean);
        return items.length > 0 ? { ...section, items } : null;
      })
      .filter(Boolean);
  }, [role]);

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
        {visibleMenu.map((section) => (
          <div key={section.section}>
            {!isCollapsed && (
              <p className="px-3 mb-1.5 text-[11px] font-bold text-gray-400 dark:text-gray-600 select-none">
                {section.section}
              </p>
            )}
            {isCollapsed && (
              <div className="border-t border-gray-100 dark:border-gray-800 mx-2 mb-2" />
            )}

            <div className="space-y-0.5">
              {section.items.map((item) =>
                item.type === 'link' ? (
                  <NavItem
                    key={item.path}
                    path={item.path}
                    icon={item.icon}
                    label={item.label}
                    isActive={item.path === '/' ? activePath === '/' : activePath.startsWith(item.path)}
                    isCollapsed={isCollapsed}
                  />
                ) : (
                  <GroupNavItem
                    key={item.key}
                    group={item}
                    activePath={activePath}
                    isOpen={!!openGroups[item.key]}
                    isCollapsed={isCollapsed}
                    onToggle={() => toggleGroup(item.key)}
                  />
                )
              )}
            </div>
          </div>
        ))}
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
        {isCollapsed ? (
          <ChevronRight size={13} strokeWidth={2.5} />
        ) : (
          <ChevronLeft size={13} strokeWidth={2.5} />
        )}
      </button>
    </aside>
  );
};

export default Sidebar;
