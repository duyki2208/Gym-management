# Review source code — 15/10/2026

> Báo cáo này lưu hiện trạng **trước khi sửa**. Bản sửa ngày 16/10/2026 và kết quả kiểm thử nằm trong [FIX_STATUS.md](./FIX_STATUS.md). Script `reproduce.cjs` giữ assertions của lỗi cũ để lưu bằng chứng; dùng `backend/tests/reviewFixes.test.js` để kiểm tra hành vi đã sửa.

Rà soát trên working tree hiện tại, bao gồm sáu file đã có thay đổi trước lượt review. Không sửa mã ứng dụng. Phát hiện **18 vấn đề cần xử lý**: 13 mục P1 và 5 mục P2. P1 là lỗi nên ưu tiên trước khi vận hành thực tế; P2 là lỗi chức năng/dữ liệu cần lên lịch sửa.

Phạm vi: xác thực và đa chi nhánh; route/middleware/phân quyền; schema; đăng ký, cập nhật và vòng đời hợp đồng; POS, kho, PT, hoa hồng, báo cáo/dashboard; frontend gọi API, đăng nhập, POS, camera; dịch vụ Python và cấu hình triển khai. Đây là rà soát diện rộng với kiểm chứng tập trung vào các luồng ghi dữ liệu, không phải xác nhận mọi dòng code đều không còn lỗi.

**Kiểm chứng**
- Backend: 33 suite, **185/185 test pass**.
- Frontend: ESLint pass; Vite production build pass.
- Python: **4/4 test pass**, chỉ kiểm tra evaluate_embeddings.
- Script tái hiện riêng: **12/12 probe xác nhận hành vi lỗi**, dùng MongoDB tạm và tắt gửi thông báo. Một probe xác nhận cả hai lỗi closure.
- Các probe gọi controller/service với dữ liệu hợp lệ và response giả; không thay thế kiểm thử HTTP/browser xuyên suốt.
- Test/build ban đầu bị sandbox chặn spawn; đã chạy lại thành công ngoài sandbox. Chưa chạy camera/InsightFace thực tế, webhook nhà cung cấp thật hay E2E trên trình duyệt.

Bằng chứng: [results.json](<C:/sao chép từ D/do-an-tot-nghiep/docs/review-2026-10-15/results.json>), [script tái hiện](<C:/sao chép từ D/do-an-tot-nghiep/docs/review-2026-10-15/reproduce.cjs>), [kết quả Jest](<C:/sao chép từ D/do-an-tot-nghiep/docs/review-2026-10-15/backend-tests.log>).
Chạy script từ thư mục gốc bằng `node docs/review-2026-10-15/reproduce.cjs`. Script xác nhận **hành vi lỗi hiện tại**, không nên đưa vào CI như test kỳ vọng đúng; sau khi sửa cần đổi assertions sang hành vi mong muốn.

1. **[P1] QR thanh toán luôn trỏ tới một tài khoản ngân hàng cố định**

   Vị trí: [frontend/src/pages/PointOfSale.jsx:360](<C:/sao chép từ D/do-an-tot-nghiep/frontend/src/pages/PointOfSale.jsx:360>).
   URL ảnh QR chứa trực tiếp mã ngân hàng và số tài khoản, không đọc cấu hình thanh toán của chi nhánh. Khi đổi tài khoản trong Settings hoặc chuyển chi nhánh, người mua vẫn quét mã của tài khoản cố định; tiền có thể vào sai nơi và đơn không được đối soát.
   Sửa: backend trả cấu hình nhận tiền đúng tenant cùng đơn hàng, frontend dùng cấu hình đó để tạo QR; thiếu cấu hình phải chặn tạo QR. Xác nhận bằng đối chiếu code, chưa thực hiện chuyển tiền.

