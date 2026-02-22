import { Kysely } from '../kysely'
import { Logger } from '../logging/logger.js'
import { SchemaInfo } from '../types'
import { QueryParser, ParsedQuery } from './utils/query-parser'
import { QueryCacheService } from './services/cache-service'
import { MetricsCollector } from './services/metrics-collector'
import { sql } from '../raw-builder/sql'
import { CompiledQuery } from '../query-compiler/compiled-query'

export interface QueryOptimizationOptions {
  enableQueryCache: boolean
  enableIndexRecommendations: boolean
  enableQueryRewriting: boolean
  slowQueryThreshold: number
  cacheSize: number
  maxCacheAge: number
}

export interface QueryOptimizationResult {
  originalQuery: string
  optimizedQuery: string
  optimizationType:
    | 'index_hint'
    | 'query_rewrite'
    | 'cache_hit'
    | 'no_optimization'
  executionTime: number
  improvement: number
  suggestions: string[]
  result?: any
}

export interface IndexRecommendation {
  table: string
  columns: string[]
  type: 'btree' | 'hash' | 'unique'
  reason: string
  estimatedImprovement: number
  priority: 'low' | 'medium' | 'high'
}

/**
 * Refactored query optimizer using focused services
 */
export class QueryOptimizer {
  private cacheService: QueryCacheService
  private metricsCollector: MetricsCollector
  private options: QueryOptimizationOptions
  private logger: Logger
  private schemaInfo: SchemaInfo

  constructor(
    private db: Kysely<any>,
    schemaInfo: SchemaInfo,
    options: Partial<QueryOptimizationOptions> = {},
    logger?: Logger,
  ) {
    this.schemaInfo = schemaInfo
    this.logger = logger || new Logger('QueryOptimizer')
    this.options = {
      enableQueryCache: true,
      enableIndexRecommendations: true,
      enableQueryRewriting: true,
      slowQueryThreshold: 1000,
      cacheSize: 1000,
      maxCacheAge: 300000,
      ...options,
    }

    // Initialize services
    this.cacheService = new QueryCacheService(
      {
        maxSize: this.options.cacheSize,
        defaultTtl: this.options.maxCacheAge,
        enableMetrics: true,
      },
      this.logger,
    )

    this.metricsCollector = new MetricsCollector(
      {
        enabled: true,
        slowQueryThreshold: this.options.slowQueryThreshold,
        nPlusOneDetection: true,
        missingIndexDetection: this.options.enableIndexRecommendations,
        largeResultSetThreshold: 1000,
      },
      this.logger,
    )
  }

  /**
   * Optimize and execute a query
   */
  async optimizeQuery<T>(
    query: string,
    params: any[] = [],
    context?: { table?: string; operation?: string },
  ): Promise<QueryOptimizationResult & { result: T }> {
    const startTime = performance.now()

    try {
      // Check cache first
      if (this.options.enableQueryCache) {
        const cachedResult = this.cacheService.getCachedQuery(query, params)
        if (cachedResult) {
          const executionTime = performance.now() - startTime
          return {
            originalQuery: query,
            optimizedQuery: query,
            optimizationType: 'cache_hit',
            executionTime,
            improvement: 100,
            suggestions: ['Query served from cache'],
            result: cachedResult,
          }
        }
      }

      // Parse and analyze query
      const parsedQuery = QueryParser.parseQuery(query)
      const optimization = await this.analyzeQuery(parsedQuery, query, params)
      const optimizedQuery = optimization.optimizedQuery || query

      // Execute the query
      const result = await this.executeQuery<T>(optimizedQuery, params)
      const executionTime = performance.now() - startTime

      // Cache the result if appropriate
      if (
        this.options.enableQueryCache &&
        QueryParser.shouldCache(query, executionTime)
      ) {
        this.cacheService.cacheQuery(query, params, result)
      }

      // Record metrics
      this.metricsCollector.recordQuery(query, executionTime, {
        table: context?.table,
        operation: context?.operation,
        resultCount: Array.isArray(result) ? result.length : 1,
      })

      // Generate suggestions
      const suggestions = this.generateSuggestions(
        parsedQuery,
        executionTime,
        context,
      )

      return {
        originalQuery: query,
        optimizedQuery,
        optimizationType: optimization.type,
        executionTime,
        improvement: optimization.improvement,
        suggestions,
        result,
      }
    } catch (error) {
      const executionTime = performance.now() - startTime

      // Record error metrics
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      this.metricsCollector.recordQuery(query, executionTime, {
        table: context?.table,
        operation: context?.operation,
        error: errorMessage,
      })

      this.logger.error(`Query optimization failed: ${errorMessage}`, {
        query,
        executionTime,
      })

      throw error
    }
  }

