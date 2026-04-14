import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { checkInService, workoutService } from "../../services/customerService";
import toast from "react-hot-toast";

const CustomerDetailModal = ({ customer, onClose, onUpdate }) => {
  const [history, setHistory] = useState([]);
  const [workoutHistory, setWorkoutHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingWorkout, setLoadingWorkout] = useState(false);
  const [isDeducting, setIsDeducting] = useState(false);
  
  const defaultPt = customer?.assignedStaff?.role === 'pt' ? customer.assignedStaff.fullName : (customer?.trainer || "");
  const [ptName, setPtName] = useState(defaultPt);
  
  const [note, setNote] = useState("");
  const [activeTab, setActiveTab] = useState("info"); // 'info' | 'history' | 'workout'

  // Quyền trừ buổi tập
  const currentUser = JSON.parse(localStorage.getItem("gym_user") || "{}");
  const canDeduct = ["admin", "manager", "reception"].includes(currentUser.role);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!customer?._id) return;
      try {
        setLoading(true);
        // Note: Currently fetching all check-ins and filtering client-side.
        // Optimization: Should implement getCheckInsByCustomerId API in backend.
        const allCheckIns = await checkInService.getAll();
        const customerHistory = (Array.isArray(allCheckIns) ? allCheckIns : [])
          .filter(c => c.customerId === customer._id)
          .sort((a, b) => new Date(b.time) - new Date(a.time));
        
        setHistory(customerHistory);
      } catch (error) {
        console.error("Failed to fetch customer history", error);
      } finally {
        setLoading(false);
      }
    };

    if (activeTab === 'history') {
        fetchHistory();
    }
  }, [customer, activeTab]);

  useEffect(() => {
    const fetchWorkoutHistory = async () => {
      if (!customer?._id || activeTab !== 'workout') return;
      try {
        setLoadingWorkout(true);
        const data = await workoutService.getByCustomer(customer._id);
        setWorkoutHistory(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch workout history", err);
      } finally {
        setLoadingWorkout(false);
      }
    };
    fetchWorkoutHistory();
  }, [customer, activeTab]);

  const handleDeductSession = async () => {
    if (!ptName) {
      toast.error("Vui lòng nhập tên Huấn luyện viên (PT)");
      return;
    }
    try {
      setIsDeducting(true);
      const res = await workoutService.deduct(customer._id, { ptName, note });
      toast.success(res.message || "Trừ buổi thành công");
      // Cập nhật local state thay vì fetch lại toàn bộ list
      setWorkoutHistory([res.session, ...workoutHistory]);
      customer.remainingSessions = res.remainingSessions; // Cập nhật ngay trên view
      setNote(""); // Reset
      if (onUpdate) onUpdate(); 
    } catch (err) {
      toast.error(err.message || "Lỗi trừ buổi tập");
    } finally {
      setIsDeducting(false);
    }
  };

  if (!customer) return null;

  const calculateDaysLeft = (endDate) => {
      if (!endDate) return 0;
      const end = new Date(endDate);
      const now = new Date();
      const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
      return diff > 0 ? diff : 0;
  };

  const daysLeft = calculateDaysLeft(customer.endDate);

  const getStatusColor = (endDate) => {
    if (!endDate) return "text-green-600 bg-green-100 border-green-200";
    const now = new Date();
    const start = customer.startDate ? new Date(customer.startDate) : now;
    const end = new Date(endDate);
    
    if (start.getTime() > now.getTime() + 86400000) return "text-sky-600 bg-sky-100 border-sky-200";

    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    
    if (diff < 0) return "text-red-600 bg-red-100 border-red-200";
    if (diff <= 14) return "text-yellow-600 bg-yellow-100 border-yellow-200";
    return "text-green-600 bg-green-100 border-green-200";
  };
  
  const getStatusText = (endDate) => {
      if (!endDate) return "Đang hoạt động";
       const now = new Date();
      const start = customer.startDate ? new Date(customer.startDate) : now;
      const end = new Date(endDate);
      
      if (start.getTime() > now.getTime() + 86400000) return "Chưa kích hoạt";

      const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
      
      if (diff < 0) return "Hết hạn";
      if (diff <= 14) return `Sắp hết (${diff} ngày)`;
      return "Đang hoạt động";
  }

  const InfoRow = ({ label, value, isBoolean, boldValue }) => (
    <div className="flex flex-col gap-1 p-3.5 rounded-xl bg-gray-100/80 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
        <span className="text-sm uppercase font-bold text-gray-900 dark:text-gray-100 font-display">
            {label}
        </span>
        {isBoolean ? (
             <div className="flex items-center gap-2 mt-1">
                <div className={`w-3 h-3 rounded-full ${value ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className={`font-medium text-base font-display ${value ? 'text-green-700' : 'text-gray-500'}`}>
                    {value ? 'Đã đăng ký' : 'Không'}
                </span>
             </div>
        ) : (
            <span className={`text-base text-gray-700 dark:text-gray-300 font-display font-medium`}>
                {value || "-"}
            </span>
        )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-display">
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-6xl h-[90vh] overflow-hidden shadow-2xl flex flex-col md:flex-row relative">
         
         {/* Close Button Mobile/Absolute */}
         <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 p-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-full shadow-sm text-gray-500 hover:text-red-500 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
         </button>

        {/* LEFT PANEL: Identity (Static) */}
        <div className="w-full md:w-[350px] bg-gray-50 dark:bg-gray-900/50 p-6 flex flex-col items-center border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 overflow-y-auto flex-shrink-0">
            <div className="w-64 h-64 aspect-square rounded-3xl overflow-hidden shadow-xl border-4 border-white dark:border-gray-800 mb-6 bg-white flex-shrink-0">
                {customer.avatar && customer.avatar !== "👤" ? (
                   <img 
                     src={customer.avatar} 
                     alt={customer.name} 
                     className="w-full h-full object-cover"
                   />
                ) : (
                   <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-300">
                      <span className="material-symbols-outlined text-[10rem]">person</span>
                   </div>
                )}
            </div>

            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 text-center mb-1">
                {customer.name}
            </h2>
             <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700 mb-6">
                {customer.code || "NO CODE"}
             </span>
             <div className={`py-2 px-5 rounded-full text-sm font-bold border flex items-center gap-2 font-display ${getStatusColor(customer.endDate)}`}>
                 <span className={`w-2 h-2 rounded-full ${
                     getStatusText(customer.endDate) === "Chưa kích hoạt" ? "bg-sky-500" :
                     getStatusText(customer.endDate).includes("Sắp hết") ? "bg-yellow-500" :
                     getStatusText(customer.endDate) === "Hết hạn" ? "bg-red-500" : "bg-green-500"
                 }`}></span>
                {getStatusText(customer.endDate)}
            </div>
            
             <div className="mt-8 w-full space-y-3">
                 <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-200">
                     <span className="text-xs font-bold text-gray-900 uppercase">Ngày tạo</span>
                     <span className="font-medium text-gray-900">{customer.createdAt ? format(new Date(customer.createdAt), "dd/MM/yyyy") : format(new Date(), "dd/MM/yyyy")}</span>
                 </div>
             </div>
        </div>

        {/* RIGHT PANEL: Tabs & Content */}
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 min-h-0">
             {/* TABS HEADER */}
             <div className="flex items-center gap-1 p-2 border-b border-gray-100 dark:border-gray-700 select-none overflow-x-auto">
                 <button 
                    onClick={() => setActiveTab('info')}
                    className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${
                        activeTab === 'info' 
                        ? "bg-blue-50 text-blue-700 shadow-sm" 
                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                    }`}
                 >
                    <span className="material-symbols-outlined">person</span>
                    Thông tin khách hàng
                 </button>
                  <button 
                    onClick={() => setActiveTab('history')}
                    className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${
                        activeTab === 'history' 
                        ? "bg-blue-50 text-blue-700 shadow-sm" 
                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                    }`}
                 >
                    <span className="material-symbols-outlined">history</span>
                    Lịch sử Check-in
                 </button>
                  <button 
                    onClick={() => setActiveTab('workout')}
                    className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${
                        activeTab === 'workout' 
                        ? "bg-blue-50 text-blue-700 shadow-sm" 
                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                    }`}
                 >
                    <span className="material-symbols-outlined">fitness_center</span>
                    Lịch sử tập luyện
                 </button>
             </div>

             {/* SCROLLABLE CONTENT AREA */}
             <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                 
                 {/* TAB 1: INFO */}
                 {activeTab === 'info' && (
                     <div className="space-y-8 animate-fade-in-up">
                         {/* 1. Basic Info */}
                         <section>
                             <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">
                                 1. Thông tin cơ bản
                             </h3>
                             <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                 <InfoRow label="Số điện thoại" value={customer.phone} boldValue />
                                 <InfoRow label="Email" value={customer.email} />
                                 <InfoRow label="Ngày sinh" value={customer.dob ? format(new Date(customer.dob), "dd/MM/yyyy") : null} />
                                 <InfoRow label="Giới tính" value={customer.gender === 'male' ? 'Nam' : customer.gender === 'female' ? 'Nữ' : 'Khác'} />
                                 <div className="col-span-2">
                                     <InfoRow label="Địa chỉ" value={customer.address} />
                                 </div>
                             </div>
                         </section>

                         {/* 2. Package Info */}
                         <section>
                             <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">
                                 2. Thông tin & Nhân sự Phụ trách
                             </h3>
                             <div className="p-5 rounded-2xl border border-blue-100 bg-blue-50/30">
                                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                     <div className="col-span-2 md:col-span-2">
                                         <InfoRow label="Gói đăng ký" value={customer.packageType} boldValue />
                                     </div>
                                     <div className="col-span-2 md:col-span-2">
                                         <InfoRow 
                                             label={customer.assignedStaff?.role === 'pt' ? 'Huấn luyện viên (PT)' : 'Nhân viên Phụ trách'} 
                                             value={customer.assignedStaff?.fullName || customer.assignedStaff?.name || "-"} 
                                         />
                                     </div>
                                     
                                     <InfoRow label="Giá gói" value={customer.price ? `${Number(customer.price).toLocaleString()} đ` : "0 đ"} />
                                     <InfoRow label="Còn lại" value={`${daysLeft} ngày`} boldValue />
                                     <InfoRow label="Ngày đăng ký" value={customer.startDate ? format(new Date(customer.startDate), "dd/MM/yyyy") : null} />
                                     <InfoRow label="Ngày hết hạn" value={customer.endDate ? format(new Date(customer.endDate), "dd/MM/yyyy") : null} />
                                 </div>
                             </div>
                         </section>

                         {/* 3. Health & Services */}
                         <section>
                             <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">
                                 3. Sức khỏe & Dịch vụ thêm
                             </h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 <div className="space-y-4">
                                      <div className="p-4 rounded-xl bg-red-50 border border-red-100 h-full">
                                          <p className="text-sm font-bold text-gray-900 uppercase mb-2 font-display">
                                              Ghi chú sức khỏe
                                          </p>
                                          <p className="font-medium text-lg text-gray-900 font-display">
                                              {customer.healthNote || "Không có ghi chú đặc biệt."}
                                          </p>
                                      </div>
                                 </div>
                                 <div className="grid grid-cols-2 gap-4">
                                     <div className="col-span-2">
                                         <InfoRow label="Thuê tủ đồ" value={customer.hasLocker} isBoolean />
                                     </div>
                                     <div className="col-span-2">
                                         <InfoRow label="Gói nước uống" value={customer.hasWater} isBoolean />
                                     </div>
                                 </div>
                             </div>
                         </section>
                     </div>
                 )}

                 {/* TAB 2: HISTORY */}
                 {activeTab === 'history' && (
                     <div className="animate-fade-in-up h-full flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                             <h3 className="text-lg font-bold">Lịch sử ra vào ({history.length})</h3>
                        </div>
                        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden flex-1 overflow-y-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-900 font-bold uppercase sticky top-0 font-display">
                                    <tr>
                                        <th className="px-6 py-4">Thời gian</th>
                                        <th className="px-6 py-4">Ngày</th>
                                        <th className="px-6 py-4">Gói ghi nhận</th>
                                        <th className="px-6 py-4 text-right">Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {loading ? (
                                        <tr><td colSpan="4" className="p-10 text-center text-gray-500">Đang tải dữ liệu...</td></tr>
                                    ) : history.length > 0 ? (
                                        history.map((h, i) => (
                                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                <td className="px-6 py-4 font-bold text-gray-800 dark:text-gray-200 text-base">
                                                    {format(new Date(h.time), "HH:mm")}
                                                </td>
                                                <td className="px-6 py-4 text-gray-600 dark:text-gray-400 font-medium">
                                                    {format(new Date(h.time), "dd/MM/yyyy")}
                                                </td>
                                                <td className="px-6 py-4 text-gray-500">
                                                    <span className="px-2 py-1 bg-gray-100 rounded text-xs font-bold">{h.packageType}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-700 font-bold border border-green-200">
                                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                                        Check-in
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                        <td colSpan="4" className="p-12">
                                            <div className="flex flex-col items-center justify-center text-center text-gray-400 gap-2">
                                                <span className="material-symbols-outlined text-4xl opacity-50">history_toggle_off</span>
                                                <span className="font-display">Chưa có lịch sử check-in nào</span>
                                            </div>
                                        </td>
                                    </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                     </div>
                 )}

                 {/* TAB 3: WORKOUT */}
                 {activeTab === 'workout' && (
                     <div className="animate-fade-in-up flex flex-col gap-6 h-full">
                        {/* Summary & Action Area */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-5 bg-blue-50/50 border border-blue-100 rounded-2xl gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Tiến độ Gói tập 1:1</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Đã tập: <span className="font-bold text-gray-700">{workoutHistory.length} buổi</span> | 
                                    Còn lại: <span className="font-bold text-blue-600 text-lg ml-1">{customer.remainingSessions || 0} buổi</span>
                                </p>
                            </div>
                            
                            {canDeduct && customer.remainingSessions > 0 && (
                                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                                    <input 
                                        type="text" 
                                        placeholder="Tên PT..." 
                                        className="text-sm border-gray-300 rounded-lg px-3 py-2 w-full sm:w-32 focus:ring-blue-500 focus:border-blue-500 outline-none border"
                                        value={ptName}
                                        onChange={(e) => setPtName(e.target.value)}
                                        title="Tên PT Hướng dẫn"
                                    />
                                    <input 
                                        type="text" 
                                        placeholder="Ghi chú (Tùy chọn)" 
                                        className="text-sm border-gray-300 rounded-lg px-3 py-2 w-full sm:w-40 focus:ring-blue-500 focus:border-blue-500 outline-none border"
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                    />
                                    <button 
                                        onClick={handleDeductSession}
                                        disabled={isDeducting}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        <span className="material-symbols-outlined text-sm">check_circle</span>
                                        {isDeducting ? "Đang xử lý..." : "Trừ buổi"}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* History Table */}
                        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden flex-1 overflow-y-auto min-h-[300px]">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-900 font-bold uppercase sticky top-0 font-display">
                                    <tr>
                                        <th className="px-6 py-4">Ngày tập</th>
                                        <th className="px-6 py-4">Giờ</th>
                                        <th className="px-6 py-4">PT Hướng dẫn</th>
                                        <th className="px-6 py-4">Lễ tân xác nhận</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {loadingWorkout ? (
                                        <tr><td colSpan="4" className="p-10 text-center text-gray-500">Đang tải dữ liệu...</td></tr>
                                    ) : workoutHistory.length > 0 ? (
                                        workoutHistory.map((w, i) => (
                                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                <td className="px-6 py-4 font-bold text-gray-800 dark:text-gray-200">
                                                    {format(new Date(w.date), "dd/MM/yyyy")}
                                                </td>
                                                <td className="px-6 py-4 text-gray-600 dark:text-gray-400 font-medium">
                                                    {format(new Date(w.date), "HH:mm")}
                                                </td>
                                                <td className="px-6 py-4 text-blue-700 font-bold">
                                                    {w.ptName}
                                                </td>
                                                <td className="px-6 py-4 text-gray-500">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-gray-800">{w.confirmedBy?.fullName || w.confirmedBy?.username || "N/A"}</span>
                                                        <span className="text-xs">{w.note}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                        <td colSpan="4" className="p-12">
                                            <div className="flex flex-col items-center justify-center text-center text-gray-400 gap-2">
                                                <span className="material-symbols-outlined text-4xl opacity-50">fitness_center</span>
                                                <span className="font-display">Chưa có lịch sử tập luyện với PT</span>
                                            </div>
                                        </td>
                                    </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                     </div>
                 )}
             </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDetailModal;
