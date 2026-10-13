# Performance benchmark

## Mục tiêu

Harness `npm run benchmark:local` tạo một MongoDB tạm thời, seed dataset cố định, khởi động Express trên cổng ngẫu nhiên và đo bốn read path quan trọng. Kết quả gồm throughput, failure count, p50/p95/p99, max latency và kích thước response trung bình.

```powershell
cd backend
$env:EVIDENCE_OUTPUT="../docs/evidence/performance-local.json"
npm run benchmark:local
```

Có thể điều chỉ quy mô bằng `BENCH_CUSTOMERS`, `BENCH_CHECKINS`, `BENCH_POS_ORDERS`, `BENCH_TRANSACTIONS`, `BENCH_REQUESTS` và `BENCH_CONCURRENCY`.

## Phạm vi và cách đọc

- `customer-list`: pagination và populate hồ sơ/gói tập.
- `checkin-history`: truy vấn lịch sử theo index thời gian.
- `pos-sales-today`: danh sách POS trong ngày và phạm vi theo nhân viên.
- `report-summary`: các aggregate doanh thu và hội viên.

Đây là baseline local có thể tái lập, không phải capacity claim cho production. Trước khi triển khai thật cần chạy lại trên staging với replica set, network latency, cache/Redis và dataset gần production; ngưỡng SLO phải được chốt theo hạ tầng đó.

## Baseline đã ghi nhận

Kết quả lần chạy đã xác minh trong repository được lưu tại `docs/evidence/performance-local.json`. Khi code truy vấn, index hoặc schema thay đổi, chạy lại harness và so sánh p95 cùng failure count trên cùng máy.

## Staging traffic mix

Harness staging chỉ phát request đọc và yêu cầu token thử nghiệm có quyền tối thiểu:

```powershell
cd backend
$env:STAGING_BASE_URL="https://staging.example.com"
$env:STAGING_LOGIN_FACILITY_KEY="<facility-key>"
$env:STAGING_LOGIN_USERNAME="<dedicated-smoke-user>"
$env:STAGING_LOGIN_PASSWORD="<password>"
$env:SMOKE_REQUIRE_LOGIN_FLOW="true"
$env:RELEASE_SHA="<deployed-git-sha>"
$env:EVIDENCE_OUTPUT="../docs/evidence/staging-smoke.json"
npm run smoke:staging
$env:STAGING_ACCESS_TOKEN="<short-lived-token-from-a-dedicated-read-only-user>"
$env:LOAD_DURATION_SECONDS="300"
$env:LOAD_CONCURRENCY="16"
$env:LOAD_MAX_P95_MS="1500"
$env:LOAD_MAX_P99_MS="3000"
$env:LOAD_MIN_THROUGHPUT_RPS="1"
$env:LOAD_REQUIRE_RELEASE_SHA="true"
$env:EVIDENCE_OUTPUT="../docs/evidence/performance-staging.json"
npm run load:staging
```

Smoke kiểm tra login thật, session, health/readiness, customer, check-in, POS và report bằng request chỉ đọc. Tài khoản smoke phải có các quyền đọc tương ứng; evidence không lưu credential hoặc token. Có thể dùng riêng `STAGING_ACCESS_TOKEN` để chẩn đoán session, nhưng gate đầy đủ đặt `SMOKE_REQUIRE_LOGIN_FLOW=true`. Chỉ dùng `SMOKE_ALLOW_ANONYMOUS_ONLY=true` cho chẩn đoán cục bộ; kết quả đó không đủ để duyệt staging. Load harness kiểm tra liveness, readiness, dependency, request ID và release SHA trước khi gửi bearer token; preflight fail thì `trafficStarted=false`. Timeout từng request dùng `LOAD_REQUEST_TIMEOUT_MS` (mặc định 10 giây).

Traffic mix mặc định: customer 35%, check-in 25%, POS 25%, report 15%. Có thể thay bằng JSON trong `LOAD_TRAFFIC_MIX`. Gate mặc định fail nếu một endpoint hoặc tổng traffic có failure rate trên 1%, p95 trên 1.500 ms hoặc p99 trên 3.000 ms; `LOAD_MIN_THROUGHPUT_RPS` đặt ngưỡng throughput tổng đã duyệt. Evidence ghi p50/p95/p99/max, error rate, throughput và response bytes. Chỉ ghi evidence đã chạy thật; không commit token.

POS `/sales` hiện phân trang server-side, mặc định 50 và tối đa 100 đơn/request; summary vẫn tính trên toàn bộ filter. Search qua customer/product vẫn cần populate tập ứng viên và phải được theo dõi riêng khi dataset lớn.
