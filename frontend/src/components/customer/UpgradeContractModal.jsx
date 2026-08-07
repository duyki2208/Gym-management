import React, { useState, useEffect } from 'react';
import { ArrowUpCircle, AlertCircle, Sparkles, Check } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const UpgradeContractModal = ({ isOpen, onClose, customerPackage, onSuccess }) => {
  const [packages, setPackages] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [assignedStaff, setAssignedStaff] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Tiền mặt');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (isOpen && customerPackage) {
      fetchInitialData();
    }
  }, [isOpen, customerPackage]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [pkgRes, staffRes] = await Promise.all([
        api.get('/packages'),
        api.get('/staff'),
      ]);

      const allPkgs = pkgRes.data?.data || pkgRes.data || [];
      // Lọc các gói Member (type === 'monthly') có giá cao hơn gói hiện tại
      const currentPrice = customerPackage.price || 0;
      const upgradeable = allPkgs.filter(
        (p) => (p.type === 'monthly' || p.type === 'daily' || !p.type) && p.price > currentPrice
      );

      setPackages(upgradeable);
      if (upgradeable.length > 0) {
        setSelectedPackageId(upgradeable[0]._id);
      }

      const allStaff = staffRes.data?.data || staffRes.data || [];
      const sales = allStaff.filter((s) => ['sale', 'sm', 'admin', 'manager'].includes(s.role));
      setStaffList(sales);
      if (customerPackage.assignedStaff) {
        const staffId = typeof customerPackage.assignedStaff === 'object' ? customerPackage.assignedStaff._id : customerPackage.assignedStaff;
        setAssignedStaff(staffId || '');
      }
    } catch (err) {
      toast.error('Lỗi khi tải danh sách gói tập nâng cấp');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !customerPackage) return null;

  const selectedPackage = packages.find((p) => p._id === selectedPackageId);
  const priceDiff = selectedPackage ? Math.max(0, selectedPackage.price - customerPackage.price) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPackageId) {
      toast.error('Vui lòng chọn gói tập cần nâng cấp');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post(`/customers/packages/${customerPackage._id}/upgrade`, {
        newPackageId: selectedPackageId,
        assignedStaff: assignedStaff || undefined,
        paymentMethod,
      });

      toast.success(res.data?.message || 'Nâng cấp hợp đồng thành công!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Có lỗi khi nâng cấp hợp đồng');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <ArrowUpCircle size={22} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Nâng Cấp Hợp Đồng</h3>
              <p className="text-xs text-gray-500 font-medium">
                Gói hiện tại: <span className="font-bold text-gray-700 dark:text-gray-300">{customerPackage.packageName}</span> ({Number(customerPackage.price).toLocaleString()}đ)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold px-2"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500 text-sm">Đang tải danh sách gói tập...</div>
          ) : packages.length === 0 ? (
            <div className="p-6 text-center text-amber-600 bg-amber-50 rounded-xl border border-amber-200 text-sm font-medium">
              Hiện không có gói tập nào có mức giá cao hơn gói hiện tại để nâng cấp.
            </div>
          ) : (
            <>
              {/* Select target package */}
              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 dark:text-gray-400 mb-2">
                  Chọn gói tập nâng cấp (Gói VIP / Thời hạn cao hơn)
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {packages.map((pkg) => {
                    const diff = pkg.price - customerPackage.price;
                    const isSelected = selectedPackageId === pkg._id;
                    return (
                      <div
                        key={pkg._id}
                        onClick={() => setSelectedPackageId(pkg._id)}
                        className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 font-bold shadow-sm'
                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'}`}>
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                          <div>
                            <div className="text-sm font-bold">{pkg.name}</div>
                            <div className="text-xs text-gray-500">Giá niêm yết: {Number(pkg.price).toLocaleString()}đ</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">
                            + {Number(diff).toLocaleString()}đ
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Price Breakdown Card */}
              {selectedPackage && (
                <div className="p-4 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-xl border border-blue-200 dark:border-blue-900/40 space-y-2">
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                    <span>Giá gói mới ({selectedPackage.name}):</span>
                    <span className="font-bold">{Number(selectedPackage.price).toLocaleString()} đ</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                    <span>Trừ giá gói cũ đã đóng:</span>
                    <span className="font-bold text-red-500">- {Number(customerPackage.price).toLocaleString()} đ</span>
                  </div>
                  <div className="border-t border-blue-200/60 dark:border-blue-800/60 pt-2 flex justify-between items-center">
                    <span className="text-xs font-bold text-blue-900 dark:text-blue-200 uppercase">Số tiền đóng thêm (Upsell):</span>
                    <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                      {Number(priceDiff).toLocaleString()} VNĐ
                    </span>
                  </div>
                </div>
              )}

              {/* Assigned Staff (Sale) */}
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                  Nhân viên Sale tư vấn nâng cấp
                </label>
                <select
                  value={assignedStaff}
                  onChange={(e) => setAssignedStaff(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm font-medium"
                >
                  <option value="">-- Chọn Nhân viên Sale --</option>
                  {staffList.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.fullName || s.username} ({s.role?.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                  Hình thức thanh toán tiền chênh lệch
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm font-medium"
                >
                  <option value="Tiền mặt">Tiền mặt</option>
                  <option value="Chuyển khoản QR">Chuyển khoản QR</option>
                </select>
              </div>

              
            </>
          )}

          {/* Submit buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submitting || packages.length === 0}
              className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-sm transition-all"
            >
              {submitting ? 'Đang xử lý...' : 'Xác Nhận Nâng Cấp'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UpgradeContractModal;
