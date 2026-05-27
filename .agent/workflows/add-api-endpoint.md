# Workflow: Thêm API Endpoint Mới

Sử dụng workflow này khi cần tạo một API endpoint hoàn toàn mới ở Backend.

## Các bước thực hiện

1. **Xác định tính năng (Entity & Action)**:
   - Thêm vào model nào? Hành động là GET, POST, PUT hay DELETE?

2. **Cập nhật Validation**:
   - Nếu là POST/PUT, tạo một mảng Validator mới trong file tương ứng thuộc `backend/validators/` (VD: `createEntityValidator`).
   - Đảm bảo kiểm tra đầy đủ các trường `required`.

3. **Tạo Controller Function**:
   - Mở file controller liên quan trong `backend/controllers/`.
   - Tạo hàm mới với `try-catch`, và luôn trả về response theo chuẩn `api-response` skill.

4. **Khai báo Route**:
   - Thêm route mới vào file route trong `backend/routes/`.
   - Chèn middleware `protect`, `authorize` (nếu cần), và `validate` (nếu là POST/PUT).

5. **Cập nhật Frontend Service (Tuỳ chọn)**:
   - Mở file service frontend tương ứng (VD: `frontend/src/services/entityService.js`).
   - Khai báo một hàm async mới để gọi `api.post(...)` / `api.get(...)` tới endpoint vừa tạo.
