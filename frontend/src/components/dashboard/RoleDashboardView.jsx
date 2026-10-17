import React, { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Coins,
  Dumbbell,
  LogIn,
  LogOut,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { teamTaskService } from "../../services/teamTaskService";

const ROLE_LABELS = {
  admin: "Quản trị hệ thống",
  accountant: "Kế toán",
  manager: "Quản lý chi nhánh",
  sm: "Quản lý Sale",
  pm: "Quản lý PT",
  om: "Quản lý vận hành",
  sale: "Nhân viên Sale",
  pt: "Huấn luyện viên",
  reception: "Vận hành",
  staff: "Nhân viên",
};

const getShiftLabel = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Ca sáng";
  if (hour < 18) return "Ca chiều";
  return "Ca tối";
};

const formatToday = () =>
  new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());

const getDaysLeftInMonth = () => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate();
};

const getShiftMinutes = (timeSlot) => {
  const match = String(timeSlot || "").match(/(\d+)(?::(\d+))?/);
  if (!match) return Infinity;
  let hour = Number(match[1]);
  if (hour < 5) hour += 24;
  return hour * 60 + Number(match[2] || 0);
};

const getTaskState = (task) => {
  if (task.isCompleted) return "completed";
  const now = new Date();
  let hour = now.getHours();
  if (hour < 5) hour += 24;
  const diff = getShiftMinutes(task.timeSlot) - (hour * 60 + now.getMinutes());
  if (diff < -5) return "overdue";
  if (diff <= 60) return "soon";
  return "pending";
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value || 0));

const formatCompactCurrency = (value) => {
  const amount = Number(value || 0);
  if (amount >= 1_000_000_000) return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(amount / 1_000_000_000)} tỷ đ`;
  if (amount >= 1_000_000) return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(amount / 1_000_000)} tr đ`;
  return `${formatCurrency(amount)} đ`;
};

const Surface = ({ className = "", children }) => (
  <section className={`dashboard-card-dark rounded-lg border border-border-light bg-background-light dark:border-border-dark dark:bg-surface-dark ${className}`}>
    {children}
  </section>
);

const SectionHeader = ({ title, subtitle, action, onAction }) => (
  <div className="flex items-start justify-between gap-4 border-b border-border-light px-4 py-3 dark:border-border-dark sm:px-5">
    <div>
      <h2 className="text-sm font-semibold text-text-light dark:text-text-dark">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-text-muted-light dark:text-text-muted-dark">{subtitle}</p>}
    </div>
    {action && (
      <button
        type="button"
        onClick={onAction}
        className="shrink-0 text-xs font-semibold text-primary transition-opacity hover:opacity-70"
      >
        {action}
      </button>
    )}
  </div>
);

