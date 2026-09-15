import React, { useState, useEffect } from "react";
import { Calendar, AlertCircle, History, Clock, CheckCircle, ShieldAlert, X } from "lucide-react";
import { customerService } from "../../services/customerService";
import toast from "react-hot-toast";
import { format } from "date-fns";

const AdjustExpiryModal = ({ isOpen, onClose, customerPackage, customerName, onSuccess }) => {
  const [newEndDate, setNewEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (isOpen && customerPackage) {
      const currentEnd = customerPackage.endDate
        ? new Date(customerPackage.endDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];

      setNewEndDate(currentEnd);
      setReason("");
      fetchHistory();
    }
  }, [isOpen, customerPackage]);

  const fetchHistory = async () => {
    if (!customerPackage?._id) return;
    try {
      setLoadingHistory(true);
      const res = await customerService.getExtensionHistory(customerPackage._id);
      if (res && res.success) {
        setHistoryList(res.data || []);
      }
    } catch (err) {
      console.error("Lỗi lấy lịch sử sửa hạn:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  if (!isOpen || !customerPackage) return null;

  const currentEndDate = customerPackage.endDate ? new Date(customerPackage.endDate) : new Date();
  const currentFormatted = format(currentEndDate, "dd/MM/yyyy");

  let daysDiff = 0;
  if (newEndDate) {
    const target = new Date(newEndDate);
    const startOfCurrent = new Date(currentEndDate);
    startOfCurrent.setHours(0, 0, 0, 0);
    const startOfTarget = new Date(target);
    startOfTarget.setHours(0, 0, 0, 0);

    const diffMs = startOfTarget.getTime() - startOfCurrent.getTime();
    daysDiff = Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newEndDate) {
      toast.error("Vui lòng chọn ngày hết hạn mới");
      return;
    }
    if (!reason.trim()) {
      toast.error("Vui lòng nhập lý do điều chỉnh ngày hết hạn");
      return;
    }

    try {
      setSubmitting(true);
      const res = await customerService.adjustExpiry(customerPackage._id, newEndDate, reason.trim());
      if (res && res.success) {
        toast.success(res.message || "Điều chỉnh ngày hết hạn thành công!");
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Lỗi khi điều chỉnh ngày hết hạn");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-light dark:border-border-dark bg-background-light/50 dark:bg-background-dark/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Calendar size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-light dark:text-text-dark flex items-center gap-2">
                Điều chỉnh Hạn Gói Tập
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 font-medium">
                  Chỉ quyền Admin
                </span>
              </h3>
              <p className="text-xs text-text-muted-light dark:text-text-muted-dark">
                Thay đổi ngày hết hạn trực tiếp & lưu vết kiểm toán (Audit Trail)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted-light hover:text-text-light dark:text-text-muted-dark dark:hover:text-text-dark transition-colors p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Thông tin gói tập hiện tại */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-sm">
            <div>
              <span className="text-xs text-text-muted-light dark:text-text-muted-dark block">Hội viên:</span>
              <span className="font-semibold text-text-light dark:text-text-dark">{customerName || "—"}</span>
            </div>
            <div>
              <span className="text-xs text-text-muted-light dark:text-text-muted-dark block">Gói tập:</span>
              <span className="font-semibold text-primary">{customerPackage.packageName}</span>
            </div>
            <div>
              <span className="text-xs text-text-muted-light dark:text-text-muted-dark block">Mã hợp đồng:</span>
              <span className="font-mono text-text-light dark:text-text-dark">{customerPackage.contractCode || "HĐ-MỚI"}</span>
            </div>
            <div>
              <span className="text-xs text-text-muted-light dark:text-text-muted-dark block">Hạn hiện tại:</span>
              <span className="font-bold text-red-500">{currentFormatted}</span>
            </div>
            <div className="col-span-2">
              <span className="text-xs text-text-muted-light dark:text-text-muted-dark block">Biến động ngày:</span>
              {daysDiff > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  Gia hạn thêm +{daysDiff} ngày
                </span>
              ) : daysDiff < 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                  Rút ngắn {Math.abs(daysDiff)} ngày
                </span>
              ) : (
                <span className="text-xs text-gray-400 font-medium">Chưa thay đổi</span>
              )}
            </div>
          </div>

          {/* Form chọn ngày mới & lý do */}
          <div className="space-y-4">
            <div>
              <label htmlFor="adjust_new_end_date" className="block text-sm font-medium text-text-light dark:text-text-dark mb-1.5">
                Ngày hết hạn mới <span className="text-red-500">*</span>
              </label>
              <input
                id="adjust_new_end_date"
                type="date"
                className="w-full h-11 px-4 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="adjust_reason" className="block text-sm font-medium text-text-light dark:text-text-dark mb-1.5">
                Lý do điều chỉnh <span className="text-red-500">*</span>
              </label>
              <textarea
                id="adjust_reason"
                rows={2}
                placeholder="Nhập lý do điều chỉnh hạn (ví dụ: Bù hạn sự cố kỹ thuật, thỏa thuận CSKH cá nhân...)"
                className="w-full p-3 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm resize-none"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Cảnh báo kiểm toán */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
            <ShieldAlert size={16} className="shrink-0 mt-0.5 text-amber-500" />
            <p>
              Hành động này sẽ được ghi nhận vĩnh viễn vào <strong>Lịch sử điều chỉnh hạn</strong> và <strong>Nhật ký hệ thống</strong> kèm tài khoản Admin đang thực hiện.
            </p>
          </div>

          {/* Lịch sử các lần chỉnh sửa trước */}
          <div className="border-t border-border-light dark:border-border-dark pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted-light dark:text-text-muted-dark flex items-center gap-1.5">
                <History size={14} /> Lịch sử điều chỉnh gói này ({historyList.length})
              </h4>
            </div>

            {loadingHistory ? (
              <div className="text-center py-4 text-xs text-text-muted-light dark:text-text-muted-dark">
                Đang tải lịch sử...
              </div>
            ) : historyList.length === 0 ? (
              <div className="text-center py-4 text-xs text-text-muted-light dark:text-text-muted-dark bg-background-light/40 dark:bg-background-dark/40 rounded-lg border border-dashed border-border-light dark:border-border-dark">
                Chưa có lần điều chỉnh thủ công nào cho gói này.
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                {historyList.map((item) => (
                  <div
                    key={item._id}
                    className="p-2.5 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-xs flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-text-light dark:text-text-dark">
                          {format(new Date(item.oldEndDate), "dd/MM/yyyy")} → {format(new Date(item.newEndDate), "dd/MM/yyyy")}
                        </span>
                        <span
                          className={`font-mono text-[11px] font-bold px-1.5 py-0.2 rounded ${
                            item.daysDifference >= 0
                              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                              : "text-amber-600 dark:text-amber-400 bg-amber-500/10"
                          }`}
                        >
                          {item.daysDifference >= 0 ? `+${item.daysDifference}` : item.daysDifference} ngày
                        </span>
                      </div>
                      <p className="text-text-muted-light dark:text-text-muted-dark italic">"{item.reason}"</p>
                    </div>
                    <div className="text-right shrink-0 text-[11px] text-text-muted-light dark:text-text-muted-dark">
                      <div>{item.performedBy?.fullName || "Admin"}</div>
                      <div>{format(new Date(item.createdAt), "dd/MM/yyyy HH:mm")}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer nút hành động */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-border-light dark:border-border-dark text-sm font-medium text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submitting || daysDiff === 0}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-all shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  Xác nhận lưu thay đổi
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdjustExpiryModal;
