# Git Rules

Dự án tuân theo tiêu chuẩn Conventional Commits. Bắt buộc dùng tiền tố (prefix) trước mỗi message commit.

## 1. Định dạng Commit Message
```text
<type>(<scope>): <subject>
```
- `feat`: Tính năng mới (VD: `feat(auth): thêm đăng nhập bằng Google`)
- `fix`: Sửa lỗi (VD: `fix(customer): lỗi crash khi lưu ngày sinh`)
- `docs`: Chỉnh sửa tài liệu (VD: `docs: cập nhật README`)
- `style`: Sửa format code, dấu phẩy, khoảng trắng (không đổi logic)
- `refactor`: Viết lại code, tối ưu hóa (không phải fix bug hay thêm tính năng)
- `test`: Bổ sung test cases
- `chore`: Cập nhật cấu hình build, package.json...

## 2. Quy tắc nhánh (Branch Naming)
Sử dụng các tiền tố tương tự cho nhánh git:
- `feature/ten-chuc-nang`
- `fix/ten-loi`
- `hotfix/loi-nghiem-trong-production`

## 3. Quy trình làm việc (Workflow)
- Không push trực tiếp lên `main` nếu làm việc nhóm.
- Đảm bảo code chạy được ở local (`npm run dev` / `docker-compose up`) trước khi tạo commit.
