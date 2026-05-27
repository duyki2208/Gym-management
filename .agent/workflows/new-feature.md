# Workflow: Thêm Feature Mới (Fullstack)

Sử dụng workflow này khi nhận được yêu cầu tạo một tính năng lớn (cần sửa cả Database, Backend và Frontend UI).

## Các bước thực hiện

1. **Chuẩn bị (Tùy chọn)**:
   - Sử dụng lệnh `git checkout -b feature/ten-tinh-nang` để tạo nhánh mới.

2. **Cập nhật Database Schema (Backend)**:
   - Mở thư mục `models/` và điều chỉnh schema hoặc tạo file schema mới.
   - Thêm type definitions.

3. **Backend Logic (Controller & Routes)**:
   - Thực hiện quy trình tương tự `add-api-endpoint.md` để tạo các API CRUD cơ bản.

4. **Frontend Service & Hooks**:
   - Khai báo phương thức gọi API trong `services/`.
   - Nếu dữ liệu phức tạp, tạo một custom hook trong `hooks/` để tái sử dụng logic fetch/loading state.

5. **Frontend UI Components**:
   - Tạo thư mục mới trong `components/` theo tên entity (VD: `components/report/`).
   - Xây dựng giao diện. Cố gắng sử dụng lại các UI kit hiện có (nếu có) thay vì code lại từ đầu CSS.

6. **Hoàn tất**:
   - Xác nhận bằng cách build lại frontend (`npm run build` hoặc xem lỗi ở dev server).
   - Sử dụng lệnh `git commit -m "feat(module): thêm tính năng X"`.
