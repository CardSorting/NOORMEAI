import type { Kysely } from '../../kysely.js'
import { sql } from '../../raw-builder/sql.js'
import { Logger } from '../../logging/logger.js'

export interface IndexRecommendation {
  table: string
  columns: string[]
  type: 'single' | 'composite' | 'unique' | 'partial'
  priority: 'low' | 'medium' | 'high' | 'critical'
  reason: string
  estimatedImpact: 'low' | 'medium' | 'high'
  sql: string
  existingIndex?: string
}

export interface QueryPattern {
  query: string
  frequency: number
  table: string
  whereColumns: string[]
  orderByColumns: string[]
  joinColumns: string[]
  lastExecuted: Date
  averageExecutionTime: number
}

export interface IndexAnalysisResult {
  recommendations: IndexRecommendation[]
  existingIndexes: string[]
  redundantIndexes: string[]
  missingIndexes: string[]
  performanceImpact: 'low' | 'medium' | 'high'
  summary: string
}

/**
 * SQLite Auto-Indexer that analyzes query patterns and automatically recommends
 * optimal indexes for SQLite databases
 */
export class SQLiteAutoIndexer {
  private static instance: SQLiteAutoIndexer
  private queryPatterns: Map<string, QueryPattern> = new Map()
  private existingIndexes: Map<string, any[]> = new Map()
  private analysisHistory: Map<string, IndexAnalysisResult> = new Map()

  private constructor(private logger: Logger) {}

  static getInstance(logger: Logger): SQLiteAutoIndexer {
    if (!SQLiteAutoIndexer.instance) {
      SQLiteAutoIndexer.instance = new SQLiteAutoIndexer(logger)
    }
    return SQLiteAutoIndexer.instance
  }

  /**
   * Record a query for pattern analysis
   */
  recordQuery(
    query: string,
    executionTime: number,
    table?: string
  ): void {
    const normalizedQuery = this.normalizeQuery(query)
    const pattern = this.queryPatterns.get(normalizedQuery)

    if (pattern) {
      // Update existing pattern
      pattern.frequency++
      pattern.lastExecuted = new Date()
      pattern.averageExecutionTime = 
        (pattern.averageExecutionTime * (pattern.frequency - 1) + executionTime) / pattern.frequency
    } else {
      // Create new pattern
      const newPattern: QueryPattern = {
        query: normalizedQuery,
        frequency: 1,
        table: table || this.extractTableName(query),
        whereColumns: this.extractWhereColumns(query),
        orderByColumns: this.extractOrderByColumns(query),
        joinColumns: this.extractJoinColumns(query),
        lastExecuted: new Date(),
        averageExecutionTime: executionTime
      }
      this.queryPatterns.set(normalizedQuery, newPattern)
    }
  }

  /**
   * Analyze query patterns and generate index recommendations
   */
  async analyzeAndRecommend(
    db: Kysely<any>,
    options: {
      minFrequency?: number
      slowQueryThreshold?: number
      includePartialIndexes?: boolean
      maxRecommendations?: number
    } = {}
  ): Promise<IndexAnalysisResult> {
    const {
      minFrequency = 3,
      slowQueryThreshold = 1000,
      includePartialIndexes = true,
      maxRecommendations = 20
    } = options

    try {
      // Get existing indexes
      await this.loadExistingIndexes(db)

      // Filter relevant patterns
      const relevantPatterns = Array.from(this.queryPatterns.values())
        .filter(pattern => 
          pattern.frequency >= minFrequency || 
          pattern.averageExecutionTime > slowQueryThreshold
        )
        .sort((a, b) => b.frequency - a.frequency)

      // Generate recommendations
      const recommendations = await this.generateRecommendations(
        db,
        relevantPatterns,
        includePartialIndexes
      )

      // Analyze existing indexes for redundancy
      const redundantIndexes = await this.findRedundantIndexes(db)

      // Generate missing index suggestions
      const missingIndexes = this.findMissingIndexes(recommendations)

      // Limit recommendations
      const limitedRecommendations = recommendations
        .sort((a, b) => this.getPriorityScore(b) - this.getPriorityScore(a))
        .slice(0, maxRecommendations)

      const result: IndexAnalysisResult = {
        recommendations: limitedRecommendations,
        existingIndexes: Array.from(this.existingIndexes.keys()),
        redundantIndexes,
        missingIndexes,
        performanceImpact: this.calculatePerformanceImpact(limitedRecommendations),
        summary: this.generateSummary(limitedRecommendations, redundantIndexes)
      }

      // Store analysis history
      const dbId = await this.getDatabaseId(db)
      this.analysisHistory.set(dbId, result)

      this.logger.info(`Generated ${limitedRecommendations.length} index recommendations`)
      return result

    } catch (error) {
      this.logger.error('Failed to analyze index patterns:', error)
      throw error
    }
  }