2. **[P1] Refresh token đưa người dùng trở về chi nhánh trước khi chuyển**

   Vị trí: [backend/controllers/authController.js:269](<C:/sao chép từ D/do-an-tot-nghiep/backend/controllers/authController.js:269>) và [backend/controllers/authController.js:379](<C:/sao chép từ D/do-an-tot-nghiep/backend/controllers/authController.js:379>).
   switchBranch chỉ cấp access token; refresh cookie vẫn chứa activeBranch cũ. Khi access token hết hạn sau 15 phút, refreshToken lấy lại branch từ cookie. Frontend chỉ thay token, giữ tên chi nhánh mới trong user state và không gửi header tenant.
   Đã tái hiện: switch HN01 → HCM01, refresh trả token HN01. Request tiếp theo có thể đọc/ghi HN01 trong khi UI hiển thị HCM01.
   Sửa: đồng bộ chi nhánh của phiên khi chuyển và khi refresh, cập nhật cả identity frontend; thêm integration test switch → refresh → ghi dữ liệu.

3. **[P1] Xóa toàn bộ quyền của một role lại khôi phục quyền mặc định**

   Vị trí: [backend/middleware/permissions.js:210](<C:/sao chép từ D/do-an-tot-nghiep/backend/middleware/permissions.js:210>).
   Mảng override chỉ được áp dụng khi có phần tử chứa dấu chấm. Với policy version 3 và reception: [], điều kiện some() trả false nên backend trả defaults. Đã tái hiện: cấu hình rỗng nhưng role vẫn có 17 quyền, gồm payment.confirm.
   Sửa: dùng policy version và sự tồn tại của mảng để phân biệt cấu hình mới với legacy; mảng rỗng phải có nghĩa là không có quyền.

4. **[P1] Chuyển cơ sở chấp nhận hợp đồng thuộc hội viên khác**

   Vị trí: [backend/controllers/branchTransferController.js:66](<C:/sao chép từ D/do-an-tot-nghiep/backend/controllers/branchTransferController.js:66>).
   customerId và packageId được tìm riêng, không kiểm tra sourcePackage.customer khớp sourceCustomer._id. Người có quyền chuyển cơ sở có thể gửi khách A kèm hợp đồng của B: hợp đồng B bị đóng, quyền lợi của B được sao chép cho A ở chi nhánh đích.
   Đã tái hiện HTTP-response 200 từ controller và trạng thái hợp đồng B thành transferred.
   Sửa: truy vấn hợp đồng bằng cả _id và customer trước mọi thu phí/ghi dữ liệu.

5. **[P1] Số lượng âm trong checkout làm tăng tồn kho và tạo tổng tiền âm**

   Vị trí: [backend/controllers/posController.js:67](<C:/sao chép từ D/do-an-tot-nghiep/backend/controllers/posController.js:67>).
   Route checkout không có validation quantity; schema cũng không đặt min. Với quantity=-2, điều kiện stockQuantity >= -2 thỏa, $inc trừ số âm tăng kho.
   Đã tái hiện tồn kho 10 → 12, đơn QR tổng -200 và response 201.
   Sửa: kiểm tra details không rỗng, quantity là số nguyên dương, product hợp lệ và paymentMethod hợp lệ trước khi ghi; thêm ràng buộc schema.

6. **[P1] Checkout thất bại trên MongoDB standalone vẫn làm mất hàng**

   Vị trí: [backend/controllers/posController.js:67](<C:/sao chép từ D/do-an-tot-nghiep/backend/controllers/posController.js:67>) và [backend/controllers/posController.js:143](<C:/sao chép từ D/do-an-tot-nghiep/backend/controllers/posController.js:143>).
   Vòng lặp trừ kho ngay từng sản phẩm. Nếu sản phẩm sau không tồn tại/hết hàng, catch chỉ rollback khi có session. Docker Compose hiện dùng MongoDB standalone nên không có rollback.
   Đã tái hiện sản phẩm đầu tồn 10 → 8, sản phẩm thứ hai không tồn tại, response 404 và không có đơn tương ứng.
   Sửa: yêu cầu transaction cho checkout hoặc có cơ chế giữ hàng/hoàn tác bền vững theo operation key; không chỉ kiểm tra trước vì vẫn có cạnh tranh đồng thời.

