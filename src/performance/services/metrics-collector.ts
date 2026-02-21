import { Logger } from '../../logging/logger.js'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

export interface QueryMetrics {
  query: string
  executionTime: number
  timestamp: number
  table?: string
  operation?: string
  resultCount?: number
  error?: string
}

export interface PerformanceWarning {
  type: 'n_plus_one' | 'missing_index' | 'slow_query' | 'full_table_scan' | 'large_result_set'
  message: string
  suggestion: string
  query?: string
  table?: string
  severity: 'low' | 'medium' | 'high'
  timestamp: number
}

export interface MetricsConfig {
  enabled: boolean
  slowQueryThreshold: number
  nPlusOneDetection: boolean
  missingIndexDetection: boolean
  largeResultSetThreshold: number
  maxHistorySize: number
  warningRetentionDays: number
  persistPath?: string
}

export interface PerformanceStats {
  totalQueries: number
  averageExecutionTime: number
  slowQueries: number
  errorRate: number
  warningCount: { [key: string]: number }
  topSlowQueries: Array<{
    query: string
    averageTime: number
    count: number
  }>
  queryPatterns: Array<{
    pattern: string
    frequency: number
    averageTime: number
  }>
}

/**
 * Service for collecting and analyzing performance metrics
 */
export class MetricsCollector {
  private queryHistory: QueryMetrics[] = []
  private warnings: PerformanceWarning[] = []
  private recentQueries: Map<string, QueryMetrics[]> = new Map()
  private config: MetricsConfig
  private logger: Logger
  private cleanupTimer?: NodeJS.Timeout

  constructor(config: Partial<MetricsConfig> = {}, logger?: Logger) {
    this.logger = logger || new Logger('MetricsCollector')
    this.config = {
      enabled: process.env.NODE_ENV === 'development',
      slowQueryThreshold: 1000, // 1 second
      nPlusOneDetection: true,
      missingIndexDetection: true,
      largeResultSetThreshold: 1000,
      maxHistorySize: 10000,
      warningRetentionDays: 7,
      persistPath: config.persistPath,
      ...config
    }

    this.startCleanupTimer()
    // Attempt to load metrics on startup (fire and forget)
    this.load().catch(err => this.logger.warn('Failed to load metrics:', err))
  }

  /**
   * Load metrics from disk
   */
  async load(): Promise<void> {
    if (!this.config.persistPath || !this.config.enabled) return

    try {
      const data = await fs.readFile(this.config.persistPath, 'utf-8')
      const json = JSON.parse(data)
      
      if (json.queryHistory && Array.isArray(json.queryHistory)) {
        this.queryHistory = json.queryHistory
      }
      
      if (json.warnings && Array.isArray(json.warnings)) {
        this.warnings = json.warnings
      }

      this.logger.debug(`Loaded ${this.queryHistory.length} queries and ${this.warnings.length} warnings from ${this.config.persistPath}`)
    } catch (error) {
      // Ignore ENOENT (file not found), log others
      if ((error as any).code !== 'ENOENT') {
        this.logger.warn(`Failed to load metrics from ${this.config.persistPath}:`, error)
      }
    }
  }

  /**
   * Save metrics to disk
   */
  async save(): Promise<void> {
    if (!this.config.persistPath || !this.config.enabled) return

    try {
      const dir = path.dirname(this.config.persistPath)
      await fs.mkdir(dir, { recursive: true })

      const data = JSON.stringify({
        queryHistory: this.queryHistory,
        warnings: this.warnings,
        savedAt: Date.now()
      }, null, 2)

      await fs.writeFile(this.config.persistPath, data, 'utf-8')
      this.logger.debug(`Saved metrics to ${this.config.persistPath}`)
    } catch (error) {
      this.logger.warn(`Failed to save metrics to ${this.config.persistPath}:`, error)
    }
  }

