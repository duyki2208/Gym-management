# Gym Management System — Agent Rules

## Project Overview
Hệ thống quản lý phòng gym với các tính năng:
- Tự động check-in bằng nhận diện khuôn mặt (face-api.js)
- Quản lý gói tập, khách hàng, nhân viên
- Hệ thống POS và quản lý kho
- Báo cáo và thống kê

**Tech Stack:**
- **Backend:** Node.js, Express, MongoDB (Mongoose)
- **Frontend:** React, Vite, TailwindCSS (nếu có) / Vanilla CSS
- **AI/CV:** face-api.js cho nhận diện khuôn mặt

## Core Coding Rules

### 1. Backend Conventions
- **API Prefix:** Bắt buộc sử dụng prefix `/api/v1/` cho TẤT CẢ các routes mới (ví dụ: `router.use('/api/v1/feature', ...)`).
- **Controller Wrap:** Mọi controller (ngoại trừ error handler) phải dùng `try-catch` hoặc wrap bằng `asyncHandler` để không bị crash server.
- **Response Format:** Chuẩn hóa response theo định dạng chung:
  ```json
  { "success": true/false, "data": {}, "message": "..." }
  ```
- **Validation:** Bắt buộc dùng `express-validator` cho các routes POST/PUT trước khi vào controller. Sử dụng middleware `validate.js` chung.
- **Authentication:** Chỉ sử dụng duy nhất middleware `authMiddleware.js` (gồm `protect` và `authorize`). **TUYỆT ĐỐI KHÔNG tạo mới file auth middleware.**

### 2. Frontend Conventions
- **API Calls:** Không bao giờ gọi Axios hoặc fetch trực tiếp từ bên trong Component. Mọi lời gọi mạng phải được đặt trong thư mục `services/` (ví dụ: `services/customerService.js`).
- **Component Structure:** Các components liên quan đến cùng một thực thể (entity) phải được nhóm chung vào một thư mục (ví dụ: `components/customer/`).
- **Naming Convention:**
  - `PascalCase` cho tên file và hàm Component (VD: `CustomerList.jsx`).
  - `camelCase` cho Custom Hooks (VD: `useCustomers.js`).

### 3. Git
- Áp dụng **Conventional Commits**: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`.
- Đặt tên branch: `feature/ten-feature`, `fix/ten-bug`.

## DO NOT (Tuyệt đối tránh)
- ❌ KHÔNG tạo file middleware auth mới (đã có `authMiddleware.js`).
- ❌ KHÔNG đặt logic xử lý data trực tiếp trong file routes (routes chỉ làm nhiệm vụ điều phối).
- ❌ KHÔNG import Axios API trực tiếp vào React component.
- ❌ KHÔNG tự ý thay đổi cấu trúc thư mục cốt lõi mà không xin phép người dùng.
