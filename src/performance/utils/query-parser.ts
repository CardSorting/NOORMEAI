/**
 * Query parsing utilities for performance analysis and optimization
 */

export interface ParsedQuery {
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER'
  tables: string[]
  whereColumns: string[]
  joinColumns: Array<{ table: string; column: string }>
  orderByColumns: string[]
  groupByColumns: string[]
  hasLimit: boolean
  hasAggregates: boolean
  isComplex: boolean
}

export interface QueryPattern {
  normalized: string
  original: string
  frequency: number
  averageTime: number
  tables: string[]
}

/**
 * Utility class for parsing and analyzing SQL queries
 */
export class QueryParser {
  /**
   * Parse a SQL query into structured components
   */
  static parseQuery(query: string): ParsedQuery {
    const normalized = this.normalizeQuery(query)
    const lowerQuery = normalized.toLowerCase()

    return {
      type: this.extractQueryType(normalized),
      tables: this.extractTables(normalized),
      whereColumns: this.extractWhereColumns(normalized),
      joinColumns: this.extractJoinColumns(normalized),
      orderByColumns: this.extractOrderByColumns(normalized),
      groupByColumns: this.extractGroupByColumns(normalized),
      hasLimit: lowerQuery.includes('limit'),
      hasAggregates: this.hasAggregates(normalized),
      isComplex: this.isComplexQuery(normalized)
    }
  }

  /**
   * Normalize query for comparison (remove dynamic values)
   */
  static normalizeQuery(query: string): string {
    return query
      .replace(/\$\d+/g, '?') // Replace PostgreSQL parameters
      .replace(/'[^']*'/g, '?') // Replace string literals
      .replace(/\b\d+\b/g, '?') // Replace numbers
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
  }

  /**
   * Extract query type from SQL statement
   */
  static extractQueryType(query: string): ParsedQuery['type'] {
    const normalized = query.trim().toUpperCase()
    if (normalized.startsWith('SELECT')) return 'SELECT'
    if (normalized.startsWith('INSERT')) return 'INSERT'
    if (normalized.startsWith('UPDATE')) return 'UPDATE'
    if (normalized.startsWith('DELETE')) return 'DELETE'
    return 'OTHER'
  }

  /**
   * Extract table names from query
   */
  static extractTables(query: string): string[] {
    const tables = new Set<string>()
    
    // FROM clause
    const fromMatches = query.match(/from\s+(\w+)/gi)
    if (fromMatches) {
      fromMatches.forEach(match => {
        const table = match.split(/\s+/)[1]
        if (table) tables.add(table)
      })
    }

    // JOIN clauses
    const joinMatches = query.match(/join\s+(\w+)/gi)
    if (joinMatches) {
      joinMatches.forEach(match => {
        const table = match.split(/\s+/)[1]
        if (table) tables.add(table)
      })
    }

    return Array.from(tables)
  }

  /**
   * Extract columns used in WHERE clauses
   */
  static extractWhereColumns(query: string): string[] {
    const whereMatch = query.match(/where\s+(.+?)(?:\s+group\s+by|\s+order\s+by|\s+limit|$)/i)
    if (!whereMatch) return []

    const whereClause = whereMatch[1]
    const columnMatches = whereClause.match(/(\w+)\s*[=<>!]/g)
    
    return columnMatches 
      ? columnMatches.map(match => match.split(/\s+/)[0]).filter(Boolean)
      : []
  }

  /**
   * Extract columns used in JOIN conditions
   */
  static extractJoinColumns(query: string): Array<{ table: string; column: string }> {
    const joinMatches = query.match(/join\s+\w+\s+on\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/gi)
    if (!joinMatches) return []

    const columns: Array<{ table: string; column: string }> = []
    
    for (const match of joinMatches) {
      const parts = match.match(/join\s+(\w+)\s+on\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/i)
      if (parts) {
        columns.push({ table: parts[2], column: parts[3] })
        columns.push({ table: parts[4], column: parts[5] })
      }
    }
    
    return columns
  }

  /**
   * Extract columns used in ORDER BY clauses
   */
  static extractOrderByColumns(query: string): string[] {
    const orderByMatch = query.match(/order\s+by\s+(.+?)(?:\s+limit|$)/i)
    if (!orderByMatch) return []

    return orderByMatch[1]
      .split(',')
      .map(col => col.trim().split(/\s+/)[0])
      .filter(Boolean)
  }

  /**
   * Extract columns used in GROUP BY clauses
   */
  static extractGroupByColumns(query: string): string[] {
    const groupByMatch = query.match(/group\s+by\s+(.+?)(?:\s+having|\s+order\s+by|\s+limit|$)/i)
    if (!groupByMatch) return []

    return groupByMatch[1]
      .split(',')
      .map(col => col.trim())
      .filter(Boolean)
  }

