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
- **Tiêu đề bảng (`<thead>` / `<th>`)**: Tiêu đề bảng bắt buộc phải giữ chữ màu **ĐEN** (`text-black` hoặc `dark:text-white font-bold`). Đối với bảng gộp chung một card với Toolbar bộ lọc, sử dụng nền nhẹ dịu (`bg-gray-50/80 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700`) để tổng thể card đồng bộ và tinh tế.

## 5. Quy tắc Chân trang Phân trang (Pagination Footer)
Mọi thanh phân trang ở phía dưới danh sách/bảng đều phải tuân thủ chuẩn giao diện:
- **Bên trái**: Chỉ hiển thị thông tin trang ngắn gọn dạng `"Trang: X/Y"` (ví dụ: `Trang: 1/10`). Loại bỏ hoàn toàn các dòng chữ rườm rà như *"Hiển thị X/Y ngày..."*.
- **Bên phải**: Gồm đúng 2 nút bấm: **`"Trang trước"`** và **`"Trang sau"`** (tuyệt đối KHÔNG có icon mũi tên đi kèm).

