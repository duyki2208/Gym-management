# Kết quả sửa sau review — 16/10/2026

Đã triển khai bản sửa cho 18 phát hiện trong REPORT.md trên working tree. Các thay đổi có sẵn của người dùng trong dashboard, header, CSS và reportTenantScope.test.js được giữ nguyên. Chưa commit, deploy hoặc sửa dữ liệu vận hành.

| Mục review | Bản sửa |
|---|---|
| 1 | Đơn QR lưu cấu hình tài khoản của chi nhánh; frontend tạo QR từ dữ liệu đơn. Thiếu cấu hình thì từ chối tạo đơn. |
| 2 | Đổi chi nhánh xoay refresh token và cập nhật session; refresh tiếp theo giữ đúng chi nhánh. Token refresh có JWT ID riêng. |
| 3 | Mảng quyền rỗng ở policy hiện hành được giữ nguyên, không khôi phục quyền mặc định. |
| 4 | Truy vấn hợp đồng chuyển cơ sở đồng thời theo ID hợp đồng và chủ sở hữu, trước mọi ghi dữ liệu. |
| 5 | Checkout kiểm tra số nguyên dương, giỏ hàng, mã sản phẩm và phương thức thanh toán; schema cũng ràng buộc số lượng. |
| 6 | Checkout dùng transaction bắt buộc cho kho, đơn, khoản thu và hóa đơn; rollback khi một bước lỗi. |
| 7 | Sửa thông tin hồ sơ không ghi lại khoản thu. Khoản thu mua gói được truy vấn theo loại; sửa tài chính hợp đồng nâng cấp/chuyển nhượng bị chặn để xử lý riêng. |
| 8 | Kiểm tra kỳ hoa hồng đã duyệt/chi trả trước khi cho sửa các trường ảnh hưởng hoa hồng. |
| 9 | Buổi PT lưu nguồn và gói thực sự bị trừ; xóa buổi thanh toán trực tiếp không hoàn buổi, xóa buổi gói hoàn đúng gói gốc. |
| 10 | Đảo bù ngày trừ đúng số ngày đã cộng trên hạn hiện tại, giữ phần gia hạn về sau. |
| 11 | Response tạo/cập nhật nhân viên không trả password hash. |
| 12 | Hủy đơn và hoàn kho trong cùng transaction; kiểm tra trạng thái có điều kiện, hủy lặp không hoàn kho lần hai. |
| 13 | Trừ buổi có điều kiện remainingSessions > 0, cùng transaction với lịch sử và tài chính; không tiêu vượt buổi khi gửi đồng thời. |
| 14 | Bù/đảo ngày đóng cửa đồng bộ Customer từ hợp đồng trong cùng transaction. |
| 15 | POS gửi customerId của hội viên và gộp trùng hội viên ở danh sách chọn. |
| 16 | QR mới dùng đầy đủ ObjectId; webhook tra trực tiếp mã mới và hỗ trợ mã cũ ngoài 100 đơn gần nhất. Mã trùng bị chặn để đối soát. |
| 17 | Camera có khóa request phía frontend và chốt thời gian check-in nguyên tử phía backend; request trùng không tạo bản ghi/thông báo mới. |
| 18 | Khai báo insightface và gunicorn; sửa hướng dẫn khởi động và script Windows để dừng rõ ràng khi thiếu dependencies/secret. |

## Kiểm chứng

- Backend: **34 suite, 210/210 test pass** qua `npm test`; trong đó 25 test hồi quy mới ở `backend/tests/reviewFixes.test.js`.
- Các test quan trọng: switch → refresh → /me qua HTTP; rollback checkout khi thiếu kho hoặc lỗi hóa đơn; hủy đồng thời và hủy đua với thanh toán; ba request tranh buổi cuối; hoàn đúng hợp đồng gốc; giữ khoản chênh nâng cấp; chặn sửa hoa hồng đã trả; camera đồng thời; webhook đơn cũ ngoài 100 đơn.
- Frontend: ESLint và Vite production build pass.
- Python: 4/4 unittest của evaluate_embeddings pass. Pip dry-run giải quyết được requirements trên Python 3.11 Windows; chưa build/cài InsightFace trong môi trường sạch và chưa thử runtime nhận diện.
- Docker Compose: `docker compose config --quiet` pass với giá trị giả cho các biến bắt buộc, không khởi động hay thay đổi database thật.
- `git diff --check` pass.

Log backend sau sửa: `backend-tests-after-fixes.log`. Log giải quyết dependencies: `python-dependencies-dry-run.log`. Log và probe cũ trong thư mục này mô tả hiện trạng trước sửa.

## Điều kiện vận hành và giới hạn

- Checkout/hủy đơn POS, trừ/xóa PT, bù/đảo ngày đóng cửa cần **MongoDB replica set hoặc sharded cluster**. Standalone trả 503 trước khi ghi. Docker Compose đã cấu hình replica set rs0; tham khảo README cho URI khi chạy backend ngoài Docker. Chưa áp dụng cấu hình này lên môi trường đang chạy.
- Buổi PT cũ không có nguồn trừ buổi trả `WORKOUT_RECONCILIATION_REQUIRED` khi xóa. Không tự suy đoán gói cần hoàn; phải đối soát và bổ sung provenance từ chứng từ đáng tin cậy.
- Sửa tài chính hợp đồng nâng cấp/chuyển nhượng trả `CONTRACT_FINANCIAL_ADJUSTMENT_REQUIRED`; bản sửa không tạo thêm quy trình điều chỉnh kế toán.
- Không tự sửa số dư kho, khoản thu, số buổi hay hạn hợp đồng đã sai trước đây. Cần đối soát lịch sử riêng.
- Chưa chạy E2E trình duyệt, camera/InsightFace thật, thanh toán/webhook ngân hàng thật hay triển khai production. Quy tắc cho phép trừ PT trong thời gian bảo lưu được giữ như trước, chờ xác định chính sách nghiệp vụ.
