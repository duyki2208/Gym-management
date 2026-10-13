# Giai đoạn tiếp theo — execution gate

Không mục nào phụ thuộc môi trường thật được đóng chỉ vì harness đã tồn tại. Trạng thái chuyển từ **Ready to run** sang **Verified** khi có evidence JSON/artifact gắn với release SHA và người chịu trách nhiệm.

| Gate | Repository đã chuẩn bị | Điều kiện Verified ngoài repo |
|---|---|---|
| Face quality | Enrollment/evaluation tách buổi; FAR/FRR/EER/latency; subgroup camera/lighting/demographic; spoof APCER | Dataset consent hợp lệ, `missingConsentRows=[]`, đủ cỡ mẫu, threshold được duyệt |
| Staging smoke/load | `smoke:staging` bao phủ login/session, health, customer, check-in, POS, report; `load:staging`; workflow artifact 90 ngày | Cấu hình staging secrets, chạy với replica set, Redis, network và traffic mix thật; đạt SLO đã duyệt |
| Transaction topology | `verify:topology`; readiness shared cache; Redis fail-closed; transaction probe commit/rollback có cleanup | Mongo trả replica-set/mongos, probe transaction pass và mọi instance readiness 200 |
| Restore/RPO/RTO | Local drill + verifier provider read-only | Snapshot restore vào cluster cách ly; count/index/sample hash pass; ghi RPO/RTO thật |
| Secret rotation | Scan repo + checklist provider | Credential cũ bị revoke ở từng provider và smoke sau rotation pass |
| Supply chain | npm audit, dependency review, Trivy image scan | Workflow Security xanh trên release candidate |
| Legacy authorization | Team-task route permission + team object-scope; notification feed/broadcast dùng permission capability và tenant model | Regression test + UAT theo ma trận role chi nhánh |
| Final release | `verify:release-gate` kiểm tra evidence/SHA/approval và control vận hành | Đủ 7 evidence thật cùng release SHA; rollback, monitoring, alerting, RPO/RTO và risk register được duyệt |

## Repository gate vừa hoàn tất

- Customer list đã thành service riêng với pagination cap, escaped search và validation bộ lọc ngày.
- Existing-customer lookup, export Excel và face enrollment đã tách service; các use case này nhận model theo branch thay vì dùng model global. Search export được escape và bộ lọc ngày/expiringDays được validate.
- Update/delete customer profile đã tách sang `customerProfileMutationService`; các thay đổi customer/package/transaction/invoice/commission dùng tenant model và transaction khi MongoDB hỗ trợ replica set. Validation tiền cọc chạy trước mọi lệnh ghi để tránh trạng thái cập nhật dở dang trên standalone.
- Policy cập nhật lịch nhân viên đã tách khỏi controller và có unit test theo object scope.
- POS pagination đã có integration test cho page/limit/total và summary trên tập dữ liệu đã scope.
- Notification route đã giảm còn 130 dòng; feed và broadcast được tách service. Bộ lọc audience `active` nay dựa trên vòng đời `startDate/endDate`, channel/audience/recipient được validate trước khi chạy nền và nội dung email được HTML-escape.
- Contract freeze/unfreeze/adjust-expiry/history đã chuyển sang `contractLifecycleController`; service bổ sung history/audit helper dùng model theo tenant và chặn unfreeze trước ngày bắt đầu bảo lưu.
- Registration và upgrade/transfer đã chuyển sang domain controller riêng. Hai hàm tạo/tính lại hoa hồng được chuyển khỏi controller sang `commissionMutationService`, nhận model theo tenant và ghi lỗi vào đúng AuditLog chi nhánh.
- Commission query và period workflow đã tách service tenant-aware. Summary yêu cầu `commission.read_all`, danh sách kỳ bị giới hạn theo loại hoa hồng được phép xem, và revoke bị chặn khi kỳ liên quan đã approved/paid.
- Dashboard và toàn bộ report controller lấy model từ request tenant. Dashboard ưu tiên capability branch-wide trước role, giới hạn task theo team; report `$lookup` dùng collection của model tenant. Summary chỉ scan transaction một lần và HR report chỉ đọc setting một lần.
- Regression dashboard/report/authorization: 4 suite/26 test; tenant scope, smoke/load, transaction probe và final gate đều có test riêng. Lần xác minh local 2026-10-04: toàn backend 33 suite/183 test pass.
- Frontend production build và lint nghiêm ngặt (`--max-warnings=0`) đã pass; lint được thêm vào CI trước build.
- Backend image chạy trực tiếp bằng Node, không mang npm CLI vào runtime; frontend image dùng Node build stage và Nginx production stage, giữ target development riêng cho Compose. Local Trivy 0.74.0 trên hai image đều 0 HIGH/0 CRITICAL có bản vá; Nginx root và SPA fallback smoke pass.
- Frontend production image bắt buộc truyền `VITE_API_BASE_URL` lúc build; Compose development dùng `http://localhost:5000/api/v1`. Việc này ngăn image production âm thầm build với API localhost/sai biến.
- Probe public deployment 2026-09-27 xác nhận frontend Vercel đang bundle Render API; backend legacy `/health` trả 200 và anonymous customer trả 401, nhưng liveness/readiness của release candidate trả 404 và request ID không được propagate. Evidence fail được lưu tại `docs/evidence/staging-smoke-public-2026-09-27.json`. Phải deploy release SHA hiện tại trước khi smoke/load có giá trị release gate.
- Health endpoint tự lấy release identity theo `RELEASE_SHA`, sau đó `RENDER_GIT_COMMIT`/`GITHUB_SHA`. Smoke chạy public preflight trước login và không gửi staging credential nếu health, dependency, request ID hoặc release SHA không khớp.
- Frontend deployment preflight kiểm tra root, SPA deep-link và API URL được bundle. Lần chạy public 2026-10-04: cả ba frontend check pass; backend health/release check vẫn fail. Evidence: `docs/evidence/staging-public-preflight-2026-10-04.json`.
- Load gate xác minh health, dependency, request ID và release SHA trước khi gửi token; topology gate xác minh cùng session token và rate-limit policy trên tối thiểu hai instance. Final validator yêu cầu proof chuyên biệt cho từng gate, không chấp nhận JSON chỉ có `success: true`.
- Trạng thái tổng hợp và thứ tự đóng gate nằm tại `docs/READINESS_EXECUTION_STATUS.md`.

## Thứ tự chạy đề xuất

1. Tạo staging tương đương production: Mongo replica set, Redis dùng chung, tối thiểu hai backend instance; bật `CACHE_REQUIRE_REDIS=true`.
2. Chạy topology và smoke; sửa dependency/readiness trước khi load test.
3. Chạy traffic mix đọc 5 phút ở concurrency thấp, tăng dần; không chạy write load khi chưa có dữ liệu disposable và kế hoạch rollback.
4. Restore snapshot gần nhất vào cluster cách ly, chạy verifier và smoke read-only; ghi RPO/RTO.
5. Rotate secret theo provider, mỗi lần một nhóm dependency; revoke cũ sau smoke.
6. Thu dataset face có consent, chạy evaluator và review chênh lệch; không bật nhận diện thật nếu chưa có liveness/risk acceptance.

## Evidence tối thiểu

- Release SHA, môi trường, thời gian UTC, người chạy/phê duyệt.
- Cấu hình quy mô không nhạy cảm: instance count, dataset count, concurrency, duration, model/camera.
- Kết quả machine-readable và log lỗi đã loại secret/PII.
- Quyết định pass/fail, exception có ngày hết hạn và ticket khắc phục.
