---
name: react-component
description: Cách thức tổ chức một React Component chuẩn trong dự án. Kích hoạt khi viết UI mới.
---

# Skill: Viết React Component

Mọi component ở frontend đều sử dụng React Hooks và TailwindCSS.

## 1. Mẫu Component Cơ Bản
Sử dụng Arrow Function và export default.
```jsx
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const SampleComponent = ({ propA, propB }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Gọi hàm fetch data ở đây
  }, []);

  if (loading) return <div>Đang tải...</div>;

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold">{propA}</h2>
    </div>
  );
};

export default SampleComponent;
```

## 2. Kết nối với Services
Khi component cần lấy dữ liệu từ Backend, hãy import service tương ứng từ thư mục `services/`.
```jsx
// ĐÚNG ✅
import { customerService } from '../services/customerService';
// ...
const data = await customerService.getAll();

// SAI ❌ (Không được dùng trực tiếp axios ở đây)
import axios from 'axios';
const response = await axios.get('...');
```

## 3. Quản lý Lỗi
Dùng `react-hot-toast` (hàm `toast.error()`) để thông báo lỗi thay vì `alert()`.
