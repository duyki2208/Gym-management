import React, { useState, useEffect } from 'react';
import { Snowflake, AlertCircle, CheckCircle, DollarSign } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import BaseModal from '../common/BaseModal';
import FormField, { inputClassName } from '../common/FormField';
import Button from '../common/Button';

const FreezeContractModal = ({ isOpen, onClose, customerPackage, onSuccess }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reasonType, setReasonType] = useState('medical'); // medical (miễn phí) | other (thu phí)
  const [reasonNote, setReasonNote] = useState('');
  const [freezeFee, setFreezeFee] = useState(200000);
  const [paymentMethod, setPaymentMethod] = useState('Tiền mặt');
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
    if (isOpen) {
      const today = new Date().toISOString().split('T')[0];
      const defaultEnd = new Date();
      defaultEnd.setDate(defaultEnd.getDate() + 30);
      setStartDate(today);
      setEndDate(defaultEnd.toISOString().split('T')[0]);
      setReasonType('medical');
      setReasonNote('');
      setFreezeFee(200000);
      setPaymentMethod('Tiền mặt');
    }
  }, [isOpen]);

  if (!isOpen || !customerPackage) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast.error('Vui lòng chọn đầy đủ ngày bắt đầu và kết thúc bảo lưu');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post(`/customers/packages/${customerPackage._id}/freeze`, {
        startDate,
        endDate,
        reasonType,
        reason: reasonNote || (reasonType === 'medical' ? 'Lý do sức khỏe/y tế' : 'Bảo lưu cá nhân'),
        freezeFee: reasonType === 'medical' ? 0 : Number(freezeFee),
        paymentMethod,
      });

      toast.success(res.data?.message || 'Tạm dừng hợp đồng thành công!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Có lỗi khi tạm dừng hợp đồng');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Bảo Lưu Hợp Đồng"
      subtitle={`HĐ: ${customerPackage.contractCode || 'N/A'} - ${customerPackage.packageName}`}
      icon={<Snowflake size={22} />}
      maxWidth="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy bỏ
          </Button>
          <Button
            type="submit"
            form="freezeContractForm"
            variant="primary"
            disabled={submitting}
          >
            {submitting ? 'Đang xử lý...' : 'Xác Nhận Bảo Lưu'}
          </Button>
        </>
      }
    >
      <form id="freezeContractForm" onSubmit={handleSubmit} className="space-y-4">
          {/* Reason Category selection */}
          <div>
            <label className="block text-xs font-bold uppercase text-gray-600 dark:text-gray-400 mb-2">
              Lý do bảo lưu
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setReasonType('medical')}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  reasonType === 'medical'
                    ? 'border-green-500 bg-green-50/50 dark:bg-green-950/30 text-green-900 dark:text-green-200 font-bold shadow-sm'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <span className="flex items-center gap-1.5 text-sm">
                  <CheckCircle size={16} className={reasonType === 'medical' ? 'text-green-600' : 'text-gray-400'} />
                  Y tế / Bệnh tật
                </span>
                <span className="text-[11px] text-green-600 dark:text-green-400 font-semibold">Miễn phí bảo lưu</span>
              </button>

              <button
                type="button"
                onClick={() => setReasonType('other')}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  reasonType === 'other'
                    ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 text-purple-900 dark:text-purple-200 font-bold shadow-sm'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <span className="flex items-center gap-1.5 text-sm">
                  <DollarSign size={16} className={reasonType === 'other' ? 'text-purple-600' : 'text-gray-400'} />
                  Lý do cá nhân
                </span>
                <span className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold">Có thu phí dịch vụ</span>
              </button>
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                Từ ngày
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm font-medium focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                Đến ngày
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm font-medium focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
          </div>

          {/* If Paid Reason -> Fee & Payment method */}
          {reasonType === 'other' && (
            <div className="p-3.5 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-100 dark:border-purple-900/30 space-y-3">
              <div>
                <label className="block text-xs font-bold text-purple-900 dark:text-purple-300 mb-1">
                  Mức phí dịch vụ bảo lưu (VNĐ)
                </label>
                <input
                  type="number"
                  min="0"
                  step="10000"
                  value={freezeFee}
                  onChange={(e) => setFreezeFee(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-purple-200 dark:border-purple-800 rounded-xl bg-white dark:bg-gray-900 text-sm font-bold text-purple-700 dark:text-purple-300"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-900 dark:text-purple-300 mb-1">
                  Hình thức thanh toán
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-purple-200 dark:border-purple-800 rounded-xl bg-white dark:bg-gray-900 text-sm font-medium"
                >
                  <option value="Tiền mặt">Tiền mặt</option>
                  <option value="Chuyển khoản QR">Chuyển khoản QR</option>
                </select>
              </div>
            </div>
          )}

          {/* Reason note */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
              Ghi chú lý do chi tiết
            </label>
            <textarea
              rows="2"
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
              placeholder="VD: Nghỉ chấn thương tay, đi công tác 1 tháng..."
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
            />
          </div>

          

        </form>
    </BaseModal>
  );
};

export default FreezeContractModal;
