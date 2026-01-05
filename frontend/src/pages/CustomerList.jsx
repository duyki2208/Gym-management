import React, { useState, useEffect } from "react";
import { customerService, packageService } from "../services/customerService";
import CustomerModal from "../components/customer/CustomerModal"; // Existing Edit/Add Modal
import CustomerDetailModal from "../components/customer/CustomerDetailModal"; // New Detail Modal

const getCustomerStatus = (endDate) => {
  if (!endDate) return { status: "active", label: "Hoạt động" };
  const end = new Date(endDate);
  const now = new Date();
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { status: "expired", label: "Hết hạn" };
  if (diff <= 14) return { status: "expiring", label: "Sắp hết" };
  return { status: "active", label: "Hoạt động" };
};

const CustomerList = () => {
  const [customers, setCustomers] = useState([]);
  const [packages, setPackages] = useState([]);
  
  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  // Pagination & Filtering State
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); 
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Check Admin Role
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("gym_user") || "{}");
    setIsAdmin(user.role === "admin");
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
  }, [filterStatus]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [customerData, packageData] = await Promise.all([
        customerService.getAll({ 
            page, 
            limit: 10, 
            search: debouncedSearch, 
            status: filterStatus 
        }),
        packageService.getAll(),
      ]);
      
      setCustomers(customerData.customers || []);
      setTotalPages(customerData.totalPages || 1);
      setTotalCustomers(customerData.totalCustomers || 0);
      
      setPackages(Array.isArray(packageData) ? packageData : []);
    } catch (err) {
      console.error("Lỗi tải khách hàng:", err);
      setCustomers([]);
      setPackages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, debouncedSearch, filterStatus]);

  const handleSave = async (data) => {
    try {
      await customerService.save(data);
      fetchData(); // Reload data
      setShowEditModal(false);
    } catch (error) {
      console.error("Lỗi lưu khách hàng:", error);
      alert("Có lỗi xảy ra khi lưu khách hàng. Vui lòng thử lại.");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Xóa khách hàng này?")) {
      try {
        await customerService.delete(id);
        fetchData(); // Reload data
      } catch (error) {
        console.error("Lỗi xóa khách hàng:", error);
        alert("Có lỗi xảy ra khi xóa khách hàng. Vui lòng thử lại.");
      }
    }
  };

  // No longer need client-side filtering: filteredCustomers is just customers
  const displayCustomers = customers;

  if (loading && customers.length === 0)
    return <div className="p-10 text-center">Đang kết nối Backend...</div>;

  return (
    <div className="flex flex-col gap-6 font-display p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-3xl font-black">Quản lý Khách hàng</h1>
           <p className="text-gray-500 mt-1">
              Danh sách hội viên ({totalCustomers} khách hàng)
           </p>
        </div>
        
        {isAdmin && (
          <button
            onClick={() => {
              setSelectedCustomer(null);
              setShowEditModal(true);
            }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 flex items-center gap-2 shadow-lg shadow-green-600/20"
          >
            <span className="material-symbols-outlined">add</span>
            Thêm Khách
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
             <span className="material-symbols-outlined absolute left-3 top-3 text-gray-400">search</span>
             <input
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Tìm kiếm theo tên, số điện thoại..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
          </div>
          
          <div className="w-full md:w-64">
             <select 
                className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary bg-white cursor-pointer"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
             >
                <option value="all">Tất cả trạng thái</option>
                <option value="active">Đang hoạt động</option>
                <option value="expiring">Sắp hết hạn (≤ 14 ngày)</option>
                <option value="expired">Đã hết hạn</option>
             </select>
          </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50 uppercase text-xs font-bold text-gray-500 tracking-wider">
            <tr>
              <th className="p-4">Tên khách hàng</th>
              <th className="p-4">SĐT</th>
              <th className="p-4">Gói tập</th>
              <th className="p-4">Trạng thái</th>
              {isAdmin && <th className="p-4 text-right">Hành động</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayCustomers.length > 0 ? displayCustomers.map((c) => {
                const st = getCustomerStatus(c.endDate);
                return (
                  <tr 
                    key={c._id || c.id} 
                    className="group hover:bg-blue-50/50 transition-colors cursor-pointer"
                    onClick={() => {
                        setSelectedCustomer(c);
                        setShowDetailModal(true);
                    }}
                  >
                    <td className="p-4">
                        <div className="font-bold text-gray-900 text-base">{c.name}</div>
                        <div className="text-xs text-gray-500 font-mono mt-0.5">{c.code}</div>
                    </td>
                    <td className="p-4 text-sm font-bold text-gray-900">
                        {c.phone}
                    </td>
                    <td className="p-4">
                        <span className="font-medium text-gray-900">{c.packageType}</span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                          st.status === "active"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : st.status === "expiring" 
                            ? "bg-orange-50 text-orange-700 border-orange-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${
                             st.status === "active" ? "bg-green-500" : st.status === "expiring" ? "bg-orange-500" : "bg-red-500"
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
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="Sửa thông tin"
                          >
                            <span className="material-symbols-outlined text-xl">edit</span>
                          </button>
                          <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(c._id || c.id);
                            }}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
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
                    <td colSpan={isAdmin ? 5 : 4} className="p-12 text-center text-gray-500">
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
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Trang trước
                </button>
                <button
                    onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={page >= totalPages}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

      {/* Detail Modal */}
      {showDetailModal && selectedCustomer && (
          <CustomerDetailModal 
             customer={selectedCustomer}
             onClose={() => {
                 setShowDetailModal(false);
                 setSelectedCustomer(null);
             }}
          />
      )}
    </div>
  );
};
export default CustomerList;
