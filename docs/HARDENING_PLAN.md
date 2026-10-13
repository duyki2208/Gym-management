# Kế hoạch hardening GymPro theo giai đoạn

Kế hoạch này chuyển các nhận xét audit thành những giai đoạn có phạm vi và tiêu chí hoàn thành rõ ràng. Nguyên tắc là dừng mở rộng tính năng cho đến khi các rủi ro P0/P1 được khóa.

## Giai đoạn 1 — Khóa biên bảo mật (P0)

Phạm vi:

- Mọi API Product và Inventory phải xác thực trước khi truy cập database chi nhánh.
- Mutation Product và nghiệp vụ nhập kho phải có role allowlist.
- Chỉ PT gửi khiếu nại đối soát; chỉ admin/kế toán cập nhật trạng thái hoa hồng.
- Gửi thông báo hàng loạt phải có role allowlist và bị chặn trước middleware upload.
- HMAC webhook phải có timestamp hợp lệ và nằm trong tolerance.
- Có regression test cho các đường tấn công đã phát hiện.

Tiêu chí hoàn thành: request anonymous/role sai nhận 401/403; webhook cũ bị từ chối; test mới pass.

## Giai đoạn 2 — Payment atomicity và idempotency (P0)

Trạng thái: đã triển khai. Payment completion hiện dùng transaction trên replica set và idempotent repair trên standalone; webhook concurrency/fault-injection đã có regression test.

Phạm vi:

- Gom `SaleOrder paid + Transaction + Invoice` vào một application service.
- Chạy operation trong MongoDB transaction khi branch connection hỗ trợ replica set.
- Bổ sung unique idempotency key theo provider event/transaction ID.
- Retry phải trả lại kết quả đã tồn tại hoặc repair artifact thiếu; không chỉ kiểm tra order `paid` rồi thoát.
- Loại bỏ quét cứng danh sách chi nhánh; resolve tenant từ dữ liệu trung tâm/mã thanh toán.

Tiêu chí hoàn thành: fault-injection không để order paid thiếu transaction/invoice; 5 webhook đồng thời chỉ sinh 1 transaction, 1 invoice và 1 state transition.

## Giai đoạn 3 — Chuẩn hóa authorization (P1)

Trạng thái: đã triển khai. Route authorization dùng permission `domain.action`; cấu hình theo chi nhánh được backend enforce; pipeline xác thực/tenant đã tách và JWT chỉ verify một lần. KPI, lead, POS, commission, global search, PT report/dispute và aggregate report đã có object-scope/regression test; frontend đồng bộ permission theo chi nhánh và có UX 403.

Phạm vi:

- Lập ma trận endpoint × permission cho toàn backend.
- Chuyển dần từ role check phân tán sang `requirePermission(permission)`.
- Role là tập permission; backend là security boundary, frontend chỉ ẩn/hiện UX.
- Tách pipeline `authenticate -> resolveTenant -> loadTenantContext -> authorize -> controller` để tránh verify JWT hai lần.

Tiêu chí hoàn thành: mọi mutation endpoint có permission rõ ràng; không còn route chỉ `protect` cho nghiệp vụ nhạy cảm.

## Giai đoạn 4 — Business invariants và refactor domain (P1)

Trạng thái: đã hoàn thành phần lõi. `CustomerPackage` là source of truth; registration, upgrade, transfer, freeze/unfreeze/adjust-expiry và truy vấn danh sách đã chuyển sang application service. Các mutation dùng transaction khi hạ tầng hỗ trợ, unique operation key và retry/repair trên standalone. `customerController` đã giảm từ khoảng 1.590 còn 1.102 dòng.

Phạm vi:

- Xác định `CustomerPackage` là source of truth cho hợp đồng; ghi rõ các field denormalized trong `Customer`.
- Bổ sung cơ chế đồng bộ và invariant test cho end date, payment status, price, remaining sessions.
- Tách `customerController` thành các service theo use case: registration, freeze, transfer, upgrade, payment/commission.
- Xác định atomic boundary cho từng business operation.

Tiêu chí hoàn thành: controller chỉ validate/orchestrate response; invariant quan trọng có test; không update bản sao domain bằng "nhớ update cả hai".