const Sparkline = ({ points = [] }) => {
  const values = points.map((point) => Number(point?.value ?? point ?? 0));
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const coordinates = values.map((value, index) => ({
    x: 1 + (index / (values.length - 1)) * 78,
    y: range === 0 ? 12 : 22 - ((value - min) / range) * 20,
  }));

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 80 24"
      preserveAspectRatio="none"
      className="h-6 w-12 shrink-0 overflow-visible text-primary sm:w-20"
    >
      <polyline
        points={coordinates.map(({ x, y }) => `${x},${y}`).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

const MetricStrip = ({ items }) => (
  <div className={`grid gap-px overflow-hidden rounded-lg border border-border-light bg-border-light dark:border-border-dark dark:bg-border-dark ${items.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 xl:grid-cols-4"}`}>
    {items.map((item) => (
      <button
        type="button"
        key={item.label}
        onClick={item.onClick}
        disabled={!item.onClick}
        className={`dashboard-card-dark group min-w-0 bg-background-light px-4 py-4 text-left transition-colors dark:bg-surface-dark sm:px-5 ${item.onClick ? "hover:bg-black/[0.02] dark:hover:bg-white/[0.03]" : "cursor-default"}`}
      >
        <span className="text-xs font-medium text-black dark:text-text-dark">{item.label}</span>
        <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
          <strong title={item.fullValue || String(item.value)} className="min-w-0 text-xl font-semibold tabular-nums text-text-light dark:text-text-dark sm:text-2xl">
            {item.value}
          </strong>
          <Sparkline points={item.points} />
        </div>
        <p className={`mt-1.5 text-pretty text-xs ${item.tone === "danger" ? "text-negative-light dark:text-negative-dark" : item.tone === "positive" ? "text-positive-light dark:text-positive-dark" : "text-text-muted-light dark:text-text-muted-dark"}`}>
          {item.caption}
        </p>
      </button>
    ))}
  </div>
);

const TasksPanel = ({ enabled, onOpenAll, onChanged }) => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canComplete = hasPermission("team_task.complete");
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["dashboardTodayTasks"],
    enabled,
    queryFn: async () => {
      const response = await teamTaskService.getAllToday();
      return response?.success ? response.data || [] : [];
    },
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });

  const sortedTasks = useMemo(() => {
    const priority = { overdue: 0, soon: 1, pending: 2, completed: 3 };
    return [...tasks]
      .sort((a, b) => priority[getTaskState(a)] - priority[getTaskState(b)] || getShiftMinutes(a.timeSlot) - getShiftMinutes(b.timeSlot))
      .slice(0, 4);
  }, [tasks]);

  const completedCount = tasks.filter((task) => task.isCompleted).length;
  const completion = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 100;

  const completeTask = async (task) => {
    if (!canComplete || getTaskState(task) !== "pending" && getTaskState(task) !== "soon") return;
    try {
      const response = await teamTaskService.update(task._id, { isCompleted: true });
      if (response?.success) {
        await queryClient.invalidateQueries({ queryKey: ["dashboardTodayTasks"] });
        onChanged?.();
        toast.success("Đã hoàn thành công việc");
      }
    } catch (error) {
      toast.error(error.message || "Không thể cập nhật công việc");
    }
  };

  if (!enabled) return null;

  return (
    <Surface className="overflow-hidden">
      <SectionHeader
        title="Công việc cần làm"
        subtitle={tasks.length ? `${completedCount}/${tasks.length} việc đã hoàn thành` : "Không có công việc trong ca"}
        action="Xem tất cả"
        onAction={onOpenAll}
      />
      <div className="h-1 bg-background-light dark:bg-background-dark">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${completion}%` }} />
      </div>
      <div className="px-4 sm:px-5">
        {isLoading ? (
          <div className="flex min-h-56 items-center justify-center text-sm text-text-muted-light dark:text-text-muted-dark">Đang tải công việc...</div>
        ) : sortedTasks.length ? (
          sortedTasks.map((task) => {
            const state = getTaskState(task);
            const isActionable = canComplete && (state === "pending" || state === "soon");
            return (
              <div
                key={task._id}
                className={`grid min-h-[68px] grid-cols-[22px_48px_1fr] items-center gap-2 border-b border-border-light py-3 last:border-b-0 dark:border-border-dark ${
                  state === "overdue" ? "-mx-5 border-l-2 border-l-negative-light px-[18px] dark:border-l-negative-dark" :
                  state === "soon" ? "-mx-5 border-l-2 border-l-amber-500 px-[18px]" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => completeTask(task)}
                  disabled={!isActionable}
                  aria-label={`Hoàn thành: ${task.task}`}
                  className={`flex size-5 items-center justify-center rounded border transition-colors ${
                    state === "completed"
                      ? "border-positive-light bg-positive-light text-white dark:border-positive-dark dark:bg-positive-dark"
                      : isActionable
                        ? "border-border-light text-transparent hover:border-primary hover:text-primary dark:border-border-dark"
                        : "cursor-not-allowed border-border-light text-transparent opacity-50 dark:border-border-dark"
                  }`}
                >
                  <Check size={13} strokeWidth={3} />
                </button>
                <time className="text-xs font-medium tabular-nums text-text-muted-light dark:text-text-muted-dark">{task.timeSlot}</time>
                <div className="min-w-0">
                  <p className={`truncate text-sm font-medium ${state === "completed" ? "text-text-muted-light line-through dark:text-text-muted-dark" : "text-text-light dark:text-text-dark"}`}>
                    {task.task}
                  </p>
                  <p className={`mt-1 text-xs ${state === "overdue" ? "text-negative-light dark:text-negative-dark" : state === "soon" ? "text-amber-600 dark:text-amber-400" : "text-text-muted-light dark:text-text-muted-dark"}`}>
                    {state === "overdue" ? "Đã quá thời gian thực hiện" : state === "soon" ? "Sắp đến giờ thực hiện" : state === "completed" ? "Đã hoàn thành" : task.team ? `Đội ${task.team}` : "Trong ca hôm nay"}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex min-h-56 flex-col items-center justify-center text-center">
            <CheckCircle2 size={28} className="mb-2 text-positive-light dark:text-positive-dark" />
            <p className="text-sm font-medium text-text-light dark:text-text-dark">Ca làm việc đã sẵn sàng</p>
            <p className="mt-1 text-xs text-text-muted-light dark:text-text-muted-dark">Chưa có đầu việc nào cần xử lý.</p>
          </div>
        )}
      </div>
      <button type="button" onClick={onOpenAll} className="flex w-full items-center justify-between border-t border-border-light px-5 py-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/5 dark:border-border-dark">
        Mở danh sách công việc <ArrowRight size={14} />
      </button>
    </Surface>
  );
};