  /**
   * Get index recommendations
   */
  async getIndexRecommendations(): Promise<IndexRecommendation[]> {
    if (!this.options.enableIndexRecommendations) {
      return []
    }

    const slowQueries = this.metricsCollector.getSlowQueries()
    const recommendations: IndexRecommendation[] = []

    for (const queryInfo of slowQueries) {
      const parsedQuery = QueryParser.parseQuery(queryInfo.query)
      const queryRecommendations = this.analyzeQueryForIndexes(
        parsedQuery,
        queryInfo.query,
      )
      recommendations.push(...queryRecommendations)
    }

    return this.deduplicateRecommendations(recommendations)
  }

  /**
   * Get query performance statistics
   */
  getQueryStats() {
    const metricsStats = this.metricsCollector.getPerformanceStats()
    const cacheStats = this.cacheService.getStats()

    return {
      ...metricsStats,
      cache: cacheStats,
      indexRecommendations: 0, // Would be populated by recommendations
    }
  }

  /**
   * Clear query cache
   */
  clearCache(): void {
    this.cacheService.clear()
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metricsCollector.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cacheService.getStats()
  }

  /**
   * Get performance warnings
   */
  getPerformanceWarnings() {
    return this.metricsCollector.getRecentWarnings()
  }

  /**
   * Shutdown optimizer
   */
  shutdown(): void {
    this.cacheService.shutdown()
    this.metricsCollector.shutdown()
  }

  /**
   * Analyze query for optimization opportunities
   */
  private async analyzeQuery(
    parsedQuery: ParsedQuery,
    originalQuery: string,
    params: any[],
  ): Promise<{
    optimizedQuery: string
    type: QueryOptimizationResult['optimizationType']
    improvement: number
  }> {
    let optimizedQuery = originalQuery
    let improvement = 0
    let type: QueryOptimizationResult['optimizationType'] = 'no_optimization'

    // Apply query-specific optimizations
    if (parsedQuery.type === 'SELECT') {
      const selectOptimization = this.optimizeSelectQuery(
        parsedQuery,
        originalQuery,
      )
      if (selectOptimization.improvement > 0) {
        optimizedQuery = selectOptimization.optimizedQuery
        improvement = selectOptimization.improvement
        type = 'query_rewrite'
      }
    }

    if (parsedQuery.isComplex) {
      const complexOptimization = this.optimizeComplexQuery(
        parsedQuery,
        originalQuery,
      )
      if (complexOptimization.improvement > improvement) {
        optimizedQuery = complexOptimization.optimizedQuery
        improvement = complexOptimization.improvement
        type = 'query_rewrite'
      }
    }

    return {
      optimizedQuery,
      type,
      improvement,
    }
  }

  /**
   * Optimize SELECT queries
   */
  private optimizeSelectQuery(
    parsedQuery: ParsedQuery,
    originalQuery: string,
  ): {
    optimizedQuery: string
    improvement: number
  } {
    let optimizedQuery = originalQuery
    let improvement = 0

    // Add LIMIT if missing and query could return many rows
    if (
      !parsedQuery.hasLimit &&
      QueryParser.couldReturnManyRows(originalQuery)
    ) {
      optimizedQuery = `${originalQuery} LIMIT 1000`
      improvement = 10
    }

    // Optimize ORDER BY with LIMIT
    if (parsedQuery.hasLimit && parsedQuery.orderByColumns.length > 0) {
      const orderByColumn = parsedQuery.orderByColumns[0]
      const table = parsedQuery.tables[0]

      if (table && this.hasIndexOnColumn(table, orderByColumn)) {
        improvement = Math.max(improvement, 20)
      }
    }

    return {
      optimizedQuery,
      improvement,
    }
  }

  /**
   * Optimize complex queries (joins, aggregates)
   */
  private optimizeComplexQuery(
    parsedQuery: ParsedQuery,
    originalQuery: string,
  ): {
    optimizedQuery: string
    improvement: number
  } {
    let optimizedQuery = originalQuery
    let improvement = 0

    // Check for missing indexes on join columns
    for (const { table, column } of parsedQuery.joinColumns) {
      if (!this.hasIndexOnColumn(table, column)) {
        improvement = Math.max(improvement, 15)
      }
    }

    // Check for missing indexes on WHERE columns
    for (const column of parsedQuery.whereColumns) {
      const table = parsedQuery.tables[0]
      if (table && !this.hasIndexOnColumn(table, column)) {
        improvement = Math.max(improvement, 20)
      }
    }

    // Check for missing indexes on GROUP BY columns
    if (parsedQuery.hasAggregates && parsedQuery.groupByColumns.length > 0) {
      const table = parsedQuery.tables[0]
      if (
        table &&
        parsedQuery.groupByColumns.every((col) =>
          this.hasIndexOnColumn(table, col),
        )
      ) {
        improvement = Math.max(improvement, 25)
      }
    }

    return {
      optimizedQuery,
      improvement,
    }
  }

