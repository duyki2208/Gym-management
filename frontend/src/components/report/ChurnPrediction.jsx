import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, AlertCircle, Search, Mail, Calendar, Clock, UserCheck } from 'lucide-react';
import reportService from '../../services/reportService';
import toast from 'react-hot-toast';

const ChurnPrediction = () => {
  const [data, setData] = useState({ highRisk: [], mediumRisk: [], lowRisk: [] });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, high, medium
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await reportService.getChurnPrediction();
        if (response.success) {
          setData(response.data);
        } else {
          toast.error(response.message || "Lỗi lấy dữ liệu Churn Prediction");
        }
      } catch (error) {
        toast.error("Lỗi mạng khi tải dữ liệu dự đoán rời bỏ");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Kết hợp tất cả danh sách để dễ filter
  const allCustomers = useMemo(() => {
    return [
      ...data.highRisk.map(c => ({ ...c, riskLevel: 'high' })),
      ...data.mediumRisk.map(c => ({ ...c, riskLevel: 'medium' }))
    ];
  }, [data]);

  // Lọc theo search và loại risk
  const filteredList = useMemo(() => {
    return allCustomers.filter(customer => {
      const matchFilter = filter === 'all' ? true : customer.riskLevel === filter;
      const matchSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          customer.phone.includes(searchTerm);
      return matchFilter && matchSearch;
    });
  }, [allCustomers, filter, searchTerm]);

  // Chia trang
  const totalPages = Math.ceil(filteredList.length / itemsPerPage);
  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredList.slice(start, start + itemsPerPage);
  }, [filteredList, currentPage]);

  const handleSendReminder = (customer) => {
    // Logic gửi email có thể mở rộng ở đây
    toast.success(`Đã gửi lời nhắc đến ${customer.name}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden font-display animate-fade-in">
      <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <AlertTriangle className="text-orange-500 w-6 h-6" />
            Cảnh báo Khách hàng Rời bỏ
          </h2>
          <p className="text-sm text-gray-500 mt-1">Dự đoán dựa trên lịch sử check-in và hạn gói tập.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Tìm tên, SĐT..." 
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <select 
            className="py-2 px-3 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">Tất cả nguy cơ ({allCustomers.length})</option>
            <option value="high">Nguy cơ Cao ({data.highRisk.length})</option>
            <option value="medium">Nguy cơ Vừa ({data.mediumRisk.length})</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-gray-50/50">
        <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-black dark:text-white uppercase tracking-wider mb-1">Nguy cơ Cao</p>
            <p className="text-xl font-bold text-rose-600">{data.highRisk.length}</p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-black dark:text-white uppercase tracking-wider mb-1">Nguy cơ Trung Bình</p>
            <p className="text-xl font-bold text-amber-600">{data.mediumRisk.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-green-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-black dark:text-white uppercase tracking-wider mb-1">Tỉ lệ an toàn</p>
            <p className="text-xl font-bold text-emerald-600">
              {Math.round((data.lowRisk.length / (allCustomers.length + data.lowRisk.length || 1)) * 100)}%
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-y border-gray-200">
              <th className="p-4 font-semibold text-gray-600 text-sm">Khách hàng</th>
              <th className="p-4 font-semibold text-gray-600 text-sm">Mức độ</th>
              <th className="p-4 font-semibold text-gray-600 text-sm">Vắng mặt</th>
              <th className="p-4 font-semibold text-gray-600 text-sm">Gói tập còn</th>
              <th className="p-4 font-semibold text-gray-600 text-sm text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {currentItems.length > 0 ? currentItems.map((customer) => (
              <tr key={customer._id} className="hover:bg-blue-50/30 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                      {customer.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">{customer.name}</p>
                      <p className="text-xs text-gray-500">{customer.phone}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold inline-flex items-center gap-1 ${
                    customer.riskLevel === 'high' 
                      ? 'bg-red-100 text-red-700' 
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${customer.riskLevel === 'high' ? 'bg-red-500' : 'bg-orange-500'}`}></span>
                    {customer.riskLevel === 'high' ? 'Nguy cơ Cao' : 'Cần chú ý'}
                  </span>
                </td>
                <td className="p-4">
                  {customer.daysSinceLastCheckIn === 999 ? (
                    <span className="text-gray-500 text-sm italic">Chưa từng tập</span>
                  ) : (
                    <span className={`font-bold ${customer.daysSinceLastCheckIn > 14 ? 'text-red-500' : 'text-orange-500'}`}>
                      {customer.daysSinceLastCheckIn} ngày
                    </span>
                  )}
                  {customer.lastCheckInDate && (
                    <p className="text-xs text-gray-400 mt-1">Lần cuối: {new Date(customer.lastCheckInDate).toLocaleDateString('vi-VN')}</p>
                  )}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className={`font-medium ${customer.daysUntilExpiration <= 14 ? 'text-red-500' : 'text-gray-700'}`}>
                      {customer.daysUntilExpiration} ngày
                    </span>
                  </div>
                </td>
                <td className="p-4 text-right">
                  <button 
                    onClick={() => handleSendReminder(customer)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    Nhắc nhở
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5" className="p-8 text-center text-gray-500">
                  <p className="mb-2">🎉 Thật tuyệt vời!</p>
                  <p>Không có khách hàng nào nằm trong nhóm nguy cơ này.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Phân trang */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="text-sm font-bold text-gray-700">
            Trang: {currentPage}/{totalPages}
          </div>
          <div className="flex gap-2">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Trang trước
            </button>
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Trang sau
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChurnPrediction;
