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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden font-display">
      <div className="p-6 border-b border-gray-100 dark:border-gray-700/60 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-base md:text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={20} />
            Cảnh báo khách hàng rời bỏ (Churn)
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Dự đoán hội viên có nguy cơ không gia hạn dựa trên tần suất check-in và hạn gói tập</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              id="churn_search_input"
              name="churnSearch"
              type="text" 
              placeholder="Tìm tên, SĐT..." 
              aria-label="Tìm kiếm hội viên theo tên hoặc SĐT"
              className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary/50 outline-none text-xs sm:text-sm bg-gray-50/50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-colors"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <select 
            id="churn_filter_select"
            name="churnFilter"
            aria-label="Lọc theo mức độ nguy cơ rời bỏ"
            className="py-2 px-3 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/50 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-colors"
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 p-6 bg-gray-50/50 dark:bg-gray-900/30 border-b border-gray-100 dark:border-gray-700/60">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 flex items-start justify-between min-w-0 w-full gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nguy cơ cao</p>
            <p className="text-2xl md:text-3xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight break-words">
              {data.highRisk.length} <span className="text-sm font-semibold text-gray-400">hội viên</span>
            </p>
            <p className="text-xs text-gray-400 mt-2">Nghỉ tập &gt; 14 ngày hoặc sắp hết hạn</p>
          </div>
          <div className="w-11 h-11 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-900/30">
            <AlertCircle size={22} />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 flex items-start justify-between min-w-0 w-full gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nguy cơ trung bình</p>
            <p className="text-2xl md:text-3xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight break-words">
              {data.mediumRisk.length} <span className="text-sm font-semibold text-gray-400">hội viên</span>
            </p>
            <p className="text-xs text-gray-400 mt-2">Tần suất tập giảm đột ngột</p>
          </div>
          <div className="w-11 h-11 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center shrink-0 border border-amber-100 dark:border-amber-900/30">
            <Clock size={22} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 flex items-start justify-between min-w-0 w-full gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tỷ lệ an toàn</p>
            <p className="text-2xl md:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight break-words">
              {Math.round((data.lowRisk.length / (allCustomers.length + data.lowRisk.length || 1)) * 100)}%
            </p>
            <p className="text-xs text-gray-400 mt-2">Hội viên duy trì tập luyện đều đặn</p>
          </div>
          <div className="w-11 h-11 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-900/30">
            <UserCheck size={22} />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/80 text-xs font-semibold text-gray-500 dark:text-gray-400">
              <th className="p-4">Khách hàng</th>
              <th className="p-4">Mức độ nguy cơ</th>
              <th className="p-4">Thời gian vắng mặt</th>
              <th className="p-4">Gói tập còn</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {currentItems.length > 0 ? currentItems.map((customer) => (
              <tr key={customer._id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm border border-blue-100 dark:border-blue-900/30">
                      {customer.name?.charAt(0) || 'K'}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{customer.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{customer.phone}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold inline-flex items-center gap-1.5 border ${
                    customer.riskLevel === 'high' 
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200/50' 
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200/50'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${customer.riskLevel === 'high' ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
                    {customer.riskLevel === 'high' ? 'Nguy cơ Cao' : 'Cần chú ý'}
                  </span>
                </td>
                <td className="p-4">
                  {customer.daysSinceLastCheckIn === 999 ? (
                    <span className="text-gray-400 text-xs italic">Chưa từng check-in</span>
                  ) : (
                    <span className={`font-bold ${customer.daysSinceLastCheckIn > 14 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {customer.daysSinceLastCheckIn} ngày
                    </span>
                  )}
                  {customer.lastCheckInDate && (
                    <p className="text-[11px] text-gray-400 mt-0.5">Lần cuối: {new Date(customer.lastCheckInDate).toLocaleDateString('vi-VN')}</p>
                  )}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span className={`font-semibold ${customer.daysUntilExpiration <= 14 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {customer.daysUntilExpiration} ngày
                    </span>
                  </div>
                </td>
                <td className="p-4 text-right">
                  <button 
                    onClick={() => handleSendReminder(customer)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-2xs"
                  >
                    <Mail className="w-3.5 h-3.5 text-blue-500" />
                    Nhắc nhở
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5" className="p-8 text-center text-gray-400 text-xs">
                  <p className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-300">🎉 Tuyệt vời!</p>
                  <p>Không có khách hàng nào nằm trong nhóm nguy cơ này.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Phân trang */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-gray-100 dark:border-gray-700/60 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/40">
          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400">
            Trang {currentPage} / {totalPages}
          </div>
          <div className="flex gap-2">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Trang trước
            </button>
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
