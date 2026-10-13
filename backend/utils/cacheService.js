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
let connectionPromise = Promise.resolve(false);
const redisRequired = String(process.env.CACHE_REQUIRE_REDIS || "").toLowerCase() === "true";

// Fallback in-memory cache: Map<key, { value, expiresAt }>
const memoryCache = new Map();
const rateLimitMemory = new Map();

// Tự động dọn dẹp các key hết hạn trong memoryCache mỗi 60 giây
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of memoryCache.entries()) {
    if (item.expiresAt && item.expiresAt < now) {
      memoryCache.delete(key);
    }
  }
  for (const [key, item] of rateLimitMemory.entries()) {
    if (item.resetAt <= now) rateLimitMemory.delete(key);
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

    connectionPromise = redisClient.connect().then(() => {
      isRedisConnected = true;
      console.log("⚡ [CacheService] Kết nối Redis Server thành công!");
      return true;
    }).catch((err) => {
      isRedisConnected = false;
      console.log(redisRequired
        ? "⚠️ [CacheService] Redis bắt buộc nhưng hiện không khả dụng."
        : "ℹ️ [CacheService] Không kết nối được Redis. Đang tự động chuyển sang In-Memory Cache Mode.");
      return false;
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

const assertFallbackAllowed = () => {
  if (redisRequired && !isRedisConnected) {
    const error = new Error("Shared Redis cache is required but unavailable");
    error.code = "CACHE_UNAVAILABLE";
    throw error;
  }
};

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
  assertFallbackAllowed();
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
  assertFallbackAllowed();
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
  assertFallbackAllowed();
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
      let cursor = "0";
      do {
        const [nextCursor, keys] = await redisClient.scan(
          cursor,
          "MATCH",
          `${cleanPrefix}*`,
          "COUNT",
          100
        );
        cursor = nextCursor;
        if (keys.length > 0) await redisClient.del(...keys);
      } while (cursor !== "0");
    } catch (err) {
      console.error("[Cache] Redis delPattern error:", err.message);
    }
  }

  // Memory Fallback
  assertFallbackAllowed();
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
  assertFallbackAllowed();
  memoryCache.clear();
  rateLimitMemory.clear();
};

/**
 * Lấy trạng thái hoạt động hiện tại của Cache
 */
const getStatus = () => {
  return {
    mode: isRedisConnected ? "Redis" : "In-Memory",
    redisConnected: isRedisConnected,
    redisRequired,
    memoryCacheKeysCount: memoryCache.size,
  };
};

const waitForReady = async () => {
  const connected = await connectionPromise;
  if (redisRequired && !connected) assertFallbackAllowed();
  return getStatus();
};

const close = async () => {
  if (!redisClient) return;
  try {
    if (redisClient.status === "ready") await redisClient.quit();
    else redisClient.disconnect();
  } finally {
    isRedisConnected = false;
  }
};

const incrementRateLimit = async (key, windowMs) => {
  if (isRedisConnected && redisClient) {
    const script = `
      local hits = redis.call('INCR', KEYS[1])
      if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
      local ttl = redis.call('PTTL', KEYS[1])
      return { hits, ttl }
    `;
    const [totalHits, ttl] = await redisClient.eval(script, 1, key, windowMs);
    return {
      totalHits: Number(totalHits),
      resetTime: new Date(Date.now() + Math.max(1, Number(ttl))),
    };
  }

  assertFallbackAllowed();
  const now = Date.now();
  const current = rateLimitMemory.get(key);
  const next = !current || current.resetAt <= now
    ? { totalHits: 1, resetAt: now + windowMs }
    : { totalHits: current.totalHits + 1, resetAt: current.resetAt };
  rateLimitMemory.set(key, next);
  return { totalHits: next.totalHits, resetTime: new Date(next.resetAt) };
};

const decrementRateLimit = async (key) => {
  if (isRedisConnected && redisClient) {
    const current = Number(await redisClient.get(key)) || 0;
    if (current > 0) await redisClient.decr(key);
    return;
  }
  const current = rateLimitMemory.get(key);
  if (current?.totalHits > 0) current.totalHits -= 1;
};

const resetRateLimit = async (key) => {
  if (isRedisConnected && redisClient) await redisClient.del(key);
  rateLimitMemory.delete(key);
};

module.exports = {
  get,
  set,
  del,
  delPattern,
  clear,
  getStatus,
  waitForReady,
  close,
  incrementRateLimit,
  decrementRateLimit,
  resetRateLimit,
};
