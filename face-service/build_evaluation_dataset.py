"""Build an embedding evaluation dataset from a consented image manifest."""

import argparse
import csv
import json
import time
from pathlib import Path

import cv2
from insightface.app import FaceAnalysis


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, help="CSV: image_path,identity,split")
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default="buffalo_sc")
    parser.add_argument("--model-root", default=str(Path(__file__).parent / "models"))
    return parser.parse_args()


def main():
    args = parse_args()
    manifest_path = Path(args.manifest).resolve()
    model = FaceAnalysis(
        name=args.model,
        root=args.model_root,
        providers=["CPUExecutionProvider"],
    )
    model.prepare(ctx_id=-1, det_size=(640, 640))

    samples = []
    failures = []
    with manifest_path.open("r", encoding="utf-8-sig", newline="") as handle:
        for row_number, row in enumerate(csv.DictReader(handle), start=2):
            identity = (row.get("identity") or "").strip()
            raw_image_path = (row.get("image_path") or "").strip()
            if not identity or not raw_image_path:
                failures.append({"row": row_number, "reason": "missing_identity_or_path"})
                continue

            image_path = Path(raw_image_path)
            if not image_path.is_absolute():
                image_path = manifest_path.parent / image_path
            image = cv2.imread(str(image_path))
            if image is None:
                failures.append({"row": row_number, "reason": "image_unreadable"})
                continue

            started_at = time.perf_counter()
            faces = model.get(image)
            latency_ms = (time.perf_counter() - started_at) * 1000
            if not faces:
                failures.append({"row": row_number, "reason": "no_face_detected"})
                continue
            if len(faces) != 1:
                failures.append({
                    "row": row_number,
                    "reason": "multiple_faces_detected",
                    "detected_faces": len(faces),
                })
                continue

            face = faces[0]
            samples.append({
                "identity": identity,
                "split": (row.get("split") or "evaluation").strip(),
                "image": str(image_path),
                "embedding": face.embedding.tolist(),
                "latency_ms": round(latency_ms, 4),
                "session": (row.get("session") or "").strip(),
                "camera": (row.get("camera") or "unknown").strip(),
                "lighting": (row.get("lighting") or "unknown").strip(),
                "demographic_group": (row.get("demographic_group") or "unspecified").strip(),
                "consent_id": (row.get("consent_id") or "").strip(),
                "is_attack": (row.get("is_attack") or "false").strip().lower() in ("1", "true", "yes"),
                "attack_type": (row.get("attack_type") or "").strip(),
                "claimed_identity": (row.get("claimed_identity") or "").strip(),
            })

    output = {
        "model": args.model,
        "det_size": [640, 640],
        "samples": samples,
        "failures": failures,
        "consent": {
            "missingConsentRows": [
                sample["image"] for sample in samples if not sample.get("consent_id")
            ],
        },
        "manifest": {
            "rows": len(samples) + len(failures),
            "acceptedRows": len(samples),
            "failedRows": len(failures),
        },
    }
    Path(args.output).write_text(json.dumps(output, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({
        "output": str(Path(args.output).resolve()),
        "samples": len(samples),
        "failures": len(failures),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
