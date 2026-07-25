/**
 * Cache Service với Dual-mode:
 * 1. Redis Mode: Khi có REDIS_URL hoặc Redis Server đang chạy
 * 2. In-Memory Mode (Fallback): Khi không kết nối được Redis, tự động dùng bộ nhớ RAM Node.js
 * Đảm bảo 100% không crash ứng dụng trong bất kỳ môi trường nào.
 */

let Redis;
try {
  Redis = require("ioredis");
} catch (err) {
  Redis = null;
}

let redisClient = null;
let isRedisConnected = false;

// Fallback in-memory cache: Map<key, { value, expiresAt }>
const memoryCache = new Map();

// Tự động dọn dẹp các key hết hạn trong memoryCache mỗi 60 giây
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of memoryCache.entries()) {
    if (item.expiresAt && item.expiresAt < now) {
      memoryCache.delete(key);
    }
  }
}, 60000).unref(); // unref để không làm đơ event loop khi shutdown Node

// Khởi tạo kết nối Redis (nếu có cấu hình hoặc cài đặt)
if (Redis) {
  const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      retryStrategy(times) {
        if (times > 3) {
          // Thử 3 lần không được thì thôi kết nối để dùng fallback memory
          return null;
        }
        return Math.min(times * 100, 1000);
      },
      lazyConnect: true,
    });

    redisClient.connect().then(() => {
      isRedisConnected = true;
      console.log("⚡ [CacheService] Kết nối Redis Server thành công!");
    }).catch((err) => {
      isRedisConnected = false;
      console.log("ℹ️ [CacheService] Không kết nối được Redis. Đang tự động chuyển sang In-Memory Cache Mode.");
    });

    redisClient.on("error", (err) => {
      if (isRedisConnected) {
        console.warn("⚠️ [CacheService] Lỗi Redis client, chuyển tạm sang In-Memory mode:", err.message);
      }
      isRedisConnected = false;
    });

    redisClient.on("connect", () => {
      isRedisConnected = true;
    });
  } catch (err) {
    isRedisConnected = false;
  }
}

/**
 * Lấy dữ liệu từ Cache
 * @param {string} key 
 * @returns {Promise<any|null>}
 */
const get = async (key) => {
  if (isRedisConnected && redisClient) {
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error("[Cache] Redis get error:", err.message);
    }
  }

  // Memory Fallback
  const cached = memoryCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt && cached.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return cached.value;
};

/**
 * Ghi dữ liệu vào Cache
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttlSeconds Thời gian hết hạn (mặc định 300 giây = 5 phút)
 */
const set = async (key, value, ttlSeconds = 300) => {
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(value), "EX", ttlSeconds);
      return true;
    } catch (err) {
      console.error("[Cache] Redis set error:", err.message);
    }
  }

  // Memory Fallback
  const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
  memoryCache.set(key, { value, expiresAt });
  return true;
};

/**
 * Xóa 1 key khỏi Cache
 * @param {string} key 
 */
const del = async (key) => {
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.del(key);
    } catch (err) {
      console.error("[Cache] Redis del error:", err.message);
    }
  }
  memoryCache.delete(key);
};

/**
 * Xóa các key theo pattern (Ví dụ: 'packages:*' hoặc 'settings:*')
 * @param {string} patternPrefix 
 */
const delPattern = async (patternPrefix) => {
  const cleanPrefix = patternPrefix.replace("*", "");
  
  if (isRedisConnected && redisClient) {
    try {
      const keys = await redisClient.keys(`${cleanPrefix}*`);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } catch (err) {
      console.error("[Cache] Redis delPattern error:", err.message);
    }
  }

  // Memory Fallback
  for (const key of memoryCache.keys()) {
    if (key.startsWith(cleanPrefix)) {
      memoryCache.delete(key);
    }
  }
};

/**
 * Xóa sạch toàn bộ cache
 */
const clear = async () => {
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.flushdb();
    } catch (err) {
      console.error("[Cache] Redis flush error:", err.message);
    }
  }
  memoryCache.clear();
};

/**
 * Lấy trạng thái hoạt động hiện tại của Cache
 */
const getStatus = () => {
  return {
    mode: isRedisConnected ? "Redis" : "In-Memory",
    redisConnected: isRedisConnected,
    memoryCacheKeysCount: memoryCache.size,
  };
};

module.exports = {
  get,
  set,
  del,
  delPattern,
  clear,
  getStatus,
};
