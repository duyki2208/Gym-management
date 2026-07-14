import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import commissionService from '../services/commissionService';
import { staffService } from '../services/customerService';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';

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
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-5 animate-pulse border border-gray-100 dark:border-gray-700">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3" />
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-36" />
          </div>
        ))}
      </div>
    );
  }
  if (!summary) return null;

  const cards = [
    {
      label: 'Hoa hồng PT',
      amount: summary.pt?.totalAmount || 0,
      sub: `${summary.pt?.totalSessions || 0} buổi • ${summary.pt?.staffCount || 0} PT`,
      status: summary.pt?.periodStatus,
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      label: 'Hoa hồng Sale',
      amount: summary.sale?.totalAmount || 0,
      sub: `${summary.sale?.totalContracts || 0} HĐ • ${summary.sale?.staffCount || 0} Sale`,
      status: summary.sale?.periodStatus,
      gradient: 'from-emerald-500 to-emerald-600',
    },
    {
      label: 'Tổng phải trả',
      amount: summary.grandTotal || 0,
      sub: 'Tổng cộng PT + Sale',
      gradient: 'from-violet-500 to-violet-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {cards.map((c, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{c.label}</p>
            {c.status && <StatusBadge status={c.status} />}
          </div>
          <p className={`text-2xl font-black bg-gradient-to-r ${c.gradient} bg-clip-text text-transparent`}>
            {formatCurrency(c.amount)}
          </p>
          <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
        </div>
      ))}
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
        <div key={s.staff._id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-800 dark:text-gray-200">{s.staff.fullName || s.staff.username}</h3>
              <p className="text-xs text-gray-400">
                {s.totalSessions} buổi dạy • Hoa hồng: {formatCurrency(s.totalAmount)}
              </p>
            </div>
            <span className="text-xl font-black text-blue-600">{formatCurrency(s.totalAmount)}</span>
          </div>

          {/* Details table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500">Ngày</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500">Khách hàng</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-gray-500">Giá buổi</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-gray-500">%</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-gray-500">Hoa hồng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {s.records.map((r) => (
                  <tr key={r._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                      {r.workoutSession?.date
                        ? new Date(r.workoutSession.date).toLocaleDateString('vi-VN')
                        : new Date(r.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">
                      {r.customer?.name || 'N/A'} <span className="text-xs text-gray-400">({r.customer?.code})</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(r.baseAmount)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{r.rate}%</td>
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
        <div key={s.staff._id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-800 dark:text-gray-200">{s.staff.fullName || s.staff.username}</h3>
              <p className="text-xs text-gray-400">
                {s.totalContracts} hợp đồng (Mới: {s.newContracts} | Gia hạn: {s.renewContracts} | Nâng gói: {s.upgradeContracts})
              </p>
            </div>
            <span className="text-xl font-black text-emerald-600">{formatCurrency(s.totalAmount)}</span>
          </div>

          {/* Details table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500">Khách hàng</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500">Gói tập</th>
                  <th className="px-4 py-2.5 text-left text-xs font-bold text-gray-500">Loại</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-gray-500">Giá trị HĐ</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-gray-500">%</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-gray-500">Hoa hồng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {s.records.map((r) => {
                  const ct = contractTypeMap[r.contractType] || { label: r.contractType, color: 'text-gray-600' };
                  return (
                    <tr key={r._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">
                        {r.customer?.name || 'N/A'} <span className="text-xs text-gray-400">({r.customer?.code})</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">
                        {r.customerPackage?.packageName || 'N/A'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-bold ${ct.color}`}>{ct.label}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(r.baseAmount)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{r.rate}%</td>
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
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">Hoa hồng</h1>
          <p className="text-sm text-gray-400">Quản lý hoa hồng PT & Sale theo tháng</p>
        </div>

        {/* Month/Year Selector */}
        <div className="flex items-center gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {months.map(m => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {isManager && (activeTab === 'pt' || activeTab === 'sale') && (
            <button
              onClick={exportToExcel}
              className="text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg font-bold transition-colors flex items-center gap-1 border border-gray-200 dark:border-gray-700"
            >
              Xuất Excel
            </button>
          )}
          
          {isAdminLike && (
            <div className="flex gap-1.5 ml-2">
              <button
                onClick={() => handleCreatePeriod('pt')}
                className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-2 rounded-lg font-bold transition-colors"
              >
                Chốt PT
              </button>
              <button
                onClick={() => handleCreatePeriod('sale')}
                className="text-xs bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-2 rounded-lg font-bold transition-colors"
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
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === t.id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'summary' && isManager && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">
            Tổng hợp tháng {selectedMonth}/{selectedYear}
          </h2>
          {/* PT mini */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
              <h3 className="font-bold text-blue-600 mb-2">Hoa hồng PT</h3>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <p>Tổng buổi dạy: <span className="font-bold text-gray-800 dark:text-gray-200">{summary?.pt?.totalSessions || 0}</span></p>
                <p>Số PT: <span className="font-bold">{summary?.pt?.staffCount || 0}</span></p>
                <p>Tổng hoa hồng: <span className="font-bold text-blue-600">{formatCurrency(summary?.pt?.totalAmount)}</span></p>
                <p>Trạng thái: <StatusBadge status={summary?.pt?.periodStatus || 'draft'} /></p>
                {isAdminLike && summary?.pt?.periodId && summary?.pt?.periodStatus === 'draft' && (
                  <button onClick={() => handleApprove(summary.pt.periodId)}
                    className="mt-2 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-blue-700 transition-colors">
                    Duyệt kỳ PT
                  </button>
                )}
                {isAdminLike && summary?.pt?.periodId && summary?.pt?.periodStatus === 'approved' && (
                  <button onClick={() => handleMarkPaid(summary.pt.periodId)}
                    className="mt-2 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-green-700 transition-colors">
                    Đánh dấu đã trả
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
              <h3 className="font-bold text-emerald-600 mb-2">Hoa hồng Sale</h3>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <p>Tổng hợp đồng: <span className="font-bold text-gray-800 dark:text-gray-200">{summary?.sale?.totalContracts || 0}</span></p>
                <p>Doanh thu từ HĐ: <span className="font-bold">{formatCurrency(summary?.sale?.totalBaseValue)}</span></p>
                <p>Tổng hoa hồng: <span className="font-bold text-emerald-600">{formatCurrency(summary?.sale?.totalAmount)}</span></p>
                <p>Trạng thái: <StatusBadge status={summary?.sale?.periodStatus || 'draft'} /></p>
                {isAdminLike && summary?.sale?.periodId && summary?.sale?.periodStatus === 'draft' && (
                  <button onClick={() => handleApprove(summary.sale.periodId)}
                    className="mt-2 text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-700 transition-colors">
                    Duyệt kỳ Sale
                  </button>
                )}
                {isAdminLike && summary?.sale?.periodId && summary?.sale?.periodStatus === 'approved' && (
                  <button onClick={() => handleMarkPaid(summary.sale.periodId)}
                    className="mt-2 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-green-700 transition-colors">
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
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-800 dark:text-gray-200">Lịch sử kỳ thanh toán</h3>
          </div>
          {loadingPeriods ? (
            <div className="text-center py-10 text-gray-400">Đang tải...</div>
          ) : periods.length === 0 ? (
            <div className="text-center py-10 text-gray-400">Chưa có kỳ thanh toán nào</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500">Kỳ</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500">Loại</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500">Tổng tiền</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500">Số bản ghi</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500">Trạng thái</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500">Người duyệt</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {periods.map(p => (
                    <tr key={p._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-3 font-bold text-gray-800 dark:text-gray-200">
                        T{p.month}/{p.year}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold ${p.type === 'pt' ? 'text-blue-600' : 'text-emerald-600'}`}>
                          {p.type === 'pt' ? 'PT' : 'Sale'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold">{formatCurrency(p.totalAmount)}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{p.totalRecords}</td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {p.approvedBy?.fullName || '-'}
                        {p.approvedAt && <span className="block text-gray-400">{new Date(p.approvedAt).toLocaleDateString('vi-VN')}</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isAdminLike && p.status === 'draft' && (
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
                        {p.status === 'paid' && (
                          <span className="text-xs text-gray-400">
                            {p.paidBy?.fullName && `Trả bởi ${p.paidBy.fullName}`}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Commissions;
