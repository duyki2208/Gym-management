import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import reportService from '../services/reportService';
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import {
  Download, Users, DollarSign, TrendingUp, AlertTriangle, ArrowUpRight,
  ArrowDownRight, Package, ShoppingCart, Award, Calendar, Clock, BarChart2, ShieldAlert, Minus,
  Target, CheckCircle2, XCircle, CreditCard, QrCode, Receipt, Medal
} from 'lucide-react';
import * as XLSX from 'xlsx';
import ChurnPrediction from '../components/report/ChurnPrediction';
import PTSessionReportView from '../components/reports/PTSessionReportView';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6', '#ef4444'];

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
};

const renderGrowthBadge = (percent, labelSuffix = "") => {
  if (percent === null || percent === undefined) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-500">
        N/A
      </span>
    );
  }
  if (percent > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
        <ArrowUpRight size={14} /> +{percent}% {labelSuffix}
      </span>
    );
  }
  if (percent < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50">
        <ArrowDownRight size={14} /> {percent}% {labelSuffix}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
      <Minus size={14} /> 0% Không đổi
    </span>
  );
};

const pathToTabMap = {
  'revenue': 'revenue',
  'revenue-basic': 'revenue',
  'revenue-advanced': 'revenue',
  'sales-funnel': 'sales-funnel',
  'leads-funnel': 'sales-funnel',
  'contract-status': 'sales-funnel',
  'customer-analytics': 'customer-analytics',
  'churn': 'customer-analytics',
  'inventory': 'inventory',
  'logs': 'audit',
  'audit': 'audit',
  'pt-sessions': 'pt-sessions',
};

const tabToPathMap = {
  'revenue': 'revenue',
  'sales-funnel': 'sales-funnel',
  'customer-analytics': 'customer-analytics',
  'inventory': 'inventory',
  'audit': 'logs',
  'pt-sessions': 'pt-sessions',
};

