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

from flask import Flask, request, jsonify
import numpy as np
import cv2
import json
import os

app = Flask(__name__)

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
    """Decode file upload thành OpenCV image (BGR)."""
    try:
        buf = np.frombuffer(file_storage.read(), np.uint8)
        img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
        return img
    except Exception:
        return None


# ──────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'model_loaded': face_app is not None
    })


@app.route('/embed', methods=['POST'])
def embed():
    """
    Nhận ảnh → trả về vector embedding 512 chiều.
    Dùng khi đăng ký khuôn mặt thành viên.

    Request: multipart/form-data
      - image: file ảnh (jpg/png)

    Response:
      { found: bool, embedding: float[] | null, message: str }
    """
    if face_app is None:
        return jsonify({'found': False, 'embedding': None, 'message': 'Model chưa được load'}), 503

    file = request.files.get('image')
    if not file:
        return jsonify({'found': False, 'embedding': None, 'message': 'Thiếu file ảnh'}), 400

    img = decode_image(file)
    if img is None:
        return jsonify({'found': False, 'embedding': None, 'message': 'Không đọc được ảnh'}), 400

    try:
        faces = face_app.get(img)
    except Exception as e:
        return jsonify({'found': False, 'embedding': None, 'message': str(e)}), 500

    if not faces:
        return jsonify({
            'found': False,
            'embedding': None,
            'message': 'Không phát hiện khuôn mặt trong ảnh'
        })

    # Lấy khuôn mặt lớn nhất nếu có nhiều người
    face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    embedding = face.embedding.tolist()

    return jsonify({
        'found': True,
        'embedding': embedding,   # 512 floats
        'message': 'OK'
    })


@app.route('/recognize', methods=['POST'])
def recognize():
    """
    Nhận ảnh + danh sách candidates → trả về member_id khớp nhất.
    Dùng khi check-in bằng FaceID.

    Request: multipart/form-data
      - image     : file ảnh (jpg/png)
      - candidates: JSON string — [{ "member_id": str, "embedding": float[] }, ...]

    Response (matched):
      { matched: true, member_id: str, confidence: float }
    Response (not matched):
      { matched: false, reason: str, best_confidence: float }
    """
    if face_app is None:
        return jsonify({'matched': False, 'reason': 'model_not_loaded'}), 503

    file = request.files.get('image')
    if not file:
        return jsonify({'matched': False, 'reason': 'missing_image'}), 400

    # Parse candidates từ form-data
    candidates_raw = request.form.get('candidates', '[]')
    try:
        candidates = json.loads(candidates_raw)
    except json.JSONDecodeError:
        return jsonify({'matched': False, 'reason': 'invalid_candidates_json'}), 400

    if not candidates:
        return jsonify({'matched': False, 'reason': 'no_candidates'})

    # Decode ảnh
    img = decode_image(file)
    if img is None:
        return jsonify({'matched': False, 'reason': 'invalid_image'}), 400

    # Detect khuôn mặt trong frame
    try:
        faces = face_app.get(img)
    except Exception as e:
        return jsonify({'matched': False, 'reason': f'detection_error: {str(e)}'}), 500

    if not faces:
        return jsonify({'matched': False, 'reason': 'no_face_detected'})

    # Lấy khuôn mặt rõ nhất (lớn nhất trong frame)
    face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    query_vec = face.embedding

    # So sánh với tất cả candidates
    THRESHOLD = 0.45  # Ngưỡng cosine similarity (có thể tuning)
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

    if best_score >= THRESHOLD and best_member_id:
        return jsonify({
            'matched': True,
            'member_id': best_member_id,
            'confidence': round(best_score, 4)
        })
    else:
        return jsonify({
            'matched': False,
            'reason': 'below_threshold',
            'best_confidence': round(best_score, 4)
        })


# ──────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────
if __name__ == '__main__':
    print("[INFO] GymPro Face Service dang khoi dong tren port 5001...")
    app.run(host='0.0.0.0', port=5001, debug=False)
