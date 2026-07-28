import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import reportService from '../services/reportService';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import {
  Download, Users, DollarSign, TrendingUp, AlertTriangle, ArrowUpRight,
  ArrowDownRight, Package, ShoppingCart, Award, Calendar, Clock, BarChart2, ShieldAlert
} from 'lucide-react';
import * as XLSX from 'xlsx';
import ChurnPrediction from '../components/report/ChurnPrediction';
import PTSessionReportModal from '../components/reports/PTSessionReportModal';
import PTSessionReportView from '../components/reports/PTSessionReportView';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6', '#ef4444'];

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
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
  const [isPTModalOpen, setIsPTModalOpen] = useState(false);
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
      const [summaryRes, revenueRes, packageRes, expiringRes, invRes] = await Promise.all([
        reportService.getSummary(params),
        reportService.getRevenueChart(params),
        reportService.getPackageDistribution(params),
        reportService.getExpiringMembers(params),
        reportService.getInventoryReport(params)
      ]);

      setSummary(summaryRes);
      setRevenueData(revenueRes);
      setPackageData(packageRes);
      setExpiringMembers(expiringRes);
      setInventoryData(invRes);
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
        "Mã KH": item.code || item.customerId || `KH-${item._id?.substring(item._id.length - 4)}`,
        "Tên Khách Hàng": item.name,
        "SĐT": item.phone,
        "Tên Gói Tập": item.packageType,
        "Kích Hoạt": new Date(item.startDate).toLocaleDateString("vi-VN"),
        "Hết Hạn": new Date(item.endDate).toLocaleDateString("vi-VN"),
        "Thành Tiền (VNĐ)": item.price
      }));

      const totalAmount = excelData.reduce((sum, item) => sum + (item["Thành Tiền (VNĐ)"] || 0), 0);
      const ws = XLSX.utils.json_to_sheet(excelData);

      XLSX.utils.sheet_add_aoa(ws, [
        ['Tổng', '', '', '', '', '', '', totalAmount]
      ], { origin: -1 });

      ws['!cols'] = [
        { wch: 5 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Doanh Thu");
      XLSX.writeFile(wb, `BaoCao_DoanhThu_T${selectedMonth}_${selectedYear}.xlsx`);
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
        <div className="flex items-center justify-between gap-4 flex-wrap bg-white dark:bg-gray-800 p-3.5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Kỳ báo cáo:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="text-xs font-semibold border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-colors"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="text-xs font-semibold border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-colors"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            {refreshing && <span className="text-xs text-gray-400 animate-pulse">Đang cập nhật...</span>}
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-primary text-background-dark font-bold px-4 py-2 rounded-xl hover:bg-primary/90 transition text-xs shadow-sm"
            >
              <Download size={16} /> Xuất Excel
            </button>
            <button
              onClick={() => setIsPTModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white font-bold rounded-xl hover:bg-gray-700 transition text-xs shadow-sm"
            >
              Đối Soát Buổi Tập PT
            </button>
          </div>
        </div>
      )}

      {/* 1. Phân tích Doanh thu */}
      {(activeTab === 'revenue' || activeTab === 'business' || activeTab === 'revenue-advanced') && (
        <div className="space-y-8">
          {/* Top KPI Cards: Doanh Thu Tháng Này | Trung Bình Ngày | MoM */}
          {(() => {
            const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
            const avgDailyRevenue = Math.round((summary.totalRevenue || 0) / (daysInMonth || 30));
            const momGrowth = revenueAdvanced?.compareLastMonth?.growthPercent ?? 0;

            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between min-w-0 w-full gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-black dark:text-white text-sm font-bold uppercase tracking-wider mb-1">Doanh thu tháng này</p>
                    <p className="text-xl md:text-2xl font-bold text-emerald-600 break-words">{summary.totalRevenue.toLocaleString()} VND</p>
                    <p className="text-xs text-gray-400 mt-1">Tổng thu tháng {selectedMonth}/{selectedYear}</p>
                  </div>
                  <div className="bg-green-100 p-3 rounded-xl text-green-600 shrink-0">
                    <DollarSign size={24} />
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between min-w-0 w-full gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-black dark:text-white text-sm font-bold uppercase tracking-wider mb-1">Trung bình / ngày</p>
                    <p className="text-xl md:text-2xl font-bold text-blue-600 break-words">{avgDailyRevenue.toLocaleString()} VND</p>
                    <p className="text-xs text-gray-400 mt-1">Tính trên {daysInMonth} ngày</p>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-xl text-blue-600 shrink-0">
                    <BarChart2 size={24} />
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between min-w-0 w-full gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-black dark:text-white text-sm font-bold uppercase tracking-wider mb-1">Tăng trưởng tháng</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className={`text-xl md:text-2xl font-bold ${momGrowth >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{momGrowth}%</p>
                      <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${
                        momGrowth >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                      }`}>
                        {momGrowth >= 0 ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
                        {momGrowth >= 0 ? 'Tăng' : 'Giảm'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">So với tháng trước</p>
                  </div>
                  <div className="bg-purple-100 p-3 rounded-xl text-purple-600 shrink-0">
                    <TrendingUp size={24} />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Card Phân Rạch Ròi 3 Dòng Doanh Thu */}
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Cơ cấu 3 dòng doanh thu (Thực thu)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase">1. Doanh số Gói tập Sale</div>
                <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {Number(summary.revenueStreams?.packageSales || 0).toLocaleString()} VNĐ
                </div>
                <p className="text-[11px] text-gray-500 mt-1">Bao gồm bán mới, gia hạn và chênh lệch nâng cấp HĐ</p>
              </div>

              <div className="p-4 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                <div className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase">2. Bán lẻ POS (Cửa hàng)</div>
                <div className="text-lg font-black text-blue-600 dark:text-blue-400 mt-1">
                  {Number(summary.revenueStreams?.posSales || 0).toLocaleString()} VNĐ
                </div>
                <p className="text-[11px] text-gray-500 mt-1">Doanh thu nước uống, phụ kiện, thực phẩm bổ sung</p>
              </div>

              <div className="p-4 bg-purple-50/60 dark:bg-purple-950/20 rounded-xl border border-purple-100 dark:border-purple-900/30">
                <div className="text-xs font-bold text-purple-800 dark:text-purple-300 uppercase">3. Phí Dịch Vụ</div>
                <div className="text-lg font-black text-purple-600 dark:text-purple-400 mt-1">
                  {Number(summary.revenueStreams?.serviceFees || 0).toLocaleString()} VNĐ
                </div>
                <p className="text-[11px] text-gray-500 mt-1">Phí chuyển nhượng (1.000.000đ/HĐ) & phí bảo lưu HĐ</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Biểu Đồ Doanh Thu Theo Ngày</h2>
            <div className="h-[400px] w-full relative">
              {renderCharts ? (
                <ResponsiveContainer width="100%" height={380} minWidth={1}>
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" />
                    <YAxis 
                      ticks={revenueTicks}
                      tickFormatter={(value) => new Intl.NumberFormat('vi-VN', { notation: "compact", compactDisplay: "short" }).format(value)}
                      domain={[0, 200000000]} 
                    />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Bar 
                      dataKey="revenue" 
                      fill="#3b82f6" 
                      radius={[4, 4, 0, 0]} 
                      name="Doanh Thu"
                      barSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[380px] flex items-center justify-center text-gray-400 text-sm">
                  Đang tải biểu đồ doanh thu...
                </div>
              )}
            </div>
          </div>

          {/* Phân tích Doanh thu Nâng cao */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-6">
            <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200">So sánh tăng trưởng</h2>
            {loadingAdvanced ? (
              <div className="text-center py-10 text-gray-500">Đang tải dữ liệu doanh thu nâng cao...</div>
            ) : revenueAdvanced ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                      <p className="text-black dark:text-white text-sm font-bold uppercase tracking-wider mb-1">Doanh thu tháng trước</p>
                      <p className="text-xl md:text-2xl font-bold text-blue-600">{formatCurrency(revenueAdvanced.compareLastMonth?.value)}</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-full text-blue-600">
                      <DollarSign size={24} />
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                      <p className="text-black dark:text-white text-sm font-bold uppercase tracking-wider mb-1">So với tháng trước</p>
                      <p className={`text-xl md:text-2xl font-bold ${(revenueAdvanced.compareLastMonth?.growthPercent ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{revenueAdvanced.compareLastMonth?.growthPercent ?? 0}%</p>
                      <span className={`inline-flex items-center text-xs font-bold mt-1 px-2 py-0.5 rounded-full ${
                        (revenueAdvanced.compareLastMonth?.growthPercent ?? 0) >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                      }`}>
                        {(revenueAdvanced.compareLastMonth?.growthPercent ?? 0) >= 0 ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
                        Tăng trưởng so tháng trước
                      </span>
                    </div>
                    <div className={`p-3 rounded-full ${(revenueAdvanced.compareLastMonth?.growthPercent ?? 0) >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                      <TrendingUp size={24} />
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                      <p className="text-black dark:text-white text-sm font-bold uppercase tracking-wider mb-1">So với năm ngoái</p>
                      <p className={`text-xl md:text-2xl font-bold ${(revenueAdvanced.compareLastYear?.growthPercent ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{revenueAdvanced.compareLastYear?.growthPercent ?? 0}%</p>
                      <span className={`inline-flex items-center text-xs font-bold mt-1 px-2 py-0.5 rounded-full ${
                        (revenueAdvanced.compareLastYear?.growthPercent ?? 0) >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                      }`}>
                        {(revenueAdvanced.compareLastYear?.growthPercent ?? 0) >= 0 ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
                        Tăng trưởng so năm ngoái
                      </span>
                    </div>
                    <div className="bg-violet-50 p-3 rounded-full text-violet-600">
                      <Calendar size={24} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4 text-base">Cơ cấu nguồn thu</h3>
                    <div className="h-[300px] flex items-center justify-center relative">
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie
                            data={revenueAdvanced.sources}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            fill="#8884d8"
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {revenueAdvanced.sources.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v) => formatCurrency(v)} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-4 text-base">Xu hướng doanh thu 6 tháng qua</h3>
                    <div className="h-[300px] relative">
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={revenueAdvanced.trend}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="month" />
                          <YAxis tickFormatter={(val) => `${val / 1000000}M`} />
                          <Tooltip formatter={(v) => formatCurrency(v)} />
                          <Legend />
                          <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} activeDot={{ r: 8 }} name="Doanh Thu" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* Bảng lương nhân sự */}
          {hrSummary.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-4">
              <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200">Lương & Hoa hồng nhân sự</h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 uppercase text-xs font-bold text-black dark:text-white">
                        <th className="p-4">Nhân viên</th>
                        <th className="p-4">Chức vụ</th>
                        <th className="p-4 text-right">Lương cơ bản</th>
                        <th className="p-4 text-right">Hoa hồng đạt</th>
                        <th className="p-4 text-center">Tiến độ KPI</th>
                        <th className="p-4 text-right font-bold text-black dark:text-white">Thực nhận</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {hrSummary.map((staff) => (
                        <tr key={staff._id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4 font-bold text-gray-800">{staff.fullName}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                              ['pt', 'pm'].includes(staff.role) ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                            }`}>
                              {staff.role}
                            </span>
                          </td>
                          <td className="p-4 text-right">{formatCurrency(staff.basicSalary)}</td>
                          <td className="p-4 text-right text-emerald-600 font-medium">{formatCurrency(staff.commission)}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-2 justify-center max-w-[120px] mx-auto">
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${staff.kpiProgress >= 100 ? 'bg-green-500' : staff.kpiProgress >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                  style={{ width: `${Math.min(staff.kpiProgress, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold text-gray-700 shrink-0">{staff.kpiProgress}%</span>
                            </div>
                          </td>
                          <td className="p-4 text-right font-black text-blue-600 text-base">{formatCurrency(staff.totalSalary)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      )}



      {/* Khách hàng Tab */}
      {activeTab === 'customer-analytics' && (
        <div className="space-y-6">
          {loadingAdvanced ? (
            <div className="text-center py-10 text-gray-500">Đang tải phân tích khách hàng...</div>
          ) : customerAnalytics ? (
            <>
              {/* KPI 5 cards: ARPU, PT riêng, Solo, Giữ chân, Rời bỏ */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-black dark:text-white text-sm font-bold uppercase tracking-wider block mb-1">Chi tiêu trung bình / KH</span>
                    <span className="text-xl font-bold text-blue-600 mt-1 block">{formatCurrency(customerAnalytics.arpu)}</span>
                    <span className="text-xs text-gray-400 mt-1 block">Doanh thu trung bình trọn đời mỗi hội viên</span>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                    <DollarSign size={24} />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-black dark:text-white text-sm font-bold uppercase tracking-wider block mb-1">Hội viên có PT riêng</span>
                    <span className="text-xl font-bold text-indigo-600 mt-1 block">
                      {customerAnalytics.trainerRatio?.withTrainer || 0} <span className="text-xs text-gray-400 font-normal">người</span>
                    </span>
                    <span className="text-xs text-gray-400 mt-1 block">
                      Tỷ lệ: {customerAnalytics.trainerRatio ? Math.round((customerAnalytics.trainerRatio.withTrainer / (customerAnalytics.trainerRatio.withTrainer + customerAnalytics.trainerRatio.solo || 1)) * 100) : 0}% hội viên tập với PT
                    </span>
                  </div>
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                    <Award size={24} />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-black dark:text-white text-sm font-bold uppercase tracking-wider block mb-1">Hội viên tự tập (Solo)</span>
                    <span className="text-xl font-bold text-emerald-600 mt-1 block">
                      {customerAnalytics.trainerRatio?.solo || 0} <span className="text-xs text-gray-400 font-normal">người</span>
                    </span>
                    <span className="text-xs text-gray-400 mt-1 block">Hội viên tự tập luyện tự do tại phòng</span>
                  </div>
                  <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center shrink-0">
                    <Users size={24} />
                  </div>
                </div>
              </div>

              {/* Hàng 2: Tỷ lệ giữ chân + Rời bỏ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                  <p className="text-black dark:text-white text-sm font-bold uppercase tracking-wider mb-1">Tỷ lệ giữ chân</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold text-emerald-600">{summary.retentionRate}%</p>
                    <span className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-600"><ArrowUpRight size={14}/> Tích cực</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Dựa trên tỷ lệ khách hàng còn Active / Tổng</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                  <p className="text-black dark:text-white text-sm font-bold uppercase tracking-wider mb-1">Tỷ lệ rời bỏ</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold text-rose-600">{summary.churnRate}%</p>
                    <span className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600"><ArrowDownRight size={14}/> Cần chú ý</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Phần trăm khách hàng hết hạn chưa gia hạn</p>
                </div>
              </div>

              {/* Bảng thống kê PT phụ trách */}
              {customerAnalytics.trainerStats && customerAnalytics.trainerStats.length > 0 && (
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-1 text-base">Thống kê khách hàng theo PT phụ trách</h3>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 uppercase text-xs font-bold text-black dark:text-white">
                          <th className="p-3">PT phụ trách</th>
                          <th className="p-3">Chức vụ</th>
                          <th className="p-3 text-right">Số hội viên</th>
                          <th className="p-3">Tỷ trọng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {customerAnalytics.trainerStats.map((pt) => {
                          const total = customerAnalytics.trainerRatio?.withTrainer || 1;
                          const pct = Math.round((pt.count / total) * 100);
                          return (
                            <tr key={String(pt._id)} className="hover:bg-gray-50">
                              <td className="p-3 font-bold text-gray-800">{pt.name}</td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-bold uppercase">
                                  {pt.role}
                                </span>
                              </td>
                              <td className="p-3 text-right font-black text-indigo-600">{pt.count} KH</td>
                              <td className="p-3 w-48">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                                    <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-xs text-gray-600 font-semibold w-8 shrink-0">{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Hàng biểu đồ 1: Giới tính & Độ tuổi */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-155 shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-4 text-base">Cơ cấu giới tính hội viên</h3>
                  <div className="h-[250px] flex items-center justify-center relative">
                    <ResponsiveContainer width="100%" height={230}>
                      <PieChart>
                        <Pie
                          data={customerAnalytics.gender}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          fill="#8884d8"
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {customerAnalytics.gender.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v, name) => [`${v} KH`, name]} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-155 shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-4 text-base">Phân bổ độ tuổi hội viên</h3>
                  <div className="h-[250px] relative">
                    <ResponsiveContainer width="100%" height={230}>
                      <BarChart data={customerAnalytics.age}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Số lượng" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Phân bổ gói tập - full width, layout lớn */}
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4 text-base">Gói tập đang hoạt động</h3>
                <div className="flex flex-col lg:flex-row items-start gap-6">
                  <div className="w-full lg:w-1/3 space-y-2">
                    {customerAnalytics.packagePopularity.map((entry, index) => (
                      <div key={index} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[(index + 2) % COLORS.length] }} />
                          <span className="text-sm text-gray-700 truncate">{entry.name}</span>
                        </div>
                        <span className="text-sm font-bold text-gray-800 ml-2 shrink-0">{entry.value} KH</span>
                      </div>
                    ))}
                  </div>
                  <div className="w-full lg:w-2/3 h-[280px] relative">
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
                          <Tooltip formatter={(v, name) => [`${v} khách hàng`, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">Đang tải...</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Kênh tiếp cận & Tần suất tập luyện nằm cạnh nhau */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-gray-800 mb-4 text-base">Kênh tiếp cận</h3>
                    <div className="flex flex-col gap-2 mb-3">
                      {customerAnalytics.sources.map((entry, index) => (
                        <div key={index} className="flex items-center justify-between px-2 py-1 bg-gray-50 rounded text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[(index + 4) % COLORS.length] }} />
                            <span className="text-gray-700 truncate">{entry.name}</span>
                          </div>
                          <span className="font-bold text-gray-800 ml-2 shrink-0">{entry.value} KH</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="h-[160px] relative">
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={customerAnalytics.sources} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2} dataKey="value">
                          {customerAnalytics.sources.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v, name) => [`${v} KH`, name]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-gray-800 mb-1 text-base">Phân khúc tần suất tập luyện</h3>
                    <p className="text-xs text-gray-400 mb-4">Gom nhóm hội viên dựa trên số ngày đi tập (check-in) trong 30 ngày qua</p>
                  </div>
                  <div className="h-[210px] relative">
                    <ResponsiveContainer width="100%" height={210}>
                      <BarChart data={customerAnalytics.intensity}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} name="Số hội viên" />
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
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="mb-4">
                      <h3 className="font-bold text-gray-800 text-base">Khách hàng lâu chưa đi tập</h3>
                      <p className="text-xs text-gray-400 mt-1">Còn hạn gói tập nhưng không có check-in trong 30 ngày qua</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 uppercase text-xs font-bold text-black dark:text-white">
                            <th className="p-3">Khách hàng</th>
                            <th className="p-3">Mã KH</th>
                            <th className="p-3">Số điện thoại</th>
                            <th className="p-3">Gói tập</th>
                            <th className="p-3 text-right">Ngày hết hạn</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {paginatedInactive.length > 0 ? (
                            paginatedInactive.map((cust) => (
                              <tr key={cust._id} className="hover:bg-red-50/10 transition-colors">
                                <td className="p-3 font-bold text-gray-800">{cust.name}</td>
                                <td className="p-3 text-gray-600 font-mono">{cust.code}</td>
                                <td className="p-3 text-gray-600">{cust.phone}</td>
                                <td className="p-3">
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-bold">{cust.packageType}</span>
                                </td>
                                <td className="p-3 text-right text-red-500 font-bold">
                                  {new Date(cust.endDate).toLocaleDateString("vi-VN")}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="5" className="p-6 text-center text-gray-500">Tuyệt vời! Không có khách hàng nào bỏ tập lâu ngày.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                        <span className="text-xs text-gray-500">
                          Hiển {(inactivePage - 1) * INACTIVE_PAGE_SIZE + 1}–{Math.min(inactivePage * INACTIVE_PAGE_SIZE, customerAnalytics.inactive.length)} / {customerAnalytics.inactive.length} khách
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setInactivePage(p => Math.max(p - 1, 1))}
                            disabled={inactivePage === 1}
                            className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Trước
                          </button>
                          <span className="text-xs font-bold text-gray-700">{inactivePage} / {totalPages}</span>
                          <button
                            onClick={() => setInactivePage(p => Math.min(p + 1, totalPages))}
                            disabled={inactivePage >= totalPages}
                            className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Sau
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Hội viên sắp hết hạn - chuyển từ Revenue */}
              {expiringMembers.length > 0 && (
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                  <h3 className="font-bold text-gray-800 text-base mb-4">Hội viên sắp hết hạn (14 ngày tới)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-black dark:text-white uppercase font-bold">
                          <th className="p-3">Khách Hàng</th>
                          <th className="p-3">Số ĐT</th>
                          <th className="p-3">Gói Tập</th>
                          <th className="p-3">Ngày Hết Hạn</th>
                          <th className="p-3">Buổi Còn</th>
                          <th className="p-3 text-right">Liên hệ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-sm">
                        {expiringMembers.map((member) => (
                          <tr key={member._id} className="hover:bg-orange-50/30 transition-colors">
                            <td className="p-3 font-bold text-gray-800">{member.name}</td>
                            <td className="p-3 text-gray-600">{member.phone}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">{member.packageType}</span>
                            </td>
                            <td className="p-3 text-red-600 font-bold">{new Date(member.endDate).toLocaleDateString("vi-VN")}</td>
                            <td className="p-3 font-semibold">{member.remainingSessions}</td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <a href={`tel:${member.phone}`} className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs font-bold hover:bg-emerald-100 transition-colors">📞 Gọi</a>
                                <a href={`https://zalo.me/${member.phone}`} target="_blank" rel="noreferrer" className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-bold hover:bg-blue-100 transition-colors">💬 Zalo</a>
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
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col overflow-hidden h-[380px]">
                  <div className="p-4 bg-red-50 border-b border-red-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                      <Package size={18} />
                      <span>Sản phẩm sắp hết hàng</span>
                    </div>
                    <span className="px-2.5 py-1 text-xs font-black bg-red-600 text-white rounded-full">
                      {notificationsSummary.lowStockProductsCount}
                    </span>
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto custom-scrollbar divide-y divide-gray-100 text-xs">
                    {notificationsSummary.lowStockProducts.length > 0 ? (
                      notificationsSummary.lowStockProducts.map(p => (
                        <div key={p._id} className="py-2.5 flex items-center justify-between">
                          <div>
                            <p className="font-bold text-gray-800">{p.name}</p>
                            <p className="text-gray-400 mt-0.5">Ngưỡng cảnh báo: {p.minStockAlert || 5}</p>
                          </div>
                          <span className="px-2 py-1 bg-red-100 text-red-700 font-black rounded text-[10px]">
                            Còn {p.stockQuantity} SP
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-10 text-gray-400">Kho hàng an toàn, không có mặt hàng nào sắp hết</p>
                    )}
                  </div>
                </div>

                {/* 2. Hội viên sắp hết hạn */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col overflow-hidden h-[380px]">
                  <div className="p-4 bg-orange-50 border-b border-orange-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-orange-700 font-bold text-sm">
                      <Users size={18} />
                      <span>Hội viên sắp hết hạn (14 ngày)</span>
                    </div>
                    <span className="px-2.5 py-1 text-xs font-black bg-orange-600 text-white rounded-full">
                      {notificationsSummary.expiringCustomersCount}
                    </span>
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto custom-scrollbar divide-y divide-gray-100 text-xs">
                    {notificationsSummary.expiringCustomers.length > 0 ? (
                      notificationsSummary.expiringCustomers.map(c => (
                        <div key={c._id} className="py-2.5 flex items-center justify-between">
                          <div>
                            <p className="font-bold text-gray-800">{c.name}</p>
                            <p className="text-gray-400 mt-0.5">{c.phone} • {c.packageType}</p>
                          </div>
                          <span className="px-2 py-1 bg-orange-100 text-orange-700 font-bold rounded text-[10px]">
                            Hạn: {new Date(c.endDate).toLocaleDateString("vi-VN")}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-10 text-gray-400">Không có hội viên nào sắp hết hạn gói tập</p>
                    )}
                  </div>
                </div>

                {/* 3. Công việc ca trực hôm nay chưa làm */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col overflow-hidden h-[380px]">
                  <div className="p-4 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
                      <Calendar size={18} />
                      <span>Ca trực chưa hoàn thành hôm nay</span>
                    </div>
                    <span className="px-2.5 py-1 text-xs font-black bg-blue-600 text-white rounded-full">
                      {notificationsSummary.pendingTasksCount}
                    </span>
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto custom-scrollbar divide-y divide-gray-100 text-xs">
                    {notificationsSummary.pendingTasks.length > 0 ? (
                      notificationsSummary.pendingTasks.map(t => (
                        <div key={t._id} className="py-2.5 flex items-center justify-between">
                          <div>
                            <p className="font-bold text-gray-800">{t.title}</p>
                            <p className="text-gray-400 mt-0.5">Nhân viên: {t.staffName}</p>
                          </div>
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 font-bold rounded text-[10px]">
                            Ca: {t.timeSlot}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-10 text-gray-400">Đã hoàn thành toàn bộ ca trực hôm nay</p>
                    )}
                  </div>
                </div>

                {/* 4. Kỳ lương hoa hồng chờ duyệt */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col overflow-hidden h-[380px] lg:col-span-1">
                  <div className="p-4 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-purple-700 font-bold text-sm">
                      <DollarSign size={18} />
                      <span>Hoa hồng chờ duyệt</span>
                    </div>
                    <span className="px-2.5 py-1 text-xs font-black bg-purple-600 text-white rounded-full">
                      {notificationsSummary.pendingCommissionsCount}
                    </span>
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto custom-scrollbar divide-y divide-gray-100 text-xs">
                    {notificationsSummary.pendingCommissions.length > 0 ? (
                      notificationsSummary.pendingCommissions.map((c, idx) => (
                        <div key={idx} className="py-2.5 flex items-center justify-between">
                          <div>
                            <p className="font-bold text-gray-800">Chu kỳ hoa hồng T{c.month}/{c.year}</p>
                            <p className="text-gray-400 mt-0.5">Loại: {c.type === 'pt' ? 'Huấn luyện viên (PT)' : 'Nhân viên Sale'}</p>
                          </div>
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 font-black rounded text-[10px]">
                            {formatCurrency(c.totalAmount)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-10 text-gray-400">Không có kỳ lương hoa hồng nào chờ duyệt</p>
                    )}
                  </div>
                </div>

                {/* 5. Cảnh báo KPI yếu */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col overflow-hidden h-[380px] md:col-span-2 lg:col-span-2">
                  <div className="p-4 bg-yellow-50 border-b border-yellow-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-yellow-800 font-bold text-sm">
                      <AlertTriangle size={18} />
                      <span>Cảnh báo nhân viên KPI yếu (&lt;50% cuối tháng)</span>
                    </div>
                    <span className="px-2.5 py-1 text-xs font-black bg-yellow-600 text-white rounded-full">
                      {notificationsSummary.lowKPIStaffCount}
                    </span>
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto custom-scrollbar divide-y divide-gray-100 text-xs">
                    {notificationsSummary.lowKPIStaff.length > 0 ? (
                      notificationsSummary.lowKPIStaff.map(s => (
                        <div key={s._id} className="py-2.5 flex items-center justify-between">
                          <div>
                            <p className="font-bold text-gray-800">{s.fullName} ({s.role.toUpperCase()})</p>
                            <p className="text-gray-400 mt-0.5">
                              Thực tế: {s.role === 'pt' ? `${s.actual} buổi` : formatCurrency(s.actual)} / Mục tiêu: {s.role === 'pt' ? `${s.target} buổi` : formatCurrency(s.target)}
                            </p>
                          </div>
                          <span className="px-2.5 py-1 bg-yellow-100 text-yellow-800 font-black rounded text-xs shrink-0 ml-4">
                            Đạt {s.percentage}%
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-10 text-gray-400">Tất cả nhân viên đang duy trì tiến độ KPI tốt</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between min-w-0 w-full gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-black dark:text-white text-sm font-bold uppercase tracking-wider mb-1 break-words">Doanh thu POS (Tháng này)</p>
                <p className="text-xl md:text-2xl font-bold text-emerald-600 break-words break-all">{inventoryData.posRevenue.toLocaleString()} VND</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full text-green-600 shrink-0">
                <ShoppingCart size={24} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between min-w-0 w-full gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-black dark:text-white text-sm font-bold uppercase tracking-wider mb-1 break-words">Tổng giá trị tồn kho</p>
                <p className="text-xl md:text-2xl font-bold text-blue-600 break-words break-all">{inventoryData.totalStockValue.toLocaleString()} VND</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full text-blue-600 shrink-0">
                <Package size={24} />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="text-orange-500" />
              <h2 className="text-xl font-bold text-gray-800">Sản Phẩm Sắp Hết Hàng (Tồn kho {"<="} 10)</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 uppercase text-xs font-bold text-black dark:text-white">
                    <th className="p-3">Mã SP</th>
                    <th className="p-3">Tên Sản Phẩm</th>
                    <th className="p-3">Danh Mục</th>
                    <th className="p-3">Giá Bán</th>
                    <th className="p-3">Tồn Kho</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryData.lowStockProducts.length > 0 ? (
                    inventoryData.lowStockProducts.map((product) => (
                      <tr key={product._id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-600">{product.productCode}</td>
                        <td className="p-3 text-gray-800 font-bold">{product.name}</td>
                        <td className="p-3 text-gray-600">{product.category}</td>
                        <td className="p-3 text-gray-800">{product.sellPrice.toLocaleString()} đ</td>
                        <td className="p-3">
                          <span className={`px-3 py-1 rounded-full text-sm font-bold ${product.stockQuantity === 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                            {product.stockQuantity}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="p-4 text-center text-gray-500">
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
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div className="relative flex-1 max-w-md w-full">
              <input
                className="w-full pl-4 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-gray-50"
                placeholder="Tìm nhân viên, hành động..."
                value={auditSearch}
                onChange={(e) => {
                  setAuditSearch(e.target.value);
                  setAuditPage(1);
                }}
              />
            </div>
            <div className="flex gap-2">
              <span className="text-xs text-gray-500 font-bold self-center"></span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            {auditLoading ? (
              <div className="p-8 text-center text-gray-500">Đang tải nhật ký hệ thống...</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-white dark:bg-gray-800 uppercase text-xs font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="p-4 w-[15%]">Thời Gian</th>
                        <th className="p-4 w-[15%]">Nhân Viên</th>
                        <th className="p-4 w-[35%]">Hành Động</th>
                        <th className="p-4 w-[10%]">Thao Tác</th>
                        <th className="p-4 w-[25%]">Chi Tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {auditLogs.length > 0 ? (
                        auditLogs.map((log) => (
                          <tr key={log._id} className="hover:bg-gray-50 transition-colors">
                            <td className="p-4 text-sm text-gray-600">
                              {new Date(log.createdAt).toLocaleString("vi-VN")}
                            </td>
                            <td className="p-4">
                              <span className="font-bold text-gray-800">{log.username}</span>
                              {log.user?.role && (
                                <span className="ml-1.5 px-2 py-0.5 text-[10px] font-black uppercase rounded bg-gray-100 text-gray-600">
                                  {log.user.role}
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-sm text-gray-800 font-medium">
                              {log.action}
                            </td>
                            <td className="p-4">
                              <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                                log.method === "POST" ? "bg-green-100 text-green-700" :
                                log.method === "PUT" ? "bg-blue-100 text-blue-700" :
                                "bg-red-100 text-red-700"
                              }`}>
                                {log.method === "POST" ? "Thêm" : log.method === "PUT" ? "Sửa" : "Xóa"}
                              </span>
                            </td>
                            <td className="p-4 text-xs font-mono text-gray-500 max-w-xs truncate">
                              <details className="cursor-pointer">
                                <summary className="text-primary hover:underline font-sans font-bold">Xem chi tiết</summary>
                                <pre className="mt-2 p-2 bg-gray-50 border rounded text-[10px] overflow-x-auto whitespace-pre-wrap max-h-32">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </details>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="p-8 text-center text-gray-500">
                            Không có nhật ký vận hành nào phù hợp.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                  <div className="text-sm text-gray-500">
                    Trang <span className="font-bold">{auditPage}</span> / <span className="font-bold">{auditTotalPages}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAuditPage((prev) => Math.max(prev - 1, 1))}
                      disabled={auditPage === 1 || auditLoading}
                      className="px-4 py-2 text-xs font-bold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Trang trước
                    </button>
                    <button
                      onClick={() => setAuditPage((prev) => Math.min(prev + 1, auditTotalPages))}
                      disabled={auditPage >= auditTotalPages || auditLoading}
                      className="px-4 py-2 text-xs font-bold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200">Chuyển đổi khách tiềm năng</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <p className="text-black dark:text-white text-sm font-bold uppercase tracking-wider mb-1">Tổng Lead Tiềm Năng</p>
                <p className="text-2xl font-bold text-blue-600 mt-1.5">{leadReportData?.totalLeads || 0}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <p className="text-black dark:text-white text-sm font-bold uppercase tracking-wider mb-1">Tỷ lệ Chuyển đổi Khách</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1.5">{leadReportData?.conversionRateOverall || 0}%</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <p className="text-black dark:text-white text-sm font-bold uppercase tracking-wider mb-1">Đã Chốt Hợp Đồng</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1.5">{leadReportData?.statusCounts?.converted || 0}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <p className="text-black dark:text-white text-sm font-bold uppercase tracking-wider mb-1">Hủy / Từ chối</p>
                <p className="text-2xl font-bold text-rose-600 mt-1.5">{leadReportData?.statusCounts?.lost || 0}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Biểu đồ trạng thái Lead */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-base font-bold text-gray-900 mb-4">Tình trạng Lead theo giai đoạn</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Mới ', count: leadReportData?.statusCounts?.new || 0 },
                      { name: 'Đã liên hệ', count: leadReportData?.statusCounts?.contacted || 0 },
                      { name: 'Hẹn tập thử', count: leadReportData?.statusCounts?.trial || 0 },
                      { name: 'Chốt HĐ ', count: leadReportData?.statusCounts?.converted || 0 },
                      { name: 'Từ chối ', count: leadReportData?.statusCounts?.lost || 0 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Hiệu suất Chuyển đổi theo Sale */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                <h3 className="text-base font-bold text-gray-900 mb-4">Hiệu Suất Chuyển Đổi Theo Sale</h3>
                <table className="w-full text-left text-xs">
                  <thead className="bg-white dark:bg-gray-800 text-black dark:text-white uppercase font-bold text-xs border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="p-2.5">Nhân viên Sale</th>
                      <th className="p-2.5 text-center">Tổng Lead</th>
                      <th className="p-2.5 text-center">Chốt</th>
                      <th className="p-2.5 text-center">Từ chối</th>
                      <th className="p-2.5 text-right">Tỷ lệ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {leadReportData?.salePerformance?.map((sp, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="p-2.5 font-bold text-gray-800">{sp.saleName}</td>
                        <td className="p-2.5 text-center font-semibold">{sp.total}</td>
                        <td className="p-2.5 text-center font-bold text-emerald-600">{sp.converted}</td>
                        <td className="p-2.5 text-center text-rose-500">{sp.lost}</td>
                        <td className="p-2.5 text-right font-black text-blue-600">{sp.conversionRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Phân khúc 2: Tình trạng Hợp đồng */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-6">
            <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200">Tình trạng hợp đồng</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <p className="text-black dark:text-white text-sm font-bold uppercase tracking-wider mb-1">Tổng Hợp Đồng</p>
                <p className="text-2xl font-bold text-indigo-600 mt-1.5">{contractBreakdownData?.totalContracts || 0} hợp đồng</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <p className="text-black dark:text-white text-sm font-bold uppercase tracking-wider mb-1">Tổng Giá Trị Tiền Hợp Đồng</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1.5">{formatCurrency(contractBreakdownData?.grandTotalValue)}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <p className="text-black dark:text-white text-sm font-bold uppercase tracking-wider mb-1">Đang Hoạt Động (Active)</p>
                <p className="text-2xl font-bold text-blue-600 mt-1.5">{contractBreakdownData?.breakdown?.active?.count || 0} HĐ</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Pie Chart Tỷ lệ trạng thái */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-base font-bold text-gray-900 mb-4">Biểu Đồ Phân Bổ Trạng Thái Hợp Đồng</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={contractBreakdownData?.statusChartData || []}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percentage }) => `${name}: ${percentage}%`}
                      >
                        {(contractBreakdownData?.statusChartData || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name, item) => [`${value} HĐ (${formatCurrency(item.payload.value)})`, name]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bảng chi tiết trạng thái hợp đồng */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                <h3 className="text-base font-bold text-gray-900 mb-4">Bảng Thống Kê Chi Tiết Loại Hợp Đồng</h3>
                <table className="w-full text-left text-xs">
                  <thead className="bg-white dark:bg-gray-800 text-black dark:text-white uppercase font-bold text-xs border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="p-3">Trạng thái Hợp đồng</th>
                      <th className="p-3 text-center">Số lượng</th>
                      <th className="p-3 text-center">Tỷ lệ</th>
                      <th className="p-3 text-right">Tổng giá trị (VNĐ)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(contractBreakdownData?.statusChartData || []).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="p-3 font-bold flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: row.color }} />
                          {row.name}
                        </td>
                        <td className="p-3 text-center font-semibold">{row.count}</td>
                        <td className="p-3 text-center font-bold text-gray-700">{row.percentage}%</td>
                        <td className="p-3 text-right font-bold text-emerald-600">{formatCurrency(row.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

      {/* Modal Đối Soát Buổi Tập PT */}
      <PTSessionReportModal
        isOpen={isPTModalOpen}
        onClose={() => setIsPTModalOpen(false)}
      />
    </div>
  );
};

export default Reports;
