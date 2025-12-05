// src/services/authService.js

// Danh sách tài khoản mẫu (Trong thực tế sẽ lấy từ Database)
const MOCK_USERS = [
  { id: 1, username: 'admin', password: '123', name: 'Admin', role: 'admin', avatar: '👨‍💼' },
  { id: 2, username: 'manager', password: '123', name: 'Quản Lý', role: 'manager', avatar: '👩‍💼' },
  { id: 3, username: 'staff', password: '123', name: 'Nhân Viên', role: 'staff', avatar: '🧑‍🔧' },
];

export const authService = {
  login: (username, password) => {
    return new Promise((resolve, reject) => {
      // Giả lập độ trễ mạng 0.5s cho giống thật
      setTimeout(() => {
        const user = MOCK_USERS.find(u => u.username === username && u.password === password);
        
        if (user) {
          // Lưu thông tin user vào localStorage để giữ đăng nhập khi F5
          const { password, ...userWithoutPassword } = user; // Bỏ password ra khỏi object lưu trữ
          localStorage.setItem('gym_user', JSON.stringify(userWithoutPassword));
          resolve(userWithoutPassword);
        } else {
          reject('Tên đăng nhập hoặc mật khẩu không đúng!');
        }
      }, 500);
    });
  },

  logout: () => {
    localStorage.removeItem('gym_user');
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem('gym_user');
    return userStr ? JSON.parse(userStr) : null;
  }
};