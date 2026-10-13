# Security operations runbook

## Secret đã từng xuất hiện trong repository

`docker-compose.yml` từng chứa JWT secret cố định. Vì file đã được Git theo dõi, phải coi giá trị đó là đã lộ dù sau này đã xóa khỏi working tree.

Thao tác bắt buộc ngoài repository:

1. Tạo `JWT_SECRET` và `JWT_REFRESH_SECRET` mới, ngẫu nhiên và độc lập.
2. Cập nhật secret ở Render/host, sau đó redeploy backend.
3. Thu hồi toàn bộ access/refresh token cũ và xóa session hiện có nếu cần đăng xuất cưỡng bức.
4. Tạo mới `FACILITY_LOOKUP_PEPPER`, `INTERNAL_SERVICE_SECRET` và `SEPAY_WEBHOOK_SECRET` nếu các giá trị hiện tại từng được chia sẻ hoặc commit.
5. Cập nhật cùng `INTERNAL_SERVICE_SECRET` ở backend và face-service trước khi chuyển traffic.
6. Xác minh login, refresh token, facility login, face enrollment/check-in và webhook sau rotation.

Thứ tự rotation giảm downtime:

1. Lập inventory owner + expiry cho Render, Git provider, MongoDB, Redis, Cloudinary, email/Brevo, SePay và face-service.
2. Tạo credential mới, deploy consumer hỗ trợ credential mới, chạy smoke test.
3. Revoke credential cũ tại provider; không chỉ xóa khỏi repository.
4. Kiểm tra audit/provider log từ thời điểm có khả năng lộ đến lúc revoke.
5. Ghi evidence chỉ gồm provider, credential fingerprint 6 ký tự cuối, người thực hiện, thời điểm tạo/revoke và kết quả smoke; không ghi secret.

Một mục chỉ được đánh dấu hoàn tất khi provider xác nhận credential cũ đã bị revoke. Việc cập nhật `.env` hoặc redeploy chưa đủ.

Không ghi giá trị secret vào ticket, log, ảnh chụp hoặc tài liệu bảo vệ. Nếu repository từng được public, có thể dùng công cụ rewrite history, nhưng rewrite không thay thế việc rotate.

## Trước mỗi lần push/deploy

- Chạy `npm run security:scan` trong `backend`.
- Chạy toàn bộ backend test và frontend build.
- Production startup phải vượt qua `validateEnvironment`; wildcard CORS và secret ngắn bị từ chối.
- Docker Compose nhận secret từ environment/`--env-file`, không có giá trị mặc định trong YAML.
- Image phát hành phải build từ production stage: backend không mang npm CLI vào runtime; frontend chỉ chứa Nginx và static assets. Trivy phải chạy với `HIGH,CRITICAL`, `ignore-unfixed=true` và fail khi có CVE sửa được.

## Khi nghi ngờ lộ secret

1. Rotate/revoke tại provider trước.
2. Redeploy consumer với secret mới.
3. Vô hiệu hóa session/token chịu ảnh hưởng.
4. Kiểm tra audit log, webhook/payment duplicate và truy cập chéo chi nhánh.
5. Ghi nhận thời gian, phạm vi và hành động khắc phục; không ghi chính secret vào biên bản.
