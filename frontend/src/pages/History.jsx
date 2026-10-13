import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarRange, Calendar, ChevronDown, Search, History as HistoryIcon, UserPlus, Users, DollarSign, QrCode } from "lucide-react";
import StatCard from "../components/common/StatCard";
import PageHeader from "../components/common/PageHeader";
// Import từ file service vừa tạo
import { customerService, checkInService } from "../services/customerService";
import reportService from "../services/reportService";
import {
  XAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  format,
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
  const customRange = useMemo(() => ({
    start: searchParams.get("start") || "",
    end: searchParams.get("end") || "",
  }), [searchParams]);
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
      case "yesterday": {
        const y = subDays(now, 1);
        start = startOfDay(y);
        end = endOfDay(y);
        break;
      }
      case "this_week":
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfDay(now);
        break;
      case "this_month":
        start = startOfMonth(now);
        end = endOfDay(now);
        break;
      case "last_month": {
        const lm = subMonths(now, 1);
        start = startOfMonth(lm);
        end = endOfMonth(lm);
        break;
      }
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
    // Filter customers who registered (startDate) within the selected range
    const newCustomersInPeriod = rawCustomers.filter((c) => {
        if (!c.startDate) return false;
        try {
            return isWithinInterval(new Date(c.startDate), {
                start: dateRange.start,
                end: dateRange.end
            });
        } catch { return false; }
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
      } catch {
        return;
      }
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
      className="space-y-5 animate-fade-in font-display pb-10"
      ref={dropdownRef}
    >
      <PageHeader
        meta="Vận hành"
        title="Lịch sử check-in"
        description="Tra cứu lưu lượng hội viên và phân tích khung giờ hoạt động theo từng giai đoạn."
        icon={HistoryIcon}
        actions={(
        <div className="flex shrink-0 flex-wrap gap-2">
          {/* Tuần & Ngày */}
          <div className="relative">
            <button
              onClick={() =>
                setActiveDropdown(activeDropdown === "week" ? null : "week")
              }
              className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border-light bg-surface-light px-3.5 text-xs font-medium text-text-light transition-colors hover:bg-gray-50 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:hover:bg-white/5 md:text-sm"
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
              className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border-light bg-surface-light px-3.5 text-xs font-medium text-text-light transition-colors hover:bg-gray-50 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:hover:bg-white/5 md:text-sm"
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
        )}
      />

      {/* Grid Thống kê Chuẩn Hóa */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <div className="flex flex-col gap-4 rounded-lg border border-border-light bg-surface-light p-5 dark:border-border-dark dark:bg-surface-dark lg:col-span-3">
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
      <div className="overflow-hidden rounded-lg border border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark">
        <div className="flex flex-col items-center justify-between gap-4 border-b border-border-light p-4 dark:border-border-dark sm:flex-row">
          <h3 className="text-base font-semibold text-text-light dark:text-text-dark">
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
            <thead className="border-b border-border-light bg-background-light text-xs font-medium text-text-muted-light dark:border-border-dark dark:bg-background-dark dark:text-text-muted-dark">
              <tr>
                <th className="p-4">Hội viên</th>
                <th className="p-4">Thời gian</th>
                <th className="p-4">Gói tập</th>
                <th className="p-4 text-right">Trạng thái</th>
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
                    <td className="p-4 font-medium text-text-light dark:text-text-dark">
                      {item.customerName}
                    </td>
                    <td className="p-4 text-text-secondary-light dark:text-text-secondary-dark">
                      {formatDateTime(item.time)}
                    </td>
                    <td className="p-4 text-text-secondary-light dark:text-text-secondary-dark">
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
