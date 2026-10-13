"""Calculate verification FAR/FRR/EER and embedding latency from a JSON dataset."""

import argparse
import json
from itertools import combinations
from pathlib import Path

import numpy as np


def percentile(values, ratio):
    if not values:
        return None
    return round(float(np.percentile(values, ratio * 100)), 4)


def cosine_similarity(first, second):
    first = np.asarray(first, dtype=np.float32)
    second = np.asarray(second, dtype=np.float32)
    denominator = np.linalg.norm(first) * np.linalg.norm(second)
    if denominator == 0:
        return 0.0
    return float(np.dot(first, second) / denominator)


def operating_points(genuine_scores, impostor_scores, thresholds):
    points = []
    for threshold in thresholds:
        false_accepts = sum(score >= threshold for score in impostor_scores)
        false_rejects = sum(score < threshold for score in genuine_scores)
        points.append({
            "threshold": round(float(threshold), 4),
            "far": round(false_accepts / len(impostor_scores), 6),
            "frr": round(false_rejects / len(genuine_scores), 6),
            "falseAccepts": false_accepts,
            "falseRejects": false_rejects,
        })
    return points


def enrollment_scores(samples):
    enrollments = [sample for sample in samples if sample.get("split") == "enrollment" and not sample.get("is_attack")]
    evaluations = [sample for sample in samples if sample.get("split") == "evaluation" and not sample.get("is_attack")]
    if not enrollments or not evaluations:
        return None
    templates = {}
    for identity in {sample["identity"] for sample in enrollments}:
        vectors = [sample["embedding"] for sample in enrollments if sample["identity"] == identity]
        template = np.mean(np.asarray(vectors, dtype=np.float32), axis=0)
        norm = np.linalg.norm(template)
        templates[identity] = template / norm if norm else template
    genuine_scores = []
    impostor_scores = []
    scored_evaluations = []
    for sample in evaluations:
        if sample["identity"] not in templates:
            continue
        sample_scores = {}
        for identity, template in templates.items():
            score = cosine_similarity(sample["embedding"], template)
            sample_scores[identity] = score
            (genuine_scores if identity == sample["identity"] else impostor_scores).append(score)
        scored_evaluations.append((sample, sample_scores))
    if not genuine_scores or not impostor_scores:
        raise ValueError("Enrollment/evaluation split must contain at least two enrolled identities")
    return genuine_scores, impostor_scores, templates, scored_evaluations


def subgroup_metrics(scored_evaluations, thresholds):
    output = {}
    for field in ("camera", "lighting", "demographic_group"):
        groups = {}
        for sample, scores in scored_evaluations:
            label = sample.get(field) or "unspecified"
            bucket = groups.setdefault(label, {"genuine": [], "impostor": []})
            for identity, score in scores.items():
                bucket["genuine" if identity == sample["identity"] else "impostor"].append(score)
        output[field] = {}
        for label, bucket in groups.items():
            if bucket["genuine"] and bucket["impostor"]:
                output[field][label] = {
                    "samples": sum(1 for sample, _ in scored_evaluations if (sample.get(field) or "unspecified") == label),
                    "operatingPoints": operating_points(bucket["genuine"], bucket["impostor"], thresholds),
                }
    return output


