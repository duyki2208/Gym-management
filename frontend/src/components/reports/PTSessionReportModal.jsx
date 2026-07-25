import React, { useState, useEffect } from "react";
import reportService from "../../services/reportService";
import { staffService } from "../../services/customerService";
import toast from "react-hot-toast";

const PTSessionReportModal = ({ isOpen, onClose, userRole }) => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [ptId, setPtId] = useState("all");
  const [ptList, setPtList] = useState([]);

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [selectedSession, setSelectedSession] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchPTList();
      fetchReport();
    }
  }, [isOpen, month, year, ptId]);

  const fetchPTList = async () => {
    try {
      const staff = await staffService.getAll();
      const pts = staff.filter((s) => s.role === "pt" || s.role === "pm");
      setPtList(pts);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await reportService.getPTSessionsReport({ month, year, ptId });
      if (res.success) {
        setReportData(res.data);
      }
    } catch (error) {
      console.error("Lỗi lấy báo cáo buổi tập PT:", error);
      toast.error("Không thể tải báo cáo buổi tập");
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      toast.loading("Đang xuất file Excel đối soát buổi tập...", { id: "pt-excel" });
      await reportService.exportPTSessionsExcel({ month, year, ptId });
      toast.success("Xuất file Excel đối soát thành công!", { id: "pt-excel" });
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi xuất file Excel", { id: "pt-excel" });
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    try {
      toast.loading("Đang cập nhật trạng thái...", { id: "period-status" });
      const res = await reportService.updatePeriodStatus({
        periodId: reportData?.periodId,
        month,
        year,
        type: "pt",
        status: newStatus,
      });
      if (res.success) {
        toast.success(`Đã cập nhật trạng thái thành "${newStatus}"`, { id: "period-status" });
        fetchReport();
      }
    } catch (error) {
      console.error(error);
      toast.error("Lỗi cập nhật trạng thái", { id: "period-status" });
    }
  };

  const handleOpenDispute = (session) => {
    setSelectedSession(session);
    setDisputeReason("");
    setDisputeModalOpen(true);
  };

  const handleSubmitDispute = async () => {
    if (!disputeReason.trim()) {
      toast.error("Vui lòng nhập lý do khiếu nại!");
      return;
    }
    try {
      toast.loading("Đang gửi khiếu nại...", { id: "pt-dispute" });
      const res = await reportService.submitPTDispute({
        month,
        year,
        workoutLogId: selectedSession?._id,
        reason: disputeReason,
      });
      if (res.success) {
        toast.success("Đã gửi khiếu nại đối soát thành công!", { id: "pt-dispute" });
        setDisputeModalOpen(false);
        fetchReport();
      }
    } catch (error) {
      console.error(error);
      toast.error("Lỗi gửi khiếu nại đối soát", { id: "pt-dispute" });
    }
  };

  if (!isOpen) return null;

  const statusBadges = {
    draft: { label: "Bản nháp (Draft)", cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
    sent_for_review: { label: "Chờ PT đối soát", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
    pt_confirmed: { label: "PT đã xác nhận", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
    disputed: { label: "Khiếu nại đối soát", cls: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 animate-pulse" },
    approved: { label: "Đã duyệt chốt", cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
    paid: { label: "Đã thanh toán", cls: "bg-green-600 text-white font-bold" },
  };

  const currentBadge = statusBadges[reportData?.periodStatus || "draft"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto font-display">
      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light dark:border-border-dark bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xl">
              📋
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Báo Cáo Buổi Tập Chi Tiết & Đối Soát PT
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Đối soát 2 chiều giữa Ban quản lý và PT trước khi chốt lương
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
          >
            ✕
          </button>
        </div>

        {/* Filter Bar */}
        <div className="p-4 border-b border-border-light dark:border-border-dark flex items-center justify-between gap-4 flex-wrap bg-white dark:bg-gray-900">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Tháng / Năm */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Kỳ:</span>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-bold bg-gray-50 dark:bg-gray-800 dark:text-white"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-bold bg-gray-50 dark:bg-gray-800 dark:text-white"
              >
                {[2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Chọn PT */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-600 dark:text-gray-300">PT:</span>
              <select
                value={ptId}
                onChange={(e) => setPtId(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-bold bg-gray-50 dark:bg-gray-800 dark:text-white min-w-[150px]"
              >
                <option value="all">-- Tất cả PT --</option>
                {ptList.map((pt) => (
                  <option key={pt._id} value={pt._id}>
                    {pt.fullName || pt.username}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Badge */}
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${currentBadge.cls}`}>
              {currentBadge.label}
            </span>

            {/* Export Excel Button */}
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              Xuất File Đối Soát
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          {/* Summary Box */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex flex-col gap-1">
              <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Tổng số buổi đã hoàn thành</span>
              <span className="text-2xl font-black text-emerald-800 dark:text-emerald-200">
                {reportData?.totalSessions || 0} buổi
              </span>
            </div>
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex flex-col gap-1">
              <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">Đơn giá trung bình / buổi</span>
              <span className="text-2xl font-black text-blue-800 dark:text-blue-200">
                {(reportData?.sessionRate || 500000).toLocaleString("vi-VN")}đ
              </span>
            </div>
            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl flex flex-col gap-1">
              <span className="text-xs text-purple-700 dark:text-purple-300 font-medium">Hoa hồng dự kiến ({reportData?.commissionRate || 10}%)</span>
              <span className="text-2xl font-black text-purple-800 dark:text-purple-200">
                {(reportData?.estimatedCommission || 0).toLocaleString("vi-VN")}đ
              </span>
            </div>
          </div>

          {/* Disputes List Warning (if any) */}
          {reportData?.disputes?.length > 0 && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl">
              <h4 className="text-sm font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5 mb-2">
                ⚠️ Có {reportData.disputes.length} khiếu nại buổi tập cần xử lý:
              </h4>
              <div className="flex flex-col gap-2">
                {reportData.disputes.map((disp, idx) => (
                  <div key={idx} className="p-2.5 bg-white dark:bg-gray-900 rounded-lg text-xs border border-rose-100 dark:border-rose-900/50 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-gray-800 dark:text-gray-200">Lý do: </span>
                      <span className="text-gray-600 dark:text-gray-300">{disp.reason}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      {disp.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table of Workout Sessions */}
          <div className="border border-border-light dark:border-border-dark rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold border-b border-border-light dark:border-border-dark">
                <tr>
                  <th className="p-3 text-center w-12">STT</th>
                  <th className="p-3">Ngày & Giờ</th>
                  <th className="p-3">Khách hàng</th>
                  <th className="p-3">PT Phụ Trách</th>
                  <th className="p-3">Xác nhận bởi</th>
                  <th className="p-3 text-center">Trạng thái</th>
                  <th className="p-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark bg-white dark:bg-gray-900">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500">Đang tải danh sách buổi tập...</td>
                  </tr>
                ) : reportData?.sessions?.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500">Không có dữ liệu buổi tập trong kỳ này</td>
                  </tr>
                ) : (
                  reportData?.sessions?.map((s, idx) => {
                    const dt = new Date(s.date);
                    return (
                      <tr key={s._id || idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="p-3 text-center font-bold text-gray-500">{idx + 1}</td>
                        <td className="p-3 font-semibold text-gray-900 dark:text-white">
                          {dt.toLocaleDateString("vi-VN")} - {dt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-gray-900 dark:text-white">{s.customer?.name || "N/A"}</div>
                          <div className="text-[11px] text-gray-500">{s.customer?.code} - {s.customer?.phone}</div>
                        </td>
                        <td className="p-3 font-medium text-emerald-700 dark:text-emerald-400">
                          {s.pt?.fullName || s.ptName || "PT"}
                        </td>
                        <td className="p-3 text-gray-600 dark:text-gray-300">
                          {s.confirmedBy?.fullName || "Lễ tân"}
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                            ✅ Confirmed
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleOpenDispute(s)}
                            className="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:text-rose-800 border border-rose-300 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all"
                          >
                            Khiếu nại
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Workflow Action Controls */}
        <div className="p-4 border-t border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-900 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-gray-500">
            Quy trình: Draft ➔ Sent for review ➔ PT Confirmed / Disputed ➔ Approved ➔ Paid
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleUpdateStatus("sent_for_review")}
              className="px-3.5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-sm"
            >
              📤 Gửi PT Đối Soát
            </button>

            <button
              onClick={() => handleUpdateStatus("pt_confirmed")}
              className="px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm"
            >
              ✅ PT Xác Nhận Ok
            </button>

            <button
              onClick={() => handleUpdateStatus("approved")}
              className="px-3.5 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition-all shadow-sm"
            >
              🔒 Duyệt & Lock Kỳ Hoa Hồng
            </button>

            <button
              onClick={() => handleUpdateStatus("paid")}
              className="px-3.5 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition-all shadow-sm"
            >
              💰 Đánh Dấu Đã Chi Trả
            </button>
          </div>
        </div>
      </div>

      {/* Mini Modal Gửi Khiếu Nại */}
      {disputeModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl max-w-md w-full flex flex-col gap-4 shadow-xl border border-gray-200 dark:border-gray-800">
            <h4 className="text-base font-bold text-gray-900 dark:text-white">Khiếu Nại Buổi Tập</h4>
            <p className="text-xs text-gray-500">
              Buổi tập ngày: {selectedSession?.date ? new Date(selectedSession.date).toLocaleDateString("vi-VN") : ""} — Khách: {selectedSession?.customer?.name}
            </p>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Nhập lý do khiếu nại (ví dụ: Buổi dạy bị tính thiếu, sai thời gian, khách tập lại...)"
              className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-xl text-xs bg-gray-50 dark:bg-gray-800 dark:text-white h-24 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDisputeModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
              >
                Hủy
              </button>
              <button
                onClick={handleSubmitDispute}
                className="px-4 py-2 text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 rounded-xl shadow-sm"
              >
                Gửi Khiếu Nại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PTSessionReportModal;
