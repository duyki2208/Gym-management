import React, { useEffect, useState } from 'react';
import reportService from '../services/reportService';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Download, Users, DollarSign, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight, Package, ShoppingCart } from 'lucide-react';
import * as XLSX from 'xlsx';
import ChurnPrediction from '../components/report/ChurnPrediction';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF5733', '#C70039'];

const Reports = () => {
  const [summary, setSummary] = useState({ totalRevenue: 0, activeMembers: 0, newMembers: 0, retentionRate: 0, churnRate: 0 });
  const [revenueData, setRevenueData] = useState([]);
  const [packageData, setPackageData] = useState([]);
  const [expiringMembers, setExpiringMembers] = useState([]);
  const [inventoryData, setInventoryData] = useState({ posRevenue: 0, totalStockValue: 0, lowStockProducts: [] });
  const [activeTab, setActiveTab] = useState("business");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [summaryRes, revenueRes, packageRes, expiringRes, invRes] = await Promise.all([
        reportService.getSummary(),
        reportService.getRevenueChart(),
        reportService.getPackageDistribution(),
        reportService.getExpiringMembers(),
        reportService.getInventoryReport()
      ]);

      setSummary(summaryRes);
      setRevenueData(revenueRes);
      setPackageData(packageRes);
      setExpiringMembers(expiringRes);
      setInventoryData(invRes);
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    try {
      // 1. Fetch details data
      const details = await reportService.getRevenueDetails();
      
      // 2. Format structure for Excel
      const excelData = details.map((item, index) => ({
        "STT": index + 1,
        "Mã KH": item.customerId || `KH-${item._id.substring(item._id.length - 4)}`, // Fallback
        "Tên Khách Hàng": item.name,
        "SĐT": item.phone,
        "Tên Gói Tập": item.packageType,
        "Kích Hoạt": new Date(item.startDate).toLocaleDateString("vi-VN"),
        "Hết Hạn": new Date(item.endDate).toLocaleDateString("vi-VN"),
        "Thành Tiền (VNĐ)": item.price
      }));

      // Calculate total revenue
      const totalAmount = excelData.reduce((sum, item) => sum + (item["Thành Tiền (VNĐ)"] || 0), 0);

      // 3. Create Worksheet from array of objects
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Append Summary row
      XLSX.utils.sheet_add_aoa(ws, [
        ['Tổng', '', '', '', '', '', '', totalAmount]
      ], { origin: -1 }); // append to bottom

      // Set some column widths
      ws['!cols'] = [
        { wch: 5 },  // STT
        { wch: 15 }, // Mã KH
        { wch: 25 }, // Tên KH
        { wch: 15 }, // SDT
        { wch: 20 }, // Tên Package
        { wch: 15 }, // Kich hoat
        { wch: 15 }, // Het han
        { wch: 20 }, // Thanh Tien
      ];

      // 4. Create Workbook and add Worksheet
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Doanh Thu");

      // 5. Generate and download file
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      XLSX.writeFile(wb, `BaoCao_DoanhThu_T${currentMonth}_${currentYear}.xlsx`);

    } catch (error) {
      console.error("Export Excel error", error);
      // toast handled by api.js
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Đang tải báo cáo...</div>;
  }

  // Tùy chỉnh Y-axis ticks cho doanh thu: 0, 50tr, 100tr...
  const revenueTicks = [0, 50000000, 100000000, 150000000, 200000000];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button 
           className={`py-3 px-6 font-bold border-b-2 transition-colors ${activeTab === 'business' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
           onClick={() => setActiveTab('business')}
        >
           Kinh Doanh & Khách Hàng
        </button>
        <button 
           className={`py-3 px-6 font-bold border-b-2 transition-colors ${activeTab === 'inventory' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
           onClick={() => setActiveTab('inventory')}
        >
           Kho Hàng & Bán Lẻ
        </button>
        <button 
           className={`py-3 px-6 font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'churn' ? 'border-red-500 text-red-500' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
           onClick={() => setActiveTab('churn')}
        >
           <AlertTriangle size={18} className={activeTab === 'churn' ? 'text-red-500' : 'text-gray-400'}/> Dự đoán Rời bỏ
        </button>
      </div>

      {activeTab === 'business' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button 
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-medium"
            >
              <Download size={18} /> Xuất Excel Doanh Thu
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Doanh thu tháng này</p>
                <p className="text-2xl font-bold text-green-600">{summary.totalRevenue.toLocaleString()} VND</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full text-green-600">
                <DollarSign size={24} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Thành viên đang tập</p>
                <p className="text-2xl font-bold text-blue-600">{summary.activeMembers}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                <Users size={24} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Khách mới (Tháng này)</p>
                <p className="text-2xl font-bold text-purple-600">{summary.newMembers}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full text-purple-600">
                <TrendingUp size={24} />
              </div>
            </div>
          </div>

          {/* Member Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
               <div>
                 <p className="text-gray-500 text-sm font-medium mb-1">Tỷ lệ giữ chân</p>
                 <div className="flex items-center gap-2">
                   <p className="text-3xl font-bold text-green-600">{summary.retentionRate}%</p>
                   <span className="flex items-center text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full"><ArrowUpRight size={16}/> Tích cực</span>
                 </div>
                 <p className="text-xs text-gray-400 mt-2">Dựa trên tỷ lệ khách hàng còn Active/Tổng khách hàng</p>
               </div>
             </div>

             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
               <div>
                 <p className="text-gray-500 text-sm font-medium mb-1">Tỷ lệ rời bỏ</p>
                 <div className="flex items-center gap-2">
                   <p className="text-3xl font-bold text-red-600">{summary.churnRate}%</p>
                   <span className="flex items-center text-sm text-red-600 bg-red-50 px-2 py-1 rounded-full"><ArrowDownRight size={16}/> Cần chú ý</span>
                 </div>
                 <p className="text-xs text-gray-400 mt-2">Phần trăm khách hàng đã hết hạn và chưa gia hạn</p>
               </div>
             </div>
          </div>

          {/* Revenue Chart Section */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Biểu Đồ Doanh Thu</h2>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" />
                  <YAxis 
                    ticks={revenueTicks}
                    tickFormatter={(value) => new Intl.NumberFormat('vi-VN', { notation: "compact", compactDisplay: "short" }).format(value)}
                    domain={[0, 200000000]} 
                  />
                  <Tooltip formatter={(value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)} />
                  <Legend />
                  <Bar 
                    dataKey="revenue" 
                    fill="#3b82f6" 
                    radius={[4, 4, 0, 0]} 
                    name="Doanh Thu"
                    barSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Package Distribution */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold mb-6 text-gray-800">Tỷ Lệ Gói Tập</h2>
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="w-full md:w-1/3 space-y-4">
                 {packageData.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        ></div>
                        <span className="font-medium text-gray-700">{entry.name}</span>
                      </div>
                    </div>
                 ))}
              </div>

              <div className="w-full md:w-2/3 h-[300px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                  <PieChart>
                    <Pie
                      data={packageData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={120}
                      fill="#8884d8"
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    >
                      {packageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Expiring Members */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="text-orange-500" />
              <h2 className="text-xl font-bold text-gray-800">Sắp Hết Hạn (Trong 14 ngày tới)</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="p-3 font-medium text-gray-600">Khách Hàng</th>
                    <th className="p-3 font-medium text-gray-600">Số Điện Thoại</th>
                    <th className="p-3 font-medium text-gray-600">Gói Tập</th>
                    <th className="p-3 font-medium text-gray-600">Ngày Hết Hạn</th>
                    <th className="p-3 font-medium text-gray-600">Buổi Còn Lại</th>
                  </tr>
                </thead>
                <tbody>
                  {expiringMembers.length > 0 ? (
                    expiringMembers.map((member) => (
                      <tr key={member._id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <div className="font-medium text-gray-800">{member.name}</div>
                        </td>
                        <td className="p-3">{member.phone}</td>
                        <td className="p-3">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                            {member.packageType}
                          </span>
                        </td>
                        <td className="p-3 text-red-600 font-bold">
                          {new Date(member.endDate).toLocaleDateString("vi-VN")}
                        </td>
                        <td className="p-3 font-semibold">{member.remainingSessions}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="p-4 text-center text-gray-500">
                        Không có thành viên nào sắp hết hạn trong 14 ngày tới.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Doanh thu POS (Tháng này)</p>
                <p className="text-2xl font-bold text-green-600">{inventoryData.posRevenue.toLocaleString()} VND</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full text-green-600">
                <ShoppingCart size={24} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Tổng giá trị tồn kho</p>
                <p className="text-2xl font-bold text-blue-600">{inventoryData.totalStockValue.toLocaleString()} VND</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                <Package size={24} />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="text-orange-500" />
              <h2 className="text-xl font-bold text-gray-800">Sản Phẩm Sắp Hết Hàng (Tồn kho {"<="} 5)</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="p-3 font-medium text-gray-600">Mã SP</th>
                    <th className="p-3 font-medium text-gray-600">Tên Sản Phẩm</th>
                    <th className="p-3 font-medium text-gray-600">Danh Mục</th>
                    <th className="p-3 font-medium text-gray-600">Giá Bán</th>
                    <th className="p-3 font-medium text-gray-600">Tồn Kho</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryData.lowStockProducts.length > 0 ? (
                    inventoryData.lowStockProducts.map((product) => (
                      <tr key={product._id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-600">{product.productCode}</td>
                        <td className="p-3 text-gray-800 font-bold">{product.name}</td>
                        <td className="p-3 text-gray-600">{product.category}</td>
                        <td className="p-3 text-gray-800">{product.sellPrice.toLocaleString()} đ</td>
                        <td className="p-3">
                          <span className={`px-3 py-1 rounded-full text-sm font-bold ${product.stockQuantity === 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                            {product.stockQuantity}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="p-4 text-center text-gray-500">
                        Không có sản phẩm nào sắp hết hàng.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'churn' && (
        <ChurnPrediction />
      )}
    </div>
  );
};

export default Reports;
