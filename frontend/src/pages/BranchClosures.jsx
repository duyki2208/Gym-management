import React, { useState, useEffect, useRef } from "react";
import {
  CalendarOff,
  Plus,
  RefreshCw,
  Mail,
  RotateCcw,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Paperclip,
  X,
  Send,
  Users,
  ShieldCheck,
  ChevronRight,
  Info,
  Calendar,
} from "lucide-react";
import { closureService } from "../services/closureService";
import toast from "react-hot-toast";
import { format } from "date-fns";

const BranchClosures = ({ embedded = false }) => {
  const [closures, setClosures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isMailOpen, setIsMailOpen] = useState(false);
  const [isReverseOpen, setIsReverseOpen] = useState(false);

  const [selectedClosure, setSelectedClosure] = useState(null);
  const [closureDetailData, setClosureDetailData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Form Create State
  const [createForm, setCreateForm] = useState({
    title: "",
    startDate: "",
    endDate: "",
    type: "planned",
    reason: "",
  });
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // Form Mail State
  const [mailSubject, setMailSubject] = useState("");
  const [mailBody, setMailBody] = useState("");
  const [mailFile, setMailFile] = useState(null);
  const [sendingMail, setSendingMail] = useState(false);
  const bodyTextareaRef = useRef(null);

  // Reverse state
  const [submittingReverse, setSubmittingReverse] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem("gym_user") || "{}");
  const activeBranch = currentUser.activeBranch || currentUser.branchCode || "HN01";

  const fetchClosures = async () => {
    try {
      setLoading(true);
      const res = await closureService.getAll();
      if (res && res.success) {
        setClosures(res.data || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Lỗi tải danh sách đóng cửa");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchClosures();
  }, []);

  // Tính toán Preview khi ngày bắt đầu hoặc ngày kết thúc thay đổi
  useEffect(() => {
    if (!createForm.startDate || !createForm.endDate) {
      setPreviewData(null);
      return;
    }

    if (new Date(createForm.endDate) < new Date(createForm.startDate)) {
      setPreviewData(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoadingPreview(true);
        const res = await closureService.preview({
          startDate: createForm.startDate,
          endDate: createForm.endDate,
        });
        if (res && res.success) {
          setPreviewData(res.data);
        }
      } catch (err) {
        console.error("Lỗi preview bù hạn:", err);
      } finally {
        setLoadingPreview(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [createForm.startDate, createForm.endDate]);

  // Xử lý tạo sự kiện đóng cửa
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.title.trim() || !createForm.startDate || !createForm.endDate || !createForm.reason.trim()) {
      toast.error("Vui lòng điền đầy đủ các thông tin bắt buộc");
      return;
    }

    try {
      setSubmittingCreate(true);
      const res = await closureService.create(createForm);
      if (res && res.success) {
        toast.success(res.message || "Tạo sự kiện đóng cửa & bù hạn thành công!");
        setIsCreateOpen(false);
        setCreateForm({
          title: "",
          startDate: "",
          endDate: "",
          type: "planned",
          reason: "",
        });
        setPreviewData(null);
        fetchClosures();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Lỗi tạo sự kiện đóng cửa");
    } finally {
      setSubmittingCreate(false);
    }
  };

  // Xem chi tiết
  const handleOpenDetail = async (closure) => {
    setSelectedClosure(closure);
    setIsDetailOpen(true);
    try {
      setLoadingDetail(true);
      const res = await closureService.getDetails(closure._id);
      if (res && res.success) {
        setClosureDetailData(res.data);
      }
    } catch (err) {
      toast.error("Không thể tải chi tiết sự kiện");
    } finally {
      setLoadingDetail(false);
    }
  };

  // Mở modal soạn mail
  const handleOpenMail = (closure) => {
    setSelectedClosure(closure);
    const formattedStart = format(new Date(closure.startDate), "dd/MM/yyyy");
    const formattedEnd = format(new Date(closure.endDate), "dd/MM/yyyy");

    setMailSubject(`[Thông báo] Tạm dừng hoạt động chi nhánh {{ten_chi_nhanh}} từ ${formattedStart} đến ${formattedEnd}`);
    setMailBody(
`Kính gửi Quý hội viên {{ten_khach_hang}},

Ban Quản Lý phòng tập xin thông báo về việc tạm đóng cửa cơ sở {{ten_chi_nhanh}} để phục vụ công tác: ${closure.reason}.

- Thời gian tạm đóng: Từ ngày {{ngay_dong}} đến hết ngày {{ngay_mo}}.
- Nhằm đảm bảo quyền lợi tốt nhất cho Quý hội viên, hệ thống đã tự động bù thêm hạn sử dụng cho gói tập của bạn.
- Ngày hết hạn hợp đồng mới của bạn là: {{han_moi}}.

Chúng tôi xin gửi kèm văn bản thông báo chính thức có đóng dấu của ban lãnh đạo. 
Rất mong nhận được sự thông cảm từ Quý hội viên vì sự bất tiện này.

Trân trọng,
Ban Quản Lý Chi Nhánh`
    );
    setMailFile(null);
    setIsMailOpen(true);
  };

  // Chèn placeholder vào vị trí con trỏ trong textarea
  const insertPlaceholder = (tag) => {
    if (!bodyTextareaRef.current) {
      setMailBody((prev) => prev + tag);
      return;
    }

    const textarea = bodyTextareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;

    const newText = currentText.substring(0, start) + tag + currentText.substring(end);
    setMailBody(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 0);
  };

  // Xử lý gửi mail
  const handleSendMail = async (e) => {
    e.preventDefault();
    if (!mailSubject.trim() || !mailBody.trim()) {
      toast.error("Vui lòng nhập đầy đủ tiêu đề và nội dung email");
      return;
    }

    try {
      setSendingMail(true);
      const formData = new FormData();
      formData.append("subject", mailSubject.trim());
      formData.append("body", mailBody.trim());
      if (mailFile) {
        formData.append("attachment", mailFile);
      }

      const res = await closureService.sendEmail(selectedClosure._id, formData);
      if (res && res.success) {
        toast.success(res.message || "Đang tiến hành gửi email thông báo...");
        setIsMailOpen(false);
        fetchClosures();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Lỗi khi gửi email thông báo");
    } finally {
      setSendingMail(false);
    }
  };

  // Xử lý hoàn tác (Reverse)
  const handleConfirmReverse = async () => {
    if (!selectedClosure) return;
    try {
      setSubmittingReverse(true);
      const res = await closureService.reverse(selectedClosure._id);
      if (res && res.success) {
        toast.success(res.message || "Đã hoàn tác bù hạn thành công!");
        setIsReverseOpen(false);
        fetchClosures();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Lỗi khi hoàn tác bù hạn");
    } finally {
      setSubmittingReverse(false);
    }
  };

  return (
    <div className={embedded ? "space-y-6" : "space-y-6 max-w-7xl mx-auto p-4 sm:p-6"}>
      {/* Page header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-light dark:bg-surface-dark p-5 rounded-xl border border-border-light dark:border-border-dark shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2.5 text-text-light dark:text-text-dark">
            <CalendarOff size={24} className="text-primary" /> Quản lý đóng / mở chi nhánh
          </h1>
          <p className="text-subtle-light dark:text-subtle-dark text-sm mt-1">
            Ghi nhận lịch đóng cửa bảo trì, tự động bù hạn cho hội viên và gửi thông báo qua email
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            onClick={() => {
              setRefreshing(true);
              fetchClosures();
            }}
            disabled={refreshing}
            className="h-10 px-3.5 rounded-xl bg-background-light dark:bg-background-dark hover:bg-gray-100 dark:hover:bg-gray-800 text-text-light dark:text-text-dark transition-colors flex items-center gap-2 text-sm font-medium border border-border-light dark:border-border-dark cursor-pointer"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            Làm mới
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="h-10 px-4 rounded-xl bg-primary hover:bg-primary/90 text-text-light text-sm font-semibold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Plus size={18} />
            Tạo lịch đóng cửa
          </button>
        </div>
      </div>

      {/* Danh sách sự kiện đóng cửa */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden shadow-sm">
        <div className="p-5 border-b border-border-light dark:border-border-dark flex items-center justify-between">
          <h2 className="font-bold text-text-light dark:text-text-dark text-base flex items-center gap-2">
            Lịch sử các đợt đóng cửa tại chi nhánh ({closures.length})
          </h2>
          <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">
            Chi nhánh: {activeBranch}
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-text-muted-light dark:text-text-muted-dark space-y-3">
            <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
            <p className="text-sm">Đang tải danh sách sự kiện đóng cửa...</p>
          </div>
        ) : closures.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 mx-auto flex items-center justify-center">
              <CalendarOff size={28} />
            </div>
            <h3 className="text-base font-semibold text-text-light dark:text-text-dark">
              Chưa có sự kiện đóng cửa nào
            </h3>
            <p className="text-xs text-text-muted-light dark:text-text-muted-dark max-w-md mx-auto">
              Khi chi nhánh cần bảo trì hoặc có sự cố đột xuất, hãy bấm nút "Tạo sự kiện đóng cửa & Bù hạn" để hệ thống tự động cộng thêm ngày tập cho hội viên.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-light dark:border-border-dark bg-background-light/50 dark:bg-background-dark/50 text-text-muted-light dark:text-text-muted-dark text-xs tracking-wide font-semibold">
                  <th className="py-3.5 px-4">Sự kiện & Lý do</th>
                  <th className="py-3.5 px-4">Thời gian đóng cửa</th>
                  <th className="py-3.5 px-4">Phân loại</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4">Bù hạn gói tập</th>
                  <th className="py-3.5 px-4">Thông báo Email</th>
                  <th className="py-3.5 px-4 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                {closures.map((c) => {
                  const startFmt = format(new Date(c.startDate), "dd/MM/yyyy");
                  const endFmt = format(new Date(c.endDate), "dd/MM/yyyy");
                  const days =
                    Math.round(
                      (new Date(c.endDate) - new Date(c.startDate)) / (1000 * 60 * 60 * 24)
                    ) + 1;

                  return (
                    <tr
                      key={c._id}
                      className="hover:bg-background-light/40 dark:hover:bg-background-dark/40 transition-colors"
                    >
                      <td className="py-4 px-4">
                        <div className="font-semibold text-text-light dark:text-text-dark">
                          {c.title}
                        </div>
                        <div className="text-xs text-text-muted-light dark:text-text-muted-dark max-w-xs line-clamp-1">
                          {c.reason}
                        </div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="font-medium text-text-light dark:text-text-dark flex items-center gap-1.5">
                          <Calendar size={14} className="text-gray-400" />
                          {startFmt} → {endFmt}
                        </div>
                        <div className="text-xs text-text-muted-light dark:text-text-muted-dark">
                          Tổng: <strong>{days} ngày</strong>
                        </div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        {c.type === "emergency" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                            Khẩn cấp
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            Kế hoạch
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        {c.status === "active" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 size={12} /> Đang áp dụng
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-500/10 text-gray-500 border border-gray-500/20">
                            <RotateCcw size={12} /> Đã hoàn tác (Reverse)
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="text-xs font-medium text-text-light dark:text-text-dark">
                          <strong>{c.compensationStats?.totalPackagesAffected || 0}</strong> gói (
                          <strong>{c.compensationStats?.totalCustomersAffected || 0}</strong> hội viên)
                        </div>
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                          +{c.compensationStats?.totalDaysAdded || 0} ngày tổng cộng
                        </div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        {c.mailNotification?.status === "completed" ? (
                          <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                            <CheckCircle2 size={13} /> Đã gửi ({c.mailNotification.sentCount || 0})
                          </div>
                        ) : c.mailNotification?.status === "sending" ? (
                          <div className="text-xs text-blue-500 flex items-center gap-1 font-medium animate-pulse">
                            <Clock size={13} /> Đang gửi...
                          </div>
                        ) : (
                          <span className="text-xs text-text-muted-light dark:text-text-muted-dark">
                            Chưa gửi
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenDetail(c)}
                            title="Xem chi tiết danh sách gói tập"
                            className="p-1.5 rounded-lg border border-border-light dark:border-border-dark text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            <Eye size={15} />
                          </button>

                          <button
                            onClick={() => handleOpenMail(c)}
                            title="Soạn và gửi email thông báo"
                            className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors"
                          >
                            <Mail size={15} />
                          </button>

                          {c.status === "active" && (
                            <button
                              onClick={() => {
                                setSelectedClosure(c);
                                setIsReverseOpen(true);
                              }}
                              title="Hoàn tác (Reverse) bù hạn cho sự kiện này"
                              className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 transition-colors"
                            >
                              <RotateCcw size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================= MODAL TẠO SỰ KIỆN ĐÓNG CỬA ================= */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl w-full max-w-3xl overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-border-light dark:border-border-dark">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <CalendarOff size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-light dark:text-text-dark">
                    Tạo Sự kiện Đóng cửa & Bù hạn Gói tập
                  </h3>
                  <p className="text-xs text-text-muted-light dark:text-text-muted-dark">
                    Hệ thống sẽ tự động tính số ngày overlap thực tế và cộng vào ngày hết hạn của từng hội viên.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-text-muted-light hover:text-text-light dark:text-text-muted-dark dark:hover:text-text-dark p-1.5 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor="closure_title" className="block text-sm font-medium text-text-light dark:text-text-dark mb-1.5">
                    Tên sự kiện / Tiêu đề <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="closure_title"
                    type="text"
                    placeholder="Ví dụ: Bảo trì hệ thống điều hòa & sàn tập định kỳ"
                    className="w-full h-11 px-4 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="closure_start_date" className="block text-sm font-medium text-text-light dark:text-text-dark mb-1.5">
                    Ngày bắt đầu đóng cửa <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="closure_start_date"
                    type="date"
                    className="w-full h-11 px-4 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
                    value={createForm.startDate}
                    onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="closure_end_date" className="block text-sm font-medium text-text-light dark:text-text-dark mb-1.5">
                    Ngày kết thúc đóng cửa (Bao gồm) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="closure_end_date"
                    type="date"
                    className="w-full h-11 px-4 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
                    value={createForm.endDate}
                    onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="closure_type" className="block text-sm font-medium text-text-light dark:text-text-dark mb-1.5">
                    Phân loại sự kiện
                  </label>
                  <select
                    id="closure_type"
                    className="w-full h-11 px-4 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
                    value={createForm.type}
                    onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                  >
                    <option value="planned">Đóng cửa theo kế hoạch (Bảo trì định kỳ, nâng cấp)</option>
                    <option value="emergency">Đóng cửa khẩn cấp (Sự cố điện nước, thiên tai)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="closure_reason" className="block text-sm font-medium text-text-light dark:text-text-dark mb-1.5">
                    Lý do đóng cửa <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="closure_reason"
                    type="text"
                    placeholder="Nhập lý do vắn tắt để thông báo cho khách hàng"
                    className="w-full h-11 px-4 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
                    value={createForm.reason}
                    onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* CARD TÍNH TOÁN BÙ HẠN DỰ KIẾN (PREVIEW) */}
              <div className="p-4 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-muted-light dark:text-text-muted-dark flex items-center gap-1.5">
                    <Info size={14} className="text-primary" /> Dự toán tác động bù hạn tự động
                  </span>
                  {loadingPreview && (
                    <span className="text-xs text-primary animate-pulse">Đang tính toán...</span>
                  )}
                </div>

                {previewData ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-center">
                        <div className="text-xl font-bold text-primary">{previewData.totalPackages}</div>
                        <div className="text-xs text-text-muted-light dark:text-text-muted-dark">Hợp đồng overlap</div>
                      </div>
                      <div className="p-3 rounded-lg bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-center">
                        <div className="text-xl font-bold text-text-light dark:text-text-dark">{previewData.totalCustomers}</div>
                        <div className="text-xs text-text-muted-light dark:text-text-muted-dark">Hội viên được bù</div>
                      </div>
                      <div className="p-3 rounded-lg bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-center">
                        <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">+{previewData.totalDaysAdded}</div>
                        <div className="text-xs text-text-muted-light dark:text-text-muted-dark">Tổng ngày bù thêm</div>
                      </div>
                    </div>

                    {previewData.samplePreview?.length > 0 && (
                      <div className="max-h-36 overflow-y-auto border border-border-light dark:border-border-dark rounded-lg">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-gray-100 dark:bg-gray-800 text-text-muted-light dark:text-text-muted-dark sticky top-0">
                            <tr>
                              <th className="p-2">Hội viên</th>
                              <th className="p-2">Gói tập</th>
                              <th className="p-2">Bù thêm</th>
                              <th className="p-2">Hạn cũ → Hạn mới</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-light dark:divide-border-dark">
                            {previewData.samplePreview.slice(0, 10).map((s, idx) => (
                              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <td className="p-2 font-medium">{s.customerName}</td>
                                <td className="p-2">{s.packageName}</td>
                                <td className="p-2 font-bold text-emerald-600">+{s.daysToAdd} ngày</td>
                                <td className="p-2 text-gray-500">
                                  {format(new Date(s.currentEndDate), "dd/MM/yyyy")} →{" "}
                                  <strong className="text-text-light dark:text-text-dark">
                                    {format(new Date(s.projectedEndDate), "dd/MM/yyyy")}
                                  </strong>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted-light dark:text-text-muted-dark italic">
                    Vui lòng chọn ngày bắt đầu và ngày kết thúc để xem số lượng hợp đồng được bù hạn.
                  </p>
                )}
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-border-light dark:border-border-dark text-sm font-medium text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submittingCreate}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {submittingCreate ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Đang xử lý bù hạn...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      Xác nhận tạo & Bù hạn ngay
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL SOẠN EMAIL THÔNG BÁO (KIỂU GMAIL) ================= */}
      {isMailOpen && selectedClosure && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl w-full max-w-3xl overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Header kiểu Gmail */}
            <div className="flex items-center justify-between p-5 border-b border-border-light dark:border-border-dark bg-background-light/50 dark:bg-background-dark/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <Mail size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-light dark:text-text-dark">
                    Soạn Email Thông Báo Đóng Cửa
                  </h3>
                  <p className="text-xs text-text-muted-light dark:text-text-muted-dark">
                    Gửi thư thông báo tự do & đính kèm công văn chi nhánh tới các hội viên chịu ảnh hưởng
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsMailOpen(false)}
                className="text-text-muted-light hover:text-text-light dark:text-text-muted-dark dark:hover:text-text-dark p-1.5 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSendMail} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Thẻ placeholder hỗ trợ chèn nhanh */}
              <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/15 space-y-1.5">
                <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <Info size={13} /> Thẻ placeholder tự động (Bấm để chèn vào nội dung):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { tag: "{{ten_khach_hang}}", label: "Tên hội viên" },
                    { tag: "{{ten_chi_nhanh}}", label: "Tên phòng tập" },
                    { tag: "{{han_moi}}", label: "Ngày hết hạn mới" },
                    { tag: "{{ngay_dong}}", label: "Ngày đóng cửa" },
                    { tag: "{{ngay_mo}}", label: "Ngày mở lại" },
                    { tag: "{{ly_do}}", label: "Lý do đóng cửa" },
                  ].map((p) => (
                    <button
                      key={p.tag}
                      type="button"
                      onClick={() => insertPlaceholder(p.tag)}
                      className="px-2 py-1 rounded-md bg-white dark:bg-gray-800 border border-border-light dark:border-border-dark text-xs font-mono text-text-light dark:text-text-dark hover:border-blue-500 hover:text-blue-600 transition-colors"
                      title={p.label}
                    >
                      {p.tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tiêu đề */}
              <div>
                <label htmlFor="mail_subject" className="block text-xs font-medium text-text-muted-light dark:text-text-muted-dark mb-1">
                  Tiêu đề email (Subject) <span className="text-red-500">*</span>
                </label>
                <input
                  id="mail_subject"
                  type="text"
                  className="w-full h-11 px-4 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
                  value={mailSubject}
                  onChange={(e) => setMailSubject(e.target.value)}
                  required
                />
              </div>

              {/* Nội dung */}
              <div>
                <label htmlFor="mail_body" className="block text-xs font-medium text-text-muted-light dark:text-text-muted-dark mb-1">
                  Nội dung email (Body) <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="mail_body"
                  ref={bodyTextareaRef}
                  rows={8}
                  className="w-full p-4 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-normal leading-relaxed resize-y"
                  value={mailBody}
                  onChange={(e) => setMailBody(e.target.value)}
                  required
                />
              </div>

              {/* Đính kèm file Word / PDF */}
              <div>
                <label className="block text-xs font-medium text-text-muted-light dark:text-text-muted-dark mb-1.5">
                  Đính kèm file văn bản / thông báo chi nhánh (Word, PDF, ảnh)
                </label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer px-4 py-2 rounded-xl border border-dashed border-border-light dark:border-border-dark hover:border-primary bg-background-light dark:bg-background-dark text-sm font-medium text-text-light dark:text-text-dark flex items-center gap-2 transition-colors">
                    <Paperclip size={16} className="text-primary" />
                    <span>Chọn file đính kèm</span>
                    <input
                      type="file"
                      accept=".doc,.docx,.pdf,image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setMailFile(e.target.files[0]);
                        }
                      }}
                    />
                  </label>

                  {mailFile && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
                      <FileText size={14} />
                      <span className="max-w-xs truncate">{mailFile.name}</span>
                      <span className="text-gray-400">({(mailFile.size / 1024).toFixed(1)} KB)</span>
                      <button
                        type="button"
                        onClick={() => setMailFile(null)}
                        className="p-0.5 hover:text-red-500 ml-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-light dark:border-border-dark">
                <button
                  type="button"
                  onClick={() => setIsMailOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-border-light dark:border-border-dark text-sm font-medium text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={sendingMail}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {sendingMail ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Đang phát lệnh gửi...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Bắt đầu gửi email
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL CHI TIẾT SỰ KIỆN & GÓI TẬP ================= */}
      {isDetailOpen && selectedClosure && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl w-full max-w-4xl overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-border-light dark:border-border-dark shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Eye size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-light dark:text-text-dark">
                    Chi Tiết Sự Kiện: {selectedClosure.title}
                  </h3>
                  <p className="text-xs text-text-muted-light dark:text-text-muted-dark">
                    Danh sách các hợp đồng hội viên đã nhận bù hạn trong đợt này
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="text-text-muted-light hover:text-text-light dark:text-text-muted-dark dark:hover:text-text-dark p-1.5 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Thống kê vắn tắt */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-xs">
                <div>
                  <span className="text-gray-400 block">Thời gian:</span>
                  <span className="font-semibold text-text-light dark:text-text-dark">
                    {format(new Date(selectedClosure.startDate), "dd/MM/yyyy")} → {format(new Date(selectedClosure.endDate), "dd/MM/yyyy")}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block">Lý do:</span>
                  <span className="font-semibold text-text-light dark:text-text-dark">{selectedClosure.reason}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Hợp đồng đã bù:</span>
                  <span className="font-semibold text-primary">{selectedClosure.compensationStats?.totalPackagesAffected || 0} gói</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Tổng ngày bù:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">+{selectedClosure.compensationStats?.totalDaysAdded || 0} ngày</span>
                </div>
              </div>

              {/* Bảng danh sách hợp đồng */}
              {loadingDetail ? (
                <div className="p-8 text-center text-xs text-text-muted-light dark:text-text-muted-dark">
                  Đang tải danh sách hợp đồng...
                </div>
              ) : closureDetailData?.affectedPackages?.length === 0 ? (
                <div className="p-8 text-center text-xs text-text-muted-light dark:text-text-muted-dark">
                  Không có hợp đồng nào được bù hạn trong đợt này.
                </div>
              ) : (
                <div className="border border-border-light dark:border-border-dark rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-background-light/80 dark:bg-background-dark/80 text-text-muted-light dark:text-text-muted-dark border-b border-border-light dark:border-border-dark">
                      <tr>
                        <th className="p-3">Hội viên</th>
                        <th className="p-3">Số điện thoại / Email</th>
                        <th className="p-3">Gói tập</th>
                        <th className="p-3">Mã HĐ</th>
                        <th className="p-3">Bù thêm</th>
                        <th className="p-3">Hạn cũ → Hạn mới</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light dark:divide-border-dark">
                      {closureDetailData?.affectedPackages?.map((pkg) => (
                        <tr key={pkg._id} className="hover:bg-background-light/40 dark:hover:bg-background-dark/40">
                          <td className="p-3 font-semibold text-text-light dark:text-text-dark">
                            {pkg.customerName}
                          </td>
                          <td className="p-3 text-text-muted-light dark:text-text-muted-dark">
                            <div>{pkg.customerPhone || "—"}</div>
                            <div className="text-[11px] text-gray-400">{pkg.customerEmail || "—"}</div>
                          </td>
                          <td className="p-3 font-medium text-primary">{pkg.packageName}</td>
                          <td className="p-3 font-mono">{pkg.contractCode}</td>
                          <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400">
                            +{pkg.daysAdded} ngày
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {pkg.previousEndDate ? format(new Date(pkg.previousEndDate), "dd/MM/yyyy") : "—"} →{" "}
                            <strong className="text-text-light dark:text-text-dark">
                              {pkg.newEndDate ? format(new Date(pkg.newEndDate), "dd/MM/yyyy") : "—"}
                            </strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border-light dark:border-border-dark flex justify-end shrink-0">
              <button
                onClick={() => setIsDetailOpen(false)}
                className="px-5 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm font-medium text-text-light dark:text-text-dark hover:bg-gray-200 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL XÁC NHẬN HOÀN TÁC (REVERSE) ================= */}
      {isReverseOpen && selectedClosure && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl w-full max-w-md overflow-hidden shadow-xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
              <AlertTriangle size={26} />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-text-light dark:text-text-dark">
                Xác nhận Hoàn tác (Reverse) Bù hạn?
              </h3>
              <p className="text-xs text-text-muted-light dark:text-text-muted-dark leading-relaxed">
                Hành động này sẽ <strong>thu hồi lại số ngày đã bù</strong> cho toàn bộ{" "}
                <strong>{selectedClosure.compensationStats?.totalPackagesAffected || 0} hợp đồng</strong> thuộc sự kiện{" "}
                <strong>"{selectedClosure.title}"</strong>. Ngày hết hạn của hội viên sẽ được khôi phục về trạng thái trước khi đóng cửa.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsReverseOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-border-light dark:border-border-dark text-sm font-medium text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmReverse}
                disabled={submittingReverse}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {submittingReverse ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Đang hoàn tác...
                  </>
                ) : (
                  <>
                    <RotateCcw size={16} />
                    Xác nhận hoàn tác
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchClosures;
