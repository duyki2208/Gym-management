import React, { useState, useEffect } from "react";
import { customerService, packageService } from "../services/customerService";
import CustomerModal from "../components/customer/CustomerModal";
// Các hàm helper giữ nguyên hoặc import từ utils nếu có, tôi viết gọn lại ở đây để tránh lỗi
const getCustomerStatus = (endDate) => {
  if (!endDate) return { status: "active", label: "Hoạt động" };
  const end = new Date(endDate);
  const now = new Date();
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { status: "expired", label: "Hết hạn" };
  if (diff <= 5) return { status: "expiring", label: "Sắp hết" };
  return { status: "active", label: "Hoạt động" };
};

const CustomerList = () => {
  const [customers, setCustomers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // --- SỬA LỖI TRẮNG MÀN HÌNH TẠI ĐÂY ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [customerData, packageData] = await Promise.all([
          customerService.getAll(),
          packageService.getAll(),
        ]);
        setCustomers(Array.isArray(customerData) ? customerData : []);
        setPackages(Array.isArray(packageData) ? packageData : []);
      } catch (err) {
        console.error("Lỗi tải khách hàng:", err);
        setCustomers([]);
        setPackages([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSave = async (data) => {
    try {
      await customerService.save(data);
      // Reload lại danh sách sau khi lưu
      const newData = await customerService.getAll();
      setCustomers(Array.isArray(newData) ? newData : []);
      setShowModal(false);
    } catch (error) {
      console.error("Lỗi lưu khách hàng:", error);
      alert("Có lỗi xảy ra khi lưu khách hàng. Vui lòng thử lại.");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Xóa khách hàng này?")) {
      try {
        await customerService.delete(id);
        const newData = await customerService.getAll();
        setCustomers(Array.isArray(newData) ? newData : []);
      } catch (error) {
        console.error("Lỗi xóa khách hàng:", error);
        alert("Có lỗi xảy ra khi xóa khách hàng. Vui lòng thử lại.");
      }
    }
  };

  if (loading)
    return <div className="p-10 text-center">Đang kết nối Backend...</div>;

  return (
    <div className="flex flex-col gap-6 font-display p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-black">Quản lý Khách hàng</h1>
        <button
          onClick={() => {
            setEditingCustomer(null);
            setShowModal(true);
          }}
          className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700"
        >
          + Thêm Khách
        </button>
      </div>

      <input
        className="w-full p-3 border rounded-xl"
        placeholder="Tìm kiếm..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-100 uppercase text-sm font-bold">
            <tr>
              <th className="p-4">Tên</th>
              <th className="p-4">SĐT</th>
              <th className="p-4">Gói</th>
              <th className="p-4">Trạng thái</th>
              <th className="p-4 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {customers
              .filter(
                (c) =>
                  c &&
                  c.name &&
                  typeof c.name === "string" &&
                  c.name.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((c) => {
                const st = getCustomerStatus(c.endDate);
                return (
                  <tr key={c._id || c.id} className="border-t hover:bg-gray-50">
                    <td className="p-4 font-bold">{c.name}</td>
                    <td className="p-4">{c.phone}</td>
                    <td className="p-4">{c.packageType}</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${
                          st.status === "active"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingCustomer(c);
                            setShowModal(true);
                          }}
                          className="text-blue-500 hover:text-blue-700 px-3 py-1"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => handleDelete(c._id || c.id)}
                          className="text-red-500 hover:text-red-700 px-3 py-1"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        {customers.length === 0 && (
          <div className="p-6 text-center text-gray-500">
            Chưa có khách hàng nào.
          </div>
        )}
      </div>

      {showModal && Array.isArray(packages) && (
        <CustomerModal
          customer={editingCustomer}
          packages={packages}
          onSave={handleSave}
          onClose={() => {
            setShowModal(false);
            setEditingCustomer(null);
          }}
        />
      )}
    </div>
  );
};
export default CustomerList;
