import React, { useState, useEffect, useMemo } from 'react';
import { Search, Mail } from 'lucide-react';
import reportService from '../../services/reportService';
import toast from 'react-hot-toast';

const ChurnPrediction = () => {
  const [data, setData] = useState({ highRisk: [], mediumRisk: [], lowRisk: [] });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, high, medium
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

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
      ...(data.highRisk || []).map(c => ({ ...c, riskLevel: 'high' })),
      ...(data.mediumRisk || []).map(c => ({ ...c, riskLevel: 'medium' })),
      ...(data.missingData || []).map(c => ({ ...c, riskLevel: 'missing' }))
    ];
  }, [data]);

  // Lọc theo search và loại risk
  const filteredList = useMemo(() => {
    return allCustomers.filter(customer => {
      const matchFilter = filter === 'all' ? true : customer.riskLevel === filter;
      const matchSearch = (customer.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (customer.phone || '').includes(searchTerm);
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
    <div className="overflow-hidden rounded-lg border border-border-light bg-surface-light font-display dark:border-border-dark dark:bg-surface-dark">
      <div className="p-5 border-b border-border-light dark:border-border-dark flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-base font-semibold text-text-light dark:text-text-dark md:text-lg">Cảnh báo khách hàng rời bỏ</h2>
          <p className="text-xs text-subtle-light dark:text-subtle-dark mt-0.5">Dự đoán hội viên gói duy trì có nguy cơ không gia hạn dựa trên tần suất check-in và hạn gói tập</p>
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
              className="h-10 w-full rounded-lg border border-border-light bg-background-light pl-9 pr-4 text-base text-text-light outline-none transition-colors placeholder:text-text-muted-light focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-background-dark/60 dark:text-text-dark dark:placeholder:text-text-muted-dark md:text-sm"
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
            className="h-10 rounded-lg border border-border-light bg-surface-light px-3 text-base font-semibold text-text-light outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark md:text-sm"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">Tất cả ({allCustomers.length})</option>
            <option value="high">Nguy cơ Cao ({data.highRisk?.length || 0})</option>
            <option value="medium">Nguy cơ Vừa ({data.mediumRisk?.length || 0})</option>
            <option value="missing">Cần rà soát hồ sơ ({data.missingData?.length || 0})</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-border-light bg-border-light dark:border-border-dark dark:bg-border-dark lg:grid-cols-4">
        {[
          { label: 'Nguy cơ cao', value: data.highRisk?.length || 0, suffix: 'hội viên', tone: 'text-rose-600 dark:text-rose-400' },
          { label: 'Nguy cơ trung bình', value: data.mediumRisk?.length || 0, suffix: 'hội viên', tone: 'text-amber-600 dark:text-amber-400' },
          { label: 'Cần rà soát', value: data.missingData?.length || 0, suffix: 'hồ sơ', tone: 'text-text-light dark:text-text-dark' },
          { label: 'Tỷ lệ an toàn', value: `${Math.round(((data.lowRisk?.length || 0) / ((allCustomers.length + (data.lowRisk?.length || 0)) || 1)) * 100)}%`, suffix: '', tone: 'text-text-light dark:text-text-dark' },
        ].map((metric) => (
          <div key={metric.label} className="bg-surface-light px-4 py-4 dark:bg-surface-dark sm:px-5">
            <p className="text-xs font-medium text-subtle-light dark:text-subtle-dark">{metric.label}</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${metric.tone}`}>
              {metric.value}{metric.suffix && <span className="ml-1 text-xs font-medium text-subtle-light dark:text-subtle-dark">{metric.suffix}</span>}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-light dark:border-border-dark bg-background-light dark:bg-surface-dark/80 text-xs font-semibold tracking-wide text-text-light dark:text-text-dark">
              <th className="p-4">Khách hàng</th>
              <th className="p-4">Mức độ nguy cơ</th>
              <th className="p-4">Thời gian vắng mặt</th>
              <th className="p-4">Gói tập còn</th>
              <th className="p-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light dark:divide-border-dark">
            {currentItems.length > 0 ? currentItems.map((customer) => (
              <tr key={customer._id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-semibold text-text-light dark:text-text-dark">{customer.name}</p>
                    <p className="text-xs font-medium text-subtle-light dark:text-subtle-dark">{customer.phone}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {customer.riskLevel === 'missing' ? (
                    <span className="inline-flex rounded-md border border-border-light bg-background-light px-2.5 py-1 text-xs font-medium text-subtle-light dark:border-border-dark dark:bg-background-dark/60 dark:text-subtle-dark">
                      Cần rà soát
                    </span>
                  ) : (
                    <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-medium ${
                      customer.riskLevel === 'high' 
                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200/50' 
                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200/50'
                    }`}>
                      {customer.riskLevel === 'high' ? 'Nguy cơ Cao' : 'Cần chú ý'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {customer.riskLevel === 'missing' ? (
                    <span className="text-purple-600 dark:text-purple-400 text-xs font-semibold">{customer.issue || 'Thiếu ngày hết hạn'}</span>
                  ) : customer.isNeverCheckedIn ? (
                    <div>
                      <span className="text-amber-600 dark:text-amber-400 text-xs font-semibold">Chưa có buổi tập đầu</span>
                      <p className="text-[11px] text-gray-400 mt-0.5">Mở gói: {customer.daysSinceStart} ngày trước</p>
                    </div>
                  ) : (
                    <div>
                      <span className={`font-bold ${customer.daysSinceLastCheckIn > 14 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {customer.daysSinceLastCheckIn} ngày
                      </span>
                      {customer.lastCheckInDate && (
                        <p className="text-[11px] text-gray-400 mt-0.5">Lần cuối: {new Date(customer.lastCheckInDate).toLocaleDateString('vi-VN')}</p>
                      )}
                    </div>
                  )}
                  {customer.engagementNote && customer.riskLevel !== 'missing' && (
                    <p className="text-[10px] text-gray-400 mt-0.5 italic">{customer.engagementNote}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  {customer.daysUntilExpiration !== null && customer.daysUntilExpiration !== undefined ? (
                    <div>
                      <span className={`font-semibold ${customer.daysUntilExpiration <= 7 ? 'text-rose-600 dark:text-rose-400' : customer.daysUntilExpiration <= 14 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        {customer.daysUntilExpiration} ngày
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Chưa xác định</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button 
                    onClick={() => handleSendReminder(customer)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border-light bg-surface-light px-3 py-1.5 text-xs font-semibold text-text-light transition-colors hover:bg-background-light dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:hover:bg-background-dark"
                  >
                    <Mail className="w-3.5 h-3.5 text-blue-500" />
                    Nhắc nhở
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5" className="p-8 text-center text-gray-400 text-xs">
                  <p className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-300">Không có cảnh báo</p>
                  <p>Không có khách hàng nào nằm trong nhóm nguy cơ này.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Phân trang */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border-light bg-background-light/60 p-4 dark:border-border-dark dark:bg-background-dark/40">
          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400">
            Trang {currentPage} / {totalPages}
          </div>
          <div className="flex gap-2">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="rounded-lg border border-border-light bg-surface-light px-3 py-1.5 text-xs font-semibold text-text-light transition-colors hover:bg-background-light disabled:cursor-not-allowed disabled:opacity-40 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:hover:bg-background-dark"
            >
              Trang trước
            </button>
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="rounded-lg border border-border-light bg-surface-light px-3 py-1.5 text-xs font-semibold text-text-light transition-colors hover:bg-background-light disabled:cursor-not-allowed disabled:opacity-40 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark dark:hover:bg-background-dark"
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
