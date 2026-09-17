import api from "./api";

export const settingsService = {
  getFacilityKey: async (branchCode) => {
    const config = branchCode
      ? { headers: { "x-branch-code": branchCode } }
      : {};
    const response = await api.get("/settings/facility-key", config);
    return response.data;
  },

  get: async (branchCode) => {
    try {
      const config = {};
      if (branchCode) {
        config.headers = { "x-branch-code": branchCode };
      }
      const response = await api.get("/settings", config);
      return response.data;
    } catch (error) {
      console.error("Lỗi lấy cấu hình:", error);
      return null;
    }
  },

  update: async (settingsData, branchCode) => {
    try {
      const config = {};
      if (branchCode) {
        config.headers = { "x-branch-code": branchCode };
      }
      const response = await api.put("/settings", settingsData, config);
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Lỗi lưu cấu hình";
      throw new Error(errorMessage);
    }
  },
};
