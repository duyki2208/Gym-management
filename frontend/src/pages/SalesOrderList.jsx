import React, { useState, useEffect } from 'react';
import { posService } from '../services/productService';
import PointOfSale from './PointOfSale';
import toast from 'react-hot-toast';
import { Search, Plus, ChevronRight, ChevronDown, ChevronLeft, Download, Calendar, Filter, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

const SalesOrderList = () => {
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState({ totalAmount: 0, totalPaid: 0, totalDue: 0, totalOrders: 0 });
  const [loading, setLoading] = useState(true);

  // Filter States (Mặc định: Tháng này - Hiển thị danh sách các ngày đã bán trong tháng)
  const [search, setSearch] = useState('');
  const [preset, setPreset] = useState('thisMonth');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination State (Mỗi trang hiển thị 10 ngày)
  const [currentPage, setCurrentPage] = useState(1);
  const daysPerPage = 10;

  // UI States (Bấm vào mới mở xem chi tiết)
  const [expandedDateGroups, setExpandedDateGroups] = useState({});
  const [showPosModal, setShowPosModal] = useState(false);
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const params = {
        search,
        preset,
        startDate: preset === 'custom' ? startDate : '',
        endDate: preset === 'custom' ? endDate : ''
      };
      const data = await posService.getSales(params);
      if (data && data.success) {
        setSales(data.sales || []);
        setSummary(data.summary || { totalAmount: 0, totalPaid: 0, totalDue: 0, totalOrders: 0 });
      } else {
        setSales(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu bán hàng:', error);
      toast.error('Lỗi khi tải dữ liệu bán hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchSales();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, preset, startDate, endDate]);

  // Gom nhóm các sản phẩm bán được theo Ngày (YYYY-MM-DD)
  const groupSalesByDate = (salesList) => {
    const groupsMap = {};
    salesList.forEach(order => {
      const d = new Date(order.createdAt);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const formattedDate = `${day}/${month}/${year}`;

      if (!groupsMap[dateKey]) {
        groupsMap[dateKey] = {
          dateKey,
          formattedDate,
          orders: [],
          totalAmount: 0,
          totalPaid: 0
        };
      }
      groupsMap[dateKey].orders.push(order);
      if (order.status === 'Đã thanh toán') {
        groupsMap[dateKey].totalAmount += order.totalAmount || 0;
        groupsMap[dateKey].totalPaid += order.totalAmount || 0;
      }
    });

    // Tính toán bảng tổng hợp sản phẩm đã bán trong từng ngày
    Object.values(groupsMap).forEach(group => {
      const prodMap = {};
      group.orders.forEach(order => {
        if (order.status === 'Đã thanh toán') {
          order.details?.forEach(item => {
            const prodId = item.product?._id || item.product || 'unknown';
            const prodName = item.product?.name || 'Sản phẩm';
            const category = item.product?.category || 'Khác';
            const sellPrice = item.sellPrice || 0;
            const code = item.product?._id ? `SP${item.product._id.slice(-6).toUpperCase()}` : 'SP000001';
            const unit = category === 'Đồ uống' ? 'chai' : category === 'Thực phẩm bổ sung' ? 'hộp' : 'cái';

            if (!prodMap[prodId]) {
              prodMap[prodId] = {
                productId: prodId,
                code,
                name: prodName,
                category,
                unit,
                quantity: 0,
                sellPrice,
                totalAmount: 0
              };
            }
            prodMap[prodId].quantity += (item.quantity || 0);
            prodMap[prodId].totalAmount += (item.quantity || 0) * sellPrice;
          });
        }
      });
      group.aggregatedProducts = Object.values(prodMap);
    });

    // Sắp xếp các ngày giảm dần và loại bỏ những ngày không có doanh thu
    return Object.values(groupsMap)
      .filter(group => group.totalAmount > 0 && group.aggregatedProducts.length > 0)
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  };

  const allDateGroups = groupSalesByDate(sales);
  const totalPages = Math.ceil(allDateGroups.length / daysPerPage) || 1;
  const currentPageGroups = allDateGroups.slice((currentPage - 1) * daysPerPage, currentPage * daysPerPage);

  const toggleDateGroup = (dateKey) => {
    setExpandedDateGroups(prev => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Nhãn hiển thị mốc thời gian đang lọc
  const getFilterLabel = () => {
    switch (preset) {
      case 'today':
        return 'Hôm nay';
      case 'yesterday':
        return 'Hôm qua';
      case 'thisWeek':
        return 'Tuần này';
      case 'thisMonth':
        return `Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`;
      case 'custom':
        if (startDate && endDate) {
          return `Từ ${formatDate(startDate)} đến ${formatDate(endDate)}`;
        } else if (startDate) {
          return `Từ ngày ${formatDate(startDate)}`;
        } else if (endDate) {
          return `Đến ngày ${formatDate(endDate)}`;
        }
        return 'Theo khoảng ngày chọn';
      default:
        return 'Tháng này';
    }
  };

  // Hàm Xuất File Excel Báo Cáo Bán Hàng
  const handleExportExcel = () => {
    try {
      if (!allDateGroups || allDateGroups.length === 0) {
        toast.error('Không có dữ liệu báo cáo để xuất Excel!');
        return;
      }

      // 1. Bảng tổng hợp theo ngày
      const summaryRows = allDateGroups.map(group => ({
        'Ngày': group.formattedDate,
        'Số loại sản phẩm': group.aggregatedProducts.length,
        'Tổng số lượng bán': group.aggregatedProducts.reduce((sum, p) => sum + (p.quantity || 0), 0),
        'Doanh thu ngày (VNĐ)': group.totalAmount
      }));

      // Dòng tổng cộng
      summaryRows.push({
        'Ngày': 'TỔNG CỘNG',
        'Số loại sản phẩm': '-',
        'Tổng số lượng bán': '-',
        'Doanh thu ngày (VNĐ)': summary.totalAmount || 0
      });

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      wsSummary['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 22 }, { wch: 25 }];

      // 2. Bảng chi tiết từng sản phẩm bán
      const detailRows = [];
      allDateGroups.forEach(group => {
        group.aggregatedProducts.forEach(p => {
          detailRows.push({
            'Ngày bán': group.formattedDate,
            'Mã sản phẩm': p.code,
            'Tên sản phẩm': p.name,
            'Danh mục': p.category,
            'Số lượng': p.quantity,
            'Đơn vị': p.unit,
            'Giá bán (VNĐ)': p.sellPrice,
            'Thành tiền (VNĐ)': p.totalAmount
          });
        });
      });

      const wsDetail = XLSX.utils.json_to_sheet(detailRows);
      wsDetail['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 20 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsSummary, "Doanh Thu Theo Ngày");
      XLSX.utils.book_append_sheet(wb, wsDetail, "Chi Tiết Sản Phẩm Bán");

      const fileName = `Bao_Cao_Ban_Hang_${preset}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Xuất file Excel báo cáo bán hàng thành công!');
    } catch (error) {
      console.error('Lỗi xuất Excel:', error);
      toast.error('Lỗi khi xuất file Excel!');
    }
  };

  return (
    <div className="flex flex-col gap-5 font-display bg-transparent h-full">
      {/* ── Compact Filter Bar ── */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-4 border border-border-light dark:border-border-dark shadow-sm flex flex-wrap items-center justify-between gap-3 relative z-20">
        
        {/* Search Input (Bên trái, mở rộng rộng rãi) */}
        <div className="relative flex-1 max-w-lg min-w-[260px]">
          <Search className="absolute left-3.5 top-2.5 text-subtle-light dark:text-subtle-dark" size={17} />
          <input
            id="sales_search_input"
            name="salesSearch"
            type="text"
            aria-label="Tìm kiếm theo tên sản phẩm"
            className="w-full pl-9 pr-3 h-9 border border-border-light dark:border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 text-xs bg-surface-light dark:bg-surface-dark text-text-light dark:text-text-dark placeholder:text-subtle-light dark:placeholder:text-subtle-dark"
            placeholder="Tìm tên sản phẩm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Right: Filter "Thời gian" & Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* DATE RANGE FILTER POPOVER (Tên: Thời gian, Đặt dịch sang bên phải) */}
          <div className="relative">
            <button
              onClick={() => setShowDateDropdown(prev => !prev)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                preset !== 'thisMonth' || startDate || endDate
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'bg-surface-light dark:bg-surface-dark text-subtle-light dark:text-subtle-dark border-border-light dark:border-border-dark hover:border-primary/50 hover:text-text-light dark:hover:text-text-dark'
              }`}
            >
              <span>Thời gian</span>
              <ChevronDown size={14} className="ml-0.5 opacity-60" />
            </button>

            {showDateDropdown && (
              <div className="absolute top-full mt-2 right-0 sm:left-auto z-30 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-xl p-4 min-w-[300px] animate-fade-in space-y-4">
                {/* Mốc thời gian nhanh */}
                <div>
                  <label className="block text-xs font-bold text-text-light dark:text-text-dark mb-2">Mốc thời gian nhanh</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'thisMonth', label: 'Tháng này' },
                      { id: 'today', label: 'Hôm nay' },
                      { id: 'yesterday', label: 'Hôm qua' },
                      { id: 'thisWeek', label: 'Tuần này' }
                    ].map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setPreset(item.id);
                          setStartDate('');
                          setEndDate('');
                          setShowDateDropdown(false);
                        }}
                        className={`py-1.5 px-3 rounded-lg text-xs font-bold text-left transition-all cursor-pointer ${
                          preset === item.id && !startDate && !endDate
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : 'bg-background-light dark:bg-background-dark text-subtle-light dark:text-subtle-dark hover:bg-border-light dark:hover:bg-border-dark'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Khoảng ngày tùy chọn */}
                <div className="pt-2 border-t border-border-light dark:border-border-dark">
                  <label htmlFor="salesStartDate" className="block text-xs font-bold text-text-light dark:text-text-dark mb-2">Lọc theo ngày chọn</label>
                  <div className="flex items-center gap-2">
                    <input 
                      id="salesStartDate"
                      name="salesStartDate"
                      type="date" 
                      aria-label="Từ ngày"
                      className="w-full text-xs p-2 border border-border-light dark:border-border-dark rounded-lg outline-none focus:border-primary bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-medium" 
                      value={startDate} 
                      onChange={e => {
                        setStartDate(e.target.value);
                        setPreset('custom');
                      }} 
                      title="Từ ngày"
                    />
                    <span className="text-subtle-light dark:text-subtle-dark font-bold text-xs">-</span>
                    <input 
                      id="salesEndDate"
                      name="salesEndDate"
                      type="date" 
                      aria-label="Đến ngày"
                      className="w-full text-xs p-2 border border-border-light dark:border-border-dark rounded-lg outline-none focus:border-primary bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-medium" 
                      value={endDate} 
                      onChange={e => {
                        setEndDate(e.target.value);
                        setPreset('custom');
                      }} 
                      title="Đến ngày"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleExportExcel}
            className="flex items-center justify-center gap-1.5 h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
            title="Xuất dữ liệu ra Excel"
          >
            <FileSpreadsheet size={15} />
            <span>Xuất Excel</span>
          </button>

          <button
            onClick={() => setShowPosModal(true)}
            className="flex items-center justify-center gap-1.5 h-10 px-4 bg-primary text-text-light rounded-xl text-xs md:text-sm font-bold hover:bg-primary/90 transition-all shadow-sm cursor-pointer"
          >
            <Plus size={18} />
            <span>Đơn hàng mới</span>
          </button>
        </div>
      </div>

      {/* ── Main Sales Table (Color White/Gray, Grouped by Date & 10 Days/Page) ── */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden flex-1 flex flex-col justify-between">
        <div className="overflow-x-auto custom-scrollbar flex-1 p-4 space-y-3">
          
          {/* Summary Row */}
          <div className="bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl p-4 flex flex-wrap justify-between items-center text-sm font-bold text-text-light dark:text-text-dark">
            <div className="flex items-center gap-2">
              <span className="text-text-light dark:text-text-dark font-semibold text-sm">{getFilterLabel()}</span>
            </div>
            <div className="flex gap-6 text-right">
              <div>
                <span className="text-subtle-light dark:text-subtle-dark text-xs font-medium block">Tổng doanh thu</span>
                <span className="text-text-light dark:text-text-dark text-base font-bold">{summary.totalAmount?.toLocaleString()} đ</span>
              </div>
              <div>
                <span className="text-subtle-light dark:text-subtle-dark text-xs font-medium block">Đã thanh toán</span>
                <span className="text-text-light dark:text-text-dark text-base font-bold">{summary.totalPaid?.toLocaleString()} đ</span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-subtle-light dark:text-subtle-dark">Đang tải dữ liệu báo cáo...</div>
          ) : currentPageGroups.length > 0 ? (
            currentPageGroups.map((group) => {
              const isGroupExpanded = !!expandedDateGroups[group.dateKey];

              return (
                <div key={group.dateKey} className="border border-border-light dark:border-border-dark rounded-xl overflow-hidden bg-surface-light dark:bg-surface-dark">
                  {/* ── Header Ngày ── */}
                  <div 
                    onClick={() => toggleDateGroup(group.dateKey)}
                    className="bg-surface-light dark:bg-surface-dark px-4 py-3.5 border-b border-border-light dark:border-border-dark flex flex-wrap justify-between items-center cursor-pointer hover:bg-background-light dark:hover:bg-background-dark transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <button className="p-1 text-subtle-light dark:text-subtle-dark hover:text-text-light dark:hover:text-text-dark">
                        {isGroupExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>
                      <span className="font-semibold text-sm text-text-light dark:text-text-dark">
                        {group.formattedDate}
                      </span>
                    </div>
                    <div className="flex gap-6 text-right text-xs font-bold text-text-light dark:text-text-dark">
                      <div>
                        <span className="text-subtle-light dark:text-subtle-dark mr-2">Tổng:</span>
                        <span className="text-text-light dark:text-text-dark font-bold text-sm">{group.totalAmount?.toLocaleString()} đ</span>
                      </div>
                    </div>
                  </div>

                  {/* ── Bảng tổng hợp sản phẩm bán trong ngày (Bấm mới mở) ── */}
                  {isGroupExpanded && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-background-light dark:bg-background-dark text-subtle-light dark:text-subtle-dark font-bold border-b border-border-light dark:border-border-dark uppercase">
                          <tr>
                            <th className="py-3 px-4">Mã hàng</th>
                            <th className="py-3 px-4">Tên hàng</th>
                            <th className="py-3 px-4 text-center">Số lượng</th>
                            <th className="py-3 px-4 text-center">Đơn vị</th>
                            <th className="py-3 px-4 text-right">Giá bán</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light dark:divide-border-dark bg-surface-light dark:bg-surface-dark">
                          {group.aggregatedProducts.length > 0 ? (
                            group.aggregatedProducts.map((p, idx) => (
                              <tr key={idx} className="hover:bg-background-light dark:hover:bg-background-dark transition-colors">
                                <td className="py-3 px-4 font-bold text-text-light dark:text-text-dark">{p.code}</td>
                                <td className="py-3 px-4 font-medium text-text-light dark:text-text-dark">{p.name}</td>
                                <td className="py-3 px-4 text-center font-bold text-text-light dark:text-text-dark">{p.quantity}</td>
                                <td className="py-3 px-4 text-center text-subtle-light dark:text-subtle-dark capitalize">{p.unit}</td>
                                <td className="py-3 px-4 text-right font-bold text-text-light dark:text-text-dark">{p.sellPrice?.toLocaleString()}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="py-6 text-center text-subtle-light dark:text-subtle-dark">Không có sản phẩm nào trong ngày này.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-16 text-center text-subtle-light dark:text-subtle-dark font-bold">
              Chưa có dữ liệu bán hàng trong thời gian này.
            </div>
          )}
        </div>

        {/* ── Pagination Bar (Mỗi trang hiển thị 10 ngày) ── */}
        {allDateGroups.length > 0 && (
          <div className="p-4 bg-background-light dark:bg-background-dark border-t border-border-light dark:border-border-dark flex justify-between items-center text-sm text-text-light dark:text-text-dark font-bold">
            <div>
              Trang: {currentPage}/{totalPages}
            </div>
            <div className="flex items-center gap-2 font-normal">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-text-light dark:text-text-dark hover:bg-background-light dark:hover:bg-background-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Trang trước
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-text-light dark:text-text-dark hover:bg-background-light dark:hover:bg-background-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Trang sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── POS Modal (Khi bấm Bán Hàng Mới) ── */}
      {showPosModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-surface-light dark:bg-surface-dark rounded-xl w-full max-w-6xl h-[90vh] overflow-hidden shadow-xl flex flex-col p-4 border border-border-light dark:border-border-dark">
            <PointOfSale 
              onClose={() => {
                setShowPosModal(false);
                fetchSales();
              }}
              onFinish={() => {
                fetchSales();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesOrderList;
