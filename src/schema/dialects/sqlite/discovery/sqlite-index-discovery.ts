import type { Kysely } from '../../../../kysely.js'
import { DatabaseIntrospector } from '../../../../dialect/database-introspector.js'
import { sql } from '../../../../raw-builder/sql.js'

/**
 * SQLite-specific index discovery
 */
export class SQLiteIndexDiscovery {
  private static instance: SQLiteIndexDiscovery

  static getInstance(): SQLiteIndexDiscovery {
    if (!SQLiteIndexDiscovery.instance) {
      SQLiteIndexDiscovery.instance = new SQLiteIndexDiscovery()
    }
    return SQLiteIndexDiscovery.instance
  }

  /**
   * Discover indexes for a specific table in SQLite
   */
  async discoverTableIndexes(db: Kysely<any>, tableName: string): Promise<any[]> {
    try {
      const indexes = await db
        .selectFrom('sqlite_master')
        .select([
          'name',
          'sql as definition',
          sql<boolean>`type = 'index'`.as('isIndex'),
          sql<boolean>`sql LIKE '%UNIQUE%'`.as('unique')
        ])
        .where('type', '=', 'index')
        .where('tbl_name', '=', tableName)
        .execute()

      // Parse column information from SQL definition
      const processedIndexes = indexes.map((index: any) => ({
        ...index,
        columns: this.extractColumnsFromSQL(index.definition),
        isPrimary: index.name.includes('sqlite_autoindex'),
        comment: null // SQLite doesn't support index comments
      }))

      return processedIndexes
    } catch (error) {
      console.warn(`Failed to discover indexes for SQLite table ${tableName}:`, error)
      return []
    }
  }

  /**
   * Extract column names from SQLite index definition
   */
  private extractColumnsFromSQL(sql: string): string[] {
    if (!sql) return []

    // Parse columns from CREATE INDEX statement
    // Example: CREATE INDEX idx_name ON table (col1, col2)
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
   * Get index information from pragma
   */
  async getIndexInfo(db: Kysely<any>, tableName: string): Promise<any[]> {
    try {
      // SQLite pragma index_info
      const result = await sql`PRAGMA index_list(${sql.lit(tableName)})`.execute(db)

      return result.rows || []
    } catch (error) {
      console.warn(`Failed to get index info for SQLite table ${tableName}:`, error)
      return []
    }
  }

  /**
   * Analyze SQLite index efficiency
   */
  analyzeIndexEfficiency(indexes: any[]): {
    recommendations: string[]
    missingIndexes: string[]
    redundantIndexes: string[]
  } {
    const recommendations: string[] = []
    const missingIndexes: string[] = []
    const redundantIndexes: string[] = []

    // Check for auto-generated indexes that might be redundant
    const autoIndexes = indexes.filter(idx => idx.isPrimary)
    if (autoIndexes.length > 1) {
      recommendations.push('Multiple auto-generated indexes found - review table structure')
    }

    // Check for indexes with no columns (invalid)
    const invalidIndexes = indexes.filter(idx => !idx.columns || idx.columns.length === 0)
    for (const idx of invalidIndexes) {
      recommendations.push(`Invalid index found: ${idx.name} (no columns)`)
    }

    // Check for duplicate column combinations
    const columnGroups = new Map<string, string[]>()
    for (const index of indexes) {
      const key = index.columns.sort().join(',')
      if (!columnGroups.has(key)) {
        columnGroups.set(key, [])
      }
      columnGroups.get(key)!.push(index.name)
    }

    for (const [columns, names] of columnGroups) {
      if (names.length > 1) {
        redundantIndexes.push(...names)
        recommendations.push(`Redundant indexes on columns (${columns}): ${names.join(', ')}`)
      }
    }

    return {
      recommendations,
      missingIndexes,
      redundantIndexes
    }
  }

  /**
   * Get table size information for SQLite
   */
  async getTableSize(db: Kysely<any>, tableName: string): Promise<any> {
    try {
      const result = await sql`SELECT COUNT(*) as rowCount FROM ${sql.id(tableName)}`.execute(db)

      return {
        rowCount: (result.rows as any)?.[0]?.rowCount || 0,
        size: 0, // SQLite doesn't provide direct size info
        lastModified: new Date()
      }
    } catch (error) {
      console.warn(`Failed to get table size for SQLite table ${tableName}:`, error)
      return null
    }
  }
}
