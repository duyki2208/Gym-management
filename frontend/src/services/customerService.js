// Định nghĩa đường dẫn API của Backend
const API_URL = "http://localhost:5000/api";

// --- HÀM HỖ TRỢ AN TOÀN (HELPER) ---
// Hàm này giúp đảm bảo dữ liệu trả về luôn là Mảng [], tránh lỗi .filter()
const ensureArray = (data) => {
  if (Array.isArray(data)) return data; // Nếu là mảng chuẩn thì trả về ngay
  if (data && Array.isArray(data.data)) return data.data; // Nếu API trả về dạng { data: [...] }
  if (data && Array.isArray(data.customers)) return data.customers; // Nếu API trả về dạng { customers: [...] }
  return []; // Nếu không phải mảng, trả về mảng rỗng để không bị crash ứng dụng
};

// --- 1. SERVICE KHÁCH HÀNG ---
export const customerService = {
  getAll: async () => {
    try {
      const response = await fetch(`${API_URL}/customers`);
      if (!response.ok) return [];

      const result = await response.json();

      // LOG RA CONSOLE ĐỂ BẠN KIỂM TRA DỮ LIỆU THỰC TẾ
      console.log("API /customers response:", result);

      // Sử dụng hàm ensureArray để lọc lấy mảng
      return ensureArray(result);
    } catch (error) {
      console.error("Lỗi lấy danh sách khách:", error);
      return []; // Luôn trả về mảng rỗng khi lỗi mạng
    }
  },

  save: async (customerData) => {
    try {
      const isUpdate = customerData._id || customerData.id;
      const url = isUpdate
        ? `${API_URL}/customers/${customerData._id || customerData.id}`
        : `${API_URL}/customers`;

      const method = isUpdate ? "PUT" : "POST";

      // Chuẩn bị dữ liệu gửi lên
      const dataToSend = { ...customerData };

      // Loại bỏ id khỏi body khi PUT (vì đã có trong URL)
      if (isUpdate) {
        delete dataToSend._id;
        delete dataToSend.id;
      } else {
        // Khi tạo mới, không gửi code nếu rỗng (để backend tự tạo)
        if (
          !dataToSend.code ||
          dataToSend.code === "" ||
          dataToSend.code === "Tự động tạo"
        ) {
          delete dataToSend.code;
        }
      }

      // Đảm bảo trainer là string, không phải boolean
      if (dataToSend.trainer !== undefined) {
        dataToSend.trainer =
          typeof dataToSend.trainer === "string"
            ? dataToSend.trainer
            : dataToSend.trainer
            ? String(dataToSend.trainer)
            : "";
      }

      // Chuyển đổi date strings sang Date objects nếu cần
      if (dataToSend.dob && typeof dataToSend.dob === "string") {
        dataToSend.dob = dataToSend.dob ? new Date(dataToSend.dob) : null;
      }
      if (dataToSend.startDate && typeof dataToSend.startDate === "string") {
        dataToSend.startDate = dataToSend.startDate
          ? new Date(dataToSend.startDate)
          : new Date();
      }
      if (dataToSend.endDate && typeof dataToSend.endDate === "string") {
        dataToSend.endDate = dataToSend.endDate
          ? new Date(dataToSend.endDate)
          : null;
      }

      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Lỗi lưu khách hàng:", error);
      throw error;
    }
  },

  delete: async (id) => {
    try {
      const response = await fetch(`${API_URL}/customers/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`
        );
      }

      return true;
    } catch (error) {
      console.error("Lỗi xóa khách hàng:", error);
      throw error; // Re-throw để component có thể xử lý
    }
  },
};

// --- 2. SERVICE CHECK-IN ---
export const checkInService = {
  create: async (data) => {
    try {
      const response = await fetch(`${API_URL}/checkins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Lỗi check-in:", error);
      throw error; // Re-throw để component có thể xử lý
    }
  },

  getAll: async () => {
    try {
      const response = await fetch(`${API_URL}/checkins`);
      if (!response.ok) return [];

      const result = await response.json();
      // Áp dụng tương tự cho checkin để tránh lỗi tương lai
      return ensureArray(result);
    } catch (error) {
      console.error("Lỗi lấy lịch sử check-in:", error);
      return [];
    }
  },
};

// --- 3. SERVICE GÓI TẬP (Dữ liệu tĩnh) ---
export const packageService = {
  getAll: async () => {
    try {
      const response = await fetch(`${API_URL}/packages`);
      if (!response.ok) return [];
      const result = await response.json();
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error("Lỗi lấy danh sách gói tập:", error);
      return [];
    }
  },
  save: async (pkg) => {
    try {
      let response;
      if (pkg._id) {
        response = await fetch(`${API_URL}/packages/${pkg._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pkg),
        });
      } else {
        response = await fetch(`${API_URL}/packages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pkg),
        });
      }
      if (!response.ok) throw new Error("Lỗi khi lưu gói tập");
      return await response.json();
    } catch (error) {
      console.error("Lỗi lưu gói tập:", error);
      throw error;
    }
  },
  delete: async (id) => {
    try {
      await fetch(`${API_URL}/packages/${id}`, { method: "DELETE" });
    } catch (error) {
      console.error("Lỗi xóa gói tập:", error);
    }
  },
};

// --- 4. SERVICE NHÂN VIÊN ---
export const staffService = {
  getAll: async () => {
    try {
      const response = await fetch(`${API_URL}/staff`);
      if (!response.ok) return [];
      const result = await response.json();
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error("Lỗi lấy danh sách nhân viên:", error);
      return [];
    }
  },

  save: async (staffData) => {
    try {
      const isUpdate = staffData._id || staffData.id;
      const url = isUpdate
        ? `${API_URL}/staff/${staffData._id || staffData.id}`
        : `${API_URL}/staff`;

      const method = isUpdate ? "PUT" : "POST";

      // Chuẩn bị dữ liệu gửi lên
      const dataToSend = { ...staffData };
      if (isUpdate) {
        delete dataToSend._id;
        delete dataToSend.id;
      }

      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Lỗi lưu nhân viên:", error);
      throw error;
    }
  },

  delete: async (id) => {
    try {
      const response = await fetch(`${API_URL}/staff/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`
        );
      }

      return true;
    } catch (error) {
      console.error("Lỗi xóa nhân viên:", error);
      throw error;
    }
  },
};

// --- 5. HÀM KHỞI TẠO DỮ LIỆU ---
// Hàm này gọi customerService.getAll(), vốn đã được bảo vệ bởi ensureArray
export const initializeData = async () => {
  return await customerService.getAll();
};