  /**
   * Generate index recommendations based on query patterns
   */
  private async generateRecommendations(
    db: Kysely<any>,
    patterns: QueryPattern[],
    includePartialIndexes: boolean
  ): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = []
    const processedTables = new Set<string>()

    for (const pattern of patterns) {
      if (processedTables.has(pattern.table)) continue

      // WHERE clause indexes
      if (pattern.whereColumns.length > 0) {
        const whereRecommendations = await this.generateWhereIndexes(
          db,
          pattern,
          includePartialIndexes
        )
        recommendations.push(...whereRecommendations)
      }

      // ORDER BY indexes
      if (pattern.orderByColumns.length > 0) {
        const orderByRecommendations = await this.generateOrderByIndexes(
          db,
          pattern,
          includePartialIndexes
        )
        recommendations.push(...orderByRecommendations)
      }

      // JOIN indexes
      if (pattern.joinColumns.length > 0) {
        const joinRecommendations = await this.generateJoinIndexes(
          db,
          pattern,
          includePartialIndexes
        )
        recommendations.push(...joinRecommendations)
      }

      processedTables.add(pattern.table)
    }

    return this.deduplicateRecommendations(recommendations)
  }

  /**
   * Generate indexes for WHERE clauses
   */
  private async generateWhereIndexes(
    db: Kysely<any>,
    pattern: QueryPattern,
    includePartialIndexes: boolean
  ): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = []

    for (const column of pattern.whereColumns) {
      // Check if index already exists
      const existingIndex = await this.findExistingIndex(db, pattern.table, [column])
      if (existingIndex) continue

      const priority = this.calculateWherePriority(pattern, column)
      const type = this.determineIndexType(pattern, column)

      recommendations.push({
        table: pattern.table,
        columns: [column],
        type,
        priority,
        reason: `Frequently queried column (${pattern.frequency} times, avg ${Math.round(pattern.averageExecutionTime)}ms)`,
        estimatedImpact: this.estimateImpact(pattern),
        sql: this.generateIndexSQL(pattern.table, [column], type, includePartialIndexes)
      })
    }

    // Composite indexes for multiple WHERE columns
    if (pattern.whereColumns.length > 1) {
      const compositeRecommendation = await this.generateCompositeWhereIndex(
        db,
        pattern,
        includePartialIndexes
      )
      if (compositeRecommendation) {
        recommendations.push(compositeRecommendation)
      }
    }

    return recommendations
  }

  /**
   * Generate indexes for ORDER BY clauses
   */
  private async generateOrderByIndexes(
    db: Kysely<any>,
    pattern: QueryPattern,
    includePartialIndexes: boolean
  ): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = []

    for (const column of pattern.orderByColumns) {
      const existingIndex = await this.findExistingIndex(db, pattern.table, [column])
      if (existingIndex) continue

      recommendations.push({
        table: pattern.table,
        columns: [column],
        type: 'single',
        priority: 'medium',
        reason: `Frequently ordered by column (${pattern.frequency} times)`,
        estimatedImpact: 'medium',
        sql: this.generateIndexSQL(pattern.table, [column], 'single', includePartialIndexes)
      })
    }

    return recommendations
  }

  /**
   * Generate indexes for JOIN clauses
   */
  private async generateJoinIndexes(
    db: Kysely<any>,
    pattern: QueryPattern,
    includePartialIndexes: boolean
  ): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = []

    for (const column of pattern.joinColumns) {
      const existingIndex = await this.findExistingIndex(db, pattern.table, [column])
      if (existingIndex) continue

      recommendations.push({
        table: pattern.table,
        columns: [column],
        type: 'single',
        priority: 'high',
        reason: `Foreign key column used in joins (${pattern.frequency} times)`,
        estimatedImpact: 'high',
        sql: this.generateIndexSQL(pattern.table, [column], 'single', includePartialIndexes)
      })
    }

    return recommendations
  }

  /**
   * Generate composite index for WHERE clauses
   */
  private async generateCompositeWhereIndex(
    db: Kysely<any>,
    pattern: QueryPattern,
    includePartialIndexes: boolean
  ): Promise<IndexRecommendation | null> {
    const columns = pattern.whereColumns.slice(0, 3) // Limit to 3 columns for composite index
    const existingIndex = await this.findExistingIndex(db, pattern.table, columns)
    
    if (existingIndex) return null

    return {
      table: pattern.table,
      columns,
      type: 'composite',
      priority: 'high',
      reason: `Composite index for multiple WHERE columns (${pattern.frequency} times)`,
      estimatedImpact: 'high',
      sql: this.generateIndexSQL(pattern.table, columns, 'composite', includePartialIndexes)
    }
  }

  /**
   * Find redundant indexes
   */
  private async findRedundantIndexes(db: Kysely<any>): Promise<string[]> {
    const redundant: string[] = []
    const tableIndexes = new Map<string, any[]>()

    // Group indexes by table
    for (const [indexName, indexes] of this.existingIndexes.entries()) {
      for (const index of indexes) {
        if (!tableIndexes.has(index.table)) {
          tableIndexes.set(index.table, [])
        }
        tableIndexes.get(index.table)!.push({ ...index, name: indexName })
      }
    }

    // Check for redundant indexes
    for (const [table, indexes] of tableIndexes.entries()) {
      for (let i = 0; i < indexes.length; i++) {
        for (let j = i + 1; j < indexes.length; j++) {
          const index1 = indexes[i]
          const index2 = indexes[j]

          // Check if one index is a prefix of another
          if (this.isIndexPrefix(index1.columns, index2.columns)) {
            redundant.push(index2.name)
          } else if (this.isIndexPrefix(index2.columns, index1.columns)) {
            redundant.push(index1.name)
          }
        }
      }
    }

    return redundant
  }

  /**
   * Find missing indexes
   */
  private findMissingIndexes(recommendations: IndexRecommendation[]): string[] {
    const missing: string[] = []
    const existingIndexNames = new Set(this.existingIndexes.keys())

    for (const rec of recommendations) {
      const indexName = this.generateIndexName(rec.table, rec.columns)
      if (!existingIndexNames.has(indexName)) {
        missing.push(indexName)
      }
    }

    return missing
  }

  /**
   * Load existing indexes from database
   */
  private async loadExistingIndexes(db: Kysely<any>): Promise<void> {
    try {
      const result = await db
        .selectFrom('sqlite_master')
        .select(['name', 'sql', 'tbl_name'])
        .where('type', '=', 'index')
        .where('name', 'not like', 'sqlite_%')
        .execute()

      this.existingIndexes.clear()

      for (const row of result) {
        const columns = this.extractColumnsFromSQL(row.sql || '')
        this.existingIndexes.set(row.name, [{
          name: row.name,
          table: row.tbl_name,
          columns,
          sql: row.sql
        }])
      }
    } catch (error) {
      this.logger.warn('Failed to load existing indexes:', error)
    }
  }

  /**
   * Check if an index is a prefix of another
   */
  private isIndexPrefix(columns1: string[], columns2: string[]): boolean {
    if (columns1.length >= columns2.length) return false
    
    for (let i = 0; i < columns1.length; i++) {
      if (columns1[i] !== columns2[i]) return false
    }
    
    return true
  }

  /**
   * Find existing index for columns
   */
  private async findExistingIndex(
    db: Kysely<any>,
    table: string,
    columns: string[]
  ): Promise<string | null> {
    for (const [indexName, indexes] of this.existingIndexes.entries()) {
      for (const index of indexes) {
        if (index.table === table && 
            this.arraysEqual(index.columns, columns)) {
          return indexName
        }
      }
    }
    return null
  }

  /**
   * Calculate priority for WHERE column
   */
  private calculateWherePriority(pattern: QueryPattern, column: string): 'low' | 'medium' | 'high' | 'critical' {
    if (pattern.averageExecutionTime > 5000) return 'critical'
    if (pattern.frequency > 20) return 'high'
    if (pattern.frequency > 10) return 'medium'
    return 'low'
  }

  /**
   * Determine index type
   */
  private determineIndexType(pattern: QueryPattern, column: string): 'single' | 'composite' | 'unique' | 'partial' {
    // This would need more sophisticated logic based on column analysis
    return 'single'
  }

  /**
   * Estimate performance impact
   */
  private estimateImpact(pattern: QueryPattern): 'low' | 'medium' | 'high' {
    if (pattern.averageExecutionTime > 2000) return 'high'
    if (pattern.frequency > 15) return 'high'
    if (pattern.averageExecutionTime > 500) return 'medium'
    return 'low'
  }

  /**
   * Generate index SQL
   */
  private generateIndexSQL(
    table: string,
    columns: string[],
    type: string,
    includePartialIndexes: boolean
  ): string {
    const indexName = this.generateIndexName(table, columns)
    const columnList = columns.map(col => `"${col}"`).join(', ')
    
    let sql = `CREATE INDEX "${indexName}" ON "${table}" (${columnList})`
    
    if (type === 'unique') {
      sql = sql.replace('CREATE INDEX', 'CREATE UNIQUE INDEX')
    }
    
    return sql
  }

  /**
   * Generate index name
   */
  private generateIndexName(table: string, columns: string[]): string {
    const columnSuffix = columns.length === 1 ? columns[0] : `${columns.length}cols`
    return `idx_${table}_${columnSuffix}`
  }

  /**
   * Calculate priority score for sorting
   */
  private getPriorityScore(recommendation: IndexRecommendation): number {
    const priorityScores = { critical: 4, high: 3, medium: 2, low: 1 }
    const impactScores = { high: 3, medium: 2, low: 1 }
    
    return priorityScores[recommendation.priority] * impactScores[recommendation.estimatedImpact]
  }

  /**
   * Calculate overall performance impact
   */
  private calculatePerformanceImpact(recommendations: IndexRecommendation[]): 'low' | 'medium' | 'high' {
    const highImpactCount = recommendations.filter(r => r.estimatedImpact === 'high').length
    const mediumImpactCount = recommendations.filter(r => r.estimatedImpact === 'medium').length
    
    if (highImpactCount > 3) return 'high'
    if (highImpactCount > 0 || mediumImpactCount > 5) return 'medium'
    return 'low'
  }

  /**
   * Generate analysis summary
   */
  private generateSummary(
    recommendations: IndexRecommendation[],
    redundantIndexes: string[]
  ): string {
    const criticalCount = recommendations.filter(r => r.priority === 'critical').length
    const highCount = recommendations.filter(r => r.priority === 'high').length
    const redundantCount = redundantIndexes.length

    let summary = `Found ${recommendations.length} index recommendations`
    
    if (criticalCount > 0) {
      summary += `, ${criticalCount} critical`
    }
    if (highCount > 0) {
      summary += `, ${highCount} high priority`
    }
    if (redundantCount > 0) {
      summary += `. ${redundantCount} redundant indexes identified for removal`
    }

    return summary
  }

  /**
   * Deduplicate recommendations
   */
  private deduplicateRecommendations(recommendations: IndexRecommendation[]): IndexRecommendation[] {
    const seen = new Set<string>()
    return recommendations.filter(rec => {
      const key = `${rec.table}:${rec.columns.join(',')}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  /**
   * Extract table name from query
   */
  private extractTableName(query: string): string {
    const match = query.match(/FROM\s+["`]?(\w+)["`]?/i)
    return match ? match[1] : 'unknown'
  }

  /**
   * Extract WHERE columns from query
   */
  private extractWhereColumns(query: string): string[] {
    const whereMatch = query.match(/WHERE\s+([^ORDER\s]+)/i)
    if (!whereMatch) return []

    const whereClause = whereMatch[1]
    const columnMatches = whereClause.match(/(\w+)\s*[=<>]/g)
    
    return columnMatches ? 
      columnMatches.map(match => match.replace(/\s*[=<>].*/, '').trim()) : []
  }

  /**
   * Extract ORDER BY columns from query
   */
  private extractOrderByColumns(query: string): string[] {
    const orderMatch = query.match(/ORDER\s+BY\s+([^LIMIT\s]+)/i)
    if (!orderMatch) return []

    const orderClause = orderMatch[1]
    return orderClause
      .split(',')
      .map(col => col.trim().replace(/\s+(ASC|DESC).*$/i, '').replace(/["`]/g, ''))
      .filter(col => col.length > 0)
  }

  /**
   * Extract JOIN columns from query
   */
  private extractJoinColumns(query: string): string[] {
    const joinMatches = query.match(/JOIN\s+\w+\s+ON\s+([^WHERE\s]+)/gi)
    if (!joinMatches) return []

    const columns: string[] = []
    for (const match of joinMatches) {
      const onClause = match.replace(/JOIN\s+\w+\s+ON\s+/i, '')
      const columnMatches = onClause.match(/(\w+)\s*=/g)
      if (columnMatches) {
        columns.push(...columnMatches.map(m => m.replace(/\s*=.*/, '').trim()))
      }
    }

    return columns
  }

  /**
   * Extract columns from SQL index definition
   */
  private extractColumnsFromSQL(sql: string): string[] {
    if (!sql) return []
    
    const match = sql.match(/\(([^)]+)\)/)
    if (match) {
      return match[1]
        .split(',')
        .map(col => col.trim().replace(/^\s*["']?|["']?\s*$/g, ''))
        .filter(col => col.length > 0)
    }
    
    return []
  }

  /**
   * Normalize query for pattern matching
   */
  private normalizeQuery(query: string): string {
    return query
      .replace(/\$\d+/g, '?')
      .replace(/'[^']*'/g, '?')
      .replace(/\b\d+\b/g, '?')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  }

  /**
   * Check if two arrays are equal
   */
  private arraysEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((val, i) => val === b[i])
  }

  /**
   * Get database identifier
   */
  private async getDatabaseId(db: Kysely<any>): Promise<string> {
    try {
      const result = await sql`PRAGMA database_list`.execute(db)
      const mainDb = (result.rows as any[]).find((db: any) => db.seq === 0)
      return mainDb?.file || 'unknown'
    } catch (error) {
      return 'unknown'
    }
  }

  /**
   * Get analysis history
   */
  getAnalysisHistory(dbId?: string): IndexAnalysisResult | null {
    if (!dbId) return null
    return this.analysisHistory.get(dbId) || null
  }

  /**
   * Clear analysis data
   */
  clearAnalysisData(): void {
    this.queryPatterns.clear()
    this.existingIndexes.clear()
    this.analysisHistory.clear()
  }

  /**
   * Get query pattern statistics
   */
  getQueryPatternStats(): {
    totalPatterns: number
    totalQueries: number
    averageFrequency: number
    slowQueries: number
  } {
    const patterns = Array.from(this.queryPatterns.values())
    const totalQueries = patterns.reduce((sum, p) => sum + p.frequency, 0)
    const averageFrequency = patterns.length > 0 ? totalQueries / patterns.length : 0
    const slowQueries = patterns.filter(p => p.averageExecutionTime > 1000).length

    return {
      totalPatterns: patterns.length,
      totalQueries,
      averageFrequency,
      slowQueries
    }
  }
}
