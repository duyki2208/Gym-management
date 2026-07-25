const cacheService = require("../utils/cacheService");

/**
 * Express Middleware tự động Cache kết quả response cho các API GET
 * @param {number} ttlSeconds Thời gian lưu cache (tính bằng giây). Mặc định 300s (5 phút)
 * @param {string} keyPrefix Prefix nhận diện cho cache key
 */
const cacheMiddleware = (ttlSeconds = 300, keyPrefix = "") => {
  return async (req, res, next) => {
    // Chỉ cache các request HTTP GET
    if (req.method !== "GET") {
      return next();
    }

    // Đặt tên key theo URL và query parameters
    const prefix = keyPrefix ? `${keyPrefix}:` : "";
    const cacheKey = `api:${prefix}${req.originalUrl || req.url}`;

    try {
      const cachedData = await cacheService.get(cacheKey);

      if (cachedData) {
        // CACHE HIT ➔ Trả về trực tiếp từ RAM/Redis, thêm Header X-Cache: HIT
        res.setHeader("X-Cache", "HIT");
        return res.json(cachedData);
      }

      // CACHE MISS ➔ Chờ Controller xử lý và ghi đè res.json để lưu kết quả vào Cache
      res.setHeader("X-Cache", "MISS");

      const originalJson = res.json.bind(res);

      res.json = (body) => {
        // Chỉ lưu cache khi statusCode thành công (200 - 299)
        if (res.statusCode >= 200 && res.statusCode < 300 && body) {
          cacheService.set(cacheKey, body, ttlSeconds).catch((err) => {
            console.error("[cacheMiddleware] Error saving to cache:", err.message);
          });
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      console.error("[cacheMiddleware] Error checking cache:", err.message);
      next(); // Khi có lỗi cache middleware thì bỏ qua, đi thẳng vào controller
    }
  };
};

module.exports = cacheMiddleware;
