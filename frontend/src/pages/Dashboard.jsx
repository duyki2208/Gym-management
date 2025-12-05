import React, { useState, useEffect } from "react";
import {
  Users,
  Activity,
  Check,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Clock,
  LogIn,
  LogOut,
} from "lucide-react";
import { customerService, checkInService } from "../services/customerService";
import { getCustomerStatus } from "../utils/dateUtils";

const Dashboard = () => {
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    expiring: 0,
    todayCheckIns: 0,
    revenue: 0,
  });
  const [peakHours, setPeakHours] = useState([]);
  const [activities, setActivities] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const customers = await customerService.getAll();
        const checkIns = await checkInService.getAll();

        // Đảm bảo customers và checkIns là mảng
        const customersArray = Array.isArray(customers) ? customers : [];
        const checkInsArray = Array.isArray(checkIns) ? checkIns : [];

        const todayStr = new Date().toDateString();

        setStats({
          total: customersArray.length,
          active: customersArray.filter(
            (c) => c && getCustomerStatus(c.endDate).status === "active"
          ).length,
          expiring: customersArray.filter(
            (c) => c && getCustomerStatus(c.endDate).status === "expiring"
          ).length,
          todayCheckIns: checkInsArray.filter(
            (ci) =>
              ci && ci.time && new Date(ci.time).toDateString() === todayStr
          ).length,
          revenue: checkInsArray.length * 25000, // Ước tính doanh thu
        });

        // Tính giờ cao điểm
        const hoursCount = new Array(24).fill(0);
        checkInsArray.forEach((ci) => {
          if (ci && ci.time) {
            try {
              const hour = new Date(ci.time).getHours();
              if (!isNaN(hour) && hour >= 0 && hour < 24) {
                hoursCount[hour]++;
              }
            } catch (e) {
              console.error("Lỗi xử lý thời gian check-in:", e);
            }
          }
        });
        setPeakHours(
          hoursCount.slice(6, 22).map((count, i) => ({ hour: i + 6, count }))
        );

        // Top khách hàng
        const customerFrequency = {};
        checkInsArray.forEach((ci) => {
          if (ci && ci.customerName) {
            customerFrequency[ci.customerName] =
              (customerFrequency[ci.customerName] || 0) + 1;
          }
        });
        const sortedTop = Object.entries(customerFrequency)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        setTopCustomers(sortedTop);

        // Lấy hoạt động gần đây
        const recentActivities = checkInsArray
          .filter((ci) => ci && ci.time && ci.customerName)
          .slice(0, 5)
          .map((ci) => ({
            customerName: ci.customerName,
            time: new Date(ci.time).toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            type: ci.type || "in",
          }));
        setActivities(recentActivities);
      } catch (error) {
        console.error("Lỗi tải dữ liệu Dashboard:", error);
        // Đặt giá trị mặc định để tránh crash
        setStats({
          total: 0,
          active: 0,
          expiring: 0,
          todayCheckIns: 0,
          revenue: 0,
        });
        setPeakHours([]);
        setActivities([]);
        setTopCustomers([]);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-text-light dark:text-text-dark text-4xl font-black leading-tight tracking-[-0.033em]">
          Tổng quan
        </h1>
        <p className="text-subtle-light dark:text-subtle-dark text-base font-normal"></p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Tổng khách hàng"
          value={stats.total}
          change="+12%"
          type="positive"
          icon={Users}
        />
        <StatCard
          label="Đang hoạt động"
          value={stats.active}
          change="+5%"
          type="positive"
          icon={Check}
        />
        <StatCard
          label="Doanh thu tháng"
          value={`${(stats.revenue / 1000000).toFixed(1)}M`}
          change="-2.5%"
          type="negative"
          icon={DollarSign}
        />
        <StatCard
          label="Lượt ra vào hôm nay"
          value={stats.todayCheckIns}
          change="+10%"
          type="positive"
          icon={Activity}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Biểu đồ Giờ cao điểm */}
        <div className="lg:col-span-2 p-6 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark">
          <div className="flex items-center gap-2 mb-6">
            <Clock className="text-primary" size={20} />
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark">
              Lượng khách checkin
            </h3>
          </div>
          <div className="h-64 flex items-end justify-between gap-2 border-b border-gray-100 pb-2">
            {peakHours.map((h, i) => {
              const max = Math.max(...peakHours.map((p) => p.count)) || 1;
              const height = (h.count / max) * 100;
              return (
                <div
                  key={i}
                  className="flex flex-col items-center flex-1 gap-2 group relative h-full justify-end"
                >
                  <div className="absolute -top-8 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    {h.count}
                  </div>
                  <div
                    className={`w-full rounded-t-sm transition-all duration-500 ${
                      h.count > 0
                        ? "bg-primary/80 hover:bg-primary"
                        : "bg-gray-100 dark:bg-gray-700"
                    }`}
                    style={{ height: `${height}%` }}
                  ></div>
                  <span className="text-[10px] text-gray-400">{h.hour}h</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hoạt động gần đây - ĐÃ CẬP NHẬT LOGIC ICON */}
        <div className="p-6 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark">
          <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">
            Hoạt động gần đây
          </h3>
          <div className="space-y-4">
            {activities.length > 0 ? (
              activities.map((act, i) => {
                // Xác định loại hoạt động (Mặc định là 'in' nếu dữ liệu cũ không có type)
                const isCheckIn = act.type !== "out";

                return (
                  <div
                    key={i}
                    className="flex items-center gap-4 p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <div
                      className={`flex items-center justify-center size-10 rounded-full shrink-0 ${
                        isCheckIn
                          ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                      }`}
                    >
                      {isCheckIn ? <LogIn size={18} /> : <LogOut size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-text-light dark:text-text-dark truncate">
                        {act.customerName}
                      </p>
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-xs font-medium ${
                            isCheckIn ? "text-green-600" : "text-orange-600"
                          }`}
                        >
                          {isCheckIn ? "Đã vào phòng tập" : "Đã ra về"}
                        </span>
                        <span className="text-xs text-gray-400">
                          • {act.time}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-text-muted-light dark:text-text-muted-dark text-sm text-center py-4">
                Chưa có hoạt động nào.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, change, type, icon: Icon }) => (
  <div className="flex flex-col gap-2 rounded-lg p-6 border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark relative overflow-hidden group">
    <div className="absolute right-4 top-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-300">
      <Icon size={64} />
    </div>
    <p className="text-text-muted-light dark:text-text-muted-dark text-sm font-bold uppercase tracking-wider">
      {label}
    </p>
    <div className="flex items-baseline gap-2 z-10">
      <p className="text-text-light dark:text-text-dark tracking-tight text-3xl font-black">
        {value}
      </p>
      {change && (
        <span
          className={`text-sm font-bold ${
            type === "positive" ? "text-green-500" : "text-red-500"
          }`}
        >
          {change}
        </span>
      )}
    </div>
  </div>
);

export default Dashboard;
