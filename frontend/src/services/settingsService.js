import api from "./api";

export const settingsService = {
  get: async () => {
    try {
      const response = await api.get('/settings');
      return response.data;
    } catch (error) {
      console.error("Lỗi lấy cấu hình:", error);
      return null;
    }
  },

  update: async (settingsData) => {
    try {
      const response = await api.put('/settings', settingsData);
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Lỗi lưu cấu hình";
      throw new Error(errorMessage);
    }
  }
};
