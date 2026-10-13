# Architecture Decision Records

## ADR-001 — Database per branch

**Trạng thái:** accepted.

Mỗi chi nhánh dùng database riêng; metadata chi nhánh, tài khoản trung tâm và login index nằm trong central database. Request pipeline chạy theo thứ tự `authenticate -> resolveTenant -> loadTenantContext -> authorize`. Access token chỉ được verify một lần; claims đã verify được dùng để chọn tenant, sau đó quyền chi nhánh được đối chiếu lại từ user hiện tại.

Hệ quả:

- Branch user bị khóa vào `branchCode` trong token; không được đổi tenant bằng header/query.
- Central user chỉ được chọn chi nhánh thuộc `allowedBranches`; `*` dành cho super-admin.
- Cache key bắt buộc chứa mã chi nhánh.
- Service mới phải nhận `req.models` hoặc chạy trong request context; không được tự ghép tên database từ input chưa xác thực.
- `HN01` còn fallback về database legacy để tương thích migration. Đây là nợ kỹ thuật cần xóa sau khi metadata mọi chi nhánh đã đầy đủ.
- Central/branch là thuộc tính danh tính trong claim `isCentral`, không được suy luận chỉ từ tên role.

## ADR-002 — Transaction và standalone fallback

**Trạng thái:** accepted.

Các operation thanh toán và lifecycle hợp đồng dùng MongoDB transaction khi connection hỗ trợ replica set/sharded cluster. Môi trường MongoDB standalone không có ACID đa document, nên fallback dựa trên:

- unique index cho business key/idempotency key;
- thao tác có thể gọi lại để repair artifact thiếu;
- state transition chỉ được thực hiện một lần;
- test concurrency và fault-recovery cho payment.

Production nên dùng MongoDB Atlas/replica set. Standalone fallback giúp local development và giảm thiệt hại khi retry, nhưng không thay thế transaction trước mọi kiểu process crash.

## ADR-003 — Soft delete và index

**Trạng thái:** accepted.

`Customer` và `CustomerPackage` dùng `isDeleted`; query middleware mặc định loại document đã xóa. Truy vấn phục hồi/kiểm toán phải chủ động dùng option được cho phép thay vì bỏ middleware toàn cục.

Index phục vụ tenant database được khai báo trong schema thuần và đồng bộ khi branch models được khởi tạo. Unique index được dùng cho invoice reference, payment provider transaction và lifecycle operation key. Việc chạy `syncIndexes` trong production cần được giám sát vì có thể tốn tài nguyên trên collection lớn.

## ADR-004 — Authorization boundary

**Trạng thái:** accepted.

Backend là security boundary. Route khai báo permission dạng `domain.action`; role chỉ là tập permission mặc định hoặc cấu hình theo chi nhánh. Frontend chỉ dùng permission để điều chỉnh UX, không phải để bảo vệ dữ liệu.
