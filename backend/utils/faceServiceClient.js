/**
 * faceServiceClient.js
 * Helper gọi Python InsightFace microservice.
 * Hỗ trợ truyền branchCode và X-Internal-Secret
 */

const axios = require('axios');
const FormData = require('form-data');

const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || 'http://localhost:5001';
const TIMEOUT_MS = 8000;
const REQUEST_LIMITS = { timeout: TIMEOUT_MS, maxRedirects: 0, maxBodyLength: 32 * 1024 * 1024, maxContentLength: 256 * 1024 };
const validateImage = (buffer) => {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > 5 * 1024 * 1024) {
    throw Object.assign(new Error('Ảnh không hợp lệ hoặc vượt 5 MiB'), { statusCode: 413, code: 'FACE_IMAGE_LIMIT' });
  }
};

const getInternalSecret = () => {
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'INTERNAL_SERVICE_SECRET phải được cấu hình với tối thiểu 32 ký tự'
    );
  }
  return secret;
};

/**
 * Gửi ảnh lên Python service để lấy embedding 512 chiều.
 * @param {Buffer} imageBuffer - Buffer ảnh JPEG/PNG
 * @param {string} [branchCode] - Mã chi nhánh
 * @returns {{ found: boolean, embedding: number[]|null, message: string }}
 */
async function getEmbedding(imageBuffer, branchCode = 'HN01') {
  validateImage(imageBuffer);
  const form = new FormData();
  form.append('image', imageBuffer, { filename: 'face.jpg', contentType: 'image/jpeg' });
  form.append('branchCode', branchCode);

  const headers = {
    ...form.getHeaders(),
    'X-Internal-Secret': getInternalSecret(),
    'X-Branch-Code': branchCode,
  };

  const response = await axios.post(`${FACE_SERVICE_URL}/embed`, form, {
    headers,
    ...REQUEST_LIMITS,
  });

  return response.data;
}

/**
 * Nhận diện khuôn mặt trong ảnh so với danh sách candidates.
 * @param {Buffer} imageBuffer - Buffer ảnh JPEG/PNG
 * @param {{ member_id: string, embedding: number[] }[]} candidates
 * @param {string} [branchCode] - Mã chi nhánh
 * @returns {{ matched: boolean, member_id?: string, confidence?: number, reason?: string }}
 */
async function recognize(imageBuffer, candidates, branchCode = 'HN01', threshold = null) {
  validateImage(imageBuffer);
  if (!Array.isArray(candidates) || candidates.length > 2000) {
    throw Object.assign(new Error('Danh sách nhận diện vượt giới hạn 2.000 hồ sơ'), { statusCode: 503, code: 'FACE_CANDIDATE_LIMIT' });
  }
  const form = new FormData();
  form.append('image', imageBuffer, { filename: 'frame.jpg', contentType: 'image/jpeg' });
  form.append('candidates', JSON.stringify(candidates));
  form.append('branchCode', branchCode);
  if (threshold !== null && threshold !== undefined) {
    form.append('threshold', String(threshold));
  }

  const headers = {
    ...form.getHeaders(),
    'X-Internal-Secret': getInternalSecret(),
    'X-Branch-Code': branchCode,
  };

  const response = await axios.post(`${FACE_SERVICE_URL}/recognize`, form, {
    headers,
    ...REQUEST_LIMITS,
  });

  return response.data;
}

/**
 * Kiểm tra Python service có sống không.
 * @returns {boolean}
 */
async function isHealthy() {
  try {
    const response = await axios.get(`${FACE_SERVICE_URL}/health`, { timeout: 2000 });
    return response.data?.status === 'ok';
  } catch {
    return false;
  }
}

module.exports = { getEmbedding, recognize, isHealthy, getInternalSecret };
