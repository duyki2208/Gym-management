import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Search, Bell, ChevronRight, X,
  Settings, LogOut, Clock, AlertCircle, ChevronDown, Sun, Moon,
  Building2, MapPin, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useDarkMode from '../../hooks/useDarkMode';
import { notificationService } from '../../services/notificationService';
import { searchService } from '../../services/searchService';
import { authService } from '../../services/authService';

// ── Breadcrumb map (Trùng khớp 100% với Sidebar Left) ──────────────────────────
const BREADCRUMB_MAP = {
  '/':                            [{ label: 'Tổng quan', path: '/' }],
  '/leads':                       [{ label: 'Khách hàng', path: '/customers' }, { label: 'Khách tiềm năng', path: '/leads' }],
  '/customers':                   [{ label: 'Khách hàng', path: '/customers' }, { label: 'Hội viên', path: '/customers' }],
  '/checkin':                     [{ label: 'Check-in', path: '/checkin' }],
  '/history':                     [{ label: 'Lịch sử', path: '/history' }],
  '/packages':                    [{ label: 'Gói tập', path: '/packages' }],
  '/products':                    [{ label: 'Cửa hàng', path: '/products/pos' }, { label: 'Sản phẩm', path: '/products' }],
  '/products/pos':                [{ label: 'Cửa hàng', path: '/products/pos' }, { label: 'Bán hàng', path: '/products/pos' }],
  '/products/inventory':          [{ label: 'Cửa hàng', path: '/products/pos' }, { label: 'Tồn kho', path: '/products/inventory' }],
  '/products/import':             [{ label: 'Cửa hàng', path: '/products/pos' }, { label: 'Nhập hàng', path: '/products/import' }],
  '/staff':                       [{ label: 'Nhân sự', path: '/staff' }, { label: 'Nhân viên', path: '/staff' }],
  '/commissions':                 [{ label: 'Nhân sự', path: '/staff' }, { label: 'Hoa hồng', path: '/commissions' }],
  '/reports':                     [{ label: 'Báo cáo', path: '/reports/revenue' }],
  '/reports/revenue':             [{ label: 'Báo cáo', path: '/reports/revenue' }, { label: 'Doanh thu', path: '/reports/revenue' }],
  '/reports/pt-sessions':         [{ label: 'Báo cáo', path: '/reports/revenue' }, { label: 'Buổi tập PT', path: '/reports/pt-sessions' }],
  '/reports/sales-funnel':        [{ label: 'Báo cáo', path: '/reports/revenue' }, { label: 'Hợp đồng', path: '/reports/sales-funnel' }],
  '/reports/customer-analytics':  [{ label: 'Báo cáo', path: '/reports/revenue' }, { label: 'Phân tích khách hàng', path: '/reports/customer-analytics' }],
  '/reports/inventory':           [{ label: 'Báo cáo', path: '/reports/revenue' }, { label: 'Phân tích kho hàng', path: '/reports/inventory' }],
  '/reports/logs':                [{ label: 'Báo cáo', path: '/reports/revenue' }, { label: 'Nhật ký & Cảnh báo', path: '/reports/logs' }],
  '/settings':                    [{ label: 'Cài đặt', path: '/settings' }],
};

