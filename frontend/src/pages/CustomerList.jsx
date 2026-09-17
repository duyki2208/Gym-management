import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Download,
  Plus,
  PlusCircle,
  Check,
  User,
  Users,
  Pencil,
  Trash2,
  SearchX,
  SlidersHorizontal,
  X,
  Filter,
} from "lucide-react";
import { customerService, packageService, staffService } from "../services/customerService";
import CustomerModal from "../components/customer/CustomerModal"; // Existing Edit/Add Modal
import CustomerDetailModal from "../components/customer/CustomerDetailModal"; // New Detail Modal
import toast from "react-hot-toast";
import { useConfirm } from "../context/ConfirmContext";
import { getIconColor } from "../utils/iconTone";

const getCustomerStatus = (startDate, endDate, status) => {
  if (status === "frozen") return { status: "frozen", label: "Bảo lưu" };
  if (!endDate) return { status: "active", label: "Hoạt động" };
  const now = new Date();
  const start = startDate ? new Date(startDate) : now;
  const end = new Date(endDate);
  
  if (start.getTime() > now.getTime() + 86400000) { 
      return { status: "not_activated", label: "Chưa kích hoạt" };
  }

  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { status: "expired", label: "Hết hạn" };
  if (diff <= 14) return { status: "expiring", label: "Sắp hết hạn" };
  return { status: "active", label: "Hoạt động" };
};

