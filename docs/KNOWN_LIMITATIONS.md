# Known limitations và phạm vi bảo vệ

## Face recognition

- Ngưỡng cosine hiện là giá trị cấu hình cứng, chưa có bộ dữ liệu đánh giá FAR/FRR theo điều kiện ánh sáng, camera và nhóm người dùng thực tế.
- Harness đã đo APCER theo loại spoof từ manifest, nhưng chưa có liveness detector runtime; ảnh/video giả mạo vẫn là rủi ro.
- Embedding được lưu trong database nghiệp vụ. Cần chính sách đồng ý, thời hạn lưu và quy trình xóa dữ liệu sinh trắc học trước production thực tế.
- Internal secret bảo vệ service-to-service nhưng không thay thế network isolation hoặc mTLS.

## Dữ liệu và transaction

- MongoDB standalone chỉ có retry-safe fallback, không bảo đảm ACID đa document như replica set.
- Production có thể fail closed bằng `REQUIRE_MONGO_TRANSACTIONS=true`; việc bật cờ vẫn cần topology thật là replica set/mongos.
- Fallback tên database legacy cho HN01 còn tồn tại trong tenant resolver.
- Đã có local restore drill tự động với count, SHA-256 và index verification. Chưa có full restore drill trên staging/provider thật để chốt RPO/RTO production.

## Domain/customer

- Registration, upgrade, transfer, freeze, unfreeze và adjust-expiry đã được tách application service, có idempotency/fault-injection cho các mutation chính.
- Customer list, registration, existing-customer lookup, export, face enrollment, update/delete profile, lifecycle và upgrade/transfer đã được tách theo domain controller/service; `customerController` còn 172 dòng. Commission query/period/mutation đã tách service nhận tenant model; `commissionController` còn 204 dòng. Dashboard/report đã chuyển sang request tenant model, capability scope và team scope; vẫn cần UAT trên staging theo role thật.
- Trên MongoDB standalone, các service chỉ có retry-safe repair; tuyên bố atomic đa document chỉ áp dụng khi chạy replica set.

## Vận hành và hiệu năng

- Đã có baseline local tái lập cho customer list, check-in history, POS và report summary. Chưa có staging load test với network, replica set, Redis và traffic mix production.
- Redis có local fallback phù hợp development. Production nhiều instance có thể bật `CACHE_REQUIRE_REDIS=true` để fail closed; vẫn cần chạy topology/readiness trên các instance thật làm bằng chứng consistency.
- CI đã có dependency audit, container scan và workflow staging smoke/load thủ công. Chúng chỉ là harness cho đến khi có artifact từ môi trường staging thật.
- POS pagination đã có integration test cho object scope, metadata và summary; SLO response thực tế vẫn chỉ được chốt sau staging load test.
- Test backend còn phát cảnh báo deprecation Mongoose cho `findOneAndUpdate`/`findOneAndReplace` dùng tùy chọn `new`; cần chuyển dần sang `returnDocument: "after"` trước lần nâng cấp major tiếp theo.

Khi bảo vệ đồ án, các mục trên phải được trình bày như giới hạn đã biết và hướng phát triển, không mô tả là tính năng đã hoàn tất.