const Breadcrumb = () => {
  const location = useLocation();
  const pathname = location.pathname;

  // Lấy danh sách segments từ BREADCRUMB_MAP (nếu trùng route chính)
  // Nếu là sub-route không định nghĩa trước, khớp theo prefix dài nhất
  let segments = BREADCRUMB_MAP[pathname];

  if (!segments) {
    const matchedKey = Object.keys(BREADCRUMB_MAP)
      .filter(key => key !== '/' && pathname.startsWith(key))
      .sort((a, b) => b.length - a.length)[0];

    if (matchedKey) {
      const baseSegments = BREADCRUMB_MAP[matchedKey];
      const remaining = pathname.slice(matchedKey.length).replace(/^\//, '').replace(/-/g, ' ');
      segments = [...baseSegments, { label: remaining, path: pathname }];
    } else {
      segments = [{ label: 'Trang chủ', path: '/' }];
    }
  }

  return (
    <nav className="flex items-center gap-1.5 text-sm shrink-0">
      {segments.map((seg, i) => (
        <React.Fragment key={seg.path + i}>
          {i > 0 && <ChevronRight size={14} className="text-gray-300 dark:text-gray-600 shrink-0" />}
          {i === segments.length - 1 ? (
            <span className="font-bold text-gray-800 dark:text-gray-100 truncate max-w-[200px]">
              {seg.label}
            </span>
          ) : (
            <Link
              to={seg.path}
              className="text-gray-400 dark:text-gray-500 hover:text-primary transition-colors truncate max-w-[140px]"
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

const HighlightMatch = ({ text = '', query = '' }) => {
  if (!query.trim() || !text) return <span>{text}</span>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 rounded px-0.5 font-bold not-italic">
            {part}
          </mark>
        ) : <span key={i}>{part}</span>
      )}
    </span>
  );
};

const ROLE_LABEL = {
  admin: 'Quản trị viên', accountant: 'Kế toán', manager: 'Quản lý',
  sm: 'SM', pm: 'PT Manager', om: 'OM', staff: 'Nhân viên',
  pt: 'PT', sale: 'Sale', reception: 'Lễ tân',
};

const GlobalSearch = () => {
  const navigate = useNavigate();
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState({ customers: [], staff: [], packages: [], leads: [], products: [] });
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef     = useRef(null);
  const containerRef = useRef(null);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults({ customers: [], staff: [], packages: [], leads: [], products: [] });
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchService.search(query.trim(), { limit: 5 });
        setResults(res.data || { customers: [], staff: [], packages: [], leads: [], products: [] });
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  // Escape để đóng
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { setOpen(false); setQuery(''); inputRef.current?.blur(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Click outside
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const go = (path) => { navigate(path); setOpen(false); setQuery(''); };

  const hasResults = Object.values(results).some(arr => arr.length > 0);

  return (
    <div ref={containerRef} className="relative w-full max-w-sm lg:max-w-lg xl:max-w-xl">
      {/* Input */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200 ${
        open
          ? 'border-primary bg-white dark:bg-gray-800 shadow-lg shadow-primary/10'
          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:border-gray-300'
      }`}>
        <Search size={15} className={`shrink-0 transition-colors ${open ? 'text-primary' : 'text-gray-400'}`} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Tìm kiếm khách hàng, nhân viên, sản phẩm..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="flex-1 bg-transparent text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 outline-none min-w-0"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults({ customers: [], staff: [], packages: [], leads: [], products: [] }); }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Dropdown — chỉ hiện khi có query */}
      {open && query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden max-h-[70vh] overflow-y-auto">

          {/* Loading */}
          {loading && (
            <div className="px-4 py-4 text-center">
              <div className="inline-flex items-center gap-2 text-xs text-gray-400">
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Đang tìm kiếm...
              </div>
            </div>
          )}

          {/* No results */}
          {!loading && !hasResults && (
            <div className="px-4 py-8 text-center">
              <Search size={28} className="mx-auto text-gray-200 dark:text-gray-700 mb-2" />
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                Không tìm thấy "<span className="text-primary">{query}</span>"
              </p>
              <p className="text-xs text-gray-400 mt-1">Thử từ khóa khác</p>
            </div>
          )}

          {/* Customers */}
          {!loading && results.customers.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                👤 Khách hàng ({results.customers.length})
              </p>
              {results.customers.map(c => (
                <button key={c._id}
                  onClick={() => go(`/customers?id=${c._id}&search=${encodeURIComponent(c.name)}`)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                    {c.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                      <HighlightMatch text={c.name} query={query} />
                    </p>
                    <p className="text-xs text-gray-400 truncate">{c.phone} • {c.packageType}</p>
                  </div>
                  <span className="text-[10px] text-gray-300 dark:text-gray-600 shrink-0">{c.code}</span>
                </button>
              ))}
            </div>
          )}

          {/* Staff */}
          {!loading && results.staff.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-gray-400 border-t border-gray-100 dark:border-gray-800">
                👥 Nhân viên ({results.staff.length})
              </p>
              {results.staff.map(s => (
                <button key={s._id} onClick={() => go('/staff')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center font-bold text-sm shrink-0">
                    {(s.fullName || s.username)?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                      <HighlightMatch text={s.fullName || s.username} query={query} />
                    </p>
                    <p className="text-xs text-gray-400 truncate">{ROLE_LABEL[s.role] || s.role}{s.phone ? ` • ${s.phone}` : ''}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Packages */}
          {!loading && results.packages.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-gray-400 border-t border-gray-100 dark:border-gray-800">
                🎟️ Gói tập ({results.packages.length})
              </p>
              {results.packages.map(pkg => (
                <button key={pkg._id} onClick={() => go('/packages')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center text-sm shrink-0">🎟️</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                      <HighlightMatch text={pkg.name} query={query} />
                    </p>
                    <p className="text-xs text-gray-400">{pkg.duration} ngày • {pkg.price?.toLocaleString()} đ</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Products */}
          {!loading && results.products.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-gray-400 border-t border-gray-100 dark:border-gray-800">
                📦 Sản phẩm ({results.products.length})
              </p>
              {results.products.map(p => (
                <button key={p._id} onClick={() => go('/products')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center text-sm shrink-0">📦</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                      <HighlightMatch text={p.name} query={query} />
                    </p>
                    <p className="text-xs text-gray-400">{p.sellPrice?.toLocaleString()} đ • Tồn: {p.stockQuantity}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Leads */}
          {!loading && results.leads.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-gray-400 border-t border-gray-100 dark:border-gray-800">
                📋 Leads ({results.leads.length})
              </p>
              {results.leads.map(lead => (
                <button key={lead._id} onClick={() => go('/leads')}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-pink-100 dark:bg-pink-900/30 text-pink-600 flex items-center justify-center text-sm shrink-0">📋</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                      <HighlightMatch text={lead.name} query={query} />
                    </p>
                    <p className="text-xs text-gray-400">{lead.phone} • {lead.status}</p>
                  </div>
                </button>
              ))}
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
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

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
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <p className="font-bold text-sm text-gray-800 dark:text-gray-100">{user?.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{user?.username}</p>
            <span className="inline-block mt-1.5 text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full capitalize">
              {roleLabel}
            </span>
          </div>

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

// ── Helper to format branch button label: 'Cơ sở : <Tên>' ──
const formatBranchButtonLabel = (rawName) => {
  if (!rawName) return 'Cơ sở : Chưa đặt tên';
  let clean = rawName
    .replace(/^GymPro\s*[-:]\s*/i, '')
    .replace(/^Trụ sở\s+/i, '')
    .replace(/^Chi nhánh\s+/i, '')
    .replace(/^Cơ sở\s*[:\-]?\s*/i, '')
    .trim();
  return `Cơ sở : ${clean}`;
};

const cleanBranchName = (rawName) => {
  if (!rawName) return '';
  return rawName
    .replace(/^GymPro\s*[-:]\s*/i, '')
    .replace(/^Trụ sở\s+/i, '')
    .replace(/^Chi nhánh\s+/i, '')
    .replace(/^Cơ sở\s*[:\-]?\s*/i, '')
    .trim();
};

// ── Branch Selector (Multi-Branch) ──────────────────────────────
const BranchSelector = () => {
  const { user, switchBranch } = useAuth();
  const [branches, setBranches] = useState([]);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef(null);

  const isCentral = user?.role === 'admin' || user?.role === 'accountant' || user?.isCentral;
  const currentBranchCode = user?.activeBranch || user?.branchCode || 'HN01';

  useEffect(() => {
    const fetchBranches = async () => {
      const list = await authService.getBranches();
      if (list && list.length > 0) {
        setBranches(list);
      } else {
        setBranches([
          { code: 'HN01', name: 'Cầu Giấy - Hà Nội', address: 'Số 123 Đường Cầu Giấy, Quận Cầu Giấy, Hà Nội' },
          { code: 'HCM01', name: 'Quận 1 - Hồ Chí Minh', address: 'Số 456 Đường Nguyễn Thị Minh Khai, Quận 1, TP.HCM' },
        ]);
      }
    };
    fetchBranches();
  }, []);

  // Lắng nghe sự kiện cập nhật Cài đặt để đổi tên/địa chỉ button ngay tức thì mà không cần reload
  useEffect(() => {
    const handleSettingsUpdated = (e) => {
      if (e.detail?.gymName) {
        setBranches((prev) =>
          prev.map((b) =>
            b.code === currentBranchCode
              ? { ...b, name: e.detail.gymName, address: e.detail.address !== undefined ? e.detail.address : b.address }
              : b
          )
        );
      }
    };
    window.addEventListener("branch-settings-updated", handleSettingsUpdated);
    return () => window.removeEventListener("branch-settings-updated", handleSettingsUpdated);
  }, [currentBranchCode]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeBranchObj = branches.find((b) => b.code === currentBranchCode) || {
    code: currentBranchCode,
    name: currentBranchCode === 'HN01' ? 'Cầu Giấy - Hà Nội' : 'Quận 1 - Hồ Chí Minh',
    address: currentBranchCode === 'HN01' ? 'Số 123 Đường Cầu Giấy, Quận Cầu Giấy, Hà Nội' : 'Số 456 Đường Nguyễn Thị Minh Khai, Quận 1, TP.HCM',
  };

  const handleSelectBranch = async (branchCode) => {
    if (branchCode === currentBranchCode) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    const res = await switchBranch(branchCode);
    setSwitching(false);
    setOpen(false);
    if (res.success) {
      toast.success(`Đã chuyển sang ${cleanBranchName(res.branchName) || branchCode}`);
      setTimeout(() => {
        window.location.reload();
      }, 250);
    } else {
      toast.error(res.message || 'Lỗi chuyển chi nhánh');
    }
  };

  if (!isCentral) {
    return (
      <div className="flex items-center h-10 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-800 dark:text-gray-200 select-none shrink-0">
        <span className="font-semibold text-sm">
          {formatBranchButtonLabel(activeBranchObj.name)}
        </span>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={switching}
        className={`flex items-center gap-2 h-10 px-4 rounded-xl border text-sm font-medium transition-all duration-150 cursor-pointer select-none ${
          open
            ? 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-100'
        }`}
        title="Bấm để chọn chi nhánh làm việc"
      >
        <span className="font-semibold text-sm tracking-tight truncate max-w-[220px]">
          {formatBranchButtonLabel(activeBranchObj.name)}
        </span>
        <ChevronDown size={15} className={`text-gray-400 dark:text-gray-500 transition-transform duration-200 shrink-0 ${open ? 'rotate-180 text-gray-700 dark:text-gray-200' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden animate-slideDown">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <p className="font-bold text-xs text-gray-700 dark:text-gray-200 uppercase tracking-wider">
              Chọn Chi Nhánh Làm Việc
            </p>
          </div>

          <div className="py-1 max-h-64 overflow-y-auto">
            {branches.map((b) => {
              const isSelected = b.code === currentBranchCode;
              return (
                <button
                  key={b.code}
                  onClick={() => handleSelectBranch(b.code)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors cursor-pointer border-b border-gray-50 dark:border-gray-800/50 last:border-0 ${
                    isSelected
                      ? 'bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 font-semibold'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60'
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="font-bold text-sm text-gray-800 dark:text-gray-100 truncate">
                      {cleanBranchName(b.name)}
                    </p>
                    {b.address && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                        {b.address}
                      </p>
                    )}
                  </div>
                  {isSelected && <Check size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Header (Main) ───────────────────────────────────────────────
const Header = () => {
  const [isDark, toggleDark] = useDarkMode();

  return (
    <header className="sticky top-0 z-30 h-16 flex items-center shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 gap-3">
      {/* ── CENTER / BREADCRUMB & SEARCH ── */}
      <div className="flex-1 flex items-center gap-4 min-w-0">
        <Breadcrumb />
        <div className="flex-1">
          <GlobalSearch />
        </div>
      </div>

      {/* ── RIGHT ── */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Branch Selector / Active Branch Badge */}
        <BranchSelector />

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-0.5" />

        <button
          onClick={toggleDark}
          aria-label={isDark ? 'Chuyển sang Light Mode' : 'Chuyển sang Dark Mode'}
          title={isDark ? 'Light Mode' : 'Dark Mode'}
          className="flex items-center justify-center w-9 h-9 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-all"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-0.5" />
        <NotificationBell />
        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-0.5" />
        <UserMenu />
      </div>
    </header>
  );
};

export default Header;

