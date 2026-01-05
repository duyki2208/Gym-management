import React, { useState, useEffect } from "react";
import {
  Users,
  Activity,
  Check,
  DollarSign,
  Clock,
  LogIn,
  LogOut,
  Loader2,
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
  const [loading, setLoading] = useState(true);
  
  // State lưu thông tin user và quyền
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Lấy thông tin User từ key 'gym_user' (khớp với authService.js)
    const storedUser = localStorage.getItem("gym_user");
    if (storedUser) {
      try {
        const userObj = JSON.parse(storedUser);
        setCurrentUser(userObj);
        // Kiểm tra quyền (giả sử role='admin')
        setIsAdmin(userObj.role === "admin");
      } catch (e) {
        console.error("Lỗi parse user:", e);
      }
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await customerService.getDashboardStats();
        
        if (data) {
          setStats({
            total: data.total,
            active: data.active,
            expiring: data.expiring,
            todayCheckIns: data.todayCheckIns,
            revenue: data.revenue,
          });
          setPeakHours(data.peakHours);
          
          setActivities(data.recentActivities.map(act => ({
             id: act._id,
             customerName: act.customerName,
             time: act.time ? new Date(act.time).toLocaleTimeString("vi-VN", {
               hour: "2-digit",
               minute: "2-digit"
             }) : "--:--",
             type: act.type || "in"
          })));
        }

      } catch (error) {
        console.error("Lỗi tải Dashboard:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-full">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-2 md:p-0">
      <div className="flex flex-col gap-2">
        <h1 className="text-text-light dark:text-text-dark text-4xl font-black leading-tight tracking-[-0.033em]">
          Tổng quan
        </h1>
        
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Tổng khách hàng"
          value={stats.total}
          change="+Members"
          type="positive"
          icon={Users}
          colorClass="text-blue-600 bg-blue-100 dark:bg-blue-900/30"
        />
        <StatCard
          label="Đang hoạt động"
          value={stats.active}
          change="Active"
          type="positive"
          icon={Check}
          colorClass="text-green-600 bg-green-100 dark:bg-green-900/30"
        />
        
        {/* --- PHÂN QUYỀN: Chỉ Admin mới thấy Doanh thu --- */}
        {isAdmin ? (
          <StatCard
            label="Doanh thu tháng"
            value={`${(stats.revenue / 1000000).toFixed(1)}M`}
            change="VNĐ"
            type="neutral"
            icon={DollarSign}
            colorClass="text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30"
          />
        ) : (
          <StatCard
            label="Sắp hết hạn"
            value={stats.expiring}
            change="Cần gia hạn"
            type="negative"
            icon={Clock}
            colorClass="text-red-600 bg-red-100 dark:bg-red-900/30"
          />
        )}

        <StatCard
          label="Lượt check-in"
          value={stats.todayCheckIns}
          change="Hôm nay"
          type="positive"
          icon={Activity}
          colorClass="text-purple-600 bg-purple-100 dark:bg-purple-900/30"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Biểu đồ Giờ cao điểm */}
        <div className="lg:col-span-2 p-6 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark shadow-sm">
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
                    style={{ height: `${height || 2}%` }}
                  ></div>
                  <span className="text-[10px] text-gray-400">{h.hour}h</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hoạt động gần đây */}
        <div className="p-6 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark shadow-sm">
          <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">
            Hoạt động gần đây
          </h3>
          <div className="space-y-4">
            {activities.length > 0 ? (
              activities.map((act, i) => {
                const isCheckIn = act.type !== "out";
                return (
                  <div
                    key={act.id}
                    className="flex items-center gap-4 p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors border-b border-gray-50 dark:border-gray-800 last:border-0"
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
                        <span className={`text-xs font-medium ${isCheckIn ? "text-green-600" : "text-orange-600"}`}>
                          {isCheckIn ? "Vào" : "Ra"}
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

const StatCard = ({ label, value, change, type, icon: Icon, colorClass }) => (
  <div className="flex flex-col gap-2 rounded-lg p-6 border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark relative overflow-hidden group shadow-sm hover:shadow-md transition-all">
    <div className={`absolute right-4 top-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-300 ${colorClass ? colorClass.split(' ')[0] : ''}`}>
      <Icon size={64} />
    </div>
    
    <div className="flex items-center gap-2 mb-2">
        <div className={`p-2 rounded-md ${colorClass || 'bg-gray-100 text-gray-600'}`}>
            <Icon size={20} />
        </div>
        <p className="text-text-muted-light dark:text-text-muted-dark text-sm font-bold uppercase tracking-wider">
        {label}
        </p>
    </div>

    <div className="flex items-baseline gap-2 z-10">
      <p className="text-text-light dark:text-text-dark tracking-tight text-3xl font-black">
        {value}
      </p>
      {change && (
        <span
          className={`text-sm font-bold ${
            type === "positive" ? "text-green-500" : type === "negative" ? "text-red-500" : "text-gray-500"
          }`}
        >
          {change}
        </span>
      )}
    </div>
  </div>
);

export default Dashboard;