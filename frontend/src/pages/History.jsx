import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarRange, Calendar, ChevronDown, Search, History as HistoryIcon, UserPlus, Users, DollarSign, QrCode } from "lucide-react";
import StatCard from "../components/common/StatCard";
// Import từ file service vừa tạo
import { customerService, checkInService } from "../services/customerService";
import reportService from "../services/reportService";
import {
  AreaChart,
  Area,
  XAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  format,
  isSameDay,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  isWithinInterval,
  startOfDay,
  endOfDay,
  subDays,
} from "date-fns";
import { vi } from "date-fns/locale";

const THEME = {
  primary: "#13ec80",
  surfaceDark: "#182c22",
  textLight: "#4c9a73",
};

const History = () => {
  const [searchParams] = useSearchParams();
  const [rawCustomers, setRawCustomers] = useState([]);
  const [rawCheckins, setRawCheckins] = useState([]);
  const [activeMembersCount, setActiveMembersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [chartReady, setChartReady] = useState(false);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState(searchParams.get("filter") || "this_week");
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const [activeDropdown, setActiveDropdown] = useState(null);

  const dropdownRef = useRef(null);
  const chartContainerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Đảm bảo chart container đã mount và có kích thước
  useEffect(() => {
    if (chartContainerRef.current) {
      const timer = setTimeout(() => {
        setChartReady(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Gọi dữ liệu từ Service
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [customersData, checkinsData, summaryData] = await Promise.all([
          customerService.getAll({ limit: 10000 }), // Lấy tất cả khách hàng (giới hạn lớn) để lọc client-side
          checkInService.getAll(),
          reportService.getSummary(),
        ]);
        
        // Handle response format from updated getAll (object with customers array)
        const customers = customersData.customers || (Array.isArray(customersData) ? customersData : []);
        setRawCustomers(customers);
        
        setRawCheckins(Array.isArray(checkinsData) ? checkinsData : []);
        if (summaryData) {
          setActiveMembersCount(summaryData.activeMembers || 0);
        }
      } catch (error) {
        console.error("Lỗi tải dữ liệu:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- Logic tính toán giữ nguyên ---
  const dateRange = useMemo(() => {
    const now = new Date();
    let start, end;
    switch (filterType) {
      case "today":
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case "yesterday":
        const y = subDays(now, 1);
        start = startOfDay(y);
        end = endOfDay(y);
        break;
      case "this_week":
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfDay(now);
        break;
      case "this_month":
        start = startOfMonth(now);
        end = endOfDay(now);
        break;
      case "last_month":
        const lm = subMonths(now, 1);
        start = startOfMonth(lm);
        end = endOfMonth(lm);
        break;
      case "custom":
        if (customRange.start && customRange.end) {
          start = startOfDay(new Date(customRange.start));
          end = endOfDay(new Date(customRange.end));
        }
        break;
      default:
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfDay(now);
    }
    return { start, end };
  }, [filterType, customRange]);

  const filteredCheckins = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return rawCheckins;
    return rawCheckins.filter((c) => {
      try {
        const cDate = new Date(c.time);
        return isWithinInterval(cDate, {
          start: dateRange.start,
          end: dateRange.end,
        });
      } catch {
        return false;
      }
    });
  }, [rawCheckins, dateRange]);

  const stats = useMemo(() => {
    const now = new Date();
    
    // Filter customers who registered (startDate) within the selected range
    const newCustomersInPeriod = rawCustomers.filter((c) => {
        if (!c.startDate) return false;
        try {
            return isWithinInterval(new Date(c.startDate), {
                start: dateRange.start,
                end: dateRange.end
            });
        } catch (e) { return false; }
    });

    const periodCheckins = filteredCheckins.length;
    
    // Revenue from new registrations in period
    const revenue = newCustomersInPeriod.reduce((sum, c) => sum + (Number(c.price) || 0), 0);

    return {
      totalCustomers: newCustomersInPeriod.length,
      activeCustomers: activeMembersCount,
      periodCheckins,
      revenue,
      growth: { total: 0, active: 0, revenue: 0, checkin: 0 },
    };
  }, [rawCustomers, filteredCheckins, dateRange, activeMembersCount]);

  const peakHourData = useMemo(() => {
    const hours = Array(24).fill(0);
    filteredCheckins.forEach((c) => {
      try {
        const h = new Date(c.time).getHours();
        if (!isNaN(h)) hours[h]++;
      } catch (e) {}
    });
    return hours
      .map((count, hour) => ({
        hour: `${hour}h`,
        visitors: count,
        isPeak: count === Math.max(...hours) && count > 0,
      }))
      .filter((_, i) => i >= 6 && i <= 22);
  }, [filteredCheckins]);

  // UI Components Helper
  const formatCurrency = (val) =>
    val >= 1000000
      ? `${(val / 1000000).toFixed(1)}M`
      : val.toLocaleString("vi-VN");
  const formatDateTime = (isoString) => {
    try {
      return format(new Date(isoString), "dd/MM/yyyy HH:mm", { locale: vi });
    } catch {
      return "...";
    }
  };
  const getLabel = () => {
    const labels = {
      today: "Hôm nay",
      yesterday: "Hôm qua",
      this_week: "Tuần này",
      this_month: "Tháng này",
      last_month: "Tháng trước",
      custom: "Tùy chỉnh",
    };
    return labels[filterType] || "Thời gian";
  };

  if (loading && rawCustomers.length === 0)
    return <div className="p-10 text-center">Đang tải dữ liệu...</div>;

  return (
    <div
      className="space-y-6 animate-fade-in font-display pb-10"
      ref={dropdownRef}
    >
      {/* ── Page header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-light dark:bg-surface-dark p-5 rounded-xl border border-border-light dark:border-border-dark shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2.5 text-text-light dark:text-text-dark">
            <HistoryIcon size={24} className="text-primary" /> Lịch sử hoạt động & thống kê
          </h1>
          <p className="text-subtle-light dark:text-subtle-dark text-sm mt-1">
            Theo dõi lưu lượng check-in, số lượng hội viên mới và chỉ số tăng trưởng chi nhánh
          </p>
        </div>

        <div className="flex gap-2 flex-wrap shrink-0">
          {/* Tuần & Ngày */}
          <div className="relative">
            <button
              onClick={() =>
                setActiveDropdown(activeDropdown === "week" ? null : "week")
              }
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-background-light dark:bg-background-dark hover:bg-gray-100 dark:hover:bg-gray-800 border border-border-light dark:border-border-dark text-text-light dark:text-text-dark text-xs md:text-sm font-medium transition-colors cursor-pointer"
            >
              <CalendarRange size={16} />
              Tuần & Ngày
              <ChevronDown size={16} />
            </button>
            {activeDropdown === "week" && (
              <div className="absolute top-full mt-2 right-0 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl z-20 border border-border-light dark:border-border-dark overflow-hidden py-1 text-gray-800 dark:text-gray-200">
                <button
                  onClick={() => {
                    setFilterType("today");
                    setActiveDropdown(null);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-xs font-bold"
                >
                  Hôm nay
                </button>
                <button
                  onClick={() => {
                    setFilterType("yesterday");
                    setActiveDropdown(null);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-xs font-bold"
                >
                  Hôm qua
                </button>
                <button
                  onClick={() => {
                    setFilterType("this_week");
                    setActiveDropdown(null);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-xs font-bold border-t border-border-light dark:border-border-dark"
                >
                  Tuần này
                </button>
              </div>
            )}
          </div>
          {/* Tháng */}
          <div className="relative">
            <button
              onClick={() =>
                setActiveDropdown(activeDropdown === "month" ? null : "month")
              }
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-background-light dark:bg-background-dark hover:bg-gray-100 dark:hover:bg-gray-800 border border-border-light dark:border-border-dark text-text-light dark:text-text-dark text-xs md:text-sm font-medium transition-colors cursor-pointer"
            >
              <Calendar size={16} />
              Tháng
              <ChevronDown size={16} />
            </button>
            {activeDropdown === "month" && (
              <div className="absolute top-full mt-2 right-0 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl z-20 border border-border-light dark:border-border-dark overflow-hidden py-1 text-gray-800 dark:text-gray-200">
                <button
                  onClick={() => {
                    setFilterType("this_month");
                    setActiveDropdown(null);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-xs font-bold"
                >
                  Tháng này
                </button>
                <button
                  onClick={() => {
                    setFilterType("last_month");
                    setActiveDropdown(null);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 text-xs font-bold border-t border-border-light dark:border-border-dark"
                >
                  Tháng trước
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid Thống kê Chuẩn Hóa */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          label="Khách mới đăng ký"
          value={stats.totalCustomers}
          subtitle={`Trong ${getLabel().toLowerCase()}`}
          icon={UserPlus}
          color="emerald"
          loading={loading}
        />
        <StatCard
          label="Khách đang hoạt động"
          value={stats.activeCustomers}
          subtitle="Tổng số hiện tại"
          icon={Users}
          color="blue"
          loading={loading}
        />
        <StatCard
          label={`Doanh thu (${getLabel()})`}
          value={formatCurrency(stats.revenue)}
          subtitle="Từ khách đăng ký mới"
          icon={DollarSign}
          color="primary"
          loading={loading}
        />
        <StatCard
          label={`Lượt Check-in (${getLabel()})`}
          value={stats.periodCheckins}
          subtitle="Lượt ra vào phòng tập"
          icon={QrCode}
          color="purple"
          loading={loading}
        />
      </div>

      {/* Grid Biểu đồ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3 flex flex-col gap-4 rounded-xl border border-border-light dark:border-border-dark p-6 bg-surface-light dark:bg-surface-dark">
          <p className="text-text-light dark:text-text-dark text-base font-medium">
            Lưu lượng khách theo giờ ({getLabel()})
          </p>
          <div
            ref={chartContainerRef}
            className="w-full"
            style={{
              height: "300px",
              minHeight: "300px",
              position: "relative",
            }}
          >
            {chartReady && peakHourData && peakHourData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300} minWidth={1}>
                <BarChart
                  data={peakHourData}
                  barSize={50}
                  margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                >
                  <XAxis
                    dataKey="hour"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#4c9a73", fontSize: 12 }}
                    dy={10}
                  />
                  <RechartsTooltip
                    cursor={{ fill: "transparent" }}
                    contentStyle={{
                      backgroundColor: "#fff",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="visitors" radius={[4, 4, 0, 0]}>
                    {peakHourData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isPeak ? THEME.primary : "#13ec804D"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                {!chartReady
                  ? "Đang tải..."
                  : "Chưa có dữ liệu để hiển thị biểu đồ"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bảng Lịch sử */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
        <div className="p-6 border-b border-border-light dark:border-border-dark flex flex-col sm:flex-row justify-between items-center gap-4">
          <h3 className="text-xl font-bold text-text-light dark:text-text-dark">
            Nhật ký hoạt động ({getLabel()})
          </h3>
          <div className="relative w-full sm:w-auto">
            <Search size={16} className="absolute left-3 top-2.5 text-subtle-light dark:text-subtle-dark" />
            <input
              id="historySearchInput"
              name="historySearch"
              type="text"
              aria-label="Tìm kiếm nhật ký theo tên khách hàng"
              className="w-full sm:w-64 pl-9 pr-4 py-2 text-sm rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark placeholder:text-subtle-light dark:placeholder:text-subtle-dark focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Tìm tên khách hàng..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark uppercase font-bold text-xs border-b border-border-light dark:border-border-dark">
              <tr>
                <th className="p-4">KHÁCH HÀNG</th>
                <th className="p-4">THỜI GIAN</th>
                <th className="p-4">GÓI TẬP</th>
                <th className="p-4 text-right">TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {filteredCheckins
                .filter((i) =>
                  (i.customerName || "")
                    .toLowerCase()
                    .includes(search.toLowerCase())
                )
                .slice(0, 20)
                .map((item) => (
                  <tr
                    key={item._id}
                    className="hover:bg-background-light/50 dark:hover:bg-background-dark/50 transition-colors"
                  >
                    <td className="p-4 font-bold text-text-light dark:text-text-dark">
                      {item.customerName}
                    </td>
                    <td className="p-4 text-text-light dark:text-text-dark font-medium">
                      {formatDateTime(item.time)}
                    </td>
                    <td className="p-4 text-text-light dark:text-text-dark font-medium">
                      {item.packageType || "Vãng lai"}
                    </td>
                    <td className="p-4 text-right">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Thành công
                      </span>
                    </td>
                  </tr>
                ))}
              {rawCheckins.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-subtle-light dark:text-subtle-dark">
                    Chưa có dữ liệu check-in.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default History;
