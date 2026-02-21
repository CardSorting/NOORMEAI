import type { Kysely } from '../../../../kysely.js'
import { sql } from '../../../../raw-builder/sql.js'

/**
 * SQLite-specific constraint discovery
 */
export class SQLiteConstraintDiscovery {
  private static instance: SQLiteConstraintDiscovery

  static getInstance(): SQLiteConstraintDiscovery {
    if (!SQLiteConstraintDiscovery.instance) {
      SQLiteConstraintDiscovery.instance = new SQLiteConstraintDiscovery()
    }
    return SQLiteConstraintDiscovery.instance
  }

  /**
   * Discover constraints from SQLite table definition
   */
  async discoverTableConstraints(db: Kysely<any>, tableName: string): Promise<any[]> {
    try {
      // Get table definition from sqlite_master
      const tableDef = await db
        .selectFrom('sqlite_master')
        .select('sql')
        .where('type', '=', 'table')
        .where('name', '=', tableName)
        .executeTakeFirst()

      if (!tableDef?.sql) {
        return []
      }

      return this.parseConstraintsFromSQL(tableDef.sql, tableName)
    } catch (error) {
      console.warn(`Failed to discover constraints for SQLite table ${tableName}:`, error)
      return []
    }
  }

  /**
   * Parse constraints from SQLite CREATE TABLE statement
   */
  private parseConstraintsFromSQL(sql: string, tableName: string): any[] {
    const constraints: any[] = []
    
    // Extract column definitions and table constraints
    const columnMatches = sql.match(/CREATE TABLE[^(]*\(([^)]+)\)/i)
    if (!columnMatches) return constraints

    const definitions = columnMatches[1].split(',').map(def => def.trim())

    for (const definition of definitions) {
      // Primary key constraints
      if (definition.toUpperCase().includes('PRIMARY KEY')) {
        const pkMatch = definition.match(/(\w+)\s+PRIMARY KEY/i)
        if (pkMatch) {
          constraints.push({
            name: `${tableName}_pk`,
            type: 'p',
            columns: [pkMatch[1]],
            definition: definition
          })
        }
      }

      // Foreign key constraints
      if (definition.toUpperCase().includes('FOREIGN KEY')) {
        const fkMatch = definition.match(/FOREIGN KEY\s*\((\w+)\)\s*REFERENCES\s+(\w+)\s*\((\w+)\)/i)
        if (fkMatch) {
          constraints.push({
            name: `${tableName}_fk_${fkMatch[1]}`,
            type: 'f',
            column: fkMatch[1],
            referencedTable: fkMatch[2],
            referencedColumn: fkMatch[3],
            definition: definition
          })
        }
      }

      // Check constraints
      if (definition.toUpperCase().includes('CHECK')) {
        const checkMatch = definition.match(/CHECK\s*\(([^)]+)\)/i)
        if (checkMatch) {
          constraints.push({
            name: `${tableName}_check_${constraints.length + 1}`,
            type: 'c',
            definition: checkMatch[1],
            fullDefinition: definition
          })
        }
      }

      // Unique constraints
      if (definition.toUpperCase().includes('UNIQUE')) {
        const uniqueMatch = definition.match(/UNIQUE\s*\(([^)]+)\)/i)
        if (uniqueMatch) {
          constraints.push({
            name: `${tableName}_unique_${constraints.length + 1}`,
            type: 'u',
            columns: uniqueMatch[1].split(',').map(col => col.trim()),
            definition: definition
          })
        }
      }