const Reports = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const subPath = location.pathname.split('/')[2];
  const activeTab = pathToTabMap[subPath] || (['revenue', 'sales-funnel', 'customer-analytics', 'inventory', 'audit', 'pt-sessions'].includes(subPath) ? subPath : 'revenue');

  const setActiveTab = (tabId) => {
    const targetPath = tabToPathMap[tabId] || tabId;
    navigate(`/reports/${targetPath}`);
  };

  const [summary, setSummary] = useState({ totalRevenue: 0, activeMembers: 0, newMembers: 0, retentionRate: 0, churnRate: 0 });
  const [revenueData, setRevenueData] = useState([]);
  const [packageData, setPackageData] = useState([]);
  const [expiringMembers, setExpiringMembers] = useState([]);
  const [inventoryData, setInventoryData] = useState({ posRevenue: 0, totalStockValue: 0, lowStockProducts: [] });
  const [loading, setLoading] = useState(true);
  const [renderCharts, setRenderCharts] = useState(false);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [refreshing, setRefreshing] = useState(false);

  // States cho Báo cáo Nâng cao
  const [revenueAdvanced, setRevenueAdvanced] = useState(null);
  const [hrSummary, setHrSummary] = useState([]);
  const [customerAnalytics, setCustomerAnalytics] = useState(null);
  // States cho Báo cáo Nâng cao & PT Sessions & Leads & Contracts
  const [notificationsSummary, setNotificationsSummary] = useState(null);
  const [loadingAdvanced, setLoadingAdvanced] = useState(false);
  const [leadReportData, setLeadReportData] = useState(null);
  const [contractBreakdownData, setContractBreakdownData] = useState(null);

  // States cho Audit Log
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");

  // Pagination cho danh sách khách lâu chưa đi tập
  const [inactivePage, setInactivePage] = useState(1);
  const INACTIVE_PAGE_SIZE = 8;

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (!loading) {
      setRenderCharts(false);
      const timer = setTimeout(() => {
        setRenderCharts(true);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeTab, loading]);

  useEffect(() => {
    if (activeTab === "audit") {
      fetchAuditLogs(auditPage, auditSearch);
      fetchNotificationsSummary();
    } else if (activeTab === "revenue" || activeTab === "revenue-advanced" || activeTab === "business") {
      fetchRevenueAdvanced();
      fetchHRSummary();
    } else if (activeTab === "customer-analytics" || activeTab === "churn") {
      fetchCustomerAnalytics();
    } else if (activeTab === "sales-funnel" || activeTab === "leads-funnel" || activeTab === "contract-status") {
      fetchLeadReport();
      fetchContractBreakdown();
    }
  }, [activeTab, auditPage, auditSearch, selectedMonth, selectedYear]);

  const fetchLeadReport = async () => {
    try {
      const res = await reportService.getLeadConversionReport();
      if (res.success) setLeadReportData(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchContractBreakdown = async () => {
    try {
      const res = await reportService.getContractStatusBreakdown();
      if (res.success) setContractBreakdownData(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const params = { month: selectedMonth, year: selectedYear };
      const [summaryRes, revenueRes, packageRes, expiringRes, invRes, revAdvRes, hrRes] = await Promise.all([
        reportService.getSummary(params),
        reportService.getRevenueChart(params),
        reportService.getPackageDistribution(params),
        reportService.getExpiringMembers(params),
        reportService.getInventoryReport(params),
        reportService.getRevenueAdvanced(params),
        reportService.getHRSummary(params)
      ]);

      setSummary(summaryRes);
      setRevenueData(revenueRes);
      setPackageData(packageRes);
      setExpiringMembers(expiringRes);
      setInventoryData(invRes);
      if (revAdvRes && revAdvRes.success) {
        setRevenueAdvanced(revAdvRes.data);
      }
      if (hrRes && hrRes.success) {
        setHrSummary(hrRes.data || []);
      }
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchRevenueAdvanced = async () => {
    setLoadingAdvanced(true);
    try {
      const res = await reportService.getRevenueAdvanced({ month: selectedMonth, year: selectedYear });
      if (res && res.success) {
        setRevenueAdvanced(res.data);
      }
    } catch (err) {
      console.error("Lỗi lấy báo cáo doanh thu nâng cao:", err);
    } finally {
      setLoadingAdvanced(false);
    }
  };

  const fetchHRSummary = async () => {
    setLoadingAdvanced(true);
    try {
      const res = await reportService.getHRSummary({ month: selectedMonth, year: selectedYear });
      if (res && res.success) {
        setHrSummary(res.data || []);
      }
    } catch (err) {
      console.error("Lỗi lấy báo cáo nhân sự:", err);
    } finally {
      setLoadingAdvanced(false);
    }
  };

  const fetchCustomerAnalytics = async () => {
    setLoadingAdvanced(true);
    try {
      const res = await reportService.getCustomerAnalytics();
      if (res && res.success) {
        setCustomerAnalytics(res.data);
      }
    } catch (err) {
      console.error("Lỗi lấy phân tích khách hàng:", err);
    } finally {
      setLoadingAdvanced(false);
    }
  };

  const fetchNotificationsSummary = async () => {
    setLoadingAdvanced(true);
    try {
      const res = await reportService.getNotificationsSummary();
      if (res && res.success) {
        setNotificationsSummary(res.data);
      }
    } catch (err) {
      console.error("Lỗi lấy báo cáo cảnh báo:", err);
    } finally {
      setLoadingAdvanced(false);
    }
  };

  const fetchAuditLogs = async (page = 1, search = "") => {
    setAuditLoading(true);
    try {
      const res = await reportService.getAuditLogs({ page, limit: 10, search });
      if (res && res.success && res.data) {
        setAuditLogs(res.data.logs || []);
        setAuditTotalPages(res.data.totalPages || 1);
        setAuditPage(res.data.currentPage || 1);
      }
    } catch (error) {
      console.error("Lỗi lấy nhật ký hệ thống:", error);
    } finally {
      setAuditLoading(false);
    }
  };

  const exportToExcel = async () => {
    try {
      const details = await reportService.getRevenueDetails({ month: selectedMonth, year: selectedYear });
      const excelData = details.map((item, index) => ({
        "STT": index + 1,
        "Mã GD": item.transactionCode || "-",
        "Mã KH": item.code || item.customerId || `KH-${item._id?.substring(item._id.length - 4)}`,
        "Tên Khách Hàng": item.name,
        "SĐT": item.phone,
        "Nguồn Thu": item.streamCategory || "Gói tập & PT",
        "Chi Tiết Giao Dịch": item.packageType,
        "Hình Thức": item.paymentMethod === 'vietqr' ? 'VietQR' : item.paymentMethod === 'cash' ? 'Tiền mặt' : item.paymentMethod === 'card' ? 'Quẹt thẻ' : (item.paymentMethod || 'Khác'),
        "Thời Gian": new Date(item.startDate).toLocaleDateString("vi-VN"),
        "Thành Tiền (VNĐ)": item.price
      }));

      const totalAmount = excelData.reduce((sum, item) => sum + (item["Thành Tiền (VNĐ)"] || 0), 0);
      const ws = XLSX.utils.json_to_sheet(excelData);

      XLSX.utils.sheet_add_aoa(ws, [
        ['Tổng Cộng', '', '', '', '', '', '', '', '', totalAmount]
      ], { origin: -1 });

      ws['!cols'] = [
        { wch: 5 }, { wch: 14 }, { wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 24 }, { wch: 18 }, { wch: 14 }, { wch: 20 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Doanh Thu Cơ Sở");
      XLSX.writeFile(wb, `BaoCao_DoanhThu_ChiNhanh_T${selectedMonth}_${selectedYear}.xlsx`);
    } catch (error) {
      console.error("Export Excel error", error);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Đang tải báo cáo...</div>;
  }

  const revenueTicks = [0, 50000000, 100000000, 150000000, 200000000];

  return (
    <div className="space-y-6">

      {/* Header controls: Kỳ báo cáo & Nút thao tác */}
      {!["audit", "customer-analytics", "notifications-report", "leads-funnel", "contract-status", "sales-funnel", "pt-sessions"].includes(activeTab) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Doanh thu cơ sở</h1>
            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-0.5">Theo dõi và phân tích hiệu quả kinh doanh của phòng gym</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2">
              
              <select
                id="report_select_month"
                name="selectedMonth"
                aria-label="Chọn tháng báo cáo"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="text-xs font-semibold border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-colors"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>
              <select
                id="report_select_year"
                name="selectedYear"
                aria-label="Chọn năm báo cáo"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="text-xs font-semibold border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-colors"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              {refreshing && <span className="text-xs text-gray-400 animate-pulse ml-1">Đang cập nhật...</span>}
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={exportToExcel}
                className="flex items-center gap-2 bg-primary text-background-dark font-bold px-3.5 py-1.5 rounded-lg hover:bg-primary/90 transition text-xs shadow-xs"
              >
                <Download size={15} /> Xuất Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Doanh thu Tab */}
      {activeTab === 'revenue' && (
        <div className="space-y-6">
          {/* Top 4 KPI Cards: Doanh Thu Tháng Này | Trung Bình Ngày & Dự Phóng | Tiến Độ Mục Tiêu | Công Nợ Cần Thu */}
          {(() => {
            const isCurrentMonth = selectedMonth === (now.getMonth() + 1) && selectedYear === now.getFullYear();
            const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
            const elapsedDays = isCurrentMonth ? Math.min(now.getDate(), daysInMonth) : daysInMonth;
            const avgDailyRevenue = Math.round((summary.totalRevenue || 0) / (elapsedDays || 1));
            const projectedRevenue = isCurrentMonth ? Math.round(avgDailyRevenue * daysInMonth) : null;
            const momGrowth = revenueAdvanced?.compareLastMonth?.growthPercent ?? null;
            const lastMonthValue = revenueAdvanced?.compareLastMonth?.value ?? 0;
            const targetRevenue = revenueAdvanced?.targetRevenue || 500000000;
            const targetProgress = revenueAdvanced?.targetProgress ?? (targetRevenue > 0 ? Math.round(((summary.totalRevenue || 0) / targetRevenue) * 100) : 0);
            const receivables = revenueAdvanced?.receivables || { totalAmount: 0, count: 0 };

            // Tính 3 luồng doanh thu dùng chung
            const pkgVal = Number(summary.revenueStreams?.packageSales || 0) + Number(summary.revenueStreams?.ptSessions || 0);
            const posVal = Number(summary.revenueStreams?.posSales || 0);
            const feeVal = Number(summary.revenueStreams?.serviceFees || 0);
            const totalStreams = pkgVal + posVal + feeVal || (summary.totalRevenue || 1);
            const pkgPct = ((pkgVal / totalStreams) * 100).toFixed(1);
            const posPct = ((posVal / totalStreams) * 100).toFixed(1);
            const feePct = ((feeVal / totalStreams) * 100).toFixed(1);

            // Cơ cấu hợp đồng gói tập (Mới vs Tái ký)
            const contractBreakdown = revenueAdvanced?.contractBreakdown || [];
            const totalContractRev = contractBreakdown.reduce((sum, item) => sum + (item.revenue || 0), 0) || pkgVal || 1;
            const renewItem = contractBreakdown.find(c => c.type === 'renew');
            const renewPct = renewItem ? renewItem.percentage : (totalContractRev > 0 && renewItem ? ((renewItem.revenue / totalContractRev) * 100).toFixed(1) : 0);

            const contractColors = {
              new: '#10b981',      // Xanh ngọc: Gói mới
              renew: '#3b82f6',    // Xanh dương: Tái ký / Gia hạn
              upgrade: '#f59e0b',  // Hổ phách: Nâng cấp gói
              transfer: '#8b5cf6', // Tím: Chuyển nhượng
            };

            return (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                  {/* Card 1: Doanh thu thực tế */}
                  <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 flex items-start justify-between min-w-0 w-full gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tổng thực thu</p>
                      <p className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight break-words">
                        {formatCurrency(summary.totalRevenue || 0)}
                      </p>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {renderGrowthBadge(momGrowth, "so T.trước")}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-2">
                        Doanh thu tháng trước: <span className="font-semibold text-gray-600 dark:text-gray-300">{formatCurrency(lastMonthValue)}</span>
                      </p>
                    </div>
                    <div className="w-10 h-10 sm:w-11 sm:h-11 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-900/30">
                      <DollarSign size={20} />
                    </div>
                  </div>

                  {/* Card 2: Trung bình / ngày & Dự kiến */}
                  <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 flex items-start justify-between min-w-0 w-full gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Trung bình / ngày</p>
                      <p className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight break-words">
                        {formatCurrency(avgDailyRevenue)}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 font-medium">
                        {isCurrentMonth ? `Tính trên ${elapsedDays} ngày qua` : `Tính trên ${daysInMonth} ngày`}
                      </p>
                      {isCurrentMonth && projectedRevenue > 0 && (
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Dự kiến tháng  <span className="font-semibold text-gray-700 dark:text-gray-300">≈ {formatCurrency(projectedRevenue)}</span>
                        </p>
                      )}
                    </div>
                    <div className="w-10 h-10 sm:w-11 sm:h-11 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/30">
                      <BarChart2 size={20} />
                    </div>
                  </div>

                  {/* Card 3: Tiến độ mục tiêu tháng */}
                  <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 flex items-start justify-between min-w-0 w-full gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Tiến độ mục tiêu</p>
                      </div>
                      <p className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight break-words">
                        {targetProgress}%
                      </p>
                      <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 mt-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            targetProgress >= 100 ? 'bg-emerald-500' : targetProgress >= 70 ? 'bg-blue-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(targetProgress, 100)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1.5">
                        Chỉ tiêu: <span className="font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(targetRevenue)}</span>
                      </p>
                    </div>
                    <div className="w-10 h-10 sm:w-11 sm:h-11 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/30">
                      <Target size={20} />
                    </div>
                  </div>

                  {/* Card 4: Công nợ cần thu */}
                  <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 flex items-start justify-between min-w-0 w-full gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Công nợ</p>
                      <p className="text-xl sm:text-2xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight break-words">
                        {formatCurrency(receivables.totalAmount)}
                      </p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50">
                          {receivables.count} HĐ đang cọc / nợ
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1.5">Khoản tiền cần đôn đốc thu hồi</p>
                    </div>
                    <div className="w-10 h-10 sm:w-11 sm:h-11 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-900/30">
                      <Receipt size={20} />
                    </div>
                  </div>
                </div>

                {/* Card Phân Rạch Ròi 3 Dòng Doanh Thu theo Nguồn */}
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Cơ cấu luồng doanh thu cơ sở</h3>
                    </div>
                    <span className="text-xs font-medium text-gray-400 bg-gray-50 dark:bg-gray-700 px-2.5 py-1 rounded-lg">
                      Tháng {selectedMonth}/{selectedYear}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-emerald-50/40 dark:bg-emerald-950/10 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Gói tập
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                          {pkgPct}%
                        </span>
                      </div>
                      <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                        {formatCurrency(pkgVal)}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">Bao gồm thẻ hội viên & hợp đồng PT</p>
                    </div>

                    <div className="p-4 bg-blue-50/40 dark:bg-blue-950/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          Bán lẻ 
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                          {posPct}%
                        </span>
                      </div>
                      <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                        {formatCurrency(posVal)}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">Nước uống, thực phẩm bổ sung, phụ kiện</p>
                    </div>

                    <div className="p-4 bg-purple-50/40 dark:bg-purple-950/10 rounded-xl border border-purple-100 dark:border-purple-900/30">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-purple-500" />
                          Phí dịch vụ 
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                          {feePct}%
                        </span>
                      </div>
                      <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                        {formatCurrency(feeVal)}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">Phí chuyển nhượng, nâng cấp, bảo lưu</p>
                    </div>
                  </div>
                </div>

                {/* Biểu Đồ Doanh Thu Theo Ngày: BIỂU ĐỒ DIỄN BIẾN 3 LUỒNG DOANH THU (Độc lập, đúng quy ước giá trị thực) */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div>
                      <h2 className="text-base md:text-lg font-bold text-gray-800 dark:text-gray-100">Diễn biến doanh thu theo ngày</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Biểu đồ đường & vùng phản ánh giá trị thực tế của từng luồng doanh thu theo từng ngày</p>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4 text-xs font-semibold flex-wrap">
                      <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
                        <span className="w-3 h-3 rounded-sm bg-emerald-500" /> Gói tập ({pkgPct}%)
                      </span>
                      <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
                        <span className="w-3 h-3 rounded-sm bg-blue-500" /> Bán lẻ ({posPct}%)
                      </span>
                      <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
                        <span className="w-3 h-3 rounded-sm bg-purple-500" /> Phí dịch vụ ({feePct}%)
                      </span>
                    </div>
                  </div>
                  <div className="h-[360px] w-full relative">
                    {renderCharts ? (
                      <ResponsiveContainer width="100%" height={340} minWidth={1}>
                        <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorPkgArea" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                            </linearGradient>
                            <linearGradient id="colorPosArea" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                            </linearGradient>
                            <linearGradient id="colorFeeArea" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                          <YAxis 
                            domain={[0, 'auto']}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            tickFormatter={(value) => {
                              if (value >= 1000000) return `${(value / 1000000).toLocaleString('vi-VN')} Tr`;
                              if (value >= 1000) return `${(value / 1000).toLocaleString('vi-VN')} K`;
                              return value;
                            }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip 
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                const currentData = payload[0]?.payload || {};
                                const pkg = Number(currentData.packageSales || 0);
                                const pos = Number(currentData.posSales || 0);
                                const fee = Number(currentData.serviceFees || 0);
                                const total = Number(currentData.revenue ?? (pkg + pos + fee));

                                return (
                                  <div className="bg-white dark:bg-gray-800 p-3.5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg text-xs space-y-2 min-w-[210px]">
                                    <p className="font-bold text-gray-900 dark:text-white border-b pb-1.5 border-gray-100 dark:border-gray-700">
                                      Ngày {label}
                                    </p>
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between gap-3">
                                        <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                          Gói tập & PT
                                        </span>
                                        <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(pkg)}</span>
                                      </div>
                                      <div className="flex items-center justify-between gap-3">
                                        <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                                          Bán lẻ (POS)
                                        </span>
                                        <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(pos)}</span>
                                      </div>
                                      <div className="flex items-center justify-between gap-3">
                                        <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                                          <span className="w-2 h-2 rounded-full bg-purple-500" />
                                          Phí dịch vụ
                                        </span>
                                        <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(fee)}</span>
                                      </div>
                                    </div>
                                    <div className="border-t pt-1.5 border-gray-100 dark:border-gray-700 flex items-center justify-between font-bold text-gray-900 dark:text-white">
                                      <span>Tổng cộng:</span>
                                      <span className="text-blue-600 dark:text-blue-400">{formatCurrency(total)}</span>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="packageSales" 
                            stroke="#10b981" 
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#colorPkgArea)"
                            name="Gói tập & PT" 
                          />
                          <Area 
                            type="monotone" 
                            dataKey="posSales" 
                            stroke="#3b82f6" 
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#colorPosArea)"
                            name="Bán lẻ (POS)" 
                          />
                          <Area 
                            type="monotone" 
                            dataKey="serviceFees" 
                            stroke="#8b5cf6" 
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#colorFeeArea)"
                            name="Phí dịch vụ" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[340px] flex items-center justify-center text-gray-400 text-sm">
                        Đang tải biểu đồ doanh thu...
                      </div>
                    )}
                  </div>
                </div>

                {/* Grid 2 Cột (50/50): TỶ LỆ MỚI VS TÁI KÝ & TỶ TRỌNG THANH TOÁN VIETQR */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Cột 1: Tỷ lệ Hợp đồng Mới vs Tái ký / Gia hạn (Donut Chart Độc Lập) */}
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Cơ cấu hợp đồng gói tập</h3>
                        <span className="text-xs text-gray-400 font-normal">Mới vs Tái ký</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Tỷ trọng doanh số giữa khách hàng mới và hội viên gia hạn / nâng cấp</p>

                      {contractBreakdown && contractBreakdown.length > 0 ? (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="h-[200px] w-full sm:w-1/2 relative flex items-center justify-center">
                            <ResponsiveContainer width="100%" height={200}>
                              <PieChart>
                                <Pie
                                  data={contractBreakdown}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={50}
                                  outerRadius={80}
                                  paddingAngle={4}
                                  dataKey="revenue"
                                >
                                  {contractBreakdown.map((entry, index) => (
                                    <Cell
                                      key={`cell-contract-${index}`}
                                      fill={contractColors[entry.type] || COLORS[index % COLORS.length]}
                                    />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(v) => [formatCurrency(v), "Doanh số"]} />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                              <span className="text-[10px] text-gray-400 font-medium">Doanh số gói</span>
                              <span className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white mt-0.5">
                                {formatCurrency(totalContractRev)}
                              </span>
                            </div>
                          </div>

                          <div className="w-full sm:w-1/2 space-y-2">
                            {contractBreakdown.map((entry, index) => {
                              const color = contractColors[entry.type] || COLORS[index % COLORS.length];
                              return (
                                <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 text-xs">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                    <div>
                                      <span className="font-semibold text-gray-800 dark:text-gray-200 truncate block">{entry.name}</span>
                                      <span className="text-[10px] text-gray-400">{entry.count} hợp đồng</span>
                                    </div>
                                  </div>
                                  <div className="text-right ml-2 shrink-0">
                                    <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(entry.revenue)}</span>
                                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 block">{entry.percentage}%</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
                          Chưa có dữ liệu hợp đồng gói tập
                        </div>
                      )}
                    </div>

                    {/* Thẻ Insight: Tỷ lệ Tái ký / Giữ chân hội viên */}
                    <div className="mt-5 pt-3.5 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-900/30 p-2.5 rounded-lg">
                      <span className="flex items-center gap-1.5 font-medium">
                        <TrendingUp size={15} className="text-blue-500" /> Tỷ lệ khách tái ký / gia hạn
                      </span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {renewPct}% doanh số gói
                      </span>
                    </div>
                  </div>

                  {/* Cột 2: Tỷ trọng hình thức thanh toán (VietQR vs Tiền mặt vs Thẻ) */}
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Phương thức thanh toán</h3>
                        <span className="text-xs text-gray-400 font-normal">Kênh thu</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Tỷ trọng các hình thức thanh toán</p>

                {revenueAdvanced?.paymentMethods && revenueAdvanced.paymentMethods.length > 0 ? (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="h-[200px] w-full sm:w-1/2 relative flex items-center justify-center">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={revenueAdvanced.paymentMethods}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {revenueAdvanced.paymentMethods.map((entry, index) => {
                              const paymentColors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#64748b'];
                              return <Cell key={`cell-pay-${index}`} fill={paymentColors[index % paymentColors.length]} />;
                            })}
                          </Pie>
                          <Tooltip formatter={(v) => formatCurrency(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <QrCode size={20} className="text-gray-400 mb-0.5" />
                        <span className="text-[10px] text-gray-400 font-medium">Kênh thu</span>
                      </div>
                    </div>

                    <div className="w-full sm:w-1/2 space-y-2">
                      {revenueAdvanced.paymentMethods.map((entry, index) => {
                        const paymentColors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#64748b'];
                        return (
                          <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: paymentColors[index % paymentColors.length] }} />
                              <div>
                                <span className="font-semibold text-gray-800 dark:text-gray-200 truncate block">{entry.name}</span>
                                <span className="text-[10px] text-gray-400">{entry.count} giao dịch</span>
                              </div>
                            </div>
                            <div className="text-right ml-2 shrink-0">
                              <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(entry.value)}</span>
                              <span className="text-[10px] font-semibold text-primary block">{entry.percentage}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
                    Chưa có dữ liệu thanh toán
                  </div>
                )}
              </div>

              {/* Thông tin chuyển đổi số thanh toán */}
              <div className="mt-5 pt-3.5 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-900/30 p-2.5 rounded-lg">
                <span className="flex items-center gap-1.5 font-medium">
                  <CreditCard size={15} className="text-emerald-500" /> Thanh toán số hoá (VietQR / Thẻ)
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {(() => {
                    const list = revenueAdvanced?.paymentMethods || [];
                    const digitalTotal = list.filter(p => p.key === 'vietqr' || p.key === 'card' || p.key === 'transfer').reduce((s, x) => s + (x.value || 0), 0);
                    const grandTotal = list.reduce((s, x) => s + (x.value || 0), 0) || 1;
                    return `${((digitalTotal / grandTotal) * 100).toFixed(1)}%`;
                  })()}
                </span>
              </div>
            </div>
          </div>

          {/* Bar Chart: Doanh thu 6 tháng gần nhất */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Doanh thu 6 tháng gần đây</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">So sánh quy mô và tốc độ tăng trưởng doanh thu qua từng tháng</p>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium bg-gray-100 dark:bg-gray-700/60 px-2.5 py-1 rounded-lg">6 Tháng</span>
            </div>
            <div className="h-[240px] w-full relative my-auto pt-2">
              {revenueAdvanced?.trend && revenueAdvanced.trend.length > 0 ? (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={revenueAdvanced.trend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="barTrendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.7} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-gray-700/50" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                    <YAxis 
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(val) => {
                        if (val >= 1000000000) return `${(val / 1000000000).toLocaleString('vi-VN')} Tỷ`;
                        if (val >= 1000000) return `${(val / 1000000).toLocaleString('vi-VN')} Tr`;
                        if (val >= 1000) return `${(val / 1000).toLocaleString('vi-VN')} K`;
                        return val;
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      formatter={(v) => [formatCurrency(v), "Doanh thu"]}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                      labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                    />
                    <Bar 
                      dataKey="revenue" 
                      fill="url(#barTrendGradient)" 
                      radius={[6, 6, 0, 0]} 
                      maxBarSize={46}
                      name="Doanh thu" 
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[230px] flex items-center justify-center text-gray-400 text-sm">
                  Chưa có dữ liệu xu hướng
                </div>
              )}
            </div>
          </div>

          {/* Bảng Hiệu quả kinh doanh & Hoa hồng nhân sự (LEADERBOARD) */}
          {hrSummary.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base md:text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                     Doanh số & hoa hồng nhân sự
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Theo dõi doanh số đem về, hoa hồng và mức lương thực nhận của từng nhân viên</p>
                </div>
                <span className="text-xs text-gray-400 font-normal self-start sm:self-auto">Tháng {selectedMonth}/{selectedYear}</span>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/80 text-xs font-semibold text-gray-500 dark:text-gray-400">
                        <th className="p-4">Nhân viên</th>
                        <th className="p-4">Chức vụ</th>
                        <th className="p-4 text-right font-bold text-emerald-600 dark:text-emerald-400">Doanh số đem về</th>
                        <th className="p-4 text-right">Lương cơ bản</th>
                        <th className="p-4 text-right">Hoa hồng</th>
                        <th className="p-4 text-center">Tiến độ KPI</th>
                        <th className="p-4 text-right font-bold text-gray-900 dark:text-white">Thực nhận</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                      {hrSummary.map((staff) => (
                        <tr key={staff._id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors">
                          <td className="p-4 font-semibold text-gray-900 dark:text-white">{staff.fullName}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                              ['pt', 'pm'].includes(staff.role) ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                            }`}>
                              {staff.role}
                            </span>
                          </td>
                          <td className="p-4 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(staff.revenueGenerated || 0)}
                          </td>
                          <td className="p-4 text-right text-gray-600 dark:text-gray-300">{formatCurrency(staff.basicSalary)}</td>
                          <td className="p-4 text-right text-indigo-600 dark:text-indigo-400 font-medium">{formatCurrency(staff.commission)}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-2 justify-center max-w-[140px] mx-auto">
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${staff.kpiProgress >= 100 ? 'bg-emerald-500' : staff.kpiProgress >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                  style={{ width: `${Math.min(staff.kpiProgress, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 shrink-0">{staff.kpiProgress}%</span>
                            </div>
                          </td>
                          <td className="p-4 text-right font-extrabold text-blue-600 dark:text-blue-400 text-base">{formatCurrency(staff.totalSalary)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
              </>
            );
          })()}
        </div>
      )}

      {/* Khách hàng Tab */}
      {activeTab === 'customer-analytics' && (
        <div className="space-y-6">
          {loadingAdvanced ? (
            <div className="text-center py-10 text-gray-500">Đang tải phân tích khách hàng...</div>
          ) : customerAnalytics ? (
            <>
              {/* KPI 3 Cards: ARPU | PT Riêng | Solo */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Card 1: Chi tiêu trung bình */}
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 flex items-start justify-between min-w-0 w-full gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Chi tiêu trung bình / KH</p>
                    <p className="text-2xl md:text-3xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight break-words">
                      {formatCurrency(customerAnalytics.arpu)}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">Doanh thu trung bình trọn đời mỗi hội viên</p>
                  </div>
                  <div className="w-11 h-11 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/30">
                    <DollarSign size={22} />
                  </div>
                </div>

                {/* Card 2: Hội viên có PT riêng */}
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 flex items-start justify-between min-w-0 w-full gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Hội viên có PT riêng</p>
                    <p className="text-2xl md:text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 tracking-tight break-words">
                      {customerAnalytics.trainerRatio?.withTrainer || 0} <span className="text-sm font-semibold text-gray-400">người</span>
                    </p>
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50">
                        {customerAnalytics.trainerRatio ? Math.round((customerAnalytics.trainerRatio.withTrainer / (customerAnalytics.trainerRatio.withTrainer + customerAnalytics.trainerRatio.solo || 1)) * 100) : 0}% tổng hội viên
                      </span>
                    </div>
                  </div>
                  <div className="w-11 h-11 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/30">
                    <Award size={22} />
                  </div>
                </div>

                {/* Card 3: Hội viên tự tập (Solo) */}
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 flex items-start justify-between min-w-0 w-full gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Hội viên tự tập (Solo)</p>
                    <p className="text-2xl md:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight break-words">
                      {customerAnalytics.trainerRatio?.solo || 0} <span className="text-sm font-semibold text-gray-400">người</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-2">Hội viên tập luyện tự do tại phòng</p>
                  </div>
                  <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-900/30">
                    <Users size={22} />
                  </div>
                </div>
              </div>

              {/* Hàng 2 Cards: Tỷ lệ giữ chân & Tỷ lệ rời bỏ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 flex items-start justify-between min-w-0 w-full gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tỷ lệ giữ chân hội viên</p>
                    <p className="text-2xl md:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
                      {summary.retentionRate}%
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
                        <ArrowUpRight size={14} /> Tích cực
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Dựa trên tỷ lệ khách hàng còn Active / Tổng số</p>
                  </div>
                  <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-900/30">
                    <TrendingUp size={22} />
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 flex items-start justify-between min-w-0 w-full gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tỷ lệ rời bỏ (Churn rate)</p>
                    <p className="text-2xl md:text-3xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight">
                      {summary.churnRate}%
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50">
                        <ArrowDownRight size={14} /> Cần chú ý
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Phần trăm khách hàng hết hạn chưa gia hạn</p>
                  </div>
                  <div className="w-11 h-11 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-900/30">
                    <AlertTriangle size={22} />
                  </div>
                </div>
              </div>

              {/* Bảng thống kê PT phụ trách */}
              {customerAnalytics.trainerStats && customerAnalytics.trainerStats.length > 0 && (
                <div className="space-y-4 pt-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base md:text-lg font-bold text-gray-800 dark:text-gray-100">Thống kê khách hàng theo PT phụ trách</h3>
                    <span className="text-xs text-gray-400 font-normal">Phân bổ nhân sự</span>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/80 text-xs font-semibold text-gray-500 dark:text-gray-400">
                            <th className="p-4">Huấn luyện viên (PT)</th>
                            <th className="p-4">Chức vụ</th>
                            <th className="p-4 text-right">Số hội viên</th>
                            <th className="p-4 text-center">Tỷ trọng phụ trách</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                          {customerAnalytics.trainerStats.map((pt) => {
                            const total = customerAnalytics.trainerRatio?.withTrainer || 1;
                            const pct = Math.round((pt.count / total) * 100);
                            return (
                              <tr key={String(pt._id)} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors">
                                <td className="p-4 font-semibold text-gray-900 dark:text-white">{pt.name}</td>
                                <td className="p-4">
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                    ['pt', 'pm'].includes(pt.role) ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                                  }`}>
                                    {pt.role}
                                  </span>
                                </td>
                                <td className="p-4 text-right font-extrabold text-indigo-600 dark:text-indigo-400">{pt.count} KH</td>
                                <td className="p-4 w-56">
                                  <div className="flex items-center gap-2 justify-center max-w-[180px] mx-auto">
                                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                      <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-8 shrink-0">{pct}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Hàng biểu đồ 1: Giới tính & Độ tuổi */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Donut Chart Giới tính */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Cơ cấu giới tính hội viên</h3>
                    <span className="text-xs text-gray-400 font-normal">Tỷ trọng</span>
                  </div>
                  <div className="h-[250px] flex items-center justify-center relative my-auto">
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={customerAnalytics.gender}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {customerAnalytics.gender.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(v, name) => [`${v} KH`, name]} 
                          contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-6">
                      <span className="text-[11px] text-gray-400 font-medium">Tổng</span>
                      <span className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white mt-0.5">
                        {customerAnalytics.gender.reduce((a, b) => a + (b.value || 0), 0)} KH
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bar Chart Độ tuổi */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Phân bổ độ tuổi hội viên</h3>
                    <span className="text-xs text-gray-400 font-normal">Nhóm tuổi</span>
                  </div>
                  <div className="h-[250px] relative my-auto">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={customerAnalytics.age} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <Tooltip 
                          formatter={(v) => [`${v} hội viên`, "Số lượng"]}
                          contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} name="Số lượng" barSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Phân bổ gói tập - full width, layout Side-by-side lớn */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Gói tập đang hoạt động</h3>
                  <span className="text-xs text-gray-400 font-normal">Mức độ phổ biến</span>
                </div>
                <div className="flex flex-col lg:flex-row items-center gap-6">
                  <div className="w-full lg:w-1/3 space-y-2.5">
                    {customerAnalytics.packagePopularity.map((entry, index) => {
                      const total = customerAnalytics.packagePopularity.reduce((a, b) => a + (b.value || 0), 0) || 1;
                      const pct = ((entry.value / total) * 100).toFixed(1);
                      return (
                        <div key={index} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[(index + 2) % COLORS.length] }} />
                            <span className="font-medium text-gray-700 dark:text-gray-300 truncate">{entry.name}</span>
                          </div>
                          <div className="text-right ml-2 shrink-0">
                            <span className="font-bold text-gray-900 dark:text-white block">{entry.value} KH</span>
                            <span className="text-[10px] text-gray-400 font-medium">{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="w-full lg:w-2/3 h-[280px] relative flex items-center justify-center">
                    {renderCharts ? (
                      <ResponsiveContainer width="100%" height={280} minWidth={1}>
                        <PieChart>
                          <Pie
                            data={customerAnalytics.packagePopularity}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={110}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {customerAnalytics.packagePopularity.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(v, name) => [`${v} khách hàng`, name]} 
                            contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">Đang tải biểu đồ...</div>
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[11px] text-gray-400 font-medium">Tổng</span>
                      <span className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white mt-0.5">
                        {customerAnalytics.packagePopularity.reduce((a, b) => a + (b.value || 0), 0)} KH
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Kênh tiếp cận & Tần suất tập luyện */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Kênh tiếp cận</h3>
                    <span className="text-xs text-gray-400 font-normal">Nguồn hội viên</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {customerAnalytics.sources.map((entry, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-gray-100 dark:border-gray-800 text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[(index + 4) % COLORS.length] }} />
                          <span className="text-gray-700 dark:text-gray-300 truncate">{entry.name}</span>
                        </div>
                        <span className="font-bold text-gray-900 dark:text-white ml-2 shrink-0">{entry.value} KH</span>
                      </div>
                    ))}
                  </div>
                  <div className="h-[180px] relative">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={customerAnalytics.sources} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                          {customerAnalytics.sources.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(v, name) => [`${v} KH`, name]} 
                          contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Phân khúc tần suất tập luyện</h3>
                      <span className="text-xs text-gray-400 font-normal">30 ngày qua</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">Gom nhóm hội viên dựa trên số ngày đi tập (check-in)</p>
                  </div>
                  <div className="h-[210px] relative">
                    <ResponsiveContainer width="100%" height={210}>
                      <BarChart data={customerAnalytics.intensity} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <Tooltip 
                          formatter={(v) => [`${v} hội viên`, "Số lượng"]}
                          contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} name="Số hội viên" barSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Inactive list - có phân trang */}
              {(() => {
                const totalPages = Math.ceil((customerAnalytics.inactive?.length || 0) / INACTIVE_PAGE_SIZE);
                const paginatedInactive = (customerAnalytics.inactive || []).slice(
                  (inactivePage - 1) * INACTIVE_PAGE_SIZE,
                  inactivePage * INACTIVE_PAGE_SIZE
                );
                return (
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base md:text-lg font-bold text-gray-800 dark:text-gray-100">Khách hàng lâu chưa đi tập</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Còn hạn gói tập nhưng không có check-in trong 30 ngày qua</p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/50">
                        {customerAnalytics.inactive?.length || 0} hội viên
                      </span>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700/60">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/80 text-xs font-semibold text-gray-500 dark:text-gray-400">
                            <th className="p-3.5">Khách hàng</th>
                            <th className="p-3.5">Mã KH</th>
                            <th className="p-3.5">Số điện thoại</th>
                            <th className="p-3.5">Gói tập</th>
                            <th className="p-3.5 text-right">Ngày hết hạn</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                          {paginatedInactive.length > 0 ? (
                            paginatedInactive.map((cust) => (
                              <tr key={cust._id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors">
                                <td className="p-3.5 font-semibold text-gray-900 dark:text-white">{cust.name}</td>
                                <td className="p-3.5 text-gray-500 dark:text-gray-400 font-mono text-xs">{cust.code}</td>
                                <td className="p-3.5 text-gray-600 dark:text-gray-300">{cust.phone}</td>
                                <td className="p-3.5">
                                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 rounded text-xs font-semibold">
                                    {cust.packageType}
                                  </span>
                                </td>
                                <td className="p-3.5 text-right text-rose-600 dark:text-rose-400 font-bold">
                                  {new Date(cust.endDate).toLocaleDateString("vi-VN")}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="5" className="p-6 text-center text-gray-400 text-xs">
                                Tuyệt vời! Không có khách hàng nào bỏ tập lâu ngày.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700/60">
                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                          Trang {inactivePage} / {totalPages}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setInactivePage(p => Math.max(p - 1, 1))}
                            disabled={inactivePage === 1}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Trang trước
                          </button>
                          <button
                            onClick={() => setInactivePage(p => Math.min(p + 1, totalPages))}
                            disabled={inactivePage >= totalPages}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Trang sau
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Hội viên sắp hết hạn */}
              {expiringMembers.length > 0 && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base md:text-lg font-bold text-gray-800 dark:text-gray-100">Hội viên sắp hết hạn (14 ngày tới)</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Danh sách cần liên hệ chăm sóc và gia hạn</p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50">
                      {expiringMembers.length} hội viên
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700/60">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/80 text-xs font-semibold text-gray-500 dark:text-gray-400">
                          <th className="p-3.5">Khách hàng</th>
                          <th className="p-3.5">Số điện thoại</th>
                          <th className="p-3.5">Gói tập</th>
                          <th className="p-3.5">Ngày hết hạn</th>
                          <th className="p-3.5 text-center">Buổi còn</th>
                          <th className="p-3.5 text-right">Liên hệ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 text-sm">
                        {expiringMembers.map((member) => (
                          <tr key={member._id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors">
                            <td className="p-3.5 font-semibold text-gray-900 dark:text-white">{member.name}</td>
                            <td className="p-3.5 text-gray-600 dark:text-gray-300">{member.phone}</td>
                            <td className="p-3.5">
                              <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-md text-xs font-semibold">
                                {member.packageType}
                              </span>
                            </td>
                            <td className="p-3.5 text-rose-600 dark:text-rose-400 font-bold">{new Date(member.endDate).toLocaleDateString("vi-VN")}</td>
                            <td className="p-3.5 text-center font-semibold text-gray-800 dark:text-gray-200">{member.remainingSessions}</td>
                            <td className="p-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <a 
                                  href={`tel:${member.phone}`} 
                                  className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-lg text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                                >
                                  📞 Gọi
                                </a>
                                <a 
                                  href={`https://zalo.me/${member.phone}`} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 rounded-lg text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                >
                                  💬 Zalo
                                </a>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-10 text-gray-400">Không có dữ liệu khách hàng</div>
          )}
        </div>
      )}

      {/* Cảnh báo & Vận hành Tab */}
      {activeTab === 'notifications-report' && (
        <div className="space-y-6">
          {loadingAdvanced ? (
            <div className="text-center py-10 text-gray-500">Đang tải cảnh báo vận hành...</div>
          ) : notificationsSummary ? (
            <>
              {/* Lưới các cảnh báo chính */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* 1. Cảnh báo tồn kho */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex flex-col overflow-hidden h-[380px]">
                  <div className="p-4 bg-rose-50/60 dark:bg-rose-950/30 border-b border-rose-100 dark:border-rose-900/40 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-sm">
                      <Package size={18} />
                      <span>Sản phẩm sắp hết hàng</span>
                    </div>
                    <span className="px-2.5 py-0.5 text-xs font-extrabold bg-rose-600 text-white rounded-full">
                      {notificationsSummary.lowStockProductsCount}
                    </span>
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto custom-scrollbar divide-y divide-gray-100 dark:divide-gray-700/60 text-xs">
                    {notificationsSummary.lowStockProducts.length > 0 ? (
                      notificationsSummary.lowStockProducts.map(p => (
                        <div key={p._id} className="py-3 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{p.name}</p>
                            <p className="text-gray-400 mt-0.5">Ngưỡng cảnh báo: {p.minStockAlert || 5} SP</p>
                          </div>
                          <span className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/50 rounded-md font-bold text-[11px]">
                            Còn {p.stockQuantity} SP
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-12 text-gray-400">Kho hàng an toàn, không có mặt hàng nào sắp hết</p>
                    )}
                  </div>
                </div>

                {/* 2. Hội viên sắp hết hạn */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex flex-col overflow-hidden h-[380px]">
                  <div className="p-4 bg-amber-50/60 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900/40 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-sm">
                      <Users size={18} />
                      <span>Hội viên sắp hết hạn (14 ngày)</span>
                    </div>
                    <span className="px-2.5 py-0.5 text-xs font-extrabold bg-amber-600 text-white rounded-full">
                      {notificationsSummary.expiringCustomersCount}
                    </span>
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto custom-scrollbar divide-y divide-gray-100 dark:divide-gray-700/60 text-xs">
                    {notificationsSummary.expiringCustomers.length > 0 ? (
                      notificationsSummary.expiringCustomers.map(c => (
                        <div key={c._id} className="py-3 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{c.name}</p>
                            <p className="text-gray-400 mt-0.5">{c.phone} • {c.packageType}</p>
                          </div>
                          <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 rounded-md font-bold text-[11px]">
                            Hạn: {new Date(c.endDate).toLocaleDateString("vi-VN")}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-12 text-gray-400">Không có hội viên nào sắp hết hạn gói tập</p>
                    )}
                  </div>
                </div>

                {/* 3. Công việc ca trực hôm nay chưa làm */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex flex-col overflow-hidden h-[380px]">
                  <div className="p-4 bg-blue-50/60 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/40 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-sm">
                      <Calendar size={18} />
                      <span>Ca trực chưa hoàn thành hôm nay</span>
                    </div>
                    <span className="px-2.5 py-0.5 text-xs font-extrabold bg-blue-600 text-white rounded-full">
                      {notificationsSummary.pendingTasksCount}
                    </span>
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto custom-scrollbar divide-y divide-gray-100 dark:divide-gray-700/60 text-xs">
                    {notificationsSummary.pendingTasks.length > 0 ? (
                      notificationsSummary.pendingTasks.map(t => (
                        <div key={t._id} className="py-3 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{t.title}</p>
                            <p className="text-gray-400 mt-0.5">Nhân viên: {t.staffName}</p>
                          </div>
                          <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 rounded-md font-bold text-[11px]">
                            Ca: {t.timeSlot}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-12 text-gray-400">Đã hoàn thành toàn bộ ca trực hôm nay</p>
                    )}
                  </div>
                </div>

                {/* 4. Kỳ lương hoa hồng chờ duyệt */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex flex-col overflow-hidden h-[380px] lg:col-span-1">
                  <div className="p-4 bg-purple-50/60 dark:bg-purple-950/30 border-b border-purple-100 dark:border-purple-900/40 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400 font-bold text-sm">
                      <DollarSign size={18} />
                      <span>Hoa hồng chờ duyệt</span>
                    </div>
                    <span className="px-2.5 py-0.5 text-xs font-extrabold bg-purple-600 text-white rounded-full">
                      {notificationsSummary.pendingCommissionsCount}
                    </span>
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto custom-scrollbar divide-y divide-gray-100 dark:divide-gray-700/60 text-xs">
                    {notificationsSummary.pendingCommissions.length > 0 ? (
                      notificationsSummary.pendingCommissions.map((c, idx) => (
                        <div key={idx} className="py-3 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">Chu kỳ hoa hồng T{c.month}/{c.year}</p>
                            <p className="text-gray-400 mt-0.5">Loại: {c.type === 'pt' ? 'Huấn luyện viên (PT)' : 'Nhân viên Sale'}</p>
                          </div>
                          <span className="px-2.5 py-1 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200/50 rounded-md font-bold text-[11px]">
                            {formatCurrency(c.totalAmount)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-12 text-gray-400">Không có kỳ lương hoa hồng nào chờ duyệt</p>
                    )}
                  </div>
                </div>

                {/* 5. Cảnh báo KPI yếu */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex flex-col overflow-hidden h-[380px] md:col-span-2 lg:col-span-2">
                  <div className="p-4 bg-yellow-50/60 dark:bg-yellow-950/30 border-b border-yellow-100 dark:border-yellow-900/40 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-400 font-bold text-sm">
                      <AlertTriangle size={18} />
                      <span>Cảnh báo nhân viên KPI yếu (&lt;50% cuối tháng)</span>
                    </div>
                    <span className="px-2.5 py-0.5 text-xs font-extrabold bg-yellow-600 text-white rounded-full">
                      {notificationsSummary.lowKPIStaffCount}
                    </span>
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto custom-scrollbar divide-y divide-gray-100 dark:divide-gray-700/60 text-xs">
                    {notificationsSummary.lowKPIStaff.length > 0 ? (
                      notificationsSummary.lowKPIStaff.map(s => (
                        <div key={s._id} className="py-3 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{s.fullName} ({s.role.toUpperCase()})</p>
                            <p className="text-gray-400 mt-0.5">
                              Thực tế: {s.role === 'pt' ? `${s.actual} buổi` : formatCurrency(s.actual)} / Mục tiêu: {s.role === 'pt' ? `${s.target} buổi` : formatCurrency(s.target)}
                            </p>
                          </div>
                          <span className="px-2.5 py-1 bg-yellow-50 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400 border border-yellow-200/50 rounded-md font-bold text-xs shrink-0 ml-4">
                            Đạt {s.percentage}%
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-12 text-gray-400">Tất cả nhân viên đang duy trì tiến độ KPI tốt</p>
                    )}
                  </div>
                </div>

              </div>
            </>
          ) : (
            <div className="text-center py-10 text-gray-400">Không có dữ liệu cảnh báo vận hành</div>
          )}
        </div>
      )}

      {/* Kho Hàng Tab */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Card 1: Doanh thu POS */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 flex items-start justify-between min-w-0 w-full gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Doanh thu bán lẻ </p>
                <p className="text-2xl md:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight break-words">
                  {formatCurrency(inventoryData.posRevenue || 0)}
                </p>
                <p className="text-xs text-gray-400 mt-2">Tổng doanh số bán lẻ trực tiếp tại quầy</p>
              </div>
              <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-900/30">
                <ShoppingCart size={22} />
              </div>
            </div>

            {/* Card 2: Tổng giá trị tồn kho */}
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 flex items-start justify-between min-w-0 w-full gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tổng giá trị tồn kho</p>
                <p className="text-2xl md:text-3xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight break-words">
                  {formatCurrency(inventoryData.totalStockValue || 0)}
                </p>
                <p className="text-xs text-gray-400 mt-2">Giá trị ước tính toàn bộ sản phẩm hiện có trong kho</p>
              </div>
              <div className="w-11 h-11 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/30">
                <Package size={22} />
              </div>
            </div>
          </div>
          
          {/* Bảng sản phẩm sắp hết hàng */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base md:text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <AlertTriangle className="text-amber-500" size={20} />
                  Sản phẩm sắp hết hàng (Tồn kho &le; 10)
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Danh sách mặt hàng cần chuẩn bị nhập kho bổ sung</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50">
                {inventoryData.lowStockProducts.length} sản phẩm
              </span>
            </div>
            
            <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700/60">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/80 text-xs font-semibold text-gray-500 dark:text-gray-400">
                    <th className="p-3.5">Mã SP</th>
                    <th className="p-3.5">Tên sản phẩm</th>
                    <th className="p-3.5">Danh mục</th>
                    <th className="p-3.5 text-right">Giá bán</th>
                    <th className="p-3.5 text-center">Tồn kho</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {inventoryData.lowStockProducts.length > 0 ? (
                    inventoryData.lowStockProducts.map((product) => (
                      <tr key={product._id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="p-3.5 font-mono text-xs text-gray-500 dark:text-gray-400">{product.productCode}</td>
                        <td className="p-3.5 text-gray-900 dark:text-white font-semibold">{product.name}</td>
                        <td className="p-3.5 text-gray-600 dark:text-gray-300">
                          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 rounded text-xs font-medium">
                            {product.category}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(product.sellPrice)}</td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                            product.stockQuantity === 0 
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/50' 
                              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50'
                          }`}>
                            {product.stockQuantity} SP
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-gray-400 text-xs">
                        Không có sản phẩm nào sắp hết hàng.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Rời bỏ Tab */}
      {activeTab === 'churn' && (
        <ChurnPrediction />
      )}

      {/* Nhật ký Tab */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm">
            <div className="relative flex-1 max-w-md w-full">
              <input
                id="audit_search_input"
                name="auditSearch"
                type="text"
                aria-label="Tìm kiếm nhật ký theo nhân viên hoặc hành động"
                className="w-full pl-4 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-xs sm:text-sm bg-gray-50/50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-colors"
                placeholder="Tìm kiếm theo nhân viên, hành động..."
                value={auditSearch}
                onChange={(e) => {
                  setAuditSearch(e.target.value);
                  setAuditPage(1);
                }}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-medium">
              <span>Trang {auditPage} / {auditTotalPages}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 overflow-hidden shadow-sm">
            {auditLoading ? (
              <div className="p-8 text-center text-gray-400 text-sm">Đang tải nhật ký hệ thống...</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/80 text-xs font-semibold text-gray-500 dark:text-gray-400">
                        <th className="p-4 w-[15%]">Thời gian</th>
                        <th className="p-4 w-[18%]">Nhân viên</th>
                        <th className="p-4 w-[32%]">Hành động</th>
                        <th className="p-4 w-[12%] text-center">Thao tác</th>
                        <th className="p-4 w-[23%]">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                      {auditLogs.length > 0 ? (
                        auditLogs.map((log) => (
                          <tr key={log._id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors">
                            <td className="p-4 text-gray-500 dark:text-gray-400 font-mono text-[11px]">
                              {new Date(log.createdAt).toLocaleString("vi-VN")}
                            </td>
                            <td className="p-4">
                              <span className="font-bold text-gray-900 dark:text-white">{log.username}</span>
                              {log.user?.role && (
                                <span className="ml-1.5 px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                  {log.user.role}
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-gray-800 dark:text-gray-200 font-medium">
                              {log.action}
                            </td>
                            <td className="p-4 text-center">
                              <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md border ${
                                log.method === "POST" ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/50" :
                                log.method === "PUT" ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200/50" :
                                "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200/50"
                              }`}>
                                {log.method === "POST" ? "Thêm" : log.method === "PUT" ? "Sửa" : "Xóa"}
                              </span>
                            </td>
                            <td className="p-4 text-xs font-mono text-gray-500 max-w-xs truncate">
                              <details className="cursor-pointer">
                                <summary className="text-primary hover:underline font-sans font-bold">Xem chi tiết</summary>
                                <pre className="mt-2 p-2 bg-gray-50 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded text-[10px] overflow-x-auto whitespace-pre-wrap max-h-32">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </details>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="p-8 text-center text-gray-400 text-xs">
                            Không có nhật ký vận hành nào phù hợp.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 border-t border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-900/40 flex justify-between items-center">
                  <div className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                    Trang {auditPage} / {auditTotalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAuditPage((prev) => Math.max(prev - 1, 1))}
                      disabled={auditPage === 1 || auditLoading}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Trang trước
                    </button>
                    <button
                      onClick={() => setAuditPage((prev) => Math.min(prev + 1, auditTotalPages))}
                      disabled={auditPage >= auditTotalPages || auditLoading}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Trang sau
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 2. Chuyển đổi & Hợp đồng (Gộp Lead & Chuyển đổi + Tỷ lệ Hợp đồng) */}
      {(activeTab === 'sales-funnel' || activeTab === 'leads-funnel' || activeTab === 'contract-status') && (
        <div className="space-y-8">
          {/* Phân khúc 1: Chuyển đổi khách tiềm năng (Lead Funnel) */}
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base md:text-lg font-bold text-gray-800 dark:text-gray-100">Chuyển đổi khách tiềm năng</h2>
            
            </div>

            {/* 4 Cards KPI Cân Bằng Baseline */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 flex items-start justify-between min-w-0 w-full gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tổng lead tiềm năng</p>
                  <p className="text-2xl md:text-3xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight break-words">
                    {leadReportData?.totalLeads || 0}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">Dữ liệu ghi nhận từ các kênh</p>
                </div>
                <div className="w-11 h-11 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/30">
                  <Users size={22} />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 flex items-start justify-between min-w-0 w-full gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tỷ lệ chuyển đổi</p>
                  <p className="text-2xl md:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight break-words">
                    {leadReportData?.conversionRateOverall || 0}%
                  </p>
                  <p className="text-xs text-gray-400 mt-2">Tỷ lệ chuyển thành hợp đồng</p>
                </div>
                <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-900/30">
                  <TrendingUp size={22} />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 flex items-start justify-between min-w-0 w-full gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Đã chốt hợp đồng</p>
                  <p className="text-2xl md:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight break-words">
                    {leadReportData?.statusCounts?.converted || 0}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">Khách hàng kích hoạt thành công</p>
                </div>
                <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-900/30">
                  <CheckCircle2 size={22} />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 flex items-start justify-between min-w-0 w-full gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Hủy / Từ chối</p>
                  <p className="text-2xl md:text-3xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight break-words">
                    {leadReportData?.statusCounts?.lost || 0}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">Khách không có nhu cầu tiếp tục</p>
                </div>
                <div className="w-11 h-11 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-900/30">
                  <XCircle size={22} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Biểu đồ trạng thái Lead (Auto-scale Y axis) */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Tình trạng lead theo giai đoạn</h3>
                  
                </div>
                <div className="h-[240px] w-full relative">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart 
                      data={[
                        { name: 'Mới', count: leadReportData?.statusCounts?.new || 0 },
                        { name: 'Đã liên hệ', count: leadReportData?.statusCounts?.contacted || 0 },
                        { name: 'Hẹn tập thử', count: leadReportData?.statusCounts?.trial || 0 },
                        { name: 'Chốt HĐ', count: leadReportData?.statusCounts?.converted || 0 },
                        { name: 'Từ chối', count: leadReportData?.statusCounts?.lost || 0 },
                      ]}
                      margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                      <YAxis 
                        domain={[0, (dataMax) => Math.max(dataMax + 1, 2)]} 
                        allowDecimals={false} 
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip 
                        formatter={(value) => [`${value} Lead`, "Số lượng"]}
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                      />
                      <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Hiệu suất Chuyển đổi theo Sale (Co giãn tự nhiên + Empty state) */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 flex flex-col justify-between overflow-x-auto">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Hiệu suất chuyển đổi theo sale</h3>
                    
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/80 text-xs font-semibold text-gray-500 dark:text-gray-400">
                        <th className="p-3">Nhân viên sale</th>
                        <th className="p-3 text-center">Tổng lead</th>
                        <th className="p-3 text-center">Chốt</th>
                        <th className="p-3 text-center">Từ chối</th>
                        <th className="p-3 text-right">Tỷ lệ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                      {leadReportData?.salePerformance && leadReportData.salePerformance.length > 0 ? (
                        leadReportData.salePerformance.map((sp, i) => (
                          <tr key={i} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors">
                            <td className="p-3 font-semibold text-gray-900 dark:text-white">{sp.saleName}</td>
                            <td className="p-3 text-center font-medium text-gray-700 dark:text-gray-300">{sp.total}</td>
                            <td className="p-3 text-center font-bold text-emerald-600 dark:text-emerald-400">{sp.converted}</td>
                            <td className="p-3 text-center text-rose-500 font-medium">{sp.lost}</td>
                            <td className="p-3 text-right font-extrabold text-blue-600 dark:text-blue-400">{sp.conversionRate}%</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="p-8 text-center text-gray-400 text-xs">
                            Chưa có dữ liệu hiệu suất chuyển đổi theo sale
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Phân khúc 2: Tình trạng Hợp đồng */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base md:text-lg font-bold text-gray-800 dark:text-gray-100">Cơ cấu & giá trị hợp đồng</h2>
             
            </div>

            {/* 3 KPI Cards Màu Ngữ Nghĩa */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 flex items-start justify-between min-w-0 w-full gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tổng hợp đồng</p>
                  <p className="text-2xl md:text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 tracking-tight break-words">
                    {contractBreakdownData?.totalContracts || 0} HĐ
                  </p>
                  <p className="text-xs text-gray-400 mt-2">Tổng số hợp đồng đã phát sinh</p>
                </div>
                <div className="w-11 h-11 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/30">
                  <Package size={22} />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 flex items-start justify-between min-w-0 w-full gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tổng giá trị tiền hợp đồng</p>
                  <p className="text-2xl md:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight break-words">
                    {formatCurrency(contractBreakdownData?.grandTotalValue)}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">Tổng giá trị quy đổi tất cả hợp đồng</p>
                </div>
                <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-900/30">
                  <DollarSign size={22} />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 flex items-start justify-between min-w-0 w-full gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Đang hoạt động (Active)</p>
                  <p className="text-2xl md:text-3xl font-extrabold text-blue-600 dark:text-blue-400 tracking-tight break-words">
                    {contractBreakdownData?.breakdown?.active?.count || 0} HĐ
                  </p>
                  <p className="text-xs text-gray-400 mt-2">Hợp đồng đang có hiệu lực tập luyện</p>
                </div>
                <div className="w-11 h-11 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/30">
                  <Users size={22} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Donut Chart Tỷ lệ trạng thái (Bỏ label leader-line bị đè chữ + Center Total) */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Phân bổ trạng thái hợp đồng</h3>
                </div>

                <div className="h-[240px] w-full relative flex items-center justify-center my-auto">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={contractBreakdownData?.statusChartData || []}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={4}
                      >
                        {(contractBreakdownData?.statusChartData || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name, item) => [`${value} HĐ (${formatCurrency(item.payload.value)})`, name]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-6">
                    <span className="text-[11px] text-gray-400 font-medium">Tổng hợp đồng</span>
                    <span className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white mt-0.5">
                      {contractBreakdownData?.totalContracts || 0} HĐ
                    </span>
                  </div>
                </div>
              </div>

              {/* Bảng chi tiết trạng thái hợp đồng */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-x-auto flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Bảng thống kê chi tiết trạng thái  hợp đồng</h3>
                    
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/80 text-xs font-semibold text-gray-500 dark:text-gray-400">
                        <th className="p-3">Trạng thái</th>
                        <th className="p-3 text-center">Số lượng</th>
                        <th className="p-3 text-center">Tỷ lệ</th>
                        <th className="p-3 text-right">Tổng giá trị</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                      {(contractBreakdownData?.statusChartData || []).map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors">
                          <td className="p-3 font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                            {row.name}
                          </td>
                          <td className="p-3 text-center font-medium text-gray-700 dark:text-gray-300">{row.count}</td>
                          <td className="p-3 text-center font-bold text-gray-800 dark:text-gray-200">{row.percentage}%</td>
                          <td className="p-3 text-right font-extrabold text-emerald-600 dark:text-emerald-400">{formatCurrency(row.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Buổi Tập PT & Đối Soát */}
      {activeTab === 'pt-sessions' && (
        <PTSessionReportView
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          setSelectedMonth={setSelectedMonth}
          setSelectedYear={setSelectedYear}
        />
      )}
    </div>
  );
};

export default Reports;
