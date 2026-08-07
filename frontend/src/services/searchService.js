import api from './api';

/**
 * searchService — Gọi Global Search endpoint
 *
 * @param {string} q - Từ khóa tìm kiếm
 * @param {Object} options
 * @param {string[]} [options.categories] - Danh sách category muốn tìm (mặc định: tất cả)
 * @param {number} [options.limit=5] - Số kết quả tối đa mỗi nhóm
 */
export const searchService = {
  search: async (q, { categories, limit = 5 } = {}) => {
    try {
      const params = { q, limit };
      if (categories && categories.length > 0) {
        params.categories = categories.join(',');
      }
      // silentError: true → bypass global toast trong api.js interceptor
      const res = await api.get('/search', { params, silentError: true });
      return res.data;
    } catch (err) {
      // Không log khi server chưa kịp restart (404), chỉ log lỗi thực sự
      if (err?.response?.status !== 404) {
        console.error('[searchService] Error:', err);
      }
      return {
        success: false,
        data: { customers: [], staff: [], packages: [], leads: [], products: [] },
        total: 0,
        query: q,
      };
    }
  },
};
