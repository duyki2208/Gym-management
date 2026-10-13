import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from evaluate_embeddings import enrich_report, evaluate


class EvaluateEmbeddingsTest(unittest.TestCase):
    def test_far_frr_and_latency(self):
        samples = [
            {"identity": "a", "embedding": [1.0, 0.0], "latency_ms": 10},
            {"identity": "a", "embedding": [0.99, 0.01], "latency_ms": 20},
            {"identity": "b", "embedding": [0.0, 1.0], "latency_ms": 30},
            {"identity": "b", "embedding": [0.01, 0.99], "latency_ms": 40},
        ]

        result = evaluate(samples, [0.45])

        self.assertEqual(result["genuinePairs"], 2)
        self.assertEqual(result["impostorPairs"], 4)
        self.assertEqual(result["operatingPoints"][0]["far"], 0)
        self.assertEqual(result["operatingPoints"][0]["frr"], 0)
        self.assertEqual(result["embeddingLatencyMs"]["p50"], 25)

    def test_rejects_dataset_without_genuine_pairs(self):
        with self.assertRaises(ValueError):
            evaluate([
                {"identity": "a", "embedding": [1.0, 0.0]},
                {"identity": "b", "embedding": [0.0, 1.0]},
            ], [0.45])

    def test_uses_enrollment_split_and_reports_subgroups_and_attacks(self):
        samples = [
            {"identity": "a", "split": "enrollment", "embedding": [1.0, 0.0], "latency_ms": 10},
            {"identity": "b", "split": "enrollment", "embedding": [0.0, 1.0], "latency_ms": 10},
            {"identity": "a", "split": "evaluation", "embedding": [0.99, 0.01], "camera": "cam-1", "lighting": "bright", "demographic_group": "g1"},
            {"identity": "b", "split": "evaluation", "embedding": [0.01, 0.99], "camera": "cam-2", "lighting": "dim", "demographic_group": "g2"},
            {"identity": "spoof", "claimed_identity": "a", "split": "evaluation", "is_attack": True, "attack_type": "print", "embedding": [0.9, 0.1]},
        ]

        result = evaluate(samples, [0.5])

        self.assertEqual(result["protocol"], "enrollment_template_vs_evaluation")
        self.assertEqual(result["genuinePairs"], 2)
        self.assertEqual(result["impostorPairs"], 2)
        self.assertIn("camera", result["subgroups"])
        self.assertEqual(result["presentationAttack"]["sampleCount"], 1)
        self.assertEqual(result["presentationAttack"]["operatingPoints"][0]["apcer"], 1)

    def test_final_report_keeps_consent_and_acquisition_failures(self):
        report = enrich_report(
            {"protocol": "enrollment_template_vs_evaluation", "presentationAttack": {}},
            {
                "model": "test-model",
                "samples": [{"identity": "a"}, {"identity": "b"}],
                "failures": [{"row": 4, "reason": "no_face_detected"}],
                "consent": {"missingConsentRows": ["sample-b.jpg"]},
                "manifest": {"rows": 3},
            },
            "dataset.json",
        )

        self.assertFalse(report["dataQuality"]["consentComplete"])
        self.assertEqual(report["dataQuality"]["failureCount"], 1)
        self.assertEqual(report["dataQuality"]["failureToAcquireRate"], 0.333333)
        self.assertFalse(report["evaluationScope"]["runtimeLivenessEvaluated"])


if __name__ == "__main__":
    unittest.main()