def evaluate(samples, thresholds):
    if len(samples) < 2:
        raise ValueError("At least two samples are required")
    dimensions = {len(sample.get("embedding", [])) for sample in samples}
    if len(dimensions) != 1 or 0 in dimensions:
        raise ValueError("All embeddings must have the same non-zero dimension")

    split_scores = enrollment_scores(samples)
    templates = None
    scored_evaluations = []
    if split_scores:
        genuine_scores, impostor_scores, templates, scored_evaluations = split_scores
        protocol = "enrollment_template_vs_evaluation"
    else:
        protocol = "pairwise_legacy"
        genuine_scores = []
        impostor_scores = []
        for first, second in combinations(samples, 2):
            score = cosine_similarity(first["embedding"], second["embedding"])
            if first["identity"] == second["identity"]:
                genuine_scores.append(score)
            else:
                impostor_scores.append(score)

    if not genuine_scores or not impostor_scores:
        raise ValueError("Dataset must contain both genuine and impostor pairs")

    points = operating_points(genuine_scores, impostor_scores, thresholds)

    eer_point = min(points, key=lambda point: abs(point["far"] - point["frr"]))
    latencies = [float(sample["latency_ms"]) for sample in samples if sample.get("latency_ms") is not None]
    result = {
        "protocol": protocol,
        "sampleCount": len(samples),
        "identityCount": len({sample["identity"] for sample in samples}),
        "embeddingDimension": dimensions.pop(),
        "genuinePairs": len(genuine_scores),
        "impostorPairs": len(impostor_scores),
        "scoreDistribution": {
            "genuineP05": percentile(genuine_scores, 0.05),
            "genuineP50": percentile(genuine_scores, 0.50),
            "impostorP50": percentile(impostor_scores, 0.50),
            "impostorP95": percentile(impostor_scores, 0.95),
        },
        "operatingPoints": points,
        "approximateEer": round((eer_point["far"] + eer_point["frr"]) / 2, 6),
        "approximateEerThreshold": eer_point["threshold"],
        "embeddingLatencyMs": {
            "count": len(latencies),
            "p50": percentile(latencies, 0.50),
            "p95": percentile(latencies, 0.95),
            "p99": percentile(latencies, 0.99),
        },
    }
    if scored_evaluations:
        result["subgroups"] = subgroup_metrics(scored_evaluations, thresholds)
    attack_samples = [sample for sample in samples if sample.get("is_attack")]
    if attack_samples and templates:
        attack_scores = []
        by_type = {}
        for sample in attack_samples:
            claimed = sample.get("claimed_identity") or sample.get("identity")
            if claimed not in templates:
                continue
            score = cosine_similarity(sample["embedding"], templates[claimed])
            attack_scores.append(score)
            by_type.setdefault(sample.get("attack_type") or "unspecified", []).append(score)
        result["presentationAttack"] = {
            "sampleCount": len(attack_scores),
            "note": "Embedding acceptance is not a liveness detector; APCER must also be measured with the runtime liveness control.",
            "operatingPoints": [
                {
                    "threshold": round(float(threshold), 4),
                    "acceptedAttacks": sum(score >= threshold for score in attack_scores),
                    "apcer": round(sum(score >= threshold for score in attack_scores) / len(attack_scores), 6),
                }
                for threshold in thresholds
            ] if attack_scores else [],
            "attackTypes": {
                name: {"samples": len(scores), "scoreP95": percentile(scores, 0.95)}
                for name, scores in by_type.items()
            },
        }
    return result


def enrich_report(result, payload, source):
    """Attach consent/acquisition evidence that must survive the metrics step."""
    failures = payload.get("failures", [])
    samples = payload.get("samples", [])
    missing_consent = payload.get("consent", {}).get("missingConsentRows", [])
    manifest_rows = payload.get("manifest", {}).get(
        "rows", len(samples) + len(failures)
    )
    result["model"] = payload.get("model")
    result["source"] = source
    result["dataQuality"] = {
        "manifestRows": manifest_rows,
        "acceptedRows": len(samples),
        "failureCount": len(failures),
        "failureToAcquireRate": round(len(failures) / manifest_rows, 6) if manifest_rows else None,
        "failures": failures,
        "missingConsentRows": missing_consent,
        "consentComplete": len(missing_consent) == 0,
    }
    result["evaluationScope"] = {
        "runtimeLivenessEvaluated": False,
        "embeddingAttackAcceptanceOnly": "presentationAttack" in result,
        "productionDecisionRequiresSeparateLivenessEvidence": True,
    }
    return result


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output")
    parser.add_argument(
        "--thresholds",
        default="0.30,0.35,0.40,0.45,0.50,0.55,0.60,0.65,0.70",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    payload = json.loads(Path(args.input).read_text(encoding="utf-8"))
    thresholds = [float(value) for value in args.thresholds.split(",")]
    result = enrich_report(
        evaluate(payload.get("samples", []), thresholds),
        payload,
        str(Path(args.input).resolve()),
    )
    serialized = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(serialized, encoding="utf-8")
    print(serialized)


if __name__ == "__main__":
    main()
