import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Users,
  Activity,
  DollarSign,
  Clock,
  LogIn,
  LogOut,
  Loader2,
  ClipboardList,
  Plus,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Dumbbell,
  TrendingUp,
  Sparkles,
  Coins,
  Trophy,
} from "lucide-react";
import { customerService } from "../services/customerService";
import { teamTaskService } from "../services/teamTaskService";
import { useQuery } from '@tanstack/react-query';
import toast from "react-hot-toast";
import { useConfirm } from "../context/ConfirmContext";

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const confirm = useConfirm();
  
  // State quản lý Modals
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [showNewCustomersModal, setShowNewCustomersModal] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);

  useEffect(() => {
    if (searchParams.get("openTasks") === "true") {
      setShowTasksModal(true);
      // Xóa param ra khỏi url để tránh bị mở lại khi reload trang
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("openTasks");
      setSearchParams(newParams);
    }
  }, [searchParams, setSearchParams]);

  // Sử dụng React Query để tự động tải và polling dữ liệu
  const { data: dashboardData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const response = await customerService.getDashboardStats();
      if (!response || !response.success) {
        throw new Error(response?.message || "Không thể tải dữ liệu thống kê");
      }
      return response.data;
    },
    refetchInterval: 5000, // Polling mỗi 5 giây để cập nhật lượt check-in thời gian thực
    refetchIntervalInBackground: true,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)] w-full">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)] w-full text-red-500 font-bold">
        <p>Lỗi tải dữ liệu: {error.message}</p>
      </div>
    );
  }

  const stats = {
    revenue: dashboardData?.revenue || 0,
    targetRevenue: dashboardData?.targetRevenue || 100000000,
    revenuePercentage: dashboardData?.revenuePercentage || 0,
    newCustomersThisMonth: dashboardData?.newCustomersThisMonth || 0,
    newCustomersList: dashboardData?.newCustomersList || [],
    todayCheckIns: dashboardData?.todayCheckIns || 0,
    yesterdayCheckIns: dashboardData?.yesterdayCheckIns || 0,
    checkInChange: dashboardData?.checkInChange || 0,
    weeklyRevenue: dashboardData?.weeklyRevenue || [],
    pendingTasksCount: dashboardData?.pendingTasksCount || 0,
    upcomingTask: dashboardData?.upcomingTask || null,
  };
  
  const peakHours = dashboardData?.peakHours || [];
  
  const activities = (dashboardData?.recentActivities || []).map(act => ({
     id: act.id || act._id,
     customerName: act.customerName,
     time: act.time ? new Date(act.time).toLocaleTimeString("vi-VN", {
       hour: "2-digit",
       minute: "2-digit"
     }) : "--:--",
     type: act.type || "in"
  }));

  // Định dạng chuỗi so sánh lượt check-in với ngày hôm qua theo yêu cầu
  const checkInChangeText = stats.checkInChange > 0 
    ? `+${stats.checkInChange} so với ngày hôm qua` 
    : stats.checkInChange < 0 
      ? `${stats.checkInChange} so với ngày hôm qua`
      : "Bằng với ngày hôm qua";

  const handleCardClick = (cardType) => {
    if (cardType === "revenue") {
      setShowRevenueModal(true);
    } else if (cardType === "newCustomers") {
      setShowNewCustomersModal(true);
    } else if (cardType === "checkIn") {
      navigate('/history?filter=this_week');
    } else if (cardType === "tasks") {
      setShowTasksModal(true);
    }
  };

  if (dashboardData?.isPT) {
    const ptStats = dashboardData.ptStats;
    const ptRemaining = ptStats.target - ptStats.achieved;

    return (
      <div className="flex flex-col gap-6">
        {/* Tầng 1: KPI Cards cho PT */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Buổi dạy tháng này"
            value={`${ptStats.achieved} / ${ptStats.target}`}
            change={`Đạt ${ptStats.percentage}% chỉ tiêu`}
            type={ptStats.percentage >= 100 ? "positive" : "warning"}
            icon={Dumbbell}
            colorClass="text-blue-600 bg-blue-100 dark:bg-blue-900/30 border-blue-200/50 hover:bg-blue-50/50"
          />
          <StatCard
            label="Khách đang phụ trách"
            value={ptStats.activeClients}
            change="Hội viên đang hoạt động"
            type="positive"
            icon={Users}
            colorClass="text-green-600 bg-green-100 dark:bg-green-900/30 border-green-200/50 hover:bg-green-50/50"
          />
          <StatCard
            label="Khách mới tháng này"
            value={ptStats.newClients}
            change="Mới nhận trong tháng"
            type="positive"
            icon={TrendingUp}
            colorClass="text-purple-600 bg-purple-100 dark:bg-purple-900/30 border-purple-200/50 hover:bg-purple-50/50"
          />
          <StatCard
            label="Ghi chú ca trực"
            value={
              stats.upcomingTask 
                ? `Lúc ${stats.upcomingTask.timeSlot}` 
                : stats.pendingTasksCount > 0 
                  ? `${stats.pendingTasksCount} việc` 
                  : "Hoàn thành"
            }
            change={
              stats.upcomingTask 
                ? `Cần làm: ${stats.upcomingTask.task}` 
                : stats.pendingTasksCount > 0 
                  ? "Việc chưa làm hôm nay" 
                  : "Đã làm hết việc hôm nay"
            }
            type={stats.upcomingTask ? "negative" : stats.pendingTasksCount > 0 ? "warning" : "positive"}
            icon={ClipboardList}
            colorClass={
              stats.upcomingTask 
                ? "text-red-600 bg-red-100 dark:bg-red-900/30 border-red-200/50 hover:bg-red-50/50 animate-pulse font-extrabold" 
                : "text-orange-600 bg-orange-100 dark:bg-orange-900/30 border-orange-200/50 hover:bg-orange-50/50"
            }
            onClick={() => handleCardClick("tasks")}
          />
        </div>

        {/* Tầng 2: Buổi dạy gần đây & KPI Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-6 rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark shadow-sm">
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">
              Lịch sử các buổi dạy gần đây
            </h3>
            <div className="space-y-4">
              {activities.length > 0 ? (
                activities.map((act) => (
                  <div key={act.id} className="flex items-center gap-4 p-3 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors border-b border-gray-50 dark:border-gray-800 last:border-0">
                    <div className="flex items-center justify-center size-10 rounded-full shrink-0 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                      <Dumbbell size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-text-light dark:text-text-dark truncate">
                        {act.customerName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {act.note || "Dạy buổi tập"} • Lúc {act.time}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-text-muted-light text-sm text-center py-4">Chưa dạy buổi nào trong hôm nay.</p>
              )}
            </div>
          </div>

          <div className="p-6 rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark shadow-sm flex flex-col gap-6">
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark">
              Tiến trình & Cảnh báo chỉ tiêu
            </h3>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-medium">
                <span className="text-gray-500">Chỉ tiêu buổi dạy</span>
                <span className="font-bold">{ptStats.achieved} / {ptStats.target} buổi ({ptStats.percentage}%)</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 h-3 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, ptStats.percentage)}%` }}></div>
              </div>
            </div>

            <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30 text-sm">
              <p className="font-bold text-blue-700 dark:text-blue-400 mb-1 flex items-center gap-1">
                <Sparkles size={16} /> Tỷ lệ giữ chân khách
              </p>
              <p className="text-gray-600 dark:text-gray-300">Tỷ lệ giữ chân khách hàng hiện tại của bạn đạt: <strong className="text-blue-600 font-bold">{ptStats.retentionRate}%</strong></p>
            </div>

            <div className={`p-4 rounded-xl border text-sm ${ptRemaining <= 0 ? 'bg-green-50/50 border-green-100 text-green-700' : 'bg-yellow-50/50 border-yellow-100 text-yellow-700'}`}>
              <p className="font-bold mb-1">Cảnh báo KPI</p>
              {ptRemaining <= 0 ? (
                <p>Chúc mừng! Bạn đã hoàn thành chỉ tiêu dạy học của tháng này! 🎉</p>
              ) : (
                <p>Còn <strong className="font-bold">{dashboardData.daysLeft} ngày</strong> trong tháng này. Bạn cần dạy thêm <strong className="font-bold">{ptRemaining} buổi</strong> nữa để đạt mục tiêu.</p>
              )}
            </div>
          </div>
        </div>

        {/* Modal công việc ca trực */}
        {showTasksModal && (
          <TeamTasksModal 
            onClose={() => {
              setShowTasksModal(false);
              refetch(); // Tải lại số lượng tasks trên Card Dashboard
            }}
          />
        )}
      </div>
    );
  }

  if (dashboardData?.isSale) {
    const saleStats = dashboardData.saleStats;
    const revRemaining = saleStats.revenue.target - saleStats.revenue.achieved;

    return (
      <div className="flex flex-col gap-6">
        {/* Tầng 1: KPI Cards cho Sale */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Doanh số chốt tháng này"
            value={`${saleStats.revenue.achieved.toLocaleString("vi-VN")} đ`}
            change={`Đạt ${saleStats.revenue.percentage}% chỉ tiêu`}
            type={saleStats.revenue.percentage >= 100 ? "positive" : "warning"}
            icon={DollarSign}
            colorClass="text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200/50 hover:bg-emerald-50/50"
          />
          <StatCard
            label="Hợp đồng mới tháng này"
            value={`${saleStats.newContracts.achieved} / ${saleStats.newContracts.target}`}
            change={`Đạt ${saleStats.newContracts.percentage}% mục tiêu`}
            type={saleStats.newContracts.percentage >= 100 ? "positive" : "warning"}
            icon={Users}
            colorClass="text-blue-600 bg-blue-100 dark:bg-blue-900/30 border-blue-200/50 hover:bg-blue-50/50"
          />
          <StatCard
            label="Gói gia hạn tháng này"
            value={`${saleStats.renewContracts.achieved} / ${saleStats.renewContracts.target}`}
            change={`Đạt ${saleStats.renewContracts.percentage}% mục tiêu`}
            type={saleStats.renewContracts.percentage >= 100 ? "positive" : "warning"}
            icon={Activity}
            colorClass="text-purple-600 bg-purple-100 dark:bg-purple-900/30 border-purple-200/50 hover:bg-purple-50/50"
          />
          <StatCard
            label="Ghi chú ca trực"
            value={
              stats.upcomingTask 
                ? `Lúc ${stats.upcomingTask.timeSlot}` 
                : stats.pendingTasksCount > 0 
                  ? `${stats.pendingTasksCount} việc` 
                  : "Hoàn thành"
            }
            change={
              stats.upcomingTask 
                ? `Cần làm: ${stats.upcomingTask.task}` 
                : stats.pendingTasksCount > 0 
                  ? "Việc chưa làm hôm nay" 
                  : "Đã làm hết việc hôm nay"
            }
            type={stats.upcomingTask ? "negative" : stats.pendingTasksCount > 0 ? "warning" : "positive"}
            icon={ClipboardList}
            colorClass={
              stats.upcomingTask 
                ? "text-red-600 bg-red-100 dark:bg-red-900/30 border-red-200/50 hover:bg-red-50/50 animate-pulse font-extrabold" 
                : "text-orange-600 bg-orange-100 dark:bg-orange-900/30 border-orange-200/50 hover:bg-orange-50/50"
            }
            onClick={() => handleCardClick("tasks")}
          />
        </div>

        {/* Tầng 2: Hợp đồng gần đây & KPI Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-6 rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark shadow-sm">
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">
              Lịch sử chốt hợp đồng gần đây
            </h3>
            <div className="space-y-4">
              {activities.length > 0 ? (
                activities.map((act) => (
                  <div key={act.id} className="flex items-center gap-4 p-3 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors border-b border-gray-50 dark:border-gray-800 last:border-0">
                    <div className="flex items-center justify-center size-10 rounded-full shrink-0 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <Coins size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-text-light dark:text-text-dark truncate">
                        {act.customerName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {act.note} • Lúc {act.time}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-text-muted-light text-sm text-center py-4">Chưa chốt hợp đồng nào hôm nay.</p>
              )}
            </div>
          </div>

          <div className="p-6 rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark shadow-sm flex flex-col gap-6">
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark">
              Tiến trình KPI & Doanh số
            </h3>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-medium">
                <span className="text-gray-500">Chỉ tiêu doanh số</span>
                <span className="font-bold">{saleStats.revenue.achieved.toLocaleString()} / {saleStats.revenue.target.toLocaleString()} đ ({saleStats.revenue.percentage}%)</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 h-3 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, saleStats.revenue.percentage)}%` }}></div>
              </div>
            </div>

            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/30 text-sm flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-800 rounded-lg text-emerald-700 dark:text-emerald-300">
                <Trophy size={20} />
              </div>
              <div>
                <p className="font-bold text-emerald-800 dark:text-emerald-400">Động lực chốt Sale</p>
                <p className="text-xs text-gray-600 dark:text-gray-300">Mỗi hợp đồng mới chốt được tính hoa hồng trực tiếp theo % cấu hình.</p>
              </div>
            </div>

            <div className={`p-4 rounded-xl border text-sm ${revRemaining <= 0 ? 'bg-green-50/50 border-green-100 text-green-700' : 'bg-yellow-50/50 border-yellow-100 text-yellow-700'}`}>
              <p className="font-bold mb-1">Cảnh báo KPI</p>
              {revRemaining <= 0 ? (
                <p>Chúc mừng! Bạn đã hoàn thành chỉ tiêu doanh số của tháng này! 🎉</p>
              ) : (
                <p>Còn <strong className="font-bold">{dashboardData.daysLeft} ngày</strong>. Bạn cần chốt thêm <strong className="font-bold">{revRemaining.toLocaleString()} đ</strong> để đạt target.</p>
              )}
            </div>
          </div>
        </div>

        {/* Modal công việc ca trực */}
        {showTasksModal && (
          <TeamTasksModal 
            onClose={() => {
              setShowTasksModal(false);
              refetch(); // Tải lại số lượng tasks trên Card Dashboard
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      
      {/* Tầng 1: KPI Cards cho Nhân viên vận hành */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* 1. Tổng doanh thu tháng này */}
        <StatCard
          label="Doanh thu tháng này"
          value={`${stats.revenue.toLocaleString("vi-VN")} đ`}
          change={`Đạt ${stats.revenuePercentage}% chỉ tiêu`}
          type={stats.revenuePercentage >= 100 ? "positive" : "warning"}
          icon={DollarSign}
          colorClass="text-green-600 bg-green-100 dark:bg-green-900/30 border-green-200/50 hover:bg-green-50/50"
          onClick={() => handleCardClick("revenue")}
        />

        {/* 2. Hội viên mới trong tháng */}
        <StatCard
          label="Hội viên mới tháng này"
          value={stats.newCustomersThisMonth}
          change="Đăng ký mới trong tháng"
          type="positive"
          icon={Users}
          colorClass="text-blue-600 bg-blue-100 dark:bg-blue-900/30 border-blue-200/50 hover:bg-blue-50/50"
          onClick={() => handleCardClick("newCustomers")}
        />
        
        {/* 3. Lượt Check-In hôm nay (độc nhất) */}
        <StatCard
          label="Lượt check-in hôm nay"
          value={stats.todayCheckIns}
          change={checkInChangeText}
          type={stats.checkInChange > 0 ? "positive" : stats.checkInChange < 0 ? "negative" : "muted"}
          icon={Activity}
          colorClass="text-purple-600 bg-purple-100 dark:bg-purple-900/30 border-purple-200/50 hover:bg-purple-50/50"
          onClick={() => handleCardClick("checkIn")}
        />

        {/* 4. Ghi chú ca trực (Todo List) */}
        <StatCard
          label="Ghi chú ca trực"
          value={
            stats.upcomingTask 
              ? `Lúc ${stats.upcomingTask.timeSlot}` 
              : stats.pendingTasksCount > 0 
                ? `${stats.pendingTasksCount} việc` 
                : "Hoàn thành"
          }
          change={
            stats.upcomingTask 
              ? `Cần làm: ${stats.upcomingTask.task}` 
              : stats.pendingTasksCount > 0 
                ? "Việc chưa làm hôm nay" 
                : "Đã làm hết việc hôm nay"
          }
          type={stats.upcomingTask ? "negative" : stats.pendingTasksCount > 0 ? "warning" : "positive"}
          icon={ClipboardList}
          colorClass={
            stats.upcomingTask 
              ? "text-red-600 bg-red-100 dark:bg-red-900/30 border-red-200/50 hover:bg-red-50/50 animate-pulse font-extrabold" 
              : "text-orange-600 bg-orange-100 dark:bg-orange-900/30 border-orange-200/50 hover:bg-orange-50/50"
          }
          onClick={() => handleCardClick("tasks")}
        />
      </div>

      {/* Tầng 2: Biểu đồ check-in theo giờ và Hoạt động gần đây */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Biểu đồ Giờ cao điểm hôm nay (Giữ nguyên cấu trúc bar chart div) */}
        <div className="lg:col-span-2 p-6 rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Clock className="text-primary" size={20} />
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark">
              Khung giờ check-in hôm nay (Giờ cao điểm)
            </h3>
          </div>
          <div className="h-64 flex items-end justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
            {peakHours.map((h, i) => {
              const max = Math.max(...peakHours.map((p) => p.count)) || 1;
              const height = (h.count / max) * 100;
              return (
                <div
                  key={i}
                  className="flex flex-col items-center flex-1 gap-2 group relative h-full justify-end"
                >
                  <div className="absolute -top-8 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    {h.count} lượt
                  </div>
                  <div
                    className={`w-full rounded-t-sm transition-all duration-500 ${
                      h.count > 0
                        ? "bg-primary/80 hover:bg-primary"
                        : "bg-gray-100 dark:bg-gray-700"
                    }`}
                    style={{ height: `${height || 2}%` }}
                  ></div>
                  <span className="text-[10px] text-gray-400 font-medium">{h.hour}h</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lượt check-in gần nhất của hội viên */}
        <div className="p-6 rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark shadow-sm">
          <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">
            Hoạt động check-in gần đây
          </h3>
          <div className="space-y-4">
            {activities.length > 0 ? (
              activities.map((act) => {
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
                        <span className={`text-xs font-semibold ${isCheckIn ? "text-green-600" : "text-orange-600"}`}>
                          {isCheckIn ? "Đã Check-in" : "Đã Check-out"}
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
              <p className="text-text-muted-light text-sm text-center py-4">
                Chưa có lượt check-in nào hôm nay.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* --- POPUP MODAL 1: DOANH THU TUẦN --- */}
      {showRevenueModal && (
        <Modal title="Chi Tiết Doanh Thu Tuần Này (Thứ 2 - Chủ Nhật)" onClose={() => setShowRevenueModal(false)}>
          <div className="space-y-6">
            <div className="bg-green-50/50 p-4 rounded-xl border border-green-100 flex justify-between items-center">
              <div>
                <p className="text-sm text-green-700 font-bold">Tổng doanh thu tuần này</p>
                <p className="text-2xl font-black text-green-600 mt-1">
                  {stats.weeklyRevenue.reduce((sum, d) => sum + d.revenue, 0).toLocaleString("vi-VN")} đ
                </p>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">Hóa Đơn Hợp Lệ</span>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-300 dark:border-gray-700 bg-gray-200/80 dark:bg-gray-800 text-xs font-bold text-black dark:text-white uppercase">
                    <th className="p-4">NGÀY TRONG TUẦN</th>
                    <th className="p-4">NGÀY THÁNG</th>
                    <th className="p-4 text-right">DOANH THU</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.weeklyRevenue.map((d, index) => {
                    const isToday = d.date === new Date().toISOString().substring(0, 10);
                    return (
                      <tr 
                        key={index} 
                        className={`transition-colors text-sm ${isToday ? "bg-green-50/50 font-bold text-green-800" : "hover:bg-gray-50"}`}
                      >
                        <td className="p-4 flex items-center gap-2">
                          {isToday && <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>}
                          {d.dayName}
                        </td>
                        <td className="p-4 text-gray-500 font-medium">
                          {new Date(d.date).toLocaleDateString("vi-VN")}
                        </td>
                        <td className="p-4 text-right font-bold text-gray-800">
                          {d.revenue.toLocaleString("vi-VN")} đ
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}

      {/* --- POPUP MODAL 2: HỘI VIÊN MỚI TRONG THÁNG --- */}
      {showNewCustomersModal && (
        <Modal title={`Danh Sách Hội Viên Mới Đăng Ký (${stats.newCustomersThisMonth} người)`} onClose={() => setShowNewCustomersModal(false)}>
          <div className="overflow-y-auto max-h-[450px]">
            {stats.newCustomersList.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-300 dark:border-gray-700 bg-gray-200/80 dark:bg-gray-800 text-xs font-bold text-black dark:text-white uppercase">
                    <th className="p-3 w-[10%]">AVATAR</th>
                    <th className="p-3 w-[30%]">HỌ TÊN</th>
                    <th className="p-3 w-[20%]">SỐ ĐIỆN THOẠI</th>
                    <th className="p-3 w-[25%]">GÓI TẬP</th>
                    <th className="p-3 w-[15%]">HỌC PHÍ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.newCustomersList.map((customer) => (
                    <tr key={customer._id} className="hover:bg-gray-50 transition-colors text-sm">
                      <td className="p-3">
                        <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center text-gray-400">
                          {customer.avatarUrl ? (
                             <img src={customer.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : customer.avatar && customer.avatar !== "👤" ? (
                             <img src={customer.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                             <span className="text-xs">KH</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-gray-800 block">{customer.name}</span>
                        <span className="text-[10px] text-gray-400 font-medium uppercase">{customer.code}</span>
                      </td>
                      <td className="p-3 font-semibold text-gray-700">{customer.phone}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                          {customer.packageType}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-green-600">
                        {(customer.price || 0).toLocaleString("vi-VN")} đ
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="p-8 text-center text-gray-400">Chưa có hội viên mới đăng ký trong tháng này.</p>
            )}
          </div>
        </Modal>
      )}

      {/* --- POPUP MODAL 3: QUẢN LÝ GHI CHÚ CA TRỰC --- */}
      {showTasksModal && (
        <TeamTasksModal 
          onClose={() => {
            setShowTasksModal(false);
            refetch(); // Tải lại số lượng tasks trên Card Dashboard
          }}
        />
      )}

    </div>
  );
};

// Component Modal Chung
const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-scale-in">
      <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <h3 className="text-lg font-black text-gray-800 dark:text-white tracking-tight">{title}</h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors text-gray-500">
          <X size={20} />
        </button>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  </div>
);

// Component Popup Quản lý Task Ghi chú
const TeamTasksModal = ({ onClose }) => {
  const confirm = useConfirm();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeSlot, setTimeSlot] = useState("");
  const [taskText, setTaskText] = useState("");

  // Lấy thông tin user hiện tại để phân quyền UI
  const user = JSON.parse(localStorage.getItem("gym_user") || "{}");
  const isAdminOrAccountant = user.role === "admin" || user.role === "accountant";
  const isManager = ["sm", "pm", "om"].includes(user.role);
  const isStaff = ["sale", "pt", "reception"].includes(user.role);

  // Xác định đội của user đăng nhập
  const userTeam = (() => {
    if (user.role === "sm" || user.role === "sale") return "sale";
    if (user.role === "pm" || user.role === "pt") return "pt";
    if (user.role === "om" || user.role === "reception") return "reception";
    return "";
  })();

  // State quản lý tab (Chỉ Admin và Kế toán mới đổi được tab)
  const [activeTab, setActiveTab] = useState(isAdminOrAccountant ? "sale" : userTeam);
  
  // State quản lý việc chọn đội khi tạo task mới (chỉ Admin/Kế toán cần chọn)
  const [createTeam, setCreateTeam] = useState("sale");

  const isTaskExpired = (t) => {
    if (t.isCompleted) return false;

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    // Nếu không phải ngày hôm nay -> quá hạn
    if (t.date !== todayStr) return true;

    // Nếu là ngày hôm nay -> quy đổi và so sánh
    const getShiftMinutes = (slot) => {
      if (!slot) return Infinity;
      const match = slot.match(/(\d+)(?::(\d+))?/);
      if (match) {
        let hour = parseInt(match[1], 10);
        const minute = match[2] ? parseInt(match[2], 10) : 0;
        if (hour < 5) {
          hour += 24;
        }
        return hour * 60 + minute;
      }
      return Infinity;
    };

    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    let currentHourShift = currentHour;
    if (currentHourShift < 5) {
      currentHourShift += 24;
    }
    const currentTotalMinutes = currentHourShift * 60 + currentMinute;
    const taskTotalMinutes = getShiftMinutes(t.timeSlot);

    const diff = taskTotalMinutes - currentTotalMinutes;
    return diff < -5; // Quá giờ bắt đầu trên 5 phút
  };

  const loadTasks = async () => {
    setLoading(true);
    try {
      // Admin/Kế toán lọc theo activeTab, Manager/Staff lọc theo đội của họ
      const res = await teamTaskService.getAllToday({ team: activeTab });
      if (res && res.success) {
        setTasks(res.data || []);
      }
    } catch (e) {
      toast.error("Lỗi lấy danh sách ghi chú");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [activeTab]);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!timeSlot.trim() || !taskText.trim()) {
      toast.error("Vui lòng nhập đủ Khung giờ & Việc cần làm");
      return;
    }
    try {
      const targetTeam = isAdminOrAccountant ? createTeam : userTeam;
      const res = await teamTaskService.create({ 
        timeSlot, 
        task: taskText,
        team: targetTeam
      });
      if (res && res.success) {
        toast.success("Thêm đầu việc thành công");
        setTimeSlot("");
        setTaskText("");
        // Nếu Admin tạo task cho đội khác, chuyển sang tab đó để xem
        if (isAdminOrAccountant && targetTeam !== activeTab) {
          setActiveTab(targetTeam);
        } else {
          loadTasks();
        }
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleToggleComplete = async (task) => {
    try {
      const res = await teamTaskService.update(task._id, { isCompleted: !task.isCompleted });
      if (res && res.success) {
        loadTasks();
      }
    } catch (e) {
      toast.error(e.message || "Lỗi cập nhật trạng thái");
    }
  };

  const handleDeleteTask = async (id) => {
    const isConfirmed = await confirm({
      title: "Xóa công việc",
      message: "Bạn có chắc chắn muốn xóa đầu việc này?",
      type: "danger"
    });
    if (isConfirmed) {
      try {
        const res = await teamTaskService.delete(id);
        if (res && res.success) {
          toast.success("Đã xóa đầu việc thành công");
          loadTasks();
        }
      } catch (e) {
        toast.error(e.message || "Lỗi xóa đầu việc");
      }
    }
  };

  const canEditOrDelete = isAdminOrAccountant || (isManager && activeTab === userTeam);
  const canComplete = isAdminOrAccountant || (activeTab === userTeam);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
          <h3 className="text-lg font-black text-gray-800 dark:text-white tracking-tight">Ghi Chú Ca Trực Hôm Nay</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors text-gray-500">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Hệ thống Tabs phân nhóm theo đội (Chỉ Admin & Kế toán được chuyển tab) */}
          {isAdminOrAccountant && (
            <div className="flex border-b border-gray-100 dark:border-gray-800 -mt-2">
              {[
                { id: "sale", label: "Đội Sale" },
                { id: "pt", label: "Đội PT" },
                { id: "reception", label: "Đội Lễ tân" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`flex-1 py-2 text-sm font-bold border-b-2 transition-all ${
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Form thêm nhanh đầu việc (Ẩn đối với nhân viên thường) */}
          {(isAdminOrAccountant || isManager) && (
            <form onSubmit={handleAddTask} className="flex flex-col gap-3 bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="w-full sm:w-1/3">
                  <input
                    type="text"
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text-light dark:text-text-dark"
                    placeholder="Khung giờ"
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text-light dark:text-text-dark"
                    placeholder="Nội dung công việc cần làm..."
                    value={taskText}
                    onChange={(e) => setTaskText(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="flex justify-between items-center mt-1">
                {/* Chọn đội để gán (Chỉ Admin/Kế toán mới chọn được) */}
                {isAdminOrAccountant ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500">Đội:</span>
                    <select
                      className="h-8 px-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-text-light dark:text-text-dark font-bold cursor-pointer"
                      value={createTeam}
                      onChange={(e) => setCreateTeam(e.target.value)}
                    >
                      <option value="sale">Sale</option>
                      <option value="pt">PT</option>
                      <option value="reception">Lễ tân</option>
                    </select>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 font-medium">
                    Ghi chú cho đội: <span className="font-bold text-primary uppercase">{userTeam}</span>
                  </div>
                )}

                <button 
                  type="submit" 
                  className="h-9 px-4 bg-primary text-white font-bold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5 justify-center text-sm shrink-0"
                >
                  <Plus size={16} /> Thêm Việc
                </button>
              </div>
            </form>
          )}

          {/* Danh sách các công việc */}
          <div className="overflow-y-auto max-h-[300px] space-y-3">
            {loading ? (
              <p className="text-center py-6 text-gray-400">Đang tải...</p>
            ) : tasks.length > 0 ? (
              tasks.map((t) => {
                const expired = isTaskExpired(t);
                return (
                  <div 
                    key={t._id}
                    className={`flex items-center justify-between p-3.5 border rounded-xl transition-all ${
                      t.isCompleted 
                        ? "bg-gray-50/70 border-gray-100 dark:bg-gray-800/20 dark:border-gray-800/50" 
                        : expired
                          ? "bg-red-50/20 border-red-100/50 dark:bg-red-950/10 dark:border-red-900/30"
                          : "bg-white border-gray-200/80 shadow-sm dark:bg-gray-900 dark:border-gray-800"
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {t.isCompleted ? (
                        <button 
                          disabled={true}
                          className="shrink-0 text-green-500 cursor-not-allowed"
                        >
                          <CheckCircle2 size={24} style={{ fill: "#22c55e33" }} />
                        </button>
                      ) : expired ? (
                        <button 
                          disabled={true}
                          className="shrink-0 text-red-500 cursor-not-allowed"
                          title="Đã quá hạn thực hiện (trên 5 phút) và bị khóa"
                        >
                          <AlertCircle size={24} />
                        </button>
                      ) : canComplete ? (
                        <button 
                          onClick={() => handleToggleComplete(t)}
                          className="shrink-0 text-gray-300 hover:text-gray-400 transition-colors"
                        >
                          <CheckCircle2 size={24} style={{ fill: "transparent" }} />
                        </button>
                      ) : (
                        <button 
                          disabled={true}
                          className="shrink-0 text-gray-200 cursor-not-allowed"
                        >
                          <CheckCircle2 size={24} style={{ fill: "transparent" }} />
                        </button>
                      )}
                      <div className="min-w-0">
                        <span className={`inline-block text-[11px] font-black uppercase px-2 py-0.5 rounded mr-2 ${expired && !t.isCompleted ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400" : "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400"}`}>
                          {t.timeSlot}
                        </span>
                        <p className={`inline-block text-sm font-medium truncate align-middle ${t.isCompleted ? "line-through text-gray-400 dark:text-gray-600" : expired ? "text-red-600/90 dark:text-red-400 font-semibold" : "text-gray-800 dark:text-gray-200"}`}>
                          {t.task}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      {t.isCompleted ? (
                        <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded border border-green-200">Đã xong</span>
                      ) : expired ? (
                        <span className="text-xs text-red-600 font-bold bg-red-50 px-2 py-1 rounded border border-red-200">Quá hạn</span>
                      ) : null}

                      {canEditOrDelete && !t.isCompleted && !expired && (
                        <button 
                          onClick={() => handleDeleteTask(t._id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-400">
                <ClipboardList className="mx-auto mb-2 opacity-30" size={40} />
                <p className="text-sm">Chưa có ghi chú đầu việc nào cho ca trực của đội này.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Component Card nhỏ cho KPI
const StatCard = ({ label, value, change, type, icon: Icon, colorClass, onClick }) => (
  <div 
    onClick={onClick}
    className={`flex flex-col rounded-2xl p-6 border bg-surface-light dark:bg-surface-dark relative overflow-hidden group shadow-sm hover:shadow-md transition-all cursor-pointer min-w-0 w-full ${colorClass || 'border-border-light dark:border-border-dark'}`}
  >
    <div className={`absolute right-4 top-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-300 ${colorClass ? colorClass.split(' ')[0] : ''}`}>
      <Icon size={64} />
    </div>
    
    <div className="flex items-center gap-2 mb-4 min-w-0">
      <div className={`p-2 rounded-lg shrink-0 ${colorClass || 'bg-gray-100 text-gray-600'}`}>
        <Icon size={20} />
      </div>
      <p className="text-black dark:text-white text-sm font-bold uppercase tracking-wider break-words flex-1">
        {label}
      </p>
    </div>

    <div className="flex flex-col z-10 min-w-0">
      <p className={`tracking-tight text-2xl font-bold break-words break-all ${colorClass ? colorClass.split(' ')[0] : 'text-blue-600'}`}>
        {value}
      </p>
      
      {change && (
        <span
          className={`text-sm font-bold mt-2 break-words whitespace-pre-wrap ${
            type === "positive" ? "text-green-500" : type === "negative" ? "text-red-500" : type === "warning" ? "text-yellow-500" : "text-gray-500"
          }`}
        >
          {change}
        </span>
      )}
    </div>
  </div>
);

export default Dashboard;