"""
GymPro Face Recognition Service
================================
Flask microservice dùng InsightFace để:
  - /embed    : Nhận ảnh → trả về vector embedding 512 chiều
  - /recognize: Nhận ảnh + candidates → trả về member_id khớp nhất
  - /health   : Health check

Chạy: python app.py
Port: 5001
"""

from flask import Flask, Request, request, jsonify, g
import numpy as np
import json
import os
import hmac
import io
import threading
import warnings
from PIL import Image, ImageOps, PngImagePlugin, UnidentifiedImageError
from werkzeug.exceptions import RequestEntityTooLarge

app = Flask(__name__)


class UploadRequest(Request):
    """Close even partially parsed upload streams when a multipart limit fails."""
    def _get_file_stream(self, *args, **kwargs):
        stream = super()._get_file_stream(*args, **kwargs)
        self.__dict__.setdefault("_upload_streams", []).append(stream)
        return stream

    def close(self):
        try:
            super().close()
        finally:
            for stream in self.__dict__.pop("_upload_streams", []):
                stream.close()


app.request_class = UploadRequest
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_IMAGE_PIXELS = 4_000_000
MAX_IMAGE_DIMENSION = 4096
MAX_CANDIDATES = 2000
app.config.update(MAX_CONTENT_LENGTH=32 * 1024 * 1024,
                  MAX_FORM_MEMORY_SIZE=24 * 1024 * 1024, MAX_FORM_PARTS=6)
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
PngImagePlugin.MAX_TEXT_CHUNK = 64 * 1024
PngImagePlugin.MAX_TEXT_MEMORY = 1024 * 1024
face_slot = threading.BoundedSemaphore(1)

INTERNAL_SECRET = os.environ.get("INTERNAL_SERVICE_SECRET", "")
if len(INTERNAL_SECRET) < 32:
    raise RuntimeError(
        "INTERNAL_SERVICE_SECRET must be configured with at least 32 characters"
    )

MATCH_THRESHOLD = float(os.environ.get("FACE_MATCH_THRESHOLD", "0.60"))
if not 0.0 <= MATCH_THRESHOLD <= 1.0:
    raise RuntimeError("FACE_MATCH_THRESHOLD must be between 0 and 1")

def verify_internal_secret():
    """Bắt buộc xác thực mọi request xử lý dữ liệu khuôn mặt."""
    secret = request.headers.get("X-Internal-Secret")
    return bool(secret) and len(secret) <= 256 and hmac.compare_digest(secret.encode("utf-8"), INTERNAL_SECRET.encode("utf-8"))


@app.before_request
def guard_face_request():
    if request.path not in ("/embed", "/recognize"):
        return None
    if not verify_internal_secret():
        return jsonify({"success": False, "reason": "unauthorized"}), 401
    if request.content_length is not None and request.content_length > app.config["MAX_CONTENT_LENGTH"]:
        raise RequestEntityTooLarge()
    if not face_slot.acquire(blocking=False):
        return jsonify({"success": False, "reason": "face_service_busy"}), 503
    g.face_slot = True


@app.teardown_request
def release_face_slot(_error):
    if getattr(g, "face_slot", False):
        g.face_slot = False
        face_slot.release()


@app.errorhandler(RequestEntityTooLarge)
def too_large(_error):
    return jsonify({"success": False, "reason": "payload_too_large"}), 413


class FaceInputError(ValueError):
    pass


@app.errorhandler(FaceInputError)
def invalid_face_input(error):
    return jsonify({"success": False, "reason": str(error)}), 400


def valid_vector(value):
    if not isinstance(value, (list, np.ndarray)):
        return False
    try:
        if len(value) != 512:
            return False
        vector = np.asarray(value, dtype=np.float64)
        return vector.shape == (512,) and bool(np.all(np.isfinite(vector))) and bool(0 < np.linalg.norm(vector) < 1e6)
    except (ValueError, TypeError, OverflowError):
        return False


def parse_candidates(raw):
    try:
        candidates = json.loads(raw)
    except (ValueError, TypeError):
        raise FaceInputError("invalid_candidates_json")
    if not isinstance(candidates, list) or len(candidates) > MAX_CANDIDATES:
        raise FaceInputError("invalid_candidates_count")
    seen = set()
    for candidate in candidates:
        if not isinstance(candidate, dict):
            raise FaceInputError("invalid_candidate")
        member_id, vector = candidate.get("member_id"), candidate.get("embedding")
        if not isinstance(member_id, str) or not 1 <= len(member_id) <= 100 or member_id in seen:
            raise FaceInputError("invalid_member_id")
        if not isinstance(vector, list) or len(vector) != 512 or any(isinstance(n, bool) or not isinstance(n, (int, float)) for n in vector) or not valid_vector(vector):
            raise FaceInputError("invalid_embedding")
        seen.add(member_id)
    return candidates


def image_upload():
    if set(request.files) != {"image"} or len(request.files.getlist("image")) != 1:
        raise FaceInputError("expected_one_image")
    return request.files["image"]

# ──────────────────────────────────────────────
# Khởi tạo InsightFace — load 1 lần khi start
# buffalo_sc: model nhẹ, đủ dùng, chạy tốt trên CPU
# ──────────────────────────────────────────────
try:
    from insightface.app import FaceAnalysis
    face_app = FaceAnalysis(
        name='buffalo_sc',
        root=os.path.join(os.path.dirname(__file__), 'models'),
        providers=['CPUExecutionProvider']
    )
    face_app.prepare(ctx_id=-1, det_size=(640, 640))
    print("[SUCCESS] InsightFace model loaded successfully")
