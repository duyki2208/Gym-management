# Ma trận authorization backend

Backend là security boundary. Frontend chỉ dùng permission để ẩn/hiện thao tác; request vẫn luôn bị kiểm tra bằng `requirePermission()`.

## Quy tắc

- Permission dùng tên có namespace theo dạng `domain.action`.
- `admin` có wildcard `*`.
- `manager`, `sm`, `pm`, `om` có ma trận mặc định giống chính sách role cũ; controller vẫn giới hạn phạm vi đội nhóm khi nghiệp vụ yêu cầu.
- Cấu hình `rolePermissions` cũ như `view_dashboard`, `pos_sell` không được xem là authorization policy và sẽ fallback về ma trận server an toàn.
- Khi cấu hình của một role chứa permission dạng `domain.action`, danh sách đó trở thành override cho role tại chi nhánh.

## Endpoint nhạy cảm

| Nhóm endpoint | Permission |
|---|---|
| Product POST/PUT/DELETE | `product.manage` |
| Inventory GET imports | `inventory.read` |
| Inventory POST import | `inventory.import` |
| POS confirm payment | `payment.confirm` |
| POS cancel order | `payment.cancel` |
| Commission period create/approve/pay/reopen | `commission.manage` |
| Commission revoke | `commission.revoke` |
| Commission của nhân viên khác | `commission.read_all` |
| Commission summary toàn chi nhánh | `commission.read_all` |
| Manual notification broadcast | `notification.broadcast` |
| PT dispute | `pt.dispute` |
| Customer create/update/delete | `customer.create`, `customer.update`, `customer.delete` |
| Contract freeze/unfreeze/upgrade | `contract.manage` |
| Contract transfer | `contract.transfer` |
| Manual expiry adjustment | `contract.expiry_adjust` |
| Staff create/update/delete | `staff.create`, `staff.update`, `staff.delete` |
| Staff schedule | `staff.schedule` |
| Check-in and face recognition | `checkin.use` |
| Workout deduction/deletion | `workout.deduct`, `workout.delete` |
| Workout/report của PT khác | `workout.read_all` |
| Package mutation | `package.manage` |
| Branch closure operations | `closure.manage` |
| Branch transfer | `branch_transfer.create`, `branch_transfer.read` |
| KPI target mutation | `kpi.manage` |
| KPI của nhân viên khác | `kpi.read_all` |
| Lead read/create/update/convert/delete | `lead.read`, `lead.create`, `lead.update`, `lead.convert`, `lead.delete` |
| Lead của nhân viên khác | `lead.read_all` |
| POS sales/order của nhân viên khác | `pos.read_all` |
| Báo cáo tổng hợp, tài chính, nhân sự | `report.read_all` |
| Audit log | `audit.read` |
| Settings read | `settings.read` |
| Facility key/settings mutation | `settings.sensitive.read`, `settings.update` |
| Team task read/complete/manage | `team_task.read`, `team_task.complete`, `team_task.manage` |
| Notification feed | `notification.read`; từng nhóm customer/task/inventory/report/commission tiếp tục bị giới hạn bởi permission domain tương ứng |

## Phạm vi object

- KPI mặc định chỉ cho phép nhân viên xem chính mình; `kpi.read_all` mới cho phép xem người khác.
- Sale chỉ thấy và thay đổi lead được giao cho mình; `lead.read_all` mở phạm vi toàn chi nhánh.
- Danh sách và trạng thái đơn POS được giới hạn theo `staff`; `pos.read_all` mở phạm vi toàn chi nhánh.
- Frontend nhận permission hiện hành từ `/auth/me`, ẩn menu không được cấp và hiển thị trang 403 khi truy cập URL trực tiếp. Backend vẫn là security boundary.
- Team task dùng permission ở route và policy phạm vi đội riêng; sale/PT/reception chỉ hoàn tất task của đội mình, manager mới sửa nội dung hoặc xóa.

Nguồn chính sách mặc định nằm trong `backend/middleware/permissions.js`. Mọi permission thêm mới phải được khai báo trong `PERMISSIONS`, gán vào role phù hợp và có regression test.