7. **[P1] Sửa thông tin hội viên làm tăng sai doanh thu hợp đồng nâng cấp**

   Vị trí: [backend/services/customerProfileMutationService.js:156](<C:/sao chép từ D/do-an-tot-nghiep/backend/services/customerProfileMutationService.js:156>).
   Mỗi lần updateCustomerProfile đều gọi syncTransaction, tìm một transaction theo customerPackage rồi gán amount=paidAmount. Giao dịch upgrade vốn chỉ ghi phần chênh lệch, trong khi paidAmount của hợp đồng mới là toàn bộ giá gói.
   Đã tái hiện: giao dịch thu thêm 200, hợp đồng giá 1.000; chỉ đổi tên khiến giao dịch thành 1.000. Bộ lọc không phân biệt loại giao dịch cũng có thể chọn nhầm phí dịch vụ.
   Sửa: tách chỉnh hồ sơ khỏi điều chỉnh tài chính; đối chiếu đúng type/operation key, bảo toàn khoản thu chênh lệch và lịch sử thu tiền.

8. **[P1] Cập nhật hợp đồng sửa được hoa hồng trong kỳ đã chi trả**

   Vị trí: [backend/services/customerProfileMutationService.js:182](<C:/sao chép từ D/do-an-tot-nghiep/backend/services/customerProfileMutationService.js:182>) và [backend/services/customerProfileMutationService.js:211](<C:/sao chép từ D/do-an-tot-nghiep/backend/services/customerProfileMutationService.js:211>).
   syncCommissions sửa staff/baseAmount/amount mà không kiểm tra CommissionPeriod. Luồng xóa hợp đồng và thu hồi hoa hồng có kiểm tra khóa, nhưng luồng chỉnh sửa không có.
   Đã tái hiện: kỳ paid, hoa hồng 100 → 200 sau khi sửa giá hợp đồng; tổng kỳ đã duyệt không được cập nhật tương ứng.
   Sửa: kiểm tra kỳ của các Commission bị tác động trong cùng transaction; chặn hoặc tạo bút toán điều chỉnh thay vì sửa lịch sử đã chốt.

9. **[P1] Xóa buổi trả tiền lẻ cộng miễn phí một buổi vào gói**

   Vị trí: [backend/controllers/workoutController.js:239](<C:/sao chép từ D/do-an-tot-nghiep/backend/controllers/workoutController.js:239>); schema WorkoutSession không lưu hợp đồng đã trừ hay chế độ trả tiền.
   deductSession(payPerSession=true) không trừ số buổi, nhưng deleteSession luôn hoàn một buổi vào customer.activePackage. Ngoài trường hợp trả tiền lẻ, nếu hội viên đã đổi gói, buổi có thể được hoàn vào hợp đồng khác.
   Đã tái hiện gói 5 buổi → trả tiền lẻ → xóa buổi → gói 6 buổi.
   Sửa: lưu customerPackage và số buổi thực tế đã trừ trên WorkoutSession; hoàn đúng hợp đồng và chỉ khi đã trừ.

10. **[P1] Hoàn tác đóng cửa xóa cả các ngày được gia hạn sau đó**

    Vị trí: [backend/controllers/closureController.js:385](<C:/sao chép từ D/do-an-tot-nghiep/backend/controllers/closureController.js:385>).
    reverseClosure gán endDate=previousEndDate, ghi đè mọi thay đổi sau lần bù hạn. Đã tái hiện: bù 2 ngày, gia hạn thêm 10 ngày, hoàn tác bù hạn khiến mất cả 12 ngày thay vì chỉ 2.
    Sửa: hoàn đúng phần daysAdded trên hạn hiện hành hoặc tính lại từ lịch sử sự kiện; có kiểm tra xung đột và transaction.

11. **[P1] API sửa nhân viên trả password hash về client**

    Vị trí: [backend/controllers/staffController.js:151](<C:/sao chép từ D/do-an-tot-nghiep/backend/controllers/staffController.js:151>) và [backend/controllers/staffController.js:164](<C:/sao chép từ D/do-an-tot-nghiep/backend/controllers/staffController.js:164>).
    findByIdAndUpdate trả cả document và res.json(staff) không loại password. Role quản lý mặc định có staff.update; chỉ cần đổi một trường thông tin cũng nhận hash mật khẩu hiện có. API tạo nhân viên cũng trả createdUser đầy đủ.
    Probe xác nhận trường password xuất hiện trong response với dữ liệu giả.
    Sửa: dùng DTO allowlist hoặc loại password ở cả create/update; đặt select:false và chỉ lấy password tường minh trong đăng nhập.

