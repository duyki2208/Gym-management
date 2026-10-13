# Trạng thái production readiness theo giai đoạn

Cập nhật ngày 2026-10-04. Quy ước: **Verified** chỉ khi có evidence từ đúng môi trường và release SHA; script hoặc workflow tồn tại chỉ được xem là **Ready to run**.

| Giai đoạn | Hạng mục | Trạng thái | Bằng chứng / việc còn lại |
|---|---|---|---|
| 0 | Regression backend | Verified local | 33 suite, 183 test pass |
| 0 | Face evaluator unit test | Verified local | 4 test pass; metrics giữ consent, FTA và phạm vi liveness |
| 0 | Frontend production build | Verified local | Vite build pass |
| 0 | Secret scan | Verified local | 357 file pass |
| 0 | Dependency audit npm production | Verified local | Backend và frontend: 0 vulnerability |
| 0 | Frontend lint | Verified local | 0 error, 0 warning; CI chạy với `--max-warnings=0` |
| 1 | Face dataset thật | Blocked external | Cần consent, nhiều buổi/camera/ánh sáng/nhóm; không commit dữ liệu sinh trắc |
| 1 | Liveness/spoof runtime | Not implemented | APCER từ embedding không thay thế liveness detector |
| 2 | Staging smoke + topology | Blocked by stale deployment + environment config | Recheck 2026-10-04: Vercel root, deep-link và API target pass; Render legacy `/health` = 200, anonymous customer = 401, nhưng `/api/v1/system/health/live` và `/ready` = 404; response không propagate request ID nên gate fail. Evidence: `docs/evidence/staging-public-preflight-2026-10-04.json`. Cần deploy đúng release SHA, sau đó cung cấp staging credential, Mongo URI, Redis URL và instance URLs để chạy full gate |
| 2 | Staging traffic mix | Ready to run — blocked by environment config | Read-only load; health/release preflight fail-closed trước bearer token; p95/p99, failure rate, throughput và response bytes; POS đã phân trang. Cần network và dataset staging thật |
| 3 | Provider restore drill | Verified local / Ready on provider | Local drill 2026-09-27 pass count/checksum/index; provider vẫn cần isolated restore, timestamp và RPO/RTO thật |
| 4 | Secret rotation/revoke | Blocked external | Thực hiện tại từng provider; không được ghi secret vào evidence |
| 5 | Transaction guarantee | Ready to verify | Topology gate có probe commit/rollback đa document và cleanup; production phải bật `REQUIRE_MONGO_TRANSACTIONS=true` và chạy probe trên replica set/mongos thật |
| 5 | Multi-instance cache/session | Ready to verify | Production phải bật `CACHE_REQUIRE_REDIS=true`; topology gate yêu cầu tất cả instance báo shared cache, cùng chấp nhận session token, propagate request ID và phát rate-limit policy. Cache invalidation/failover cần drill provider có kiểm soát |
| 6 | Legacy refactor | Verified local | Customer/commission service đã tenant-aware; dashboard/report dùng model theo request tenant, rẽ nhánh theo capability trước role, task theo team scope và aggregation lookup theo collection tenant. Regression hiện tại 33 suite/183 test pass |
| 6 | Container scan | Verified local working tree / Ready in CI | Backend và frontend image build pass; Trivy 0.74.0: 0 HIGH, 0 CRITICAL có bản vá. Frontend runtime đã chuyển sang Nginx multi-stage; vẫn cần artifact xanh gắn release SHA |
| 7 | Final release gate | Ready to run | Validator fail-closed theo 7 evidence gate, proof chuyên biệt từng gate, release SHA, approval, rollback, monitoring, alerting, RPO/RTO và risk review |

Staging smoke thực hiện public preflight trước login. Backend báo release theo `RELEASE_SHA` hoặc metadata `RENDER_GIT_COMMIT`, vì vậy runner sẽ dừng mà không gửi credential nếu deployment không đúng commit mong đợi.

## Thứ tự đóng gate

1. Deploy release SHA lên staging tương đương production, cấu hình replica set, Redis và ít nhất hai backend instance.
2. Chạy workflow `Staging readiness`: topology và smoke trước, load test sau. Chỉ dùng dữ liệu disposable/read-only.
3. Restore snapshot vào cluster cách ly, chạy provider verifier, ghi target và số đo RPO/RTO.
4. Rotate từng nhóm credential, smoke consumer mới, sau đó revoke credential cũ và lưu fingerprint không nhạy cảm.
5. Thu dataset khuôn mặt đã consent và đánh giá liveness riêng. Chỉ phê duyệt threshold sau review FAR/FRR, subgroup, FTA và spoof.

Ba gate 1, 3 và 4 không thể được tự động đóng trong repository vì cần dữ liệu có đồng thuận, hạ tầng provider và quyền quản trị bên ngoài.