  /**
   * Check if query contains aggregate functions
   */
  static hasAggregates(query: string): boolean {
    const lowerQuery = query.toLowerCase()
    return lowerQuery.includes('group by') || 
           lowerQuery.includes('having') ||
           lowerQuery.includes('count(') || 
           lowerQuery.includes('sum(') ||
           lowerQuery.includes('avg(') || 
           lowerQuery.includes('max(') ||
           lowerQuery.includes('min(')
  }

  /**
   * Check if query is complex (joins, subqueries, etc.)
   */
  static isComplexQuery(query: string): boolean {
    const lowerQuery = query.toLowerCase()
    return lowerQuery.includes('join') ||
           lowerQuery.includes('subquery') ||
           lowerQuery.includes('union') ||
           lowerQuery.includes('except') ||
           lowerQuery.includes('intersect') ||
           (lowerQuery.includes('select') && lowerQuery.includes('('))
  }

  /**
   * Check if query could return many rows
   */
  static couldReturnManyRows(query: string): boolean {
    const lowerQuery = query.toLowerCase()
    return lowerQuery.includes('where') && !lowerQuery.includes('limit')
  }

  /**
   * Extract the primary table from a query
   */
  static extractPrimaryTable(query: string): string | null {
    const fromMatch = query.match(/from\s+(\w+)/i)
    return fromMatch ? fromMatch[1] : null
  }

  /**
   * Check if query is a SELECT statement
   */
  static isSelectQuery(query: string): boolean {
    return query.toLowerCase().trim().startsWith('select')
  }

  /**
   * Check if query is a JOIN statement
   */
  static isJoinQuery(query: string): boolean {
    return query.toLowerCase().includes('join')
  }

  /**
   * Check if query is an aggregate statement
   */
  static isAggregateQuery(query: string): boolean {
    return this.hasAggregates(query)
  }

  /**
   * Generate a cache key for a query
   */
  static generateCacheKey(query: string, params: any[] = []): string {
    const normalized = this.normalizeQuery(query)
    const paramsKey = params.map(p => String(p)).join('|')
    return `${normalized}:${paramsKey}`
  }

  /**
   * Check if query should be cached
   */
  static shouldCache(query: string, executionTime: number): boolean {
    // Don't cache very fast queries
    if (executionTime < 10) {
      return false
    }

    // Don't cache queries that modify data
    const lowerQuery = query.toLowerCase()
    if (lowerQuery.includes('insert') || 
        lowerQuery.includes('update') || 
        lowerQuery.includes('delete') || 
        lowerQuery.includes('drop')) {
      return false
    }

    return true
  }

  /**
   * Extract operation type from query
   */
  static extractOperation(query: string): string {
    return this.extractQueryType(query)
  }

  /**
   * Analyze query patterns from a list of queries
   */
  static analyzePatterns(queries: Array<{ query: string; executionTime: number }>): QueryPattern[] {
    const patternMap = new Map<string, QueryPattern>()

    for (const { query, executionTime } of queries) {
      const normalized = this.normalizeQuery(query)
      
      if (patternMap.has(normalized)) {
        const pattern = patternMap.get(normalized)!
        pattern.frequency++
        pattern.averageTime = (pattern.averageTime + executionTime) / 2
      } else {
        const parsed = this.parseQuery(query)
        patternMap.set(normalized, {
          normalized,
          original: query,
          frequency: 1,
          averageTime: executionTime,
          tables: parsed.tables
        })
      }
    }

    return Array.from(patternMap.values())
      .sort((a, b) => b.frequency - a.frequency)
  }

  /**
   * Detect potential N+1 query patterns
   */
  static detectNPlusOnePatterns(queries: Array<{ query: string; timestamp: number }>): Array<{
    pattern: string
    count: number
    timeWindow: number
    severity: 'low' | 'medium' | 'high'
  }> {
    const patterns = new Map<string, Array<{ query: string; timestamp: number }>>()
    
    // Group queries by normalized pattern
    for (const queryInfo of queries) {
      const normalized = this.normalizeQuery(queryInfo.query)
      if (!patterns.has(normalized)) {
        patterns.set(normalized, [])
      }
      patterns.get(normalized)!.push(queryInfo)
    }

    const nPlusOnePatterns: Array<{
      pattern: string
      count: number
      timeWindow: number
      severity: 'low' | 'medium' | 'high'
    }> = []

    // Analyze each pattern for N+1 behavior
    for (const [pattern, queries] of patterns.entries()) {
      if (queries.length < 5) continue // Need at least 5 occurrences

      // Check for clustering in time windows
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
          break // Only report the most severe pattern
        }
      }
    }

    return nPlusOnePatterns.sort((a, b) => b.count - a.count)
  }
}
