// Định nghĩa đường dẫn API Backend
const API_URL = 'http://localhost:5000/api';

export const authService = {
  // Hàm đăng nhập: Gọi API thực tế thay vì check Mock Data
  login: async (username, password) => {
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Nếu Server trả về lỗi (400, 401, 500...), ném lỗi ra để bắt ở UI
        throw new Error(data.message || 'Đăng nhập thất bại');
      }

      // Đăng nhập thành công!
      // Lưu Token và thông tin User vào localStorage
      if (data.token) {
        localStorage.setItem('accessToken', data.token); // Lưu token để dùng cho các request sau
      }
      
      if (data.user) {
        localStorage.setItem('gym_user', JSON.stringify(data.user)); // Lưu thông tin hiển thị
      }

      return data.user;
    } catch (error) {
      console.error("Lỗi đăng nhập:", error);
      throw error; // Ném lỗi tiếp để form đăng nhập hiển thị thông báo đỏ
    }
  },

  // Hàm đăng xuất
  logout: () => {
    localStorage.removeItem('gym_user');
    localStorage.removeItem('accessToken');
    // Có thể reload trang hoặc điều hướng về login tại đây nếu cần
    // window.location.href = '/login'; 
  },

  // Lấy thông tin user hiện tại (để hiển thị tên, avatar...)
  getCurrentUser: () => {
    const userStr = localStorage.getItem('gym_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  // Lấy token (để kẹp vào header các request gọi API lấy dữ liệu)
  getToken: () => {
    return localStorage.getItem('accessToken');
  },
  
  // Hàm kiểm tra xem user có quyền admin/manager không (Optional helper)
  hasRole: (allowedRoles) => {
    const userStr = localStorage.getItem('gym_user');
    if (!userStr) return false;
    const user = JSON.parse(userStr);
    return allowedRoles.includes(user.role);
  }
};