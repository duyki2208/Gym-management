import api from "./api";

export const teamTaskService = {
  getAllToday: async (params) => {
    try {
      const response = await api.get('/team-tasks', { params });
      return response.data;
    } catch (error) {
      console.error("Lỗi lấy danh sách công việc:", error);
      return null;
    }
  },

  create: async (taskData) => {
    try {
      const response = await api.post('/team-tasks', taskData);
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Lỗi tạo công việc mới";
      throw new Error(errorMessage);
    }
  },

  update: async (id, taskData) => {
    try {
      const response = await api.put(`/team-tasks/${id}`, taskData);
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Lỗi cập nhật công việc";
      throw new Error(errorMessage);
    }
  },

  delete: async (id) => {
    try {
      const response = await api.delete(`/team-tasks/${id}`);
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Lỗi xóa công việc";
      throw new Error(errorMessage);
    }
  }
};
