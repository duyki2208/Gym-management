import importlib.util
import io
import json
import os
from pathlib import Path
import struct
import sys
import types
import unittest
from unittest.mock import patch
import zlib

import numpy as np
from PIL import Image, PngImagePlugin


class FakeFaceAnalysis:
    def __init__(self, **_kwargs):
        pass

    def prepare(self, **_kwargs):
        pass

    def get(self, _image):
        return [types.SimpleNamespace(bbox=np.array([0, 0, 10, 10]), embedding=np.array([1.0] + [0.0] * 511))]


def png(size=(16, 16)):
    result = io.BytesIO()
    Image.new("RGB", size, (255, 0, 0)).save(result, format="PNG")
    return result.getvalue()


class FaceApiSecurityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location("face_api_security_test", Path(__file__).parents[1] / "app.py")
        cls.module = importlib.util.module_from_spec(spec)
        fake = types.ModuleType("insightface.app")
        fake.FaceAnalysis = FakeFaceAnalysis
        with patch.dict(os.environ, {"INTERNAL_SERVICE_SECRET": "test-" + "s" * 40}), patch.dict(sys.modules, {"insightface": types.ModuleType("insightface"), "insightface.app": fake}):
            spec.loader.exec_module(cls.module)
        cls.module.app.config["TESTING"] = True

    def setUp(self):
        self.client = self.module.app.test_client()
        self.headers = {"X-Internal-Secret": self.module.INTERNAL_SECRET, "X-Branch-Code": "HN01"}
        self.vector = [1.0] + [0.0] * 511

    def post(self, path="/embed", image=None, **fields):
        payload = {"image": (io.BytesIO(png() if image is None else image), "face.png"), **fields}
        return self.client.post(path, data=payload, headers=self.headers)

    def test_valid_image_embedding_and_recognition(self):
        response = self.post()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json["embedding"]), 512)
        response = self.post("/recognize", candidates=json.dumps([{"member_id": "member-1", "embedding": self.vector}]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["member_id"], "member-1")
        self.assertEqual(response.json["branch_code"], "HN01")

    def test_authentication_precedes_form_parsing(self):
        response = self.client.post("/embed", data=b"not multipart", headers={"X-Internal-Secret": "wrong"})
        self.assertEqual(response.status_code, 401)

    def test_wrong_type_duplicate_ids_and_invalid_vectors_are_rejected(self):
        invalid = [{}, "string", ["bad"], [{"member_id": "member", "embedding": [1] * 511}],
                   [{"member_id": "member", "embedding": [True] * 512}],
                   [{"member_id": "member", "embedding": [float("nan")] * 512}],
                   [{"member_id": "member", "embedding": [float("inf")] * 512}],
                   [{"member_id": "member", "embedding": [0] * 512}],
                   [{"member_id": "member", "embedding": self.vector}] * 2]
        with patch.object(self.module.face_app, "get") as model:
            for value in invalid:
                with self.subTest(value_type=type(value).__name__):
                    self.assertEqual(self.post("/recognize", candidates=json.dumps(value)).status_code, 400)
            self.assertEqual(self.post("/recognize", candidates="not json").status_code, 400)
            self.assertEqual(self.post("/recognize", candidates=json.dumps([{}] * (self.module.MAX_CANDIDATES + 1))).status_code, 400)
            model.assert_not_called()

    def test_invalid_thresholds_are_rejected(self):
        for threshold in ["NaN", "Infinity", "-1", "1.5", "bad"]:
            with self.subTest(threshold=threshold):
                self.assertEqual(self.post("/recognize", candidates=json.dumps([{"member_id": "member", "embedding": self.vector}]), threshold=threshold).status_code, 400)

    def test_bad_images_and_dimension_bombs_do_not_reach_model(self):
        def chunk(kind, value):
            return struct.pack(">I", len(value)) + kind + value + struct.pack(">I", zlib.crc32(kind + value) & 0xffffffff)
        bomb = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 64000, 64000, 8, 2, 0, 0, 0)) + chunk(b"IEND", b"")
        with patch.object(self.module.face_app, "get") as model:
            for image in [b"<script>fake image</script>", b"\xff\xd8\xfffake", png((4097, 1)), bomb]:
                self.assertEqual(self.post(image=image).status_code, 400)
            model.assert_not_called()

    def test_file_request_and_form_field_limits_return_413(self):
        self.assertEqual(self.post(image=b"x" * (self.module.MAX_IMAGE_BYTES + 1)).status_code, 413)
        with patch.dict(self.module.app.config, {"MAX_CONTENT_LENGTH": 1024}):
            self.assertEqual(self.post(image=b"x" * 2048).status_code, 413)
        with patch.dict(self.module.app.config, {"MAX_FORM_MEMORY_SIZE": 1024}):
            self.assertEqual(self.post("/recognize", candidates="x" * 2048).status_code, 413)
        self.assertEqual(self.post().status_code, 200)  # slots are released after errors

    def test_busy_model_returns_503_and_health_remains_available(self):
        self.assertTrue(self.module.face_slot.acquire(blocking=False))
        try:
            self.assertEqual(self.post().status_code, 503)
            self.assertEqual(self.client.get("/health").status_code, 200)
        finally:
            self.module.face_slot.release()

    def test_model_failures_do_not_expose_exception_details(self):
        with patch.object(self.module.face_app, "get", side_effect=RuntimeError("private-internal-model-path")):
            response = self.post()
            self.assertEqual(response.status_code, 500)
            self.assertNotIn("private-internal-model-path", response.get_data(as_text=True))
        with patch.object(self.module, "face_app", None):
            self.assertEqual(self.client.get("/health").status_code, 503)

    def test_animation_and_compressed_metadata_are_rejected(self):
        animated = io.BytesIO()
        first = Image.new("RGB", (16, 16), "red")
        first.save(animated, format="PNG", save_all=True, append_images=[Image.new("RGB", (16, 16), "blue")], duration=100, loop=0)
        self.assertEqual(self.post(image=animated.getvalue()).status_code, 400)
        text = PngImagePlugin.PngInfo()
        text.add_text("comment", "x" * (64 * 1024 + 1), zip=True)
        payload = io.BytesIO()
        first.save(payload, format="PNG", pnginfo=text)
        self.assertEqual(self.post(image=payload.getvalue()).status_code, 400)


if __name__ == "__main__":
    unittest.main()
