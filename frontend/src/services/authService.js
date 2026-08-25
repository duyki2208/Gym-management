import api from './api';
import { LOCAL_STORAGE_KEYS } from '../utils/constants';

export const authService = {
  // Hàm đăng nhập
  login: async (username, password) => {
    try {
      const response = await api.post('/auth/login', { username, password });
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

  // Hàm đăng xuất — Gọi API để xóa Session thiết bị này trong DB
  logout: async () => {
    try {
      // Gọi API logout để backend xóa đúng Session của thiết bị hiện tại
      // (không ảnh hưởng đến các thiết bị khác của cùng user)
      await api.post('/auth/logout');
    } catch (e) {
      // Nếu API lỗi (token đã hết hạn), vẫn tiến hành clear localStorage
      console.warn('Logout API call failed:', e.message);
    } finally {
      localStorage.removeItem(LOCAL_STORAGE_KEYS.USER);
      localStorage.removeItem('gym_token');
      window.location.href = '/login';
    }
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
  
  // Lấy danh sách các chi nhánh hoạt động
  getBranches: async () => {
    try {
      const response = await api.get('/auth/branches');
      return response.data?.branches || [];
    } catch (error) {
      console.error("Lỗi lấy danh sách chi nhánh:", error);
      return [];
    }
  },

  // Chuyển đổi chi nhánh làm việc (cho admin / accountant)
  switchBranch: async (branchCode) => {
    try {
      const response = await api.post('/auth/switch-branch', { branchCode });
      const data = response.data;
      if (data.token) {
        localStorage.setItem('gym_token', data.token);
      }
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        currentUser.activeBranch = data.activeBranch;
        localStorage.setItem(LOCAL_STORAGE_KEYS.USER, JSON.stringify(currentUser));
      }
      return data;
    } catch (error) {
      console.error("Lỗi chuyển chi nhánh:", error);
      const message = error.response?.data?.message || error.message || 'Chuyển chi nhánh thất bại';
      throw new Error(message);
    }
  },

  // Hàm kiểm tra quyền
  hasRole: (allowedRoles) => {
    const user = authService.getCurrentUser();
    if (!user) return false;
    return allowedRoles.includes(user.role);
  }
};
