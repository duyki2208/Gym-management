import api from "./api";

// --- HÀM HỖ TRỢ (HELPER) ---
// getAuthHeaders không còn cần thiết vì api interceptor đã xử lý

const ensureArray = (data) => {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.customers)) return data.customers;
  return [];
};

// --- 1. SERVICE KHÁCH HÀNG ---
export const customerService = {
  getAll: async (params = {}) => {
    try {
      const response = await api.get('/customers', { params });
      const result = response.data;
      
      // Handle both old array format (fallback) and new object format
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
    
    // Axios tu dong dong goi JSON
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
        dataToSend.dob = dataToSend.dob.toISOString();
      }
    }
    if (dataToSend.startDate) {
      if (dataToSend.startDate instanceof Date) {
        dataToSend.startDate = dataToSend.startDate.toISOString();
      }
    }
    if (dataToSend.endDate) {
      if (dataToSend.endDate instanceof Date) {
        dataToSend.endDate = dataToSend.endDate.toISOString();
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
      const errorMessage = error.response?.data?.message || "Lỗi lưu dữ liệu";
      throw new Error(errorMessage);
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
};

// --- 2. SERVICE CHECK-IN ---
export const checkInService = {
  getAll: async () => {
    try {
      const response = await api.get('/checkins');
      return ensureArray(response.data);
    } catch (error) {
      return [];
    }
  },
  create: async (data) => {
    const response = await api.post('/checkins', data);
    return response.data;
  },
};

// --- 3. SERVICE GÓI TẬP ---
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

// --- 4. SERVICE NHÂN VIÊN (Đã cập nhật xử lý ngày sinh) ---
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

    // --- QUAN TRỌNG: Chuyển đổi ngày sinh sang Date object ---
    // (Lưu ý: Logic gốc là chuyển string -> Date object rồi stringify lại khi gửi JSON
    // Tuy nhiên api.post sẽ tự stringify.
    // Nếu backend cần ISO string, Date object là ok vì nó sẽ dc serialize thành ISO string)
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


// --- 5. SERVICE BUỔI TẬP (WORKOUTS) ---
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
  }
};
