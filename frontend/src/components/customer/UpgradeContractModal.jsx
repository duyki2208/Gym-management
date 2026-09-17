import React, { useState, useEffect } from 'react';
import { ArrowUpCircle, Check } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import BaseModal from '../common/BaseModal';
import FormField, { inputClassName } from '../common/FormField';
import Button from '../common/Button';

const UpgradeContractModal = ({ isOpen, onClose, customerPackage, onSuccess }) => {
  const [packages, setPackages] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [assignedStaff, setAssignedStaff] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Tiền mặt');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Nâng Cấp Hợp Đồng"
      subtitle={`Gói hiện tại: ${customerPackage.packageName} (${Number(customerPackage.price).toLocaleString()}đ)`}
      icon={<ArrowUpCircle size={22} />}
      maxWidth="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy bỏ
          </Button>
          <Button
            type="submit"
            form="upgradeContractForm"
            variant="primary"
            disabled={submitting || packages.length === 0}
          >
            {submitting ? 'Đang xử lý...' : 'Xác Nhận Nâng Cấp'}
          </Button>
        </>
      }
    >
      <form id="upgradeContractForm" onSubmit={handleSubmit} className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Đang tải danh sách gói tập...</div>
        ) : packages.length === 0 ? (
          <div className="p-6 text-center text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 text-sm font-medium">
            Hiện không có gói tập nào có mức giá cao hơn gói hiện tại để nâng cấp.
          </div>
        ) : (
          <>
            {/* Select target package */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                Chọn gói tập nâng cấp (Gói VIP / Thời hạn cao hơn)
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {packages.map((pkg) => {
                  const diff = pkg.price - customerPackage.price;
                  const isSelected = selectedPackageId === pkg._id;
                  return (
                    <div
                      key={pkg._id}
                      onClick={() => setSelectedPackageId(pkg._id)}
                      className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-text-light dark:text-primary font-bold shadow-sm'
                          : 'border-border-light dark:border-border-dark hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-primary bg-primary text-text-light font-bold' : 'border-gray-300'}`}>
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </div>
                        <div>
                          <div className="text-sm font-bold">{pkg.name}</div>
                          <div className="text-xs text-gray-400">Giá niêm yết: {Number(pkg.price).toLocaleString()}đ</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-primary bg-primary/15 px-2.5 py-0.5 rounded-full">
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
              <div className="p-4 bg-background-light dark:bg-background-dark/50 rounded-xl border border-border-light dark:border-border-dark space-y-2">
                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>Giá gói mới ({selectedPackage.name}):</span>
                  <span className="font-bold">{Number(selectedPackage.price).toLocaleString()} đ</span>
                </div>
                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>Trừ giá gói cũ đã đóng:</span>
                  <span className="font-bold text-red-500">- {Number(customerPackage.price).toLocaleString()} đ</span>
                </div>
                <div className="border-t border-border-light dark:border-border-dark pt-2 flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Số tiền đóng thêm:</span>
                  <span className="text-lg font-bold text-primary">
                    {Number(priceDiff).toLocaleString()} VNĐ
                  </span>
                </div>
              </div>
            )}

            {/* Assigned Staff (Sale) */}
            <FormField label="Nhân viên Sale tư vấn nâng cấp">
              <select
                value={assignedStaff}
                onChange={(e) => setAssignedStaff(e.target.value)}
                className={inputClassName}
              >
                <option value="">-- Chọn Nhân viên Sale --</option>
                {staffList.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.fullName || s.username} ({s.role?.toUpperCase()})
                  </option>
                ))}
              </select>
            </FormField>

            {/* Payment Method */}
            <FormField label="Hình thức thanh toán tiền chênh lệch">
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className={inputClassName}
              >
                <option value="Tiền mặt">Tiền mặt</option>
                <option value="Chuyển khoản QR">Chuyển khoản QR</option>
              </select>
            </FormField>
          </>
        )}
      </form>
    </BaseModal>
  );
};

export default UpgradeContractModal;
