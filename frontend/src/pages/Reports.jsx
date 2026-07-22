import React, { useEffect, useState } from 'react';
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

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6', '#ef4444'];

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
};

const Reports = () => {
  const [summary, setSummary] = useState({ totalRevenue: 0, activeMembers: 0, newMembers: 0, retentionRate: 0, churnRate: 0 });
  const [revenueData, setRevenueData] = useState([]);
  const [packageData, setPackageData] = useState([]);
  const [expiringMembers, setExpiringMembers] = useState([]);
  const [inventoryData, setInventoryData] = useState({ posRevenue: 0, totalStockValue: 0, lowStockProducts: [] });
  const [activeTab, setActiveTab] = useState("business");
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
  const [notificationsSummary, setNotificationsSummary] = useState(null);
  const [loadingAdvanced, setLoadingAdvanced] = useState(false);

  // States cho Audit Log
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");

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
    } else if (activeTab === "revenue-advanced") {
      fetchRevenueAdvanced();
    } else if (activeTab === "hr-summary") {
      fetchHRSummary();
    } else if (activeTab === "customer-analytics") {
      fetchCustomerAnalytics();
    } else if (activeTab === "notifications-report") {
      fetchNotificationsSummary();
    }
  }, [activeTab, auditPage, auditSearch, selectedMonth, selectedYear]);

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
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {[
          { id: "business", label: "Doanh thu cơ bản" },
          { id: "revenue-advanced", label: "Doanh thu nâng cao" },
          { id: "hr-summary", label: "Lương & Thưởng" },
          { id: "customer-analytics", label: "Phân tích khách hàng" },
          { id: "churn", label: "Dự đoán Rời bỏ" },
          { id: "inventory", label: "Kho Hàng & Bán Lẻ"},
          { id: "notifications-report", label: "Cảnh báo & Vận hành" },
          { id: "audit", label: "Nhật ký vận hành" }
        ].map((t) => (
          <button
            key={t.id}
            className={`py-3 px-4 font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Kỳ báo cáo */}
      {!["audit", "customer-analytics", "notifications-report"].includes(activeTab) && (
        <div className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100 w-fit">
          <span className="text-sm font-bold text-gray-700">Kỳ báo cáo:</span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {refreshing && <span className="text-xs text-gray-400 animate-pulse">Đang cập nhật...</span>}
        </div>
      )}

      {/* Doanh thu cơ bản Tab */}
      {activeTab === 'business' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button 
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-medium"
            >
              <Download size={18} /> Xuất Excel Doanh Thu
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between min-w-0 w-full gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-gray-500 text-sm break-words">Doanh thu tháng này</p>
                <p className="text-2xl font-bold text-green-600 break-words break-all">{summary.totalRevenue.toLocaleString()} VND</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full text-green-600 shrink-0">
                <DollarSign size={24} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between min-w-0 w-full gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-gray-500 text-sm break-words">Thành viên đang tập</p>
                <p className="text-2xl font-bold text-blue-600 break-words break-all">{summary.activeMembers}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full text-blue-600 shrink-0">
                <Users size={24} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between min-w-0 w-full gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-gray-500 text-sm break-words">Khách mới (Tháng này)</p>
                <p className="text-2xl font-bold text-purple-600 break-words break-all">{summary.newMembers}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full text-purple-600 shrink-0">
                <TrendingUp size={24} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between min-w-0 w-full">
               <div className="min-w-0 flex-1">
                 <p className="text-gray-500 text-sm font-medium mb-1 break-words">Tỷ lệ giữ chân</p>
                 <div className="flex items-center gap-2 flex-wrap">
                   <p className="text-3xl font-bold text-green-600 break-words break-all">{summary.retentionRate}%</p>
                   <span className="flex items-center text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full shrink-0"><ArrowUpRight size={16}/> Tích cực</span>
                 </div>
                 <p className="text-xs text-gray-400 mt-2 break-words">Dựa trên tỷ lệ khách hàng còn Active/Tổng khách hàng</p>
               </div>
             </div>

             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between min-w-0 w-full">
               <div className="min-w-0 flex-1">
                 <p className="text-gray-500 text-sm font-medium mb-1 break-words">Tỷ lệ rời bỏ</p>
                 <div className="flex items-center gap-2 flex-wrap">
                   <p className="text-3xl font-bold text-red-600 break-words break-all">{summary.churnRate}%</p>
                   <span className="flex items-center text-sm text-red-600 bg-red-50 px-2 py-1 rounded-full shrink-0"><ArrowDownRight size={16}/> Cần chú ý</span>
                 </div>
                 <p className="text-xs text-gray-400 mt-2 break-words">Phần trăm khách hàng đã hết hạn và chưa gia hạn</p>
               </div>
             </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Biểu Đồ Doanh Thu</h2>
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

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold mb-6 text-gray-800">Tỷ Lệ Gói Tập</h2>
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="w-full md:w-1/3 space-y-4">
                 {packageData.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div 
                           className="w-4 h-4 rounded-full" 
                           style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        ></div>
                        <span className="font-medium text-gray-700">{entry.name}</span>
                      </div>
                    </div>
                 ))}
              </div>

              <div className="w-full md:w-2/3 h-[300px] relative">
                {renderCharts ? (
                  <ResponsiveContainer width="100%" height={300} minWidth={1}>
                    <PieChart>
                      <Pie
                        data={packageData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={120}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                      >
                        {packageData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
                    Đang tải biểu đồ tỷ lệ gói tập...
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="text-orange-500" />
              <h2 className="text-xl font-bold text-gray-800">Sắp Hết Hạn (Trong 14 ngày tới)</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="p-3 font-medium text-gray-600">Khách Hàng</th>
                    <th className="p-3 font-medium text-gray-600">Số Điện Thoại</th>
                    <th className="p-3 font-medium text-gray-600">Gói Tập</th>
                    <th className="p-3 font-medium text-gray-600">Ngày Hết Hạn</th>
                    <th className="p-3 font-medium text-gray-600">Buổi Còn Lại</th>
                  </tr>
                </thead>
                <tbody>
                  {expiringMembers.length > 0 ? (
                    expiringMembers.map((member) => (
                      <tr key={member._id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <div className="font-medium text-gray-800">{member.name}</div>
                        </td>
                        <td className="p-3">{member.phone}</td>
                        <td className="p-3">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                            {member.packageType}
                          </span>
                        </td>
                        <td className="p-3 text-red-600 font-bold">
                          {new Date(member.endDate).toLocaleDateString("vi-VN")}
                        </td>
                        <td className="p-3 font-semibold">{member.remainingSessions}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="p-4 text-center text-gray-500">
                        Không có thành viên nào sắp hết hạn trong 14 ngày tới.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Doanh thu nâng cao Tab */}
      {activeTab === 'revenue-advanced' && (
        <div className="space-y-6">
          {loadingAdvanced ? (
            <div className="text-center py-10 text-gray-500">Đang tải dữ liệu doanh thu nâng cao...</div>
          ) : revenueAdvanced ? (
            <>
              {/* Cards comparisons */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-xs font-bold uppercase mb-1">Doanh thu tháng này</p>
                    <p className="text-2xl font-black text-gray-800">{formatCurrency(revenueAdvanced.totalRevenue)}</p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-full text-blue-600">
                    <DollarSign size={24} />
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-xs font-bold uppercase mb-1">So với tháng trước (MoM)</p>
                    <p className="text-2xl font-black text-gray-800">{formatCurrency(revenueAdvanced.compareLastMonth?.value)}</p>
                    <span className={`inline-flex items-center text-xs font-bold mt-1 px-2 py-0.5 rounded-full ${
                      revenueAdvanced.compareLastMonth?.growthPercent >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                    }`}>
                      {revenueAdvanced.compareLastMonth?.growthPercent >= 0 ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
                      {revenueAdvanced.compareLastMonth?.growthPercent}%
                    </span>
                  </div>
                  <div className={`p-3 rounded-full ${revenueAdvanced.compareLastMonth?.growthPercent >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                    <TrendingUp size={24} />
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-xs font-bold uppercase mb-1">So với năm ngoái (YoY)</p>
                    <p className="text-2xl font-black text-gray-800">{formatCurrency(revenueAdvanced.compareLastYear?.value)}</p>
                    <span className={`inline-flex items-center text-xs font-bold mt-1 px-2 py-0.5 rounded-full ${
                      revenueAdvanced.compareLastYear?.growthPercent >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                    }`}>
                      {revenueAdvanced.compareLastYear?.growthPercent >= 0 ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
                      {revenueAdvanced.compareLastYear?.growthPercent}%
                    </span>
                  </div>
                  <div className="bg-violet-50 p-3 rounded-full text-violet-600">
                    <Calendar size={24} />
                  </div>
                </div>
              </div>

              {/* Charts grid */}
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
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {revenueAdvanced.sources.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => formatCurrency(v)} />
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
          ) : (
            <div className="text-center py-10 text-gray-400">Không tìm thấy dữ liệu báo cáo</div>
          )}
        </div>
      )}

      {/* Nhân viên & Lương Tab */}
      {activeTab === 'hr-summary' && (
        <div className="space-y-6">
          {loadingAdvanced ? (
            <div className="text-center py-10 text-gray-500">Đang tải báo cáo lương nhân viên...</div>
          ) : hrSummary.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b bg-gray-50">
                <h3 className="font-bold text-gray-800">Bảng lương + Hoa hồng tháng {selectedMonth}/{selectedYear}</h3>
                <p className="text-xs text-gray-400">Ước tính lương cơ bản mặc định 5.000.000 đ kết hợp hoa hồng thực tế đạt được</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50/50 uppercase text-xs font-bold text-gray-500">
                      <th className="p-4">Nhân viên</th>
                      <th className="p-4">Chức vụ</th>
                      <th className="p-4 text-right">Lương cơ bản</th>
                      <th className="p-4 text-right">Hoa hồng đạt</th>
                      <th className="p-4 text-center">Tiến độ KPI</th>
                      <th className="p-4 text-right font-bold text-gray-800">Thực nhận</th>
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
          ) : (
            <div className="text-center py-10 text-gray-400">Không có dữ liệu nhân viên trong tháng này</div>
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
              {/* Thẻ chỉ số phân tích khách hàng */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-5 rounded-xl border border-gray-155 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-gray-400 text-xs font-bold uppercase tracking-wider block">Chi tiêu trung bình / KH</span>
                    <span className="text-2xl font-black text-blue-700 mt-1 block">
                      {formatCurrency(customerAnalytics.arpu)}
                    </span>
                    <span className="text-xs text-gray-400 mt-1 block">Doanh thu trung bình trọn đời của mỗi hội viên</span>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                    <DollarSign size={24} />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-155 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-gray-400 text-xs font-bold uppercase tracking-wider block">Hội viên có PT riêng</span>
                    <span className="text-2xl font-black text-indigo-700 mt-1 block">
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

                <div className="bg-white p-5 rounded-xl border border-gray-155 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-gray-400 text-xs font-bold uppercase tracking-wider block">Hội viên tự tập (Solo)</span>
                    <span className="text-2xl font-black text-green-700 mt-1 block">
                      {customerAnalytics.trainerRatio?.solo || 0} <span className="text-xs text-gray-400 font-normal">người</span>
                    </span>
                    <span className="text-xs text-gray-400 mt-1 block">Hội viên tự tập luyện tự do tại phòng</span>
                  </div>
                  <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center shrink-0">
                    <Users size={24} />
                  </div>
                </div>
              </div>

              {/* Bảng thống kê PT phụ trách */}
              {customerAnalytics.trainerStats && customerAnalytics.trainerStats.length > 0 && (
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-1 text-base">Thống kê khách hàng theo PT phụ trách</h3>
                  <p className="text-xs text-gray-400 mb-4">Số lượng hội viên đang có gói tập active được phụ trách bởi từng PT</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50 uppercase text-xs font-bold text-gray-500">
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
                          label={({ name, value }) => `${name}: ${value} KH`}
                        >
                          {customerAnalytics.gender.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
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

              {/* Hàng biểu đồ 2: Gói tập phổ biến & Nguồn tiếp cận */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-155 shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-4 text-base">Cơ cấu gói tập đang hoạt động</h3>
                  <div className="h-[250px] relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={230}>
                      <PieChart>
                        <Pie
                          data={customerAnalytics.packagePopularity}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          fill="#8884d8"
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value} KH`}
                        >
                          {customerAnalytics.packagePopularity.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-155 shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-4 text-base">Kênh tiếp cận khách hàng (Sources)</h3>
                  <div className="h-[250px] relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={230}>
                      <PieChart>
                        <Pie
                          data={customerAnalytics.sources}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          fill="#8884d8"
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value} KH`}
                        >
                          {customerAnalytics.sources.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Tần suất đi tập trong 30 ngày qua */}
              <div className="bg-white p-6 rounded-xl border border-gray-155 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-2 text-base">Phân khúc tần suất tập luyện của hội viên</h3>
                <p className="text-xs text-gray-400 mb-4">Gom nhóm hội viên dựa trên số ngày đi tập (check-in) thực tế trong 30 ngày qua</p>
                <div className="h-[250px] relative">
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={customerAnalytics.intensity}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} name="Số hội viên" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Inactive list */}
              <div className="bg-white p-6 rounded-xl border border-gray-155 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldAlert className="text-red-500 animate-pulse" />
                  <div>
                    <h3 className="font-bold text-gray-800 text-base">Khách hàng lâu chưa đi tập</h3>
                    <p className="text-xs text-gray-400">Danh sách khách hàng còn hạn gói tập nhưng không có check-in hay dạy PT trong 30 ngày qua</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="p-3 font-medium text-gray-600">Khách hàng</th>
                        <th className="p-3 font-medium text-gray-600">Mã KH</th>
                        <th className="p-3 font-medium text-gray-600">Số điện thoại</th>
                        <th className="p-3 font-medium text-gray-600">Gói tập</th>
                        <th className="p-3 font-medium text-gray-600 text-right">Ngày hết hạn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {customerAnalytics.inactive.length > 0 ? (
                        customerAnalytics.inactive.map((cust) => (
                          <tr key={cust._id} className="hover:bg-red-50/10 transition-colors">
                            <td className="p-3 font-bold text-gray-800">{cust.name}</td>
                            <td className="p-3 text-gray-600 font-mono">{cust.code}</td>
                            <td className="p-3 text-gray-600">{cust.phone}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-bold">
                                {cust.packageType}
                              </span>
                            </td>
                            <td className="p-3 text-right text-red-500 font-bold">
                              {new Date(cust.endDate).toLocaleDateString("vi-VN")}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="p-6 text-center text-gray-500">
                            Tuyệt vời! Không có khách hàng nào bỏ tập lâu ngày.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
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
                <p className="text-gray-500 text-sm break-words">Doanh thu POS (Tháng này)</p>
                <p className="text-2xl font-bold text-green-600 break-words break-all">{inventoryData.posRevenue.toLocaleString()} VND</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full text-green-600 shrink-0">
                <ShoppingCart size={24} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between min-w-0 w-full gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-gray-500 text-sm break-words">Tổng giá trị tồn kho</p>
                <p className="text-2xl font-bold text-blue-600 break-words break-all">{inventoryData.totalStockValue.toLocaleString()} VND</p>
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
                  <tr className="border-b bg-gray-50">
                    <th className="p-3 font-medium text-gray-600">Mã SP</th>
                    <th className="p-3 font-medium text-gray-600">Tên Sản Phẩm</th>
                    <th className="p-3 font-medium text-gray-600">Danh Mục</th>
                    <th className="p-3 font-medium text-gray-600">Giá Bán</th>
                    <th className="p-3 font-medium text-gray-600">Tồn Kho</th>
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
                    <thead className="bg-gray-50 uppercase text-xs font-bold text-gray-500 border-b">
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
    </div>
  );
};

export default Reports;
