---
name: face-recognition
description: Cách thức hoạt động của tính năng nhận diện khuôn mặt bằng face-api.js trong dự án.
---

# Skill: Nhận diện khuôn mặt (face-api.js)

Dự án có sử dụng `face-api.js` để tự động check-in cho khách hàng. Các component xử lý logic này nằm trong `frontend/src/components/customer/AutoCheckIn.jsx`.

## 1. Quy trình nhận diện
1. Load models từ thư mục tĩnh (`/models` trên client-side). Models bao gồm SSD Mobilenet V1, Face Landmark 68, và Face Recognition Net.
2. Khởi động webcam bằng WebRTC (`navigator.mediaDevices.getUserMedia`).
3. Trong một vòng lặp (setInterval hoặc requestAnimationFrame), lấy frame từ webcam và đưa vào `faceapi.detectAllFaces()`.
4. Tìm khuôn mặt khớp nhất (Match) dựa trên `faceMatcher.findBestMatch()`.
5. Gọi hàm API check-in lên Backend với ID của người được nhận diện.

## 2. Quản lý Vector khuôn mặt
- Model `Customer` ở Backend lưu một mảng 128 chiều (`[Number]`) đại diện cho Descriptor khuôn mặt của khách hàng.
- Khi tạo mới / cập nhật khách hàng bằng ảnh, ta phải extract ra mảng 128 chiều này và lưu xuống Database.

## 3. Lưu ý khi làm việc
- Face-api.js khá nặng, do đó chỉ load model khi User thật sự vào trang Check-in hoặc trang chụp ảnh.
- Quá trình tính toán vector 128 chiều phải thực hiện dưới dạng `Float32Array`. Backend nhận mảng JSON `[Number]` và Frontend phải cast lại thành `Float32Array` nếu cần nạp vào `faceMatcher`.
