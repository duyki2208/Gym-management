import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import commissionService from '../services/commissionService';
import { staffService } from '../services/customerService';
import { useAuth } from '../context/AuthContext';
import { RotateCcw, Download, Coins, Dumbbell, Wallet } from 'lucide-react';
import * as XLSX from 'xlsx';
import StatCard from '../components/common/StatCard';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
};

const periodStatusMap = {
  draft: { label: 'Nháp', color: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' },
  pending: { label: 'Chờ duyệt', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400' },
  approved: { label: 'Đã duyệt', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-400' },
  paid: { label: 'Đã trả', color: 'bg-green-100 text-green-700', dot: 'bg-green-400' },
};

const contractTypeMap = {
  new: { label: 'Hợp đồng mới', color: 'text-green-600' },
  renew: { label: 'Gia hạn', color: 'text-blue-600' },
  upgrade: { label: 'Nâng gói', color: 'text-purple-600' },
};

const StatusBadge = ({ status }) => {
  const cfg = periodStatusMap[status] || periodStatusMap.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

// ── TỔNG HỢP COMPONENT ──────────────────────────────────────────
const SummaryCards = ({ summary, loading }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <StatCard
        label="Hoa hồng PT"
        value={summary ? formatCurrency(summary.pt?.totalAmount || 0) : "0 ₫"}
        subtitle={summary ? `${summary.pt?.totalSessions || 0} buổi • ${summary.pt?.staffCount || 0} PT` : undefined}
        icon={Dumbbell}
        color="blue"
        loading={loading}
      />
      <StatCard
        label="Hoa hồng Sale"
        value={summary ? formatCurrency(summary.sale?.totalAmount || 0) : "0 ₫"}
        subtitle={summary ? `${summary.sale?.totalContracts || 0} HĐ • ${summary.sale?.staffCount || 0} Sale` : undefined}
        icon={Coins}
        color="emerald"
        loading={loading}
      />
      <StatCard
        label="Tổng hoa hồng phải trả"
        value={summary ? formatCurrency(summary.grandTotal || 0) : "0 ₫"}
        subtitle="Tổng cộng chi phí hoa hồng PT + Sale"
        icon={Wallet}
        color="primary"
        loading={loading}
      />
    </div>
  );
};

// ── BẢNG HOA HỒNG PT ────────────────────────────────────────────
const PTCommissionTable = ({ data, loading }) => {
  if (loading) {
    return <div className="text-center py-10 text-gray-400">Đang tải dữ liệu PT...</div>;
  }
  if (!data?.staffSummary?.length) {
    return <div className="text-center py-10 text-gray-400">Không có dữ liệu hoa hồng PT trong tháng này</div>;
  }

  return (
    <div className="space-y-4">
      {data.staffSummary.map((s) => (
        <div key={s.staff._id} className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-border-light dark:border-border-dark flex items-center justify-between">
            <div>
              <h3 className="font-bold text-text-light dark:text-text-dark">{s.staff.fullName || s.staff.username}</h3>
              <p className="text-xs text-subtle-light dark:text-subtle-dark">
                {s.totalSessions} buổi dạy • Hoa hồng: {formatCurrency(s.totalAmount)}
              </p>
            </div>
            <span className="text-xl font-bold text-blue-600">{formatCurrency(s.totalAmount)}</span>
          </div>

          {/* Details table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-text-light dark:text-text-dark uppercase">NGÀY</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-text-light dark:text-text-dark uppercase">KHÁCH HÀNG</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-text-light dark:text-text-dark uppercase">GIÁ BUỔI</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-text-light dark:text-text-dark uppercase">%</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-text-light dark:text-text-dark uppercase">HOA HỒNG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                {s.records.map((r) => (
                  <tr key={r._id} className="hover:bg-background-light/50 dark:hover:bg-background-dark/50">
                    <td className="px-4 py-2.5 text-subtle-light dark:text-subtle-dark">
                      {r.workoutSession?.date
                        ? new Date(r.workoutSession.date).toLocaleDateString('vi-VN')
                        : new Date(r.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-text-light dark:text-text-dark">
                      {r.customer?.name || 'N/A'} <span className="text-xs text-subtle-light dark:text-subtle-dark">({r.customer?.code})</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-text-light dark:text-text-dark">{formatCurrency(r.baseAmount)}</td>
                    <td className="px-4 py-2.5 text-right text-subtle-light dark:text-subtle-dark">{r.rate}%</td>
                    <td className="px-4 py-2.5 text-right font-bold text-blue-600">{formatCurrency(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── BẢNG HOA HỒNG SALE ──────────────────────────────────────────
const SaleCommissionTable = ({ data, loading }) => {
  if (loading) {
    return <div className="text-center py-10 text-gray-400">Đang tải dữ liệu Sale...</div>;
  }
  if (!data?.staffSummary?.length) {
    return <div className="text-center py-10 text-gray-400">Không có dữ liệu hoa hồng Sale trong tháng này</div>;
  }

  return (
    <div className="space-y-4">
      {data.staffSummary.map((s) => (
        <div key={s.staff._id} className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-border-light dark:border-border-dark flex items-center justify-between">
            <div>
              <h3 className="font-bold text-text-light dark:text-text-dark">{s.staff.fullName || s.staff.username}</h3>
              <p className="text-xs text-subtle-light dark:text-subtle-dark">
                {s.totalContracts} hợp đồng (Mới: {s.newContracts} | Gia hạn: {s.renewContracts} | Nâng gói: {s.upgradeContracts})
              </p>
            </div>
            <span className="text-xl font-bold text-emerald-600">{formatCurrency(s.totalAmount)}</span>
          </div>

          {/* Details table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-text-light dark:text-text-dark uppercase">KHÁCH HÀNG</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-text-light dark:text-text-dark uppercase">GÓI TẬP</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-text-light dark:text-text-dark uppercase">LOẠI</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-text-light dark:text-text-dark uppercase">GIÁ TRỊ HĐ</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-text-light dark:text-text-dark uppercase">%</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-text-light dark:text-text-dark uppercase">HOA HỒNG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                {s.records.map((r) => {
                  const ct = contractTypeMap[r.contractType] || { label: r.contractType, color: 'text-subtle-light dark:text-subtle-dark' };
                  return (
                    <tr key={r._id} className="hover:bg-background-light/50 dark:hover:bg-background-dark/50">
                      <td className="px-4 py-2.5 font-medium text-text-light dark:text-text-dark">
                        {r.customer?.name || 'N/A'} <span className="text-xs text-subtle-light dark:text-subtle-dark">({r.customer?.code})</span>
                      </td>
                      <td className="px-4 py-2.5 text-subtle-light dark:text-subtle-dark">
                        {r.customerPackage?.packageName || 'N/A'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-bold ${ct.color}`}>{ct.label}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-text-light dark:text-text-dark">{formatCurrency(r.baseAmount)}</td>
                      <td className="px-4 py-2.5 text-right text-subtle-light dark:text-subtle-dark">{r.rate}%</td>
                      <td className="px-4 py-2.5 text-right font-bold text-emerald-600">{formatCurrency(r.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── MAIN PAGE ────────────────────────────────────────────────────
const Commissions = () => {
  const { user } = useAuth();
  const isAdminLike = ['admin', 'accountant'].includes(user?.role);
  const isManager = ['admin', 'accountant', 'manager', 'sm', 'pm', 'om'].includes(user?.role);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [activeTab, setActiveTab] = useState('summary'); // summary | pt | sale | periods

  const [summary, setSummary] = useState(null);
  const [ptData, setPtData] = useState(null);
  const [saleData, setSaleData] = useState(null);
  const [periods, setPeriods] = useState([]);

  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingPT, setLoadingPT] = useState(false);
  const [loadingSale, setLoadingSale] = useState(false);
  const [loadingPeriods, setLoadingPeriods] = useState(false);

  // States cho Rollback Modal
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false);
  const [selectedPeriodForRollback, setSelectedPeriodForRollback] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [rollbackReason, setRollbackReason] = useState('');

  const handleOpenRollbackModal = (period) => {
    setSelectedPeriodForRollback(period);
    setConfirmText('');
    setRollbackReason('');
    setRollbackModalOpen(true);
  };

  const handleConfirmRollback = async () => {
    if (!selectedPeriodForRollback) return;
    try {
      await commissionService.reopenPeriod(selectedPeriodForRollback._id, rollbackReason);
      toast.success(`Mở lại kỳ hoa hồng Tháng ${selectedPeriodForRollback.month}/${selectedPeriodForRollback.year} thành công`);
      setRollbackModalOpen(false);
      fetchSummary();
      fetchPeriods();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi mở lại kỳ hoa hồng');
    }
  };

  const fetchSummary = useCallback(async () => {
    if (!isManager) return;
    setLoadingSummary(true);
    try {
      const res = await commissionService.getSummary({ month: selectedMonth, year: selectedYear });
      if (res.success) setSummary(res.data);
    } finally { setLoadingSummary(false); }
  }, [selectedMonth, selectedYear, isManager]);

  const fetchPT = useCallback(async () => {
    setLoadingPT(true);
    try {
      const params = { month: selectedMonth, year: selectedYear };
      // PT chỉ xem của mình
      if (user?.role === 'pt') params.staffId = user._id;
      const res = await commissionService.getPTCommissions(params);
      if (res.success) setPtData(res.data);
    } finally { setLoadingPT(false); }
  }, [selectedMonth, selectedYear, user]);

  const fetchSale = useCallback(async () => {
    setLoadingSale(true);
    try {
      const params = { month: selectedMonth, year: selectedYear };
      // Sale chỉ xem của mình
      if (user?.role === 'sale') params.staffId = user._id;
      const res = await commissionService.getSaleCommissions(params);
      if (res.success) setSaleData(res.data);
    } finally { setLoadingSale(false); }
  }, [selectedMonth, selectedYear, user]);

  const fetchPeriods = useCallback(async () => {
    if (!isManager) return;
    setLoadingPeriods(true);
    try {
      const res = await commissionService.getPeriods({ year: selectedYear });
      if (res.success) setPeriods(res.data);
    } finally { setLoadingPeriods(false); }
  }, [selectedYear, isManager]);

  useEffect(() => {
    fetchSummary();
    if (activeTab === 'pt') fetchPT();
    else if (activeTab === 'sale') fetchSale();
    else if (activeTab === 'periods') fetchPeriods();
  }, [activeTab, fetchSummary, fetchPT, fetchSale, fetchPeriods]);

  // ── Workflow Actions ──
  const handleCreatePeriod = async (type) => {
    try {
      await commissionService.createPeriod({ month: selectedMonth, year: selectedYear, type });
      toast.success(`Tạo kỳ hoa hồng ${type.toUpperCase()} tháng ${selectedMonth}/${selectedYear}`);
      fetchSummary();
      fetchPeriods();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi tạo kỳ hoa hồng');
    }
  };

  const handleApprove = async (periodId) => {
    try {
      await commissionService.approvePeriod(periodId);
      toast.success('Duyệt kỳ hoa hồng thành công');
      fetchSummary();
      fetchPeriods();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi duyệt');
    }
  };

  const handleMarkPaid = async (periodId) => {
    try {
      await commissionService.markPaid(periodId);
      toast.success('Đánh dấu đã thanh toán thành công');
      fetchSummary();
      fetchPeriods();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi thanh toán');
    }
  };

  const exportToExcel = () => {
    try {
      if (activeTab === 'pt') {
        if (!ptData || !ptData.staffSummary?.length) {
          toast.error("Không có dữ liệu PT để xuất");
          return;
        }
        
        // Flatten data
        const excelData = [];
        let index = 1;
        ptData.staffSummary.forEach(staffGroup => {
          const ptNameVal = staffGroup.staff.fullName || staffGroup.staff.username;
          staffGroup.records.forEach(r => {
            excelData.push({
              "STT": index++,
              "PT": ptNameVal,
              "Mã KH": r.customer?.code || '',
              "Tên KH": r.customer?.name || '',
              "SĐT KH": r.customer?.phone || '',
              "Ngày tập": r.workoutSession?.date ? new Date(r.workoutSession.date).toLocaleDateString('vi-VN') : new Date(r.createdAt).toLocaleDateString('vi-VN'),
              "Giá trị buổi tập (VNĐ)": r.baseAmount,
              "% Hoa hồng": r.rate,
              "Hoa hồng (VNĐ)": r.amount,
              "Ghi chú": r.workoutSession?.note || ''
            });
          });
        });

        const totalAmount = excelData.reduce((sum, item) => sum + item["Hoa hồng (VNĐ)"], 0);
        
        const ws = XLSX.utils.json_to_sheet(excelData);
        XLSX.utils.sheet_add_aoa(ws, [
          ['Tổng cộng', '', '', '', '', '', '', '', totalAmount]
        ], { origin: -1 });

        ws['!cols'] = [
          { wch: 6 },  // STT
          { wch: 20 }, // PT
          { wch: 12 }, // Mã KH
          { wch: 22 }, // Tên KH
          { wch: 15 }, // SĐT KH
          { wch: 15 }, // Ngày tập
          { wch: 22 }, // Giá trị buổi tập
          { wch: 12 }, // % Hoa hồng
          { wch: 18 }, // Hoa hồng
          { wch: 25 }, // Ghi chú
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Hoa Hong PT");
        XLSX.writeFile(wb, `HoaHong_PT_T${selectedMonth}_${selectedYear}.xlsx`);
        toast.success("Xuất file Excel hoa hồng PT thành công");
      } else if (activeTab === 'sale') {
        if (!saleData || !saleData.staffSummary?.length) {
          toast.error("Không có dữ liệu Sale để xuất");
          return;
        }

        const excelData = [];
        let index = 1;
        saleData.staffSummary.forEach(staffGroup => {
          const saleNameVal = staffGroup.staff.fullName || staffGroup.staff.username;
          staffGroup.records.forEach(r => {
            excelData.push({
              "STT": index++,
              "Sale": saleNameVal,
              "Mã KH": r.customer?.code || '',
              "Tên KH": r.customer?.name || '',
              "SĐT KH": r.customer?.phone || '',
              "Gói tập": r.customerPackage?.packageName || '',
              "Mã hợp đồng": r.customerPackage?.contractCode || '',
              "Loại hợp đồng": r.contractType === 'new' ? 'Mới' : r.contractType === 'renew' ? 'Gia hạn' : 'Nâng gói',
              "Giá trị hợp đồng (VNĐ)": r.baseAmount,
              "% Hoa hồng": r.rate,
              "Hoa hồng (VNĐ)": r.amount,
              "Ngày bắt đầu": r.customerPackage?.startDate ? new Date(r.customerPackage.startDate).toLocaleDateString('vi-VN') : '',
              "Ngày kết thúc": r.customerPackage?.endDate ? new Date(r.customerPackage.endDate).toLocaleDateString('vi-VN') : '',
            });
          });
        });

        const totalAmount = excelData.reduce((sum, item) => sum + item["Hoa hồng (VNĐ)"], 0);

        const ws = XLSX.utils.json_to_sheet(excelData);
        XLSX.utils.sheet_add_aoa(ws, [
          ['Tổng cộng', '', '', '', '', '', '', '', '', '', totalAmount]
        ], { origin: -1 });

        ws['!cols'] = [
          { wch: 6 },  // STT
          { wch: 20 }, // Sale
          { wch: 12 }, // Mã KH
          { wch: 22 }, // Tên KH
          { wch: 15 }, // SĐT KH
          { wch: 20 }, // Gói tập
          { wch: 15 }, // Mã hợp đồng
          { wch: 15 }, // Loại hợp đồng
          { wch: 22 }, // Giá trị hợp đồng
          { wch: 12 }, // % Hoa hồng
          { wch: 18 }, // Hoa hồng
          { wch: 15 }, // Ngày bắt đầu
          { wch: 15 }, // Ngày kết thúc
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Hoa Hong Sale");
        XLSX.writeFile(wb, `HoaHong_Sale_T${selectedMonth}_${selectedYear}.xlsx`);
        toast.success("Xuất file Excel hoa hồng Sale thành công");
      }
    } catch (error) {
      console.error("Lỗi xuất Excel hoa hồng:", error);
      toast.error("Gặp lỗi khi xuất file Excel");
    }
  };

  // Month/year selector
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const tabs = [
    { id: 'summary', label: 'Tổng hợp', visible: isManager },
    { id: 'pt', label: 'Hoa hồng PT', visible: true },
    { id: 'sale', label: 'Hoa hồng Sale', visible: true },
    { id: 'periods', label: 'Kỳ thanh toán', visible: isManager },
  ].filter(t => t.visible);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* ── Page header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-light dark:bg-surface-dark p-5 rounded-xl border border-border-light dark:border-border-dark shadow-sm mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2.5 text-text-light dark:text-text-dark">
            <Coins size={24} className="text-primary" /> Quản lý hoa hồng
          </h1>
          <p className="text-subtle-light dark:text-subtle-dark text-sm mt-1">
            Bảng tính hoa hồng PT và Sale theo kỳ, đối soát hợp đồng và chốt kỳ thanh toán
          </p>
        </div>

        {/* Month/Year Selector & Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="text-xs font-medium border border-border-light dark:border-border-dark rounded-xl px-3 py-2 bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark outline-none cursor-pointer"
          >
            {months.map((m) => (
              <option key={m} value={m} className="text-gray-900">
                Tháng {m}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-xs font-medium border border-border-light dark:border-border-dark rounded-xl px-3 py-2 bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark outline-none cursor-pointer"
          >
            {years.map((y) => (
              <option key={y} value={y} className="text-gray-900">
                {y}
              </option>
            ))}
          </select>

          {isManager && (activeTab === "pt" || activeTab === "sale") && (
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs md:text-sm font-bold transition-all shadow-sm cursor-pointer"
            >
              <Download size={16} />
              Xuất Excel
            </button>
          )}

          {isAdminLike && (
            <div className="flex gap-1.5 ml-1">
              <button
                onClick={() => handleCreatePeriod("pt")}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl font-semibold transition-colors border border-blue-700/20 shadow-sm cursor-pointer"
              >
                Chốt PT
              </button>
              <button
                onClick={() => handleCreatePeriod("sale")}
                className="text-xs bg-primary hover:bg-primary/90 text-text-light px-3 py-2 rounded-xl font-semibold transition-colors shadow-sm cursor-pointer"
              >
                Chốt Sale
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Summary Cards ── */}
      {isManager && <SummaryCards summary={summary} loading={loadingSummary} />}

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-6 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
              activeTab === t.id
                ? 'bg-surface-light dark:bg-surface-dark text-primary shadow-sm'
                : 'text-subtle-light dark:text-subtle-dark hover:text-text-light dark:hover:text-text-dark'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'summary' && isManager && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-text-light dark:text-text-dark">
            Tổng hợp tháng {selectedMonth}/{selectedYear}
          </h2>
          {/* PT mini */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-5">
              <h3 className="font-bold text-blue-600 mb-2">Hoa hồng PT</h3>
              <div className="space-y-1 text-sm text-subtle-light dark:text-subtle-dark">
                <p>Tổng buổi dạy: <span className="font-bold text-text-light dark:text-text-dark">{summary?.pt?.totalSessions || 0}</span></p>
                <p>Số PT: <span className="font-bold text-text-light dark:text-text-dark">{summary?.pt?.staffCount || 0}</span></p>
                <p>Tổng hoa hồng: <span className="font-bold text-blue-600">{formatCurrency(summary?.pt?.totalAmount)}</span></p>
                <p>Trạng thái: <StatusBadge status={summary?.pt?.periodStatus || 'draft'} /></p>
                {isAdminLike && summary?.pt?.periodId && summary?.pt?.periodStatus === 'draft' && (
                  <button onClick={() => handleApprove(summary.pt.periodId)}
                    className="mt-2 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-blue-700 transition-colors cursor-pointer">
                    Duyệt kỳ PT
                  </button>
                )}
                {isAdminLike && summary?.pt?.periodId && summary?.pt?.periodStatus === 'approved' && (
                  <button onClick={() => handleMarkPaid(summary.pt.periodId)}
                    className="mt-2 text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-700 transition-colors cursor-pointer">
                    Đánh dấu đã trả
                  </button>
                )}
              </div>
            </div>

            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-5">
              <h3 className="font-bold text-emerald-600 mb-2">Hoa hồng Sale</h3>
              <div className="space-y-1 text-sm text-subtle-light dark:text-subtle-dark">
                <p>Tổng hợp đồng: <span className="font-bold text-text-light dark:text-text-dark">{summary?.sale?.totalContracts || 0}</span></p>
                <p>Doanh thu từ HĐ: <span className="font-bold text-text-light dark:text-text-dark">{formatCurrency(summary?.sale?.totalBaseValue)}</span></p>
                <p>Tổng hoa hồng: <span className="font-bold text-emerald-600">{formatCurrency(summary?.sale?.totalAmount)}</span></p>
                <p>Trạng thái: <StatusBadge status={summary?.sale?.periodStatus || 'draft'} /></p>
                {isAdminLike && summary?.sale?.periodId && summary?.sale?.periodStatus === 'draft' && (
                  <button onClick={() => handleApprove(summary.sale.periodId)}
                    className="mt-2 text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-700 transition-colors cursor-pointer">
                    Duyệt kỳ Sale
                  </button>
                )}
                {isAdminLike && summary?.sale?.periodId && summary?.sale?.periodStatus === 'approved' && (
                  <button onClick={() => handleMarkPaid(summary.sale.periodId)}
                    className="mt-2 text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-700 transition-colors cursor-pointer">
                    Đánh dấu đã trả
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pt' && <PTCommissionTable data={ptData} loading={loadingPT} />}
      {activeTab === 'sale' && <SaleCommissionTable data={saleData} loading={loadingSale} />}

      {activeTab === 'periods' && isManager && (
        <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
          <div className="px-5 py-4 border-b border-border-light dark:border-border-dark">
            <h3 className="font-bold text-text-light dark:text-text-dark">Lịch sử kỳ thanh toán</h3>
          </div>
          {loadingPeriods ? (
            <div className="text-center py-10 text-subtle-light dark:text-subtle-dark">Đang tải...</div>
          ) : periods.length === 0 ? (
            <div className="text-center py-10 text-subtle-light dark:text-subtle-dark">Chưa có kỳ thanh toán nào</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-text-light dark:text-text-dark uppercase">KỲ</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-text-light dark:text-text-dark uppercase">LOẠI</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-text-light dark:text-text-dark uppercase">TỔNG TIỀN</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-text-light dark:text-text-dark uppercase">SỐ BẢN GHI</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-text-light dark:text-text-dark uppercase">TRẠNG THÁI</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-text-light dark:text-text-dark uppercase">NGƯỜI DUYỆT</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-text-light dark:text-text-dark uppercase">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark">
                  {periods.map(p => (
                    <tr key={p._id} className="hover:bg-background-light/50 dark:hover:bg-background-dark/50">
                      <td className="px-4 py-3 font-bold text-text-light dark:text-text-dark">
                        T{p.month}/{p.year}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold ${p.type === 'pt' ? 'text-blue-600' : 'text-emerald-600'}`}>
                          {p.type === 'pt' ? 'PT' : 'Sale'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-text-light dark:text-text-dark">{formatCurrency(p.totalAmount)}</td>
                      <td className="px-4 py-3 text-right text-subtle-light dark:text-subtle-dark">{p.totalRecords}</td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3 text-subtle-light dark:text-subtle-dark text-xs">
                        {p.approvedBy?.fullName || '-'}
                        {p.approvedAt && <span className="block text-gray-400">{new Date(p.approvedAt).toLocaleDateString('vi-VN')}</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {isAdminLike && (p.status === 'draft' || p.status === 'pending') && (
                            <button onClick={() => handleApprove(p._id)}
                              className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg font-bold transition-colors">
                              Duyệt
                            </button>
                          )}
                          {isAdminLike && p.status === 'approved' && (
                            <button onClick={() => handleMarkPaid(p._id)}
                              className="text-xs bg-green-50 text-green-600 hover:bg-green-100 px-3 py-1.5 rounded-lg font-bold transition-colors">
                              Đã trả
                            </button>
                          )}
                          {isAdminLike && (p.status === 'approved' || p.status === 'paid') && (
                            <button onClick={() => handleOpenRollbackModal(p)}
                              className="text-xs bg-amber-50 text-amber-600 hover:bg-amber-100 px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1">
                              <RotateCcw size={12} />
                              Mở lại kỳ
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Rollback Confirmation Modal ── */}
      {rollbackModalOpen && selectedPeriodForRollback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-light dark:bg-surface-dark w-full max-w-md rounded-xl shadow-xl border border-border-light dark:border-border-dark p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <div className="p-2.5 bg-amber-500/10 rounded-xl">
                <RotateCcw size={22} />
              </div>
              <div>
                <h3 className="font-bold text-base text-text-light dark:text-text-dark">
                  Mở Lại Kỳ Hoa Hồng (Rollback)
                </h3>
                <p className="text-xs text-subtle-light dark:text-subtle-dark">Chuyển kỳ thanh toán về trạng thái Chờ duyệt</p>
              </div>
            </div>

            <div className="p-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl text-xs space-y-1">
              <p className="text-subtle-light dark:text-subtle-dark">
                Kỳ hoa hồng: <strong className="text-text-light dark:text-text-dark font-bold">Tháng {selectedPeriodForRollback.month}/{selectedPeriodForRollback.year} — {selectedPeriodForRollback.type.toUpperCase()}</strong>
              </p>
              <p className="text-subtle-light dark:text-subtle-dark">
                Tổng tiền: <strong className="text-blue-600 font-bold">{formatCurrency(selectedPeriodForRollback.totalAmount)}</strong>
              </p>
            </div>

            {selectedPeriodForRollback.status === 'paid' ? (
              <div className="p-3.5 bg-red-500/10 rounded-xl border border-red-500/30 text-xs text-red-600 dark:text-red-400 space-y-1">
                <strong className="block font-bold uppercase text-red-700 dark:text-red-300">
                  ⚠️ CẢNH BÁO NGHÊM TRỌNG (RỦI RO TÀI CHÍNH)
                </strong>
                <span>Kỳ này ĐÃ ĐƯỢC THANH TOÁN THỰC TẾ cho nhân viên. Việc mở lại kỳ sẽ hủy bỏ trạng thái Đã trả. Bạn chịu trách nhiệm về tính chính xác của sổ sách tài chính!</span>
              </div>
            ) : (
              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/30 text-xs text-amber-600 dark:text-amber-400">
                Mở lại kỳ để chuyển về trạng thái Chờ duyệt, giúp quản lý bổ sung hoặc điều chỉnh lại danh sách hoa hồng trước khi chốt lại.
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-text-light dark:text-text-dark mb-1">
                Gõ lại tên kỳ để xác nhận: <span className="font-semibold text-amber-600">T{selectedPeriodForRollback.month}/{selectedPeriodForRollback.year}-{selectedPeriodForRollback.type.toUpperCase()}</span>
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={`Ví dụ: T${selectedPeriodForRollback.month}/${selectedPeriodForRollback.year}-${selectedPeriodForRollback.type.toUpperCase()}`}
                className="w-full px-3 py-2 border border-border-light dark:border-border-dark rounded-lg bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark placeholder:text-subtle-light dark:placeholder:text-subtle-dark text-sm outline-none focus:ring-2 focus:ring-amber-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-light dark:text-text-dark mb-1">
                Lý do mở lại kỳ
              </label>
              <textarea
                rows="2"
                value={rollbackReason}
                onChange={(e) => setRollbackReason(e.target.value)}
                placeholder="Nhập lý do điều chỉnh..."
                className="w-full px-3 py-2 border border-border-light dark:border-border-dark rounded-lg bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark placeholder:text-subtle-light dark:placeholder:text-subtle-dark text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setRollbackModalOpen(false)}
                className="px-4 py-2 text-sm font-bold text-subtle-light dark:text-subtle-dark hover:bg-background-light dark:hover:bg-background-dark rounded-lg cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmRollback}
                disabled={confirmText !== `T${selectedPeriodForRollback.month}/${selectedPeriodForRollback.year}-${selectedPeriodForRollback.type.toUpperCase()}`}
                className="px-5 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-40 rounded-lg shadow-sm transition-all cursor-pointer"
              >
                Xác Nhận Mở Lại Kỳ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Commissions;