12. **[P1] Hủy POS không đồng bộ trạng thái đơn và hoàn kho**

    Vị trí: [backend/controllers/posController.js:514](<C:/sao chép từ D/do-an-tot-nghiep/backend/controllers/posController.js:514>).
    cancelOrder đọc trạng thái rồi save, tiếp đó đọc/sửa/save từng sản phẩm, không transaction và không điều kiện trạng thái ở lệnh ghi. Hai request có thể cùng đọc pending và cùng đi vào hoàn kho; hủy chạy cùng xác nhận có thể để dữ liệu thanh toán và trạng thái đơn mâu thuẫn. Nếu lỗi sau khi lưu cancelled, retry bị chặn và hàng chưa hoàn không được sửa.
    Xác nhận bằng phân tích thứ tự ghi; chưa chạy stress test race.
    Sửa: chuyển trạng thái có điều kiện pending và hoàn kho trong cùng transaction, dùng $inc; đường standalone cần operation key và tiến độ hoàn kho có thể phục hồi.

13. **[P1] Trừ buổi PT không nguyên tử khi có request đồng thời**

    Vị trí: [backend/controllers/workoutController.js:86](<C:/sao chép từ D/do-an-tot-nghiep/backend/controllers/workoutController.js:86>) và [backend/controllers/workoutController.js:157](<C:/sao chép từ D/do-an-tot-nghiep/backend/controllers/workoutController.js:157>).
    Kiểm tra còn buổi, tạo WorkoutSession/Commission, rồi mới read-modify-save remainingSessions. Hai request cùng thấy còn 1 có thể cùng tạo buổi/hoa hồng rồi cùng ghi 0; đã ghi nhận hai buổi nhưng chỉ trừ một. Math.max(0, ...) che khuất việc dùng vượt quyền lợi.
    Xác nhận bằng phân tích luồng và schema, chưa chạy stress test race.
    Sửa: conditional decrement remainingSessions > 0 cùng transaction tạo buổi/giao dịch/hoa hồng; idempotency key bảo vệ retry.

14. **[P2] Bù hạn đóng cửa không đồng bộ hạn trên hồ sơ Customer**

    Vị trí: [backend/controllers/closureController.js:298](<C:/sao chép từ D/do-an-tot-nghiep/backend/controllers/closureController.js:298>) và [backend/controllers/closureController.js:397](<C:/sao chép từ D/do-an-tot-nghiep/backend/controllers/closureController.js:397>).
    createClosure và reverseClosure chỉ save CustomerPackage, không gọi syncCustomerFields. Check-in và các truy vấn thông báo vẫn đọc Customer.endDate.
    Đã tái hiện hợp đồng đổi 01/01 → 03/01/2027 nhưng hồ sơ khách vẫn 01/01. Cảnh báo hết hạn và dữ liệu dashboard có thể sai cho đến khi một thao tác khác đồng bộ.
    Sửa: cập nhật projection trong cùng transaction sau mỗi thay đổi hợp đồng.

15. **[P2] POS chọn hội viên nhưng gửi ID hợp đồng**

    Vị trí: [frontend/src/pages/PointOfSale.jsx:85](<C:/sao chép từ D/do-an-tot-nghiep/frontend/src/pages/PointOfSale.jsx:85>) và [backend/services/customerQueryService.js:18](<C:/sao chép từ D/do-an-tot-nghiep/backend/services/customerQueryService.js:18>).
    API danh sách trả _id là CustomerPackage, customerId mới là ID Customer; POS gửi selectedCustomer._id. Backend không tìm thấy Customer rồi mặc nhiên ghi đơn khách lẻ.
    Đã tái hiện truyền ID hợp đồng hợp lệ tạo đơn 201 với isWalkIn=true, customer=null.
    Sửa: gửi selectedCustomer.customerId, khử trùng hội viên có nhiều hợp đồng; backend báo lỗi nếu client chỉ định customerId không tồn tại.

