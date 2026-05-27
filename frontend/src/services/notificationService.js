import api from './api';

export const notificationService = {
  getAll: async () => {
    try {
      const response = await api.get('/notifications');
      return response.data;
    } catch (error) {
      console.error('Lỗi lấy notifications:', error);
      return { total: 0, notifications: [] };
    }
  },
};
