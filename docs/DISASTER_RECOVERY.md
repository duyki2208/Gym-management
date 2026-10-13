# Backup, restore và disaster recovery

## Local restore drill

Chạy drill tái lập:

```powershell
cd backend
$env:EVIDENCE_OUTPUT="../docs/evidence/backup-restore-local.json"
npm run drill:backup-restore
```

Drill tạo MongoDB tạm thời, seed dữ liệu có `ObjectId`, `Date`, embedding, unique index, compound index và TTL index; sau đó export EJSON, restore sang database rỗng và kiểm tra:

- số document từng collection;
- SHA-256 trên BSON Extended JSON canonical;
- danh sách index ngoài `_id_`;
- thời gian backup, restore và toàn drill.

Bằng chứng lần chạy đã xác minh nằm tại `docs/evidence/backup-restore-local.json`.

## Quy trình production

Local drill chỉ chứng minh format, integrity check và quy trình restore. Production phải dùng snapshot/PITR của nhà cung cấp hoặc `mongodump`/`mongorestore` cùng phiên bản tương thích.

1. Xác định tất cả database: central database và từng branch database.
2. Tạo backup nhất quán; mã hóa artifact và lưu tách biệt khỏi production account.
3. Restore vào cluster cách ly, không ghi đè cluster đang chạy.
4. Kiểm tra count/checksum/index, central-to-branch mapping, login read-only và các invariant `CustomerPackage`.
5. Ghi RPO từ thời điểm backup gần nhất; ghi RTO từ lúc bắt đầu sự cố đến khi smoke test đạt.
6. Chỉ cut over sau phê duyệt; giữ cluster cũ read-only cho đến khi hết rollback window.

Sau khi provider đã restore snapshot vào database cách ly, chạy verifier (không tự xóa hay ghi dữ liệu):

```powershell
cd backend
$env:RESTORE_SOURCE_URI="<source-uri>"
$env:RESTORE_TARGET_URI="<isolated-target-uri>"
$env:RESTORE_DATABASES="gympro_central,gympro_branch_HN01"
$env:RESTORE_DB_SUFFIX="_restore_drill"
$env:CONFIRM_ISOLATED_RESTORE="yes"
$env:BACKUP_CREATED_AT="2026-09-19T00:00:00Z"
$env:DRILL_INCIDENT_AT="2026-09-19T00:05:00Z"
$env:DRILL_STARTED_AT="2026-09-19T00:06:00Z"
$env:RPO_TARGET_SECONDS="900"
$env:RTO_TARGET_SECONDS="3600"
$env:EVIDENCE_OUTPUT="../docs/evidence/backup-restore-staging.json"
npm run verify:provider-restore
```

Verifier so sánh count, index và SHA-256 của mẫu `_id` ổn định (mặc định 1.000 document/collection), đồng thời bắt buộc ba mốc thời gian hợp lệ để tính RPO/RTO. Nếu cấu hình target, `success` chỉ true khi integrity pass và cả hai objective đạt. Với yêu cầu assurance cao, đặt `RESTORE_SAMPLE_SIZE` lớn hơn hoặc dùng checksum native của provider. Không đặt URI thật vào file evidence.

## Lịch drill

- Hàng tháng: kiểm tra backup job, retention và khả năng đọc artifact.
- Hàng quý: full restore vào staging cách ly, ghi RPO/RTO thực tế.
- Sau thay đổi topology, schema/index hoặc nhà cung cấp: chạy drill ngoài lịch.
