# Business invariants của hợp đồng hội viên

## Nguồn dữ liệu chuẩn

`CustomerPackage` là nguồn dữ liệu chuẩn cho trạng thái hợp đồng. Các field sau trên `Customer` chỉ là phép chiếu phục vụ truy vấn nhanh và giao diện cũ:

- `activePackage`, `packageType`, `packageCategory`
- `startDate`, `endDate`, `remainingSessions`
- `price`, `paymentStatus`, `paidAmount`
- `contractType`, `contractCode`, `packageNote`
- `trainer`, `assignedStaff`, `hasLocker`, `hasWater`

Mọi use case thay đổi hợp đồng phải lưu `CustomerPackage`, sau đó gọi `syncCustomerFields`. Không được cập nhật độc lập các field trên `Customer`.

## Quy tắc chọn hợp đồng canonical

1. Ưu tiên hợp đồng `active` chưa bị xóa, có `endDate` xa nhất.
2. Nếu không có hợp đồng active, dùng hợp đồng chưa xóa được tạo gần nhất.
3. Nếu không còn hợp đồng, xóa toàn bộ dữ liệu hợp đồng cache trên `Customer`; không giữ trainer, nhân viên, tiện ích hoặc mã hợp đồng cũ.
4. Hợp đồng `transferred` không truyền số buổi, trainer, locker hoặc nước sang hồ sơ chủ cũ.

## Atomic boundary

Các thao tác registration, upgrade, transfer, freeze, unfreeze và adjust-expiry chạy trong MongoDB transaction khi connection là replica set/sharded cluster. Ở MongoDB standalone, service dùng operation key và repair path cho các artifact có nguy cơ tạo trùng:

- Registration dùng `Idempotency-Key` do client gửi, lưu business key trên `Customer`/`CustomerPackage` và `Transaction`.
- Upgrade và transfer dùng operation key duy nhất theo hợp đồng nguồn.
- Invoice, transaction, transfer history và referral reward được tìm lại/repair khi request retry.
- Phí bảo lưu dùng `Transaction.operationKey` duy nhất.
- Lịch sử chỉnh hạn dùng `PackageExtensionHistory.operationKey` duy nhất.
- Một yêu cầu freeze được gửi lại không kéo dài hạn lần hai và không thêm kỳ bảo lưu lần hai.

Projection sang `Customer` nằm trong cùng transaction nếu transaction được hỗ trợ. Trên standalone, gọi lại cùng request sẽ sửa projection còn thiếu.

## Giới hạn còn lại

Email/Zalo là side effect sau commit, chưa có transactional outbox. Retry không gửi trùng, nhưng process crash ngay sau commit có thể làm mất notification. Standalone fallback giảm rủi ro và repair artifact đã biết, nhưng không thay thế ACID transaction trước mọi crash point.
