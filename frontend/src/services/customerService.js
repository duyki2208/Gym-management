import api from "./api";

const ensureArray = (data) => {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.customers)) return data.customers;
  return [];
};

export const customerService = {
  getAll: async (params = {}) => {
    try {
      const response = await api.get('/customers', { params });
      const result = response.data;
      
      if (Array.isArray(result)) {
         return { customers: result, totalPages: 1, totalCustomers: result.length };
      }
      return result;
    } catch (error) {
      console.error(error);
      return { customers: [], totalPages: 0, totalCustomers: 0 };
    }
  },

  save: async (customerData) => {
    const isUpdate = customerData._id || customerData.id;
    const url = isUpdate
      ? `/customers/${customerData._id || customerData.id}`
      : `/customers`;
    
    const dataToSend = { ...customerData };
    if (isUpdate) {
      delete dataToSend._id;
      delete dataToSend.id;
    } else {
      if (!dataToSend.code || dataToSend.code === "Tự động tạo")
        delete dataToSend.code;
    }

    if (dataToSend.dob) {
      if (dataToSend.dob instanceof Date) {
        if (isNaN(dataToSend.dob.getTime())) {
          delete dataToSend.dob;
        } else {
          dataToSend.dob = dataToSend.dob.toISOString();
        }
      } else if (typeof dataToSend.dob === "string") {
        if (!dataToSend.dob || dataToSend.dob === "Invalid Date") {
          delete dataToSend.dob;
        } else {
          const parsed = new Date(dataToSend.dob);
          if (isNaN(parsed.getTime())) {
            delete dataToSend.dob;
          } else {
            dataToSend.dob = parsed.toISOString();
          }
        }
      }
    }
    if (dataToSend.startDate) {
      if (dataToSend.startDate instanceof Date) {
        if (isNaN(dataToSend.startDate.getTime())) {
          delete dataToSend.startDate;
        } else {
          dataToSend.startDate = dataToSend.startDate.toISOString();
        }
      } else if (typeof dataToSend.startDate === "string") {
        const parsed = new Date(dataToSend.startDate);
        if (isNaN(parsed.getTime())) {
          delete dataToSend.startDate;
        } else {
          dataToSend.startDate = parsed.toISOString();
        }
      }
    }
    if (dataToSend.endDate) {
      if (dataToSend.endDate instanceof Date) {
        if (isNaN(dataToSend.endDate.getTime())) {
          delete dataToSend.endDate;
        } else {
          dataToSend.endDate = dataToSend.endDate.toISOString();
        }
      } else if (typeof dataToSend.endDate === "string") {
        const parsed = new Date(dataToSend.endDate);
        if (isNaN(parsed.getTime())) {
          delete dataToSend.endDate;
        } else {
          dataToSend.endDate = parsed.toISOString();
        }
      }
    }

    try {
      if (isUpdate) {
        const response = await api.put(url, dataToSend);
        return response.data;
      } else {
        const response = await api.post(url, dataToSend);
        return response.data;
      }
    } catch (error) {
      // Re-throw để giữ nguyên axios error (status, response.data) cho caller xử lý
      throw error;
    }
  },

  // Kiểm tra khách hàng đã tồn tại chưa (real-time, không ghi dữ liệu)
  checkExisting: async ({ name, phone, dob }) => {
    try {
      const params = { name, phone };
      if (dob) params.dob = dob;
      const response = await api.get('/customers/check-existing', { params });
      return response.data; // { exists: boolean, customer?: {...} }
    } catch {
      return { exists: false };
    }
  },

  delete: async (id) => {
    await api.delete(`/customers/${id}`);
    return true;
  },

  getDashboardStats: async () => {
    try {
      const response = await api.get('/dashboard');
      return response.data;
    } catch (error) {
      console.error(error);
      return null;
    }
  },
  freeze: async (id, freezeData) => {
    const response = await api.post(`/customers/${id}/freeze`, freezeData);
    return response.data;
  },
  unfreeze: async (id, actualUnfreezeDate) => {
    const response = await api.post(`/customers/${id}/unfreeze`, { actualUnfreezeDate });
    return response.data;
  },
  exportExcel: async (params = {}) => {
    const response = await api.get('/customers/export-excel', {
      params,
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `GymPro_Customers_${Date.now()}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
};

export const checkInService = {
  getAll: async (params = {}) => {
    try {
      const response = await api.get('/checkins', { params });
      // Hỗ trợ response format cũ và mới có pagination
      const data = response.data;
      if (data?.success && data?.data?.checkins) return data.data.checkins;
      return ensureArray(data);
    } catch (error) {
      return [];
    }
  },
  // Lấy danh sách khách cho trang Check-in — KHÔNG có faceDescriptor
  getCheckInList: async (params = {}) => {
    try {
      const response = await api.get('/checkins/checkin-list', { params });
      const data = response.data;
      if (data?.success && data?.data?.customers) return data.data;
      return { customers: ensureArray(data), total: 0 };
    } catch (error) {
      console.error("Lỗi lấy danh sách check-in:", error);
      return { customers: [], total: 0 };
    }
  },
  create: async (data) => {
    const response = await api.post('/checkins', data);
    return response.data;
  },
};


export const packageService = {
  getAll: async () => {
    try {
      const response = await api.get('/packages');
      return response.data;
    } catch (error) {
      return [];
    }
  },
  save: async (pkg) => {
    const isUpdate = !!pkg._id;
    const url = isUpdate
      ? `/packages/${pkg._id}`
      : `/packages`;
      
    const body = { ...pkg };
    if (pkg._id) delete body._id;

    try {
       if (isUpdate) {
         const response = await api.put(url, body);
         return response.data;
       } else {
         const response = await api.post(url, body);
         return response.data;
       }
    } catch (error) {
      throw new Error("Lỗi lưu gói tập");
    }
  },
  delete: async (id) => {
    await api.delete(`/packages/${id}`);
  },
};

export const staffService = {
  getAll: async () => {
    try {
      const response = await api.get('/staff');
      return response.data;
    } catch (e) {
      return [];
    }
  },
  save: async (staffData) => {
    const isUpdate = staffData._id || staffData.id;
    const url = isUpdate
      ? `/staff/${staffData._id || staffData.id}`
      : `/staff`;

    const dataToSend = { ...staffData };
    if (isUpdate) delete dataToSend._id;

    if (dataToSend.dob && typeof dataToSend.dob === "string") {
      dataToSend.dob = new Date(dataToSend.dob);
    }

    try {
      if (isUpdate) {
        const response = await api.put(url, dataToSend);
        return response.data;
      } else {
        const response = await api.post(url, dataToSend);
        return response.data;
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Lỗi lưu nhân viên";
      throw new Error(errorMessage);
    }
  },
  delete: async (id) => {
    await api.delete(`/staff/${id}`);
    return true;
  },
  getSchedules: async (params) => {
    try {
      const response = await api.get('/staff/schedules', { params });
      return response.data;
    } catch (e) {
      return [];
    }
  },
  updateSchedule: async (staffId, data) => {
    const response = await api.post(`/staff/${staffId}/schedule`, data);
    return response.data;
  }
};

export const workoutService = {
  getByCustomer: async (customerId) => {
    try {
      const response = await api.get(`/workouts/${customerId}`);
      return response.data;
    } catch (e) {
      return [];
    }
  },
  deduct: async (customerId, data) => {
    const response = await api.post(`/workouts/${customerId}/deduct`, data);
    return response.data;
  },
  deleteSession: async (sessionId) => {
    const response = await api.delete(`/workouts/${sessionId}`);
    return response.data;
  }
};
