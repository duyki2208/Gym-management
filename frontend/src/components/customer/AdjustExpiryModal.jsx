import React, { useState, useEffect } from "react";
import { Calendar, History, Clock, CheckCircle, ShieldAlert } from "lucide-react";
import { customerService } from "../../services/customerService";
import toast from "react-hot-toast";
import { format } from "date-fns";
import BaseModal from "../common/BaseModal";
import FormField, { inputClassName } from "../common/FormField";
import Button from "../common/Button";

const AdjustExpiryModal = ({ isOpen, onClose, customerPackage, customerName, onSuccess }) => {
  const [newEndDate, setNewEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

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
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Điều chỉnh Hạn Gói Tập"
      subtitle="Thay đổi ngày hết hạn trực tiếp & lưu vết kiểm toán (Audit Trail) - Quyền Admin"
      icon={<Calendar size={22} />}
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy bỏ
          </Button>
          <Button
            type="submit"
            form="adjustExpiryForm"
            variant="primary"
            disabled={submitting || daysDiff === 0}
            icon={CheckCircle}
          >
            {submitting ? "Đang lưu..." : "Xác nhận lưu thay đổi"}
          </Button>
        </>
      }
    >
      <form id="adjustExpiryForm" onSubmit={handleSubmit} className="space-y-5">
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
          <FormField id="adjust_new_end_date" label="Ngày hết hạn mới" required>
            <input
              id="adjust_new_end_date"
              type="date"
              className={inputClassName}
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              required
            />
          </FormField>

          <FormField id="adjust_reason" label="Lý do điều chỉnh" required>
            <textarea
              id="adjust_reason"
              rows={2}
              placeholder="Nhập lý do điều chỉnh hạn (ví dụ: Bù hạn sự cố kỹ thuật, thỏa thuận CSKH cá nhân...)"
              className={`${inputClassName} resize-none`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </FormField>
        </div>

        {/* Cảnh báo kiểm toán */}
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
          <ShieldAlert size={16} className="shrink-0 mt-0.5 text-amber-500" />
          <p>
            Hành động này sẽ được ghi nhận vĩnh viễn vào <strong>Lịch sử điều chỉnh hạn</strong> và <strong>Nhật ký hệ thống</strong> kèm tài khoản Admin đang thực hiện.
          </p>
        </div>

        {/* Lịch sử các lần chỉnh sửa trước */}
        <div className="border-t border-border-light dark:border-border-dark pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-text-muted-light dark:text-text-muted-dark flex items-center gap-1.5">
              <History size={14} /> Lịch sử điều chỉnh gói này ({historyList.length})
            </h4>
          </div>

          {loadingHistory ? (
            <div className="text-center py-4 text-xs text-text-muted-light dark:text-text-muted-dark">
              Đang tải lịch sử...
            </div>
          ) : historyList.length === 0 ? (
            <div className="text-center py-4 text-xs text-text-muted-light dark:text-text-muted-dark bg-background-light/40 dark:bg-background-dark/40 rounded-xl border border-dashed border-border-light dark:border-border-dark">
              Chưa có lần điều chỉnh thủ công nào cho gói này.
            </div>
          ) : (
            <div className="max-h-40 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {historyList.map((item) => (
                <div
                  key={item._id}
                  className="p-2.5 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-xs flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text-light dark:text-text-dark">
                        {format(new Date(item.oldEndDate), "dd/MM/yyyy")} → {format(new Date(item.newEndDate), "dd/MM/yyyy")}
                      </span>
                      <span
                        className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${
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
      </form>
    </BaseModal>
  );
};

export default AdjustExpiryModal;
