import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Download,
  ClipboardCheck
} from 'lucide-react';
import reportService from '../../services/reportService';
import { staffService } from '../../services/customerService';
import toast from 'react-hot-toast';
import PTSessionReportModal from './PTSessionReportModal';
import {
  ReportMetricCell,
  ReportMetricStrip,
  ReportPageHeader,
} from './ReportPrimitives';

const STATUS_MAP = {
  completed: { label: 'Hoàn thành', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' },
  cancelled: { label: 'Đã huỷ / Vi phạm', color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800' },
};

const PTSessionReportView = ({ selectedMonth, selectedYear, setSelectedMonth, setSelectedYear, userRole = 'admin' }) => {
  const [search, setSearch] = useState('');
  const [ptFilter, setPtFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [ptList, setPtList] = useState([]);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  useEffect(() => {
    fetchPTList();
  }, []);

  const fetchPTList = async () => {
    try {
      const staff = await staffService.getAll();
      const pts = staff.filter((s) => s.role === 'pt' || s.role === 'pm');
      setPtList(pts);
    } catch (e) {
      console.error("Lỗi lấy danh sách PT:", e);
    }
  };

  const fetchReportData = useCallback(async () => {
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
  }, [selectedMonth, selectedYear, ptFilter, statusFilter]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

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

  const rawSessions = useMemo(() => reportData?.sessions || [], [reportData?.sessions]);

  const filteredSessions = useMemo(() => {
    return rawSessions.filter((s) => {
      const custName = s.customer?.name || '';
      const custPhone = s.customer?.phone || '';
      const ptName = s.pt?.fullName || s.ptName || '';

      return (
        search.trim() === '' ||
        custName.toLowerCase().includes(search.toLowerCase()) ||
        custPhone.includes(search) ||
        ptName.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [rawSessions, search]);

  const completedCount = reportData?.completedCount ?? rawSessions.filter(s => s.status === 'completed').length;
  const cancelledCount = reportData?.cancelledCount ?? rawSessions.filter(s => s.status === 'cancelled').length;
  const atRiskCount = reportData?.atRiskCount ?? rawSessions.filter(s => s.remaining <= 2).length;
  const activePTCount = ptList.length || 1;
  const avgPerPT = Math.round(completedCount / activePTCount);

  const leaderboard = reportData?.leaderboard || [];

  return (
    <div className="space-y-6">
      <ReportPageHeader
        title="Buổi tập PT"
        description="Theo dõi lịch sử buổi tập và đối soát phiên dạy PT"
      >
          {/* Chọn tháng / năm */}
          {setSelectedMonth && setSelectedYear && (
            <div className="flex items-center gap-2">
              <select
                aria-label="Chọn tháng"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="h-10 rounded-lg border border-border-light bg-surface-light px-3 text-base font-semibold text-text-light outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark md:text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>
              <select
                aria-label="Chọn năm"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="h-10 rounded-lg border border-border-light bg-surface-light px-3 text-base font-semibold text-text-light outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark md:text-sm"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => setIsAuditModalOpen(true)}
            className="flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-border-light bg-surface-light px-4 text-xs font-semibold text-text-light transition-colors hover:bg-gray-100 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:hover:bg-gray-800 md:text-sm"
          >
            <ClipboardCheck size={15} /> Đối soát buổi tập PT
          </button>

          <button
            onClick={handleExportExcel}
            className="flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-text-light transition-colors hover:bg-primary-hover md:text-sm"
          >
            <Download size={16} /> Xuất Excel
          </button>
      </ReportPageHeader>

      {/* 1. KPI tổng quan của hệ thống */}
      <ReportMetricStrip columns={4}>
        <ReportMetricCell spacious>
          <p className="mb-1 text-xs font-medium text-subtle-light dark:text-subtle-dark">
            Tổng buổi đã dạy ({selectedMonth}/{selectedYear})
          </p>
          <p className="text-2xl font-semibold tracking-tight text-text-light dark:text-text-dark sm:text-3xl">
            {completedCount.toLocaleString('vi-VN')}
          </p>
        </ReportMetricCell>
        <ReportMetricCell spacious>
          <p className="mb-1 text-xs font-medium text-subtle-light dark:text-subtle-dark">TB buổi hoàn thành / PT</p>
          <p className="text-2xl font-semibold tracking-tight text-text-light dark:text-text-dark sm:text-3xl">{avgPerPT}</p>
        </ReportMetricCell>
        <ReportMetricCell spacious>
          <p className="mb-1 text-xs font-medium text-subtle-light dark:text-subtle-dark">Buổi bị huỷ / Vi phạm</p>
          <p className="text-2xl font-semibold tracking-tight text-text-light dark:text-text-dark sm:text-3xl">{cancelledCount}</p>
        </ReportMetricCell>
        <ReportMetricCell spacious>
          <p className="mb-1 text-xs font-medium text-subtle-light dark:text-subtle-dark">Khách sắp hết buổi</p>
          <p className="text-2xl font-semibold tracking-tight text-text-light dark:text-text-dark sm:text-3xl">{atRiskCount}</p>
        </ReportMetricCell>
      </ReportMetricStrip>

      {/* 2 & 3. ĐỒNG BỘ THANH LỌC VÀ BẢNG DỮ LIỆU THÀNH MỘT CARD THỐNG NHẤT */}
      <div className="flex flex-col overflow-hidden rounded-lg border border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark">
        {/* Toolbar Lọc Dữ Liệu */}
        <div className="p-4 border-b border-border-light dark:border-border-dark">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-border-light bg-background-light px-3 dark:border-border-dark dark:bg-background-dark/60">
              <Search size={15} className="text-gray-400 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên khách, SĐT hoặc tên PT..."
                className="w-full bg-transparent text-base text-text-light outline-none placeholder:text-text-muted-light dark:text-text-dark dark:placeholder:text-text-muted-dark md:text-sm"
              />
            </div>

            <select
              value={ptFilter}
              onChange={(e) => setPtFilter(e.target.value)}
              className="h-10 rounded-lg border border-border-light bg-background-light px-3 text-base font-semibold text-text-light outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-background-dark/60 dark:text-text-dark md:text-sm"
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
              className="h-10 rounded-lg border border-border-light bg-background-light px-3 text-base font-semibold text-text-light outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-background-dark/60 dark:text-text-dark md:text-sm"
            >
              <option value="all">Tất cả trạng thái</option>
              {Object.entries(STATUS_MAP).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-background-light dark:bg-surface-dark/80 text-text-light dark:text-text-dark font-semibold tracking-wide text-xs border-b border-border-light dark:border-border-dark">
              <tr>
                <th className="px-4 py-3.5">Thời gian</th>
                <th className="px-4 py-3.5">Hội viên</th>
                <th className="px-4 py-3.5">SĐT</th>
                <th className="px-4 py-3.5">Gói tập</th>
                <th className="px-4 py-3.5">Số buổi</th>
                <th className="px-4 py-3.5">PT hướng dẫn</th>
                <th className="px-4 py-3.5">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    Đang tải danh sách buổi tập...
                  </td>
                </tr>
              )}
              {!loading && filteredSessions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    Không tìm thấy buổi tập nào khớp bộ lọc
                  </td>
                </tr>
              )}
              {!loading && filteredSessions.map((s) => {
                const st = STATUS_MAP[s.status] || STATUS_MAP.completed;
                const custName = s.customer?.name || 'Khách hàng';
                const custPhone = s.customer?.phone || s.customer?.code || 'N/A';
                const ptName = s.pt?.fullName || s.ptName || 'PT Chưa gán';

                return (
                  <tr key={s._id || s.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-700/30 transition-colors">
                    {/* 1. Thời gian */}
                    <td className="whitespace-nowrap px-4 py-3.5 text-text-light dark:text-text-dark">
                      {new Date(s.date).toLocaleString('vi-VN', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    {/* 2. Hội viên */}
                    <td className="px-4 py-3.5 text-text-light dark:text-text-dark">
                      {custName}
                    </td>
                    {/* 3. SĐT */}
                    <td className="px-4 py-3.5 text-text-light dark:text-text-dark">{custPhone}</td>
                    {/* 4. Gói tập */}
                    <td className="px-4 py-3.5 text-text-light dark:text-text-dark">
                      {s.packageName || 'Gói PT'}
                    </td>
                    {/* 5. Số buổi */}
                    <td className="whitespace-nowrap px-4 py-3.5 font-semibold text-text-light dark:text-text-dark">
                      {s.usedSessions ?? 0}/{s.totalSessions ?? 0}
                    </td>
                    {/* 6. PT hướng dẫn */}
                    <td className="px-4 py-3.5 text-text-light dark:text-text-dark">{ptName}</td>
                    {/* 7. Trạng thái */}
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${st.color}`}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer của Card */}
        <div className="border-t border-border-light bg-background-light/60 px-4 py-3 text-xs text-subtle-light dark:border-border-dark dark:bg-background-dark/40 dark:text-subtle-dark">
          Hiển thị {filteredSessions.length} / {rawSessions.length} buổi tập
        </div>
      </div>

      {/* 4. Card TOP PT Xuất Sắc (Dưới cùng của trang) */}
      <div className="rounded-lg border border-border-light bg-surface-light p-5 dark:border-border-dark dark:bg-surface-dark">
        <p className="mb-1 text-base font-semibold text-text-light dark:text-text-dark">Top PT xuất sắc</p>
        <p className="text-[11px] text-gray-400 mb-4">Xếp hạng theo số buổi hoàn thành trong tháng {selectedMonth}/{selectedYear}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {leaderboard.length === 0 && (
            <p className="text-xs text-gray-400 col-span-full text-center py-4">Chưa có dữ liệu xếp hạng</p>
          )}
          {leaderboard.map((pt, idx) => (
            <div key={pt.name || idx} className="flex items-center gap-3 rounded-lg border border-border-light bg-background-light p-4 dark:border-border-dark dark:bg-background-dark/50">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                idx === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-border-light text-subtle-light dark:bg-border-dark dark:text-subtle-dark'
              }`}>
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-text-light dark:text-text-dark">{pt.name}</p>
                <p className="mt-0.5 text-xs font-semibold text-subtle-light dark:text-subtle-dark">{pt.sessions} buổi</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Đối Soát Buổi Tập PT */}
      <PTSessionReportModal
        isOpen={isAuditModalOpen}
        onClose={() => {
          setIsAuditModalOpen(false);
          fetchReportData();
        }}
        userRole={userRole}
      />
    </div>
  );
};

export default PTSessionReportView;
