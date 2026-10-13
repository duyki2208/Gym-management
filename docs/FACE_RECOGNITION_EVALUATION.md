# Face recognition evaluation

## Dataset protocol

Chỉ dùng ảnh có đồng thuận và mã hóa identity; không commit ảnh, embedding hay danh tính thật vào Git. Tối thiểu nên có 3–5 ảnh/người, nhiều buổi chụp, ánh sáng, góc mặt và camera khác nhau. Tách enrollment/evaluation theo buổi chụp để tránh data leakage.

Manifest CSV:

```csv
image_path,identity,split,session,camera,lighting,demographic_group,consent_id,is_attack,attack_type,claimed_identity
images/person-001/session-a-1.jpg,person-001,enrollment,a,cam-1,bright,group-a,consent-001,false,,
images/spoof/print-001.jpg,attack-001,evaluation,attack,cam-1,bright,group-a,consent-spoof-001,true,print,person-001
```

## Chạy pipeline

```powershell
cd face-service
python build_evaluation_dataset.py --manifest C:\secure\manifest.csv --output C:\secure\embeddings.json
python evaluate_embeddings.py --input C:\secure\embeddings.json --output C:\secure\metrics.json
python -m unittest discover -s tests
```

`build_evaluation_dataset.py` ghi latency detect+embed cho từng ảnh và danh sách ảnh lỗi. Ảnh không có khuôn mặt hoặc có nhiều khuôn mặt bị ghi failure thay vì tự chọn một người. `evaluate_embeddings.py` tính genuine/impostor pair, score distribution, FAR, FRR, approximate EER và p50/p95/p99 embedding latency theo nhiều threshold.

Evaluator ưu tiên protocol template enrollment so với ảnh evaluation; chỉ dùng pairwise legacy khi dataset cũ không có đủ hai split. Báo cáo có breakdown theo camera, ánh sáng, nhóm người dùng và APCER cho ảnh attack có `claimed_identity`. APCER dựa trên embedding chỉ cho biết spoof được matcher chấp nhận bao nhiêu; nó không thay thế một liveness detector runtime.

Mọi sample phải có consent record được lưu ngoài Git. Metrics cuối giữ `dataQuality.missingConsentRows`, failure count, failure-to-acquire rate và danh sách failure; một báo cáo production không được chấp nhận nếu consent chưa đầy đủ. Không dùng thuộc tính nhạy cảm để định danh; `demographic_group` chỉ phục vụ kiểm tra chênh lệch có đồng thuận và phải có cỡ mẫu tối thiểu do hội đồng dữ liệu phê duyệt.

## Tiêu chí báo cáo

- Ghi model, phiên bản dependency, CPU/GPU, camera, độ phân giải và số identity/sample.
- Chọn threshold từ trade-off FAR/FRR trên evaluation split, không chọn theo demo thành công.
- Báo cáo cả failure-to-enroll/failure-to-acquire; không loại ảnh khó mà không ghi nhận.
- Đánh giá spoof/liveness riêng; FAR/FRR không chứng minh khả năng chống ảnh/video giả mạo.

Threshold runtime lấy từ `faceMatchThreshold` của chi nhánh; nếu không có thì face service dùng `FACE_MATCH_THRESHOLD` (mặc định `0.60`). Giá trị này phải được cập nhật theo kết quả dataset thực tế.
