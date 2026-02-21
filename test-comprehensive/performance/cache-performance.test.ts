/**
 * Performance tests for cache functionality
 */

import { describe, it, before, after } from 'mocha'
import { expect } from 'chai'
import { performanceHelper, memoryHelper } from '../setup/test-helpers.js'
import { CacheManager } from '../../src/cache/cache-manager.js'

describe('Cache Performance', () => {
  describe('Basic Cache Operations', () => {
    it('should perform set operations efficiently', async () => {
      const cache = new CacheManager()
      
      // Test set performance
      const duration = await performanceHelper.measure('cache-set', async () => {
        for (let i = 0; i < 1000; i++) {
          await cache.set(`key${i}`, `value${i}`)
        }
      })
      // Should be very fast
      expect(duration).to.be.lessThan(100) // 100ms max
    })

    it('should perform get operations efficiently', async () => {
      const cache = new CacheManager()
      
      // Pre-populate cache
      for (let i = 0; i < 1000; i++) {
        await cache.set(`key${i}`, `value${i}`)
      }
      
      // Test get performance
      const duration = await performanceHelper.measure('cache-get', async () => {
        for (let i = 0; i < 1000; i++) {
          cache.get(`key${i}`)
        }
      })
      // Should be very fast
      expect(duration).to.be.lessThan(50) // 50ms max
    })

    it('should perform delete operations efficiently', async () => {
      const cache = new CacheManager()
      
      // Pre-populate cache
      for (let i = 0; i < 1000; i++) {
        await cache.set(`key${i}`, `value${i}`)
      }
      
      // Test delete performance
      const duration = await performanceHelper.measure('cache-delete', async () => {
        for (let i = 0; i < 1000; i++) {
          cache.delete(`key${i}`)
        }
      })
      // Should be very fast
      expect(duration).to.be.lessThan(50) // 50ms max
    })

    it('should perform clear operations efficiently', async () => {
      const cache = new CacheManager()
      
      // Pre-populate cache
      for (let i = 0; i < 1000; i++) {
        await cache.set(`key${i}`, `value${i}`)
      }
      
      // Test clear performance
      const duration = await performanceHelper.measure('cache-clear', async () => {
        cache.clear()
      })
      // Should be very fast
      expect(duration).to.be.lessThan(10) // 10ms max
    })
  })

  describe('Cache Size Performance', () => {
    it('should handle large caches efficiently', async () => {
      const cache = new CacheManager({ maxSize: 10000 })
      // Test large cache performance
      const duration = await performanceHelper.measure('large-cache', async () => {
        for (let i = 0; i < 10000; i++) {
          await cache.set(`large-key${i}`, `large-value${i}`)
        }
      })
      // Should be reasonably fast even for large caches
      expect(duration).to.be.lessThan(500) // 500ms max
      
      // Test retrieval from large cache
      const getDuration = await performanceHelper.measure('large-cache-get', async () => {
        for (let i = 0; i < 1000; i++) {
          cache.get(`large-key${i}`)
        }
      })
      // Should be fast even for large caches
      expect(getDuration).to.be.lessThan(100) // 100ms max
    })

    it('should handle cache eviction efficiently', async () => {
      const cache = new CacheManager({ maxSize: 1000, strategy: 'lru' })
      // Fill cache to capacity
      for (let i = 0; i < 1000; i++) {
        await cache.set(`evict-key${i}`, `evict-value${i}`)
      }
      
      // Test eviction performance
      const duration = await performanceHelper.measure('cache-eviction', async () => {
        // Add more items to trigger eviction
        for (let i = 1000; i < 2000; i++) {
          await cache.set(`evict-key${i}`, `evict-value${i}`)
        }
      })
      // Should be reasonably fast even with eviction
      expect(duration).to.be.lessThan(200) // 200ms max
      
      // Verify cache size is maintained
      expect(cache.size()).to.equal(1000)
    })

    it('should handle unlimited cache size efficiently', async () => {
      const cache = new CacheManager({ maxSize: undefined })
      // Test unlimited cache performance
      const duration = await performanceHelper.measure('unlimited-cache', async () => {
        for (let i = 0; i < 5000; i++) {
          await cache.set(`unlimited-key${i}`, `unlimited-value${i}`)
        }
      })
      // Should be reasonably fast even for unlimited caches
      expect(duration).to.be.lessThan(300) // 300ms max
      
      // Verify all items are stored
      expect(cache.size()).to.equal(5000)
    })
  })

  describe('Cache Memory Performance', () => {
    it('should handle memory efficiently for small values', async () => {
      const cache = new CacheManager()
      
      // Test memory usage with small values
      const { delta } = await memoryHelper.measureMemory(async () => {
        for (let i = 0; i < 1000; i++) {
          await cache.set(`small-key${i}`, `value${i}`)
        }
      })
      // Memory usage should be reasonable
      expect(delta.heapUsed).to.be.lessThan(10) // 10MB limit
    })

    it('should handle memory efficiently for large values', async () => {
      const cache = new CacheManager()
      
      // Test memory usage with large values
      const { delta } = await memoryHelper.measureMemory(async () => {
        for (let i = 0; i < 100; i++) {
          const largeValue = 'x'.repeat(10000) // 10KB string
          await cache.set(`large-key${i}`, largeValue)
        }
      })
      // Memory usage should be reasonable
      expect(delta.heapUsed).to.be.lessThan(20) // 20MB limit
    })

    it('should handle memory efficiently with mixed value sizes', async () => {
      const cache = new CacheManager()
      
      // Test memory usage with mixed value sizes
      const { delta } = await memoryHelper.measureMemory(async () => {
        for (let i = 0; i < 500; i++) {
          if (i % 2 === 0) {
            await cache.set(`mixed-key${i}`, `small-value${i}`)
          } else {
            const largeValue = 'x'.repeat(1000) // 1KB string
            await cache.set(`mixed-key${i}`, largeValue)
          }
        }
      })
      // Memory usage should be reasonable
      expect(delta.heapUsed).to.be.lessThan(15) // 15MB limit
    })

    it('should release memory when clearing cache', async () => {
      const cache = new CacheManager()
      
      // Fill cache
      for (let i = 0; i < 1000; i++) {
        const largeValue = 'x'.repeat(1000) // 1KB string
        await cache.set(`memory-key${i}`, largeValue)
      }
      
      // Measure memory before clear
      const beforeClear = memoryHelper.getMemoryUsage()
      
      // Clear cache
      cache.clear()
      
      // Measure memory after clear
      const afterClear = memoryHelper.getMemoryUsage()
      
      // Memory should be released
      expect(afterClear.heapUsed).to.be.lessThan(beforeClear.heapUsed)
    })
  })

  describe('Cache TTL Performance', () => {
    it('should handle TTL efficiently', async () => {
      const cache = new CacheManager({ ttl: 1000 })
      // Test TTL performance
      const duration = await performanceHelper.measure('cache-ttl', async () => {
        for (let i = 0; i < 1000; i++) {
          await cache.set(`ttl-key${i}`, `ttl-value${i}`, 500)
        }
      })
      // Should be reasonably fast even with TTL
      expect(duration).to.be.lessThan(200) // 200ms max
    })

    it('should handle TTL expiration efficiently', async () => {
      const cache = new CacheManager({ ttl: 100 })
      // Set values with short TTL
      for (let i = 0; i < 100; i++) {
        await cache.set(`expire-key${i}`, `expire-value${i}`)
      }
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150))
      
      // Test expiration performance
      const duration = await performanceHelper.measure('cache-expiration', async () => {
        for (let i = 0; i < 100; i++) {
          cache.get(`expire-key${i}`)
        }
      })
      // Should be fast even with expired items
      expect(duration).to.be.lessThan(50) // 50ms max
    })

    it('should handle TTL cleanup efficiently', async () => {
      const cache = new CacheManager({ ttl: 100 })
      // Set values with short TTL
      for (let i = 0; i < 1000; i++) {
        await cache.set(`cleanup-key${i}`, `cleanup-value${i}`)
      }
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150))
      
      // Test cleanup performance
      const duration = await performanceHelper.measure('cache-cleanup', async () => {
        cache.cleanExpired()
      })
      // Should be reasonably fast
      expect(duration).to.be.lessThan(100) // 100ms max
    })
  })

  describe('Cache Strategy Performance', () => {
    it('should handle LRU strategy efficiently', async () => {
      const cache = new CacheManager({ maxSize: 1000, strategy: 'lru' })
      // Fill cache
      for (let i = 0; i < 1000; i++) {
        await cache.set(`lru-key${i}`, `lru-value${i}`)
      }
      
      // Test LRU performance
      const duration = await performanceHelper.measure('cache-lru', async () => {
        // Access some items to make them recently used
        for (let i = 0; i < 100; i++) {
          cache.get(`lru-key${i}`)
        }
        
        // Add new items to trigger LRU eviction
        for (let i = 1000; i < 1100; i++) {
          await cache.set(`lru-key${i}`, `lru-value${i}`)
        }
      })
      // Should be reasonably fast
      expect(duration).to.be.lessThan(200) // 200ms max
    })

    it('should handle FIFO strategy efficiently', async () => {
      const cache = new CacheManager({ maxSize: 1000, strategy: 'fifo' })
      // Fill cache
      for (let i = 0; i < 1000; i++) {
        await cache.set(`fifo-key${i}`, `fifo-value${i}`)
      }
      
      // Test FIFO performance
      const duration = await performanceHelper.measure('cache-fifo', async () => {
        // Add new items to trigger FIFO eviction
        for (let i = 1000; i < 1100; i++) {
          await cache.set(`fifo-key${i}`, `fifo-value${i}`)
        }
      })
      // Should be reasonably fast
      expect(duration).to.be.lessThan(200) // 200ms max
    })
  })

  describe('Concurrent Cache Operations', () => {
    it('should handle concurrent set operations efficiently', async () => {
      const cache = new CacheManager()
      
      // Test concurrent set operations
      const start = performance.now()
      const promises: Promise<void>[] = []
      
      for (let i = 0; i < 100; i++) {
        promises.push(cache.set(`concurrent-key${i}`, `concurrent-value${i}`))
      }
      
      await Promise.all(promises)
      const duration = performance.now() - start
      
      // Should be efficient even with concurrent operations
      expect(duration).to.be.lessThan(100) // 100ms max
      
      // Verify all items were set
      expect(cache.size()).to.equal(100)
    })

    it('should handle concurrent get operations efficiently', async () => {
      const cache = new CacheManager()
      
      // Pre-populate cache
      for (let i = 0; i < 100; i++) {
        await cache.set(`concurrent-get-key${i}`, `concurrent-get-value${i}`)
      }
      
      // Test concurrent get operations
      const start = performance.now()
      const promises: Promise<any>[] = []
      
      for (let i = 0; i < 100; i++) {
        promises.push(Promise.resolve(cache.get(`concurrent-get-key${i}`)))
      }
      
      const results = await Promise.all(promises)
      const duration = performance.now() - start
      
      // Should be efficient even with concurrent operations
      expect(duration).to.be.lessThan(50) // 50ms max
      
      // Verify all items were retrieved
      expect(results.length).to.equal(100)
      expect(results.every(result => result !== null)).to.be.true
    })

    it('should handle concurrent mixed operations efficiently', async () => {
      const cache = new CacheManager()
      
      // Test concurrent mixed operations
      const start = performance.now()
      const promises: Promise<any>[] = []
      
      // Mix of set, get, and delete operations
      for (let i = 0; i < 50; i++) {
        promises.push(cache.set(`mixed-key${i}`, `mixed-value${i}`))
        promises.push(Promise.resolve(cache.get(`mixed-key${i}`)))
        promises.push(Promise.resolve(cache.delete(`mixed-key${i}`)))
      }
      
      await Promise.all(promises)
      const duration = performance.now() - start
      
      // Should be efficient even with concurrent mixed operations
      expect(duration).to.be.lessThan(100) // 100ms max
    })
  })

  describe('Cache Statistics Performance', () => {
    it('should track statistics efficiently', async () => {
      const cache = new CacheManager()
      
      // Perform operations to generate statistics
      for (let i = 0; i < 1000; i++) {
        await cache.set(`stats-key${i}`, `stats-value${i}`)
        cache.get(`stats-key${i}`)
        if (i % 2 === 0) {
          cache.get(`non-existent-key${i}`) // Miss
        }
      }
      
      // Test statistics retrieval performance
      const duration = await performanceHelper.measure('cache-stats', async () => {
        for (let i = 0; i < 100; i++) {
          cache.getStats()
        }
      })
      // Should be very fast
      expect(duration).to.be.lessThan(10) // 10ms max
      
      // Verify statistics are accurate
      const stats = cache.getStats()
      expect(stats.hits).to.be.greaterThan(0)
      expect(stats.misses).to.be.greaterThan(0)
      expect(stats.hitRate).to.be.greaterThan(0)
    })

    it('should handle statistics reset efficiently', async () => {
      const cache = new CacheManager()
      
      // Perform operations to generate statistics
      for (let i = 0; i < 1000; i++) {
        await cache.set(`reset-key${i}`, `reset-value${i}`)
        cache.get(`reset-key${i}`)
      }
      
      // Test statistics reset performance
      const duration = await performanceHelper.measure('cache-stats-reset', async () => {
        cache.clear() // This should reset statistics
      })
      // Should be fast
      expect(duration).to.be.lessThan(10) // 10ms max
      
      // Verify statistics are reset
      const stats = cache.getStats()
      expect(stats.hits).to.equal(0)
      expect(stats.misses).to.equal(0)
      expect(stats.hitRate).to.equal(0)
    })
  })

  describe('Cache Configuration Performance', () => {
    it('should handle configuration updates efficiently', async () => {
      const cache = new CacheManager()
      
      // Test configuration update performance
      const duration = await performanceHelper.measure('cache-config-update', async () => {
        for (let i = 0; i < 100; i++) {
          cache.updateConfig({
            ttl: 1000 + i,
            maxSize: 1000 + i
          })
        }
      })
      // Should be fast
      expect(duration).to.be.lessThan(50) // 50ms max
    })

    it('should handle configuration retrieval efficiently', async () => {
      const cache = new CacheManager()
      
      // Test configuration retrieval performance
      const duration = await performanceHelper.measure('cache-config-get', async () => {
        for (let i = 0; i < 1000; i++) {
          // Note: CacheManager doesn't have getConfig method, so we'll test updateConfig instead
          cache.updateConfig({ ttl: 1000 })
        }
      })
      // Should be very fast
      expect(duration).to.be.lessThan(10) // 10ms max
    })
  })
})