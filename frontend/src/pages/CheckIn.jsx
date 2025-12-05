import React, { useState, useEffect } from "react";
import { customerService, checkInService } from "../services/customerService";
import { getCustomerStatus } from "../utils/dateUtils";
import { LogIn, CheckCircle, XCircle } from "lucide-react";

const CheckIn = () => {
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await customerService.getAll();
        setCustomers(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Lỗi tải khách hàng:", err);
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleCheckIn = async (customer) => {
    if (!customer || !customer._id) {
      alert("Thông tin khách hàng không hợp lệ.");
      return;
    }

    // Kiểm tra trạng thái gói tập
    const status = getCustomerStatus(customer.endDate);
    if (status.status === "expired") {
      alert(
        "Gói tập của khách hàng đã hết hạn. Vui lòng gia hạn trước khi check-in."
      );
      return;
    }

    setCheckingIn(customer._id);
    setSuccessMessage("");

    try {
      await checkInService.create({
        customerId: customer._id,
        customerName: customer.name || "",
        customerCode: customer.code || "",
        packageType: customer.packageType || "",
      });

      setSuccessMessage(`Đã check-in thành công cho ${customer.name}!`);
      setTimeout(() => setSuccessMessage(""), 3000);

      // Refresh danh sách để cập nhật
      const newData = await customerService.getAll();
      setCustomers(Array.isArray(newData) ? newData : []);
    } catch (error) {
      console.error("Lỗi check-in:", error);
      alert("Có lỗi xảy ra khi check-in. Vui lòng thử lại.");
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
    <div className="flex flex-col gap-6 font-display p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-text-light dark:text-text-dark">
            Check-in Khách hàng
          </h1>
          <p className="text-subtle-light dark:text-subtle-dark mt-1">
            Quét mã hoặc tìm kiếm khách hàng để check-in
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle size={20} />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-3 text-gray-400">
          search
        </span>
        <input
          className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          placeholder="Tìm kiếm theo tên hoặc số điện thoại..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoFocus
        />
      </div>

      <div className="bg-white dark:bg-surface-dark rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-100 dark:bg-gray-800 uppercase text-sm font-bold">
              <tr>
                <th className="p-4">Tên khách hàng</th>
                <th className="p-4">Số điện thoại</th>
                <th className="p-4">Gói tập</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((c) => {
                  const status = getCustomerStatus(c.endDate);
                  const isCheckingIn = checkingIn === c._id;

                  return (
                    <tr
                      key={c._id || c.id}
                      className="border-t hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="p-4 font-bold text-text-light dark:text-text-dark">
                        {c.name || "N/A"}
                      </td>
                      <td className="p-4 text-text-light dark:text-text-dark">
                        {c.phone || "N/A"}
                      </td>
                      <td className="p-4 text-text-light dark:text-text-dark">
                        {c.packageType || "N/A"}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-bold ${
                            status.status === "active"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : status.status === "expiring"
                              ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          }`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleCheckIn(c)}
                          disabled={isCheckingIn || status.status === "expired"}
                          className={`px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2 ml-auto ${
                            status.status === "expired"
                              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                              : isCheckingIn
                              ? "bg-blue-300 text-blue-700 cursor-wait"
                              : "bg-green-600 text-white hover:bg-green-700"
                          }`}
                        >
                          {isCheckingIn ? (
                            <>
                              <div className="w-4 h-4 border-2 border-blue-700 border-t-transparent rounded-full animate-spin"></div>
                              Đang xử lý...
                            </>
                          ) : (
                            <>
                              <LogIn size={18} />
                              Check-in
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="p-6 text-center text-gray-500">
                    {searchTerm
                      ? "Không tìm thấy khách hàng nào."
                      : "Chưa có khách hàng nào."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CheckIn;
