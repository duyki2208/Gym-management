import React, { useState, useEffect } from 'react';
import { UserCheck, UserPlus, AlertCircle, DollarSign, Search, ShieldAlert } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

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
    if (transferMode === 'existing' && searchQuery.trim().length >= 2) {
      const delayDebounce = setTimeout(async () => {
        try {
          setSearching(true);
          const res = await api.get(`/customers?search=${encodeURIComponent(searchQuery)}`);
          const list = res.data?.data || res.data || [];
          // Loại trừ chủ hợp đồng hiện tại
          const currentCustId = typeof customerPackage?.customer === 'object' ? customerPackage.customer._id : customerPackage.customer;
          setExistingCustomers(list.filter((c) => c._id !== currentCustId));
        } catch (err) {
          console.error(err);
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
      const selectedCust = existingCustomers.find((c) => c._id === selectedCustomerId);
      if (!selectedCust?.dob && !dobForExisting) {
        toast.error('Vui lòng nhập Ngày sinh của người nhận hợp đồng');
        return;
      }
    } else {
      if (!newCustomer.name || !newCustomer.phone) {
        toast.error('Vui lòng nhập đầy đủ Họ tên và Số điện thoại của người nhận hợp đồng mới');
        return;
      }
      if (!newCustomer.dob) {
        toast.error('Ngày sinh (DOB) là bắt buộc khi tạo khách mới');
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        paymentMethod,
        note,
      };

      if (transferMode === 'existing') {
        payload.targetCustomerId = selectedCustomerId;
        if (dobForExisting) payload.dobForExisting = dobForExisting;
      } else {
        payload.newCustomer = newCustomer;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-900 w-full max-w-xl rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <UserCheck size={22} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Chuyển Nhượng Hợp Đồng</h3>
              <p className="text-xs text-gray-500 font-medium">
                Mã HĐ: <span className="font-bold text-gray-700 dark:text-gray-300">{customerPackage.contractCode || 'N/A'}</span> ({customerPackage.packageName})
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

        {!isAdmin && (
          <div className="p-4 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800 flex items-center gap-3 text-red-800 dark:text-red-300 text-xs font-bold">
            <ShieldAlert size={20} className="text-red-600 shrink-0" />
            <span>Tài khoản của bạn ({user?.fullName || user?.username || "Khách"} - Role: {user?.role || "N/A"}) không thuộc nhóm quyền Admin/Quản lý để thực hiện chuyển nhượng.</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
          {/* Mode Switcher */}
          <div>
            <label className="block text-xs font-bold uppercase text-gray-600 dark:text-gray-400 mb-2">
              Đối tượng nhận chuyển nhượng
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTransferMode('new')}
                className={`p-3 rounded-xl border text-left flex items-center gap-2 transition-all ${
                  transferMode === 'new'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-bold shadow-sm'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <UserPlus size={18} className={transferMode === 'new' ? 'text-emerald-600' : 'text-gray-400'} />
                <span className="text-sm">Tạo khách mới</span>
              </button>

              <button
                type="button"
                onClick={() => setTransferMode('existing')}
                className={`p-3 rounded-xl border text-left flex items-center gap-2 transition-all ${
                  transferMode === 'existing'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-bold shadow-sm'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <UserCheck size={18} className={transferMode === 'existing' ? 'text-emerald-600' : 'text-gray-400'} />
                <span className="text-sm">Chọn khách có sẵn</span>
              </button>
            </div>
          </div>

          {/* Mode = Existing Customer */}
          {transferMode === 'existing' && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400">
                Tìm kiếm hội viên (Theo tên/SĐT/Mã HV)
              </label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nhập tên hoặc số điện thoại..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-100 dark:divide-gray-800">
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
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span>{cust.name} ({cust.code || 'N/A'})</span>
                            {/* Badge trạng thái gói theo Rule 4 */}
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
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">✓ Đã chọn</span>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="p-3 text-center text-xs text-gray-400">
                    {searchQuery ? 'Không tìm thấy khách hàng nào' : 'Gõ từ khóa để tìm kiếm...'}
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
                    <div className="text-sm font-bold text-gray-700 dark:text-gray-300 px-3 py-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                      {new Date(selectedCustObj.dob).toLocaleDateString('vi-VN')}{' '}
                      <span className="text-xs text-green-600 font-normal ml-2">✓ Đã có trong hệ thống</span>
                    </div>
                  ) : (
                    <>
                      <input
                        type="date"
                        value={dobForExisting}
                        onChange={(e) => setDobForExisting(e.target.value)}
                        className="w-full px-3 py-2 border border-amber-300 dark:border-amber-700 rounded-xl bg-white dark:bg-gray-900 text-sm font-medium outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                        Hội viên này chưa có ngày sinh. Bắt buộc nhập để hoàn tất chuyển nhượng.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mode = New Customer Full Profile Form */}
          {transferMode === 'new' && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-200 dark:border-gray-700/60 space-y-3">
              <h4 className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400">
                Thông tin người nhận chuyển nhượng mới
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Họ và tên *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Số điện thoại *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Giới tính
                  </label>
                  <select
                    value={newCustomer.gender}
                    onChange={(e) => setNewCustomer({ ...newCustomer, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-sm font-medium"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Ngày sinh <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newCustomer.dob}
                    onChange={(e) => setNewCustomer({ ...newCustomer, dob: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-sm font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Số CCCD
                  </label>
                  <input
                    type="text"
                    value={newCustomer.identityCard}
                    onChange={(e) => setNewCustomer({ ...newCustomer, identityCard: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-sm font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-sm font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Địa chỉ
                  </label>
                  <input
                    type="text"
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-sm font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                    Người liên hệ khẩn cấp
                  </label>
                  <input
                    type="text"
                    value={newCustomer.emergencyContactName}
                    onChange={(e) => setNewCustomer({ ...newCustomer, emergencyContactName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-sm font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
                    SĐT liên hệ khẩn cấp
                  </label>
                  <input
                    type="text"
                    value={newCustomer.emergencyContactPhone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, emergencyContactPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-sm font-medium"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Payment Method for Transfer Fee */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
              Hình thức thanh toán 
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm font-medium"
            >
              <option value="Tiền mặt">Tiền mặt</option>
              <option value="Chuyển khoản QR">Chuyển khoản </option>
            </select>
          </div>

          {/* Transfer Note */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
              Ghi chú hợp đồng
            </label>
            <textarea
              rows="2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú thêm về việc chuyển nhượng..."
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

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
              disabled={submitting}
              className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-sm transition-all"
            >
              {submitting ? 'Đang xử lý...' : 'Xác Nhận Chuyển Nhượng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransferContractModal;
