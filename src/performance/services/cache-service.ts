import { Logger } from '../../logging/logger.js'

export interface CacheEntry<T = any> {
  key: string
  value: T
  timestamp: number
  ttl: number
  hitCount: number
  size: number
}

export interface CacheConfig {
  maxSize: number
  defaultTtl: number // milliseconds
  cleanupInterval: number // milliseconds
  enableCompression: boolean
  enableMetrics: boolean
}

export interface CacheStats {
  size: number
  maxSize: number
  hitCount: number
  missCount: number
  hitRate: number
  totalSize: number
  evictions: number
  lastCleanup: Date
}

export interface CacheMetrics {
  operations: {
    get: number
    set: number
    delete: number
    clear: number
  }
  performance: {
    averageGetTime: number
    averageSetTime: number
    slowestOperation: number
  }
  memory: {
    totalSize: number
    averageEntrySize: number
    largestEntry: number
  }
}

/**
 * Generic cache service with TTL, size limits, and metrics
 */
export class CacheService<T = any> {
  private cache = new Map<string, CacheEntry<T>>()
  private config: CacheConfig
  private stats: CacheStats
  private metrics: CacheMetrics
  private cleanupTimer?: NodeJS.Timeout
  protected logger: Logger

  constructor(config: Partial<CacheConfig> = {}, logger?: Logger) {
    this.logger = logger || new Logger('CacheService')
    this.config = {
      maxSize: 1000,
      defaultTtl: 300000, // 5 minutes
      cleanupInterval: 60000, // 1 minute
      enableCompression: false,
      enableMetrics: true,
      ...config
    }

    this.stats = {
      size: 0,
      maxSize: this.config.maxSize,
      hitCount: 0,
      missCount: 0,
      hitRate: 0,
      totalSize: 0,
      evictions: 0,
      lastCleanup: new Date()
    }

    this.metrics = {
      operations: {
        get: 0,
        set: 0,
        delete: 0,
        clear: 0
      },
      performance: {
        averageGetTime: 0,
        averageSetTime: 0,
        slowestOperation: 0
      },
      memory: {
        totalSize: 0,
        averageEntrySize: 0,
        largestEntry: 0
      }
    }

    this.startCleanupTimer()
  }

