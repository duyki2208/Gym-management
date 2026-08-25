import React, { useState, useEffect } from 'react';
import { settingsService } from '../services/settingsService';
import toast from 'react-hot-toast';

// Component NumberField được khai báo bên ngoài để tránh việc bị recreating type gây mất focus khi gõ dữ liệu
const NumberField = ({ label, value, onChange, hint, suffix, disabled }) => {
  const inputClass = "w-full h-11 px-4 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark";
  const labelClass = "block text-sm font-medium text-text-light dark:text-text-dark mb-2";
  const hintClass = "text-xs text-text-muted-light dark:text-text-muted-dark mt-1";

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="relative">
        <input
          type="number"
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">{suffix}</span>}
      </div>
      {hint && <p className={hintClass}>{hint}</p>}
    </div>
  );
};

const Settings = () => {
  // === Thông tin cơ bản ===
  const [gymName, setGymName] = useState("Gym Admin Fitness");
  const [address, setAddress] = useState("123 Đường ABC, Quận 1");
  const [targetRevenue, setTargetRevenue] = useState(100000000);

  // === Hoa hồng PT ===
  const [ptSessionPrice, setPtSessionPrice] = useState(500000);
  const [ptCommissionRate, setPtCommissionRate] = useState(10);

  // === Hoa hồng Sale ===
  const [saleNewContractRate, setSaleNewContractRate] = useState(5);
  const [saleRenewRate, setSaleRenewRate] = useState(3);
  const [saleUpsellRate, setSaleUpsellRate] = useState(4);

  // === KPI ===
  const [ptMonthlySessionTarget, setPtMonthlySessionTarget] = useState(80);
  const [saleMonthlyRevenueTarget, setSaleMonthlyRevenueTarget] = useState(100000000);
  const [saleMonthlyContractTarget, setSaleMonthlyContractTarget] = useState(20);
  const [saleMonthlyRenewTarget, setSaleMonthlyRenewTarget] = useState(15);

  // === Vận hành ===
  const [gymCapacity, setGymCapacity] = useState(50);
  const [minStockAlert, setMinStockAlert] = useState(5);
  const [transferFee, setTransferFee] = useState(1000000);

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("gym_user") || "{}");
      setIsAdmin(user.role === "admin" || user.role === "accountant");
    } catch (e) {
      console.error(e);
    }

    const loadSettings = async () => {
      try {
        const res = await settingsService.get();
        if (res && res.success && res.data) {
          const d = res.data;
          setGymName(d.gymName || "Gym Admin Fitness");
          setAddress(d.address || "123 Đường ABC, Quận 1");
          setTargetRevenue(d.targetRevenue || 100000000);
          // Hoa hồng
          setPtSessionPrice(d.ptSessionPrice ?? 500000);
          setPtCommissionRate(d.ptCommissionRate ?? 10);
          setSaleNewContractRate(d.saleNewContractRate ?? 5);
          setSaleRenewRate(d.saleRenewRate ?? 3);
          setSaleUpsellRate(d.saleUpsellRate ?? 4);
          // KPI
          setPtMonthlySessionTarget(d.ptMonthlySessionTarget ?? 80);
          setSaleMonthlyRevenueTarget(d.saleMonthlyRevenueTarget ?? 100000000);
          setSaleMonthlyContractTarget(d.saleMonthlyContractTarget ?? 20);
          setSaleMonthlyRenewTarget(d.saleMonthlyRenewTarget ?? 15);
          // Vận hành
          setGymCapacity(d.gymCapacity ?? 50);
          setMinStockAlert(d.minStockAlert ?? 5);
          setTransferFee(d.transferFee ?? 1000000);
        }
      } catch (error) {
        console.error("Lỗi tải cấu hình:", error);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

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
      const res = await settingsService.update({
        gymName, address,
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
      });
      if (res && res.success) {
        toast.success("Đã lưu thay đổi cài đặt thành công!");
        window.dispatchEvent(
          new CustomEvent("branch-settings-updated", {
            detail: { gymName, address },
          })
        );
      }
    } catch (error) {
      toast.error(error.message || "Lỗi khi lưu cài đặt");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-text-light dark:text-text-dark">Đang tải cấu hình hệ thống...</div>;
  }

  const inputClass = "w-full h-11 px-4 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark";
  const labelClass = "block text-sm font-medium text-text-light dark:text-text-dark mb-2";

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-text-light dark:text-text-dark text-3xl font-bold">Cài đặt Hệ thống</h1>
      
      {/* === THÔNG TIN CHUNG === */}
      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border-light dark:border-border-dark">
          <h2 className="text-xl font-bold text-text-light dark:text-text-dark">Thông tin chung & Chỉ tiêu doanh thu</h2>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <label className={labelClass}>Tên phòng tập</label>
            <input className={inputClass} value={gymName} onChange={(e) => setGymName(e.target.value)} disabled={!isAdmin} />
          </div>
          <div>
            <label className={labelClass}>Địa chỉ</label>
            <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} disabled={!isAdmin} />
          </div>
          <NumberField label="Chỉ tiêu doanh thu tháng (VNĐ)" value={targetRevenue} onChange={setTargetRevenue} disabled={!isAdmin}
            hint="Mục tiêu doanh thu hàng tháng được sử dụng để hiển thị tỷ lệ % hoàn thành trên trang Tổng quan." />
        </div>
      </div>

      {/* === HOA HỒNG PT === */}
      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border-light dark:border-border-dark">
          <h2 className="text-xl font-bold text-text-light dark:text-text-dark"> Cấu hình Hoa hồng PT</h2>
          <p className="text-sm text-text-muted-light dark:text-text-muted-dark mt-1">Giá buổi tập và % hoa hồng áp dụng đồng nhất cho tất cả PT</p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <NumberField label="Giá mặc định 1 buổi PT (VNĐ)" value={ptSessionPrice} onChange={setPtSessionPrice} disabled={!isAdmin}
            hint="Giá trị dùng để tính hoa hồng. VD: 500.000đ" />
          <NumberField label="% Hoa hồng PT" value={ptCommissionRate} onChange={setPtCommissionRate} suffix="%" disabled={!isAdmin}
            hint="VD: 10% → mỗi buổi PT nhận 50.000đ (từ 500.000đ)" />
        </div>
      </div>

      {/* === HOA HỒNG SALE === */}
      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border-light dark:border-border-dark">
          <h2 className="text-xl font-bold text-text-light dark:text-text-dark"> Cấu hình Hoa hồng Sale</h2>
          <p className="text-sm text-text-muted-light dark:text-text-muted-dark mt-1">% hoa hồng tính trên giá trị hợp đồng theo loại giao dịch</p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <NumberField label="% HĐ mới" value={saleNewContractRate} onChange={setSaleNewContractRate} suffix="%" disabled={!isAdmin}
            hint="Hợp đồng đăng ký lần đầu" />
          <NumberField label="% Gia hạn" value={saleRenewRate} onChange={setSaleRenewRate} suffix="%" disabled={!isAdmin}
            hint="Khách hàng gia hạn gói tập" />
          <NumberField label="% Nâng gói (Upsell)" value={saleUpsellRate} onChange={setSaleUpsellRate} suffix="%" disabled={!isAdmin}
            hint="Khách nâng cấp từ gói thấp lên cao" />
        </div>
      </div>

      {/* === KPI MẶC ĐỊNH === */}
      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border-light dark:border-border-dark">
          <h2 className="text-xl font-bold text-text-light dark:text-text-dark"> KPI Mặc định</h2>
          <p className="text-sm text-text-muted-light dark:text-text-muted-dark mt-1">Giá trị mặc định áp dụng cho tất cả nhân viên (có thể tùy chỉnh riêng sau)</p>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
              <h3 className="font-bold text-blue-700 dark:text-blue-400 mb-4 text-sm">KPI cho PT</h3>
              <NumberField label="Target buổi tập / tháng" value={ptMonthlySessionTarget} onChange={setPtMonthlySessionTarget} disabled={!isAdmin}
                hint="VD: 80 buổi/tháng" suffix="buổi" />
            </div>
            <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
              <h3 className="font-bold text-emerald-700 dark:text-emerald-400 mb-4 text-sm">KPI cho Sale</h3>
              <div className="space-y-4">
                <NumberField label="Target doanh thu / tháng (VNĐ)" value={saleMonthlyRevenueTarget} onChange={setSaleMonthlyRevenueTarget} disabled={!isAdmin} />
                <NumberField label="Target HĐ mới / tháng" value={saleMonthlyContractTarget} onChange={setSaleMonthlyContractTarget} suffix="HĐ" disabled={!isAdmin} />
                <NumberField label="Target gia hạn / tháng" value={saleMonthlyRenewTarget} onChange={setSaleMonthlyRenewTarget} suffix="KH" disabled={!isAdmin} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === VẬN HÀNH === */}
      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border-light dark:border-border-dark">
          <h2 className="text-xl font-bold text-text-light dark:text-text-dark">Vận hành</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <NumberField label="Sức chứa phòng tập (người)" value={gymCapacity} onChange={setGymCapacity} disabled={!isAdmin}
            hint="Dùng để tính công suất sử dụng trong báo cáo vận hành" />
          <NumberField label="Ngưỡng cảnh báo tồn kho" value={minStockAlert} onChange={setMinStockAlert} disabled={!isAdmin}
            hint="Sản phẩm có số lượng dưới mức này sẽ được cảnh báo" suffix="SP" />
          <NumberField label="Phí chuyển nhượng hợp đồng (VNĐ)" value={transferFee} onChange={setTransferFee} disabled={!isAdmin}
            hint="Mức phí thu khi khách hàng chuyển nhượng gói tập sang người khác" />
        </div>
      </div>

      {/* === THÔNG BÁO === */}
      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border-light dark:border-border-dark">
          <h2 className="text-xl font-bold text-text-light dark:text-text-dark">Thông báo & Nhắc nhở</h2>
        </div>
        <div className="p-6 grid gap-4">
          {['Nhắc nhở Hết hạn Gói tập', 'Nhắc nhở Không Hoạt động', 'Thông báo Gia hạn Thành công'].map((item, i) => (
            <div key={i} className="flex justify-between items-center p-5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl">
              <div>
                <p className="font-bold text-text-light dark:text-text-dark">{item}</p>
                <p className="text-sm text-text-muted-light dark:text-text-muted-dark">Tự động gửi thông báo đến khách hàng.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked disabled={!isAdmin} />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* === NÚT LƯU === */}
      {isAdmin && (
        <div className="sticky bottom-4 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-4 flex justify-end shadow-lg">
          <button 
            onClick={handleSave}
            className="h-10 px-8 bg-primary text-white font-bold rounded-lg hover:opacity-90 transition-opacity"
          >
            Lưu tất cả thay đổi
          </button>
        </div>
      )}
    </div>
  );
};

export default Settings;