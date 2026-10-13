# Operations runbook

## Startup và probes

Backend chỉ mở HTTP port sau khi kết nối default MongoDB, central database và cache bắt buộc thành công.

- Liveness: `GET /api/v1/system/health/live`
- Readiness: `GET /api/v1/system/health/ready`
- Legacy uptime probe: `GET /health`

Khuyến nghị orchestrator:

- Liveness interval 30 giây, timeout 5 giây, failure threshold 3.
- Readiness interval 10 giây, timeout 3 giây, failure threshold 3.
- Chỉ route traffic khi readiness trả HTTP 200.
- Readiness HTTP 503 không đồng nghĩa process cần restart; trước tiên kiểm tra database/network.
- Với production nhiều instance, đặt `CACHE_REQUIRE_REDIS=true`; khi Redis lỗi, readiness chuyển 503 và cache operation không fallback sang RAM cục bộ.
- Đặt `REQUIRE_MONGO_TRANSACTIONS=true` khi production yêu cầu ACID đa document; backend sẽ không khởi động trên Mongo standalone và readiness công khai dependency `transactions` dạng boolean.

Probe chỉ công khai trạng thái boolean, không trả hostname, database name hoặc connection string.

## Request tracing

Mọi response có `X-Request-Id`. Nếu reverse proxy đã tạo ID gồm chữ, số, `.`, `_`, `-` với độ dài 8–128 ký tự, backend giữ nguyên; giá trị không hợp lệ được thay bằng UUID.

Khi xử lý sự cố:

1. Lấy `X-Request-Id` từ response lỗi.
2. Tìm JSON log có cùng `requestId`.
3. Đối chiếu `branchCode`, path, status và duration; không yêu cầu người dùng gửi token hoặc mật khẩu.
4. Dùng audit log để điều tra mutation nghiệp vụ, không dùng application log làm nguồn dữ liệu nghiệp vụ.

Các key như authorization, cookie, password, secret, token, API key và face embedding bị redact khi đi qua structured logger. Không ghi request body vào access log.

## Graceful shutdown

Khi nhận `SIGTERM` hoặc `SIGINT`, backend:

1. Ngừng nhận kết nối HTTP mới.
2. Chờ request đang xử lý hoàn tất.
3. Đóng central/default MongoDB connections.
4. Thoát thành công; quá 10 giây sẽ force-exit để deploy không treo vô hạn.

Nền tảng triển khai nên cấp termination grace period lớn hơn 10 giây.

## Deploy checklist

- CI backend tests, frontend build và secret scan đều xanh.
- Production environment validation thành công.
- `RELEASE_SHA` trỏ đúng commit triển khai.
- Liveness trả 200, sau đó readiness trả 200.
- Thực hiện một login, một read-only request và kiểm tra correlation ID trong log.
- Với migration/index lớn, theo dõi latency và readiness trước khi tăng traffic.
- Chạy workflow `Staging readiness`; lưu artifact smoke/load cùng release SHA.
- Trong GitHub environment `staging`, đặt variable không nhạy cảm `STAGING_FRONTEND_URL` và `STAGING_EXPECTED_API_BASE_URL`; giữ URL backend và login credential trong secrets. Frontend root, deep-link và bundle API target phải pass trước khi smoke gửi credential.
- Chạy `npm run verify:topology` với `MONGO_URI`, `REDIS_URL` và danh sách `INSTANCE_BASE_URLS`; chỉ chấp nhận khi Mongo có replica-set name/mongos, Redis PONG và mọi instance báo `sharedCache=true`.
- Đặt `REQUIRE_MULTI_INSTANCE_SESSION=true` và cung cấp short-lived `STAGING_ACCESS_TOKEN`: topology gate chỉ gửi token sau khi readiness/release preflight pass, sau đó yêu cầu `/auth/me`, request ID và rate-limit policy pass trên tất cả instance.
- Với staging database dành riêng cho probe, đặt `TRANSACTION_PROBE_DB`, `REQUIRE_TRANSACTION_PROBE=true` và `CONFIRM_TRANSACTION_PROBE=yes`. Gate phải chứng minh commit hai document và rollback không để lại document; collection probe tên ngẫu nhiên được xóa sau khi chạy.
- Sau khi mọi evidence được phê duyệt và cùng release SHA, chạy `npm run verify:release-gate` với `RELEASE_GATE_MANIFEST` và `RELEASE_SHA`. Không chuyển production-ready nếu validator fail.
