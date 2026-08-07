import React, { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { customerService, checkInService, workoutService, staffService } from "../../services/customerService";
import FaceCaptureModal from "./FaceCaptureModal";
import FreezeContractModal from "./FreezeContractModal";
import UpgradeContractModal from "./UpgradeContractModal";
import TransferContractModal from "./TransferContractModal";
import toast from "react-hot-toast";
import { useConfirm } from "../../context/ConfirmContext";

const CustomerDetailModal = ({ customer, packages = [], onClose, onUpdate }) => {
  const confirm = useConfirm();
  const [history, setHistory] = useState([]);
  const [workoutHistory, setWorkoutHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingWorkout, setLoadingWorkout] = useState(false);
  const [isDeducting, setIsDeducting] = useState(false);
  const [isSessionPackage, setIsSessionPackage] = useState(false);
  const [showFaceModal, setShowFaceModal] = useState(false);
  const isSavingFace = false;
  
  // trainer bây giờ là object { _id, fullName } sau khi migrate sang ObjectId ref User
  const defaultPt = customer?.trainer?._id || (['pt', 'pm'].includes(customer?.assignedStaff?.role) ? customer.assignedStaff._id : '');
  const defaultPtName = customer?.trainer?.fullName || (['pt', 'pm'].includes(customer?.assignedStaff?.role) ? customer.assignedStaff.fullName : "");
  const [ptId, setPtId] = useState(defaultPt);
  const [ptName, setPtName] = useState(defaultPtName);
  const [ptList, setPtList] = useState([]);
  
  const [note, setNote] = useState("");
  const [activeTab, setActiveTab] = useState("info"); // 'info' | 'history' | 'workout' | 'packages'
  
  const [customerPackages, setCustomerPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [isFreezing, setIsFreezing] = useState(false);
  
  const [freezeModalOpen, setFreezeModalOpen] = useState(false);
  const [unfreezeModalOpen, setUnfreezeModalOpen] = useState(false);
  const [selectedPkgId, setSelectedPkgId] = useState(null);
  const [freezeData, setFreezeData] = useState({ 
    reason: "", 
    startDate: new Date().toISOString().split("T")[0], 
    endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] 
  });
  const [unfreezeData, setUnfreezeData] = useState({ 
    actualUnfreezeDate: new Date().toISOString().split("T")[0] 
  });

  const [isFreezeContractModalOpen, setIsFreezeContractModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedPackageForAction, setSelectedPackageForAction] = useState(null);

  // Quyền trừ buổi tập
  const currentUser = JSON.parse(localStorage.getItem("gym_user") || "{}");
  const canDeduct = ["admin", "manager", "reception"].includes(currentUser.role);

  // Fetch danh sách PT (gồm role 'pt' và 'pm') khi mở tab workout
  useEffect(() => {
    const fetchPTs = async () => {
      try {
        const allStaff = await staffService.getAll();
        const pts = (Array.isArray(allStaff) ? allStaff : []).filter(s => s.role === 'pt' || s.role === 'pm');
        setPtList(pts);
      } catch (err) {
        console.error('Lỗi lấy danh sách PT:', err);
      }
    };
    fetchPTs();
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
    if (customer?.packageType && Array.isArray(packages)) {
      const pkg = packages.find(p => p.name === customer.packageType);
      if (pkg && pkg.type === "session") {
        setIsSessionPackage(true);
      } else {
        setIsSessionPackage(false);
      }
    }
  }, [customer, packages]);

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

  const fetchCustomerPackages = useCallback(async () => {
    if (!customer?.phone) return;
    try {
      setLoadingPackages(true);
      const res = await customerService.getAll({ search: customer.phone, limit: 100 });
      setCustomerPackages(res.customers || []);
    } catch (err) {
      console.error("Lỗi lấy lịch sử gói tập:", err);
    } finally {
      setLoadingPackages(false);
    }
  }, [customer?.phone]);

  useEffect(() => {
    if (activeTab === 'packages') {
      fetchCustomerPackages();
    }
  }, [activeTab, fetchCustomerPackages]);

  const handleDeductSession = async () => {
    if (!ptId && !ptName) {
      toast.error("Vui lòng chọn Huấn luyện viên (PT)");
      return;
    }
    try {
      setIsDeducting(true);
      const payload = { note };
      if (ptId) {
        payload.ptId = ptId;
      } else {
        payload.ptName = ptName;
      }
      const res = await workoutService.deduct(customer._id, payload);
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

  const handleDeleteSession = async (sessionId) => {
    const isConfirmed = await confirm({
      title: "Xóa buổi tập PT",
      message: "Bạn có chắc chắn muốn xóa buổi tập này? Lượt tập sẽ được hoàn lại cho khách hàng.",
      type: "danger"
    });
    if (!isConfirmed) return;
    try {
      const res = await workoutService.deleteSession(sessionId);
      toast.success(res.message || "Xóa thành công và đã hoàn lại 1 buổi");
      
      // Remove local state
      setWorkoutHistory(prev => prev.filter(w => w._id !== sessionId));
      customer.remainingSessions = res.remainingSessions; // Update on view
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error(err.message || "Lỗi khi xóa buổi tập");
    }
  };

  const handleFaceCapture = async (avatarUrlOrBase64) => {
    // FaceCaptureModal mới tự gọi API enroll-face rồi mới gọi callback
    // ở đây chỉ cần cập nhật avatar local
    if (avatarUrlOrBase64 && avatarUrlOrBase64.startsWith("http")) {
      customer.avatarUrl = avatarUrlOrBase64;
      customer.avatar = "";
    } else {
      customer.avatar = avatarUrlOrBase64;
    }
    customer.faceEmbedding = true; // Đánh dấu đã có embedding
    if (onUpdate) onUpdate();
  };


  const handleFreezeClick = (pkgId) => {
    setSelectedPkgId(pkgId);
    setFreezeData({
      reason: "",
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    });
    setFreezeModalOpen(true);
  };

  const confirmFreeze = async () => {
    if (!freezeData.reason) {
      toast.error("Vui lòng nhập lý do bảo lưu");
      return;
    }
    if (!freezeData.startDate || !freezeData.endDate) {
      toast.error("Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc");
      return;
    }
    if (new Date(freezeData.endDate) <= new Date(freezeData.startDate)) {
      toast.error("Ngày kết thúc bảo lưu phải sau ngày bắt đầu");
      return;
    }
    try {
      setIsFreezing(true);
      const res = await customerService.freeze(selectedPkgId, {
        startDate: freezeData.startDate,
        endDate: freezeData.endDate,
        reason: freezeData.reason
      });
      toast.success(res.message || "Đã tạm dừng gói tập thành công!");
      setFreezeModalOpen(false);
      fetchCustomerPackages();
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi tạm dừng gói tập");
    } finally {
      setIsFreezing(false);
    }
  };

  const handleUnfreezeClick = (pkgId) => {
    setSelectedPkgId(pkgId);
    setUnfreezeData({
      actualUnfreezeDate: new Date().toISOString().split("T")[0]
    });
    setUnfreezeModalOpen(true);
  };

  const confirmUnfreeze = async () => {
    try {
      setIsFreezing(true);
      const res = await customerService.unfreeze(selectedPkgId, unfreezeData.actualUnfreezeDate);
      toast.success(res.message || "Đã kích hoạt lại gói tập thành công!");
      setUnfreezeModalOpen(false);
      fetchCustomerPackages();
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi kích hoạt lại gói tập");
    } finally {
      setIsFreezing(false);
    }
  };

  const getEstimatedNewEndDate = () => {
    if (!selectedPkgId) return null;
    const pkg = customerPackages.find(p => p._id === selectedPkgId);
    if (!pkg) return null;
    
    const activePeriod = pkg.frozenPeriods && pkg.frozenPeriods.length > 0 
      ? pkg.frozenPeriods[pkg.frozenPeriods.length - 1] 
      : null;
      
    if (!activePeriod) return pkg.endDate;
    
    const actualUnfreeze = new Date(unfreezeData.actualUnfreezeDate);
    const expectedEnd = new Date(activePeriod.endDate);
    const start = new Date(activePeriod.startDate);
    
    if (actualUnfreeze < expectedEnd) {
      const expectedDays = Math.ceil((expectedEnd - start) / (1000 * 60 * 60 * 24));
      const actualDays = Math.max(0, Math.ceil((actualUnfreeze - start) / (1000 * 60 * 60 * 24)));
      const diffDays = expectedDays - actualDays;
      
      if (diffDays > 0) {
        return new Date(new Date(pkg.endDate).getTime() - diffDays * 24 * 60 * 60 * 1000);
      }
    }
    return pkg.endDate;
  };

  if (!customer) return null;

  const calculateDaysLeft = (endDate, status) => {
      if (!endDate || status === "transferred" || customer?.status === "transferred") return 0;
      const end = new Date(endDate);
      const now = new Date();
      const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
      return diff > 0 ? diff : 0;
  };

  const daysLeft = calculateDaysLeft(customer.endDate, customer.status);

  const getStatusColor = (endDate, status) => {
    if (status === "frozen") return "text-purple-800 bg-purple-100 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800";
    if (status === "transferred") return "text-slate-700 bg-slate-100 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700";
    if (!endDate) return "text-green-800 bg-green-100 border-green-300 dark:bg-green-950/60 dark:text-green-300 dark:border-green-800";
    const now = new Date();
    const start = customer.startDate ? new Date(customer.startDate) : now;
    const end = new Date(endDate);
    
    if (start.getTime() > now.getTime() + 86400000) return "text-sky-600 bg-sky-100 border-sky-200";

    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    
    if (diff < 0) return "text-red-600 bg-red-100 border-red-200";
    if (diff <= 14) return "text-yellow-600 bg-yellow-100 border-yellow-200";
    return "text-green-600 bg-green-100 border-green-200";
  };
  
  const getStatusText = (endDate, status) => {
      if (status === "frozen") return "Bảo lưu";
      if (status === "transferred") return "Đã chuyển nhượng";
      if (!endDate) return "Đang hoạt động";
       const now = new Date();
      const start = customer.startDate ? new Date(customer.startDate) : now;
      const end = new Date(endDate);
      
      if (start.getTime() > now.getTime() + 86400000) return "Chưa kích hoạt";

      const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
      
      if (diff < 0) return "Hết hạn";
      if (diff <= 14) return `Sắp hết hạn (${diff} ngày)`;
      return "Đang hoạt động";
  }

  const InfoRow = ({ label, value, isBoolean }) => (
    <div className="flex flex-col gap-1 p-2.5 sm:p-3 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200/90 dark:border-gray-700 shadow-sm min-w-0 overflow-hidden">
        <span className="text-[11px] sm:text-xs uppercase font-medium text-gray-500 dark:text-gray-400 font-display tracking-wider">
            {label}
        </span>
        {isBoolean ? (
             <div className="flex items-center gap-2 mt-0.5 min-w-0">
                <div className={`w-2.5 h-2.5 rounded-full ${value ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'} flex-shrink-0`}></div>
                <span className={`font-medium text-sm sm:text-base font-display ${value ? 'text-green-700 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'} break-all`}>
                    {value ? 'Đã đăng ký' : 'Không'}
                </span>
             </div>
        ) : value ? (
             <span className="text-sm sm:text-base text-gray-900 dark:text-gray-100 font-display font-medium break-all md:break-words min-w-0 overflow-hidden">
                 {value}
             </span>
        ) : (
             <span className="text-sm sm:text-base text-gray-400 dark:text-gray-500 font-display font-medium">
                 -
             </span>
        )}
    </div>
  );

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-display"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-6xl h-[90vh] overflow-hidden shadow-2xl flex flex-col md:flex-row relative"
        onClick={(e) => e.stopPropagation()}
      >
         
         {/* Close Button Mobile/Absolute */}
         <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 p-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-full shadow-sm text-gray-500 hover:text-red-500 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
         </button>

        {/* LEFT PANEL: Identity (Static) */}
        <div className="w-full md:w-[350px] bg-gray-50/70 dark:bg-gray-900/60 p-6 flex flex-col items-center border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 overflow-y-auto flex-shrink-0">
            <div className="w-64 h-64 aspect-square rounded-3xl overflow-hidden shadow-xl border-4 border-white dark:border-gray-800 mb-6 bg-white dark:bg-gray-800 flex-shrink-0">
                {customer.avatarUrl ? (
                   <img 
                     src={customer.avatarUrl} 
                     alt={customer.name} 
                     className="w-full h-full object-cover"
                   />
                ) : customer.avatar && customer.avatar !== "👤" ? (
                   <img 
                     src={customer.avatar} 
                     alt={customer.name} 
                     className="w-full h-full object-cover"
                   />
                ) : (
                   <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 text-amber-500/80">
                      <span className="material-symbols-outlined text-[6rem]">account_circle</span>
                   </div>
                )}
            </div>

            <button
               onClick={() => setShowFaceModal(true)}
               disabled={isSavingFace}
               className="mb-4 px-4 py-2 bg-blue-50 text-blue-700 font-bold border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors flex items-center gap-2"
            >
               <span className="material-symbols-outlined text-xl">face_retouching_natural</span>
               {isSavingFace ? "Đang lưu..." : (customer.faceEmbedding && customer.faceEmbedding.length > 0 ? "Chụp lại nhận diện" : "Chụp nhận diện")}
            </button>

            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 text-center mb-1">
                {customer.name}
            </h2>
             <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800 mb-5">
                {customer.code || "NO CODE"}
             </span>
             <div className={`py-2 px-5 rounded-full text-xs font-extrabold border flex items-center gap-2 font-display ${getStatusColor(customer.endDate, customer.status)}`}>
                 <span className={`w-2 h-2 rounded-full ${
                     customer.status === "transferred" || getStatusText(customer.endDate, customer.status) === "Đã chuyển nhượng" ? "bg-slate-500" :
                     customer.status === "frozen" ? "bg-purple-500" :
                     getStatusText(customer.endDate, customer.status) === "Chưa kích hoạt" ? "bg-sky-500" :
                     getStatusText(customer.endDate, customer.status).includes("Sắp hết") ? "bg-yellow-500" :
                     getStatusText(customer.endDate, customer.status) === "Hết hạn" ? "bg-red-500" : "bg-green-500"
                 }`}></span>
                {getStatusText(customer.endDate, customer.status)}
            </div>
            
             <div className="mt-6 w-full space-y-3.5">
                 <div className="flex justify-between items-center p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                     <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Ngày tạo</span>
                     <span className="font-medium text-base text-gray-800 dark:text-gray-200">{customer.createdAt ? format(new Date(customer.createdAt), "dd/MM/yyyy") : format(new Date(), "dd/MM/yyyy")}</span>
                 </div>
                 <div className="flex justify-between items-center p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                     <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">Còn lại</span>
                     <span className="font-medium text-base text-gray-800 dark:text-gray-200">
                       {customer.status === "transferred" || getStatusText(customer.endDate, customer.status) === "Đã chuyển nhượng"
                         ? "0 ngày"
                         : `${daysLeft} ngày`}
                     </span>
                 </div>
             </div>
        </div>

        {/* RIGHT PANEL: Tabs & Content */}
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 min-h-0 min-w-0">
             {/* TABS HEADER */}
             <div className="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700 select-none overflow-x-auto custom-scrollbar">
                 <button 
                    type="button"
                    onClick={() => setActiveTab('info')}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 whitespace-nowrap ${
                        activeTab === 'info' 
                        ? "bg-blue-600 text-white shadow-sm" 
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                 >
                    Thông tin
                 </button>
                 <button 
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 whitespace-nowrap ${
                        activeTab === 'history' 
                        ? "bg-blue-600 text-white shadow-sm" 
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                 >
                    Check-in
                 </button>
                 <button 
                    type="button"
                    onClick={() => setActiveTab('workout')}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 whitespace-nowrap ${
                        activeTab === 'workout' 
                        ? "bg-blue-600 text-white shadow-sm" 
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                 >
                    Buổi tập PT
                 </button>
                 <button 
                    type="button"
                    onClick={() => { setActiveTab('packages'); fetchCustomerPackages(); }}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 whitespace-nowrap ${
                        activeTab === 'packages' 
                        ? "bg-blue-600 text-white shadow-sm" 
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                 >
                    Gói đăng ký
                 </button>
                 <button 
                    type="button"
                    onClick={() => { setActiveTab('freeze'); fetchCustomerPackages(); }}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 whitespace-nowrap ${
                        activeTab === 'freeze' 
                        ? "bg-blue-600 text-white shadow-sm" 
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                 >
                    Thao tác gói
                 </button>
             </div>

             {/* SCROLLABLE CONTENT AREA */}
             <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                 
                 {/* TAB 1: INFO */}
                 {activeTab === 'info' && (
                     <div className="space-y-8 animate-fade-in-up">
                         {/* 1. Basic Info */}
                         <section>
                             <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-gray-100 mb-4">
                                 1. Thông tin khách hàng
                             </h3>
                             <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
                                 <InfoRow label="Số điện thoại" value={customer.phone} boldValue />
                                 <InfoRow label="Email" value={customer.email} />
                                 <InfoRow label="Ngày sinh" value={customer.dob ? format(new Date(customer.dob), "dd/MM/yyyy") : null} />
                                 <InfoRow label="Giới tính" value={customer.gender === 'male' ? 'Nam' : customer.gender === 'female' ? 'Nữ' : 'Khác'} />
                                 <InfoRow label="Số CCCD" value={customer.identityCard} />
                                 <InfoRow label="Địa chỉ" value={customer.address} />
                                 <div className="col-span-2 md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                     <InfoRow label="Người liên hệ khẩn cấp" value={customer.emergencyContactName} />
                                     <InfoRow label="SĐT liên hệ khẩn cấp" value={customer.emergencyContactPhone} />
                                 </div>
                             </div>
                         </section>

                         {/* 2. Package Info */}
                         <section>
                             <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-gray-100 mb-4">
                                 2. Thông tin gói tập  
                             </h3>
                             <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                                 <div className="col-span-2 md:col-span-2">
                                     <InfoRow label="Gói đăng ký" value={customer.packageType} />
                                 </div>
                                 <div className="col-span-2 md:col-span-2">
                                     <InfoRow 
                                         label={['pt', 'pm'].includes(customer.assignedStaff?.role) ? 'Huấn luyện viên (PT)' : 'Nhân viên Phụ trách'} 
                                         value={customer.assignedStaff?.fullName || customer.assignedStaff?.name || "-"} 
                                     />
                                 </div>
                                 
                                 <InfoRow label="Giá gói" value={customer.price ? `${Number(customer.price).toLocaleString()} đ` : "0 đ"} />
                                 <InfoRow label="Mã hợp đồng" value={customer.contractCode || "-"} />
                                 <InfoRow label="Ngày đăng ký" value={customer.startDate ? format(new Date(customer.startDate), "dd/MM/yyyy") : null} />
                                 <InfoRow label="Ngày hết hạn" value={customer.endDate ? format(new Date(customer.endDate), "dd/MM/yyyy") : null} />
                                 
                                 <div className="col-span-2 md:col-span-2">
                                     <InfoRow 
                                         label="Loại hợp đồng" 
                                         value={customer.contractType === 'renew' ? 'Gia hạn (Renew)' : customer.contractType === 'upgrade' ? 'Nâng cấp' : customer.contractType === 'transfer' ? 'Chuyển nhượng' : 'Khách mới'} 
                                     />
                                 </div>
                                 <div className="col-span-2 md:col-span-2">
                                     <InfoRow 
                                         label="Thanh toán" 
                                         value={customer.paymentStatus === 'deposit' ? `Đặt cọc (${Number(customer.paidAmount || 0).toLocaleString()} đ)` : customer.paymentStatus === 'unpaid' ? 'Chưa thanh toán' : 'Đã thanh toán đủ'} 
                                     />
                                 </div>
                                 <div className="col-span-2 md:col-span-2">
                                     <InfoRow 
                                         label="Nguồn khách hàng" 
                                         value={
                                             customer.source === "facebook" ? "Facebook" :
                                             customer.source === "hotline" ? "Hotline" :
                                             customer.source === "referral" ? "Giới thiệu (Referral)" :
                                             customer.source === "web" ? "Website" : "Khác"
                                         } 
                                     />
                                 </div>
                                 <div className="col-span-2 md:col-span-2">
                                      <InfoRow 
                                          label="Hội viên giới thiệu" 
                                          value={
                                              customer.referredBy 
                                                  ? `${customer.referredBy.name} (${customer.referredBy.code || customer.referredBy.phone || ""})` 
                                                  : "-"
                                          } 
                                      />
                                  </div>
                             </div>
                         </section>

                         {/* 3. Notes & Services */}
                         <section>
                             <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-gray-100 mb-4">
                                 3. Ghi chú & Dịch vụ thêm
                             </h3>
                             <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
                                 <div className="md:col-span-3 space-y-3.5">
                                      <div className="p-3.5 sm:p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 h-full font-display">
                                          <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 uppercase mb-1.5 tracking-wider">
                                              Ghi chú gói tập
                                          </p>
                                          <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100 break-all md:break-words whitespace-pre-line">
                                              {customer.packageNote}
                                          </p>
                                      </div>
                                 </div>
                                 <div className="md:col-span-1 flex flex-col gap-3.5">
                                     <InfoRow label="Thuê tủ đồ" value={customer.hasLocker} isBoolean />
                                     <InfoRow label="Gói nước uống" value={customer.hasWater} isBoolean />
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
                                <thead className="bg-gray-200/80 dark:bg-gray-800 text-black dark:text-white font-bold uppercase sticky top-0 font-display border-b border-gray-300 dark:border-gray-700">
                                    <tr>
                                        <th className="px-6 py-4">THỜI GIAN</th>
                                        <th className="px-6 py-4">NGÀY</th>
                                        <th className="px-6 py-4">GÓI GHI NHẬN</th>
                                        <th className="px-6 py-4 text-right">TRẠNG THÁI</th>
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
                                                <td className="px-6 py-4 font-bold text-gray-800 dark:text-gray-200">
                                                    {format(new Date(h.time), "dd/MM/yyyy")}
                                                </td>
                                                <td className="px-6 py-4 font-bold text-gray-800 dark:text-gray-200">
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
                            
                            {canDeduct && isSessionPackage && customer.remainingSessions > 0 && (
                                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                                    <select
                                        className="text-sm border-gray-300 rounded-lg px-3 py-2 w-full sm:w-40 focus:ring-blue-500 focus:border-blue-500 outline-none border bg-white dark:bg-gray-800"
                                        value={ptId}
                                        onChange={(e) => {
                                            setPtId(e.target.value);
                                            const selected = ptList.find(p => p._id === e.target.value);
                                            setPtName(selected?.fullName || selected?.username || '');
                                        }}
                                        title="Chọn PT Hướng dẫn"
                                    >
                                        <option value="">-- Chọn PT --</option>
                                        {ptList.map(pt => (
                                            <option key={pt._id} value={pt._id}>
                                                {pt.fullName || pt.username}
                                            </option>
                                        ))}
                                    </select>
                                    <input 
                                        type="text" 
                                        className="text-sm border-gray-300 rounded-lg px-3 py-2 w-full sm:w-40 focus:ring-blue-500 focus:border-blue-500 outline-none border"
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                    />
                                    <button 
                                        onClick={handleDeductSession}
                                        disabled={isDeducting}
                                        className="bg-primary hover:bg-primary/90 text-background-dark px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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
                                <thead className="bg-gray-200/80 dark:bg-gray-800 text-black dark:text-white font-bold uppercase sticky top-0 font-display border-b border-gray-300 dark:border-gray-700">
                                    <tr>
                                        <th className="px-6 py-4">NGÀY TẬP</th>
                                        <th className="px-6 py-4">GIỜ</th>
                                        <th className="px-6 py-4">PT HƯỚNG DẪN</th>
                                        <th className="px-6 py-4">LỄ TÂN XÁC NHẬN</th>
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
                                                <td className="px-6 py-4 font-bold text-gray-800 dark:text-gray-200">
                                                    {format(new Date(w.date), "HH:mm")}
                                                </td>
                                                <td className="px-6 py-4 text-blue-700 font-bold">
                                                    {w.pt?.fullName || w.ptName}
                                                </td>
                                                <td className="px-6 py-4 font-bold text-gray-800 dark:text-gray-200">
                                                    <div className="flex justify-between items-center w-full">
                                                        <div className="flex flex-col border-r border-gray-100 pr-4">
                                                            <span className="font-bold text-gray-800 dark:text-gray-200">{w.confirmedBy?.fullName || w.confirmedBy?.username || "N/A"}</span>
                                                            <span className="text-xs font-semibold">{w.note}</span>
                                                        </div>
                                                        {currentUser.role === 'admin' && (
                                                            <button 
                                                                onClick={() => handleDeleteSession(w._id)}
                                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors flex-shrink-0"
                                                                title="Xóa buổi tập (Chỉ có quyền Admin)"
                                                            >
                                                               <span className="material-symbols-outlined text-xl">delete</span>
                                                            </button>
                                                        )}
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

                 {/* TAB 4: PACKAGES */}
                 {activeTab === 'packages' && (
                     <div className="animate-fade-in-up h-full flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                             <h3 className="text-lg font-bold">Lịch sử đăng ký </h3>
                        </div>
                        <div className="w-full overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl custom-scrollbar">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-200/80 dark:bg-gray-800 text-black dark:text-white font-bold uppercase sticky top-0 font-display border-b border-gray-300 dark:border-gray-700">
                                    <tr>
                                        <th className="px-4 py-3">MÃ HĐ</th>
                                        <th className="px-4 py-3">TÊN GÓI </th>
                                        <th className="px-4 py-3">THỜI GIAN GÓI</th>
                                        <th className="px-4 py-3">GIÁ TIỀN</th>
                                        <th className="px-4 py-3">GHI CHÚ</th>
                                        <th className="px-4 py-3">TRẠNG THÁI</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {loadingPackages ? (
                                        <tr><td colSpan="6" className="p-10 text-center text-gray-500">Đang tải lịch sử gói tập...</td></tr>
                                    ) : customerPackages.length > 0 ? (
                                        customerPackages.map((pkg, idx) => (
                                            <tr key={idx} className="hover:bg-bg-50 dark:hover:bg-gray-800/50">
                                                <td className="px-4 py-3 font-bold text-gray-800 dark:text-gray-200">
                                                    {pkg.contractCode || "-"}
                                                </td>
                                                <td className="px-4 py-3 font-bold text-gray-800 dark:text-gray-200">
                                                    {pkg.packageType || pkg.packageName}
                                                </td>
                                                <td className="px-4 py-3 font-bold text-gray-800 dark:text-gray-200">
                                                    {pkg.startDate ? format(new Date(pkg.startDate), "dd/MM/yyyy") : "-"} - {pkg.endDate ? format(new Date(pkg.endDate), "dd/MM/yyyy") : "-"}
                                                </td>
                                                <td className="px-4 py-3 font-bold text-gray-800 dark:text-gray-200">
                                                    {pkg.price ? `${Number(pkg.price).toLocaleString()} đ` : "0 đ"}
                                                </td>
                                                <td className="px-4 py-3 font-bold text-gray-800 dark:text-gray-200 whitespace-pre-line">
                                                    {pkg.packageNote || "-"}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {pkg.status === 'active' && (
                                                        <span className="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold border border-green-200 whitespace-nowrap">Đang hoạt động</span>
                                                    )}
                                                    {pkg.status === 'frozen' && (
                                                        <span className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold border border-purple-200 whitespace-nowrap">Bảo lưu</span>
                                                    )}
                                                    {pkg.status === 'expired' && (
                                                        <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold border border-red-200 whitespace-nowrap">Hết hạn</span>
                                                    )}
                                                    {pkg.status === 'pending' && (
                                                        <span className="px-2.5 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-bold border border-gray-200 whitespace-nowrap">Chờ kích hoạt</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="p-12">
                                                <div className="flex flex-col items-center justify-center text-center text-gray-400 gap-2">
                                                    <span className="material-symbols-outlined text-4xl opacity-50">assignment</span>
                                                    <span className="font-display">Chưa có gói tập nào đăng ký</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                     </div>
                 )}

                 {/* TAB 5: FREEZE (BẢO LƯU GÓI TẬP) */}
                 {activeTab === 'freeze' && (
                     <div className="animate-fade-in-up h-full flex flex-col">
                         <div className="flex justify-between items-center mb-4">
                             <h3 className="text-lg font-bold">Quản lý Bảo lưu gói tập</h3>
                         </div>
                         <div className="w-full overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 flex-1 p-4 space-y-4">
                             {loadingPackages ? (
                                 <div className="p-10 text-center text-gray-500">Đang tải thông tin...</div>
                             ) : customerPackages.length > 0 ? (
                                 customerPackages.map((pkg, idx) => (
                                     <div key={idx} className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col gap-4">
                                         <div className="flex justify-between items-center">
                                             <div>
                                                 <h4 className="font-bold text-gray-800 text-lg">{pkg.packageType || pkg.packageName}</h4>
                                                 <p className="text-sm text-gray-500 mt-1">Mã HĐ: {pkg.contractCode || "N/A"}</p>
                                                 <p className="text-sm text-gray-500">Thời gian gói: {pkg.startDate ? format(new Date(pkg.startDate), "dd/MM/yyyy") : "-"} - {pkg.endDate ? format(new Date(pkg.endDate), "dd/MM/yyyy") : "-"}</p>
                                             </div>
                                             <div className="flex flex-col items-end gap-2">
                                                 {pkg.status === 'active' && (
                                                     <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold border border-green-200">Đang hoạt động</span>
                                                 )}
                                                 {pkg.status === 'frozen' && (
                                                     <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold border border-purple-200">Bảo lưu</span>
                                                 )}
                                                 {pkg.status === 'upgraded' && (
                                                     <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold border border-blue-200">Đã nâng cấp</span>
                                                 )}
                                                 {pkg.status === 'transferred' && (
                                                     <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold border border-amber-300">Đã chuyển nhượng</span>
                                                 )}
                                                 
                                                 {["admin", "manager", "reception", "sale", "staff"].includes(currentUser.role) && (
                                                     <div className="mt-2 flex flex-wrap gap-2 justify-end">
                                                         {pkg.status === 'transferred' && (
                                                             <span className="px-3 py-1.5 text-amber-800 bg-amber-100 border border-amber-300 rounded-lg text-xs font-bold">
                                                                 🚫 Đã chuyển nhượng
                                                             </span>
                                                         )}
                                                         {pkg.status === 'active' && (
                                                             <>
                                                                 <button
                                                                     type="button"
                                                                     onClick={() => { setSelectedPackageForAction(pkg); setIsFreezeContractModalOpen(true); }}
                                                                     className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-xs transition-colors shadow-sm"
                                                                 >
                                                                     Bảo lưu
                                                                 </button>
                                                                 <button
                                                                     type="button"
                                                                     onClick={() => { setSelectedPackageForAction(pkg); setIsUpgradeModalOpen(true); }}
                                                                     className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors shadow-sm"
                                                                 >
                                                                     Nâng cấp
                                                                 </button>
                                                                 <button
                                                                     type="button"
                                                                     onClick={() => { setSelectedPackageForAction(pkg); setIsTransferModalOpen(true); }}
                                                                     className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors shadow-sm"
                                                                 >
                                                                     Chuyển nhượng
                                                                 </button>
                                                             </>
                                                         )}
                                                         {pkg.status === 'frozen' && (
                                                             <button
                                                                 type="button"
                                                                 onClick={() => handleUnfreezeClick(pkg._id)}
                                                                 disabled={isFreezing}
                                                                 className="px-3 py-1.5 bg-green-500 text-white hover:bg-green-600 font-bold rounded-lg text-xs transition-colors shadow-sm"
                                                             >
                                                                 Kích hoạt lại
                                                             </button>
                                                         )}
                                                     </div>
                                                 )}
                                             </div>
                                         </div>
                                         
                                         {/* Lịch sử bảo lưu */}
                                         {pkg.frozenPeriods && pkg.frozenPeriods.length > 0 && (
                                             <div className="mt-2 border-t pt-4">
                                                 <h5 className="text-sm font-bold text-gray-700 mb-2">Lịch sử các lần bảo lưu:</h5>
                                                 <ul className="space-y-2">
                                                     {pkg.frozenPeriods.map((fp, i) => (
                                                         <li key={i} className="text-sm flex gap-3 text-gray-600 bg-gray-50 p-2 rounded">
                                                             <span className="material-symbols-outlined text-gray-400 text-lg">event</span>
                                                             <span>
                                                                 Từ: <strong className="text-gray-800">{format(new Date(fp.startDate), "dd/MM/yyyy")}</strong>
                                                                 {fp.endDate ? (
                                                                     <> đến <strong className="text-gray-800">{format(new Date(fp.endDate), "dd/MM/yyyy")}</strong></>
                                                                 ) : " - Đang trong thời gian bảo lưu"}
                                                                 {fp.reason && <span className="italic"> (Lý do: {fp.reason})</span>}
                                                             </span>
                                                         </li>
                                                     ))}
                                                 </ul>
                                             </div>
                                         )}
                                     </div>
                                 ))
                             ) : (
                                 <div className="flex flex-col items-center justify-center p-12 text-center text-gray-400 gap-2 h-full">
                                     <span className="material-symbols-outlined text-4xl opacity-50">pause_circle</span>
                                     <span className="font-display">Chưa có gói tập nào để bảo lưu</span>
                                 </div>
                             )}
                         </div>
                     </div>
                 )}
             </div>
         </div>

         {/* FREEZE MODAL */}
         {freezeModalOpen && (
             <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                 <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
                     <button
                         onClick={() => setFreezeModalOpen(false)}
                         className="absolute top-4 right-4 text-gray-500 hover:text-red-500 transition-colors"
                     >
                         <span className="material-symbols-outlined">close</span>
                     </button>
                     <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">Bảo lưu gói tập</h2>
                     
                     <div className="space-y-4">
                         <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">Lý do bảo lưu <span className="text-red-500">*</span></label>
                             <input 
                                 type="text" 
                                 className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                 value={freezeData.reason}
                                 onChange={e => setFreezeData({...freezeData, reason: e.target.value})}
                             />
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                             <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu</label>
                                 <input 
                                     type="date" 
                                     className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                     value={freezeData.startDate}
                                     onChange={e => setFreezeData({...freezeData, startDate: e.target.value})}
                                 />
                             </div>
                             <div>
                                 <label className="block text-sm font-medium text-gray-700 mb-1">Ngày kết thúc dự kiến</label>
                                 <input 
                                     type="date" 
                                     className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                     value={freezeData.endDate}
                                     onChange={e => setFreezeData({...freezeData, endDate: e.target.value})}
                                 />
                             </div>
                         </div>
                         {freezeData.startDate && freezeData.endDate && (
                             <div className="text-sm font-bold text-amber-600">
                                 Tổng số ngày bảo lưu dự kiến: {Math.max(0, Math.ceil((new Date(freezeData.endDate) - new Date(freezeData.startDate)) / (1000 * 60 * 60 * 24)))} ngày
                             </div>
                         )}
                     </div>
                     
                     <div className="flex justify-end gap-3 mt-6">
                         <button 
                             onClick={() => setFreezeModalOpen(false)}
                             className="px-4 py-2 border rounded-lg font-medium hover:bg-gray-50 transition-colors"
                         >
                             Hủy
                         </button>
                         <button 
                             onClick={confirmFreeze}
                             disabled={isFreezing}
                             className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold transition-colors"
                         >
                             {isFreezing ? "Đang xử lý..." : "Xác nhận Bảo lưu"}
                         </button>
                     </div>
                 </div>
             </div>
         )}

         {/* UNFREEZE MODAL */}
         {unfreezeModalOpen && (
             <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                 <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
                     <button
                         onClick={() => setUnfreezeModalOpen(false)}
                         className="absolute top-4 right-4 text-gray-500 hover:text-red-500 transition-colors"
                     >
                         <span className="material-symbols-outlined">close</span>
                     </button>
                     <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">Kích hoạt lại gói tập</h2>
                     
                     <div className="space-y-4">
                         {(() => {
                             const pkg = customerPackages.find(p => p._id === selectedPkgId);
                             if (!pkg) return null;
                             const activePeriod = pkg.frozenPeriods && pkg.frozenPeriods.length > 0
                                 ? pkg.frozenPeriods[pkg.frozenPeriods.length - 1]
                                 : null;
                             
                             return (
                                 <>
                                     <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
                                         <div><strong>Gói tập:</strong> {pkg.packageType || pkg.packageName}</div>
                                         {activePeriod && (
                                             <>
                                                 <div><strong>Ngày bắt đầu bảo lưu:</strong> {format(new Date(activePeriod.startDate), "dd/MM/yyyy")}</div>
                                                 <div><strong>Ngày kết thúc dự kiến:</strong> {format(new Date(activePeriod.endDate), "dd/MM/yyyy")}</div>
                                             </>
                                         )}
                                         <div><strong>Hạn gói hiện tại:</strong> {format(new Date(pkg.endDate), "dd/MM/yyyy")}</div>
                                     </div>

                                     <div>
                                         <label className="block text-sm font-medium text-gray-700 mb-1">Ngày kích hoạt lại thực tế</label>
                                         <input 
                                             type="date" 
                                             className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                             value={unfreezeData.actualUnfreezeDate}
                                             onChange={e => setUnfreezeData({ actualUnfreezeDate: e.target.value })}
                                         />
                                     </div>

                                     {activePeriod && unfreezeData.actualUnfreezeDate && (
                                         <div className="bg-green-50 text-green-900 p-3 rounded-lg text-xs space-y-1 border border-green-200">
                                             <div><strong>Số ngày bảo lưu thực tế:</strong> {
                                                 Math.max(0, Math.ceil((new Date(unfreezeData.actualUnfreezeDate) - new Date(activePeriod.startDate)) / (1000 * 60 * 60 * 24)))
                                             } ngày</div>
                                             <div><strong>Hạn gói mới ước tính:</strong> {
                                                 getEstimatedNewEndDate() ? format(new Date(getEstimatedNewEndDate()), "dd/MM/yyyy") : "-"
                                             }</div>
                                         </div>
                                     )}
                                 </>
                             );
                         })()}
                     </div>
                     
                     <div className="flex justify-end gap-3 mt-6">
                         <button 
                             onClick={() => setUnfreezeModalOpen(false)}
                             className="px-4 py-2 border rounded-lg font-medium hover:bg-gray-50 transition-colors"
                         >
                             Hủy
                         </button>
                         <button 
                             onClick={confirmUnfreeze}
                             disabled={isFreezing}
                             className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition-colors"
                         >
                             {isFreezing ? "Đang xử lý..." : "Xác nhận Kích hoạt"}
                         </button>
                     </div>
                 </div>
             </div>
         )}
      </div>
      {showFaceModal && (
          <FaceCaptureModal
              customer={customer}
              onClose={() => setShowFaceModal(false)}
              onSuccess={handleFaceCapture}
          />
      )}

      <FreezeContractModal
        isOpen={isFreezeContractModalOpen}
        onClose={() => { setIsFreezeContractModalOpen(false); setSelectedPackageForAction(null); }}
        customerPackage={selectedPackageForAction}
        onSuccess={() => { fetchCustomerPackages(); if (onUpdate) onUpdate(); }}
      />

      <UpgradeContractModal
        isOpen={isUpgradeModalOpen}
        onClose={() => { setIsUpgradeModalOpen(false); setSelectedPackageForAction(null); }}
        customerPackage={selectedPackageForAction}
        onSuccess={() => { fetchCustomerPackages(); if (onUpdate) onUpdate(); }}
      />

      <TransferContractModal
        isOpen={isTransferModalOpen}
        onClose={() => { setIsTransferModalOpen(false); setSelectedPackageForAction(null); }}
        customerPackage={selectedPackageForAction}
        onSuccess={() => { fetchCustomerPackages(); if (onUpdate) onUpdate(); }}
      />
    </div>
  );
};

export default CustomerDetailModal;