  /**
   * Analyze query for index recommendations
   */
  private analyzeQueryForIndexes(
    parsedQuery: ParsedQuery,
    originalQuery: string,
  ): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = []
    const table = parsedQuery.tables[0]

    if (!table) {
      return recommendations
    }

    // Analyze WHERE clauses
    for (const column of parsedQuery.whereColumns) {
      if (!this.hasIndexOnColumn(table, column)) {
        recommendations.push({
          table,
          columns: [column],
          type: 'btree',
          reason: `WHERE clause on ${column}`,
          estimatedImprovement: 20,
          priority: 'medium',
        })
      }
    }

    // Analyze JOIN columns
    for (const { table: joinTable, column } of parsedQuery.joinColumns) {
      if (!this.hasIndexOnColumn(joinTable, column)) {
        recommendations.push({
          table: joinTable,
          columns: [column],
          type: 'btree',
          reason: `JOIN condition on ${column}`,
          estimatedImprovement: 30,
          priority: 'high',
        })
      }
    }

    // Analyze ORDER BY columns
    for (const column of parsedQuery.orderByColumns) {
      if (!this.hasIndexOnColumn(table, column)) {
        recommendations.push({
          table,
          columns: [column],
          type: 'btree',
          reason: `ORDER BY clause on ${column}`,
          estimatedImprovement: 15,
          priority: 'medium',
        })
      }
    }

    return recommendations
  }

  /**
   * Deduplicate index recommendations
   */
  private deduplicateRecommendations(
    recommendations: IndexRecommendation[],
  ): IndexRecommendation[] {
    const unique = new Map<string, IndexRecommendation>()

    for (const rec of recommendations) {
      const key = `${rec.table}:${rec.columns.join(',')}`

      if (!unique.has(key) || unique.get(key)!.priority === 'low') {
        unique.set(key, rec)
      }
    }

    return Array.from(unique.values()).sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }

  /**
   * Generate optimization suggestions
   */
  private generateSuggestions(
    parsedQuery: ParsedQuery,
    executionTime: number,
    context?: { table?: string; operation?: string },
  ): string[] {
    const suggestions: string[] = []

    if (executionTime > this.options.slowQueryThreshold) {
      suggestions.push(
        `Query took ${executionTime.toFixed(2)}ms - consider adding indexes`,
      )
    }

    if (parsedQuery.type === 'SELECT' && !parsedQuery.hasLimit) {
      suggestions.push(
        'Consider adding LIMIT clause to prevent large result sets',
      )
    }

    if (parsedQuery.joinColumns.length > 0) {
      for (const { table, column } of parsedQuery.joinColumns) {
        if (!this.hasIndexOnColumn(table, column)) {
          suggestions.push(
            `Consider adding index on ${table}.${column} for join optimization`,
          )
        }
      }
    }

    if (parsedQuery.hasAggregates && parsedQuery.groupByColumns.length > 0) {
      suggestions.push('Consider adding composite indexes for GROUP BY columns')
    }

    return suggestions
  }

  /**
   * Execute a query with error handling
   * Note: This creates a proper SQL query with parameters using sql.raw
   */
  private async executeQuery<T>(query: string, params: any[]): Promise<T> {
    try {
      // Use CompiledQuery to handle raw SQL with parameters correctly
      const compiledQuery = CompiledQuery.raw(query, params)

      // Execute the query
      const result = await this.db.executeQuery(compiledQuery)
      return result.rows as T
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      this.logger.error(`Query execution failed: ${errorMessage}`, {
        query,
        params,
      })
      throw error
    }
  }

  /**
   * Check if column has an index
   */
  private hasIndexOnColumn(table: string, column: string): boolean {
    const tableInfo = this.schemaInfo.tables.find((t) => t.name === table)
    if (!tableInfo) return false

    // Check if column is primary key
    const columnInfo = tableInfo.columns.find((col) => col.name === column)
    if (columnInfo?.isPrimaryKey) return true

    // Check if column has an index
    return tableInfo.indexes.some((idx) => idx.columns.includes(column))
  }
}

/**
 * Factory function to create query optimizer
 */
export function createQueryOptimizer(
  db: Kysely<any>,
  schemaInfo: SchemaInfo,
  options?: Partial<QueryOptimizationOptions>,
  logger?: Logger,
): QueryOptimizer {
  return new QueryOptimizer(db, schemaInfo, options, logger)
}
