import axios from 'axios';
import toast from 'react-hot-toast';

// Tạo instance axios với config mặc định
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- REQUEST INTERCEPTOR ---
// Tự động đính kèm Token vào mọi request gửi đi
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('gym_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- RESPONSE INTERCEPTOR ---
// Tự động xử lý khi Token hết hạn hoặc lỗi từ Server
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Nếu lỗi là 401 (Unauthorized) -> Token hết hạn hoặc không hợp lệ
    if (error.response && error.response.status === 401) {
      console.warn('Phiên đăng nhập hết hạn. Đang đăng xuất...');
      
      // Xóa token và thông tin user
      localStorage.removeItem('gym_token');
      localStorage.removeItem('gym_user');

      // Chuyển hướng về trang login (Dùng window.location để reload lại app luôn cho sạch)
      // Kiểm tra để tránh loop vô hạn nếu đang ở trang login rồi
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    } else {
      // Bắt các lỗi khác và hiển thị Toast
      const errorMessage = error.response?.data?.message || 'Có lỗi kết nối máy chủ';
      toast.error(errorMessage);
    }
    return Promise.reject(error);
  }
);

export default api;