16. **[P2] Webhook bỏ qua thanh toán của đơn ngoài 100 đơn mới nhất**

    Vị trí: [backend/controllers/posController.js:230](<C:/sao chép từ D/do-an-tot-nghiep/backend/controllers/posController.js:230>) và [backend/controllers/posController.js:253](<C:/sao chép từ D/do-an-tot-nghiep/backend/controllers/posController.js:253>).
    Controller chỉ tải 100 đơn mới nhất mỗi chi nhánh rồi tìm suffix trong RAM. Đơn pending cũ rơi khỏi cửa sổ này không được tìm thấy, kể cả khách trả đúng tiền/nội dung; endpoint trả HTTP 200 nhưng success=false.
    Xác nhận từ truy vấn và điều kiện tìm kiếm; chưa gửi webhook thật.
    Sửa: lưu payment reference duy nhất, có index và truy vấn trực tiếp; không giới hạn tìm kiếm theo thứ tự đơn.

17. **[P2] Chống lặp check-in ở frontend xảy ra sau khi backend đã ghi**

    Vị trí: [frontend/src/components/customer/AutoCheckIn.jsx:92](<C:/sao chép từ D/do-an-tot-nghiep/frontend/src/components/customer/AutoCheckIn.jsx:92>) và [backend/controllers/checkInController.js:281](<C:/sao chép từ D/do-an-tot-nghiep/backend/controllers/checkInController.js:281>).
    Camera gửi frame mỗi 1,5 giây. Backend nhận diện thành công là lưu CheckIn và enqueue thông báo ngay; frontend chỉ kiểm tra khoảng cách 10 giây sau response. Những lần bị UI bỏ qua vẫn sinh bản ghi và tin nhắn, làm sai lịch sử/thống kê.
    Xác nhận bằng đối chiếu luồng client-server, chưa kiểm tra camera thật.
    Sửa: deduplicate theo tenant + member ở backend với thao tác nguyên tử; có thể tách nhận diện khỏi xác nhận check-in và chặn request camera chồng nhau.

18. **[P2] Cài dịch vụ face theo README thiếu dependency bắt buộc**

    Vị trí: [face-service/requirements.txt:1](<C:/sao chép từ D/do-an-tot-nghiep/face-service/requirements.txt:1>), [face-service/app.py:42](<C:/sao chép từ D/do-an-tot-nghiep/face-service/app.py:42>), [readme.md:200](<C:/sao chép từ D/do-an-tot-nghiep/readme.md:200>).
    README hướng dẫn pip install -r requirements.txt rồi gunicorn app:app, nhưng requirements thiếu cả insightface và gunicorn. Môi trường Python sạch sẽ thiếu executable gunicorn; nếu chạy Flask thì import InsightFace bị bắt và face_app=None, khiến /embed và /recognize trả 503. start.bat có cài InsightFace riêng trên Windows nhưng không sửa luồng Linux/macOS được mô tả.
    Sửa: khai báo dependency/runtime hoặc chia file theo nền tảng và đồng bộ hướng dẫn; test khởi động từ môi trường sạch.

**Điểm cần xác nhận thêm về nghiệp vụ**

Probe còn xác nhận hợp đồng frozen vẫn trừ buổi PT được (5 → 4, response 201). Chưa tính vào 18 findings vì cần chốt phòng tập có chủ ý cho phép buổi PT trong thời gian bảo lưu hay không. Nếu không cho phép, phải kiểm tra status/startDate/endDate trước khi trừ.

**Thứ tự xử lý đề xuất**

Ưu tiên 1–5 và 7–11 để ngăn ghi sai tenant, sai tài khoản nhận tiền, sai quyền và sai số liệu đã chốt. Sau đó xử lý tính nguyên tử ở 6, 12, 13 và đồng bộ dữ liệu ở 14–17. Bổ sung regression test cho từng ca trước khi thay đổi triển khai. Các test hiện có đều pass nhưng chưa bao phủ các tình huống trên.

