/**
 * services/api.js — Axios Instance trung tâm với Queue Interceptor
 *
 * Tính năng:
 *  - Tự động đính kèm Access Token vào mọi request
 *  - Khi Access Token hết hạn (TOKEN_EXPIRED), tự động gọi /refresh-token
 *  - Queue: Nếu nhiều request cùng hết hạn, chỉ gọi refresh 1 lần,
 *    các request còn lại đợi trong hàng đợi rồi retry tự động
 *  - Nếu Refresh Token cũng hết hạn → clear localStorage và về /login
 */
import axios from "axios";
import toast from "react-hot-toast";

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";

// Tạo instance axios với config mặc định
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // BẮT BUỘC: gửi kèm HTTP-only Cookie chứa Refresh Token
});

// --- Queue state để chống race condition ---
// Khi nhiều request cùng nhận 401 TOKEN_EXPIRED, chỉ 1 request được gọi /refresh-token.
// Các request còn lại được đẩy vào hàng đợi và retry sau khi refresh xong.
let isRefreshing = false;
let refreshQueue = [];

const processQueue = (error, newToken = null) => {
  refreshQueue.forEach(({ resolve, reject, config }) => {
    if (error) {
      reject(error);
    } else {
      config.headers["Authorization"] = `Bearer ${newToken}`;
      resolve(api(config));
    }
  });
  refreshQueue = [];
};

// --- REQUEST INTERCEPTOR ---
// Tự động đính kèm Access Token vào mọi request gửi đi
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("gym_token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- RESPONSE INTERCEPTOR ---
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const code = error.response?.data?.code;

    // Xử lý khi Access Token hết hạn
    if (
      error.response?.status === 401 &&
      code === "TOKEN_EXPIRED" &&
      !originalRequest._retry // Tránh loop vô hạn
    ) {
      originalRequest._retry = true;

      // Nếu đang có request refresh trong hàng đợi → đẩy request này vào queue và đợi
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject, config: originalRequest });
        });
      }

      isRefreshing = true;

      try {
        // Gọi refresh-token (cookie refreshToken được gửi tự động nhờ withCredentials)
        const { data } = await axios.post(
          `${BASE_URL}/auth/refresh-token`,
          {},
          { withCredentials: true }
        );

        const newToken = data.token;
        localStorage.setItem("gym_token", newToken);
        originalRequest.headers["Authorization"] = `Bearer ${newToken}`;

        // Giải phóng queue: cho tất cả các request đang đợi retry với token mới
        processQueue(null, newToken);

        return api(originalRequest);
      } catch (refreshError) {
        // Refresh Token cũng hết hạn hoặc không hợp lệ → đăng xuất
        processQueue(refreshError, null);
        localStorage.removeItem("gym_token");
        localStorage.removeItem("gym_user");

        if (window.location.pathname !== "/login") {
          toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
          window.location.href = "/login";
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Xử lý khi Token không hợp lệ hoàn toàn (không phải hết hạn, là token giả)
    if (error.response?.status === 401 && code === "INVALID_TOKEN") {
      localStorage.removeItem("gym_token");
      localStorage.removeItem("gym_user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }

    // Bắt các lỗi khác và hiển thị Toast (trừ 401 đã xử lý ở trên, và các request có silentError)
    if (error.response?.status !== 401 && !error.config?.silentError) {
      const errorMessage =
        error.response?.data?.message || "Có lỗi kết nối máy chủ";
      toast.error(errorMessage);
    }

    return Promise.reject(error);
  }
);

export default api;