  /**
   * Get a value from cache
   */
  get(key: string): T | null {
    const startTime = performance.now()
    
    try {
      this.metrics.operations.get++
      
      const entry = this.cache.get(key)
      
      if (!entry) {
        this.stats.missCount++
        this.updateHitRate()
        return null
      }

      // Check if entry has expired
      if (this.isExpired(entry)) {
        this.cache.delete(key)
        this.stats.missCount++
        this.updateHitRate()
        this.updateStats()
        return null
      }

      // Update hit count and last access
      entry.hitCount++
      this.stats.hitCount++
      this.updateHitRate()

      const duration = performance.now() - startTime
      this.updatePerformanceMetrics('get', duration)

      return entry.value
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error)
      return null
    }
  }

  /**
   * Set a value in cache
   */
  set(key: string, value: T, ttl?: number): boolean {
    const startTime = performance.now()
    
    try {
      this.metrics.operations.set++
      
      const entrySize = this.calculateSize(value)
      const entryTtl = ttl || this.config.defaultTtl

      // Check if we need to evict entries
      if (this.cache.size >= this.config.maxSize) {
        this.evictEntries()
      }

      const entry: CacheEntry<T> = {
        key,
        value,
        timestamp: Date.now(),
        ttl: entryTtl,
        hitCount: 0,
        size: entrySize
      }

      this.cache.set(key, entry)
      this.updateStats()

      const duration = performance.now() - startTime
      this.updatePerformanceMetrics('set', duration)

      return true
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error)
      return false
    }
  }

  /**
   * Delete a value from cache
   */
  delete(key: string): boolean {
    try {
      this.metrics.operations.delete++
      
      const deleted = this.cache.delete(key)
      if (deleted) {
        this.updateStats()
      }
      
      return deleted
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error)
      return false
    }
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    
    if (this.isExpired(entry)) {
      this.cache.delete(key)
      this.updateStats()
      return false
    }
    
    return true
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    try {
      this.metrics.operations.clear++
      
      this.cache.clear()
      this.updateStats()
      
      this.logger.info('Cache cleared')
    } catch (error) {
      this.logger.error('Cache clear error:', error)
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * Get detailed metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics }
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys())
  }

  /**
   * Get cache entries (for debugging)
   */
  entries(): Array<{ key: string; entry: CacheEntry<T> }> {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({ key, entry }))
  }

  /**
   * Warm cache with multiple entries
   */
  warm(entries: Array<{ key: string; value: T; ttl?: number }>): number {
    let warmed = 0
    
    for (const { key, value, ttl } of entries) {
      if (this.set(key, value, ttl)) {
        warmed++
      }
    }
    
    this.logger.info(`Warmed cache with ${warmed}/${entries.length} entries`)
    return warmed
  }

  /**
   * Get cache health status
   */
  getHealth(): {
    status: 'healthy' | 'warning' | 'critical'
    issues: string[]
    recommendations: string[]
  } {
    const issues: string[] = []
    const recommendations: string[] = []

    // Check hit rate
    if (this.stats.hitRate < 0.5) {
      issues.push(`Low hit rate: ${(this.stats.hitRate * 100).toFixed(1)}%`)
      recommendations.push('Consider increasing TTL or cache size')
    }

    // Check memory usage
    if (this.stats.totalSize > 100 * 1024 * 1024) { // 100MB
      issues.push(`High memory usage: ${(this.stats.totalSize / 1024 / 1024).toFixed(1)}MB`)
      recommendations.push('Consider reducing cache size or enabling compression')
    }

    // Check eviction rate
    const evictionRate = this.stats.evictions / Math.max(this.stats.hitCount + this.stats.missCount, 1)
    if (evictionRate > 0.1) {
      issues.push(`High eviction rate: ${(evictionRate * 100).toFixed(1)}%`)
      recommendations.push('Consider increasing cache size')
    }

    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    if (issues.length > 0) {
      status = issues.some(issue => issue.includes('critical')) ? 'critical' : 'warning'
    }

    return { status, issues, recommendations }
  }

  /**
   * Shutdown cache service
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    
    this.clear()
    this.logger.info('Cache service shutdown')
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl
  }

  /**
   * Calculate size of a value (rough estimation)
   */
  private calculateSize(value: T): number {
    try {
      return JSON.stringify(value).length * 2 // Rough estimate in bytes
    } catch {
      return 1024 // Default size if serialization fails
    }
  }

  /**
   * Evict entries when cache is full
   */
  private evictEntries(): void {
    const entries = Array.from(this.cache.entries())
    
    // Sort by hit count and timestamp (LRU with hit count consideration)
    entries.sort((a, b) => {
      const [, entryA] = a
      const [, entryB] = b
      
      // Prefer entries with fewer hits
      if (entryA.hitCount !== entryB.hitCount) {
        return entryA.hitCount - entryB.hitCount
      }
      
      // If hit counts are equal, prefer older entries
      return entryA.timestamp - entryB.timestamp
    })

    // Remove oldest/lowest hit count entries
    const toRemove = Math.ceil(entries.length * 0.1) // Remove 10% of entries
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      const [key] = entries[i]
      this.cache.delete(key)
      this.stats.evictions++
    }
  }

  /**
   * Update cache statistics
   */
  private updateStats(): void {
    this.stats.size = this.cache.size
    
    let totalSize = 0
    let largestEntry = 0
    
    for (const entry of this.cache.values()) {
      totalSize += entry.size
      largestEntry = Math.max(largestEntry, entry.size)
    }
    
    this.stats.totalSize = totalSize
    this.metrics.memory.totalSize = totalSize
    this.metrics.memory.largestEntry = largestEntry
    this.metrics.memory.averageEntrySize = this.cache.size > 0 ? totalSize / this.cache.size : 0
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hitCount + this.stats.missCount
    this.stats.hitRate = total > 0 ? this.stats.hitCount / total : 0
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(operation: 'get' | 'set', duration: number): void {
    if (!this.config.enableMetrics) return

    this.metrics.performance.slowestOperation = Math.max(
      this.metrics.performance.slowestOperation,
      duration
    )

    if (operation === 'get') {
      const totalGets = this.metrics.operations.get
      this.metrics.performance.averageGetTime = 
        (this.metrics.performance.averageGetTime * (totalGets - 1) + duration) / totalGets
    } else if (operation === 'set') {
      const totalSets = this.metrics.operations.set
      this.metrics.performance.averageSetTime = 
        (this.metrics.performance.averageSetTime * (totalSets - 1) + duration) / totalSets
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, this.config.cleanupInterval)
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      this.stats.lastCleanup = new Date()
      this.updateStats()
      this.logger.debug(`Cleaned up ${cleaned} expired cache entries`)
    }
  }
}

/**
 * Factory function to create cache service
 */
export function createCacheService<T = any>(
  config?: Partial<CacheConfig>,
  logger?: Logger
): CacheService<T> {
  return new CacheService<T>(config, logger)
}

/**
 * Specialized query cache service
 */
export class QueryCacheService extends CacheService<any> {
  constructor(config?: Partial<CacheConfig>, logger?: Logger) {
    super({
      maxSize: 1000,
      defaultTtl: 300000, // 5 minutes
      cleanupInterval: 60000, // 1 minute
      enableMetrics: true,
      ...config
    }, logger)
  }

  /**
   * Cache query result with automatic key generation
   */
  cacheQuery(query: string, params: any[], result: any, ttl?: number): boolean {
    const key = this.generateQueryKey(query, params)
    return this.set(key, result, ttl)
  }

  /**
   * Get cached query result
   */
  getCachedQuery(query: string, params: any[]): any | null {
    const key = this.generateQueryKey(query, params)
    return this.get(key)
  }

  /**
   * Generate cache key for query
   */
  private generateQueryKey(query: string, params: any[]): string {
    const normalizedQuery = query.replace(/\s+/g, ' ').trim()
    const paramsKey = params.map(p => String(p)).join('|')
    return `query:${normalizedQuery}:${paramsKey}`
  }

  /**
   * Invalidate cache entries for a specific table
   */
  invalidateTable(table: string): number {
    let invalidated = 0
    
    for (const key of this.keys()) {
      if (key.includes(`FROM ${table}`) || key.includes(`JOIN ${table}`)) {
        if (this.delete(key)) {
          invalidated++
        }
      }
    }
    
    this.logger?.info(`Invalidated ${invalidated} cache entries for table ${table}`)
    return invalidated
  }
}
