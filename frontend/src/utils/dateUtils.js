// src/utils/dateUtils.js

export const getCustomerStatus = (startDate, endDate, status) => {
  if (status === 'frozen') {
    return { status: 'frozen', label: 'Bảo lưu', color: 'bg-purple-50 text-purple-700 border-purple-200' };
  }
  if (!endDate) return { status: 'active', label: 'Hoạt động', color: 'bg-green-50 text-green-700 border-green-200' };
  
  const now = new Date();
  const start = startDate ? new Date(startDate) : now;
  const end = new Date(endDate);
  
  // Check not_activated
  if (start.getTime() > now.getTime() + 86400000) {
      return { status: 'not_activated', label: 'Chưa kích hoạt', color: 'bg-sky-50 text-sky-700 border-sky-200' };
  }
  
  const diffTime = end - now;
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (daysLeft < 0) return { status: 'expired', label: 'Hết hạn', color: 'bg-red-50 text-red-700 border-red-200' };
  if (daysLeft <= 14) return { status: 'expiring', label: 'Sắp hết hạn', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' };
  
  return { status: 'active', label: 'Hoạt động', color: 'bg-green-50 text-green-700 border-green-200' };
};

// Hàm tính số ngày còn lại thực tế
export const calculateDaysLeft = (endDate) => {
  if (!endDate) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  
  const diffTime = end - today;
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return days > 0 ? days : 0;
};

// Hàm định dạng ngày tháng (dd/mm/yyyy)
export const formatDate = (dateString) => {
  if (!dateString) return '';
  // Sử dụng toLocaleDateString với locale tiếng Việt
  return new Date(dateString).toLocaleDateString('vi-VN');
};