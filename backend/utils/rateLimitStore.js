const cacheService = require("./cacheService");

class CacheRateLimitStore {
  constructor({ prefix }) {
    this.prefix = prefix;
    this.localKeys = false;
    this.windowMs = 60000;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  toKey(key) {
    return `${this.prefix}${key}`;
  }

  increment(key) {
    return cacheService.incrementRateLimit(this.toKey(key), this.windowMs);
  }

  decrement(key) {
    return cacheService.decrementRateLimit(this.toKey(key));
  }

  resetKey(key) {
    return cacheService.resetRateLimit(this.toKey(key));
  }
}

module.exports = CacheRateLimitStore;
