"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheManager = void 0;
/**
 * Cache manager for NOORMME with O(1) LRU eviction.
 */
class CacheManager {
    config;
    cache = new Map();
    hits = 0;
    misses = 0;
    constructor(config = {}) {
        this.config = config;
    }
    /**
     * Get value from cache
     */
    get(key) {
        const item = this.cache.get(key);
        if (!item) {
            this.misses++;
            return null;
        }
        // Check if item has expired
        if (Date.now() - item.timestamp > item.ttl) {
            this.cache.delete(key);
            this.misses++;
            return null;
        }
        // Refresh LRU position (delete and re-add)
        this.cache.delete(key);
        this.cache.set(key, item);
        this.hits++;
        return item.value;
    }
    /**
     * Set value in cache
     */
    async set(key, value, ttl) {
        const item = {
            value,
            timestamp: Date.now(),
            ttl: ttl || this.config.ttl || 300000 // 5 minutes default
        };
        // Refresh LRU position if exists
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        this.cache.set(key, item);
        // Implement LRU eviction if cache is full
        const maxSize = this.config.maxSize || 1000;
        if (this.cache.size > maxSize) {
            this.evictOldest();
        }
    }
    /**
     * Delete value from cache
     */
    delete(key) {
        this.cache.delete(key);
    }
    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }
    /**
     * Get cache statistics
     */
    getStats() {
        const total = this.hits + this.misses;
        return {
            size: this.cache.size,
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? this.hits / total : 0
        };
    }
    /**
     * Get cache hit rate
     */
    getHitRate() {
        const total = this.hits + this.misses;
        return total > 0 ? this.hits / total : 0;
    }
    /**
     * Update cache configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    /**
     * Close cache manager
     */
    async close() {
        this.clear();
    }
    /**
     * Evict oldest items from cache
     */
    evictOldest() {
        if (this.config.strategy === 'fifo') {
            // FIFO: Remove first item (Map iterates in insertion order)
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }
        else {
            // LRU: Remove first item (Map iterates in insertion order, and we update order on access)
            // Since we refresh order on get/set, the first item is always the LRU one.
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }
    }
    /**
     * Clean expired items
     */
    cleanExpired() {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now - item.timestamp > item.ttl) {
                this.cache.delete(key);
            }
        }
    }
    /**
     * Get cache size
     */
    size() {
        return this.cache.size;
    }
    /**
     * Check if key exists in cache
     */
    has(key) {
        const item = this.cache.get(key);
        if (!item)
            return false;
        // Check if item has expired
        if (Date.now() - item.timestamp > item.ttl) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }
    /**
     * Get all cache keys
     */
    keys() {
        return Array.from(this.cache.keys());
    }
    /**
     * Get all cache values
     */
    values() {
        return Array.from(this.cache.values()).map(item => item.value);
    }
    /**
     * Get all cache entries
     */
    entries() {
        return Array.from(this.cache.entries()).map(([key, item]) => [key, item.value]);
    }
}
exports.CacheManager = CacheManager;