const CustomerList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [customers, setCustomers] = useState([]);
  const [packages, setPackages] = useState([]);
  const confirm = useConfirm();
  
  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [contractTypeAlert, setContractTypeAlert] = useState(null); // Cảnh báo 409
  
  // Pagination & Filtering State
  const initialSearch = searchParams.get('search') || "";
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || "all"); 
  const [filterPayment, setFilterPayment] = useState("all");
  const [filterContract, setFilterContract] = useState("all");
  const [filterPackage, setFilterPackage] = useState("all");
  const [filterStartDateFrom, setFilterStartDateFrom] = useState("");
  const [filterStartDateTo, setFilterStartDateTo] = useState("");
  const [filterEndDateFrom, setFilterEndDateFrom] = useState("");
  const [filterEndDateTo, setFilterEndDateTo] = useState("");
  const [filterAssignedStaff, setFilterAssignedStaff] = useState("all");

  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false);
  const [showContractDropdown, setShowContractDropdown] = useState(false);
  const [showPackageDropdown, setShowPackageDropdown] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const [staffList, setStaffList] = useState([]);
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);

  const advancedFilterCount = [
    filterPayment !== "all",
    filterContract !== "all",
    filterAssignedStaff !== "all",
    Boolean(filterStartDateFrom || filterStartDateTo || filterEndDateFrom || filterEndDateTo),
  ].filter(Boolean).length;

  const hasAnyFilter =
    searchTerm !== "" ||
    filterStatus !== "all" ||
    filterPackage !== "all" ||
    advancedFilterCount > 0;

  const clearAllFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
    setFilterPackage("all");
    setFilterPayment("all");
    setFilterContract("all");
    setFilterAssignedStaff("all");
    setFilterStartDateFrom("");
    setFilterStartDateTo("");
    setFilterEndDateFrom("");
    setFilterEndDateTo("");
  };

  // Auto-open modal if 'id' param is present
  useEffect(() => {
    const targetId = searchParams.get('id');
    if (targetId && customers.length > 0) {
      const target = customers.find(c => c._id === targetId || c.id === targetId);
      if (target) {
        setSelectedCustomer(target);
        setShowDetailModal(true);
        // Clear params to avoid reopening on refresh
        setSearchParams({});
      }
    }
  }, [customers, searchParams, setSearchParams]);

  // Auto-open modal with pre-filled details when converting from Lead
  useEffect(() => {
    const convertName = searchParams.get('convertName');
    if (convertName) {
      const convertPhone = searchParams.get('convertPhone') || "";
      const convertEmail = searchParams.get('convertEmail') || "";
      const convertSource = searchParams.get('convertSource') || "other";
      const convertStaff = searchParams.get('convertStaff') || "";
      
      setSelectedCustomer({
        name: convertName,
        phone: convertPhone,
        email: convertEmail,
        source: convertSource,
        assignedStaff: convertStaff,
        contractType: "new"
      });
      setShowEditModal(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);
  
  // Check Admin Role
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("gym_user") || "{}");
    setIsAdmin(user.role === "admin" || user.role === "accountant");
  }, []);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to page 1 on new search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterPayment, filterContract, filterPackage, filterStartDateFrom, filterStartDateTo, filterEndDateFrom, filterEndDateTo, filterAssignedStaff]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [customerData, packageData, staffData] = await Promise.all([
        customerService.getAll({ 
            page, 
            limit: 10, 
            search: debouncedSearch, 
            status: filterStatus,
            paymentStatus: filterPayment,
            contractType: filterContract,
            packageType: filterPackage,
            assignedStaff: filterAssignedStaff,
            startDateFrom: filterStartDateFrom,
            startDateTo: filterStartDateTo,
            endDateFrom: filterEndDateFrom,
            endDateTo: filterEndDateTo
        }),
        packageService.getAll(),
        staffService.getAll(),
      ]);
      
      setCustomers(customerData.customers || []);
      setTotalPages(customerData.totalPages || 1);
      setTotalCustomers(customerData.totalCustomers || 0);
      
      setPackages(Array.isArray(packageData) ? packageData : []);
      
      const staffs = Array.isArray(staffData) ? staffData : [];
      setStaffList(staffs.filter(s => ["manager", "pt", "sale", "sm", "pm", "om", "accountant"].includes(s.role)));
    } catch (err) {
      console.error("Lỗi tải khách hàng:", err);
      setCustomers([]);
      setPackages([]);
      setStaffList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, debouncedSearch, filterStatus, filterPayment, filterContract, filterPackage, filterStartDateFrom, filterStartDateTo, filterEndDateFrom, filterEndDateTo, filterAssignedStaff]);

  const handleSave = async (data) => {
    try {
      setContractTypeAlert(null); // Reset alert cũ
      const result = await customerService.save(data);
      fetchData();
      setShowEditModal(false);
      setContractTypeAlert(null);

      // Kiểm tra cảnh báo giới thiệu: người giới thiệu không có gói active
      if (result?.referralWarning) {
        const w = result.referralWarning;
        toast.success("Đã tạo hội viên mới thành công!", { duration: 3000 });
        setTimeout(() => {
          toast(
            `⚠️ Chưa cộng thưởng giới thiệu!\n\n${w.message}`,
            {
              duration: 10000,
              icon: "🔔",
              style: {
                background: "#fffbeb",
                border: "1px solid #f59e0b",
                color: "#92400e",
                maxWidth: "420px",
                fontSize: "13px",
                whiteSpace: "pre-line",
              },
            }
          );
        }, 500);
      } else {
        toast.success("Lưu thông tin hội viên thành công!");
      }
    } catch (error) {
      const errData = error.response?.data;
      // Lỗi 409: khách cũ chọn sai contractType — không đóng modal, hiển thị cảnh báo trên form
      if (error.response?.status === 409 && errData?.code === "CONTRACT_TYPE_MISMATCH") {
        setContractTypeAlert(errData);
        return;
      }
      console.error("Lỗi lưu khách hàng:", error);
      toast.error(errData?.message || "Lỗi khi lưu thông tin hội viên");
    }
  };

  const handleDelete = async (id) => {
    const isConfirmed = await confirm({
      title: "Xóa khách hàng",
      message: "Bạn có chắc chắn muốn xóa khách hàng này khỏi hệ thống? Hành động này không thể hoàn tác.",
      type: "danger"
    });
    if (isConfirmed) {
      try {
        await customerService.delete(id);
        toast.success("Đã xóa khách hàng thành công!");
        fetchData(); // Reload data
      } catch (error) {
        console.error("Lỗi xóa khách hàng:", error);
        toast.error("Không thể xóa khách hàng");
      }
    }
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async (preset = null) => {
    try {
      setIsExporting(true);
      toast.loading("Đang khởi tạo file Excel...", { id: "export-excel" });
      const params = {
        search: debouncedSearch,
        paymentStatus: filterPayment,
        contractType: filterContract,
        packageName: filterPackage,
        assignedStaffId: filterAssignedStaff,
        startDateFrom: filterStartDateFrom,
        startDateTo: filterStartDateTo,
      };
      if (filterStatus === 'expiring') {
        params.expiringDays = 7;
      }
      await customerService.exportExcel(params);
      toast.success("Xuất file Excel thành công!", { id: "export-excel" });
    } catch (error) {
      console.error("Export excel error:", error);
      toast.error("Lỗi khi xuất file Excel", { id: "export-excel" });
    } finally {
      setIsExporting(false);
    }
  };

  const displayCustomers = customers;

  if (loading && customers.length === 0)
    return <div className="p-10 text-center">loading...</div>;

  return (
    <div className="flex flex-col gap-6 font-display">

      {/* ── Khối 1: Tiêu đề trang và thao tác chính ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-light dark:bg-surface-dark p-6 rounded-xl border border-border-light dark:border-border-dark shadow-sm">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2.5 text-text-light dark:text-text-dark">
            <Users size={26} className={getIconColor(Users)} /> Quản lý hội viên & hợp đồng
          </h2>
          <p className="text-text-muted-light dark:text-text-muted-dark text-sm font-normal mt-1">
            Theo dõi hồ sơ hội viên, thời hạn gói tập, tiến độ thanh toán và lịch sử giao dịch
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            onClick={() => handleExportExcel()}
            disabled={isExporting}
            className="flex items-center gap-1.5 h-10 px-4 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark rounded-xl text-sm font-semibold transition-all hover:border-primary disabled:opacity-50 cursor-pointer"
          >
            <Download size={16} />
            {isExporting ? "Đang xuất..." : "Xuất Excel"}
          </button>
          {isAdmin && (
            <button
              onClick={() => { setSelectedCustomer(null); setShowEditModal(true); }}
              className="flex items-center gap-2 h-10 px-4 bg-primary text-text-light rounded-xl text-sm font-semibold hover:bg-primary-hover shadow-sm transition-all cursor-pointer"
            >
              <Plus size={18} />
              Thêm Hội Viên Mới
            </button>
          )}
        </div>
      </div>

      {/* ── Khối 2: Filter Bar Cải Tiến (Phân cấp Primary & Secondary) ── */}
      <div className="flex flex-col gap-3 p-4 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm">
        {/* Hàng 1: Primary Filters + Ô tìm kiếm + Nút Nâng cao */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Ô tìm kiếm nổi bật */}
          <div className="relative flex-1 min-w-[260px]">
            <Search size={18} className="absolute left-3.5 top-3 text-gray-400" />
            <input
              id="customerListSearchInput"
              name="customerListSearch"
              type="text"
              aria-label="Tìm kiếm hội viên theo tên hoặc số điện thoại"
              className="w-full pl-10 pr-4 h-10 border border-border-light dark:border-border-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary text-sm bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark placeholder:text-gray-400 transition-colors"
              placeholder="Tìm theo tên, SĐT, mã hội viên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Primary Dropdown 1: Trạng thái */}
          <div className="w-44">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={`w-full h-10 px-3 text-sm font-medium rounded-xl border transition-all cursor-pointer ${
                filterStatus !== "all"
                  ? "border-primary bg-primary/10 text-text-light dark:text-primary font-semibold"
                  : "border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-gray-700 dark:text-gray-300"
              }`}
            >
              <option value="all">Trạng thái: Tất cả</option>
              <option value="active">Đang hoạt động</option>
              <option value="not_activated">Chưa kích hoạt</option>
              <option value="expiring">Sắp hết hạn</option>
              <option value="expired">Hết hạn</option>
              <option value="frozen">Bảo lưu</option>
            </select>
          </div>

          {/* Primary Dropdown 2: Gói tập */}
          <div className="w-44">
            <select
              value={filterPackage}
              onChange={(e) => setFilterPackage(e.target.value)}
              className={`w-full h-10 px-3 text-sm font-medium rounded-xl border transition-all cursor-pointer ${
                filterPackage !== "all"
                  ? "border-primary bg-primary/10 text-text-light dark:text-primary font-semibold"
                  : "border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-gray-700 dark:text-gray-300"
              }`}
            >
              <option value="all">Gói tập: Tất cả</option>
              {packages.map((pkg) => (
                <option key={pkg._id || pkg.name} value={pkg.name}>
                  {pkg.name}
                </option>
              ))}
            </select>
          </div>

          {/* Nút toggle Bộ lọc nâng cao */}
          <button
            type="button"
            onClick={() => setShowAdvancedFilter((prev) => !prev)}
            className={`flex items-center gap-2 h-10 px-3.5 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
              showAdvancedFilter || advancedFilterCount > 0
                ? "border-primary bg-primary/10 text-text-light dark:text-primary shadow-sm"
                : "border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
            }`}
          >
            <SlidersHorizontal size={16} />
            <span>Bộ lọc nâng cao</span>
            {advancedFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-primary text-text-light dark:text-background-dark text-[11px] font-semibold flex items-center justify-center">
                {advancedFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Panel Secondary Filters (mở ra khi click Bộ lọc nâng cao) */}
        {showAdvancedFilter && (
          <div className="p-4 bg-background-light dark:bg-background-dark/50 rounded-xl border border-border-light dark:border-border-dark grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in duration-150">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                Thanh toán
              </label>
              <select
                value={filterPayment}
                onChange={(e) => setFilterPayment(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-text-light dark:text-text-dark font-medium"
              >
                <option value="all">Tất cả hình thức</option>
                <option value="paid">Đã thanh toán đủ</option>
                <option value="deposit">Đặt cọc</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                Nguồn hợp đồng
              </label>
              <select
                value={filterContract}
                onChange={(e) => setFilterContract(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-text-light dark:text-text-dark font-medium"
              >
                <option value="all">Tất cả nguồn</option>
                <option value="new">Khách mới</option>
                <option value="renew">Gia hạn</option>
                <option value="upgrade">Nâng cấp</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                Nhân viên tư vấn
              </label>
              <select
                value={filterAssignedStaff}
                onChange={(e) => setFilterAssignedStaff(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-text-light dark:text-text-dark font-medium"
              >
                <option value="all">Tất cả nhân viên</option>
                {staffList.map((staff) => (
                  <option key={staff._id || staff.id} value={staff._id || staff.id}>
                    {staff.name || staff.fullName} ({staff.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                Ngày bắt đầu
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={filterStartDateFrom}
                  onChange={(e) => setFilterStartDateFrom(e.target.value)}
                  className="w-full h-9 px-2 text-xs rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-text-light dark:text-text-dark"
                  title="Từ ngày"
                />
                <span className="text-gray-400 text-xs">-</span>
                <input
                  type="date"
                  value={filterStartDateTo}
                  onChange={(e) => setFilterStartDateTo(e.target.value)}
                  className="w-full h-9 px-2 text-xs rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-text-light dark:text-text-dark"
                  title="Đến ngày"
                />
              </div>
            </div>
          </div>
        )}

        {/* Hàng 2: Dải Active Filter Tags */}
        {hasAnyFilter && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border-light dark:border-border-dark">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Filter size={13} /> Đang lọc theo:
            </span>

            {searchTerm && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-primary/15 text-text-light dark:text-primary">
                Tìm: "{searchTerm}"
                <button
                  onClick={() => setSearchTerm("")}
                  className="hover:text-red-500 ml-0.5 cursor-pointer"
                >
                  <X size={13} />
                </button>
              </span>
            )}

            {filterStatus !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                Trạng thái: {
                  {
                    active: "Đang hoạt động",
                    not_activated: "Chưa kích hoạt",
                    expiring: "Sắp hết hạn",
                    expired: "Hết hạn",
                    frozen: "Bảo lưu",
                  }[filterStatus] || filterStatus
                }
                <button
                  onClick={() => setFilterStatus("all")}
                  className="hover:text-red-500 ml-0.5 cursor-pointer"
                >
                  <X size={13} />
                </button>
              </span>
            )}

            {filterPackage !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                Gói: {filterPackage}
                <button
                  onClick={() => setFilterPackage("all")}
                  className="hover:text-red-500 ml-0.5 cursor-pointer"
                >
                  <X size={13} />
                </button>
              </span>
            )}

            {filterPayment !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300">
                Thanh toán: {filterPayment === "paid" ? "Đã thanh toán" : "Đặt cọc"}
                <button
                  onClick={() => setFilterPayment("all")}
                  className="hover:text-red-500 ml-0.5 cursor-pointer"
                >
                  <X size={13} />
                </button>
              </span>
            )}

            {filterContract !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300">
                Nguồn: {
                  { new: "Khách mới", renew: "Gia hạn", upgrade: "Nâng cấp" }[
                    filterContract
                  ] || filterContract
                }
                <button
                  onClick={() => setFilterContract("all")}
                  className="hover:text-red-500 ml-0.5 cursor-pointer"
                >
                  <X size={13} />
                </button>
              </span>
            )}

            {filterAssignedStaff !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-teal-500/15 text-teal-700 dark:text-teal-300">
                NV: {staffList.find((s) => s._id === filterAssignedStaff || s.id === filterAssignedStaff)?.name || "Đã chọn"}
                <button
                  onClick={() => setFilterAssignedStaff("all")}
                  className="hover:text-red-500 ml-0.5 cursor-pointer"
                >
                  <X size={13} />
                </button>
              </span>
            )}

            {(filterStartDateFrom || filterStartDateTo) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300">
                Ngày bắt đầu: {filterStartDateFrom || "..."} → {filterStartDateTo || "..."}
                <button
                  onClick={() => { setFilterStartDateFrom(""); setFilterStartDateTo(""); }}
                  className="hover:text-red-500 ml-0.5 cursor-pointer"
                >
                  <X size={13} />
                </button>
              </span>
            )}

            <button
              onClick={clearAllFilters}
              className="ml-auto text-xs font-bold text-red-500 hover:text-red-600 hover:underline cursor-pointer transition-colors"
            >
              Xóa tất cả bộ lọc
            </button>
          </div>
        )}
      </div>

      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-background-light dark:bg-background-dark uppercase text-xs font-semibold tracking-wide text-text-secondary-light dark:text-text-secondary-dark border-b border-border-light dark:border-border-dark">
            <tr>
              <th className="p-4 w-[5%]"></th>
              <th className="p-4 pl-8 w-[25%]">HỌ VÀ TÊN</th>
              <th className="p-4 w-[15%]">SĐT</th>
              <th className="p-4 pl-8 w-[20%]">GÓI TẬP</th>
              <th className="p-4 w-[20%]">TRẠNG THÁI</th>
              {isAdmin && <th className="p-4 text-right w-[15%]">HÀNH ĐỘNG</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light dark:divide-border-dark font-display">
            {displayCustomers.length > 0 ? displayCustomers.map((c) => {
                const st = getCustomerStatus(c.startDate, c.endDate, c.status);
                return (
                  <tr 
                    key={c._id || c.id} 
                    className="group hover:bg-background-light/50 dark:hover:bg-background-dark/50 transition-colors cursor-pointer"
                    onClick={() => {
                        setSelectedCustomer(c);
                        setShowDetailModal(true);
                    }}
                  >
                    <td className="p-4 pr-0">
                       <div className="w-10 h-10 rounded-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark overflow-hidden mx-auto md:mx-0">
                          {c.avatarUrl ? (
                             <img src={c.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : c.avatar && c.avatar !== "👤" ? (
                             <img src={c.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                             <div className="w-full h-full flex items-center justify-center text-subtle-light dark:text-subtle-dark">
                                <User size={18} className="text-subtle-light dark:text-subtle-dark" />
                             </div>
                          )}
                       </div>
                    </td>
                    <td className="p-4 pl-8">
                        <div className="font-normal text-text-light dark:text-text-dark text-sm">{c.name}</div>
                        <div className="text-xs text-subtle-light dark:text-subtle-dark font-normal mt-0.5">{c.code}</div>
                    </td>
                    <td className="p-4 text-sm font-normal text-text-light dark:text-text-dark">
                        {c.phone}
                    </td>
                    <td className="p-4 pl-8">
                        <span className="text-sm font-normal text-text-light dark:text-text-dark">{c.packageType}</span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                          st.status === "active"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : st.status === "frozen"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : st.status === "expiring" 
                            ? "bg-yellow-50 text-yellow-700 border-yellow-200" 
                            : st.status === "not_activated"
                            ? "bg-sky-50 text-sky-700 border-sky-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${
                             st.status === "active" ? "bg-green-500" 
                             : st.status === "frozen" ? "bg-purple-500"
                             : st.status === "expiring" ? "bg-yellow-500" 
                             : st.status === "not_activated" ? "bg-sky-500"
                             : "bg-red-500"
                        }`}></span>
                        {st.label}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent opening detail modal
                              setSelectedCustomer(c);
                              setShowEditModal(true);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors"
                            title="Sửa thông tin"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(c._id || c.id);
                            }}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-xl transition-colors"
                            title="Xóa khách hàng"
                          >
                             <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              }) : (
                 <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="p-12 text-center text-gray-500">
                        <div className="flex flex-col items-center gap-3">
                            <div className="bg-gray-100 p-4 rounded-full">
                                <SearchX size={28} className="text-gray-400" />
                            </div>
                            <p>Không tìm thấy khách hàng nào phù hợp.</p>
                        </div>
                    </td>
                 </tr>
              )}
          </tbody>
        </table>
        
        {/* Pagination Controls */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
            <div className="text-sm font-bold text-gray-700">
                Trang: {page}/{totalPages}
            </div>
            <div className="flex gap-2">
                <button
                    onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                    disabled={page === 1}
                    className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Trang trước
                </button>
                <button
                    onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={page >= totalPages}
                    className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Trang sau
                </button>
            </div>
        </div>
      </div>

      {/* Edit/Add Modal */}
      {showEditModal && Array.isArray(packages) && (
        <CustomerModal
          customer={selectedCustomer}
          packages={packages}
          onSave={handleSave}
          contractTypeAlert={contractTypeAlert}
          onDismissAlert={() => setContractTypeAlert(null)}
          onClose={() => {
            setShowEditModal(false);
            setSelectedCustomer(null);
            setContractTypeAlert(null);
          }}
        />
      )}

      {showDetailModal && selectedCustomer && (
          <CustomerDetailModal 
             customer={selectedCustomer}
             packages={packages}
             onClose={() => {
                 setShowDetailModal(false);
                 setSelectedCustomer(null);
             }}
             onUpdate={fetchData}
          />
      )}
    </div>
  );
};
export default CustomerList;
