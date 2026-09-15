import React, { useState, useEffect, useRef } from "react";
import {
  Building2,
  Coins,
  ShieldCheck,
  Bell,
  UserCheck,
  CreditCard,
  Camera,
  Save,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  QrCode,
  Shield,
  Layers,
  MapPin,
  HelpCircle,
  Mail,
  Send,
  MessageSquare,
  FileText,
  Paperclip,
  Copy,
  ExternalLink,
  Check,
  Info,
  Smartphone,
  CheckSquare,
  Square,
  Sparkles,
  Edit3,
  Loader2,
  Users,
  CalendarOff,
  ShieldAlert,
} from "lucide-react";
import api from "../services/api";
import { settingsService } from "../services/settingsService";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import BranchClosures from "./BranchClosures";
import AuditLogSettings from "../components/settings/AuditLogSettings";

// Component NumberField
const NumberField = ({ label, value, onChange, hint, suffix, disabled, name, min, max, step }) => {
  const inputClass =
    "w-full h-11 px-4 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium";
  const labelClass = "block text-sm font-medium text-text-light dark:text-text-dark mb-1.5";
  const hintClass = "text-xs text-text-muted-light dark:text-text-muted-dark mt-1";
  const fieldId = name || (label ? `field_${label.toLowerCase().replace(/[^a-z0-9]/g, "_")}` : "number_field");

  return (
    <div>
      <label htmlFor={fieldId} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={fieldId}
          name={fieldId}
          type="number"
          min={min}
          max={max}
          step={step}
          className={inputClass}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
        {suffix && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-text-muted-light dark:text-text-muted-dark">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className={hintClass}>{hint}</p>}
    </div>
  );
};

// Component Switch Toggle
const SwitchToggle = ({ label, description, checked, onChange, disabled }) => {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark">
      <div className="space-y-0.5">
        <div className="text-sm font-semibold text-text-light dark:text-text-dark">{label}</div>
        {description && (
          <div className="text-xs text-text-muted-light dark:text-text-muted-dark">{description}</div>
        )}
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
      </label>
    </div>
  );
};

// Danh sách các quyền hệ thống hỗ trợ phân quyền tương tác
const SYSTEM_PERMISSIONS = [
  { id: "view_dashboard", label: "Xem Trang tổng quan (Dashboard)", group: "Tổng quan" },
  { id: "manage_customers", label: "Quản lý Hội viên & Hợp đồng", group: "Hội viên" },
  { id: "manage_leads", label: "Quản lý Khách tiềm năng (CRM Leads)", group: "Hội viên" },
  { id: "checkin", label: "Check-in khuôn mặt & thẻ", group: "Vận hành" },
  { id: "pos_sell", label: "Bán hàng bán lẻ (POS)", group: "Vận hành" },
  { id: "deduct_workout", label: "Trừ buổi tập PT của khách", group: "Vận hành" },
  { id: "manage_workouts", label: "Xem lịch dạy & buổi tập PT", group: "Vận hành" },
  { id: "view_reports", label: "Xem Báo cáo doanh thu & hiệu suất", group: "Báo cáo" },
  { id: "view_financials", label: "Xem Dòng tiền & Sổ quỹ chi tiết", group: "Báo cáo" },
  { id: "manage_staff", label: "Quản lý Nhân sự & Phân ca", group: "Hệ thống" },
  { id: "view_commissions", label: "Xem bảng tính hoa hồng", group: "Hệ thống" },
  { id: "manage_closures", label: "Quản lý đóng/mở chi nhánh & Bù hạn", group: "Hệ thống" },
];

const DEFAULT_ROLE_PERMISSIONS = {
  manager: [
    "view_dashboard",
    "manage_customers",
    "manage_leads",
    "checkin",
    "pos_sell",
    "deduct_workout",
    "manage_workouts",
    "view_reports",
    "view_financials",
    "manage_staff",
    "view_commissions",
    "manage_closures",
  ],
  accountant: ["view_dashboard", "view_reports", "view_financials", "pos_sell", "view_commissions"],
  sale: ["view_dashboard", "manage_leads", "manage_customers", "checkin", "pos_sell", "view_commissions"],
  pt: ["view_dashboard", "checkin", "manage_workouts", "view_commissions"],
  reception: ["view_dashboard", "checkin", "manage_customers", "pos_sell", "deduct_workout"],
};

