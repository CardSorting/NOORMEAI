/**
 * Comprehensive unit tests for Cache Manager functionality
 */

import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { CacheManager } from '../../src/cache/cache-manager.js';
import { performanceHelper, memoryHelper } from '../setup/test-helpers.js';

describe('Cache Manager', () => {
  describe('Basic Operations', () => {
    it('should create cache manager with default configuration', () => {
      const cache = new CacheManager();
      expect(cache).to.exist;
      expect(typeof cache.get).to.equal('function');
      expect(typeof cache.set).to.equal('function');
      expect(typeof cache.delete).to.equal('function');
      expect(typeof cache.clear).to.equal('function');
    });

    it('should create cache manager with custom configuration', () => {
      const config = {
        ttl: 60000,
        maxSize: 500,
        strategy: 'fifo' as const
      };
      
      const cache = new CacheManager(config);
      expect(cache).to.exist;
    });

    it('should set and get values', async () => {
      const cache = new CacheManager();
      
      await cache.set('key1', 'value1');
      const value = cache.get('key1');
      
      expect(value).to.equal('value1');
    });

    it('should return null for non-existent keys', () => {
      const cache = new CacheManager();
      
      const value = cache.get('non-existent-key');
      expect(value).to.be.null;
    });

    it('should delete values', async () => {
      const cache = new CacheManager();
      
      await cache.set('key1', 'value1');
      expect(cache.get('key1')).to.equal('value1');
      
      cache.delete('key1');
      expect(cache.get('key1')).to.be.null;
    });

    it('should clear all values', async () => {
      const cache = new CacheManager();
      
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      
      expect(cache.get('key1')).to.equal('value1');
      expect(cache.get('key2')).to.equal('value2');
      expect(cache.get('key3')).to.equal('value3');
      
      cache.clear();
      
      expect(cache.get('key1')).to.be.null;
      expect(cache.get('key2')).to.be.null;
      expect(cache.get('key3')).to.be.null;
    });

    it('should handle different data types', async () => {
      const cache = new CacheManager();
      
      // String
      await cache.set('string', 'hello');
      expect(cache.get('string')).to.equal('hello');
      
      // Number
      await cache.set('number', 42);
      expect(cache.get('number')).to.equal(42);
      
      // Boolean
      await cache.set('boolean', true);
      expect(cache.get('boolean')).to.be.true;
      
      // Object
      const obj = { name: 'test', value: 123 };
      await cache.set('object', obj);
      expect(cache.get('object')).to.deep.equal(obj);
      
      // Array
      const arr = [1, 2, 3, 'test'];
      await cache.set('array', arr);
      expect(cache.get('array')).to.deep.equal(arr);
      
      // Null
      await cache.set('null', null);
      expect(cache.get('null')).to.be.null;
      
      // Undefined
      await cache.set('undefined', undefined);
      expect(cache.get('undefined')).to.be.undefined;
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should expire values after TTL', async () => {
      const cache = new CacheManager({ ttl: 100 }); // 100ms TTL
      
      await cache.set('key1', 'value1');
      expect(cache.get('key1')).to.equal('value1');
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(cache.get('key1')).to.be.null;
    });

    it('should use custom TTL for specific values', async () => {
      const cache = new CacheManager({ ttl: 1000 }); // 1 second default TTL
      
      await cache.set('key1', 'value1', 50); // 50ms custom TTL
      expect(cache.get('key1')).to.equal('value1');
      
      // Wait for custom TTL to expire
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(cache.get('key1')).to.be.null;
    });

    it('should not expire values before TTL', async () => {
      const cache = new CacheManager({ ttl: 1000 }); // 1 second TTL
      
      await cache.set('key1', 'value1');
      expect(cache.get('key1')).to.equal('value1');
      
      // Wait less than TTL
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(cache.get('key1')).to.equal('value1');
    });

    it('should handle zero TTL', async () => {
      const cache = new CacheManager({ ttl: 0 });
      await cache.set('key1', 'value1');
      expect(cache.get('key1')).to.equal('value1');
      
      // With zero TTL, value should not expire
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(cache.get('key1')).to.equal('value1');
    });
  });

  describe('Cache Size Management', () => {
    it('should respect max size limit', async () => {
      const cache = new CacheManager({ maxSize: 3 });
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      
      expect(cache.size()).to.equal(3);
      expect(cache.get('key1')).to.equal('value1');
      expect(cache.get('key2')).to.equal('value2');
      expect(cache.get('key3')).to.equal('value3');
      
      // Adding one more should trigger eviction
      await cache.set('key4', 'value4');
      
      expect(cache.size()).to.equal(3);
      expect(cache.get('key4')).to.equal('value4');
    });

    it('should use LRU eviction strategy by default', async () => {
      const cache = new CacheManager({ maxSize: 3, strategy: 'lru' });
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      
      // Access key1 to make it recently used
      cache.get('key1');
      
      // Add key4, which should evict key2 (least recently used)
      await cache.set('key4', 'value4');
      
      expect(cache.get('key1')).to.equal('value1'); // Should still exist
      expect(cache.get('key2')).to.be.null; // Should be evicted
      expect(cache.get('key3')).to.equal('value3'); // Should still exist
      expect(cache.get('key4')).to.equal('value4'); // Should exist
    });

    it('should use FIFO eviction strategy when configured', async () => {
      const cache = new CacheManager({ maxSize: 3, strategy: 'fifo' });
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      
      // Add key4, which should evict key1 (first in)
      await cache.set('key4', 'value4');
      
      expect(cache.get('key1')).to.be.null; // Should be evicted
      expect(cache.get('key2')).to.equal('value2'); // Should still exist
      expect(cache.get('key3')).to.equal('value3'); // Should still exist
      expect(cache.get('key4')).to.equal('value4'); // Should exist
    });

    it('should handle unlimited size when maxSize is not set', async () => {
      const cache = new CacheManager({ maxSize: undefined });
      // Add many items
      for (let i = 0; i < 1000; i++) {
        await cache.set(`key${i}`, `value${i}`);
      }
      
      expect(cache.size()).to.equal(1000);
      expect(cache.get('key0')).to.equal('value0');
      expect(cache.get('key999')).to.equal('value999');
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track cache statistics', async () => {
      const cache = new CacheManager();
      
      // Initial stats
      let stats = cache.getStats();
      expect(stats.size).to.equal(0);
      expect(stats.hits).to.equal(0);
      expect(stats.misses).to.equal(0);
      expect(stats.hitRate).to.equal(0);
      
      // Add some values
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      
      stats = cache.getStats();
      expect(stats.size).to.equal(2);
      
      // Test hits and misses
      cache.get('key1'); // Hit
      cache.get('key2'); // Hit
      cache.get('key3'); // Miss
      
      stats = cache.getStats();
      expect(stats.hits).to.equal(2);
      expect(stats.misses).to.equal(1);
      expect(stats.hitRate).to.be.closeTo(0.67, 0.01); // 2/3
    });

    it('should track hit rate correctly', async () => {
      const cache = new CacheManager();
      
      await cache.set('key1', 'value1');
      
      // 100% hit rate
      cache.get('key1');
      expect(cache.getHitRate()).to.equal(1);
      
      // 50% hit rate
      cache.get('key2');
      expect(cache.getHitRate()).to.equal(0.5);
      
      // 33% hit rate
      cache.get('key3');
      expect(cache.getHitRate()).to.be.closeTo(0.33, 0.01);
    });

    it('should reset statistics when cleared', async () => {
      const cache = new CacheManager();
      
      await cache.set('key1', 'value1');
      cache.get('key1'); // Hit
      cache.get('key2'); // Miss
      
      let stats = cache.getStats();
      expect(stats.hits).to.equal(1);
      expect(stats.misses).to.equal(1);
      
      cache.clear();
      
      stats = cache.getStats();
      expect(stats.hits).to.equal(0);
      expect(stats.misses).to.equal(0);
      expect(stats.hitRate).to.equal(0);
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration', async () => {
      const cache = new CacheManager({ ttl: 1000, maxSize: 10 });
      // Update configuration
      cache.updateConfig({ ttl: 2000, maxSize: 20 });
      // Test that new configuration is applied
      await cache.set('key1', 'value1');
      expect(cache.get('key1')).to.equal('value1');
      
      // Wait for old TTL to expire but new TTL should still be valid
      await new Promise(resolve => setTimeout(resolve, 1500));
      expect(cache.get('key1')).to.equal('value1');
    });

    it('should handle partial configuration updates', async () => {
      const cache = new CacheManager({ ttl: 1000, maxSize: 10 });
      // Update only TTL
      cache.updateConfig({ ttl: 2000 });
      // TTL should be updated
      await cache.set('key1', 'value1');
      await new Promise(resolve => setTimeout(resolve, 1500));
      expect(cache.get('key1')).to.equal('value1');
      
      // Max size should remain the same
      for (let i = 0; i < 15; i++) {
        await cache.set(`key${i}`, `value${i}`);
      }
      expect(cache.size()).to.equal(10); // Should still be limited to 10
    });
  });

  describe('Utility Methods', () => {
    it('should check if key exists', async () => {
      const cache = new CacheManager();
      
      expect(cache.has('key1')).to.be.false;
      
      await cache.set('key1', 'value1');
      expect(cache.has('key1')).to.be.true;
      
      cache.delete('key1');
      expect(cache.has('key1')).to.be.false;
    });

    it('should handle expired keys in has check', async () => {
      const cache = new CacheManager({ ttl: 100 });
      await cache.set('key1', 'value1');
      expect(cache.has('key1')).to.be.true;
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(cache.has('key1')).to.be.false;
    });

    it('should get all keys', async () => {
      const cache = new CacheManager();
      
      expect(cache.keys()).to.deep.equal([]);
      
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      
      const keys = cache.keys();
      expect(keys).to.include('key1');
      expect(keys).to.include('key2');
      expect(keys).to.include('key3');
      expect(keys.length).to.equal(3);
    });

    it('should get all values', async () => {
      const cache = new CacheManager();
      
      expect(cache.values()).to.deep.equal([]);
      
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      
      const values = cache.values();
      expect(values).to.include('value1');
      expect(values).to.include('value2');
      expect(values).to.include('value3');
      expect(values.length).to.equal(3);
    });

    it('should get all entries', async () => {
      const cache = new CacheManager();
      
      expect(cache.entries()).to.deep.equal([]);
      
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      
      const entries = cache.entries();
      expect(entries).to.deep.include(['key1', 'value1']);
      expect(entries).to.deep.include(['key2', 'value2']);
      expect(entries.length).to.equal(2);
    });

    it('should get cache size', async () => {
      const cache = new CacheManager();
      
      expect(cache.size()).to.equal(0);
      
      await cache.set('key1', 'value1');
      expect(cache.size()).to.equal(1);
      
      await cache.set('key2', 'value2');
      expect(cache.size()).to.equal(2);
      
      cache.delete('key1');
      expect(cache.size()).to.equal(1);
      
      cache.clear();
      expect(cache.size()).to.equal(0);
    });
  });

  describe('Cleanup and Maintenance', () => {
    it('should clean expired items', async () => {
      const cache = new CacheManager({ ttl: 100 });
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      
      expect(cache.size()).to.equal(2);
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Manually clean expired items
      cache.cleanExpired();
      
      expect(cache.size()).to.equal(0);
      expect(cache.get('key1')).to.be.null;
      expect(cache.get('key2')).to.be.null;
    });

    it('should close cache manager', async () => {
      const cache = new CacheManager();
      
      await cache.set('key1', 'value1');
      expect(cache.get('key1')).to.equal('value1');
      
      await cache.close();
      
      // Cache should be cleared after closing
      expect(cache.get('key1')).to.be.null;
      expect(cache.size()).to.equal(0);
    });
  });

  describe('Performance', () => {
    it('should perform operations efficiently', async () => {
      const cache = new CacheManager();
      
      // Test set performance
      const setDuration = await performanceHelper.measure('cache-set', async () => {
        for (let i = 0; i < 1000; i++) {
          await cache.set(`key${i}`, `value${i}`);
        }
      });
      expect(setDuration).to.be.lessThan(100); // 100ms max for 1000 operations
      
      // Test get performance
      const getDuration = await performanceHelper.measure('cache-get', async () => {
        for (let i = 0; i < 1000; i++) {
          cache.get(`key${i}`);
        }
      });
      expect(getDuration).to.be.lessThan(50); // 50ms max for 1000 operations
    });

    it('should handle memory efficiently', async () => {
      const cache = new CacheManager();
      
      const { delta } = await memoryHelper.measureMemory(async () => {
        // Add many items
        for (let i = 0; i < 10000; i++) {
          await cache.set(`key${i}`, `value${i}`);
        }
      });
      // Memory usage should be reasonable
      expect(delta.heapUsed).to.be.lessThan(50); // 50MB limit
    });

    it('should handle concurrent operations', async () => {
      const cache = new CacheManager();
      
      const start = performance.now();
      const promises: Promise<void>[] = [];
      
      // Concurrent set operations
      for (let i = 0; i < 100; i++) {
        promises.push(cache.set(`key${i}`, `value${i}`));
      }
      
      await Promise.all(promises);
      const duration = performance.now() - start;
      
      expect(duration).to.be.lessThan(1000); // 1 second max
      expect(cache.size()).to.equal(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string keys', async () => {
      const cache = new CacheManager();
      
      await cache.set('', 'empty-key-value');
      expect(cache.get('')).to.equal('empty-key-value');
      expect(cache.has('')).to.be.true;
      
      cache.delete('');
      expect(cache.get('')).to.be.null;
    });

    it('should handle special characters in keys', async () => {
      const cache = new CacheManager();
      
      const specialKey = 'key with spaces and symbols!@#$%^&*()';
      await cache.set(specialKey, 'special-value');
      expect(cache.get(specialKey)).to.equal('special-value');
    });

    it('should handle very large values', async () => {
      const cache = new CacheManager();
      
      const largeValue = 'x'.repeat(1000000); // 1MB string
      await cache.set('large-key', largeValue);
      expect(cache.get('large-key')).to.equal(largeValue);
    });

    it('should handle rapid set/get operations', async () => {
      const cache = new CacheManager();
      
      // Rapid operations
      for (let i = 0; i < 1000; i++) {
        await cache.set(`key${i}`, `value${i}`);
        const value = cache.get(`key${i}`);
        expect(value).to.equal(`value${i}`);
      }
      
      expect(cache.size()).to.equal(1000);
    });

    it('should handle undefined and null values', async () => {
      const cache = new CacheManager();
      
      await cache.set('null-key', null);
      await cache.set('undefined-key', undefined);
      
      expect(cache.get('null-key')).to.be.null;
      expect(cache.get('undefined-key')).to.be.undefined;
      
      expect(cache.has('null-key')).to.be.true;
      expect(cache.has('undefined-key')).to.be.true;
    });
  });
});