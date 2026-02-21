import { describe, it, expect, beforeEach } from '@jest/globals'
import { CacheManager } from '../../src/cache/cache-manager.js'

describe('CacheManager', () => {
  let cache: CacheManager

  beforeEach(() => {
    cache = new CacheManager({ maxSize: 3, ttl: 1000, strategy: 'lru' })
  })

  it('should set and get values', async () => {
    await cache.set('a', 1)
    expect(cache.get('a')).toBe(1)
  })

  it('should implement LRU eviction', async () => {
    // Fill cache
    await cache.set('a', 1)
    await cache.set('b', 2)
    await cache.set('c', 3)

    // Access 'a' to make it most recently used
    expect(cache.get('a')).toBe(1)

    // Add 'd', should evict 'b' (since 'a' was used, 'b' is now oldest)
    // Order was: a, b, c. Access a -> b, c, a. Add d -> c, a, d. Evicted b.
    // Wait: Map keys are iteration order.
    // 1. set a -> [a]
    // 2. set b -> [a, b]
    // 3. set c -> [a, b, c]
    // 4. get a -> delete a, set a -> [b, c, a]
    // 5. set d -> size 4 > 3 -> evict oldest (first) -> evict b -> [c, a, d]
    
    await cache.set('d', 4)

    expect(cache.get('b')).toBeNull()
    expect(cache.get('a')).toBe(1)
    expect(cache.get('c')).toBe(3)
    expect(cache.get('d')).toBe(4)
  })

  it('should handle TTL', async () => {
    cache = new CacheManager({ maxSize: 10, ttl: 10 }) // 10ms TTL
    await cache.set('a', 1)
    expect(cache.get('a')).toBe(1)
    
    await new Promise(resolve => setTimeout(resolve, 20))
    
    expect(cache.get('a')).toBeNull()
  })

  it('should refresh TTL on set', async () => {
    cache = new CacheManager({ maxSize: 10, ttl: 50 })
    await cache.set('a', 1)
    
    await new Promise(resolve => setTimeout(resolve, 30))
    await cache.set('a', 1) // Reset
    
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(cache.get('a')).toBe(1) // Should still be there (total > 50ms, but reset)
  })
})