      // Not null constraints
      if (definition.toUpperCase().includes('NOT NULL')) {
        const notNullMatch = definition.match(/(\w+)\s+[^,]+\s+NOT NULL/i)
        if (notNullMatch) {
          constraints.push({
            name: `${tableName}_nn_${notNullMatch[1]}`,
            type: 'n',
            column: notNullMatch[1],
            definition: definition
          })
        }
      }
    }

    return constraints
  }

  /**
   * Get foreign key information using PRAGMA
   */
  async getForeignKeyInfo(db: Kysely<any>, tableName: string): Promise<any[]> {
    try {
      const result = await sql`PRAGMA foreign_key_list(${sql.lit(tableName)})`.execute(db)

      return (result.rows || []).map((row: any) => ({
        name: `${tableName}_fk_${row.column}`,
        type: 'f',
        column: row.column || row.from,
        referencedTable: row.table,
        // If 'to' is null/undefined, the FK references the primary key (default to 'id')
        referencedColumn: row.to || 'id',
        onDelete: row.on_delete || 'NO ACTION',
        onUpdate: row.on_update || 'NO ACTION'
      }))
    } catch (error) {
      console.warn(`Failed to get foreign key info for SQLite table ${tableName}:`, error)
      return []
    }
  }

  /**
   * Check if foreign keys are enabled
   */
  async isForeignKeySupportEnabled(db: Kysely<any>): Promise<boolean> {
    try {
      const result = await sql`PRAGMA foreign_keys`.execute(db)

      return (result.rows as any)?.[0]?.foreign_keys === 1
    } catch (error) {
      console.warn('Failed to check foreign key support:', error)
      return false
    }
  }

  /**
   * Validate SQLite constraints
   */
  validateConstraints(constraints: any[]): { isValid: boolean; issues: string[] } {
    const issues: string[] = []

    for (const constraint of constraints) {
      if (!constraint.name) {
        issues.push('Constraint name is required')
      }

      if (!constraint.type) {
        issues.push(`Constraint type is required for ${constraint.name}`)
      }

      // Validate foreign key constraints
      if (constraint.type === 'f') {
        if (!constraint.column) {
          issues.push(`Foreign key constraint ${constraint.name} missing column`)
        }
        if (!constraint.referencedTable) {
          issues.push(`Foreign key constraint ${constraint.name} missing referenced table`)
        }
        if (!constraint.referencedColumn) {
          issues.push(`Foreign key constraint ${constraint.name} missing referenced column`)
        }
      }

      // Validate check constraints
      if (constraint.type === 'c' && !constraint.definition) {
        issues.push(`Check constraint ${constraint.name} missing definition`)
      }
    }

    return {
      isValid: issues.length === 0,
      issues
    }
  }

  /**
   * Analyze constraint compatibility
   */
  analyzeConstraintCompatibility(constraints: any[]): {
    recommendations: string[]
    compatibilityIssues: string[]
  } {
    const recommendations: string[] = []
    const compatibilityIssues: string[] = []

    // Check for complex constraints that might not be portable
    for (const constraint of constraints) {
      if (constraint.type === 'c' && constraint.definition) {
        const definition = constraint.definition.toLowerCase()
        
        // Check for SQLite-specific functions
        if (definition.includes('datetime(') || definition.includes('date(')) {
          compatibilityIssues.push(`Check constraint ${constraint.name} uses SQLite-specific date functions`)
        }

        if (definition.includes('substr(') || definition.includes('length(')) {
          compatibilityIssues.push(`Check constraint ${constraint.name} uses SQLite-specific string functions`)
        }
      }
    }

    // Recommendations for better portability
    if (compatibilityIssues.length > 0) {
      recommendations.push('Consider using standard SQL functions for better database portability')
    }

    return {
      recommendations,
      compatibilityIssues
    }
  }

  /**
   * Validate foreign key constraints and provide recommendations
   */
  async validateForeignKeyConstraints(db: Kysely<any>): Promise<{
    isValid: boolean
    issues: string[]
    recommendations: string[]
    orphanedRecords: { table: string; count: number }[]
    performanceImpact: 'low' | 'medium' | 'high'
  }> {
    const issues: string[] = []
    const recommendations: string[] = []
    const orphanedRecords: { table: string; count: number }[] = []

    try {
      // Check if foreign keys are enabled
      const fkEnabled = await this.isForeignKeySupportEnabled(db)
      if (!fkEnabled) {
        issues.push('Foreign key constraints are disabled')
        recommendations.push('Enable foreign key constraints with PRAGMA foreign_keys = ON')
      }

      // Get all tables with foreign keys
      const tables = await this.getTablesWithForeignKeys(db)
      
      for (const table of tables) {
        const foreignKeys = await this.getForeignKeyInfo(db, table)
        
        for (const fk of foreignKeys) {
          // Check for orphaned records
          const orphanedCount = await this.checkOrphanedRecords(db, table, fk)
          if (orphanedCount > 0) {
            orphanedRecords.push({ table, count: orphanedCount })
            issues.push(`Table ${table} has ${orphanedCount} orphaned records for foreign key ${fk.column}`)
            recommendations.push(`Clean up orphaned records in ${table}.${fk.column} or add proper foreign key constraints`)
          }

          // Check for missing indexes on foreign key columns
          const hasIndex = await this.checkForeignKeyIndex(db, table, fk.column)
          if (!hasIndex) {
            recommendations.push(`Add index on ${table}.${fk.column} for better join performance`)
          }

          // Validate referenced table exists
          const referencedTableExists = await this.checkTableExists(db, fk.referencedTable)
          if (!referencedTableExists) {
            issues.push(`Foreign key ${fk.column} references non-existent table ${fk.referencedTable}`)
            recommendations.push(`Create table ${fk.referencedTable} or remove invalid foreign key`)
          } else {
            // Validate referenced column exists
            const referencedColumnExists = await this.checkColumnExists(db, fk.referencedTable, fk.referencedColumn)
            if (!referencedColumnExists) {
              issues.push(`Foreign key ${fk.column} references non-existent column ${fk.referencedTable}.${fk.referencedColumn}`)
              recommendations.push(`Add column ${fk.referencedColumn} to table ${fk.referencedTable} or fix foreign key reference`)
            }
          }
        }
      }

      // Performance impact assessment
      const performanceImpact = this.assessPerformanceImpact(issues, orphanedRecords)

      return {
        isValid: issues.length === 0,
        issues,
        recommendations,
        orphanedRecords,
        performanceImpact
      }

    } catch (error) {
      issues.push(`Foreign key validation failed: ${error}`)
      return {
        isValid: false,
        issues,
        recommendations: ['Check database connection and permissions'],
        orphanedRecords: [],
        performanceImpact: 'high'
      }
    }
  }

  /**
   * Get tables that have foreign key constraints
   */
  private async getTablesWithForeignKeys(db: Kysely<any>): Promise<string[]> {
    try {
      const result = await db
        .selectFrom('sqlite_master')
        .select('name')
        .where('type', '=', 'table')
        .where('name', 'not like', 'sqlite_%')
        .execute()

      const tablesWithFks: string[] = []
      
      for (const row of result) {
        const fks = await this.getForeignKeyInfo(db, row.name)
        if (fks.length > 0) {
          tablesWithFks.push(row.name)
        }
      }

      return tablesWithFks
    } catch (error) {
      return []
    }
  }

  /**
   * Check for orphaned records in foreign key relationships
   */
  private async checkOrphanedRecords(
    db: Kysely<any>,
    table: string,
    foreignKey: any
  ): Promise<number> {
    try {
      // Use a simpler approach to avoid type issues
      const result = await sql`
        SELECT COUNT(*) as count
        FROM ${sql.id(table)} t
        LEFT JOIN ${sql.id(foreignKey.referencedTable)} r
          ON t.${sql.id(foreignKey.column)} = r.${sql.id(foreignKey.referencedColumn)}
        WHERE r.${sql.id(foreignKey.referencedColumn)} IS NULL
      `.execute(db)

      return Number((result.rows[0] as any)?.count || 0)
    } catch (error) {
      return 0
    }
  }

  /**
   * Check if foreign key column has an index
   */
  private async checkForeignKeyIndex(db: Kysely<any>, table: string, column: string): Promise<boolean> {
    try {
      const result = await db
        .selectFrom('sqlite_master')
        .select('sql')
        .where('type', '=', 'index')
        .where('tbl_name', '=', table)
        .execute()

      for (const row of result) {
        if (row.sql && row.sql.includes(column)) {
          return true
        }
      }

      return false
    } catch (error) {
      return false
    }
  }

  /**
   * Check if table exists
   */
  private async checkTableExists(db: Kysely<any>, tableName: string): Promise<boolean> {
    try {
      const result = await db
        .selectFrom('sqlite_master')
        .select('name')
        .where('type', '=', 'table')
        .where('name', '=', tableName)
        .executeTakeFirst()

      return !!result
    } catch (error) {
      return false
    }
  }

  /**
   * Check if column exists in table
   */
  private async checkColumnExists(db: Kysely<any>, tableName: string, columnName: string): Promise<boolean> {
    try {
      const result = await db
        .selectFrom('sqlite_master')
        .select('sql')
        .where('type', '=', 'table')
        .where('name', '=', tableName)
        .executeTakeFirst()

      if (!result?.sql) return false

      // Parse column names from CREATE TABLE statement
      const columnMatch = result.sql.match(/CREATE TABLE[^(]*\(([^)]+)\)/i)
      if (!columnMatch) return false

      const columns = columnMatch[1]
        .split(',')
        .map((col: string) => col.trim())
        .map((col: string) => col.split(/\s+/)[0].replace(/["`]/g, ''))

      return columns.includes(columnName)
    } catch (error) {
      return false
    }
  }

  /**
   * Assess performance impact of foreign key issues
   */
  private assessPerformanceImpact(
    issues: string[],
    orphanedRecords: { table: string; count: number }[]
  ): 'low' | 'medium' | 'high' {
    const totalOrphaned = orphanedRecords.reduce((sum, record) => sum + record.count, 0)
    
    if (issues.length > 5 || totalOrphaned > 1000) return 'high'
    if (issues.length > 2 || totalOrphaned > 100) return 'medium'
    return 'low'
  }

  /**
   * Generate foreign key optimization recommendations
   */
  async generateForeignKeyOptimizations(db: Kysely<any>): Promise<{
    indexRecommendations: string[]
    constraintRecommendations: string[]
    cleanupRecommendations: string[]
    performanceRecommendations: string[]
  }> {
    const indexRecommendations: string[] = []
    const constraintRecommendations: string[] = []
    const cleanupRecommendations: string[] = []
    const performanceRecommendations: string[] = []

    try {
      // Check foreign key support
      const fkEnabled = await this.isForeignKeySupportEnabled(db)
      if (!fkEnabled) {
        constraintRecommendations.push('PRAGMA foreign_keys = ON')
      }

      // Get all foreign key relationships
      const tables = await this.getTablesWithForeignKeys(db)
      
      for (const table of tables) {
        const foreignKeys = await this.getForeignKeyInfo(db, table)
        
        for (const fk of foreignKeys) {
          // Index recommendations
          const hasIndex = await this.checkForeignKeyIndex(db, table, fk.column)
          if (!hasIndex) {
            indexRecommendations.push(`CREATE INDEX idx_${table}_${fk.column} ON ${table} (${fk.column})`)
          }

          // Check for orphaned records
          const orphanedCount = await this.checkOrphanedRecords(db, table, fk)
          if (orphanedCount > 0) {
            cleanupRecommendations.push(
              `DELETE FROM ${table} WHERE ${fk.column} NOT IN (SELECT ${fk.referencedColumn} FROM ${fk.referencedTable})`
            )
          }

          // Performance recommendations
          if (orphanedCount > 100) {
            performanceRecommendations.push(
              `Consider adding CASCADE DELETE to foreign key ${fk.column} for automatic cleanup`
            )
          }
        }
      }

      // General performance recommendations
      if (tables.length > 10) {
        performanceRecommendations.push('Consider using deferred foreign key constraints for bulk operations')
      }

      return {
        indexRecommendations,
        constraintRecommendations,
        cleanupRecommendations,
        performanceRecommendations
      }

    } catch (error) {
      return {
        indexRecommendations: [],
        constraintRecommendations: [],
        cleanupRecommendations: [],
        performanceRecommendations: [`Error generating recommendations: ${error}`]
      }
    }
  }

  /**
   * Auto-fix common foreign key issues
   */
  async autoFixForeignKeyIssues(
    db: Kysely<any>,
    options: {
      createMissingIndexes?: boolean
      enableForeignKeys?: boolean
      cleanupOrphanedRecords?: boolean
      dryRun?: boolean
    } = {}
  ): Promise<{
    applied: string[]
    failed: string[]
    skipped: string[]
  }> {
    const {
      createMissingIndexes = true,
      enableForeignKeys = true,
      cleanupOrphanedRecords = false,
      dryRun = true
    } = options

    const applied: string[] = []
    const failed: string[] = []
    const skipped: string[] = []

    try {
      // Enable foreign keys
      if (enableForeignKeys) {
        const fkEnabled = await this.isForeignKeySupportEnabled(db)
        if (!fkEnabled) {
          if (!dryRun) {
            await sql`PRAGMA foreign_keys = ON`.execute(db)
          }
          applied.push('Enabled foreign key constraints')
        } else {
          skipped.push('Foreign key constraints already enabled')
        }
      }

      // Create missing indexes
      if (createMissingIndexes) {
        const tables = await this.getTablesWithForeignKeys(db)
        
        for (const table of tables) {
          const foreignKeys = await this.getForeignKeyInfo(db, table)
          
          for (const fk of foreignKeys) {
            const hasIndex = await this.checkForeignKeyIndex(db, table, fk.column)
            if (!hasIndex) {
              const indexSQL = `CREATE INDEX idx_${table}_${fk.column} ON ${table} (${fk.column})`
              
              if (!dryRun) {
                try {
                  await sql.raw(indexSQL).execute(db)
                  applied.push(`Created index on ${table}.${fk.column}`)
                } catch (error) {
                  failed.push(`Failed to create index on ${table}.${fk.column}: ${error}`)
                }
              } else {
                applied.push(`Would create index on ${table}.${fk.column}`)
              }
            }
          }
        }
      }

      // Cleanup orphaned records
      if (cleanupOrphanedRecords) {
        const tables = await this.getTablesWithForeignKeys(db)
        
        for (const table of tables) {
          const foreignKeys = await this.getForeignKeyInfo(db, table)
          
          for (const fk of foreignKeys) {
            const orphanedCount = await this.checkOrphanedRecords(db, table, fk)
            if (orphanedCount > 0) {
              const cleanupSQL = `DELETE FROM ${table} WHERE ${fk.column} NOT IN (SELECT ${fk.referencedColumn} FROM ${fk.referencedTable})`
              
              if (!dryRun) {
                try {
                  await sql.raw(cleanupSQL).execute(db)
                  applied.push(`Cleaned up ${orphanedCount} orphaned records in ${table}.${fk.column}`)
                } catch (error) {
                  failed.push(`Failed to cleanup orphaned records in ${table}.${fk.column}: ${error}`)
                }
              } else {
                applied.push(`Would cleanup ${orphanedCount} orphaned records in ${table}.${fk.column}`)
              }
            }
          }
        }
      }

      return { applied, failed, skipped }

    } catch (error) {
      failed.push(`Auto-fix failed: ${error}`)
      return { applied, failed, skipped }
    }
  }
}
