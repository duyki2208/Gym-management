import api from "./api";

const commissionService = {
  // === Hoa hồng PT ===
  getPTCommissions: async (params = {}) => {
    try {
      const response = await api.get("/commissions/pt", { params });
      return response.data;
    } catch (error) {
      console.error("Lỗi lấy hoa hồng PT:", error);
      return { success: false, data: null };
    }
  },

  // === Hoa hồng Sale ===
  getSaleCommissions: async (params = {}) => {
    try {
      const response = await api.get("/commissions/sale", { params });
      return response.data;
    } catch (error) {
      console.error("Lỗi lấy hoa hồng Sale:", error);
      return { success: false, data: null };
    }
  },

  // === Tổng hợp ===
  getSummary: async (params = {}) => {
    try {
      const response = await api.get("/commissions/summary", { params });
      return response.data;
    } catch (error) {
      console.error("Lỗi lấy tổng hợp hoa hồng:", error);
      return { success: false, data: null };
    }
  },

  // === Kỳ hoa hồng ===
  getPeriods: async (params = {}) => {
    try {
      const response = await api.get("/commissions/periods", { params });
      return response.data;
    } catch (error) {
      console.error("Lỗi lấy danh sách kỳ:", error);
      return { success: false, data: [] };
    }
  },

  createPeriod: async (data) => {
    const response = await api.post("/commissions/period", data);
    return response.data;
  },

  approvePeriod: async (id) => {
    const response = await api.put(`/commissions/period/${id}/approve`);
    return response.data;
  },

  markPaid: async (id, note = "") => {
    const response = await api.put(`/commissions/period/${id}/pay`, { note });
    return response.data;
  },

  // === Thu hồi ===
  revokeByPackage: async (customerPackageId, reason = "") => {
    const response = await api.put(`/commissions/revoke/${customerPackageId}`, { reason });
    return response.data;
  },
};

export default commissionService;
