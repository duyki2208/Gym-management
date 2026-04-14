import api from './api';
import { LOCAL_STORAGE_KEYS } from '../utils/constants';

export const authService = {
  // Hàm đăng nhập
  login: async (username, password) => {
    try {
      const response = await api.post('/login', { username, password });
      const data = response.data;

      // Lưu thông tin vào localStorage (bao gồm cả role)
      if (data.token) {
        localStorage.setItem('gym_token', data.token);
      }
      
      if (data.user) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.USER, JSON.stringify(data.user));
      }

      return data.user;
    } catch (error) {
      console.error("Lỗi đăng nhập:", error);
      // Axios store error response in error.response.data
      const message = error.response?.data?.message || error.message || 'Đăng nhập thất bại';
      throw new Error(message);
    }
  },

  // Hàm đăng xuất
  logout: () => {
    localStorage.removeItem(LOCAL_STORAGE_KEYS.USER);
    localStorage.removeItem('gym_token');
    // Điều hướng về login
    window.location.href = '/login'; 
  },

  // Lấy thông tin user hiện tại
  getCurrentUser: () => {
    const userStr = localStorage.getItem(LOCAL_STORAGE_KEYS.USER);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch (e) {
      console.error("Error parsing user from localStorage", e);
      return null;
    }
  },

  // Lấy token (Đã có interceptor xử lý, nhưng giữ lại nếu cần dùng lẻ)
  getToken: () => {
    return localStorage.getItem('gym_token');
  },
  
  // Hàm kiểm tra quyền
  hasRole: (allowedRoles) => {
    const user = authService.getCurrentUser();
    if (!user) return false;
    return allowedRoles.includes(user.role);
  }
};