  /**
   * Record a query execution
   */
  recordQuery(
    query: string,
    executionTime: number,
    options: {
      table?: string
      operation?: string
      resultCount?: number
      error?: string
    } = {}
  ): void {
    if (!this.config.enabled) return

    const metrics: QueryMetrics = {
      query: this.normalizeQuery(query),
      executionTime,
      timestamp: Date.now(),
      table: options.table,
      operation: options.operation,
      resultCount: options.resultCount,
      error: options.error
    }

    this.queryHistory.push(metrics)

    // Keep history size under control
    if (this.queryHistory.length > this.config.maxHistorySize) {
      this.queryHistory = this.queryHistory.slice(-this.config.maxHistorySize)
    }

    // Track recent queries for pattern detection
    this.trackRecentQuery(metrics)

    // Analyze for warnings
    this.analyzeQuery(metrics)
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): PerformanceStats {
    const totalQueries = this.queryHistory.length
    const slowQueries = this.queryHistory.filter(
      q => q.executionTime > this.config.slowQueryThreshold
    ).length

    const averageExecutionTime = totalQueries > 0
      ? this.queryHistory.reduce((sum, q) => sum + q.executionTime, 0) / totalQueries
      : 0

    const errorRate = totalQueries > 0
      ? this.queryHistory.filter(q => q.error).length / totalQueries
      : 0

    const warningCount: { [key: string]: number } = {}
    for (const warning of this.warnings) {
      warningCount[warning.type] = (warningCount[warning.type] || 0) + 1
    }

    const topSlowQueries = this.getTopSlowQueries()
    const queryPatterns = this.getQueryPatterns()

    return {
      totalQueries,
      averageExecutionTime,
      slowQueries,
      errorRate,
      warningCount,
      topSlowQueries,
      queryPatterns
    }
  }

  /**
   * Get recent warnings
   */
  getRecentWarnings(limit: number = 50): PerformanceWarning[] {
    return this.warnings
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
  }

  /**
   * Get warnings by type
   */
  getWarningsByType(type: PerformanceWarning['type']): PerformanceWarning[] {
    return this.warnings.filter(w => w.type === type)
  }

  /**
   * Get query history
   */
  getQueryHistory(limit?: number): QueryMetrics[] {
    const history = this.queryHistory
      .sort((a, b) => b.timestamp - a.timestamp)
    
    return limit ? history.slice(0, limit) : history
  }

  /**
   * Get slow queries
   */
  getSlowQueries(threshold?: number): QueryMetrics[] {
    const actualThreshold = threshold || this.config.slowQueryThreshold
    return this.queryHistory
      .filter(q => q.executionTime > actualThreshold)
      .sort((a, b) => b.executionTime - a.executionTime)
  }

  /**
   * Get N+1 query patterns
   */
  getNPlusOnePatterns(): Array<{
    pattern: string
    count: number
    timeWindow: number
    severity: 'low' | 'medium' | 'high'
  }> {
    const patterns = new Map<string, QueryMetrics[]>()
    
    // Group queries by normalized pattern
    for (const query of this.queryHistory) {
      if (!patterns.has(query.query)) {
        patterns.set(query.query, [])
      }
      patterns.get(query.query)!.push(query)
    }

    const nPlusOnePatterns: Array<{
      pattern: string
      count: number
      timeWindow: number
      severity: 'low' | 'medium' | 'high'
    }> = []

    // Analyze each pattern for N+1 behavior
    for (const [pattern, queries] of patterns.entries()) {
      if (queries.length < 5) continue

      const timeWindows = [5000, 10000, 30000] // 5s, 10s, 30s
      
      for (const windowMs of timeWindows) {
        let maxCountInWindow = 0
        
        for (const query of queries) {
          const windowStart = query.timestamp - windowMs
          const countInWindow = queries.filter(q => 
            q.timestamp >= windowStart && q.timestamp <= query.timestamp
          ).length
          
          maxCountInWindow = Math.max(maxCountInWindow, countInWindow)
        }

        if (maxCountInWindow >= 5) {
          let severity: 'low' | 'medium' | 'high' = 'low'
          if (maxCountInWindow >= 20) severity = 'high'
          else if (maxCountInWindow >= 10) severity = 'medium'

          nPlusOnePatterns.push({
            pattern,
            count: maxCountInWindow,
            timeWindow: windowMs,
            severity
          })
          break
        }
      }
    }

    return nPlusOnePatterns.sort((a, b) => b.count - a.count)
  }