## Giai đoạn 5 — Kiểm thử, secrets và hồ sơ bảo vệ (P1/P2)

Trạng thái: đã triển khai phần kiểm soát trong repository. Secret cố định đã được loại khỏi Docker Compose, face-service fail closed, production env được validate, secret scan và CI đã được thêm. Đã có performance baseline local và local backup/restore drill kèm evidence; face evaluation harness đã có test nhưng chưa thể sinh FAR/FRR thật khi chưa có dataset ảnh được đồng thuận. Việc rotate/revoke secret trên Render, Git provider, SePay và các dịch vụ ngoài repository vẫn cần chủ hệ thống thực hiện theo `SECURITY_RUNBOOK.md`.

Phạm vi:

- Rotate các secret từng xuất hiện trong `.env`/ZIP/Git history; chỉ giữ `.env.example` không chứa credential.
- Mở rộng security, concurrency, failure-injection và cross-branch tests.
- Ghi ADR cho database-per-branch, tenant resolution, transaction fallback, soft delete và index strategy.
- Thu thập số liệu performance và đánh giá face recognition thay vì chỉ demo happy path.
- Chuẩn bị danh sách limitation và câu trả lời bảo vệ trung thực, có bằng chứng test.

Tiêu chí hoàn thành: repository không còn secret; CI chạy ổn định; tài liệu kiến trúc và limitation khớp với code thực tế.

## Giai đoạn 6 — Observability và production readiness (P2)

Trạng thái: đã triển khai phần nền. Mọi request có correlation ID và completion log dạng JSON; log metadata nhạy cảm được redact. Liveness/readiness tách riêng, readiness kiểm tra cả default và central database. Server chỉ listen sau khi kết nối database thành công và xử lý SIGTERM/SIGINT theo graceful shutdown có timeout.

Phạm vi:

- Chuẩn hóa `X-Request-Id` và structured application log.
- Tách liveness khỏi dependency readiness, không công khai connection string.
- Fail startup khi database chưa sẵn sàng; graceful shutdown khi deploy.
- Viết runbook cho deploy, probe và xử lý sự cố.
- Có regression test cho request ID, redaction và health contract.

Tiêu chí hoàn thành: request có thể truy vết xuyên log; orchestrator không gửi traffic trước readiness; secret không xuất hiện trong log; shutdown không nhận request mới và đóng kết nối database có giới hạn thời gian.

## Giai đoạn 7 — Verification gate trên môi trường thật

Trạng thái: repository đã có harness và CI gate; chưa được xem là Verified cho đến khi có artifact từ staging/provider. Chi tiết và thứ tự chạy nằm trong `NEXT_PHASE_EXECUTION.md`.

- Staging smoke/load read-only có SLO gate và evidence JSON.
- POS sales phân trang server-side để chặn response tăng vô hạn.
- Production nhiều instance có Redis fail-closed và readiness dependency.
- Topology verifier yêu cầu Mongo replica set và kiểm tra từng instance.
- Provider restore verifier so sánh count/index/sample checksum và tính RPO/RTO.
- Face evaluator tách enrollment/evaluation, báo subgroup và spoof APCER.
- CI có dependency audit, dependency review và Trivy container scan.

## Giai đoạn 8 — Giảm nợ kỹ thuật có kiểm soát

Trạng thái: vòng đầu đã hoàn thành và có regression test; chưa tuyên bố controller/domain đã được chuẩn hóa tuyệt đối.

- Tách customer list query khỏi controller; giới hạn `limit <= 100`, escape regex tìm kiếm và trả 400 cho bộ lọc ngày sai.
- Chuyển object-scope cập nhật lịch nhân viên sang policy service dùng chung, gồm self, trưởng bộ phận và vai trò quản lý toàn chi nhánh.
- Bổ sung integration test xác nhận POS pagination vẫn áp dụng object scope và summary được tính trên toàn bộ tập kết quả, không chỉ trang hiện tại.
- Gate vòng này: regression tập trung 5 suite/66 test và toàn backend 22 suite/142 test đều pass.

Việc tiếp tục tách `customerController` nên làm theo use case nhỏ, mỗi vòng kèm regression test, thay vì rewrite toàn bộ controller trong một lần.
