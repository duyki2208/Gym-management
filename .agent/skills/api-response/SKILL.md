---
name: api-response
description: Format trả về chuẩn cho API của hệ thống. Dùng skill này khi tạo Controller hoặc Route mới ở Backend.
---

# Skill: Chuẩn hóa API Response

Dự án này sử dụng một chuẩn response JSON chung để Frontend dễ dàng xử lý. Agent phải luôn tuân thủ format này khi tạo hoặc sửa API.

## 1. Định dạng JSON bắt buộc
Mọi response HTTP 200/201 (Thành công) hay 400/401/403/404/500 (Lỗi) đều phải bọc trong một Object chứa 3 trường cơ bản:
```json
{
  "success": true,   // true nếu thành công, false nếu có lỗi
  "data": {},        // Payload dữ liệu trả về (null nếu có lỗi hoặc không có data)
  "message": "..."   // Lời nhắn cho Frontend (dùng để hiển thị Toast thông báo)
}
```

## 2. Các ví dụ mẫu

### Trả về Thành công (Lấy danh sách)
```javascript
return res.status(200).json({
  success: true,
  data: customers,
  message: "Lấy danh sách thành công"
});
```

### Trả về Lỗi (Không tìm thấy)
```javascript
return res.status(404).json({
  success: false,
  message: "Không tìm thấy người dùng với ID này"
});
```

### Bắt lỗi Validator (express-validator)
Hãy sử dụng middleware `validate.js` chung thay vì tự bắt thủ công.

## 3. Checklist khi thêm API Mới
- [ ] Hàm xử lý có nằm trong khối `try-catch`?
- [ ] Response có `success`, `data`, `message` không?
- [ ] Route gắn vào `/api/v1/...` chưa?
