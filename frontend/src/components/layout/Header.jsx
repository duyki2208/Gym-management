import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useSidebar } from '../../context/SidebarContext';
import { useAuth } from '../../context/AuthContext';
import {
  Menu, Search, Bell, ChevronRight, X,
  Settings, LogOut, Clock, AlertCircle, ChevronDown, Sun, Moon,
} from 'lucide-react';
import useDarkMode from '../../hooks/useDarkMode';
import { notificationService } from '../../services/notificationService';
import { productService } from '../../services/productService';
import { customerService } from '../../services/customerService';

// ── Breadcrumb map ──────────────────────────────────────────────
const ROUTE_LABELS = {
  '/':           'Tổng quan',
  '/customers':  'Khách hàng',
  '/checkin':    'Check-in',
  '/history':    'Lịch sử',
  '/packages':   'Gói tập',
  '/products':   'Sản phẩm',
  '/staff':      'Nhân viên',
  '/reports':    'Báo cáo',
  '/settings':   'Cài đặt',
};

const Breadcrumb = () => {
  const location = useLocation();
  const pathname = location.pathname;

  // Xây dựng segments từ pathname hiện tại — không hardcode "Tổng quan" ở đầu
  const segments = [];

  // Tìm top-level route khớp nhất (ưu tiên path dài hơn)
  const topLevelKey = Object.keys(ROUTE_LABELS)
    .filter(key => key === '/' ? pathname === '/' : pathname.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];

  if (topLevelKey) {
    segments.push({ label: ROUTE_LABELS[topLevelKey], path: topLevelKey });

    // Nếu có sub-path thêm vào sau (ví dụ /products/import)
    const remaining = pathname.slice(topLevelKey === '/' ? 1 : topLevelKey.length);
    if (remaining && remaining !== '/') {
      const subLabel = remaining.replace(/^\//, '').replace(/-/g, ' ');
      segments.push({ label: subLabel, path: pathname });
    }
  }

  return (
    <nav className="hidden md:flex items-center gap-1.5 text-sm">
      {segments.map((seg, i) => (
        <React.Fragment key={seg.path}>
          {i > 0 && <ChevronRight size={14} className="text-gray-300 dark:text-gray-600 shrink-0" />}
          {i === segments.length - 1 ? (
            <span className="font-semibold text-gray-800 dark:text-gray-100 truncate max-w-[160px]">
              {seg.label}
            </span>
          ) : (
            <Link
              to={seg.path}
              className="text-gray-400 dark:text-gray-500 hover:text-primary transition-colors truncate max-w-[120px]"
            >
              {seg.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

// ── Global Search ───────────────────────────────────────────────
const GlobalSearch = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ customers: [], products: [] });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults({ customers: [], products: [] });
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [custRes, prodRes] = await Promise.allSettled([
          customerService.getAll({ search: query.trim(), limit: 5 }),
          productService.getAll(query.trim()),
        ]);
        setResults({
          customers: custRes.status === 'fulfilled' ? (custRes.value?.customers || []).slice(0, 4) : [],
          products:  prodRes.status === 'fulfilled' ? (Array.isArray(prodRes.value) ? prodRes.value.slice(0, 3) : []) : [],
        });
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Click outside to close
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hasResults = results.customers.length > 0 || results.products.length > 0;
  const showDropdown = open && query.trim();

  return (
    <div ref={containerRef} className="relative w-full max-w-xs lg:max-w-sm">
      <div className={`
        flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200
        ${open
          ? 'border-primary bg-white dark:bg-gray-800 shadow-md shadow-primary/10'
          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:border-gray-300'
        }
      `}>
        <Search size={15} className={`shrink-0 ${open ? 'text-primary' : 'text-gray-400'}`} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Tìm khách, SĐT, sản phẩm..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="flex-1 bg-transparent text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 outline-none min-w-0"
        />
        {query ? (
          <button onClick={() => { setQuery(''); setResults({ customers: [], products: [] }); }} className="text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        ) : null}
      </div>

      {/* Results dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden animate-slideDown">
          {loading && (
            <div className="px-4 py-3 text-xs text-gray-400 text-center">Đang tìm...</div>
          )}

          {!loading && !hasResults && (
            <div className="px-4 py-6 text-center">
              <Search size={24} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">Không tìm thấy kết quả</p>
            </div>
          )}

          {!loading && results.customers.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                Khách hàng ({results.customers.length})
              </p>
              {results.customers.map(c => (
                <button
                  key={c._id}
                  onClick={() => { navigate(`/customers?id=${c._id}&search=${encodeURIComponent(c.name)}`); setOpen(false); setQuery(''); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                    {c.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{c.name}</p>
                    <p className="text-xs text-gray-400 truncate">{c.phone} • {c.packageType}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && results.products.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-gray-400 border-t border-gray-100 dark:border-gray-800">
                Sản phẩm ({results.products.length})
              </p>
              {results.products.map(p => (
                <button
                  key={p._id}
                  onClick={() => { navigate('/products'); setOpen(false); setQuery(''); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center font-bold text-sm shrink-0">
                    📦
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.sellPrice?.toLocaleString()} đ • Tồn: {p.stockQuantity}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {hasResults && (
            <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-2">
              <p className="text-[10px] text-gray-400 text-center">Nhấn Enter để xem tất cả</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Notification Bell ───────────────────────────────────────────
const NotificationBell = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationService.getAll();
      setNotifications(res?.notifications || []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000); // refresh mỗi 5 phút
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Click outside
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const count = notifications.length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`
          relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200
          ${open
            ? 'bg-primary/10 text-primary'
            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200'
          }
        `}
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-black rounded-full leading-none">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden animate-slideDown">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-primary" />
              <span className="font-bold text-sm text-gray-800 dark:text-gray-100">Thông báo</span>
              {count > 0 && (
                <span className="bg-red-100 text-red-600 text-[10px] font-black px-1.5 py-0.5 rounded-full">{count}</span>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {loading && (
              <div className="px-4 py-6 text-center text-xs text-gray-400">Đang tải...</div>
            )}
            {!loading && count === 0 && (
              <div className="px-4 py-8 text-center">
                <Bell size={28} className="mx-auto text-gray-200 dark:text-gray-700 mb-2" />
                <p className="text-sm text-gray-400">Không có thông báo</p>
              </div>
            )}
            {!loading && notifications.map(n => (
              <button
                key={n.id}
                onClick={() => {
                  if (n.type === 'team_task') {
                    navigate('/?openTasks=true');
                  } else {
                    navigate('/customers?status=expiring');
                  }
                  setOpen(false);
                }}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-orange-50/60 dark:hover:bg-orange-900/10 text-left transition-colors border-b border-gray-50 dark:border-gray-800 last:border-0"
              >
                <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${n.type === 'team_task' ? 'bg-red-100 text-red-500' : n.daysLeft <= 3 ? 'bg-red-100 text-red-500' : 'bg-orange-100 text-orange-500'}`}>
                  <AlertCircle size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{n.title}</p>
                  <p className="text-xs text-gray-400 truncate">{n.subtitle}</p>
                  <p className={`text-xs font-bold mt-0.5 ${n.type === 'team_task' ? 'text-red-500' : n.severity === 'high' ? 'text-red-500' : 'text-orange-500'}`}>
                    {n.type === 'team_task' ? 'Cần thực hiện ngay' : n.daysLeft <= 0 ? 'Đã hết hạn' : `Còn ${n.daysLeft} ngày`}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-gray-300 dark:text-gray-600 shrink-0">
                  <Clock size={12} />
                  <span className="text-[10px]">{n.type === 'team_task' ? 'Hôm nay' : new Date(n.endDate).toLocaleDateString('vi-VN')}</span>
                </div>
              </button>
            ))}
          </div>

          {count > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => { navigate('/customers?status=expiring'); setOpen(false); }}
                className="w-full py-2.5 text-xs font-bold text-primary hover:bg-primary/5 transition-colors"
              >
                Xem tất cả khách sắp hết hạn
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── User Menu ───────────────────────────────────────────────────
const UserMenu = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase()
    : 'A';

  const roleLabel = {
    admin: 'Quản trị viên',
    accountant: 'Kế toán',
    manager: 'Quản lý',
    sm: 'SM (Sale Manager)',
    pm: 'PM (PT Manager)',
    om: 'OM (Operation Manager)',
    staff: 'Nhân viên',
    pt: 'PT',
    sale: 'Sale',
    reception: 'Lễ tân',
  }[user?.role] || user?.role;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center text-white font-black text-sm select-none shadow-sm">
          {initials}
        </div>
        <div className="hidden lg:block text-left">
          <p className="text-sm font-bold text-gray-800 dark:text-gray-100 leading-none mb-0.5 truncate max-w-[100px]">
            {user?.name || 'Account'}
          </p>
          <p className="text-[10px] text-gray-400 capitalize leading-none">{roleLabel}</p>
        </div>
        <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden animate-slideDown">
          {/* User info */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <p className="font-bold text-sm text-gray-800 dark:text-gray-100">{user?.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{user?.username}</p>
            <span className="inline-block mt-1.5 text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full capitalize">
              {roleLabel}
            </span>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <button
              onClick={() => { navigate('/settings'); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Settings size={15} className="text-gray-400" />
              Cài đặt
            </button>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 py-1">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut size={15} />
              Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Header (Main) ───────────────────────────────────────────────
const Header = () => {
  const { toggle } = useSidebar();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isDark, toggleDark] = useDarkMode();

  return (
    <header className="sticky top-0 z-30 h-16 flex items-center shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 gap-3">
      {/* ── LEFT: chỉ Toggle ── */}
      <div className="flex items-center shrink-0">
        <button
          onClick={toggle}
          className="flex items-center justify-center w-9 h-9 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-all"
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* ── CENTER ── */}
      <div className="flex-1 flex items-center gap-4 min-w-0">
        <Breadcrumb />
        <div className="flex-1 max-w-sm">
          <GlobalSearch />
        </div>
      </div>

      {/* ── RIGHT ── */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          aria-label={isDark ? 'Chuyển sang Light Mode' : 'Chuyển sang Dark Mode'}
          title={isDark ? 'Light Mode' : 'Dark Mode'}
          className="flex items-center justify-center w-9 h-9 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-all"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

        {/* Notification bell */}
        <NotificationBell />

        {/* Divider */}
        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />

        {/* User menu */}
        <UserMenu />
      </div>
    </header>
  );
};

export default Header;
