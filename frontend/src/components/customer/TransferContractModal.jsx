import React, { useState, useEffect } from 'react';
import { UserCheck, UserPlus, Search, ShieldAlert, CheckCircle } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import BaseModal from '../common/BaseModal';
import FormField, { inputClassName } from '../common/FormField';
import Button from '../common/Button';

const TransferContractModal = ({ isOpen, onClose, customerPackage, onSuccess }) => {
  const [user, setUser] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);

  const [transferMode, setTransferMode] = useState('new'); // 'new' | 'existing'
  const [existingCustomers, setExistingCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  // Form Khách mới B
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    dob: '',
    gender: 'Nam',
    email: '',
    address: '',
    identityCard: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  });

  const [paymentMethod, setPaymentMethod] = useState('Tiền mặt');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [dobForExisting, setDobForExisting] = useState('');

  useEffect(() => {
    if (isOpen) {
      try {
        const u = JSON.parse(localStorage.getItem('gym_user') || localStorage.getItem('user') || '{}');
        setUser(u);
        const roleStr = (u.role || '').toLowerCase();
        const allowed = ['admin', 'manager', 'accountant', 'sm', 'pm', 'om'];
        setIsAdmin(allowed.includes(roleStr));
      } catch (e) {
        setIsAdmin(false);
      }
      setTransferMode('new');
      setSelectedCustomerId('');
      setSearchQuery('');
      setNote('');
      setPaymentMethod('Tiền mặt');
      setDobForExisting('');
      setNewCustomer({
        name: '',
        phone: '',
        dob: '',
        gender: 'Nam',
        email: '',
        address: '',
        identityCard: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
      });
    }
  }, [isOpen]);

  // Tìm kiếm khách hàng có sẵn
  useEffect(() => {
    if (transferMode === 'existing') {
      const q = searchQuery.trim();
      if (!q) {
        setExistingCustomers([]);
        setSearching(false);
        return;
      }

      const delayDebounce = setTimeout(async () => {
        try {
          setSearching(true);
          const res = await api.get(`/customers?search=${encodeURIComponent(q)}`);
          const list = res.data?.customers || res.data?.data || (Array.isArray(res.data) ? res.data : []);
          const currentCustId = typeof customerPackage?.customer === 'object' ? customerPackage.customer._id : customerPackage.customer;
          setExistingCustomers(list.filter((c) => c._id !== currentCustId));
        } catch (err) {
          console.error('Lỗi tìm kiếm khách hàng:', err);
        } finally {
          setSearching(false);
        }
      }, 300);

      return () => clearTimeout(delayDebounce);
    }
  }, [searchQuery, transferMode, customerPackage]);

  if (!isOpen || !customerPackage) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    const u = JSON.parse(localStorage.getItem('gym_user') || localStorage.getItem('user') || '{}');
    const roleStr = (u.role || '').toLowerCase();
    const allowed = ['admin', 'manager', 'accountant', 'sm', 'pm', 'om'];
    if (!allowed.includes(roleStr)) {
      toast.error(`Tài khoản hiện tại (${u.fullName || u.username || 'Khách'} - Role: ${u.role || 'Không xác định'}) không có quyền thực hiện chuyển nhượng hợp đồng.`);
      return;
    }

    if (transferMode === 'existing') {
      if (!selectedCustomerId) {
        toast.error('Vui lòng chọn người nhận hợp đồng từ danh sách');
        return;
      }
      const targetCust = existingCustomers.find((c) => c._id === selectedCustomerId);
      if (!targetCust?.dob && !dobForExisting) {
        toast.error('Hội viên này chưa có thông tin ngày sinh! Vui lòng nhập ngày sinh để tiếp tục.');
        return;
      }
    } else {
      if (!newCustomer.name || !newCustomer.phone || !newCustomer.dob) {
        toast.error('Vui lòng điền đầy đủ: Họ tên, SĐT và Ngày sinh của người nhận');
        return;
      }
    }

    try {
      setSubmitting(true);
      let payload = {
        transferMode,
        paymentMethod,
        note,
      };

      if (transferMode === 'existing') {
        payload.targetCustomerId = selectedCustomerId;
        if (dobForExisting) {
          payload.targetCustomerDob = dobForExisting;
        }
      } else {
        payload.newCustomerData = newCustomer;
      }

      const res = await api.post(`/customers/packages/${customerPackage._id}/transfer`, payload);
      toast.success(res.data?.message || 'Chuyển nhượng hợp đồng thành công!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Có lỗi khi chuyển nhượng hợp đồng');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCustObj = existingCustomers.find((c) => c._id === selectedCustomerId);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Chuyển Nhượng Hợp Đồng"
      subtitle={`Mã HĐ: ${customerPackage.contractCode || 'N/A'} (${customerPackage.packageName})`}
      icon={<UserCheck size={22} />}
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy bỏ
          </Button>
          <Button
            type="submit"
            form="transferContractForm"
            variant="primary"
            disabled={submitting}
            icon={CheckCircle}
          >
            {submitting ? 'Đang xử lý...' : 'Xác Nhận Chuyển Nhượng'}
          </Button>
        </>
      }
    >
      {!isAdmin && (
        <div className="p-3.5 mb-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-800 dark:text-red-300 text-xs font-bold">
          <ShieldAlert size={20} className="text-red-600 shrink-0" />
          <span>Tài khoản của bạn ({user?.fullName || user?.username || "Khách"} - Role: {user?.role || "N/A"}) không thuộc nhóm quyền Admin/Quản lý để thực hiện chuyển nhượng.</span>
        </div>
      )}

      <form id="transferContractForm" onSubmit={handleSubmit} className="space-y-5">
        {/* Mode Switcher */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Đối tượng nhận chuyển nhượng
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTransferMode('new')}
              className={`p-3 rounded-xl border text-left flex items-center gap-2 transition-all ${
                transferMode === 'new'
                  ? 'border-primary bg-primary/10 text-text-light dark:text-primary font-bold shadow-sm'
                  : 'border-border-light dark:border-border-dark text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <UserPlus size={18} className={transferMode === 'new' ? 'text-primary' : 'text-gray-400'} />
              <span className="text-sm">Tạo khách mới</span>
            </button>

            <button
              type="button"
              onClick={() => setTransferMode('existing')}
              className={`p-3 rounded-xl border text-left flex items-center gap-2 transition-all ${
                transferMode === 'existing'
                  ? 'border-primary bg-primary/10 text-text-light dark:text-primary font-bold shadow-sm'
                  : 'border-border-light dark:border-border-dark text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <UserCheck size={18} className={transferMode === 'existing' ? 'text-primary' : 'text-gray-400'} />
              <span className="text-sm">Chọn khách có sẵn</span>
            </button>
          </div>
        </div>

        {/* Mode = Existing Customer */}
        {transferMode === 'existing' && (
          <div className="space-y-3">
            <FormField label="Tìm kiếm hội viên (Theo tên / SĐT / Mã HV)">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nhập tên hoặc số điện thoại..."
                  className={`${inputClassName} pl-9`}
                />
              </div>
            </FormField>

            <div className="max-h-48 overflow-y-auto border border-border-light dark:border-border-dark rounded-xl divide-y divide-border-light dark:divide-border-dark custom-scrollbar">
              {searching ? (
                <div className="p-3 text-center text-xs text-gray-400">Đang tìm kiếm...</div>
              ) : existingCustomers.length > 0 ? (
                existingCustomers.map((cust) => {
                  const hasActivePkg = cust.hasActivePackage || (cust.packages && cust.packages.some((p) => p.status === 'active'));
                  return (
                    <div
                      key={cust._id}
                      onClick={() => setSelectedCustomerId(cust._id)}
                      className={`p-3 text-sm cursor-pointer flex justify-between items-center transition-colors ${
                        selectedCustomerId === cust._id
                          ? 'bg-primary/10 text-text-light dark:text-primary font-bold'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span>{cust.name} ({cust.code || 'N/A'})</span>
                          {!hasActivePkg ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              Không có gói active
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800">
                              Đang có gói active
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 font-normal mt-0.5">{cust.phone} - {cust.email || 'Không có email'}</div>
                      </div>
                      {selectedCustomerId === cust._id && (
                        <span className="text-xs text-primary font-bold">✓ Đã chọn</span>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-gray-400 font-medium">
                  {searchQuery.trim() ? 'Không tìm thấy khách hàng nào' : 'Vui lòng nhập tên, SĐT hoặc mã hội viên để tìm kiếm...'}
                </div>
              )}
            </div>

            {/* Field DOB bắt buộc khi đã chọn khách có sẵn */}
            {selectedCustomerId && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/50">
                <label className="block text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">
                  Ngày sinh người nhận{' '}
                  {!selectedCustObj?.dob && <span className="text-red-500">*</span>}
                </label>
                {selectedCustObj?.dob ? (
                  <div className="text-sm font-bold text-gray-700 dark:text-gray-300 px-3 py-2 bg-white dark:bg-gray-900 rounded-xl border border-border-light dark:border-border-dark">
                    {new Date(selectedCustObj.dob).toLocaleDateString('vi-VN')}{' '}
                    <span className="text-xs text-green-600 font-normal ml-2">✓ Đã có trong hệ thống</span>
                  </div>
                ) : (
                  <>
                    <input
                      type="date"
                      value={dobForExisting}
                      onChange={(e) => setDobForExisting(e.target.value)}
                      className={inputClassName}
                    />
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                      Hội viên này chưa có ngày sinh trong hồ sơ. Vui lòng bổ sung để hoàn tất chuyển nhượng.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Mode = New Customer Full Profile Form */}
        {transferMode === 'new' && (
          <div className="p-4 bg-background-light dark:bg-background-dark/50 rounded-xl border border-border-light dark:border-border-dark space-y-3">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-border-light dark:border-border-dark pb-2">
              Thông tin người nhận chuyển nhượng mới
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Họ và tên" required>
                <input
                  type="text"
                  required
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  className={inputClassName}
                />
              </FormField>

              <FormField label="Số điện thoại" required>
                <input
                  type="text"
                  required
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  className={inputClassName}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Giới tính">
                <select
                  value={newCustomer.gender}
                  onChange={(e) => setNewCustomer({ ...newCustomer, gender: e.target.value })}
                  className={inputClassName}
                >
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                  <option value="Khác">Khác</option>
                </select>
              </FormField>

              <FormField label="Ngày sinh" required>
                <input
                  type="date"
                  required
                  value={newCustomer.dob}
                  onChange={(e) => setNewCustomer({ ...newCustomer, dob: e.target.value })}
                  className={inputClassName}
                />
              </FormField>

              <FormField label="Số CCCD">
                <input
                  type="text"
                  value={newCustomer.identityCard}
                  onChange={(e) => setNewCustomer({ ...newCustomer, identityCard: e.target.value })}
                  className={inputClassName}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Email">
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  className={inputClassName}
                />
              </FormField>

              <FormField label="Địa chỉ">
                <input
                  type="text"
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  className={inputClassName}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Người liên hệ khẩn cấp">
                <input
                  type="text"
                  placeholder="Họ tên người thân"
                  value={newCustomer.emergencyContactName}
                  onChange={(e) => setNewCustomer({ ...newCustomer, emergencyContactName: e.target.value })}
                  className={inputClassName}
                />
              </FormField>

              <FormField label="SĐT người liên hệ khẩn cấp">
                <input
                  type="text"
                  placeholder="Số điện thoại"
                  value={newCustomer.emergencyContactPhone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, emergencyContactPhone: e.target.value })}
                  className={inputClassName}
                />
              </FormField>
            </div>
          </div>
        )}

        {/* Payment Method for Transfer Fee */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Hình thức thanh toán phí">
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className={inputClassName}
            >
              <option value="Tiền mặt">Tiền mặt</option>
              <option value="Chuyển khoản QR">Chuyển khoản QR</option>
            </select>
          </FormField>

          <FormField label="Ghi chú chuyển nhượng">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú thêm..."
              className={inputClassName}
            />
          </FormField>
        </div>
      </form>
    </BaseModal>
  );
};

export default TransferContractModal;
