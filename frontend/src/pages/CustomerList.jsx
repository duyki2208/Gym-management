import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { customerService, packageService, staffService } from "../services/customerService";
import CustomerModal from "../components/customer/CustomerModal"; // Existing Edit/Add Modal
import CustomerDetailModal from "../components/customer/CustomerDetailModal"; // New Detail Modal
import toast from "react-hot-toast";
import { useConfirm } from "../context/ConfirmContext";

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
      await customerService.save(data);
      fetchData(); // Reload data
      setShowEditModal(false);
      toast.success("Lưu thông tin hội viên thành công!");
    } catch (error) {
      console.error("Lỗi lưu khách hàng:", error);
      toast.error(error.response?.data?.message || "Lỗi khi lưu thông tin hội viên");
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

  // No longer need client-side filtering: filteredCustomers is just customers
  const displayCustomers = customers;

  if (loading && customers.length === 0)
    return <div className="p-10 text-center">loading...</div>;

  return (
    <div className="flex flex-col gap-6 font-display">

      {/* ── Card bao quanh: Search + Add + Filter ── */}
      <div className="flex flex-col gap-3 p-4 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm">

        {/* Row 1: Search + Add */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-2xl">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-500 text-xl">search</span>
            <input
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-gray-100"
              placeholder="Tìm tên, SĐT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex-1" />

          {/* Nút Thêm Khách — giống nút Thêm gói (Packages) */}
          {isAdmin && (
            <button
              onClick={() => { setSelectedCustomer(null); setShowEditModal(true); }}
              className="flex items-center gap-2 h-10 px-4 bg-primary text-text-light rounded-xl font-bold hover:opacity-90 shrink-0"
            >
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                add_circle
              </span>
              Thêm Khách
            </button>
          )}
        </div>

        {/* Row 2: Bộ lọc Trạng thái (không icon) */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <button
              onClick={() => setShowStatusDropdown(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                filterStatus !== 'all'
                  ? 'bg-green-100 text-green-800 border-green-300'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400 hover:text-gray-800'
              }`}
            >
              Trạng thái
              {filterStatus !== 'all' && (
                <span className="ml-1 bg-green-700 text-white rounded-full px-1.5 text-[10px] font-black">
                  {[{value:'active',label:'Đang tập'},{value:'not_activated',label:'Chưa KH'},{value:'expiring',label:'Sắp hết hạn'},{value:'expired',label:'Hết hạn'},{value:'frozen',label:'Bảo lưu'}].find(t=>t.value===filterStatus)?.label}
                </span>
              )}
            </button>
 
            {showStatusDropdown && (
              <div className="absolute top-full mt-1.5 left-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]">
                {[
                  { value: 'all',           label: 'Tất cả'          },
                  { value: 'active',        label: 'Đang hoạt động'  },
                  { value: 'not_activated', label: 'Chưa kích hoạt'  },
                  { value: 'expiring',      label: 'Sắp hết hạn'     },
                  { value: 'expired',       label: 'Hết hạn'          },
                  { value: 'frozen',        label: 'Bảo lưu'         },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setFilterStatus(opt.value); setShowStatusDropdown(false); }}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors ${
                      filterStatus === opt.value ? 'font-bold text-green-800 bg-green-50' : 'text-gray-600'
                    }`}
                  >
                    {opt.label}
                    {filterStatus === opt.value && (
                      <span className="material-symbols-outlined text-green-600 ml-auto" style={{fontSize:'16px'}}>check</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => {
                setShowPaymentDropdown(prev => !prev);
                setShowStatusDropdown(false); setShowContractDropdown(false); setShowPackageDropdown(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                filterPayment !== 'all'
                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400 hover:text-gray-800'
              }`}
            >
              Thanh toán
              {filterPayment !== 'all' && (
                <span className="ml-1 bg-blue-700 text-white rounded-full px-1.5 text-[10px] font-black">
                  {[{value:'paid',label:'Đã thanh toán'},{value:'deposit',label:'Đặt cọc'},{value:'unpaid',label:'Chưa thanh toán'}].find(t=>t.value===filterPayment)?.label}
                </span>
              )}
            </button>

            {showPaymentDropdown && (
              <div className="absolute top-full mt-1.5 left-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]">
                {[
                  { value: 'all',     label: 'Tất cả'          },
                  { value: 'paid',    label: 'Đã thanh toán'  },
                  { value: 'deposit', label: 'Đặt cọc'  },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setFilterPayment(opt.value); setShowPaymentDropdown(false); }}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors ${
                      filterPayment === opt.value ? 'font-bold text-blue-800 bg-blue-50' : 'text-gray-600'
                    }`}
                  >
                    {opt.label}
                    {filterPayment === opt.value && (
                      <span className="material-symbols-outlined text-blue-600 ml-auto" style={{fontSize:'16px'}}>check</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => {
                setShowContractDropdown(prev => !prev);
                setShowStatusDropdown(false); setShowPaymentDropdown(false); setShowPackageDropdown(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                filterContract !== 'all'
                  ? 'bg-purple-100 text-purple-800 border-purple-300'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400 hover:text-gray-800'
              }`}
            >
              Nguồn khách
              {filterContract !== 'all' && (
                <span className="ml-1 bg-purple-700 text-white rounded-full px-1.5 text-[10px] font-black">
                  {[{value:'new',label:'Mới'},{value:'renew',label:'Gia hạn'},{value:'upgrade',label:'Nâng cấp'}].find(t=>t.value===filterContract)?.label}
                </span>
              )}
            </button>

            {showContractDropdown && (
              <div className="absolute top-full mt-1.5 left-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px]">
                {[
                  { value: 'all',     label: 'Tất cả'          },
                  { value: 'new',     label: 'Khách mới'  },
                  { value: 'renew',   label: 'Gia hạn (Renew)'  },
                  { value: 'upgrade', label: 'Nâng cấp'     },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setFilterContract(opt.value); setShowContractDropdown(false); }}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors ${
                      filterContract === opt.value ? 'font-bold text-purple-800 bg-purple-50' : 'text-gray-600'
                    }`}
                  >
                    {opt.label}
                    {filterContract === opt.value && (
                      <span className="material-symbols-outlined text-purple-600 ml-auto" style={{fontSize:'16px'}}>check</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => {
                setShowPackageDropdown(prev => !prev);
                setShowStatusDropdown(false); setShowPaymentDropdown(false); setShowContractDropdown(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                filterPackage !== 'all'
                  ? 'bg-orange-100 text-orange-800 border-orange-300'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400 hover:text-gray-800'
              }`}
            >
              Gói tập
              {filterPackage !== 'all' && (
                <span className="ml-1 bg-orange-700 text-white rounded-full px-1.5 text-[10px] font-black">
                  {filterPackage}
                </span>
              )}
            </button>

            {showPackageDropdown && (
              <div className="absolute top-full mt-1.5 left-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[200px] max-h-[300px] overflow-y-auto">
                <button
                  onClick={() => { setFilterPackage('all'); setShowPackageDropdown(false); }}
                  className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors ${filterPackage === 'all' ? 'font-bold text-orange-800 bg-orange-50' : 'text-gray-600'}`}
                >
                  Tất cả
                  {filterPackage === 'all' && (
                    <span className="material-symbols-outlined text-orange-600 ml-auto" style={{fontSize:'16px'}}>check</span>
                  )}
                </button>
                {packages.map(pkg => (
                  <button
                    key={pkg._id || pkg.name}
                    onClick={() => { setFilterPackage(pkg.name); setShowPackageDropdown(false); }}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors ${filterPackage === pkg.name ? 'font-bold text-orange-800 bg-orange-50' : 'text-gray-600'}`}
                  >
                    {pkg.name}
                    {filterPackage === pkg.name && (
                      <span className="material-symbols-outlined text-orange-600 ml-auto" style={{fontSize:'16px'}}>check</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* STAFF FILTER */}
          <div className="relative">
            <button
              onClick={() => {
                setShowStaffDropdown(prev => !prev);
                setShowStatusDropdown(false); setShowPaymentDropdown(false); setShowContractDropdown(false); setShowPackageDropdown(false); setShowDateDropdown(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                filterAssignedStaff !== 'all'
                  ? 'bg-teal-100 text-teal-800 border-teal-300'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400 hover:text-gray-800'
              }`}
            >
              Nhân viên
              {filterAssignedStaff !== 'all' && (
                <span className="ml-1 bg-teal-700 text-white rounded-full px-1.5 text-[10px] font-black">
                  {staffList.find(s=>s._id===filterAssignedStaff || s.id===filterAssignedStaff)?.name || staffList.find(s=>s._id===filterAssignedStaff || s.id===filterAssignedStaff)?.fullName || "Đã lọc"}
                </span>
              )}
            </button>

            {showStaffDropdown && (
              <div className="absolute top-full mt-1.5 left-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[200px] max-h-[300px] overflow-y-auto">
                <button
                  onClick={() => { setFilterAssignedStaff('all'); setShowStaffDropdown(false); }}
                  className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors ${filterAssignedStaff === 'all' ? 'font-bold text-teal-800 bg-teal-50' : 'text-gray-600'}`}
                >
                  Tất cả
                  {filterAssignedStaff === 'all' && (
                    <span className="material-symbols-outlined text-teal-600 ml-auto" style={{fontSize:'16px'}}>check</span>
                  )}
                </button>
                {staffList.map(staff => (
                  <button
                    key={staff._id || staff.id}
                    onClick={() => { setFilterAssignedStaff(staff._id || staff.id); setShowStaffDropdown(false); }}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors ${filterAssignedStaff === (staff._id || staff.id) ? 'font-bold text-teal-800 bg-teal-50' : 'text-gray-600'}`}
                  >
                    {staff.name || staff.fullName} ({staff.role})
                    {filterAssignedStaff === (staff._id || staff.id) && (
                      <span className="material-symbols-outlined text-teal-600 ml-auto" style={{fontSize:'16px'}}>check</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* DATE RANGE FILTER */}
          <div className="relative">
            <button
              onClick={() => {
                setShowDateDropdown(prev => !prev);
                setShowStatusDropdown(false); setShowPaymentDropdown(false); setShowContractDropdown(false); setShowPackageDropdown(false); setShowStaffDropdown(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                (filterStartDateFrom || filterStartDateTo || filterEndDateFrom || filterEndDateTo)
                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400 hover:text-gray-800'
              }`}
            >
              Ngày hợp đồng
              {(filterStartDateFrom || filterStartDateTo || filterEndDateFrom || filterEndDateTo) && (
                <span className="ml-1 bg-rose-700 text-white rounded-full px-1.5 text-[10px] font-black">
                  Đã lọc
                </span>
              )}
            </button>

            {showDateDropdown && (
              <div className="absolute top-full mt-1.5 left-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-4 min-w-[320px]">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Ngày bắt đầu gói</label>
                    <div className="flex items-center gap-2">
                      <input type="date" className="w-full text-xs p-1.5 border rounded outline-none focus:border-rose-400" value={filterStartDateFrom} onChange={e=>setFilterStartDateFrom(e.target.value)} title="Từ ngày"/>
                      <span className="text-gray-400 font-bold">-</span>
                      <input type="date" className="w-full text-xs p-1.5 border rounded outline-none focus:border-rose-400" value={filterStartDateTo} onChange={e=>setFilterStartDateTo(e.target.value)} title="Đến ngày"/>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Ngày hết hạn gói</label>
                    <div className="flex items-center gap-2">
                      <input type="date" className="w-full text-xs p-1.5 border rounded outline-none focus:border-rose-400" value={filterEndDateFrom} onChange={e=>setFilterEndDateFrom(e.target.value)} title="Từ ngày"/>
                      <span className="text-gray-400 font-bold">-</span>
                      <input type="date" className="w-full text-xs p-1.5 border rounded outline-none focus:border-rose-400" value={filterEndDateTo} onChange={e=>setFilterEndDateTo(e.target.value)} title="Đến ngày"/>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button onClick={()=>{
                      setFilterStartDateFrom(""); setFilterStartDateTo(""); setFilterEndDateFrom(""); setFilterEndDateTo("");
                    }} className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">Xóa lọc</button>
                    <button onClick={()=>setShowDateDropdown(false)} className="px-4 py-1.5 text-xs bg-rose-600 hover:bg-rose-700 transition-colors text-white rounded-lg font-bold">Đóng</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div> {/* end card */}


      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-100 dark:bg-gray-800 uppercase text-sm font-bold text-gray-700">
            <tr>
              <th className="p-4 w-[5%]"></th>
              <th className="p-4 pl-8 w-[25%]">HỌ VÀ TÊN</th>
              <th className="p-4 w-[15%]">SĐT</th>
              <th className="p-4 pl-8 w-[20%]">GÓI TẬP</th>
              <th className="p-4 w-[20%]">Trạng thái</th>
              {isAdmin && <th className="p-4 text-right w-[15%]">Hành động</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-display">
            {displayCustomers.length > 0 ? displayCustomers.map((c) => {
                const st = getCustomerStatus(c.startDate, c.endDate, c.status);
                return (
                  <tr 
                    key={c._id || c.id} 
                    className="group hover:bg-blue-50/50 transition-colors cursor-pointer"
                    onClick={() => {
                        setSelectedCustomer(c);
                        setShowDetailModal(true);
                    }}
                  >
                    <td className="p-4 pr-0">
                       <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 overflow-hidden mx-auto md:mx-0">
                          {c.avatar && c.avatar !== "👤" ? (
                            <img src={c.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                               <span className="material-symbols-outlined text-sm">face</span>
                            </div>
                          )}
                       </div>
                    </td>
                    <td className="p-4 pl-8">
                        <div className="font-medium text-gray-900 text-base">{c.name}</div>
                        <div className="text-xs text-gray-500 font-light mt-0.5">{c.code}</div>
                    </td>
                    <td className="p-4 text-base font-medium text-gray-900">
                        {c.phone}
                    </td>
                    <td className="p-4 pl-8">
                        <span className="text-base font-medium text-gray-900">{c.packageType}</span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
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
                            <span className="material-symbols-outlined text-xl">edit</span>
                          </button>
                          <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(c._id || c.id);
                            }}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-xl transition-colors"
                            title="Xóa khách hàng"
                          >
                             <span className="material-symbols-outlined text-xl">delete</span>
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
                                <span className="material-symbols-outlined text-3xl text-gray-400">search_off</span>
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
            <div className="text-sm text-gray-500">
                Hiển thị trang <span className="font-bold">{page}</span> / <span className="font-bold">{totalPages}</span>
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
          onClose={() => {
            setShowEditModal(false);
            setSelectedCustomer(null);
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
