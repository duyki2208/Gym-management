# Backend Rules

Tài liệu này định nghĩa các pattern bắt buộc khi code ở phía Backend (Node.js/Express).

## 1. Routing & API
- **Route Versioning**: Mọi endpoint mới đều phải nằm sau `/api/v1/`. Thêm vào file `routes/index.js` thay vì gắn trực tiếp trong `server.js`.
- **Validation**: Đặt trong file riêng tại `/validators/`. KHÔNG dùng `if/else` để kiểm tra input trống trong Controller, hãy để `express-validator` lo việc đó.

## 2. Controller Pattern
Mọi controller function cần được bọc trong try/catch hoặc sử dụng thư viện xử lý async lỗi. Luôn phải format payload trả về.

```javascript
// ✅ Chuẩn
const exampleController = async (req, res) => {
  try {
    const data = await Service.getData();
    return res.status(200).json({
      success: true,
      data: data,
      message: "Thành công"
    });
  } catch (error) {
    // Để global error handler bắt (với next(error)) hoặc tự bắt như sau:
    console.error(error);
    return res.status(500).json({ success: false, message: "Lỗi Server" });
  }
};
```

## 3. Mongoose Models
- Bắt buộc khai báo `timestamps: true` để tự động có `createdAt` và `updatedAt`.
- Nếu có references, phải dùng `mongoose.Schema.Types.ObjectId` và `ref: 'ModelName'`.

## 4. Middleware
- Không tạo các file middleware nhỏ lẻ trừ khi thật sự cần thiết có thể tái sử dụng (như `validate.js`).
- `authMiddleware.js` chịu trách nhiệm duy nhất cho `protect` (xác thực token) và `authorize` (phân quyền vai trò).
