import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { checkInService } from "../services/customerService";
import { getCustomerStatus } from "../utils/dateUtils";
import { LogIn, CheckCircle, XCircle, ScanFace } from "lucide-react";
import AutoCheckIn from "../components/customer/AutoCheckIn";
import CheckInSuccessPopup from "../components/customer/CheckInSuccessPopup";

const CheckIn = () => {
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(null);
  const [successCheckins, setSuccessCheckins] = useState([]); // Array to store multiple checkins
  const [isAdmin, setIsAdmin] = useState(false);
  const [useAutoScan, setUseAutoScan] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("gym_user") || "{}");
    setIsAdmin(user.role === "admin");
    fetchCustomers();
  }, []);

  const fetchCustomers = async (search = "") => {
    setLoading(true);
    try {
      // Dùng endpoint chuyên dụng: KHÔNG có faceDescriptor, có phân trang
      const result = await checkInService.getCheckInList({ search, limit: 100 });
      setCustomers(result.customers || []);
    } catch (err) {
      console.error("Lỗi tải khách hàng:", err);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };


  const handleCheckIn = async (customer, isAlreadyCheckedIn = false) => {
    if (!customer || !customer._id) {
      toast.error("Thông tin khách hàng không hợp lệ.");
      return;
    }

    // Kiểm tra trạng thái gói tập
    const status = getCustomerStatus(customer.startDate, customer.endDate, customer.activePackage?.status || customer.status);
    if (status.status === "expired") {
      toast.error(
        "Gói tập của khách hàng đã hết hạn. Vui lòng gia hạn trước khi check-in."
      );
      return;
    }

    if (isAlreadyCheckedIn) {
      // Đã được lưu ở server trong API recognize rồi, chỉ cần hiển thị popup thành công
      const checkinRecord = {
          id: Date.now().toString(),
          data: customer,
      };
      setSuccessCheckins(prev => [...prev, checkinRecord]);
      return;
    }

    setCheckingIn(customer._id);

    try {
      await checkInService.create({
        customerId: customer.customerId || customer._id,
        customerName: customer.name || "",
        customerCode: customer.code || "",
        packageType: customer.packageType || "",
      });

      const checkinRecord = {
          id: Date.now().toString(),
          data: customer,
      };
      setSuccessCheckins(prev => [...prev, checkinRecord]);
      // Không cần fetch lại — chỉ cần hiển thị popup thành công
    } catch (error) {
      console.error("Lỗi check-in:", error);
    } finally {
      setCheckingIn(null);
    }
  };


  if (loading) {
    return <div className="p-10 text-center">Đang tải dữ liệu...</div>;
  }

  const filteredCustomers = customers.filter(
    (c) =>
      c &&
      c.name &&
      typeof c.name === "string" &&
      c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 font-display">
      {/* ── Card: Search + FaceID ── */}
      <div className="flex items-center gap-3 p-4 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark">
        <div className="relative flex-1 max-w-2xl">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-500 text-xl">search</span>
          <input
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-gray-100"
            placeholder="Tìm tên, SĐT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex-1" />

        <button
          onClick={() => setUseAutoScan(!useAutoScan)}
          className={`flex items-center gap-2 h-10 px-4 rounded-xl font-bold text-sm transition-all shrink-0 ${
            useAutoScan
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-primary text-text-light hover:opacity-90'
          }`}
        >
          <ScanFace size={18} />
          {useAutoScan ? 'Dừng FaceID' : 'Nhận diện FaceID'}
        </button>
      </div>

      {/* Popup stack — hiện khi check-in thành công */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-4 items-end pointer-events-none">
        {successCheckins.map((checkin) => (
          <CheckInSuccessPopup
            key={checkin.id}
            customer={checkin.data}
            onClose={() => setSuccessCheckins(prev => prev.filter(item => item.id !== checkin.id))}
          />
        ))}
      </div>

      {/* Content: FaceID mode hoặc Table mode */}
      {useAutoScan ? (
        <AutoCheckIn
          customers={customers}
          onCheckIn={handleCheckIn}
          isCheckingIn={checkingIn !== null}
        />
      ) : (
        <div className="bg-white dark:bg-surface-dark rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-100 dark:bg-gray-800 uppercase text-sm font-bold">
                <tr>
                  <th className="p-4">Tên khách hàng</th>
                  <th className="p-4">Số điện thoại</th>
                  <th className="p-4">Gói tập</th>
                  <th className="p-4">Trạng thái</th>
                  {isAdmin && <th className="p-4 text-right">Hành động</th>}
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((c) => {
                    const status = getCustomerStatus(c.startDate, c.endDate, c.activePackage?.status || c.status);
                    const isCheckingIn = checkingIn === c._id;
                    return (
                      <tr key={c._id || c.id} className="border-t hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="p-4 font-medium text-base text-gray-900 dark:text-gray-100">{c.name || 'N/A'}</td>
                        <td className="p-4 text-base font-medium text-gray-900 dark:text-gray-100">{c.phone || 'N/A'}</td>
                        <td className="p-4 text-base font-medium text-gray-900 dark:text-gray-100">{c.packageType || 'N/A'}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${status.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              status.status === 'active' ? 'bg-green-500'
                              : status.status === 'frozen' ? 'bg-purple-500'
                              : status.status === 'expiring' ? 'bg-yellow-500'
                              : status.status === 'not_activated' ? 'bg-sky-500'
                              : 'bg-red-500'
                            }`} />
                            {status.label}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleCheckIn(c)}
                              disabled={isCheckingIn || status.status === 'expired'}
                              className={`px-4 py-2 rounded-xl font-bold transition-colors flex items-center gap-2 ml-auto ${
                                status.status === 'expired'
                                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                  : isCheckingIn
                                  ? 'bg-blue-300 text-blue-700 cursor-wait'
                                  : 'bg-green-600 text-white hover:bg-green-700'
                              }`}
                            >
                              {isCheckingIn ? (
                                <><div className="w-4 h-4 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />Đang xử lý...</>
                              ) : (
                                <><LogIn size={18} />Check-in</>
                              )}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="5" className="p-6 text-center text-gray-500">
                      {searchTerm ? 'Không tìm thấy khách hàng nào.' : 'Chưa có khách hàng nào.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckIn;

