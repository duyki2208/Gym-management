import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { X, UserPlus } from "lucide-react";
import { staffService, customerService } from "../../services/customerService";
import api from "../../services/api";
import BaseModal from "../common/BaseModal";
import FormField, { inputClassName } from "../common/FormField";
import Button from "../common/Button";

const CustomerModal = ({ customer, packages, onSave, onClose, contractTypeAlert, onDismissAlert }) => {
  const [staffList, setStaffList] = useState([]);
  const [customerList, setCustomerList] = useState([]);
  // Cảnh báo real-time khách cũ chọn sai contractType
  const [existingCustomerAlert, setExistingCustomerAlert] = useState(null);
  const [referralSearch, setReferralSearch] = useState("");

  useEffect(() => {
    const fetchCustomersList = async () => {
      try {
        const response = await customerService.getAll({ limit: 1000 });
        setCustomerList(response?.customers || []);
      } catch (err) {
        console.error("Lỗi lấy danh sách khách hàng giới thiệu:", err);
      }
    };
    fetchCustomersList();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const data = await staffService.getAll();
        setStaffList(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchStaff();
  }, []);

  const [formData, setFormData] = useState({
    // 1. Thông tin cơ bản
    code: "",
    name: "",
    dob: "",
    gender: "Nam",
    phone: "",
    email: "",
    address: "",
    avatar: "👤",

    // 2. Thông tin gói tập
    packageType: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    price: 0,
    remainingSessions: 0, // Vẫn lưu ngầm nhưng ẩn khỏi giao diện

    // 3. Thông tin sức khỏe
    healthNote: "",

    // 4. Dịch vụ thêm
    trainer: "",  // ObjectId hoặc ""
    assignedStaff: "",
    hasLocker: false,
    hasWater: false,

    // 5. Thanh toán
    paymentStatus: "paid",
    paidAmount: 0,
    contractType: "new",
    contractCode: "",
    packageNote: "",

    // 6. Thông tin khẩn cấp
    identityCard: "",
    emergencyContactName: "",
    emergencyContactPhone: "",

    // 7. Referral
    source: "other",
    referredBy: "",
    avatarUrl: "",
  });

  // Hàm helper để format date cho input type="date"
  const formatDateForInput = (dateValue) => {
    if (!dateValue) return "";
    if (typeof dateValue === "string") {
      // Nếu là ISO string, lấy phần ngày
      if (dateValue.includes("T")) {
        return dateValue.split("T")[0];
      }
      // Nếu đã là format yyyy-MM-dd
      if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateValue;
      }
      // Thử parse và format lại
      try {
        return new Date(dateValue).toISOString().split("T")[0];
      } catch {
        return "";
      }
    }
    // Nếu là Date object
    if (dateValue instanceof Date) {
      return dateValue.toISOString().split("T")[0];
    }
    return "";
  };

  useEffect(() => {
    if (customer) {
      // Xử lý date fields trước
      const dobFormatted = formatDateForInput(customer.dob);
      const startDateFormatted =
        formatDateForInput(customer.startDate) ||
        new Date().toISOString().split("T")[0];
      const endDateFormatted = formatDateForInput(customer.endDate);

      setFormData({
        code: customer.code || "",
        name: customer.name || "",
        dob: dobFormatted,
        gender: customer.gender || "Nam",
        phone: customer.phone || "",
        email: customer.email || "",
        address: customer.address || "",
        avatar: customer.avatar || "👤",
        packageType: customer.packageType || "",
        startDate: startDateFormatted,
        endDate: endDateFormatted,
        price: customer.price || 0,
        remainingSessions: customer.remainingSessions || 0,
        healthNote: customer.healthNote || "",
        trainer: customer.trainer?._id || customer.trainer || "",
        assignedStaff: customer.assignedStaff?._id || customer.assignedStaff || "",
        hasLocker: customer.hasLocker || false,
        hasWater: customer.hasWater || false,
        paymentStatus: customer.paymentStatus || "paid",
        paidAmount: customer.paidAmount || 0,
        contractType: customer.contractType || "new",
        contractCode: customer.contractCode || "",
        packageNote: customer.packageNote || "",
        identityCard: customer.identityCard || "",
        emergencyContactName: customer.emergencyContactName || "",
        emergencyContactPhone: customer.emergencyContactPhone || "",
        source: customer.source || "other",
        referredBy: customer.referredBy?._id || customer.referredBy || "",
        avatarUrl: customer.avatarUrl || "",
        // Giữ lại _id và các trường khác nhưng không ghi đè date fields đã format
        _id: customer._id,
        id: customer.id,
      });
    } else {
      // Reset form khi tạo mới
      setFormData({
        code: "",
        name: "",
        dob: "",
        gender: "Nam",
        phone: "",
        email: "",
        address: "",
        avatar: "👤",
        packageType: "",
        startDate: new Date().toISOString().split("T")[0],
        endDate: "",
        price: 0,
        remainingSessions: 0,
        healthNote: "",
        trainer: "",  // ObjectId hoặc ""
        assignedStaff: "",
        hasLocker: false,
        hasWater: false,
        paymentStatus: "paid",
        paidAmount: 0,
        contractType: "new",
        contractCode: "",
        packageNote: "",
        identityCard: "",
        emergencyContactName: "",
        emergencyContactPhone: "",
        source: "other",
        referredBy: "",
        avatarUrl: "",
      });
    }
  }, [customer]);



  // LOGIC QUAN TRỌNG: Tự động tính ngày và số buổi
  const handlePackageChange = (packageName) => {
    if (!Array.isArray(packages)) return;
    const pkg = packages.find((p) => p && p.name === packageName);
    if (pkg) {
      setFormData((prev) => {
        const startDate = new Date(prev.startDate);
        const endDate = new Date(startDate);
        
        if (prev.paymentStatus === "deposit") {
          endDate.setDate(endDate.getDate() + 30);
        } else {
          endDate.setDate(endDate.getDate() + pkg.duration);
        }

        // Kiểm tra xem nhân viên tư vấn đã chọn có hợp lệ với gói mới không
        let updatedAssignedStaff = prev.assignedStaff;
        let updatedTrainer = prev.trainer;
        if (prev.assignedStaff) {
          const currentStaff = staffList.find(s => (s._id || s.id) === prev.assignedStaff);
          if (currentStaff) {
            if (pkg.type === "session") {
              if (!["pt", "pm"].includes(currentStaff.role)) {
                updatedAssignedStaff = "";
                updatedTrainer = "";
                toast.error("Gói theo buổi yêu cầu nhân viên tư vấn có chức vụ PT hoặc PM. Vui lòng chọn lại nhân viên.");
              }
            } else { // monthly
              if (!["sm", "sale"].includes(currentStaff.role)) {
                updatedAssignedStaff = "";
                updatedTrainer = "";
                toast.error("Gói theo ngày yêu cầu nhân viên tư vấn có chức vụ SM hoặc Sale. Vui lòng chọn lại nhân viên.");
              }
            }
          }
        }

        return {
          ...prev,
          packageType: packageName,
          price: pkg.price,
          paidAmount: prev.paymentStatus === "paid" ? pkg.price : prev.paidAmount,
          endDate: endDate.toISOString().split("T")[0],
          remainingSessions: pkg.sessions || 0,
          assignedStaff: updatedAssignedStaff,
          trainer: updatedTrainer,
        };
      });
    } else {
      setFormData((prev) => ({ ...prev, packageType: packageName }));
    }
  };

  const handleStartDateChange = (date) => {
    if (!Array.isArray(packages)) return;
    const pkg = packages.find((p) => p && p.name === formData.packageType);

    setFormData((prev) => {
      let endDate = prev.endDate;
      if (pkg) {
        const start = new Date(date);
        const end = new Date(start);
        
        if (prev.paymentStatus === "deposit") {
          end.setDate(end.getDate() + 30);
        } else {
          end.setDate(end.getDate() + pkg.duration);
        }
        endDate = end.toISOString().split("T")[0];
      }
      return { ...prev, startDate: date, endDate };
    });
  };

  const handlePaymentStatusChange = (status) => {
    setFormData((prev) => {
      const newState = { ...prev, paymentStatus: status };
      const pkg = packages.find((p) => p && p.name === prev.packageType);
      
      if (status === "paid") {
        newState.paidAmount = prev.price || (pkg ? pkg.price : 0);
      } else if (status === "unpaid") {
        newState.paidAmount = 0;
      }
      
      if (pkg) {
        const start = new Date(prev.startDate);
        const end = new Date(start);
        
        if (status === "deposit") {
          end.setDate(end.getDate() + 30);
        } else {
          end.setDate(end.getDate() + pkg.duration);
        }
        newState.endDate = end.toISOString().split("T")[0];
      }
      return newState;
    });
  };

  const filteredReferrals = customerList.filter(c => 
    c.name?.toLowerCase().includes(referralSearch.toLowerCase()) || 
    c.phone?.includes(referralSearch) || 
    c.code?.toLowerCase().includes(referralSearch.toLowerCase())
  );

  // Real-time check: khi name hoặc phone thay đổi (chỉ áp dụng cho form tạo mới)
  useEffect(() => {
    if (customer) return; // Chỉ check khi tạo mới, không check khi edit
    const { name, phone, dob } = formData;
    if (!name.trim() || !phone.trim()) {
      setExistingCustomerAlert(null);
      return;
    }
    const timer = setTimeout(async () => {
      const result = await customerService.checkExisting({ name, phone, dob: dob || undefined });
      if (result.exists) {
        setExistingCustomerAlert(result.customer);
      } else {
        setExistingCustomerAlert(null);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [formData.name, formData.phone, formData.dob, customer]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.packageType || !formData.price || !formData.paymentStatus || !formData.assignedStaff || !formData.endDate) {
      toast.error("Vui lòng điền đầy đủ thông tin bắt buộc: Gói tập, giá gói, trạng thái thanh toán và nhân viên tư vấn.");
      return;
    }
    
    // Kiểm tra quy luật chức vụ nhân viên tư vấn
    if (Array.isArray(packages)) {
      const pkg = packages.find(p => p.name === formData.packageType);
      const staff = staffList.find(s => (s._id || s.id) === formData.assignedStaff);
      if (pkg && staff) {
        if (pkg.type === "session" && !["pt", "pm"].includes(staff.role)) {
          toast.error("Gói theo buổi bắt buộc chọn nhân viên tư vấn có chức vụ PT hoặc PM!");
          return;
        }
        if (pkg.type === "monthly" && !["sm", "sale"].includes(staff.role)) {
          toast.error("Gói theo ngày bắt buộc chọn nhân viên tư vấn có chức vụ SM hoặc Sale!");
          return;
        }
      }
    }

    // Chặn submit nếu khách cũ vẫn chọn contractType "new"
    if (existingCustomerAlert && formData.contractType === "new") {
      toast.error("Khách hàng đã có hồ sơ! Vui lòng chọn nguồn hợp đồng là \"Gia hạn\" hoặc \"Nâng cấp\".");
      return;
    }
    if (formData.paymentStatus === "deposit") {
      const depositVal = Number(formData.paidAmount);
      if (isNaN(depositVal) || depositVal <= 0 || depositVal >= Number(formData.price)) {
        toast.error(`Số tiền đặt cọc phải lớn hơn 0 và nhỏ hơn giá gói (${Number(formData.price).toLocaleString()} đ).`);
        return;
      }
    }
    onSave(formData);
  };

  const getRolePriority = (role) => {
    const r = (role || "").toLowerCase();
    if (r === "sm") return 1;
    if (r === "pm") return 2;
    if (r === "sale") return 3;
    if (r === "pt") return 4;
    return 5;
  };

  const selectedPkg = Array.isArray(packages) ? packages.find(p => p.name === formData.packageType) : null;

  const filteredAndSortedStaff = [...staffList]
    .filter((s) => {
      // 1. Phải là vai trò nhân viên hợp lệ có quyền tư vấn
      const hasConsultantRole = ["manager", "pt", "sale", "sm", "pm", "om", "accountant"].includes(s.role);
      if (!hasConsultantRole) return false;
      
      // Nếu chưa chọn gói, hiện tất cả nhân viên tư vấn
      if (!selectedPkg) return true;

      // 2. Áp dụng quy luật lọc theo loại gói
      if (selectedPkg.type === "session") {
        // Gói theo buổi -> bắt buộc chọn PT hoặc PM
        return ["pt", "pm"].includes(s.role);
      } else {
        // Gói theo ngày -> bắt buộc chọn SM hoặc Sale
        return ["sm", "sale"].includes(s.role);
      }
    })
    .sort((a, b) => {
      const priA = getRolePriority(a.role);
      const priB = getRolePriority(b.role);
      if (priA !== priB) return priA - priB;
      const nameA = (a.name || a.fullName || "").toLowerCase();
      const nameB = (b.name || b.fullName || "").toLowerCase();
      return nameA.localeCompare(nameB, "vi");
    });


  return (
    <BaseModal
      isOpen={true}
      onClose={onClose}
      title={customer ? "Cập nhật thông tin hội viên" : "Thêm khách hàng mới"}
      subtitle="Nhập đầy đủ thông tin hồ sơ và gói tập bên dưới"
      icon={<UserPlus size={22} />}
      maxWidth="max-w-3xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy bỏ
          </Button>
          <Button type="submit" form="customerModalForm" variant="primary">
            {customer ? "Lưu thay đổi" : "Tạo khách hàng mới"}
          </Button>
        </>
      }
    >
      <form id="customerModalForm" onSubmit={handleSubmit} className="space-y-6">
        {/* ⚠️ Cảnh báo Contract Type Mismatch */}
        {contractTypeAlert && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-4">
            <div className="flex items-start gap-3">
              <span className="text-amber-500 text-xl mt-0.5">⚠️</span>
              <div className="flex-1">
                <p className="font-bold text-amber-800 dark:text-amber-300 text-sm mb-1">
                  Khách hàng đã có trong hệ thống
                </p>
                <p className="text-amber-700 dark:text-amber-400 text-sm mb-3">
                  {contractTypeAlert.message}
                </p>
                {contractTypeAlert.customerInfo && (
                  <p className="text-amber-600 dark:text-amber-400 text-xs mb-3">
                    Mã KH: <strong>{contractTypeAlert.customerInfo.code}</strong> &mdash; SĐT: <strong>{contractTypeAlert.customerInfo.phone}</strong>
                  </p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-amber-700 dark:text-amber-300 text-xs font-bold">
                    Chọn lại nguồn hợp đồng:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, contractType: "renew" }));
                      onDismissAlert?.();
                    }}
                    className="px-3 py-1 text-xs font-bold rounded-xl bg-primary text-text-light hover:bg-primary/90 transition-colors"
                  >
                    Gia hạn (Renew)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, contractType: "upgrade" }));
                      onDismissAlert?.();
                    }}
                    className="px-3 py-1 text-xs font-bold rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                  >
                    Nâng cấp (Upgrade)
                  </button>
                  <button
                    type="button"
                    onClick={onDismissAlert}
                    className="ml-auto px-2 py-1 text-xs text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    Bỏ qua
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 🔴 Cảnh báo REAL-TIME: phát hiện khách cũ ngay khi điền form */}
        {existingCustomerAlert && formData.contractType === "new" && (
          <div className="rounded-2xl border-2 border-red-300 bg-red-50 dark:bg-red-950/40 p-4">
            <div className="flex items-start gap-3">
              <span className="text-red-500 text-xl mt-0.5">🚫</span>
              <div className="flex-1">
                <p className="font-bold text-red-800 dark:text-red-300 text-sm mb-1">
                  Khách hàng đã có hồ sơ — Không thể dùng "Khách mới"
                </p>
                <p className="text-red-700 dark:text-red-400 text-sm mb-2">
                  <strong>{existingCustomerAlert.name}</strong> ({existingCustomerAlert.code}) đã được đăng ký
                  trong hệ thống. Hợp đồng sẽ không được tạo cho đến khi bạn chọn đúng nguồn hợp đồng.
                </p>
                <p className="text-red-600 dark:text-red-400 text-xs mb-3">
                  SĐT: <strong>{existingCustomerAlert.phone}</strong>
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-red-700 dark:text-red-300 text-xs font-bold">
                    Chọn nguồn hợp đồng phù hợp:
                  </span>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, contractType: "renew" }))}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-primary text-text-light hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    ✅ Gia hạn (Renew)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, contractType: "upgrade" }))}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-sm"
                  >
                    ⬆️ Nâng cấp (Upgrade)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 1. THÔNG TIN CƠ BẢN */}
        <section>
          <h4 className="text-base font-semibold text-text-light dark:text-text-dark mb-4 border-b border-border-light dark:border-border-dark pb-2">
            1. Thông tin cơ bản
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="cust_name" label="Họ và tên" required className="col-span-1 sm:col-span-1">
              <input
                id="cust_name"
                name="name"
                type="text"
                required
                className={inputClassName}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </FormField>

            <FormField id="cust_identityCard" label="Số CCCD">
              <input
                id="cust_identityCard"
                name="identityCard"
                type="text"
                className={inputClassName}
                value={formData.identityCard}
                onChange={(e) => setFormData({ ...formData, identityCard: e.target.value })}
              />
            </FormField>

            <FormField id="cust_phone" label="Số điện thoại" required>
              <input
                id="cust_phone"
                name="phone"
                type="tel"
                required
                className={inputClassName}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </FormField>

            <FormField id="cust_email" label="Email">
              <input
                id="cust_email"
                name="email"
                type="email"
                className={inputClassName}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </FormField>

            <FormField id="cust_dob" label="Ngày sinh" required>
              <input
                id="cust_dob"
                name="dob"
                type="date"
                required
                className={inputClassName}
                value={formData.dob}
                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
              />
            </FormField>

            <FormField id="cust_gender" label="Giới tính">
              <select
                id="cust_gender"
                name="gender"
                className={inputClassName}
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              >
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
              </select>
            </FormField>

            <FormField id="cust_address" label="Địa chỉ" className="col-span-1 sm:col-span-2">
              <input
                id="cust_address"
                name="address"
                type="text"
                className={inputClassName}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </FormField>

            <FormField id="cust_emergencyContactName" label="Người liên hệ khẩn cấp">
              <input
                id="cust_emergencyContactName"
                name="emergencyContactName"
                type="text"
                placeholder="Họ tên người thân"
                className={inputClassName}
                value={formData.emergencyContactName}
                onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
              />
            </FormField>

            <FormField id="cust_emergencyContactPhone" label="SĐT liên hệ khẩn cấp">
              <input
                id="cust_emergencyContactPhone"
                name="emergencyContactPhone"
                type="tel"
                placeholder="Số điện thoại"
                className={inputClassName}
                value={formData.emergencyContactPhone}
                onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
              />
            </FormField>
          </div>
        </section>

        {/* 2. THÔNG TIN GÓI TẬP */}
        <section>
          <h4 className="text-base font-semibold text-text-light dark:text-text-dark mb-4 border-b border-border-light dark:border-border-dark pb-2">
            2. Thông tin gói tập & Hợp đồng
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="cust_packageType" label="Loại gói" required>
              <select
                id="cust_packageType"
                name="packageType"
                required
                className={inputClassName}
                value={formData.packageType}
                onChange={(e) => handlePackageChange(e.target.value)}
              >
                <option value="">-- Chọn gói --</option>
                {Array.isArray(packages) &&
                  packages.map((p) => (
                    <option key={p._id || p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </FormField>

            <FormField id="cust_price" label="Giá gói (VNĐ)" required>
              <input
                id="cust_price"
                name="price"
                type="number"
                required
                className={`${inputClassName} font-bold text-primary`}
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              />
            </FormField>

            <FormField id="cust_paymentStatus" label="Trạng thái thanh toán" required>
              <select
                id="cust_paymentStatus"
                name="paymentStatus"
                required
                className={inputClassName}
                value={formData.paymentStatus}
                onChange={(e) => handlePaymentStatusChange(e.target.value)}
              >
                <option value="paid">Đã thanh toán đủ</option>
                <option value="deposit">Đặt cọc</option>
              </select>
            </FormField>

            <FormField id="cust_assignedStaff" label="Nhân viên tư vấn" required>
              <select
                id="cust_assignedStaff"
                name="assignedStaff"
                required
                className={inputClassName}
                value={formData.assignedStaff}
                onChange={(e) => {
                  const val = e.target.value;
                  const staff = staffList.find((s) => (s._id || s.id) === val);
                  const isPT = staff && ["pt", "pm"].includes(staff.role);
                  setFormData((prev) => ({
                    ...prev,
                    assignedStaff: val,
                    trainer: isPT ? val : "",
                  }));
                }}
              >
                <option value="">-- Chọn nhân viên --</option>
                {filteredAndSortedStaff.map((s) => (
                  <option key={s._id || s.id} value={s._id || s.id}>
                    {s.name || s.fullName} ({s.role.toUpperCase()})
                  </option>
                ))}
              </select>
            </FormField>

            {formData.paymentStatus === "deposit" && (
              <FormField id="cust_paidAmount" label="Số tiền cọc (VNĐ)" className="col-span-1 sm:col-span-2">
                <input
                  id="cust_paidAmount"
                  name="paidAmount"
                  type="number"
                  className={`${inputClassName} font-bold text-orange-500`}
                  value={formData.paidAmount}
                  onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })}
                />
              </FormField>
            )}

            <FormField id="cust_startDate" label="Ngày bắt đầu">
              <input
                id="cust_startDate"
                name="startDate"
                type="date"
                className={inputClassName}
                value={formData.startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
              />
            </FormField>

            <FormField id="cust_endDate" label="Ngày hết hạn">
              <input
                id="cust_endDate"
                name="endDate"
                type="date"
                className={`${inputClassName} opacity-75 cursor-not-allowed`}
                value={formData.endDate}
                readOnly
              />
            </FormField>

            <FormField id="cust_contractType" label="Loại hợp đồng">
              <select
                id="cust_contractType"
                name="contractType"
                className={inputClassName}
                value={formData.contractType}
                onChange={(e) => setFormData({ ...formData, contractType: e.target.value })}
              >
                <option value="new">Khách mới</option>
                <option value="renew">Gia hạn (Renew)</option>
                <option value="upgrade">Nâng cấp (Upgrade)</option>
              </select>
            </FormField>

            <FormField id="cust_contractCode" label="Mã hợp đồng" required>
              <input
                id="cust_contractCode"
                name="contractCode"
                type="text"
                required
                className={inputClassName}
                value={formData.contractCode}
                onChange={(e) => setFormData({ ...formData, contractCode: e.target.value })}
              />
            </FormField>

            <FormField id="cust_source" label="Nguồn khách hàng">
              <select
                id="cust_source"
                name="source"
                className={inputClassName}
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              >
                <option value="facebook">Facebook</option>
                <option value="hotline">Hotline</option>
                <option value="referral">Giới thiệu (Referral)</option>
                <option value="web">Website</option>
                <option value="other">Khác</option>
              </select>
            </FormField>

            <FormField id="cust_referralSearch" label="Hội viên giới thiệu" className="relative">
              {formData.referredBy ? (
                <div className="flex items-center justify-between p-2.5 border border-primary/30 rounded-xl bg-primary/10">
                  <span className="text-sm font-bold text-text-light dark:text-gray-100 truncate">
                    {customerList.find((c) => c.customerId === formData.referredBy)?.name || "Đã chọn hội viên"} (
                    {customerList.find((c) => c.customerId === formData.referredBy)?.code || ""}
                    )
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, referredBy: "", source: "other" });
                      setReferralSearch("");
                    }}
                    className="text-xs text-red-500 hover:underline font-bold shrink-0 ml-2"
                  >
                    Thay đổi
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    id="cust_referralSearch"
                    name="referralSearch"
                    type="text"
                    placeholder="Tìm tên, SĐT hoặc mã hội viên..."
                    className={inputClassName}
                    value={referralSearch}
                    onChange={(e) => setReferralSearch(e.target.value)}
                  />
                  {referralSearch.trim() !== "" && (
                    <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-xl z-20">
                      {filteredReferrals.length === 0 ? (
                        <p className="p-3 text-xs text-gray-400 text-center">Không tìm thấy hội viên nào</p>
                      ) : (
                        filteredReferrals.slice(0, 10).map((c) => (
                          <button
                            key={c._id}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, referredBy: c.customerId, source: "referral" });
                              setReferralSearch("");
                            }}
                            className="w-full text-left p-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold border-b border-border-light dark:border-border-dark last:border-0 transition-colors"
                          >
                            {c.name} ({c.code || c.phone})
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </FormField>

            <FormField id="cust_packageNote" label="Ghi chú gói tập" className="col-span-1 sm:col-span-2">
              <input
                id="cust_packageNote"
                name="packageNote"
                type="text"
                className={inputClassName}
                value={formData.packageNote}
                onChange={(e) => setFormData({ ...formData, packageNote: e.target.value })}
              />
            </FormField>
          </div>
        </section>

        {/* 3. DỊCH VỤ THÊM */}
        <section>
          <h4 className="text-base font-semibold text-text-light dark:text-text-dark mb-4 border-b border-border-light dark:border-border-dark pb-2">
            3. Dịch vụ thêm
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              className={`flex items-center justify-between p-3.5 border rounded-xl cursor-pointer transition-colors ${
                formData.hasLocker
                  ? "border-primary/50 bg-primary/10"
                  : "border-border-light dark:border-border-dark hover:bg-gray-50 dark:hover:bg-gray-800/40"
              }`}
              onClick={() => setFormData((prev) => ({ ...prev, hasLocker: !prev.hasLocker }))}
            >
              <label className="cursor-pointer font-medium text-sm text-gray-700 dark:text-gray-300">
                Thuê Tủ Khóa (Locker)
              </label>
              <div
                className={`w-11 h-6 rounded-full p-1 transition-colors ${
                  formData.hasLocker ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    formData.hasLocker ? "translate-x-5" : ""
                  }`}
                />
              </div>
            </div>

            <div
              className={`flex items-center justify-between p-3.5 border rounded-xl cursor-pointer transition-colors ${
                formData.hasWater
                  ? "border-primary/50 bg-primary/10"
                  : "border-border-light dark:border-border-dark hover:bg-gray-50 dark:hover:bg-gray-800/40"
              }`}
              onClick={() => setFormData((prev) => ({ ...prev, hasWater: !prev.hasWater }))}
            >
              <label className="cursor-pointer font-medium text-sm text-gray-700 dark:text-gray-300">
                Gói Nước Uống
              </label>
              <div
                className={`w-11 h-6 rounded-full p-1 transition-colors ${
                  formData.hasWater ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    formData.hasWater ? "translate-x-5" : ""
                  }`}
                />
              </div>
            </div>
          </div>
        </section>
      </form>
    </BaseModal>
  );
};

export default CustomerModal;
