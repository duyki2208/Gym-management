import React, { useEffect, useState } from 'react';
import { User, X, CheckCircle, AlertTriangle, XCircle, Clock, CalendarDays, Package, AlertCircle, ShieldCheck } from 'lucide-react';
import { getCustomerStatus } from '../../utils/dateUtils';

const CheckInSuccessPopup = ({ customer, onClose }) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const timer = setTimeout(() => { onClose(); }, 10000);

    // Đếm ngược progress bar
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev <= 0) return 0;
        return prev - (100 / 100); // 10s = 100 steps mỗi 100ms
      });
    }, 100);

    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [onClose]);

  if (!customer) return null;

  const status = getCustomerStatus(customer.startDate, customer.endDate);
  const daysLeft = customer.endDate 
    ? Math.max(0, Math.ceil((new Date(customer.endDate) - new Date()) / (1000 * 60 * 60 * 24)))
    : 0;

  // Màu sắc dựa theo trạng thái, hoà với theme xanh lá của project
  let statusBadgeClass = "bg-green-100 text-green-700 border-green-200";
  let statusIcon = <ShieldCheck size={14} className="text-green-600" />;
  let statusLabel = "CHECK-IN THÀNH CÔNG";
  let leftAccentClass = "bg-green-500";
  let progressBarClass = "bg-green-500";

  if (status.status === "expired") {
    statusBadgeClass = "bg-red-100 text-red-700 border-red-200";
    statusIcon = <XCircle size={14} className="text-red-600" />;
    statusLabel = "GÓI TẬP HẾT HẠN";
    leftAccentClass = "bg-red-500";
    progressBarClass = "bg-red-500";
  } else if (status.status === "expiring") {
    statusBadgeClass = "bg-yellow-100 text-yellow-700 border-yellow-200";
    statusIcon = <AlertTriangle size={14} className="text-yellow-600" />;
    statusLabel = "THÀNH CÔNG - CẦN GIA HẠN";
    leftAccentClass = "bg-yellow-500";
    progressBarClass = "bg-yellow-500";
  }

  return (
    <div className="pointer-events-auto w-[520px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700 font-display animate-in slide-in-from-right-10 duration-500">
      {/* Progress bar đếm ngược */}
      <div className="w-full h-1 bg-gray-100 dark:bg-gray-700">
        <div
          className={`h-full ${progressBarClass} transition-all ease-linear duration-100 origin-left`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex">
        {/* Thanh accent trái */}
        <div className={`w-1.5 flex-shrink-0 ${leftAccentClass}`} />

        {/* NỘI DUNG CHÍNH */}
        <div className="flex flex-1 min-w-0">

          {/* CỘT TRÁI: ẢNH HỘI VIÊN */}
          <div className="flex-shrink-0 w-44 bg-gray-50 dark:bg-gray-900/50 flex flex-col items-center justify-center p-4 border-r border-gray-100 dark:border-gray-700">
            <div className="w-32 h-32 rounded-2xl overflow-hidden bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 shadow-md mb-3 flex-shrink-0">
              {customer.avatar && customer.avatar !== "👤" ? (
                <img src={customer.avatar} alt={customer.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                  <User size={52} />
                </div>
              )}
            </div>
            {/* Badge trạng thái nằm dưới ảnh */}
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-bold ${statusBadgeClass}`}>
              {statusIcon}
              {status.label}
            </div>
          </div>

          {/* CỘT PHẢI: THÔNG TIN */}
          <div className="flex-1 min-w-0 p-4 flex flex-col justify-between">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-green-600 uppercase tracking-widest mb-0.5">{statusLabel}</p>
                <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 leading-tight truncate">
                  {customer.name}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                  {customer.code && <span>{customer.code} · </span>}
                  {customer.gender || 'N/A'}
                  {customer.dob ? ` · ${new Date().getFullYear() - new Date(customer.dob).getFullYear()} tuổi` : ''}
                </p>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Thông tin chi tiết dạng InfoRow giống CustomerDetailModal */}
            <div className="space-y-2 flex-1">
              {/* Gói tập */}
              <div className="flex flex-col gap-0.5 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <Package size={11} /> Gói Tập
                </span>
                <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm truncate" title={customer.packageType}>
                  {customer.packageType || '—'}
                </span>
              </div>

              {/* Hàng 2: Thời hạn + Check-in time */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-0.5 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <CalendarDays size={11} /> Còn lại
                  </span>
                  <span className={`font-bold text-sm ${daysLeft <= 7 ? 'text-red-600' : daysLeft <= 14 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {status.status === "expired" ? "Hết hạn" : `${daysLeft} ngày`}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <Clock size={11} /> Thời gian
                  </span>
                  <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
                    {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>

            {/* Cảnh báo sức khỏe (nếu có) */}
            {customer.healthNote && (
              <div className="mt-2 flex items-start gap-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40">
                <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 dark:text-red-300 font-medium leading-snug line-clamp-2">
                  {customer.healthNote}
                </p>
              </div>
            )}

            {/* Footer: progress chú thích */}
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 text-right">
              Tự động đóng sau 10s
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckInSuccessPopup;
