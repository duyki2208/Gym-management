// Định nghĩa đường dẫn API của Backend
const API_URL = "http://localhost:5000/api";

// --- HÀM HỖ TRỢ (HELPER) ---
const getAuthHeaders = () => {
  const token = localStorage.getItem("accessToken");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

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
      // Build query string from params
      const query = new URLSearchParams(params).toString();
      const response = await fetch(`${API_URL}/customers?${query}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return { customers: [], totalPages: 0, totalCustomers: 0 };
      const result = await response.json();
      
      // Handle both old array format (fallback) and new object format
      if (Array.isArray(result)) {
         return { customers: result, totalPages: 1, totalCustomers: result.length };
      }
      return result;
    } catch (error) {
      return { customers: [], totalPages: 0, totalCustomers: 0 };
    }
  },

  save: async (customerData) => {
    const isUpdate = customerData._id || customerData.id;
    const url = isUpdate
      ? `${API_URL}/customers/${customerData._id || customerData.id}`
      : `${API_URL}/customers`;
    const method = isUpdate ? "PUT" : "POST";

    const dataToSend = { ...customerData };
    if (isUpdate) {
      delete dataToSend._id;
      delete dataToSend.id;
    } else {
      if (!dataToSend.code || dataToSend.code === "Tự động tạo")
        delete dataToSend.code;
    }

    // KHÔNG chuyển Date object - để string và để backend xử lý
    // Chỉ đảm bảo format đúng nếu là string
    // Nếu là Date object, chuyển thành ISO string
    if (dataToSend.dob) {
      if (dataToSend.dob instanceof Date) {
        dataToSend.dob = dataToSend.dob.toISOString();
      }
      // Nếu là string, giữ nguyên (đã đúng format từ input date)
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

    const response = await fetch(url, {
      method: method,
      headers: getAuthHeaders(),
      body: JSON.stringify(dataToSend),
    });

    if (!response.ok) {
      let errorMessage = "Lỗi lưu dữ liệu";
      try {
        const err = await response.json();
        errorMessage = err.message || errorMessage;
      } catch (e) {
        errorMessage = `Lỗi ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }
    return await response.json();
  },

  delete: async (id) => {
    const response = await fetch(`${API_URL}/customers/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Lỗi xóa khách hàng");
    return true;
  },

  getDashboardStats: async () => {
    try {
      const response = await fetch(`${API_URL}/dashboard`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Lỗi lấy dữ liệu dashboard");
      return await response.json();
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
      const response = await fetch(`${API_URL}/checkins`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      return ensureArray(await response.json());
    } catch (error) {
      return [];
    }
  },
  create: async (data) => {
    const response = await fetch(`${API_URL}/checkins`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Lỗi checkin");
    return await response.json();
  },
};

// --- 3. SERVICE GÓI TẬP ---
export const packageService = {
  getAll: async () => {
    try {
      const response = await fetch(`${API_URL}/packages`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      return [];
    }
  },
  save: async (pkg) => {
    const url = pkg._id
      ? `${API_URL}/packages/${pkg._id}`
      : `${API_URL}/packages`;
    const method = pkg._id ? "PUT" : "POST";
    const body = { ...pkg };
    if (pkg._id) delete body._id;

    const response = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error("Lỗi lưu gói tập");
    return response.json();
  },
  delete: async (id) => {
    await fetch(`${API_URL}/packages/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
  },
};

// --- 4. SERVICE NHÂN VIÊN (Đã cập nhật xử lý ngày sinh) ---
export const staffService = {
  getAll: async () => {
    try {
      const response = await fetch(`${API_URL}/staff`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      return await response.json();
    } catch (e) {
      return [];
    }
  },
  save: async (staffData) => {
    const isUpdate = staffData._id || staffData.id;
    const url = isUpdate
      ? `${API_URL}/staff/${staffData._id || staffData.id}`
      : `${API_URL}/staff`;
    const method = isUpdate ? "PUT" : "POST";

    const dataToSend = { ...staffData };
    if (isUpdate) delete dataToSend._id;

    // --- QUAN TRỌNG: Chuyển đổi ngày sinh sang Date object ---
    if (dataToSend.dob && typeof dataToSend.dob === "string") {
      dataToSend.dob = new Date(dataToSend.dob);
    }

    const response = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      body: JSON.stringify(dataToSend),
    });
    if (!response.ok) {
      let errorMessage = "Lỗi lưu nhân viên";
      try {
        const err = await response.json();
        errorMessage = err.message || errorMessage;
      } catch (e) {
        errorMessage = `Lỗi ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }
    return response.json();
  },
  delete: async (id) => {
    const response = await fetch(`${API_URL}/staff/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Lỗi xóa nhân viên");
    return true;
  },
};

export const initializeData = async () => {
  return await customerService.getAll();
};
