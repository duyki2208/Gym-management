// src/utils/dateUtils.js

export const getCustomerStatus = (endDate) => {
  if (!endDate) return { status: 'unknown', label: 'Không xác định', color: 'text-gray-600 bg-gray-100' };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset giờ về 0h sáng để so sánh chính xác
  
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  
  const diffTime = end - today;
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (daysLeft < 0) return { status: 'expired', label: 'Hết hạn', color: 'text-red-600 bg-red-50' };
  if (daysLeft <= 7) return { status: 'expiring', label: 'Sắp hết hạn', color: 'text-orange-600 bg-orange-50' };
  return { status: 'active', label: 'Đang hoạt động', color: 'text-green-600 bg-green-50' };
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