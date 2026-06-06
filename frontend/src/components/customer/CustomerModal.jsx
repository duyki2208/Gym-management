import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { X } from "lucide-react";
import { staffService } from "../../services/customerService";

const CustomerModal = ({ customer, packages, onSave, onClose }) => {
  const [staffList, setStaffList] = useState([]);

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
    trainer: "",
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
        trainer: customer.trainer || "",
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
        trainer: "",
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

        return {
          ...prev,
          packageType: packageName,
          price: pkg.price,
          endDate: endDate.toISOString().split("T")[0],
          remainingSessions: pkg.sessions || pkg.duration,
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.packageType || !formData.endDate || !formData.assignedStaff) {
      toast.error(
        "Vui lòng điền nhân viên tư vấn, gói tập và ngày hết hạn hợp lệ."
      );
      return;
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

  const filteredAndSortedStaff = [...staffList]
    .filter((s) => ["manager", "pt", "sale", "sm", "pm", "om", "accountant"].includes(s.role))
    .sort((a, b) => {
      const priA = getRolePriority(a.role);
      const priB = getRolePriority(b.role);
      if (priA !== priB) return priA - priB;
      const nameA = (a.name || a.fullName || "").toLowerCase();
      const nameB = (b.name || b.fullName || "").toLowerCase();
      return nameA.localeCompare(nameB, "vi");
    });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
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
          {/* 1. THÔNG TIN CƠ BẢN */}
          <section>
            <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4 border-b pb-2">
              1. Thông tin cơ bản
            </h3>
            <div className="flex gap-6">
              <div className="w-full grid grid-cols-2 gap-4">
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
                  Giá gói (VNĐ)
                </label>
                <input
                  type="number"
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-600"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                />
              </div>

              {/* Row 2 */}
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Thanh toán
                </label>
                <select
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.paymentStatus}
                  onChange={(e) => handlePaymentStatusChange(e.target.value)}
                >
                  <option value="paid">Đã thanh toán đủ</option>
                  <option value="deposit">Đặt cọc</option>
                </select>
              </div>

              <div className="col-span-2 md:col-span-1">
                {formData.paymentStatus === "deposit" && (
                  <>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Số tiền cọc (VNĐ)
                    </label>
                    <input
                      type="number"
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none text-orange-600 font-bold"
                      value={formData.paidAmount}
                      onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })}
                    />
                  </>
                )}
              </div>

              {/* Row 3 */}
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

              {/* Row 4 */}
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nguồn hợp đồng
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

              {/* Row 5 */}
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nhân viên tư vấn <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.assignedStaff}
                  onChange={(e) => setFormData({ ...formData, assignedStaff: e.target.value })}
                >
                  <option value="">-- Chọn nhân viên --</option>
                  {filteredAndSortedStaff.map((s) => (
                    <option key={s._id || s.id} value={s._id || s.id}>
                      {s.name || s.fullName} ({s.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2 md:col-span-1">
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
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-lg shadow-blue-500/30 transition-colors"
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