const PeakHoursChart = ({ peakHours, onOpen }) => {
  const chartData = peakHours.map((item) => ({
    ...item,
    label: `${item.hour}h`,
    count: Number(item.count || 0),
  }));

  return (
    <Surface className="overflow-hidden">
      <SectionHeader title="Lượt check-in theo giờ" subtitle="Hôm nay · 05:00–21:00" action="Xem lịch sử" onAction={onOpen} />
      <button type="button" onClick={onOpen} className="block w-full px-4 pb-4 pt-5 text-left transition-colors hover:bg-background-light/60 dark:hover:bg-white/[0.02] sm:px-5">
        <div className="w-full overflow-x-auto" role="img" aria-label={`Biểu đồ check-in hôm nay, tổng ${chartData.reduce((sum, item) => sum + item.count, 0)} lượt`}>
          <div className="h-64 min-w-[640px] w-full text-primary">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              initialDimension={{ width: 720, height: 256 }}
            >
              <BarChart data={chartData} margin={{ top: 22, right: 2, bottom: 0, left: 2 }} barCategoryGap="28%">
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={{ stroke: "currentColor", opacity: 0.16 }}
                  interval={0}
                  tick={({ x, y, payload }) => (
                    <text x={x} y={y + 14} textAnchor="middle" className="fill-text-muted-light text-[11px] dark:fill-text-muted-dark">
                      {payload.value}
                    </text>
                  )}
                />
                <YAxis hide domain={[0, "dataMax + 1"]} />
                <Bar dataKey="count" fill="currentColor" radius={[6, 6, 0, 0]} maxBarSize={28} minPointSize={2} isAnimationActive={false}>
                  <LabelList
                    dataKey="count"
                    position="top"
                    formatter={(value) => Number(value) > 0 ? value : ""}
                    className="fill-text-muted-light text-[11px] font-medium dark:fill-text-muted-dark"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </button>
    </Surface>
  );
};

const ActivityFeed = ({ title, subtitle, activities, mode, onOpen }) => (
  <Surface className="overflow-hidden">
    <SectionHeader title={title} subtitle={subtitle} action="Xem chi tiết" onAction={onOpen} />
    <div className="px-4 sm:px-5">
      {activities.length ? activities.slice(0, 5).map((activity) => {
        const isOut = activity.type === "out";
        const isRegistration = activity.type === "registration";
        const isPayment = activity.type === "payment";
        const Icon = mode === "pt" ? Dumbbell : mode === "sale" || isPayment ? Coins : isRegistration ? Users : isOut ? LogOut : LogIn;
        return (
          <button type="button" onClick={() => onOpen?.(activity)} key={`${activity.type}-${activity.id}`} className="grid w-full grid-cols-[34px_1fr_auto] items-center gap-3 border-b border-border-light py-3 text-left last:border-b-0 dark:border-border-dark">
            <span className="flex size-8 items-center justify-center rounded-full bg-background-light text-text-muted-light dark:bg-background-dark dark:text-text-muted-dark">
              <Icon size={15} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-light dark:text-text-dark">{activity.customerName}</p>
              <p className="mt-0.5 truncate text-xs text-text-muted-light dark:text-text-muted-dark">{activity.note || (isOut ? "Check-out" : "Check-in thành công")}</p>
            </div>
            <time className="text-xs tabular-nums text-text-muted-light dark:text-text-muted-dark">{activity.time}</time>
          </button>
        );
      }) : (
        <button type="button" onClick={onOpen} className="flex min-h-52 w-full flex-col items-center justify-center text-center">
          <Clock3 size={26} className="mb-2 text-text-muted-light dark:text-text-muted-dark" />
          <p className="text-sm text-text-muted-light dark:text-text-muted-dark">Chưa có hoạt động gần đây.</p>
        </button>
      )}
    </div>
  </Surface>
);