except Exception as e:
    face_app = None
    print(f"[ERROR] Failed to load InsightFace: {e}")


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Tính cosine similarity giữa 2 vector."""
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def decode_image(file_storage) -> np.ndarray | None:
    """Inspect dimensions before decoding pixels; return bounded BGR input."""
    raw = file_storage.read(MAX_IMAGE_BYTES + 1)
    if len(raw) > MAX_IMAGE_BYTES:
        raise RequestEntityTooLarge()
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw), formats=["JPEG", "PNG", "WEBP"]) as image:
                width, height = image.size
                if (width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION or
                        width * height > MAX_IMAGE_PIXELS or getattr(image, "is_animated", False)):
                    raise FaceInputError("image_dimensions_or_animation_not_allowed")
                rgb = ImageOps.exif_transpose(image).convert("RGB")
                return np.asarray(rgb, dtype=np.uint8)[:, :, ::-1].copy()
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise FaceInputError("image_pixel_limit_exceeded")
    except FaceInputError:
        raise
    except (UnidentifiedImageError, OSError, ValueError):
        raise FaceInputError("invalid_image")


# ──────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'model_loaded': face_app is not None
    }), 200 if face_app is not None else 503


@app.route('/embed', methods=['POST'])
def embed():
    """
    Nhận ảnh → trả về vector embedding 512 chiều.
    Dùng khi đăng ký khuôn mặt thành viên.
    """
    if not verify_internal_secret():
        return jsonify({'found': False, 'embedding': None, 'message': 'Unauthorized'}), 401

    branch_code = request.headers.get("X-Branch-Code", request.form.get("branchCode", "DEFAULT"))

    if face_app is None:
        return jsonify({'found': False, 'embedding': None, 'message': 'Model chưa được load'}), 503

    file = image_upload()
    if not file:
        return jsonify({'found': False, 'embedding': None, 'message': 'Thiếu file ảnh'}), 400

    img = decode_image(file)
    if img is None:
        return jsonify({'found': False, 'embedding': None, 'message': 'Không đọc được ảnh'}), 400

    try:
        faces = face_app.get(img)
    except Exception:
        return jsonify({'found': False, 'embedding': None, 'message': 'detection_error'}), 500

    if not faces:
        return jsonify({
            'found': False,
            'embedding': None,
            'message': 'Không phát hiện khuôn mặt trong ảnh'
        })

    face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    embedding = face.embedding.tolist()
    if not valid_vector(embedding):
        return jsonify({'found': False, 'embedding': None, 'message': 'invalid_model_output'}), 503

    return jsonify({
        'found': True,
        'embedding': embedding,
        'branch_code': branch_code,
        'message': 'OK'
    })


@app.route('/recognize', methods=['POST'])
def recognize():
    """
    Nhận ảnh + danh sách candidates → trả về member_id khớp nhất.
    """
    if not verify_internal_secret():
        return jsonify({'matched': False, 'reason': 'unauthorized'}), 401

    branch_code = request.headers.get("X-Branch-Code", request.form.get("branchCode", "DEFAULT"))

    if face_app is None:
        return jsonify({'matched': False, 'reason': 'model_not_loaded'}), 503

    file = image_upload()
    if not file:
        return jsonify({'matched': False, 'reason': 'missing_image'}), 400

    candidates_raw = request.form.get('candidates', '[]')
    candidates = parse_candidates(candidates_raw)

    if not candidates:
        return jsonify({'matched': False, 'reason': 'no_candidates'})

    threshold = MATCH_THRESHOLD
    threshold_raw = request.form.get('threshold')
    if threshold_raw is not None:
        try:
            threshold = float(threshold_raw)
        except ValueError:
            return jsonify({'matched': False, 'reason': 'invalid_threshold'}), 400
        if not 0.0 <= threshold <= 1.0:
            return jsonify({'matched': False, 'reason': 'invalid_threshold'}), 400

    img = decode_image(file)
    if img is None:
        return jsonify({'matched': False, 'reason': 'invalid_image'}), 400

    try:
        faces = face_app.get(img)
    except Exception:
        return jsonify({'matched': False, 'reason': 'detection_error'}), 500

    if not faces:
        return jsonify({'matched': False, 'reason': 'no_face_detected'})

    face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    query_vec = face.embedding
    if not valid_vector(query_vec):
        return jsonify({'matched': False, 'reason': 'invalid_model_output'}), 503

    best_member_id = None
    best_score = 0.0

    for c in candidates:
        if not c.get('member_id') or not c.get('embedding'):
            continue
        try:
            db_vec = np.array(c['embedding'], dtype=np.float32)
            score = cosine_similarity(query_vec, db_vec)
            if score > best_score:
                best_score = score
                best_member_id = c['member_id']
        except Exception:
            continue

    if best_score >= threshold and best_member_id:
        return jsonify({
            'matched': True,
            'member_id': best_member_id,
            'confidence': round(best_score, 4),
            'threshold': threshold,
            'branch_code': branch_code
        })
    else:
        return jsonify({
            'matched': False,
            'reason': 'below_threshold',
            'best_confidence': round(best_score, 4),
            'threshold': threshold,
            'branch_code': branch_code
        })


if __name__ == '__main__':
    print("[INFO] GymPro Face Service dang khoi dong tren port 5001...")
    app.run(host='0.0.0.0', port=5001, debug=False)
