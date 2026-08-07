import React, { useState, useEffect } from 'react';
import { posService } from '../services/productService';
import PointOfSale from './PointOfSale';
import toast from 'react-hot-toast';
import { Search, Plus, ChevronRight, ChevronDown, ChevronLeft } from 'lucide-react';

const SalesOrderList = () => {
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState({ totalAmount: 0, totalPaid: 0, totalDue: 0, totalOrders: 0 });
  const [loading, setLoading] = useState(true);

  // Filter States (Mặc định: Hôm nay)
  const [search, setSearch] = useState('');
  const [preset, setPreset] = useState('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination State (Mỗi trang hiển thị 10 ngày)
  const [currentPage, setCurrentPage] = useState(1);
  const daysPerPage = 10;

  // UI States (Bấm vào mới mở xem chi tiết)
  const [expandedDateGroups, setExpandedDateGroups] = useState({});
  const [showPosModal, setShowPosModal] = useState(false);

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
        return 'Tháng này';
      case 'custom':
        if (startDate && endDate) {
          return `Từ ${formatDate(startDate)} đến ${formatDate(endDate)}`;
        }
        return 'Theo ngày chọn';
      default:
        return 'Hôm nay';
    }
  };

  return (
    <div className="flex flex-col gap-6 font-display bg-transparent h-full">
      {/* ── Compact Filter Bar ── */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        
        {/* Left: Search Input */}
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3.5 top-2.5 text-gray-400" size={18} />
          <input
            type="text"
            className="w-full pl-10 pr-4 h-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-white text-gray-800 transition-colors"
            placeholder="Tìm tên sản phẩm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Center: Simplified Preset Time Dropdown */}
        <div className="flex items-center gap-2">
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            className="h-10 px-3.5 border border-gray-200 rounded-xl text-xs font-bold bg-gray-50 hover:bg-gray-100 text-gray-700 outline-none cursor-pointer focus:ring-2 focus:ring-primary"
          >
            <option value="today">Hôm nay</option>
            <option value="yesterday">Hôm qua</option>
            <option value="thisWeek">Tuần này</option>
            <option value="thisMonth">Tháng này</option>
            <option value="custom">Theo ngày chọn...</option>
          </select>

          {preset === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                className="h-10 px-2.5 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="text-gray-400 text-xs">-</span>
              <input
                type="date"
                className="h-10 px-2.5 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Right: Button Bán Hàng Mới */}
        <button
          onClick={() => setShowPosModal(true)}
          className="flex items-center justify-center gap-2 h-10 px-5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all shrink-0 shadow-md shadow-primary/20 cursor-pointer"
        >
          <Plus size={18} />
          <span>Bán Hàng Mới</span>
        </button>
      </div>

      {/* ── Main Sales Table (Color White/Gray, Grouped by Date & 10 Days/Page) ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex-1 flex flex-col justify-between">
        <div className="overflow-x-auto custom-scrollbar flex-1 p-4 space-y-3">
          
          {/* Summary Row (Chỉ hiển thị Tổng doanh thu của mốc thời gian thuộc filter đó) */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-wrap justify-between items-center text-sm font-bold text-gray-900">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 uppercase tracking-wide text-xs font-bold">
                Báo cáo doanh thu: <span className="text-gray-900 font-extrabold normal-case text-sm ml-1">{getFilterLabel()}</span>
              </span>
              <span className="text-xs text-gray-400 font-normal">({allDateGroups.length} ngày phát sinh doanh thu)</span>
            </div>
            <div className="flex gap-6 text-right">
              <div>
                <span className="text-gray-500 text-xs font-medium block">TỔNG DOANH THU</span>
                <span className="text-gray-900 text-base font-black">{summary.totalAmount?.toLocaleString()} đ</span>
              </div>
              <div>
                <span className="text-gray-500 text-xs font-medium block">ĐÃ THANH TOÁN</span>
                <span className="text-gray-900 text-base font-black">{summary.totalPaid?.toLocaleString()} đ</span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-gray-400">Đang tải dữ liệu báo cáo...</div>
          ) : currentPageGroups.length > 0 ? (
            currentPageGroups.map((group) => {
              const isGroupExpanded = !!expandedDateGroups[group.dateKey];

              return (
                <div key={group.dateKey} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                  {/* ── Header Báo Cáo Ngày (Chỉ hiển thị thông tin báo cáo sản phẩm ngày) ── */}
                  <div 
                    onClick={() => toggleDateGroup(group.dateKey)}
                    className="bg-white px-4 py-3.5 border-b border-gray-200 flex flex-wrap justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <button className="p-1 text-gray-500 hover:text-gray-800">
                        {isGroupExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>
                      <span className="font-extrabold text-sm text-gray-900">
                        Báo cáo ngày {group.formattedDate}
                      </span>
                      <span className="text-xs text-gray-500 font-medium">
                        ({group.aggregatedProducts.length} loại sản phẩm)
                      </span>
                    </div>
                    <div className="flex gap-6 text-right text-xs font-bold text-gray-800">
                      <div>
                        <span className="text-gray-500 mr-2">Doanh thu ngày:</span>
                        <span className="text-gray-900 font-black text-sm">{group.totalAmount?.toLocaleString()} đ</span>
                      </div>
                    </div>
                  </div>

                  {/* ── Bảng tổng hợp sản phẩm bán trong ngày (Bấm mới mở) ── */}
                  {isGroupExpanded && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200 uppercase">
                          <tr>
                            <th className="py-3 px-4">Mã hàng</th>
                            <th className="py-3 px-4">Tên hàng</th>
                            <th className="py-3 px-4 text-center">Số lượng</th>
                            <th className="py-3 px-4 text-center">Đơn vị</th>
                            <th className="py-3 px-4 text-right">Giá bán</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {group.aggregatedProducts.length > 0 ? (
                            group.aggregatedProducts.map((p, idx) => (
                              <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                <td className="py-3 px-4 font-bold text-gray-900">{p.code}</td>
                                <td className="py-3 px-4 font-medium text-gray-800">{p.name}</td>
                                <td className="py-3 px-4 text-center font-bold text-gray-900">{p.quantity}</td>
                                <td className="py-3 px-4 text-center text-gray-500 capitalize">{p.unit}</td>
                                <td className="py-3 px-4 text-right font-bold text-gray-900">{p.sellPrice?.toLocaleString()}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="py-6 text-center text-gray-400">Không có sản phẩm nào trong ngày này.</td>
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
            <div className="py-16 text-center text-gray-400 font-bold">
              Chưa có dữ liệu bán hàng trong thời gian này.
            </div>
          )}
        </div>

        {/* ── Pagination Bar (Mỗi trang hiển thị 10 ngày) ── */}
        {allDateGroups.length > 0 && (
          <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center text-xs text-gray-600">
            <div>
              Hiển thị <span className="font-bold text-gray-900">{currentPageGroups.length}</span> / <span className="font-bold text-gray-900">{allDateGroups.length}</span> ngày báo cáo
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronLeft size={14} /> Trước
              </button>
              <span className="font-bold px-2 text-gray-800">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Sau <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── POS Modal (Khi bấm Bán Hàng Mới) ── */}
      {showPosModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-6xl h-[90vh] overflow-hidden shadow-2xl flex flex-col p-4">
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