const NewMembersPanel = ({ members, onOpen }) => (
  <Surface className="overflow-hidden">
    <SectionHeader title="Hội viên mới" subtitle="Đăng ký gần nhất trong tháng" action="Xem danh sách" onAction={onOpen} />
    <div className="px-4 sm:px-5">
      {members.length ? members.slice(0, 5).map((member) => (
        <button type="button" onClick={onOpen} key={member._id} className="grid w-full grid-cols-[32px_1fr_auto] items-center gap-3 border-b border-border-light py-3 text-left last:border-b-0 dark:border-border-dark">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{String(member.name || "HV").trim().slice(0, 1).toUpperCase()}</span>
          <span className="min-w-0"><strong className="block truncate text-sm font-medium text-text-light dark:text-text-dark">{member.name}</strong><small className="mt-0.5 block truncate text-xs text-text-muted-light dark:text-text-muted-dark">{member.packageType || member.phone || "Hội viên mới"}</small></span>
          <ArrowRight size={14} className="text-text-muted-light dark:text-text-muted-dark" />
        </button>
      )) : (
        <button type="button" onClick={onOpen} className="flex min-h-52 w-full flex-col items-center justify-center text-center">
          <Users size={26} className="mb-2 text-text-muted-light dark:text-text-muted-dark" />
          <span className="text-sm text-text-muted-light dark:text-text-muted-dark">Chưa có hội viên mới trong tháng.</span>
        </button>
      )}
    </div>
  </Surface>
);

const ContractHealthPanel = ({ stats, onOpen }) => {
  const rows = [
    { label: "Hội viên còn hiệu lực", value: stats.activeMembers, caption: "Theo hợp đồng đang hoạt động" },
    { label: "Hợp đồng mới / gia hạn", value: `${stats.newContractsThisMonth} / ${stats.renewContractsThisMonth}`, caption: "Phát sinh trong tháng này" },
    { label: "Sắp hết hạn trong 7 ngày", value: stats.expiringContracts7Days, caption: "Cần chăm sóc gia hạn", tone: "warning" },
    { label: "Thanh toán cần kiểm tra", value: stats.paymentAttentionCount, caption: "Hồ sơ cọc hoặc chưa thanh toán", tone: "danger" },
  ];

  return (
    <Surface className="overflow-hidden">
      <SectionHeader title="Sức khỏe hợp đồng" subtitle="Những chỉ số ảnh hưởng tới doanh thu tiếp theo" action="Xem hội viên" onAction={onOpen} />
      <div className="grid grid-cols-1 sm:grid-cols-2">
        {rows.map((row, index) => (
          <button
            type="button"
            key={row.label}
            onClick={onOpen}
            className={`px-5 py-4 text-left transition-colors hover:bg-background-light/60 dark:hover:bg-white/[0.02] ${index % 2 === 0 ? "sm:border-r sm:border-border-light sm:dark:border-border-dark" : ""} ${index < 2 ? "border-b border-border-light dark:border-border-dark" : ""}`}
          >
            <span className="text-xs text-text-muted-light dark:text-text-muted-dark">{row.label}</span>
            <strong className={`mt-1 block text-xl font-semibold tabular-nums ${row.tone === "danger" && Number(row.value) > 0 ? "text-negative-light dark:text-negative-dark" : row.tone === "warning" && Number(row.value) > 0 ? "text-amber-600 dark:text-amber-400" : "text-text-light dark:text-text-dark"}`}>{row.value}</strong>
            <small className="mt-1 block text-xs text-text-muted-light dark:text-text-muted-dark">{row.caption}</small>
          </button>
        ))}
      </div>
    </Surface>
  );
};

const AttentionPanel = ({ items }) => (
  <Surface className="overflow-hidden">
    <SectionHeader title="Cần chú ý" subtitle="Các mục nên kiểm tra tiếp theo" />
    <div className="px-4 sm:px-5">
      {items.map((item, index) => (
        <button key={item.title} type="button" onClick={item.onClick} className="grid w-full grid-cols-[28px_1fr_16px] items-center gap-3 border-b border-border-light py-3 text-left last:border-b-0 dark:border-border-dark">
          <span className="text-lg font-medium tabular-nums text-border-dark dark:text-border-light">0{index + 1}</span>
          <span className="min-w-0"><strong className="block truncate text-sm font-medium text-text-light dark:text-text-dark">{item.title}</strong><small className="mt-0.5 block truncate text-xs text-text-muted-light dark:text-text-muted-dark">{item.caption}</small></span>
          <ArrowRight size={14} className="text-text-muted-light dark:text-text-muted-dark" />
        </button>
      ))}
    </div>
  </Surface>
);

