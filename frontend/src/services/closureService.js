import api from "./api";

export const closureService = {
  // Lấy danh sách sự kiện đóng cửa
  getAll: async (params = {}) => {
    const response = await api.get("/closures", { params });
    return response.data;
  },

  // Lấy chi tiết sự kiện & danh sách gói tập bị ảnh hưởng
  getDetails: async (id) => {
    const response = await api.get(`/closures/${id}`);
    return response.data;
  },

  // Tính toán trước (Preview) số lượng gói tập & ngày bù
  preview: async (data) => {
    const response = await api.post("/closures/preview", data);
    return response.data;
  },

  // Tạo sự kiện đóng cửa & bù hạn tự động
  create: async (data) => {
    const response = await api.post("/closures", data);
    return response.data;
  },

  // Hoàn tác (Reverse) bù hạn sự kiện đóng cửa
  reverse: async (id) => {
    const response = await api.post(`/closures/${id}/reverse`);
    return response.data;
  },

  // Soạn & Gửi email thông báo (hỗ trợ FormData kèm file đính kèm)
  sendEmail: async (id, formData) => {
    const response = await api.post(`/closures/${id}/send-email`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  // Lấy tiến độ gửi email
  getMailProgress: async (id) => {
    const response = await api.get(`/closures/${id}/mail-progress`);
    return response.data;
  },
};
