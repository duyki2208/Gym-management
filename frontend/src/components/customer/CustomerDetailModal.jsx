import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { checkInService } from "../../services/customerService";

const CustomerDetailModal = ({ customer, onClose }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

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

    fetchHistory();
  }, [customer]);

  if (!customer) return null;

  const getStatusColor = (endDate) => {
    if (!endDate) return "text-green-600 bg-green-100";
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    
    if (diff < 0) return "text-red-600 bg-red-100";
    if (diff <= 14) return "text-orange-600 bg-orange-100";
    return "text-green-600 bg-green-100";
  };
  
  const getStatusText = (endDate) => {
      if (!endDate) return "Đang hoạt động";
      const end = new Date(endDate);
      const now = new Date();
      const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
      
      if (diff < 0) return "Hết hạn";
      if (diff <= 14) return `Sắp hết hạn (${diff} ngày)`;
      return "Đang hoạt động";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-700/50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{customer.name}</h2>
            <p className="text-sm text-gray-500 font-mono mt-1">{customer.code || "No Code"}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Info Card */}
            <div className="col-span-1 md:col-span-2 space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700">
                     <p className="text-xs text-gray-500 uppercase font-bold mb-1">Số điện thoại</p>
                     <p className="font-medium">{customer.phone || "---"}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700">
                     <p className="text-xs text-gray-500 uppercase font-bold mb-1">Ngày sinh</p>
                     <p className="font-medium">
                        {customer.dob ? format(new Date(customer.dob), "dd/MM/yyyy") : "---"}
                     </p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700">
                     <p className="text-xs text-gray-500 uppercase font-bold mb-1">Giới tính</p>
                     <p className="font-medium capitalize">{customer.gender === 'male' ? 'Nam' : customer.gender === 'female' ? 'Nữ' : 'Khác'}</p>
                  </div>
                   <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700">
                     <p className="text-xs text-gray-500 uppercase font-bold mb-1">Đã tham gia</p>
                     <p className="font-medium">
                        {customer.startDate ? format(new Date(customer.startDate), "dd/MM/yyyy") : "---"}
                     </p>
                  </div>
               </div>
            </div>

            {/* Membership Card */}
            <div className="col-span-1 rounded-xl border border-blue-100 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-800 p-5">
              <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">card_membership</span>
                Thông tin gói tập
              </h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Gói hiện tại</span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">{customer.packageType || "---"}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Ngày đăng ký</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                        {customer.startDate ? format(new Date(customer.startDate), "dd/MM/yyyy") : "---"}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Ngày hết hạn</span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">
                        {customer.endDate ? format(new Date(customer.endDate), "dd/MM/yyyy") : "---"}
                    </span>
                </div>
                 <div className="pt-3 border-t border-blue-100 dark:border-blue-800 flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Trạng thái</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(customer.endDate)}`}>
                        {getStatusText(customer.endDate)}
                    </span>
                </div>
              </div>
            </div>
          </div>

          {/* History Table */}
          <div>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-gray-400">history</span>
                Lịch sử ra vào ({history.length})
            </h3>
            <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 font-medium">
                        <tr>
                            <th className="px-4 py-3">Thời gian</th>
                            <th className="px-4 py-3">Ngày</th>
                            <th className="px-4 py-3">Gói ghi nhận</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {loading ? (
                            <tr><td colSpan="3" className="p-4 text-center text-gray-500">Đang tải lịch sử...</td></tr>
                        ) : history.length > 0 ? (
                            history.map(item => (
                                <tr key={item._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-4 py-3 font-medium">
                                        {item.time ? format(new Date(item.time), "HH:mm") : "--:--"}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                                        {item.time ? format(new Date(item.time), "dd/MM/yyyy", { locale: vi }) : "---"}
                                    </td>
                                    <td className="px-4 py-3 text-gray-500">
                                        {item.packageType}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan="3" className="p-8 text-center text-gray-500">Chưa có lịch sử check-in nào.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
          </div>
        </div>
        
        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/50 flex justify-end gap-3">
             <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 shadow-sm"
            >
                Đóng
            </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerDetailModal;
