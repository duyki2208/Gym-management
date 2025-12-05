import React, { useState, useEffect, useMemo, useRef } from "react";
// Import từ file service vừa tạo
import { customerService, checkInService } from "../services/customerService";
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
  const [rawCustomers, setRawCustomers] = useState([]);
  const [rawCheckins, setRawCheckins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartReady, setChartReady] = useState(false);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("this_week");
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
        const [customersData, checkinsData] = await Promise.all([
          customerService.getAll(),
          checkInService.getAll(),
        ]);
        setRawCustomers(Array.isArray(customersData) ? customersData : []);
        setRawCheckins(Array.isArray(checkinsData) ? checkinsData : []);
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
    const totalCustomers = rawCustomers.length;
    const activeCustomers = rawCustomers.filter(
      (c) => c.endDate && new Date(c.endDate) >= now
    ).length;
    const periodCheckins = filteredCheckins.length;
    const estimatedRevenue = periodCheckins * 25000;
    return {
      totalCustomers,
      activeCustomers,
      periodCheckins,
      revenue: estimatedRevenue,
      growth: { total: 0, active: 0, revenue: 0, checkin: 0 },
    };
  }, [rawCustomers, filteredCheckins]);

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

  const StatCard = ({ title, value, subText }) => (
    <div className="flex flex-col gap-2 rounded-xl bg-surface-light dark:bg-surface-dark p-6 border border-border-light dark:border-border-dark shadow-sm">
      <p className="text-text-light dark:text-text-dark text-base font-medium">
        {title}
      </p>
      <p className="text-text-light dark:text-text-dark text-3xl font-bold">
        {value}
      </p>
      <p className="text-sm text-gray-500 font-medium">{subText}</p>
    </div>
  );

  if (loading && rawCustomers.length === 0)
    return <div className="p-10 text-center">Đang tải dữ liệu...</div>;

  return (
    <div
      className="space-y-6 animate-fade-in font-display pb-10"
      ref={dropdownRef}
    >
      {/* Header & Filters */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-3xl font-black text-text-light dark:text-text-dark">
          Lịch sử & Thống kê
        </h1>
        <div className="flex gap-2">
          {/* Tuần & Ngày */}
          <div className="relative">
            <button
              onClick={() =>
                setActiveDropdown(activeDropdown === "week" ? null : "week")
              }
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                ["today", "yesterday", "this_week"].includes(filterType)
                  ? "bg-green-100 border-green-200 text-green-700"
                  : "bg-white dark:bg-gray-800 border-border-light text-gray-600"
              }`}
            >
              <span className="material-symbols-outlined text-lg">
                calendar_view_week
              </span>{" "}
              Tuần & Ngày{" "}
              <span className="material-symbols-outlined text-lg">
                expand_more
              </span>
            </button>
            {activeDropdown === "week" && (
              <div className="absolute top-full mt-2 right-0 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl z-10 border border-gray-100 overflow-hidden">
                <button
                  onClick={() => {
                    setFilterType("today");
                    setActiveDropdown(null);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm"
                >
                  Hôm nay
                </button>
                <button
                  onClick={() => {
                    setFilterType("yesterday");
                    setActiveDropdown(null);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm"
                >
                  Hôm qua
                </button>
                <button
                  onClick={() => {
                    setFilterType("this_week");
                    setActiveDropdown(null);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm border-t"
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
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                ["this_month", "last_month"].includes(filterType)
                  ? "bg-green-100 border-green-200 text-green-700"
                  : "bg-white dark:bg-gray-800 border-border-light text-gray-600"
              }`}
            >
              <span className="material-symbols-outlined text-lg">
                calendar_month
              </span>{" "}
              Tháng{" "}
              <span className="material-symbols-outlined text-lg">
                expand_more
              </span>
            </button>
            {activeDropdown === "month" && (
              <div className="absolute top-full mt-2 right-0 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl z-10 border border-gray-100 overflow-hidden">
                <button
                  onClick={() => {
                    setFilterType("this_month");
                    setActiveDropdown(null);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm"
                >
                  Tháng này
                </button>
                <button
                  onClick={() => {
                    setFilterType("last_month");
                    setActiveDropdown(null);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm border-t"
                >
                  Tháng trước
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid Thống kê */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Tổng khách hàng"
          value={stats.totalCustomers}
          subText="Tổng số lượng đăng ký"
        />
        <StatCard
          title="Khách đang hoạt động"
          value={stats.activeCustomers}
          subText="Khách còn hạn gói tập"
        />
        <StatCard
          title={`Doanh thu (${getLabel()})`}
          value={formatCurrency(stats.revenue)}
          subText="Dựa trên lượt check-in"
        />
        <StatCard
          title={`Lượt Check-in (${getLabel()})`}
          value={stats.periodCheckins}
          subText="Lượt ra vào"
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
              <ResponsiveContainer width="100%" height={300}>
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
          <h3 className="text-lg font-bold text-text-light dark:text-text-dark">
            Nhật ký hoạt động
          </h3>
          <div className="relative w-full sm:w-auto">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-sm">
              search
            </span>
            <input
              className="w-full sm:w-64 pl-9 pr-4 py-2 text-sm rounded-lg border border-border-light bg-background-light dark:bg-background-dark focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Tìm tên khách hàng..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 uppercase">
              <tr>
                <th className="p-4">Khách hàng</th>
                <th className="p-4">Thời gian</th>
                <th className="p-4">Gói tập</th>
                <th className="p-4 text-right">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rawCheckins
                .filter((i) =>
                  (i.customerName || "")
                    .toLowerCase()
                    .includes(search.toLowerCase())
                )
                .slice(0, 20)
                .map((item) => (
                  <tr
                    key={item._id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="p-4 font-medium text-text-light dark:text-text-dark">
                      {item.customerName}
                    </td>
                    <td className="p-4 text-gray-500">
                      {formatDateTime(item.time)}
                    </td>
                    <td className="p-4 text-text-light dark:text-text-dark">
                      {item.packageType || "Vãng lai"}
                    </td>
                    <td className="p-4 text-right">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        Thành công
                      </span>
                    </td>
                  </tr>
                ))}
              {rawCheckins.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-gray-400">
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
