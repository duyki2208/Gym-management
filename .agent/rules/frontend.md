# Frontend Rules

Tài liệu này định nghĩa pattern bắt buộc khi code ở phía Frontend (React/Vite).

## 1. Cấu trúc Component
- Nhóm các file UI theo Entity thay vì theo loại file (VD: `components/customer/CustomerModal.jsx`, `components/customer/CustomerList.jsx`).
- File dùng chung đặt ở thư mục `components/common/` (như Button, Input, Modal wrapper).

## 2. Layering (Phân tầng rõ ràng)
- **UI Components (`/components`)**: Chỉ chịu trách nhiệm render giao diện, nhận props.
- **Pages (`/pages`)**: Chứa logic UI chính, giữ State của trang, lấy data bằng cách gọi Custom Hooks hoặc Services.
- **Services (`/services`)**: Thực hiện các lời gọi HTTP (qua Axios). 
  - KHÔNG sử dụng `axios.get` bên trong Page/Component. 
  - Phải dùng instance axios từ `services/api.js`.

## 3. State & Hooks
- Logic phức tạp hoặc việc fetch data cần được tách thành các custom hooks (`/hooks/useData.js`).
- Dùng `toast` (từ `react-hot-toast` đã cài sẵn) để hiển thị thông báo thành công / thất bại, thay vì dùng `alert()`.

## 4. UI/UX
- Đảm bảo Loading skeleton / spinner khi đang load data.
- Xử lý mượt mà các viền, bóng râm (shadow), góc bo tròn để phù hợp với ngôn ngữ thiết kế chung.
