import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { X } from "lucide-react";
import { staffService, customerService } from "../../services/customerService";
import api from "../../services/api";

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
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {customer ? "Cập nhật thông tin" : "Thêm khách hàng mới"}
            </h2>
            <p className="text-sm text-gray-500">
              Nhập đầy đủ thông tin bên dưới
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">

          {/* ⚠️ Cảnh báo Contract Type Mismatch */}
          {contractTypeAlert && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <span className="text-amber-500 text-xl mt-0.5">⚠️</span>
                <div className="flex-1">
                  <p className="font-semibold text-amber-800 text-sm mb-1">
                    Khách hàng đã có trong hệ thống
                  </p>
                  <p className="text-amber-700 text-sm mb-3">
                    {contractTypeAlert.message}
                  </p>
                  {contractTypeAlert.customerInfo && (
                    <p className="text-amber-600 text-xs mb-3">
                      Mã KH: <strong>{contractTypeAlert.customerInfo.code}</strong>{" "}
                      &mdash; SĐT: <strong>{contractTypeAlert.customerInfo.phone}</strong>
                    </p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-amber-700 text-xs font-medium">Chọn lại nguồn hợp đồng:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, contractType: "renew" }));
                        onDismissAlert?.();
                      }}
                      className="px-3 py-1 text-xs font-semibold rounded-full bg-primary text-background-dark hover:bg-primary/90 transition-colors"
                    >
                      Gia hạn (Renew)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, contractType: "upgrade" }));
                        onDismissAlert?.();
                      }}
                      className="px-3 py-1 text-xs font-semibold rounded-full bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                    >
                      Nâng cấp (Upgrade)
                    </button>
                    <button
                      type="button"
                      onClick={onDismissAlert}
                      className="ml-auto px-2 py-1 text-xs text-amber-600 hover:text-amber-800 underline"
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
            <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <span className="text-red-500 text-xl mt-0.5">🚫</span>
                <div className="flex-1">
                  <p className="font-bold text-red-800 text-sm mb-1">
                    Khách hàng đã có hồ sơ — Không thể dùng "Khách mới"
                  </p>
                  <p className="text-red-700 text-sm mb-2">
                    <strong>{existingCustomerAlert.name}</strong> ({existingCustomerAlert.code}) đã được đăng ký
                    trong hệ thống. Hợp đồng sẽ không được tạo cho đến khi bạn chọn đúng nguồn hợp đồng.
                  </p>
                  <p className="text-red-600 text-xs mb-3">
                    SĐT: <strong>{existingCustomerAlert.phone}</strong>
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-red-700 text-xs font-semibold">Chọn nguồn hợp đồng phù hợp:</span>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, contractType: "renew" }))}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg bg-primary text-background-dark hover:bg-primary/90 transition-colors shadow-sm"
                    >
                      ✅ Gia hạn (Renew)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, contractType: "upgrade" }))}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-sm"
                    >
                      ⬆️ Nâng cấp (Upgrade)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <section>
            <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4 border-b pb-2">
              1. Thông tin cơ bản
            </h3>
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Họ và tên <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Số CCCD
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    
                    value={formData.identityCard}
                    onChange={(e) =>
                      setFormData({ ...formData, identityCard: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Số điện thoại <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ngày sinh <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.dob}
                    onChange={(e) =>
                      setFormData({ ...formData, dob: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Giới tính
                  </label>
                  <select
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.gender}
                    onChange={(e) =>
                      setFormData({ ...formData, gender: e.target.value })
                    }
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Địa chỉ
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                  />
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1 font-bold text-red-600">
                    Người liên hệ khẩn cấp
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded border-red-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none font-semibold text-gray-800"
                    
                    value={formData.emergencyContactName}
                    onChange={(e) =>
                      setFormData({ ...formData, emergencyContactName: e.target.value })
                    }
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1 font-bold text-red-600">
                    SĐT liên hệ khẩn cấp
                  </label>
                  <input
                    type="tel"
                    className="w-full p-2 border rounded border-red-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none font-semibold text-gray-800"
                    
                    value={formData.emergencyContactPhone}
                    onChange={(e) =>
                      setFormData({ ...formData, emergencyContactPhone: e.target.value })
                    }
                  />
                </div>
              </div>
          </section>

          {/* 2. THÔNG TIN GÓI TẬP */}
          <section>
            <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4 border-b pb-2">
              2. Thông tin gói tập
            </h3>
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
              {/* Row 1 */}
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Loại gói <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
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
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Giá gói (VNĐ) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-600"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                />
              </div>

              {/* Row 2: Trạng thái thanh toán & Nhân viên tư vấn */}
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trạng thái thanh toán <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.paymentStatus}
                  onChange={(e) => handlePaymentStatusChange(e.target.value)}
                >
                  <option value="paid">Đã thanh toán đủ</option>
                  <option value="deposit">Đặt cọc</option>
                </select>
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nhân viên tư vấn <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.assignedStaff}
                  onChange={(e) => {
                    const val = e.target.value;
                    const staff = staffList.find(s => (s._id || s.id) === val);
                    const isPT = staff && ["pt", "pm"].includes(staff.role);
                    setFormData(prev => ({
                      ...prev,
                      assignedStaff: val,
                      trainer: isPT ? val : ""
                    }));
                  }}
                >
                  <option value="">-- Chọn nhân viên --</option>
                  {filteredAndSortedStaff.map((s) => (
                    <option key={s._id || s.id} value={s._id || s.id}>
                      {s.name || s.fullName} ({s.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Row 3: Số tiền đặt cọc */}
              {formData.paymentStatus === "deposit" && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Số tiền cọc (VNĐ)
                  </label>
                  <input
                    type="number"
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none text-orange-600 font-bold"
                    value={formData.paidAmount}
                    onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })}
                  />
                </div>
              )}

              {/* Row 4: Ngày bắt đầu & Ngày hết hạn */}
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ngày bắt đầu
                </label>
                <input
                  type="date"
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                />
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ngày hết hạn
                </label>
                <input
                  type="date"
                  className="w-full p-2 border rounded bg-white text-gray-500"
                  value={formData.endDate}
                  readOnly
                />
              </div>

              {/* Row 5: Nguồn hợp đồng & Mã hợp đồng */}
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Loại hợp đồng
                </label>
                <select
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.contractType}
                  onChange={(e) => setFormData({ ...formData, contractType: e.target.value })}
                >
                  <option value="new">Khách mới</option>
                  <option value="renew">Gia hạn (Renew)</option>
                  <option value="upgrade">Nâng cấp (Upgrade)</option>
                </select>
              </div>

              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mã hợp đồng <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.contractCode}
                  onChange={(e) => setFormData({ ...formData, contractCode: e.target.value })}
                />
              </div>

              {/* Row 6: Nguồn khách hàng & Hội viên giới thiệu (Được chuyển từ phần 1) */}
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nguồn khách hàng
                </label>
                <select
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.source}
                  onChange={(e) =>
                    setFormData({ ...formData, source: e.target.value })
                  }
                >
                  <option value="facebook">Facebook</option>
                  <option value="hotline">Hotline</option>
                  <option value="referral">Giới thiệu (Referral)</option>
                  <option value="web">Website</option>
                  <option value="other">Khác</option>
                </select>
              </div>

              <div className="col-span-2 md:col-span-1 relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hội viên giới thiệu
                </label>
                {formData.referredBy ? (
                  <div>
                    <div className="flex items-center justify-between p-2 border rounded bg-blue-50 border-blue-200">
                      <span className="text-sm font-bold text-blue-700">
                        {customerList.find(c => c.customerId === formData.referredBy)?.name || "Đã chọn hội viên"} (
                        {customerList.find(c => c.customerId === formData.referredBy)?.code || ""}
                        )
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, referredBy: "", source: "other" });
                          setReferralSearch("");
                        }}
                        className="text-xs text-red-500 hover:underline font-bold"
                      >
                        Thay đổi
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-green-600 font-semibold flex items-center gap-1">
                    
                    </p>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      value={referralSearch}
                      onChange={(e) => setReferralSearch(e.target.value)}
                    />
                    {referralSearch.trim() !== "" && (
                      <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-20">
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
                              className="w-full text-left p-2 hover:bg-blue-50 hover:text-blue-700 text-xs font-semibold border-b border-gray-100 last:border-0 transition-colors"
                            >
                              {c.name} ({c.code || c.phone})
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Row 7: Ghi chú gói tập (Phần ghi chú gói tập để 1 dòng -> col-span-2) */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ghi chú gói tập
                </label>
                <input
                  type="text"
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.packageNote}
                  onChange={(e) => setFormData({ ...formData, packageNote: e.target.value })}
                />
              </div>
            </div>
          </section>

          {/* 3. DỊCH VỤ THÊM */}
          <section>
            <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4 border-b pb-2">
              3. Dịch vụ thêm
            </h3>
            <div className="grid grid-cols-2 gap-4">

              <div
                className="flex items-center justify-between p-3 border rounded hover:bg-gray-50 cursor-pointer col-span-2 md:col-span-1"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    hasLocker: !prev.hasLocker,
                  }))
                }
              >
                <label className="cursor-pointer font-medium text-gray-700">
                  Thuê Tủ Khóa
                </label>
                <div
                  className={`w-12 h-6 rounded-full p-1 transition-colors ${
                    formData.hasLocker ? "bg-blue-600" : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      formData.hasLocker ? "translate-x-6" : ""
                    }`}
                  ></div>
                </div>
              </div>

              <div
                className="flex items-center justify-between p-3 border rounded hover:bg-gray-50 cursor-pointer col-span-2 md:col-span-1"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    hasWater: !prev.hasWater,
                  }))
                }
              >
                <label className="cursor-pointer font-medium text-gray-700">
                  Gói nước uống
                </label>
                <div
                  className={`w-12 h-6 rounded-full p-1 transition-colors ${
                    formData.hasWater ? "bg-blue-600" : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      formData.hasWater ? "translate-x-6" : ""
                    }`}
                  ></div>
                </div>
              </div>
            </div>
          </section>

          <div className="flex items-center justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white pb-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-primary text-background-dark rounded-lg hover:bg-primary/90 font-bold shadow-lg shadow-primary/25 transition-colors"
            >
              {customer ? "Lưu thay đổi" : "Tạo khách hàng mới"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerModal;
