/**
 * faceServiceClient.js
 * Helper gọi Python InsightFace microservice.
 * Có timeout, error handling rõ ràng khi service down.
 */

const axios = require('axios');
const FormData = require('form-data');

const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || 'http://localhost:5001';
const TIMEOUT_MS = 8000; // 8 giây timeout

/**
 * Gửi ảnh lên Python service để lấy embedding 512 chiều.
 * @param {Buffer} imageBuffer - Buffer ảnh JPEG/PNG
 * @returns {{ found: boolean, embedding: number[]|null, message: string }}
 */
async function getEmbedding(imageBuffer) {
  const form = new FormData();
  form.append('image', imageBuffer, { filename: 'face.jpg', contentType: 'image/jpeg' });

  const response = await axios.post(`${FACE_SERVICE_URL}/embed`, form, {
    headers: form.getHeaders(),
    timeout: TIMEOUT_MS,
  });

  return response.data;
}

/**
 * Nhận diện khuôn mặt trong ảnh so với danh sách candidates.
 * @param {Buffer} imageBuffer - Buffer ảnh JPEG/PNG
 * @param {{ member_id: string, embedding: number[] }[]} candidates
 * @returns {{ matched: boolean, member_id?: string, confidence?: number, reason?: string }}
 */
async function recognize(imageBuffer, candidates) {
  const form = new FormData();
  form.append('image', imageBuffer, { filename: 'frame.jpg', contentType: 'image/jpeg' });
  form.append('candidates', JSON.stringify(candidates));

  const response = await axios.post(`${FACE_SERVICE_URL}/recognize`, form, {
    headers: form.getHeaders(),
    timeout: TIMEOUT_MS,
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

module.exports = { getEmbedding, recognize, isHealthy };