const Settings = () => {
  const { user } = useAuth();
  const currentBranchCode = user?.activeBranch || user?.branchCode || "HN01";

  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "accountant";

  // === 1. THÔNG TIN CHUNG & CHỈ TIÊU DOANH THU ===
  const [gymName, setGymName] = useState("Gym Admin Fitness");
  const [address, setAddress] = useState("123 Đường ABC, Quận 1");
  const [targetRevenue, setTargetRevenue] = useState(100000000);

  // === 2. HOA HỒNG & KPI ===
  const [ptSessionPrice, setPtSessionPrice] = useState(500000);
  const [ptCommissionRate, setPtCommissionRate] = useState(10);
  const [saleNewContractRate, setSaleNewContractRate] = useState(5);
  const [saleRenewRate, setSaleRenewRate] = useState(3);
  const [saleUpsellRate, setSaleUpsellRate] = useState(4);

  const [ptMonthlySessionTarget, setPtMonthlySessionTarget] = useState(80);
  const [saleMonthlyRevenueTarget, setSaleMonthlyRevenueTarget] = useState(100000000);
  const [saleMonthlyContractTarget, setSaleMonthlyContractTarget] = useState(20);
  const [saleMonthlyRenewTarget, setSaleMonthlyRenewTarget] = useState(15);

  // === 3. VẬN HÀNH ===
  const [gymCapacity, setGymCapacity] = useState(50);
  const [minStockAlert, setMinStockAlert] = useState(5);
  const [transferFee, setTransferFee] = useState(1000000);

  // === 4. NHẮC NHỞ TỰ ĐỘNG & MẪU TIN NHẮN (EMAIL & ZALO) ===
  const [sendExpiryReminder, setSendExpiryReminder] = useState(true);
  const [expiryReminderDays, setExpiryReminderDays] = useState(14);
  const [sendInactiveReminder, setSendInactiveReminder] = useState(false);
  const [inactiveDays, setInactiveDays] = useState(30);

  const [activeReminderSubTab, setActiveReminderSubTab] = useState("expiry");
  const [reminderTemplates, setReminderTemplates] = useState({
    expiry: {
      subject: "[Gym Fitness] Nhắc nhở: Gói tập của bạn sắp hết hạn sau {{so_ngay}} ngày",
      body: "Xin chào {{ten_khach_hang}},\n\nGym Fitness xin thông báo gói tập {{ten_goi_tap}} của bạn tại chi nhánh {{ten_chi_nhanh}} sẽ hết hạn vào ngày {{ngay_het_han}}.\n\nĐể không gián đoạn quá trình tập luyện, vui lòng liên hệ quầy lễ tân để được hỗ trợ gia hạn sớm nhất!",
      attachmentName: "",
      enableEmail: true,
      enableZalo: false,
      zaloTemplateId: "ZNS_EXPIRY_REMINDER_01",
    },
    inactive: {
      subject: "[Gym Fitness] Lâu rồi chưa thấy bạn ghé phòng tập!",
      body: "Xin chào {{ten_khach_hang}},\n\nĐã {{so_ngay}} ngày rồi chúng tôi chưa được đón tiếp bạn tại chi nhánh {{ten_chi_nhanh}}.\n\nHãy dành chút thời gian ghé phòng tập để tiếp tục duy trì sức khỏe và vóc dáng nhé!",
      attachmentName: "",
      enableEmail: true,
      enableZalo: false,
      zaloTemplateId: "ZNS_INACTIVE_CARE_02",
    },
    registration: {
      subject: "[Gym Fitness] Xác nhận đăng ký thành công gói tập - Chào mừng {{ten_khach_hang}}!",
      body: "Xin chào {{ten_khach_hang}},\n\nChúc mừng bạn đã đăng ký thành công gói tập {{ten_goi_tap}} với hạn sử dụng đến {{ngay_het_han}}.\n\nChúc bạn có những giờ phút tập luyện hiệu quả và tràn đầy năng lượng!",
      attachmentName: "",
      enableEmail: true,
      enableZalo: false,
      zaloTemplateId: "ZNS_WELCOME_NEW_03",
    },
  });

  // === 4.1 SOẠN TAY THÔNG BÁO TỨC THỜI (MANUAL COMPOSE) ===
  const [manualAudience, setManualAudience] = useState("all"); // 'all', 'active', 'expiring_soon', 'expired', 'custom'
  const [manualCustomRecipient, setManualCustomRecipient] = useState("");
  const [manualSubject, setManualSubject] = useState("[Gym Fitness] Thông báo đặc biệt từ Ban Quản Lý");
  const [manualBody, setManualBody] = useState(
    "Kính gửi {{ten_khach_hang}},\n\nBan quản lý phòng tập {{ten_chi_nhanh}} xin trân trọng gửi thông báo tới quý hội viên:\n\n[Nhập nội dung thông báo cụ thể tại đây]\n\nMọi thắc mắc hoặc cần hỗ trợ thêm, vui lòng liên hệ quầy lễ tân hoặc hotline của chi nhánh.\n\nTrân trọng cảm ơn quý hội viên!"
  );
  const [manualChannels, setManualChannels] = useState({ email: true, zalo: false });
  const [manualAttachment, setManualAttachment] = useState(null);
  const [manualSending, setManualSending] = useState(false);

  // === 5. PHÂN QUYỀN TƯƠNG TÁC (RBAC MATRIX) ===
  const [rolePermissions, setRolePermissions] = useState(DEFAULT_ROLE_PERMISSIONS);

  // === 6. THANH TOÁN (VIETQR & SEPAY & POS) ===
  const [vietqrBank, setVietqrBank] = useState("MBBank");
  const [vietqrAccountNo, setVietqrAccountNo] = useState("");
  const [vietqrAccountName, setVietqrAccountName] = useState("");
  const [posTerminalId, setPosTerminalId] = useState("");
  const [sepayApiKey, setSepayApiKey] = useState("");

  // === 7. THIẾT BỊ NHẬN DIỆN KHUÔN MẶT ===
  const [faceAiServerUrl, setFaceAiServerUrl] = useState("http://localhost:5001");
  const [faceMatchThreshold, setFaceMatchThreshold] = useState(0.6);
  const [cameraRtspUrl, setCameraRtspUrl] = useState("");

  // Nạp cấu hình theo chi nhánh đang active trên thanh Header
  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await settingsService.get(currentBranchCode);
      if (res && res.success && res.data) {
        const d = res.data;
        // Tab 1
        setGymName(d.gymName || "Gym Admin Fitness");
        setAddress(d.address || "");
        setTargetRevenue(d.targetRevenue ?? 100000000);
        // Tab 2
        setPtSessionPrice(d.ptSessionPrice ?? 500000);
        setPtCommissionRate(d.ptCommissionRate ?? 10);
        setSaleNewContractRate(d.saleNewContractRate ?? 5);
        setSaleRenewRate(d.saleRenewRate ?? 3);
        setSaleUpsellRate(d.saleUpsellRate ?? 4);
        setPtMonthlySessionTarget(d.ptMonthlySessionTarget ?? 80);
        setSaleMonthlyRevenueTarget(d.saleMonthlyRevenueTarget ?? 100000000);
        setSaleMonthlyContractTarget(d.saleMonthlyContractTarget ?? 20);
        setSaleMonthlyRenewTarget(d.saleMonthlyRenewTarget ?? 15);
        // Tab 3
        setGymCapacity(d.gymCapacity ?? 50);
        setMinStockAlert(d.minStockAlert ?? 5);
        setTransferFee(d.transferFee ?? 1000000);
        // Tab 4
        setSendExpiryReminder(d.sendExpiryReminder !== false);
        setExpiryReminderDays(d.expiryReminderDays ?? 14);
        setSendInactiveReminder(Boolean(d.sendInactiveReminder));
        setInactiveDays(d.inactiveDays ?? 30);
        if (d.reminderTemplates) {
          setReminderTemplates((prev) => ({
            ...prev,
            ...d.reminderTemplates,
          }));
        }
        // Tab 5
        if (d.rolePermissions) {
          setRolePermissions((prev) => ({
            ...prev,
            ...d.rolePermissions,
          }));
        }
        // Tab 6
        setVietqrBank(d.vietqrBank || "MBBank");
        setVietqrAccountNo(d.vietqrAccountNo || "");
        setVietqrAccountName(d.vietqrAccountName || "");
        setPosTerminalId(d.posTerminalId || "");
        setSepayApiKey(d.sepayApiKey || "");
        // Tab 7
        setFaceAiServerUrl(d.faceAiServerUrl || "http://localhost:5001");
        setFaceMatchThreshold(d.faceMatchThreshold ?? 0.6);
        setCameraRtspUrl(d.cameraRtspUrl || "");
      }
    } catch (error) {
      console.error("Lỗi nạp cấu hình:", error);
      toast.error("Không thể tải cấu hình chi nhánh");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [currentBranchCode]);

  // Lưu cài đặt
  const handleSave = async () => {
    if (!isAdmin) {
      toast.error("Bạn không có quyền thay đổi cài đặt hệ thống!");
      return;
    }
    if (!gymName.trim()) {
      toast.error("Tên phòng tập không được để trống!");
      return;
    }

    try {
      setSaving(true);
      const res = await settingsService.update(
        {
          gymName,
          address,
          targetRevenue: Number(targetRevenue),
          ptSessionPrice: Number(ptSessionPrice),
          ptCommissionRate: Number(ptCommissionRate),
          saleNewContractRate: Number(saleNewContractRate),
          saleRenewRate: Number(saleRenewRate),
          saleUpsellRate: Number(saleUpsellRate),
          ptMonthlySessionTarget: Number(ptMonthlySessionTarget),
          saleMonthlyRevenueTarget: Number(saleMonthlyRevenueTarget),
          saleMonthlyContractTarget: Number(saleMonthlyContractTarget),
          saleMonthlyRenewTarget: Number(saleMonthlyRenewTarget),
          gymCapacity: Number(gymCapacity),
          minStockAlert: Number(minStockAlert),
          transferFee: Number(transferFee),
          sendExpiryReminder,
          expiryReminderDays: Number(expiryReminderDays),
          sendInactiveReminder,
          inactiveDays: Number(inactiveDays),
          reminderTemplates,
          rolePermissions,
          vietqrBank,
          vietqrAccountNo,
          vietqrAccountName,
          posTerminalId,
          sepayApiKey,
          faceAiServerUrl,
          faceMatchThreshold: Number(faceMatchThreshold),
          cameraRtspUrl,
        },
        currentBranchCode
      );

      if (res && res.success) {
        toast.success(`Đã lưu cài đặt cho cơ sở [${currentBranchCode}] thành công!`);
        window.dispatchEvent(
          new CustomEvent("branch-settings-updated", {
            detail: { gymName, address, branchCode: currentBranchCode },
          })
        );
      }
    } catch (error) {
      toast.error(error.message || "Lỗi khi lưu cài đặt");
    } finally {
      setSaving(false);
    }
  };

  // Helper toggle permission cho role
  const handleTogglePermission = (role, permId) => {
    if (!isAdmin) return;
    setRolePermissions((prev) => {
      const currentList = prev[role] || [];
      const hasPerm = currentList.includes(permId);
      const updatedList = hasPerm
        ? currentList.filter((p) => p !== permId)
        : [...currentList, permId];
      return {
        ...prev,
        [role]: updatedList,
      };
    });
  };

  // Khôi phục quyền mặc định
  const handleResetPermissions = () => {
    setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
    toast.success("Đã khôi phục ma trận phân quyền mặc định. Nhớ bấm 'Lưu cấu hình' để ghi nhớ.");
  };

  // Chèn placeholder vào template hiện tại
  const insertReminderPlaceholder = (tag) => {
    setReminderTemplates((prev) => {
      const current = prev[activeReminderSubTab] || {};
      return {
        ...prev,
        [activeReminderSubTab]: {
          ...current,
          body: (current.body || "") + tag,
        },
      };
    });
  };

  // Chèn placeholder vào nội dung soạn tay
  const insertManualPlaceholder = (tag) => {
    setManualBody((prev) => (prev || "") + tag);
  };

  // Phát lệnh gửi thông báo thủ công (Email & Zalo)
  const handleSendManualNotification = async () => {
    if (!manualSubject.trim()) {
      toast.error("Vui lòng nhập tiêu đề thông báo!");
      return;
    }
    if (!manualBody.trim()) {
      toast.error("Vui lòng nhập nội dung thông báo!");
      return;
    }
    if (!manualChannels.email && !manualChannels.zalo) {
      toast.error("Vui lòng chọn ít nhất một kênh gửi (Email hoặc Zalo)!");
      return;
    }
    if (manualAudience === "custom" && !manualCustomRecipient.trim()) {
      toast.error("Vui lòng nhập địa chỉ Email hoặc Số điện thoại người nhận!");
      return;
    }

    try {
      setManualSending(true);
      const formData = new FormData();
      formData.append("targetAudience", manualAudience);
      if (manualAudience === "custom") {
        formData.append("customRecipient", manualCustomRecipient.trim());
      }
      formData.append("subject", manualSubject.trim());
      formData.append("body", manualBody.trim());

      const channels = [];
      if (manualChannels.email) channels.push("email");
      if (manualChannels.zalo) channels.push("zalo");
      formData.append("channels", channels.join(","));

      if (manualAttachment) {
        formData.append("attachment", manualAttachment);
      }

      const res = await api.post("/notifications/send-manual", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data?.success) {
        toast.success(res.data.message || "Đã phát lệnh gửi thông báo thành công!");
        setManualAttachment(null);
      } else {
        toast.error(res.data?.message || "Không thể gửi thông báo");
      }
    } catch (err) {
      console.error("Lỗi phát thông báo tay:", err);
      toast.error(err.response?.data?.message || err.message || "Lỗi khi gửi thông báo");
    } finally {
      setManualSending(false);
    }
  };

  // Menu bên trái dạng Dọc (Vertical Menu Navigation)
  const MENU_GROUPS = [
    {
      title: "Kinh doanh & Vận hành",
      items: [
        { id: "general", label: "Thông tin cơ sở", icon: Building2 },
        { id: "commission", label: "Hoa hồng & KPI", icon: Coins },
        { id: "operations", label: "Vận hành cơ sở", icon: ShieldCheck },
        { id: "closures", label: "Đóng/mở chi nhánh", icon: CalendarOff },
      ],
    },
    {
      title: "Tự động hóa",
      items: [
        { id: "reminders", label: "Thông báo tự động", icon: Bell },
      ],
    },
    {
      title: "Tài chính & Thiết bị",
      items: [
        { id: "payment", label: "Cổng thanh toán", icon: CreditCard },
        { id: "faceai", label: "Thiết bị nhận diện AI", icon: Camera },
      ],
    },
    {
      title: "Bảo mật & Quản trị",
      items: [
        { id: "rbac", label: "Phân quyền tài khoản", icon: UserCheck },
        { id: "audit", label: "Nhật ký & Cảnh báo", icon: ShieldAlert },
      ],
    },
  ];

  const inputClass =
    "w-full h-11 px-4 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium";
  const labelClass = "block text-sm font-medium text-text-light dark:text-text-dark mb-1.5";

  // Webhook URL cho SePay
  const webhookUrl = `${window.location.origin}/api/v1/pos/webhook`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-light dark:bg-surface-dark p-6 rounded-2xl border border-border-light dark:border-border-dark shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-text-light dark:text-text-dark">Cài đặt Hệ thống</h1>
            
          </div>
          <p className="text-xs text-text-muted-light dark:text-text-muted-dark">
            Cấu hình các tham số vận hành, mẫu nhắc nhở và phân quyền áp dụng riêng cho chi nhánh hiện tại.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="h-10 px-5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-all shadow-lg shadow-primary/25 disabled:opacity-50 flex items-center gap-2 self-start sm:self-auto"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Đang lưu...
            </>
          ) : (
            <>
              <Save size={16} />
              Lưu tất cả cấu hình
            </>
          )}
        </button>
      </div>

      {/* Main Layout 2 Cột (Master - Detail) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* CỘT TRÁI: MENU DỌC (VERTICAL SIDEBAR) */}
        <div className="lg:col-span-4 xl:col-span-3 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-2xl p-4 shadow-sm space-y-6">
          {MENU_GROUPS.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted-light dark:text-text-muted-dark px-3 mb-1">
                {group.title}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                        isActive
                          ? "bg-primary text-white font-semibold shadow-md shadow-primary/20"
                          : "text-text-light dark:text-text-dark hover:bg-background-light dark:hover:bg-background-dark text-text-muted-light dark:text-text-muted-dark hover:text-text-light dark:hover:text-text-dark"
                      }`}
                    >
                      <Icon size={17} className={isActive ? "text-white" : "text-gray-400"} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* CỘT PHẢI: NỘI DUNG CẤU HÌNH CHI TIẾT */}
        <div className="lg:col-span-8 xl:col-span-9 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-2xl p-6 shadow-sm min-h-[520px]">
          {loading ? (
            <div className="p-16 text-center text-text-muted-light dark:text-text-muted-dark space-y-3">
              <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
              <p className="text-sm">Đang nạp cấu hình cơ sở {currentBranchCode}...</p>
            </div>
          ) : (
            <>
              {/* ================= 1. THÔNG TIN CƠ SỞ ================= */}
              {activeTab === "general" && (
                <div className="space-y-6 max-w-2xl">
                  <div>
                    <h3 className="text-lg font-bold text-text-light dark:text-text-dark mb-1 flex items-center gap-2">
                      <Building2 size={20} className="text-primary" /> Thông tin cơ sở
                    </h3>
                   
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="gym_name" className={labelClass}>
                        Tên phòng tập / Chi nhánh <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="gym_name"
                        type="text"
                        className={inputClass}
                        value={gymName}
                        onChange={(e) => setGymName(e.target.value)}
                        placeholder="Gym Admin Fitness - Cầu Giấy"
                      />
                    </div>

                    <div>
                      <label htmlFor="gym_addr" className={labelClass}>
                        Địa chỉ chi nhánh
                      </label>
                      <input
                        id="gym_addr"
                        type="text"
                        className={inputClass}
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Số 123 Đường Cầu Giấy, Hà Nội"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ================= 2. HOA HỒNG & KPI ================= */}
              {activeTab === "commission" && (
                <div className="space-y-6 max-w-2xl">
                  <div>
                    <h3 className="text-lg font-bold text-text-light dark:text-text-dark mb-1 flex items-center gap-2">
                      <Coins size={20} className="text-primary" /> Chính sách Hoa hồng & KPI Mặc định
                    </h3>
                    
                  </div>

                  <div className="space-y-6">
                    {/* Chỉ tiêu doanh thu tháng của cơ sở (Đưa lên đầu theo yêu cầu) */}
                    <div className="p-4 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark space-y-2">
                      <NumberField
                        label="Chỉ tiêu doanh thu tháng của cơ sở"
                        value={targetRevenue}
                        onChange={setTargetRevenue}
                        suffix="VNĐ"
                        
                        min="0"
                      />
                    </div>
                    <div className="p-4 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark space-y-4">
                      <h4 className="text-sm font-bold text-primary flex items-center gap-1.5">
                        <Coins size={16} /> Chính sách Hoa hồng PT
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <NumberField
                          label="Giá buổi PT tiêu chuẩn"
                          value={ptSessionPrice}
                          onChange={setPtSessionPrice}
                          suffix="VNĐ"
                          hint="Đơn giá cơ sở tính thưởng mỗi buổi dạy"
                          min="0"
                        />
                        <NumberField
                          label="Tỷ lệ hoa hồng buổi dạy"
                          value={ptCommissionRate}
                          onChange={setPtCommissionRate}
                          suffix="%"
                          hint="Phần trăm hoa hồng trên mỗi buổi hoàn tất"
                          min="0"
                          max="100"
                        />
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark space-y-4">
                      <h4 className="text-sm font-bold text-primary flex items-center gap-1.5">
                        <Coins size={16} /> Chính sách Hoa hồng Sale
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <NumberField
                          label="Hợp đồng mới"
                          value={saleNewContractRate}
                          onChange={setSaleNewContractRate}
                          suffix="%"
                          min="0"
                          max="100"
                        />
                        <NumberField
                          label="Tái ký gói tập"
                          value={saleRenewRate}
                          onChange={setSaleRenewRate}
                          suffix="%"
                          min="0"
                          max="100"
                        />
                        <NumberField
                          label="Nâng cấp / Upsell"
                          value={saleUpsellRate}
                          onChange={setSaleUpsellRate}
                          suffix="%"
                          min="0"
                          max="100"
                        />
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark space-y-4">
                      <h4 className="text-sm font-bold text-primary flex items-center gap-1.5">
                        <ShieldCheck size={16} /> Chỉ tiêu KPI Mặc định hàng tháng
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <NumberField
                          label="KPI Buổi dạy PT"
                          value={ptMonthlySessionTarget}
                          onChange={setPtMonthlySessionTarget}
                          suffix="Buổi/tháng"
                          min="0"
                        />
                        <NumberField
                          label="KPI Doanh thu Sale"
                          value={saleMonthlyRevenueTarget}
                          onChange={setSaleMonthlyRevenueTarget}
                          suffix="VNĐ"
                          min="0"
                        />
                        <NumberField
                          label="KPI HĐ mới Sale"
                          value={saleMonthlyContractTarget}
                          onChange={setSaleMonthlyContractTarget}
                          suffix="HĐ"
                          min="0"
                        />
                        <NumberField
                          label="KPI Tái ký Sale"
                          value={saleMonthlyRenewTarget}
                          onChange={setSaleMonthlyRenewTarget}
                          suffix="HĐ"
                          min="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ================= 3. VẬN HÀNH CƠ SỞ ================= */}
              {activeTab === "operations" && (
                <div className="space-y-6 max-w-2xl">
                  <div>
                    <h3 className="text-lg font-bold text-text-light dark:text-text-dark mb-1 flex items-center gap-2">
                      <ShieldCheck size={20} className="text-primary" /> Thông số Vận hành Cơ sở
                    </h3>
                    
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <NumberField
                      label="Sức chứa tối đa"
                      value={gymCapacity}
                      onChange={setGymCapacity}
                      suffix="Người"
                      hint="Cảnh báo đông đúc tại quầy check-in"
                      min="1"
                    />
                    <NumberField
                      label="Cảnh báo tồn kho"
                      value={minStockAlert}
                      onChange={setMinStockAlert}
                      suffix="Sản phẩm"
                      hint="Cảnh báo nhập hàng khi kho dưới ngưỡng"
                      min="0"
                    />
                    <NumberField
                      label="Phí chuyển nhượng HĐ"
                      value={transferFee}
                      onChange={setTransferFee}
                      suffix="VNĐ"
                      hint="Phí thu mặc định khi chuyển nhượng cho người khác"
                      min="0"
                    />
                  </div>
                </div>
              )}

              {/* ================= 4. NHẮC NHỞ TỰ ĐỘNG (SOẠN EMAIL & ZALO) ================= */}
              {activeTab === "reminders" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-text-light dark:text-text-dark mb-1 flex items-center gap-2">
                      <Bell size={20} className="text-primary" /> Quản lý Mẫu Nhắc nhở & Kênh gửi Tự động
                    </h3>
                    
                  </div>

                  {/* Cấu hình kích hoạt cơ bản */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-text-light dark:text-text-dark">
                          Tự động nhắc gói sắp hết hạn
                        </span>
                        <input
                          type="checkbox"
                          checked={sendExpiryReminder}
                          onChange={(e) => setSendExpiryReminder(e.target.checked)}
                          className="w-4 h-4 accent-primary rounded cursor-pointer"
                        />
                      </div>
                      <NumberField
                        label="Số ngày nhắc trước ngày hết hạn"
                        value={expiryReminderDays}
                        onChange={setExpiryReminderDays}
                        suffix="Ngày"
                        min="1"
                        max="60"
                        disabled={!sendExpiryReminder}
                      />
                    </div>

                    <div className="p-4 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-text-light dark:text-text-dark">
                          Nhắc hội viên không hoạt động
                        </span>
                        <input
                          type="checkbox"
                          checked={sendInactiveReminder}
                          onChange={(e) => setSendInactiveReminder(e.target.checked)}
                          className="w-4 h-4 accent-primary rounded cursor-pointer"
                        />
                      </div>
                      <NumberField
                        label="Số ngày vắng mặt để gửi tin nhắn"
                        value={inactiveDays}
                        onChange={setInactiveDays}
                        suffix="Ngày"
                        min="7"
                        max="180"
                        disabled={!sendInactiveReminder}
                      />
                    </div>
                  </div>

                  {/* Bộ chọn loại mẫu thông báo */}
                  <div className="border-t border-border-light dark:border-border-dark pt-4">
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      {[
                        { id: "expiry", label: "Mẫu 1: Nhắc hết hạn gói tập", icon: Bell },
                        { id: "inactive", label: "Mẫu 2: Nhắc hội viên vắng mặt", icon: Smartphone },
                        { id: "registration", label: "Mẫu 3: Đăng ký / Gia hạn thành công", icon: CheckCircle },
                        { id: "manual", label: "✍️ Soạn tay (Gửi ngay)", icon: Edit3 },
                      ].map((t) => {
                        const Icon = t.icon;
                        const isSubActive = activeReminderSubTab === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={() => setActiveReminderSubTab(t.id)}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                              isSubActive
                                ? "bg-primary text-white shadow-sm"
                                : "bg-background-light dark:bg-background-dark text-text-muted-light dark:text-text-muted-dark border border-border-light dark:border-border-dark hover:text-text-light"
                            }`}
                          >
                            <Icon size={14} />
                            {t.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* === Form Soạn tay thông báo (Gửi ngay) === */}
                    {activeReminderSubTab === "manual" && (
                      <div className="space-y-5 p-5 rounded-2xl bg-background-light/50 dark:bg-background-dark/50 border border-border-light dark:border-border-dark">
                        {/* Header của mục Soạn tay */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-light dark:border-border-dark">
                          <div>
                            <h4 className="text-sm font-bold text-text-light dark:text-text-dark flex items-center gap-2">
                              <Edit3 size={16} className="text-primary" /> Soạn thông báo & Phát lệnh gửi ngay
                            </h4>
                            <p className="text-xs text-text-muted-light dark:text-text-muted-dark mt-0.5">
                              Gửi thông báo đột xuất, thông báo sự kiện, chính sách mới hoặc chương trình tri ân tới hội viên qua Email & Zalo.
                            </p>
                          </div>
                          <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold self-start sm:self-auto flex items-center gap-1 border border-primary/20">
                            <Sparkles size={12} /> Phát tin tức thời
                          </span>
                        </div>

                        {/* 1. Chọn nhóm đối tượng nhận */}
                        <div className="space-y-2">
                          <label className="block text-xs font-bold uppercase tracking-wider text-text-muted-light dark:text-text-muted-dark">
                            1. Nhóm đối tượng nhận tin
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            {[
                              { id: "all", label: "Tất cả hội viên", desc: "Gửi tới toàn bộ danh sách hội viên" },
                              { id: "active", label: "Hội viên Active", desc: "Chỉ hội viên đang có gói hoạt động" },
                              { id: "expiring_soon", label: "Sắp hết hạn (30 ngày)", desc: "Hết hạn trong vòng 30 ngày tới" },
                              { id: "expired", label: "Đã hết hạn", desc: "Hội viên đã hết hạn thẻ tập" },
                            ].map((aud) => (
                              <button
                                key={aud.id}
                                type="button"
                                onClick={() => setManualAudience(aud.id)}
                                className={`p-3 rounded-xl border text-left transition-all ${
                                  manualAudience === aud.id
                                    ? "bg-primary/10 border-primary text-text-light dark:text-text-dark font-semibold shadow-sm"
                                    : "bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark text-text-muted-light dark:text-text-muted-dark hover:border-primary/50"
                                }`}
                              >
                                <div className="text-xs font-bold flex items-center justify-between">
                                  <span>{aud.label}</span>
                                  {manualAudience === aud.id && <Check size={14} className="text-primary" />}
                                </div>
                                <div className="text-[11px] font-normal opacity-80 mt-1">{aud.desc}</div>
                              </button>
                            ))}
                          </div>

                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => setManualAudience("custom")}
                              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all inline-flex items-center gap-1.5 ${
                                manualAudience === "custom"
                                  ? "bg-primary text-white border-primary shadow-sm"
                                  : "bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark text-text-muted-light dark:text-text-muted-dark hover:text-text-light"
                              }`}
                            >
                              <span>Hoặc gửi riêng cho Email / Số điện thoại cụ thể</span>
                            </button>
                            {manualAudience === "custom" && (
                              <div className="mt-2 max-w-md">
                                <input
                                  type="text"
                                  value={manualCustomRecipient}
                                  onChange={(e) => setManualCustomRecipient(e.target.value)}
                                  placeholder="Nhập Email (e.g. khach@gmail.com) hoặc SĐT (e.g. 0987654321)"
                                  className={inputClass}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 2. Chọn kênh phát tin: Email & Zalo */}
                        <div className="space-y-2">
                          <label className="block text-xs font-bold uppercase tracking-wider text-text-muted-light dark:text-text-muted-dark">
                            2. Kênh phát thông báo
                          </label>
                          <div className="flex flex-wrap items-center gap-6 p-3 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
                            <label className="flex items-center gap-2 text-xs font-semibold text-text-light dark:text-text-dark cursor-pointer">
                              <input
                                type="checkbox"
                                checked={manualChannels.email}
                                onChange={(e) =>
                                  setManualChannels((prev) => ({ ...prev, email: e.target.checked }))
                                }
                                className="w-4 h-4 accent-primary rounded cursor-pointer"
                              />
                              <Mail size={15} className="text-blue-500" />
                              Gửi qua gmail
                            </label>

                            <label className="flex items-center gap-2 text-xs font-semibold text-text-light dark:text-text-dark cursor-pointer">
                              <input
                                type="checkbox"
                                checked={manualChannels.zalo}
                                onChange={(e) =>
                                  setManualChannels((prev) => ({ ...prev, zalo: e.target.checked }))
                                }
                                className="w-4 h-4 accent-primary rounded cursor-pointer"
                              />
                              <MessageSquare size={15} className="text-blue-600" />
                              Gửi tin nhắn Zalo (ZNS / OA)
                            </label>
                          </div>
                        </div>

                        {/* Thanh chèn placeholder nhanh */}
                        <div className="space-y-1.5">
                          <div className="text-xs font-semibold text-text-muted-light dark:text-text-muted-dark flex items-center gap-1">
                            <Sparkles size={13} className="text-primary" /> Bấm để chèn biến thay thế tự động vào nội dung:
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              "{{ten_khach_hang}}",
                              "{{ten_chi_nhanh}}",
                              "{{ten_goi_tap}}",
                              "{{ngay_het_han}}",
                            ].map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => insertManualPlaceholder(tag)}
                                className="px-2 py-0.5 rounded bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-xs font-mono text-primary hover:border-primary transition-colors"
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 3. Tiêu đề thông báo */}
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-text-muted-light dark:text-text-muted-dark mb-1">
                            3. Tiêu đề thông báo <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={manualSubject}
                            onChange={(e) => setManualSubject(e.target.value)}
                            placeholder="Nhập tiêu đề thư / thông báo..."
                            className={inputClass}
                          />
                        </div>

                        {/* 4. Nội dung chi tiết */}
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-text-muted-light dark:text-text-muted-dark mb-1">
                            4. Nội dung thông báo <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            rows={7}
                            value={manualBody}
                            onChange={(e) => setManualBody(e.target.value)}
                            placeholder="Nhập nội dung thông báo gửi đến hội viên..."
                            className="w-full p-3.5 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-sans"
                          />
                        </div>

                        {/* 5. Đính kèm tài liệu */}
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-text-muted-light dark:text-text-muted-dark mb-1">
                            5. Đính kèm tài liệu / Thông báo (PDF, Word, Ảnh)
                          </label>
                          <div className="flex items-center gap-3">
                            <label className="cursor-pointer px-4 py-2 rounded-xl border border-dashed border-border-light dark:border-border-dark hover:border-primary bg-surface-light dark:bg-surface-dark text-xs font-medium text-text-light dark:text-text-dark flex items-center gap-2 transition-colors">
                              <Paperclip size={14} className="text-primary" />
                              <span>{manualAttachment ? "Đổi file đính kèm" : "Chọn file đính kèm"}</span>
                              <input
                                type="file"
                                accept=".doc,.docx,.pdf,image/*"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    setManualAttachment(e.target.files[0]);
                                    toast.success(`Đã chọn file: ${e.target.files[0].name}`);
                                  }
                                }}
                              />
                            </label>

                            {manualAttachment && (
                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                                <FileText size={13} />
                                <span>{manualAttachment.name}</span>
                                <span className="text-[11px] opacity-75">
                                  ({(manualAttachment.size / 1024).toFixed(0)} KB)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setManualAttachment(null)}
                                  className="hover:text-red-500 ml-1 text-xs font-bold"
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 6. Thanh điều khiển & Nút gửi */}
                        <div className="pt-3 border-t border-border-light dark:border-border-dark flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-xs text-text-muted-light dark:text-text-muted-dark">
                            <Info size={14} className="text-blue-500" />
                            <span>Thông báo sẽ được xử lý ngầm (background queue) theo batch tới từng hội viên.</span>
                          </div>

                          <button
                            type="button"
                            onClick={handleSendManualNotification}
                            disabled={manualSending}
                            className="h-11 px-6 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-lg shadow-primary/25 disabled:opacity-50 flex items-center justify-center gap-2 transition-all self-end sm:self-auto"
                          >
                            {manualSending ? (
                              <>
                                <Loader2 size={16} className="animate-spin" />
                                Đang phát lệnh gửi...
                              </>
                            ) : (
                              <>
                                <Send size={16} />
                                Phát lệnh gửi thông báo ngay
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Form soạn thảo mẫu thông báo tự động (Mẫu 1, 2, 3) */}
                    {activeReminderSubTab !== "manual" && reminderTemplates[activeReminderSubTab] && (
                      <div className="space-y-4 p-5 rounded-2xl bg-background-light/50 dark:bg-background-dark/50 border border-border-light dark:border-border-dark">
                        {/* Kênh gửi: Email & Zalo */}
                        <div className="flex flex-wrap items-center gap-6 p-3 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
                          <span className="text-xs font-bold uppercase tracking-wider text-text-muted-light dark:text-text-muted-dark">
                            Kênh phát tin:
                          </span>
                          <label className="flex items-center gap-2 text-xs font-semibold text-text-light dark:text-text-dark cursor-pointer">
                            <input
                              type="checkbox"
                              checked={reminderTemplates[activeReminderSubTab].enableEmail !== false}
                              onChange={(e) =>
                                setReminderTemplates({
                                  ...reminderTemplates,
                                  [activeReminderSubTab]: {
                                    ...reminderTemplates[activeReminderSubTab],
                                    enableEmail: e.target.checked,
                                  },
                                })
                              }
                              className="w-4 h-4 accent-primary rounded cursor-pointer"
                            />
                            
                            Gửi qua mail 
                          </label>

                          <label className="flex items-center gap-2 text-xs font-semibold text-text-light dark:text-text-dark cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(reminderTemplates[activeReminderSubTab].enableZalo)}
                              onChange={(e) =>
                                setReminderTemplates({
                                  ...reminderTemplates,
                                  [activeReminderSubTab]: {
                                    ...reminderTemplates[activeReminderSubTab],
                                    enableZalo: e.target.checked,
                                  },
                                })
                              }
                              className="w-4 h-4 accent-primary rounded cursor-pointer"
                            />
                            
                            Gửi tin nhắn Zalo 
                          </label>
                        </div>

                        {/* Cấu hình Zalo Template ID nếu bật Zalo */}
                        {reminderTemplates[activeReminderSubTab].enableZalo && (
                          <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-300">
                              <Smartphone size={15} /> Cấu hình Zalo ZNS Template ID
                            </div>
                            <input
                              type="text"
                              value={reminderTemplates[activeReminderSubTab].zaloTemplateId || ""}
                              onChange={(e) =>
                                setReminderTemplates({
                                  ...reminderTemplates,
                                  [activeReminderSubTab]: {
                                    ...reminderTemplates[activeReminderSubTab],
                                    zaloTemplateId: e.target.value,
                                  },
                                })
                              }
                              placeholder="Nhập mã Template ID đã duyệt trên Zalo Cloud Account (e.g. ZNS_EXPIRY_01)"
                              className="w-full h-10 px-3 rounded-lg bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-xs font-mono text-text-light dark:text-text-dark focus:outline-none focus:border-primary"
                            />
                            <p className="text-[11px] text-text-muted-light dark:text-text-muted-dark">
                              Hệ thống sẽ gửi thông báo trực tiếp vào ứng dụng Zalo của số điện thoại hội viên đăng ký qua Zalo ZNS API.
                            </p>
                          </div>
                        )}

                        {/* Thanh chèn placeholder nhanh */}
                        <div className="space-y-1.5">
                          <div className="text-xs font-semibold text-text-muted-light dark:text-text-muted-dark flex items-center gap-1">
                            <Sparkles size={13} className="text-primary" /> Bấm để chèn biến thay thế tự động vào nội dung:
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              "{{ten_khach_hang}}",
                              "{{ten_goi_tap}}",
                              "{{ngay_het_han}}",
                              "{{so_ngay}}",
                              "{{ten_chi_nhanh}}",
                            ].map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => insertReminderPlaceholder(tag)}
                                className="px-2 py-0.5 rounded bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-xs font-mono text-primary hover:border-primary transition-colors"
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Tiêu đề email */}
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-text-muted-light dark:text-text-muted-dark mb-1">
                            Tiêu đề thông báo
                          </label>
                          <input
                            type="text"
                            value={reminderTemplates[activeReminderSubTab].subject || ""}
                            onChange={(e) =>
                              setReminderTemplates({
                                ...reminderTemplates,
                                [activeReminderSubTab]: {
                                  ...reminderTemplates[activeReminderSubTab],
                                  subject: e.target.value,
                                },
                              })
                            }
                            className={inputClass}
                          />
                        </div>

                        {/* Nội dung tin nhắn / email */}
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-text-muted-light dark:text-text-muted-dark mb-1">
                            Nội dung chi tiết
                          </label>
                          <textarea
                            rows={6}
                            value={reminderTemplates[activeReminderSubTab].body || ""}
                            onChange={(e) =>
                              setReminderTemplates({
                                ...reminderTemplates,
                                [activeReminderSubTab]: {
                                  ...reminderTemplates[activeReminderSubTab],
                                  body: e.target.value,
                                },
                              })
                            }
                            className="w-full p-3.5 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        </div>

                        {/* Đính kèm file văn bản / bảng giá mặc định */}
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-text-muted-light dark:text-text-muted-dark mb-1">
                            File đính kèm tự động gửi kèm (Bảng giá ưu đãi, nội quy phòng tập)
                          </label>
                          <div className="flex items-center gap-3">
                            <label className="cursor-pointer px-4 py-2 rounded-xl border border-dashed border-border-light dark:border-border-dark hover:border-primary bg-surface-light dark:bg-surface-dark text-xs font-medium text-text-light dark:text-text-dark flex items-center gap-2 transition-colors">
                              <Paperclip size={14} className="text-primary" />
                              <span>Chọn file mẫu (.docx, .pdf)</span>
                              <input
                                type="file"
                                accept=".doc,.docx,.pdf,image/*"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    setReminderTemplates({
                                      ...reminderTemplates,
                                      [activeReminderSubTab]: {
                                        ...reminderTemplates[activeReminderSubTab],
                                        attachmentName: e.target.files[0].name,
                                      },
                                    });
                                    toast.success(`Đã chọn file mẫu: ${e.target.files[0].name}`);
                                  }
                                }}
                              />
                            </label>

                            {reminderTemplates[activeReminderSubTab].attachmentName && (
                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                                <FileText size={13} />
                                <span>{reminderTemplates[activeReminderSubTab].attachmentName}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReminderTemplates({
                                      ...reminderTemplates,
                                      [activeReminderSubTab]: {
                                        ...reminderTemplates[activeReminderSubTab],
                                        attachmentName: "",
                                      },
                                    })
                                  }
                                  className="hover:text-red-500 ml-1 text-xs"
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ================= 5. PHÂN QUYỀN TƯƠNG TÁC (RBAC INTERACTIVE MATRIX) ================= */}
              {activeTab === "rbac" && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-text-light dark:text-text-dark mb-1 flex items-center gap-2">
                        <UserCheck size={20} className="text-primary" /> Ma trận Phân quyền Tài khoản & Vai trò
                      </h3>
                      
                    </div>

                    <button
                      type="button"
                      onClick={handleResetPermissions}
                      className="px-3.5 py-1.5 rounded-xl border border-border-light dark:border-border-dark text-xs font-medium text-text-muted-light dark:text-text-muted-dark hover:text-text-light flex items-center gap-1.5 self-start sm:self-auto"
                    >
                      <RotateCcw size={13} /> Khôi phục mặc định
                    </button>
                  </div>

                  <div className="border border-border-light dark:border-border-dark rounded-2xl overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-background-light/80 dark:bg-background-dark/80 text-text-muted-light dark:text-text-muted-dark border-b border-border-light dark:border-border-dark">
                        <tr>
                          <th className="p-3.5 font-bold">Chức năng / Quyền hạn</th>
                          <th className="p-3.5 text-center font-bold text-red-500">Admin</th>
                          <th className="p-3.5 text-center font-bold">Manager</th>
                          <th className="p-3.5 text-center font-bold">Accountant</th>
                          <th className="p-3.5 text-center font-bold">Sale</th>
                          <th className="p-3.5 text-center font-bold">PT</th>
                          <th className="p-3.5 text-center font-bold">Reception</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-light dark:divide-border-dark font-medium">
                        {SYSTEM_PERMISSIONS.map((perm) => (
                          <tr key={perm.id} className="hover:bg-background-light/40 dark:hover:bg-background-dark/40">
                            <td className="p-3 text-text-light dark:text-text-dark font-semibold">
                              <div>{perm.label}</div>
                              <span className="text-[10px] text-text-muted-light dark:text-text-muted-dark font-mono font-normal">
                                {perm.id}
                              </span>
                            </td>

                            {/* Admin: Luôn luôn có quyền */}
                            <td className="p-3 text-center">
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-500 text-white text-[11px] font-bold">
                                ✓
                              </span>
                            </td>

                            {/* Các Role có thể tương tác chọn quyền */}
                            {["manager", "accountant", "sale", "pt", "reception"].map((role) => {
                              const isChecked = (rolePermissions[role] || []).includes(perm.id);
                              return (
                                <td key={role} className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleTogglePermission(role, perm.id)}
                                    className="w-4 h-4 accent-primary rounded cursor-pointer transition-transform hover:scale-110"
                                    title={`Bật/tắt quyền ${perm.label} cho vai trò ${role}`}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ================= 6. THANH TOÁN (VIETQR & SEPAY & POS) ================= */}
              {activeTab === "payment" && (
                <div className="space-y-6 max-w-3xl">
                  <div>
                    <h3 className="text-lg font-bold text-text-light dark:text-text-dark mb-1 flex items-center gap-2">
                      <CreditCard size={20} className="text-primary" /> Cổng Thanh toán & Tích hợp SePay
                    </h3>
                    
                  </div>


                  

                  {/* Thông tin VietQR Ngân hàng */}
                  <div className="p-5 rounded-2xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark space-y-4">
                    <h4 className="text-sm font-bold text-primary flex items-center gap-1.5">
                      <QrCode size={16} /> Thông tin Tài khoản Nhận tiền (VietQR Napas 24/7)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label htmlFor="vietqr_bank" className={labelClass}>Ngân hàng thụ hưởng</label>
                        <select
                          id="vietqr_bank"
                          className={inputClass}
                          value={vietqrBank}
                          onChange={(e) => setVietqrBank(e.target.value)}
                        >
                          {["MBBank", "Vietcombank", "Techcombank", "VietinBank", "BIDV", "ACB", "VPBank", "TPBank"].map(
                            (b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="vietqr_acc" className={labelClass}>Số tài khoản ngân hàng</label>
                        <input
                          id="vietqr_acc"
                          type="text"
                          className={inputClass}
                          value={vietqrAccountNo}
                          onChange={(e) => setVietqrAccountNo(e.target.value)}
                          placeholder="0987654321"
                        />
                      </div>

                      <div>
                        <label htmlFor="vietqr_name" className={labelClass}>Tên chủ tài khoản</label>
                        <input
                          id="vietqr_name"
                          type="text"
                          className={inputClass}
                          value={vietqrAccountName}
                          onChange={(e) => setVietqrAccountName(e.target.value.toUpperCase())}
                          placeholder="CTY CP GYMPRO FITNESS"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Cấu hình kết nối SePay */}
                  <div className="p-5 rounded-2xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-primary flex items-center gap-1.5">
                        <CreditCard size={16} /> Cấu hình SePay Webhook & API Key
                      </h4>
                      <a
                        href="https://my.sepay.vn"
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        Mở cổng quản trị SePay <ExternalLink size={12} />
                      </a>
                    </div>

                    <div>
                      <label className={labelClass}>Webhook Callback URL (Dán vào cài đặt Webhook trên my.sepay.vn)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={webhookUrl}
                          className="w-full h-11 px-4 rounded-xl bg-gray-100 dark:bg-gray-800 border border-border-light dark:border-border-dark text-xs font-mono text-text-light dark:text-text-dark focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(webhookUrl);
                            setCopiedWebhook(true);
                            toast.success("Đã copy Webhook URL vào clipboard!");
                            setTimeout(() => setCopiedWebhook(false), 2000);
                          }}
                          className="h-11 px-3.5 rounded-xl border border-border-light dark:border-border-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5 text-xs font-medium shrink-0"
                        >
                          {copiedWebhook ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          {copiedWebhook ? "Đã chép" : "Sao chép"}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="sepay_api_key" className={labelClass}>SePay API Key / Webhook Secret Token</label>
                      <input
                        id="sepay_api_key"
                        type="password"
                        className={inputClass}
                        value={sepayApiKey}
                        onChange={(e) => setSepayApiKey(e.target.value)}
                        placeholder="Nhập secret token để xác thực chữ ký bảo mật webhook"
                      />
                    </div>
                  </div>

                  {/* Máy quẹt thẻ POS */}
                  <div className="p-5 rounded-2xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark space-y-4">
                    <h4 className="text-sm font-bold text-primary flex items-center gap-1.5">
                      <CreditCard size={16} /> Thiết bị quẹt thẻ POS tại quầy
                    </h4>
                    <div>
                      <label htmlFor="pos_term_id" className={labelClass}>Mã POS Terminal ID</label>
                      <input
                        id="pos_term_id"
                        type="text"
                        className={inputClass}
                        value={posTerminalId}
                        onChange={(e) => setPosTerminalId(e.target.value)}
                        placeholder="POS-HN01-01"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ================= 7. THIẾT BỊ NHẬN DIỆN KHUÔN MẶT ================= */}
              {activeTab === "faceai" && (
                <div className="space-y-6 max-w-2xl">
                  <div>
                    <h3 className="text-lg font-bold text-text-light dark:text-text-dark mb-1 flex items-center gap-2">
                      <Camera size={20} className="text-primary" /> Thiết bị Nhận diện Khuôn mặt (AI Face Check-in)
                    </h3>
                    
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="face_server_url" className={labelClass}>
                        Endpoint Máy chủ AI (Flask Server URL)
                      </label>
                      <input
                        id="face_server_url"
                        type="url"
                        className={inputClass}
                        value={faceAiServerUrl}
                        onChange={(e) => setFaceAiServerUrl(e.target.value)}
                        placeholder="http://localhost:5001"
                      />
                      <p className="text-xs text-text-muted-light dark:text-text-muted-dark mt-1">
                        URL dịch vụ AI chạy cục bộ hoặc qua IP mạng nội bộ tại cơ sở chi nhánh
                      </p>
                    </div>

                    <NumberField
                      label="Ngưỡng nhận diện chính xác (Cosine Similarity Threshold)"
                      value={faceMatchThreshold}
                      onChange={setFaceMatchThreshold}
                      hint="Khoảng khuyến nghị: 0.55 - 0.65. Ngưỡng càng cao càng khắt khe, giảm thiểu tối đa nhận diện nhầm."
                      step="0.05"
                      min="0.1"
                      max="0.99"
                    />

                    <div>
                      <label htmlFor="rtsp_cam_url" className={labelClass}>
                        Đường dẫn Camera RTSP luồng trực tiếp (Tùy chọn)
                      </label>
                      <input
                        id="rtsp_cam_url"
                        type="text"
                        className={inputClass}
                        value={cameraRtspUrl}
                        onChange={(e) => setCameraRtspUrl(e.target.value)}
                        placeholder="rtsp://admin:pass@192.168.1.100:554/stream1"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ================= 8. ĐÓNG / MỞ CHI NHÁNH & BÙ HẠN ================= */}
              {activeTab === "closures" && (
                <div className="space-y-6">
                  <BranchClosures embedded={true} />
                </div>
              )}

              {/* ================= 9. NHẬT KÝ VẬN HÀNH & KIỂM TOÁN ================= */}
              {activeTab === "audit" && (
                <div className="space-y-6">
                  <AuditLogSettings />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;