  /**
   * Clear all metrics
   */
  async clear(): Promise<void> {
    this.queryHistory = []
    this.warnings = []
    this.recentQueries.clear()
    await this.save()
    this.logger.info('Metrics cleared')
  }

  /**
   * Export metrics data
   */
  exportMetrics(): {
    config: MetricsConfig
    stats: PerformanceStats
    warnings: PerformanceWarning[]
    queries: QueryMetrics[]
  } {
    return {
      config: this.config,
      stats: this.getPerformanceStats(),
      warnings: this.warnings,
      queries: this.queryHistory
    }
  }

  /**
   * Shutdown metrics collector
   */
  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    await this.save()
    this.logger.info('Metrics collector shutdown')
  }

  /**
   * Track recent query for pattern detection
   */
  private trackRecentQuery(metrics: QueryMetrics): void {
    const normalizedQuery = metrics.query
    
    if (!this.recentQueries.has(normalizedQuery)) {
      this.recentQueries.set(normalizedQuery, [])
    }
    
    this.recentQueries.get(normalizedQuery)!.push(metrics)

    // Clean up old recent queries (keep last 10 seconds)
    const cutoff = Date.now() - 10000
    for (const [query, queries] of this.recentQueries.entries()) {
      const recent = queries.filter(q => q.timestamp >= cutoff)
      if (recent.length === 0) {
        this.recentQueries.delete(query)
      } else {
        this.recentQueries.set(query, recent)
      }
    }
  }

  /**
   * Analyze query for performance issues
   */
  private analyzeQuery(metrics: QueryMetrics): void {
    const warnings: PerformanceWarning[] = []

    // Check for slow queries
    if (metrics.executionTime > this.config.slowQueryThreshold) {
      warnings.push({
        type: 'slow_query',
        message: `Slow query detected: ${metrics.executionTime}ms`,
        suggestion: 'Consider adding indexes or optimizing the query',
        query: metrics.query,
        table: metrics.table,
        severity: metrics.executionTime > this.config.slowQueryThreshold * 3 ? 'high' : 'medium',
        timestamp: Date.now()
      })
    }

    // Check for N+1 queries
    if (this.config.nPlusOneDetection) {
      const nPlusOneWarning = this.detectNPlusOne(metrics)
      if (nPlusOneWarning) {
        warnings.push(nPlusOneWarning)
      }
    }

    // Check for large result sets
    if (metrics.resultCount && metrics.resultCount > this.config.largeResultSetThreshold) {
      warnings.push({
        type: 'large_result_set',
        message: `Large result set: ${metrics.resultCount} rows returned`,
        suggestion: 'Consider using pagination or filtering to reduce result size',
        query: metrics.query,
        table: metrics.table,
        severity: metrics.resultCount > this.config.largeResultSetThreshold * 5 ? 'high' : 'medium',
        timestamp: Date.now()
      })
    }

    // Log warnings
    for (const warning of warnings) {
      this.addWarning(warning)
    }
  }

  /**
   * Detect N+1 query patterns
   */
  private detectNPlusOne(metrics: QueryMetrics): PerformanceWarning | null {
    const recentQueries = this.recentQueries.get(metrics.query) || []

    // Look for the same query executed multiple times in quick succession
    if (recentQueries.length >= 5) {
      const timeWindow = 5000 // 5 seconds
      const recentInWindow = recentQueries.filter(
        q => Date.now() - q.timestamp < timeWindow
      )

      if (recentInWindow.length >= 5) {
        return {
          type: 'n_plus_one',
          message: `Potential N+1 query detected: same query executed ${recentInWindow.length} times`,
          suggestion: 'Consider using joins or batch loading to reduce query count',
          query: metrics.query,
          table: metrics.table,
          severity: 'high',
          timestamp: Date.now()
        }
      }
    }

    return null
  }

  /**
   * Add warning to collection
   */
  private addWarning(warning: PerformanceWarning): void {
    this.warnings.push(warning)
    this.logWarning(warning)
  }

  /**
   * Log performance warning
   */
  private logWarning(warning: PerformanceWarning): void {
    const emoji = this.getWarningEmoji(warning.type)
    const message = `${emoji} Performance Warning [${warning.severity.toUpperCase()}]: ${warning.message}`

    switch (warning.severity) {
      case 'high':
        this.logger.warn(message)
        break
      case 'medium':
        this.logger.info(message)
        break
      case 'low':
        this.logger.debug(message)
        break
    }

    this.logger.debug(`  Suggestion: ${warning.suggestion}`)
    if (warning.query) {
      this.logger.debug(`  Query: ${warning.query}`)
    }
  }

  /**
   * Get emoji for warning type
   */
  private getWarningEmoji(type: PerformanceWarning['type']): string {
    const emojis = {
      'n_plus_one': '🔄',
      'missing_index': '📇',
      'slow_query': '🐌',
      'full_table_scan': '🔍',
      'large_result_set': '📊'
    }
    return emojis[type] || '⚠️'
  }

  /**
   * Normalize query for comparison
   */
  private normalizeQuery(query: string): string {
    return query
      .replace(/\$\d+/g, '?') // Replace PostgreSQL parameters
      .replace(/'[^']*'/g, '?') // Replace string literals
      .replace(/\b\d+\b/g, '?') // Replace numbers
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
  }

  /**
   * Get top slow queries
   */
  private getTopSlowQueries(): Array<{
    query: string
    averageTime: number
    count: number
  }> {
    const queryMap = new Map<string, { totalTime: number; count: number }>()

    for (const metrics of this.queryHistory) {
      if (metrics.executionTime > this.config.slowQueryThreshold) {
        if (!queryMap.has(metrics.query)) {
          queryMap.set(metrics.query, { totalTime: 0, count: 0 })
        }
        
        const entry = queryMap.get(metrics.query)!
        entry.totalTime += metrics.executionTime
        entry.count++
      }
    }

    return Array.from(queryMap.entries())
      .map(([query, { totalTime, count }]) => ({
        query,
        averageTime: totalTime / count,
        count
      }))
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 10)
  }

  /**
   * Get query patterns
   */
  private getQueryPatterns(): Array<{
    pattern: string
    frequency: number
    averageTime: number
  }> {
    const patternMap = new Map<string, { totalTime: number; count: number }>()

    for (const metrics of this.queryHistory) {
      if (!patternMap.has(metrics.query)) {
        patternMap.set(metrics.query, { totalTime: 0, count: 0 })
      }
      
      const entry = patternMap.get(metrics.query)!
      entry.totalTime += metrics.executionTime
      entry.count++
    }

    return Array.from(patternMap.entries())
      .map(([pattern, { totalTime, count }]) => ({
        pattern,
        frequency: count,
        averageTime: totalTime / count
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 20)
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
      this.save().catch(err => this.logger.warn('Failed to auto-save metrics:', err))
    }, 60000) // Cleanup and save every minute
  }

  /**
   * Cleanup old data
   */
  private cleanup(): void {
    const cutoffTime = Date.now() - (this.config.warningRetentionDays * 24 * 60 * 60 * 1000)
    
    // Remove old warnings
    this.warnings = this.warnings.filter(w => w.timestamp > cutoffTime)
    
    // Remove old queries (keep last 24 hours)
    const queryCutoff = Date.now() - (24 * 60 * 60 * 1000)
    this.queryHistory = this.queryHistory.filter(q => q.timestamp > queryCutoff)
    
    // Clean up recent queries
    for (const [query, queries] of this.recentQueries.entries()) {
      const recent = queries.filter(q => q.timestamp > queryCutoff)
      if (recent.length === 0) {
        this.recentQueries.delete(query)
      } else {
        this.recentQueries.set(query, recent)
      }
    }
  }
}

/**
 * Factory function to create metrics collector
 */
export function createMetricsCollector(
  config?: Partial<MetricsConfig>,
  logger?: Logger
): MetricsCollector {
  return new MetricsCollector(config, logger)
}
