import React, { useState, useEffect, useMemo } from 'react';
import {
  Dumbbell, Search, Calendar, Filter, Download, ChevronDown,
  CheckCircle2, XCircle, AlertTriangle, TrendingUp,
  Award, RefreshCw, UserCheck
} from 'lucide-react';
import reportService from '../../services/reportService';
import { staffService } from '../../services/customerService';
import toast from 'react-hot-toast';

const STATUS_MAP = {
  completed: { label: 'Hoàn thành', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800', icon: CheckCircle2 },
  cancelled: { label: 'Đã huỷ / Vi phạm', color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800', icon: XCircle },
};

const KPICard = ({ icon: Icon, label, value, sub, tone }) => {
  const toneMap = {
    primary: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    red: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  };
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 transition-all hover:shadow-md">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${toneMap[tone]}`}>
        <Icon size={20} />
      </div>
      <p className="text-2xl font-black text-gray-800 dark:text-gray-100">{value}</p>
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  );
};

const PTSessionReportView = ({ selectedMonth, selectedYear, setSelectedMonth, setSelectedYear, userRole = 'admin' }) => {
  const [search, setSearch] = useState('');
  const [ptFilter, setPtFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [onlyAtRisk, setOnlyAtRisk] = useState(false);

  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [ptList, setPtList] = useState([]);

  useEffect(() => {
    fetchPTList();
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [selectedMonth, selectedYear, ptFilter, statusFilter]);

  const fetchPTList = async () => {
    try {
      const staff = await staffService.getAll();
      const pts = staff.filter((s) => s.role === 'pt' || s.role === 'pm');
      setPtList(pts);
    } catch (e) {
      console.error("Lỗi lấy danh sách PT:", e);
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const res = await reportService.getPTSessionsReport({
        month: selectedMonth,
        year: selectedYear,
        ptId: ptFilter,
        status: statusFilter,
      });
      if (res.success) {
        setReportData(res.data);
      }
    } catch (error) {
      console.error("Lỗi lấy báo cáo PT sessions:", error);
      toast.error("Không thể tải báo cáo buổi tập PT");
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      toast.loading("Đang xuất file Excel đối soát buổi tập...", { id: "pt-excel" });
      await reportService.exportPTSessionsExcel({ month: selectedMonth, year: selectedYear, ptId: ptFilter });
      toast.success("Xuất file Excel đối soát thành công!", { id: "pt-excel" });
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi xuất file Excel", { id: "pt-excel" });
    }
  };

  const rawSessions = reportData?.sessions || [];

  const filteredSessions = useMemo(() => {
    return rawSessions.filter((s) => {
      const custName = s.customer?.name || '';
      const custPhone = s.customer?.phone || '';
      const ptName = s.pt?.fullName || s.ptName || '';

      const matchSearch =
        search.trim() === '' ||
        custName.toLowerCase().includes(search.toLowerCase()) ||
        custPhone.includes(search) ||
        ptName.toLowerCase().includes(search.toLowerCase());

      const matchRisk = !onlyAtRisk || s.remaining <= 2;
      return matchSearch && matchRisk;
    });
  }, [rawSessions, search, onlyAtRisk]);

  const completedCount = reportData?.completedCount ?? rawSessions.filter(s => s.status === 'completed').length;
  const cancelledCount = reportData?.cancelledCount ?? rawSessions.filter(s => s.status === 'cancelled').length;
  const atRiskCount = reportData?.atRiskCount ?? rawSessions.filter(s => s.remaining <= 2).length;
  const activePTCount = ptList.length || 1;
  const avgPerPT = Math.round(completedCount / activePTCount);

  const leaderboard = reportData?.leaderboard || [];

  return (
    <div className="space-y-6">
      {/* Header trang */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100">Buổi Tập PT</h2>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-sm hover:bg-emerald-700 shrink-0 transition"
          >
            <Download size={15} /> Xuất File Excel
          </button>
        </div>
      </div>

      {/* 1. KPI tổng quan của hệ thống */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Dumbbell}
          label={`Tổng buổi đã dạy (${selectedMonth}/${selectedYear})`}
          value={completedCount.toLocaleString('vi-VN')}
          sub="Đã hoàn thành chuẩn"
          tone="primary"
        />
        <KPICard
          icon={TrendingUp}
          label="TB buổi hoàn thành / PT"
          value={avgPerPT}
          sub={`${activePTCount} PT đang hoạt động`}
          tone="emerald"
        />
        <KPICard
          icon={XCircle}
          label="Buổi bị huỷ / Vi phạm"
          value={cancelledCount}
          sub="Không tính hoàn thành"
          tone="red"
        />
        <KPICard
          icon={AlertTriangle}
          label="Khách sắp hết buổi"
          value={atRiskCount}
          sub="Còn ≤ 2 buổi trong gói"
          tone="amber"
        />
      </div>

      {/* 2 & 3. ĐỒNG BỘ THANH LỌC VÀ BẢNG DỮ LIỆU THÀNH MỘT CARD THỐNG NHẤT */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
        {/* Toolbar Lọc Dữ Liệu */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 flex-1 min-w-[220px]">
              <Search size={15} className="text-gray-400 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên khách, SĐT hoặc tên PT..."
                className="bg-transparent text-xs text-gray-800 dark:text-gray-100 outline-none w-full placeholder:text-gray-400"
              />
            </div>

            <select
              value={ptFilter}
              onChange={(e) => setPtFilter(e.target.value)}
              className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 outline-none"
            >
              <option value="all">-- Tất cả PT --</option>
              {ptList.map((pt) => (
                <option key={pt._id} value={pt._id}>
                  {pt.fullName || pt.username}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              {Object.entries(STATUS_MAP).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>

            <button
              onClick={() => setOnlyAtRisk((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                onlyAtRisk
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 hover:bg-amber-100 border border-amber-200 dark:border-amber-800'
              }`}
            >
              <AlertTriangle size={14} /> Sắp hết buổi (≤2)
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50/80 dark:bg-gray-900/40 text-black dark:text-white uppercase font-bold text-xs border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3.5">Thời gian</th>
                <th className="px-4 py-3.5">Hội viên</th>
                <th className="px-4 py-3.5">SĐT</th>
                <th className="px-4 py-3.5">Gói tập</th>
                <th className="px-4 py-3.5">PT hướng dẫn</th>
                <th className="px-4 py-3.5">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    Đang tải danh sách buổi tập...
                  </td>
                </tr>
              )}
              {!loading && filteredSessions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    Không tìm thấy buổi tập nào khớp bộ lọc
                  </td>
                </tr>
              )}
              {!loading && filteredSessions.map((s) => {
                const st = STATUS_MAP[s.status] || STATUS_MAP.completed;
                const StIcon = st.icon;
                const atRisk = s.remaining <= 2 && s.remaining >= 0;
                const custName = s.customer?.name || 'Khách hàng';
                const custPhone = s.customer?.phone || s.customer?.code || 'N/A';
                const ptName = s.pt?.fullName || s.ptName || 'PT Chưa gán';

                return (
                  <tr key={s._id || s.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-700/30 transition-colors">
                    {/* 1. Thời gian */}
                    <td className="px-4 py-3.5 text-gray-900 dark:text-gray-100 font-medium whitespace-nowrap">
                      {new Date(s.date).toLocaleString('vi-VN', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    {/* 2. Hội viên */}
                    <td className="px-4 py-3.5 text-gray-900 dark:text-gray-100 font-medium">
                      {custName}
                    </td>
                    {/* 3. SĐT */}
                    <td className="px-4 py-3.5 text-gray-900 dark:text-gray-100 font-medium">{custPhone}</td>
                    {/* 4. Gói tập */}
                    <td className="px-4 py-3.5 font-medium text-gray-900 dark:text-gray-100">
                      <span>{s.packageName || 'Gói PT'}</span>
                      {atRisk && (
                        <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200">
                          <AlertTriangle size={10} /> còn {s.remaining} buổi
                        </span>
                      )}
                    </td>
                    {/* 5. PT hướng dẫn */}
                    <td className="px-4 py-3.5 text-gray-900 dark:text-gray-100 font-medium">{ptName}</td>
                    {/* 6. Trạng thái */}
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${st.color}`}>
                        <StIcon size={13} /> {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer của Card */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-900/50">
          Hiển thị {filteredSessions.length} / {rawSessions.length} buổi tập
        </div>
      </div>

      {/* 4. Card TOP PT Xuất Sắc (Dưới cùng của trang) */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <Award size={18} className="text-amber-500" />
          <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">TOP PT Xuất Sắc</p>
        </div>
        <p className="text-[11px] text-gray-400 mb-4">Xếp hạng theo số buổi hoàn thành trong tháng {selectedMonth}/{selectedYear}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {leaderboard.length === 0 && (
            <p className="text-xs text-gray-400 col-span-full text-center py-4">Chưa có dữ liệu xếp hạng</p>
          )}
          {leaderboard.map((pt, idx) => (
            <div key={pt.name || idx} className="bg-gray-50 dark:bg-gray-900/50 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700/60 flex items-center gap-3">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                idx === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{pt.name}</p>
                <p className="text-[11px] font-black text-blue-600 dark:text-blue-400 mt-0.5">{pt.sessions} buổi</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PTSessionReportView;
