import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Package,
  Users,
  Calendar,
  DollarSign,
  AlertTriangle,
  Clock,
  Shield,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import reportService from "../../services/reportService";
import toast from "react-hot-toast";

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount || 0);
};

const AuditLogSettings = () => {
  const [subTab, setSubTab] = useState("logs"); // "logs" | "alerts"

  // States cho Audit Logs
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");

  // States cho Cảnh báo vận hành
  const [notificationsSummary, setNotificationsSummary] = useState(null);
  const [alertsLoading, setAlertsLoading] = useState(false);

  // Fetch Audit Logs
  const fetchAuditLogs = async (page = 1, search = "") => {
    try {
      setAuditLoading(true);
      const res = await reportService.getAuditLogs({ page, limit: 10, search });
      if (res && res.success && res.data) {
        setAuditLogs(res.data.logs || []);
        setAuditTotalPages(res.data.totalPages || 1);
        setAuditPage(res.data.currentPage || 1);
      }
    } catch (error) {
      console.error("Lỗi lấy nhật ký kiểm toán:", error);
      toast.error("Không thể tải danh sách nhật ký kiểm toán");
    } finally {
      setAuditLoading(false);
    }
  };

  // Fetch Alerts Summary
  const fetchAlerts = async () => {
    try {
      setAlertsLoading(true);
      const res = await reportService.getNotificationsSummary();
      if (res && res.success) {
        setNotificationsSummary(res.data);
      }
    } catch (err) {
      console.error("Lỗi lấy cảnh báo vận hành:", err);
      toast.error("Không thể tải dữ liệu cảnh báo vận hành");
    } finally {
      setAlertsLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === "logs") {
      fetchAuditLogs(auditPage, auditSearch);
    } else {
      fetchAlerts();
    }
  }, [subTab, auditPage, auditSearch]);

  return (
    <div className="space-y-6">
      {/* Header & Sub-tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border-light dark:border-border-dark">
        <div>
          <h3 className="text-lg font-bold text-text-light dark:text-text-dark flex items-center gap-2">
            <ShieldAlert size={20} className="text-primary" /> Nhật ký & Cảnh báo Hệ thống
          </h3>
          <p className="text-xs text-text-muted-light dark:text-text-muted-dark mt-0.5">
            Giám sát toàn bộ thao tác thêm/sửa/xóa của nhân sự và theo dõi các rủi ro vận hành trọng yếu.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex p-1 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-xs">
            <button
              onClick={() => setSubTab("logs")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                subTab === "logs"
                  ? "bg-primary text-white shadow-sm"
                  : "text-text-muted-light dark:text-text-muted-dark hover:text-text-light"
              }`}
            >
              <FileText size={14} /> Nhật ký kiểm toán
            </button>
            <button
              onClick={() => setSubTab("alerts")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                subTab === "alerts"
                  ? "bg-primary text-white shadow-sm"
                  : "text-text-muted-light dark:text-text-muted-dark hover:text-text-light"
              }`}
            >
              <AlertTriangle size={14} /> Cảnh báo vận hành
            </button>
          </div>

          <button
            onClick={() => {
              if (subTab === "logs") fetchAuditLogs(auditPage, auditSearch);
              else fetchAlerts();
            }}
            title="Làm mới dữ liệu"
            className="p-2 rounded-xl border border-border-light dark:border-border-dark text-text-muted-light dark:text-text-muted-dark hover:text-text-light hover:bg-background-light dark:hover:bg-background-dark transition-colors"
          >
            <RefreshCw size={15} className={auditLoading || alertsLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* ================= PHẦN 1: NHẬT KÝ KIỂM TOÁN (AUDIT LOGS) ================= */}
      {subTab === "logs" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm nhân viên, hành động..."
                value={auditSearch}
                onChange={(e) => {
                  setAuditSearch(e.target.value);
                  setAuditPage(1);
                }}
                className="w-full h-10 pl-9 pr-4 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-xs text-text-light dark:text-text-dark focus:outline-none focus:border-primary"
              />
            </div>
            <div className="text-xs font-semibold text-text-muted-light dark:text-text-muted-dark self-end sm:self-auto">
              Trang {auditPage} / {auditTotalPages}
            </div>
          </div>

          <div className="border border-border-light dark:border-border-dark rounded-xl overflow-hidden bg-surface-light dark:bg-surface-dark shadow-sm">
            {auditLoading ? (
              <div className="p-12 text-center text-xs text-text-muted-light dark:text-text-muted-dark space-y-2">
                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
                <p>Đang tải nhật ký kiểm toán...</p>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="p-12 text-center text-xs text-text-muted-light dark:text-text-muted-dark">
                Không tìm thấy nhật ký kiểm toán nào phù hợp.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-background-light/70 dark:bg-background-dark/70 text-text-muted-light dark:text-text-muted-dark border-b border-border-light dark:border-border-dark font-bold">
                    <tr>
                      <th className="p-3.5 w-44">Thời gian</th>
                      <th className="p-3.5 w-48">Nhân viên</th>
                      <th className="p-3.5">Hành động</th>
                      <th className="p-3.5 text-center w-24">Thao tác</th>
                      <th className="p-3.5 w-48">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light dark:divide-border-dark font-medium">
                    {auditLogs.map((log) => (
                      <tr key={log._id} className="hover:bg-background-light/40 dark:hover:bg-background-dark/40">
                        <td className="p-3.5 font-mono text-[11px] text-text-muted-light dark:text-text-muted-dark">
                          {new Date(log.createdAt).toLocaleString("vi-VN")}
                        </td>
                        <td className="p-3.5">
                          <span className="font-bold text-text-light dark:text-text-dark">{log.username || "Hệ thống"}</span>
                          {log.user?.role && (
                            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-mono uppercase rounded bg-primary/10 text-primary border border-primary/20">
                              {log.user.role}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-text-light dark:text-text-dark font-normal">
                          {log.action}
                        </td>
                        <td className="p-3.5 text-center">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${
                              log.method === "POST"
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/50"
                                : log.method === "PUT"
                                ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200/50"
                                : "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200/50"
                            }`}
                          >
                            {log.method === "POST" ? "Thêm" : log.method === "PUT" ? "Sửa" : "Xóa"}
                          </span>
                        </td>
                        <td className="p-3.5 text-[11px]">
                          <details className="cursor-pointer group">
                            <summary className="text-primary hover:underline font-semibold select-none">
                              Xem chi tiết
                            </summary>
                            <pre className="mt-2 p-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg text-[10px] font-mono text-text-muted-light dark:text-text-muted-dark max-h-32 overflow-x-auto whitespace-pre-wrap">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {auditTotalPages > 1 && (
              <div className="p-3.5 border-t border-border-light dark:border-border-dark flex items-center justify-between text-xs">
                <span className="text-text-muted-light dark:text-text-muted-dark">
                  Tổng {auditTotalPages} trang
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAuditPage((p) => Math.max(p - 1, 1))}
                    disabled={auditPage === 1 || auditLoading}
                    className="h-8 px-3 rounded-lg border border-border-light dark:border-border-dark text-text-light dark:text-text-dark hover:bg-background-light dark:hover:bg-background-dark disabled:opacity-40 flex items-center gap-1 font-medium transition-colors"
                  >
                    <ChevronLeft size={14} /> Trước
                  </button>
                  <button
                    onClick={() => setAuditPage((p) => Math.min(p + 1, auditTotalPages))}
                    disabled={auditPage >= auditTotalPages || auditLoading}
                    className="h-8 px-3 rounded-lg border border-border-light dark:border-border-dark text-text-light dark:text-text-dark hover:bg-background-light dark:hover:bg-background-dark disabled:opacity-40 flex items-center gap-1 font-medium transition-colors"
                  >
                    Sau <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= PHẦN 2: CẢNH BÁO VẬN HÀNH (OPERATIONAL ALERTS) ================= */}
      {subTab === "alerts" && (
        <div className="space-y-6">
          {alertsLoading ? (
            <div className="p-16 text-center text-xs text-text-muted-light dark:text-text-muted-dark space-y-2">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
              <p>Đang kiểm tra dữ liệu cảnh báo vận hành...</p>
            </div>
          ) : !notificationsSummary ? (
            <div className="p-12 text-center text-xs text-text-muted-light dark:text-text-muted-dark">
              Không có dữ liệu cảnh báo vận hành.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* 1. Cảnh báo tồn kho */}
              <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark overflow-hidden shadow-sm flex flex-col h-[340px]">
                <div className="p-3.5 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-xs">
                    <Package size={16} /> Sản phẩm sắp hết hàng
                  </div>
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-rose-600 text-white rounded-full">
                    {notificationsSummary.lowStockProductsCount || 0}
                  </span>
                </div>
                <div className="p-3 overflow-y-auto divide-y divide-border-light dark:divide-border-dark flex-1 text-xs">
                  {notificationsSummary.lowStockProducts?.length > 0 ? (
                    notificationsSummary.lowStockProducts.map((p) => (
                      <div key={p._id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-text-light dark:text-text-dark">{p.name}</p>
                          <p className="text-[11px] text-text-muted-light dark:text-text-muted-dark">
                            Ngưỡng: {p.minStockAlert || 5} SP
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 font-bold text-[11px]">
                          Còn {p.stockQuantity} SP
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-text-muted-light dark:text-text-muted-dark text-xs">
                      Kho hàng an toàn, không có mặt hàng dưới ngưỡng.
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Hội viên sắp hết hạn */}
              <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark overflow-hidden shadow-sm flex flex-col h-[340px]">
                <div className="p-3.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                    <Users size={16} /> Hội viên sắp hết hạn (14 ngày)
                  </div>
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-amber-600 text-white rounded-full">
                    {notificationsSummary.expiringCustomersCount || 0}
                  </span>
                </div>
                <div className="p-3 overflow-y-auto divide-y divide-border-light dark:divide-border-dark flex-1 text-xs">
                  {notificationsSummary.expiringCustomers?.length > 0 ? (
                    notificationsSummary.expiringCustomers.map((c) => (
                      <div key={c._id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-text-light dark:text-text-dark">{c.name}</p>
                          <p className="text-[11px] text-text-muted-light dark:text-text-muted-dark">
                            {c.phone} • {c.packageType}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 font-bold text-[11px]">
                          {new Date(c.endDate).toLocaleDateString("vi-VN")}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-text-muted-light dark:text-text-muted-dark text-xs">
                      Không có hội viên sắp hết hạn trong 14 ngày tới.
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Ca trực hôm nay chưa làm */}
              <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark overflow-hidden shadow-sm flex flex-col h-[340px]">
                <div className="p-3.5 bg-blue-500/10 border-b border-blue-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs">
                    <Calendar size={16} /> Ca trực chưa làm hôm nay
                  </div>
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-600 text-white rounded-full">
                    {notificationsSummary.pendingTasksCount || 0}
                  </span>
                </div>
                <div className="p-3 overflow-y-auto divide-y divide-border-light dark:divide-border-dark flex-1 text-xs">
                  {notificationsSummary.pendingTasks?.length > 0 ? (
                    notificationsSummary.pendingTasks.map((t) => (
                      <div key={t._id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-text-light dark:text-text-dark">{t.title}</p>
                          <p className="text-[11px] text-text-muted-light dark:text-text-muted-dark">
                            NV: {t.staffName}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 font-bold text-[11px]">
                          {t.timeSlot}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-text-muted-light dark:text-text-muted-dark text-xs">
                      Tất cả ca trực hôm nay đã hoàn thành tốt.
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Hoa hồng chờ duyệt */}
              <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark overflow-hidden shadow-sm flex flex-col h-[340px]">
                <div className="p-3.5 bg-purple-500/10 border-b border-purple-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold text-xs">
                    <DollarSign size={16} /> Hoa hồng chờ phê duyệt
                  </div>
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-purple-600 text-white rounded-full">
                    {notificationsSummary.pendingCommissionsCount || 0}
                  </span>
                </div>
                <div className="p-3 overflow-y-auto divide-y divide-border-light dark:divide-border-dark flex-1 text-xs">
                  {notificationsSummary.pendingCommissions?.length > 0 ? (
                    notificationsSummary.pendingCommissions.map((c, idx) => (
                      <div key={idx} className="py-2.5 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-text-light dark:text-text-dark">
                            T{c.month}/{c.year} • {c.type === "pt" ? "HLV PT" : "Nhân viên Sale"}
                          </p>
                          <p className="text-[11px] text-text-muted-light dark:text-text-muted-dark">
                            Chờ quản lý kiểm duyệt
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 font-bold text-[11px]">
                          {formatCurrency(c.totalAmount)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-text-muted-light dark:text-text-muted-dark text-xs">
                      Không có kỳ hoa hồng nào tồn đọng.
                    </div>
                  )}
                </div>
              </div>

              {/* 5. Cảnh báo KPI yếu */}
              <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark overflow-hidden shadow-sm flex flex-col h-[340px] md:col-span-2">
                <div className="p-3.5 bg-yellow-500/10 border-b border-yellow-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 font-bold text-xs">
                    <AlertTriangle size={16} /> Cảnh báo nhân viên KPI yếu (&lt; 50% cuối tháng)
                  </div>
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-yellow-600 text-white rounded-full">
                    {notificationsSummary.lowKPIStaffCount || 0}
                  </span>
                </div>
                <div className="p-3 overflow-y-auto divide-y divide-border-light dark:divide-border-dark flex-1 text-xs">
                  {notificationsSummary.lowKPIStaff?.length > 0 ? (
                    notificationsSummary.lowKPIStaff.map((s) => (
                      <div key={s._id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-text-light dark:text-text-dark">
                            {s.fullName} ({s.role.toUpperCase()})
                          </p>
                          <p className="text-[11px] text-text-muted-light dark:text-text-muted-dark">
                            Thực tế: {s.role === "pt" ? `${s.actual} buổi` : formatCurrency(s.actual)} / Mục tiêu:{" "}
                            {s.role === "pt" ? `${s.target} buổi` : formatCurrency(s.target)}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 font-bold text-xs">
                          Đạt {s.percentage}%
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-text-muted-light dark:text-text-muted-dark text-xs">
                      Tất cả nhân viên đang bám sát chỉ tiêu KPI tốt.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AuditLogSettings;
