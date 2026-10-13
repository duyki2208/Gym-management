# Final production release gate

Không đánh dấu production-ready từ kết quả local hoặc chỉ vì workflow tồn tại. Final gate chỉ pass khi mọi evidence cùng release SHA, có người phê duyệt và các control vận hành đã được xác nhận.

## Evidence bắt buộc

- `staging-smoke`: login/session, health, customer, check-in, POS và report.
- `staging-load`: p95, p99, error rate và throughput trên traffic mix thật.
- `topology-transaction`: replica set/mongos, Redis, tối thiểu hai instance và transaction commit/rollback thật.
- `provider-restore`: count, checksum mẫu, index, RPO và RTO trên restore cách ly.
- `secret-rotation`: credential cũ đã revoke và consumer mới smoke pass.
- `security-scan`: dependency/container scan xanh trên release candidate.
- `face-evaluation`: dataset consent, FAR/FRR/EER/subgroup/spoof và quyết định liveness/risk acceptance. Nếu face recognition bị tắt production, evidence phải ghi rõ control vô hiệu hóa và người chấp nhận rủi ro.

Mỗi file evidence phải có metadata tối thiểu:

```json
{
  "gate": "staging-smoke",
  "generatedAt": "2026-09-27T00:00:00.000Z",
  "releaseSha": "<deployed-commit-sha>",
  "approvedBy": "<release-owner>",
  "success": true
}
```

Chỉ metadata và `success: true` không đủ. Validator kiểm tra proof theo từng gate: danh sách smoke check; load preflight/traffic/overall/per-endpoint; topology replica-set hoặc sharded, Redis, transaction và hai instance; restore integrity/RPO/RTO; rotation+revoke+smoke theo provider; ba nhóm security scan; consent/evaluation và liveness, disable control hoặc risk acceptance cho face recognition.

## Manifest

```json
{
  "releaseSha": "<deployed-commit-sha>",
  "approvedBy": "<release-owner>",
  "controls": {
    "rollbackTested": true,
    "monitoringConfigured": true,
    "alertingConfigured": true,
    "rpoRtoApproved": true,
    "riskRegisterReviewed": true
  },
  "evidence": [
    { "gate": "staging-smoke", "path": "evidence/staging-smoke.json" },
    { "gate": "staging-load", "path": "evidence/staging-load.json" },
    { "gate": "topology-transaction", "path": "evidence/topology.json" },
    { "gate": "provider-restore", "path": "evidence/provider-restore.json" },
    { "gate": "secret-rotation", "path": "evidence/secret-rotation.json" },
    { "gate": "security-scan", "path": "evidence/security-scan.json" },
    { "gate": "face-evaluation", "path": "evidence/face-evaluation.json" }
  ]
}
```

Chạy validator:

```powershell
cd backend
$env:RELEASE_SHA="<deployed-commit-sha>"
$env:RELEASE_GATE_MANIFEST="../docs/release-gate-manifest.json"
$env:EVIDENCE_OUTPUT="../docs/evidence/final-release-gate.json"
npm run verify:release-gate
```

Validator fail-closed khi thiếu gate, trùng evidence, `success` không phải `true`, SHA lệch, timestamp sai, thiếu phê duyệt, proof chuyên biệt của gate không đủ hoặc control vận hành chưa xác nhận.