const IssuesPanel = ({ stats, onOpen }) => {
  const items = [
    {
      key: "expiring",
      count: stats.expiringContracts7Days,
      title: `${stats.expiringContracts7Days} hợp đồng sắp hết hạn`,
      caption: "Trong 7 ngày tới",
      dotClass: "bg-red-500",
    },
    {
      key: "payment",
      count: stats.paymentAttentionCount,
      title: `${stats.paymentAttentionCount} khoản thanh toán chưa hoàn tất`,
      caption: `Tổng giá trị ${formatCurrency(stats.paymentAttentionValue)}đ`,
      dotClass: "bg-orange-500",
    },
    {
      key: "inactive",
      count: stats.longAbsentCount,
      title: `${stats.longAbsentCount} hội viên chưa quay lại trên 14 ngày`,
      caption: "Có nguy cơ ngừng tập",
      dotClass: "bg-amber-400",
    },
  ].filter((item) => Number(item.count) > 0);

  return (
    <Surface className="overflow-hidden">
      <SectionHeader title="Việc cần xử lý" subtitle="Ưu tiên theo mức độ ảnh hưởng" action="Xem tất cả" onAction={onOpen} />
      <div className="px-4 sm:px-5">
        {items.length ? items.map((item) => (
          <button key={item.key} type="button" onClick={onOpen} className="grid w-full grid-cols-[10px_1fr_16px] items-center gap-3 border-b border-border-light py-4 text-left transition-colors last:border-b-0 hover:bg-background-light/60 dark:border-border-dark dark:hover:bg-white/[0.02]">
            <span className={`size-2.5 rounded-full ${item.dotClass}`} aria-hidden="true" />
            <span className="min-w-0">
              <strong className="block text-pretty text-sm font-medium text-text-light dark:text-text-dark">{item.title}</strong>
              <small className="mt-1 block text-pretty text-xs text-text-muted-light dark:text-text-muted-dark">{item.caption}</small>
            </span>
            <ArrowRight size={14} className="text-text-muted-light dark:text-text-muted-dark" />
          </button>
        )) : (
          <p className="py-6 text-center text-sm text-text-muted-light dark:text-text-muted-dark">Không có việc nào cần xử lý ngay.</p>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-border-light px-4 py-3 text-xs text-text-muted-light dark:border-border-dark dark:text-text-muted-dark sm:px-5">
        <CheckCircle2 size={15} className="shrink-0 text-positive-light dark:text-positive-dark" />
        <span>Không có vấn đề vận hành nghiêm trọng</span>
      </div>
    </Surface>
  );
};

const LongAbsentMembersPanel = ({ members, total, onOpen }) => (
  <Surface className="overflow-hidden">
    <SectionHeader title="Hội viên vắng lâu" subtitle="Trên 14 ngày chưa check-in" action="Xem hội viên" onAction={onOpen} />
    <div className="px-4 sm:px-5">
      {members.length ? members.slice(0, 5).map((member) => (
        <button key={member._id} type="button" onClick={onOpen} className="grid w-full grid-cols-[32px_1fr_auto] items-center gap-3 border-b border-border-light py-3 text-left transition-colors last:border-b-0 hover:bg-background-light/60 dark:border-border-dark dark:hover:bg-white/[0.02]">
          <span className="flex size-8 items-center justify-center rounded-full bg-background-light text-xs font-semibold text-text-muted-light dark:bg-background-dark dark:text-text-muted-dark">
            {String(member.name || "HV").trim().slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0">
            <strong className="block truncate text-sm font-medium text-text-light dark:text-text-dark">{member.name}</strong>
            <small className="mt-0.5 block truncate text-xs text-text-muted-light dark:text-text-muted-dark">{member.packageName}</small>
          </span>
          <span className="text-right text-xs tabular-nums text-amber-600 dark:text-amber-400">
            {member.daysAbsent ? `${member.daysAbsent} ngày` : "Chưa check-in"}
          </span>
        </button>
      )) : (
        <p className="py-6 text-center text-sm text-text-muted-light dark:text-text-muted-dark">Không có hội viên nào vắng quá 14 ngày.</p>
      )}
    </div>
    {total > members.slice(0, 5).length && (
      <button type="button" onClick={onOpen} className="w-full border-t border-border-light px-5 py-3 text-left text-xs font-medium text-text-muted-light transition-colors hover:bg-background-light/60 dark:border-border-dark dark:text-text-muted-dark dark:hover:bg-white/[0.02]">
        Còn {total - members.slice(0, 5).length} hội viên cần xem
      </button>
    )}
  </Surface>
);

const RevenueByPackagePanel = ({ data, onOpen }) => {
  const maxRevenue = Math.max(...data.map((item) => Number(item.revenue || 0)), 1);
  const totalRevenue = data.reduce((sum, item) => sum + Number(item.revenue || 0), 0);

  return (
    <Surface className="overflow-hidden">
      <SectionHeader title="Doanh thu theo gói tập" subtitle={`Tháng này · ${formatCompactCurrency(totalRevenue)}`} action="Xem báo cáo" onAction={onOpen} />
      <div className="px-4 py-2 sm:px-5">
        {data.length ? data.slice(0, 5).map((item) => (
          <button key={item.packageName} type="button" onClick={onOpen} className="block w-full py-3 text-left">
            <span className="flex items-baseline justify-between gap-3">
              <span title={item.packageName} className="min-w-0 flex-1 truncate text-sm font-medium text-text-light dark:text-text-dark">{item.packageName}</span>
              <span className="shrink-0 text-sm font-medium tabular-nums text-text-light dark:text-text-dark">{formatCompactCurrency(item.revenue)}</span>
            </span>
            <span className="mt-2 block h-2 rounded-full bg-background-light dark:bg-background-dark">
              <span className="block h-2 rounded-full bg-primary" style={{ width: `${Math.max(3, (Number(item.revenue || 0) / maxRevenue) * 100)}%` }} />
            </span>
          </button>
        )) : (
          <p className="py-6 text-center text-sm text-text-muted-light dark:text-text-muted-dark">Chưa có doanh thu gói tập trong tháng này.</p>
        )}
      </div>
    </Surface>
  );
};

const ProgressPanel = ({ title, achieved, target, percentage, secondary, onOpen }) => (
  <Surface className="overflow-hidden">
    <SectionHeader title={title} subtitle="Tiến độ trong tháng hiện tại" action="Xem chi tiết" onAction={onOpen} />
    <button type="button" onClick={onOpen} className="block w-full px-5 py-5 text-left transition-colors hover:bg-background-light/60 dark:hover:bg-white/[0.02]">
      <div className="flex items-end justify-between gap-4">
        <div><strong className="text-3xl font-semibold tabular-nums text-text-light dark:text-text-dark">{percentage}%</strong><p className="mt-1 text-xs text-text-muted-light dark:text-text-muted-dark">{secondary}</p></div>
        <p className="text-right text-xs text-text-muted-light dark:text-text-muted-dark"><b className="block text-sm font-semibold text-text-light dark:text-text-dark">{achieved} / {target}</b>mục tiêu</p>
      </div>
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-background-light dark:bg-background-dark"><div className="h-full bg-primary" style={{ width: `${Math.min(100, percentage)}%` }} /></div>
    </button>
  </Surface>
);

const RoleDashboardView = ({
  dashboardData,
  stats,
  activities,
  peakHours,
  onOpenTasks,
  onOpenRevenue,
  onOpenCustomers,
  onOpenCheckIns,
  onOpenWorkouts,
  onTasksChanged,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role || "staff";
  const isCentral = role === "admin" || role === "accountant";
  const isPT = Boolean(dashboardData?.isPT);
  const isSale = Boolean(dashboardData?.isSale);
  const hasRevenueMetric = Object.prototype.hasOwnProperty.call(dashboardData || {}, "revenue");
  const busiestHour = peakHours.reduce((best, item) => Number(item.count || 0) > Number(best?.count || 0) ? item : best, null);
  const pageTitle = isPT
    ? "Lịch huấn luyện hôm nay"
    : isSale
      ? "Tổng quan bán hàng"
      : role === "accountant"
        ? "Tổng quan tài chính"
        : role === "admin"
          ? "Tổng quan hệ thống"
          : role === "manager"
            ? "Tổng quan cơ sở"
            : role === "sm"
              ? "Tình hình kinh doanh"
              : role === "pm"
                ? "Tình hình huấn luyện"
                : "Tình hình vận hành";

  const metrics = isPT
    ? [
        { label: "Buổi dạy tháng này", value: `${dashboardData.ptStats.achieved}/${dashboardData.ptStats.target}`, caption: `${dashboardData.ptStats.percentage}% chỉ tiêu`, tone: "positive", onClick: onOpenWorkouts },
        { label: "Khách đang phụ trách", value: dashboardData.ptStats.activeClients, caption: "Hội viên đang hoạt động", onClick: () => navigate("/customers") },
        { label: "Khách mới tháng này", value: dashboardData.ptStats.newClients, caption: "Khách mới được phân công", onClick: () => navigate("/customers") },
        { label: "Công việc còn lại", value: String(stats.pendingTasksCount).padStart(2, "0"), caption: stats.upcomingTask ? `${stats.upcomingTask.timeSlot} · ${stats.upcomingTask.task}` : "Trong ca hôm nay", tone: stats.upcomingTask ? "danger" : "positive", trend: "down", onClick: onOpenTasks },
      ]
    : isSale
      ? [
          { label: "Doanh số tháng này", value: `${formatCurrency(dashboardData.saleStats.revenue.achieved)}đ`, caption: `${dashboardData.saleStats.revenue.percentage}% chỉ tiêu`, tone: "positive", onClick: () => navigate("/commissions") },
          { label: "Hợp đồng mới", value: `${dashboardData.saleStats.newContracts.achieved}/${dashboardData.saleStats.newContracts.target}`, caption: `${dashboardData.saleStats.newContracts.percentage}% mục tiêu`, onClick: () => navigate("/leads") },
          { label: "Gói gia hạn", value: `${dashboardData.saleStats.renewContracts.achieved}/${dashboardData.saleStats.renewContracts.target}`, caption: `${dashboardData.saleStats.renewContracts.percentage}% mục tiêu`, onClick: () => navigate("/leads") },
          { label: "Công việc còn lại", value: String(stats.pendingTasksCount).padStart(2, "0"), caption: stats.upcomingTask ? `${stats.upcomingTask.timeSlot} · ${stats.upcomingTask.task}` : "Trong ca hôm nay", tone: stats.upcomingTask ? "danger" : "positive", trend: "down", onClick: onOpenTasks },
        ]
      : hasRevenueMetric
        ? [
            { label: "Doanh thu tháng", value: formatCompactCurrency(stats.revenue), fullValue: `${formatCurrency(stats.revenue)}đ`, caption: `${stats.revenuePercentage}% chỉ tiêu · Hôm nay ${formatCurrency(stats.todayRevenue)}đ`, points: stats.kpiTrends?.revenue, onClick: onOpenRevenue },
            { label: "Hội viên hoạt động", value: stats.activeMembers, caption: "Hợp đồng còn hiệu lực", points: stats.kpiTrends?.activeMembers, onClick: () => navigate("/customers?status=active") },
            { label: "Lượt check-in", value: stats.todayCheckIns, caption: stats.checkInChange === 0 ? "Bằng ngày hôm qua" : `${stats.checkInChange > 0 ? "+" : ""}${stats.checkInChange} so với hôm qua`, points: stats.kpiTrends?.checkIns, onClick: onOpenCheckIns },
            { label: "Hợp đồng mới trong tháng", value: stats.newContractsThisMonth, caption: "Không gồm hợp đồng gia hạn", points: stats.kpiTrends?.newContracts, onClick: onOpenCustomers },
          ]
        : [
            { label: "Người check-in hôm nay", value: stats.todayCheckIns, caption: stats.checkInChange === 0 ? "Bằng ngày hôm qua" : `${stats.checkInChange > 0 ? "+" : ""}${stats.checkInChange} so với hôm qua`, tone: stats.checkInChange >= 0 ? "positive" : "danger", onClick: onOpenCheckIns },
            { label: "Hội viên mới tháng này", value: stats.newCustomersThisMonth, caption: "Đăng ký mới trong tháng", onClick: onOpenCustomers },
            { label: "Khung giờ đông nhất", value: busiestHour ? `${busiestHour.hour}h` : "—", caption: busiestHour ? `${busiestHour.count} lượt check-in` : "Chưa có dữ liệu hôm nay", onClick: onOpenCheckIns },
            ...(!isCentral ? [{ label: "Công việc còn lại", value: String(stats.pendingTasksCount).padStart(2, "0"), caption: stats.upcomingTask ? `${stats.upcomingTask.timeSlot} · ${stats.upcomingTask.task}` : "Trong ca hôm nay", tone: stats.upcomingTask ? "danger" : "positive", trend: "down", onClick: onOpenTasks }] : []),
          ];

  const attentionItems = isPT
    ? [
        { title: `${Math.max(0, dashboardData.ptStats.target - dashboardData.ptStats.achieved)} buổi còn thiếu`, caption: "Để hoàn thành chỉ tiêu tháng", onClick: onOpenWorkouts },
        { title: `${dashboardData.ptStats.retentionRate}% tỷ lệ giữ chân`, caption: "Theo nhóm khách đang phụ trách", onClick: () => navigate("/customers") },
        { title: `${dashboardData.ptStats.newClients} khách mới`, caption: "Cần lên lịch buổi đầu", onClick: () => navigate("/customers") },
      ]
    : isSale
      ? [
          { title: `${formatCurrency(Math.max(0, dashboardData.saleStats.revenue.target - dashboardData.saleStats.revenue.achieved))}đ còn thiếu`, caption: "Để hoàn thành chỉ tiêu doanh số", onClick: () => navigate("/commissions") },
          { title: `${Math.max(0, dashboardData.saleStats.newContracts.target - dashboardData.saleStats.newContracts.achieved)} hợp đồng mới`, caption: "Khoảng cách tới mục tiêu tháng", onClick: () => navigate("/leads") },
          { title: `${Math.max(0, dashboardData.saleStats.renewContracts.target - dashboardData.saleStats.renewContracts.achieved)} gói gia hạn`, caption: "Cần hoàn thành trong tháng", onClick: () => navigate("/leads") },
        ]
    : isCentral
      ? [
          { title: `${stats.expiringContracts7Days} hợp đồng sắp hết hạn`, caption: "Trong 7 ngày tới", onClick: () => navigate("/customers") },
          { title: `${stats.paymentAttentionCount} thanh toán cần kiểm tra`, caption: "Hồ sơ cọc hoặc chưa thanh toán", onClick: () => navigate("/customers") },
          { title: `${stats.activeMembers} hội viên còn hiệu lực`, caption: `${stats.newContractsThisMonth} mới · ${stats.renewContractsThisMonth} gia hạn trong tháng`, onClick: onOpenCustomers },
        ]
      : [
          { title: stats.pendingTasksCount ? `${stats.pendingTasksCount} công việc chưa hoàn thành` : "Công việc ca đã hoàn thành", caption: "Theo danh sách vận hành hôm nay", onClick: onOpenTasks },
          { title: `${stats.expiringContracts7Days} hợp đồng sắp hết hạn`, caption: "Cần chăm sóc trong 7 ngày tới", onClick: () => navigate("/customers") },
          { title: `${stats.paymentAttentionCount} thanh toán cần kiểm tra`, caption: "Hồ sơ cọc hoặc chưa thanh toán", onClick: () => navigate("/customers") },
        ];

  return (
    <div className="space-y-5">
      <div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted-light dark:text-text-muted-dark">{ROLE_LABELS[role]} · {getShiftLabel()}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text-light dark:text-text-dark">{pageTitle}</h1>
          <p className="mt-1 text-sm capitalize text-text-muted-light dark:text-text-muted-dark">{formatToday()}</p>
        </div>
      </div>

      <MetricStrip items={metrics} />

      {hasRevenueMetric && !isPT && !isSale ? (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <PeakHoursChart peakHours={peakHours} onOpen={onOpenCheckIns} />
            <IssuesPanel stats={stats} onOpen={onOpenCustomers} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <LongAbsentMembersPanel members={stats.longAbsentMembers} total={stats.longAbsentCount} onOpen={onOpenCustomers} />
            <RevenueByPackagePanel data={stats.revenueByPackage} onOpen={onOpenRevenue} />
            <ActivityFeed title="Hoạt động gần đây" subtitle="Đăng ký, thanh toán và check-in" activities={activities} onOpen={(activity) => {
              if (activity?.type === "registration") onOpenCustomers();
              else if (activity?.type === "payment") onOpenRevenue();
              else onOpenCheckIns();
            }} />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            {isPT ? (
              <ActivityFeed title="Buổi dạy gần đây" subtitle="Các buổi tập đã được ghi nhận" activities={activities} mode="pt" onOpen={onOpenWorkouts} />
            ) : isSale ? (
              <ActivityFeed title="Hợp đồng gần đây" subtitle="Hoạt động bán hàng mới nhất" activities={activities} mode="sale" onOpen={() => navigate("/leads")} />
            ) : (
              <PeakHoursChart peakHours={peakHours} onOpen={onOpenCheckIns} />
            )}
            {isCentral ? <AttentionPanel items={attentionItems} /> : <TasksPanel enabled onOpenAll={onOpenTasks} onChanged={onTasksChanged} />}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {isPT ? (
              <ProgressPanel title="Tiến độ buổi dạy" achieved={dashboardData.ptStats.achieved} target={dashboardData.ptStats.target} percentage={dashboardData.ptStats.percentage} secondary={`${dashboardData.ptStats.retentionRate}% tỷ lệ giữ chân khách`} onOpen={onOpenWorkouts} />
            ) : isSale ? (
              <ProgressPanel title="Tiến độ doanh số" achieved={`${formatCurrency(dashboardData.saleStats.revenue.achieved)}đ`} target={`${formatCurrency(dashboardData.saleStats.revenue.target)}đ`} percentage={dashboardData.saleStats.revenue.percentage} secondary={`${getDaysLeftInMonth()} ngày còn lại trong tháng`} onOpen={() => navigate("/commissions")} />
            ) : (
              <NewMembersPanel members={stats.newCustomersList} onOpen={onOpenCustomers} />
            )}
            {isCentral ? (
              <ContractHealthPanel stats={stats} onOpen={() => navigate("/customers")} />
            ) : (
              <AttentionPanel items={attentionItems} />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default RoleDashboardView;
