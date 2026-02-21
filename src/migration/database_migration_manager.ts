/**
 * Database Migration Manager
 * 
 * Provides comprehensive tools for migrating databases between SQLite and PostgreSQL:
 * - Automated schema migration
 * - Data migration with transformation
 * - Schema diff and sync
 */

import type { Kysely } from '../kysely.js'
import { Logger } from '../logging/logger.js'
import type { 
  MigrationConfig,
  MigrationResult,
  TableSchema,
  SchemaComparisonResult,
  SyncOptions,
  MigrationProgressCallback,
} from './migration-types.js'
import { 
  introspectSQLiteSchema,
  introspectPostgreSQLSchema 
} from './schema_introspector.js'
import {
  compareSchemas,
  generateSyncSQL,
  applySchemaSyncronization,
} from './schema_differ.js'
import {
  migrateAllTablesData,
  verifyDataMigration,
  truncateTable,
  type DataMigrationOptions,
} from './data_migrator.js'
import { mapType } from './type_mapper.js'
import { sql } from '../raw-builder/sql.js'

/**
 * Main migration manager class
 */
export class DatabaseMigrationManager {
  private logger: Logger
  private sourceDb: Kysely<any>
  private targetDb: Kysely<any>
  private config: MigrationConfig
  
  constructor(
    sourceDb: Kysely<any>,
    targetDb: Kysely<any>,
    config: MigrationConfig,
    logger?: Logger
  ) {
    this.sourceDb = sourceDb
    this.targetDb = targetDb
    this.config = config
    this.logger = logger || new Logger({ level: 'info', enabled: true })
  }
  
  /**
   * Perform complete database migration (schema + data)
   */
  async migrate(): Promise<MigrationResult> {
    const startTime = Date.now()
    const result: MigrationResult = {
      success: false,
      duration: 0,
      tablesProcessed: 0,
      rowsMigrated: 0,
      errors: [],
      warnings: [],
      summary: {
        schemaChanges: 0,
        dataChanges: 0,
        indexesCreated: 0,
        constraintsApplied: 0,
      },
    }
    
    try {
      this.logger.info('🚀 Starting database migration...')
      this.logger.info(`   Source: ${this.config.source.dialect} (${this.config.source.database})`)
      this.logger.info(`   Target: ${this.config.target.dialect} (${this.config.target.database})`)
      
      // Step 1: Introspect schemas
      this.logger.info('\n📊 Step 1: Introspecting schemas...')
      const sourceSchema = await this.introspectSourceSchema()
      const targetSchema = await this.introspectTargetSchema()
      
      this.logger.info(`   Source: ${sourceSchema.length} tables`)
      this.logger.info(`   Target: ${targetSchema.length} tables`)
      
      // Filter tables based on config
      const filteredSourceSchema = this.filterTables(sourceSchema)
      this.logger.info(`   Filtered: ${filteredSourceSchema.length} tables to migrate`)
      
      // Step 2: Migrate schema (if not data-only)
      if (!this.config.options?.dataOnly) {
        this.logger.info('\n🔧 Step 2: Migrating schema...')
        const schemaResult = await this.migrateSchema(filteredSourceSchema, targetSchema)
        result.summary.schemaChanges = schemaResult.schemaChanges
        result.summary.indexesCreated = schemaResult.indexesCreated
        result.summary.constraintsApplied = schemaResult.constraintsApplied
        result.warnings.push(...schemaResult.warnings)
        
        if (!schemaResult.success) {
          throw new Error('Schema migration failed')
        }
      }
      
      // Step 3: Migrate data (if not schema-only)
      if (!this.config.options?.schemaOnly) {
        this.logger.info('\n📦 Step 3: Migrating data...')
        
        // Re-introspect target to get updated schema
        const updatedTargetSchema = await this.introspectTargetSchema()
        
        const dataResult = await this.migrateData(filteredSourceSchema, updatedTargetSchema)
        result.tablesProcessed = dataResult.tablesProcessed
        result.rowsMigrated = dataResult.rowsMigrated
        result.summary.dataChanges = dataResult.rowsMigrated
        result.errors.push(...dataResult.errors)
        result.warnings.push(...dataResult.warnings)
      }
      
      // Step 4: Verify migration
      this.logger.info('\n✅ Step 4: Verifying migration...')
      const verificationResult = await this.verifyMigration(filteredSourceSchema)
      result.warnings.push(...verificationResult.warnings)
      
      result.success = result.errors.filter(e => e.fatal).length === 0
      result.duration = Date.now() - startTime
      
      this.logger.info('\n🎉 Migration completed!')
      this.logger.info(`   Duration: ${(result.duration / 1000).toFixed(2)}s`)
      this.logger.info(`   Tables: ${result.tablesProcessed}`)
      this.logger.info(`   Rows: ${result.rowsMigrated}`)
      this.logger.info(`   Errors: ${result.errors.length}`)
      this.logger.info(`   Warnings: ${result.warnings.length}`)
      
      return result
      
    } catch (error) {
      result.errors.push({
        message: 'Migration failed',
        error: error as Error,
        fatal: true,
      })
      result.success = false
      result.duration = Date.now() - startTime
      
      this.logger.error('❌ Migration failed:', error)
      
      return result
    }
  }
  
  /**
   * Compare schemas between source and target
   */
  async compareSchemas(): Promise<SchemaComparisonResult> {
    this.logger.info('📊 Comparing schemas...')
    
    const sourceSchema = await this.introspectSourceSchema()
    const targetSchema = await this.introspectTargetSchema()
    
    const filteredSourceSchema = this.filterTables(sourceSchema)
    
    const comparison = compareSchemas(
      filteredSourceSchema,
      targetSchema,
      this.config.source.dialect,
      this.config.target.dialect
    )
    
    this.logger.info(`   Differences: ${comparison.differences.length}`)
    this.logger.info(`   Tables added: ${comparison.summary.tablesAdded}`)
    this.logger.info(`   Tables removed: ${comparison.summary.tablesRemoved}`)
    this.logger.info(`   Tables modified: ${comparison.summary.tablesModified}`)
    
    return comparison
  }
  
  /**
   * Synchronize target schema with source schema
   */
  async syncSchema(options: SyncOptions = {}): Promise<{
    success: boolean
    appliedChanges: number
    sqlStatements: string[]
    errors: Array<{ sql: string; error: Error }>
  }> {
    this.logger.info('🔄 Synchronizing schema...')
    
    const comparison = await this.compareSchemas()
    
    if (comparison.compatible) {
      this.logger.info('✅ Schemas are already in sync')
      return {
        success: true,
        appliedChanges: 0,
        sqlStatements: [],
        errors: [],
      }
    }
    
    const sqlStatements = generateSyncSQL(comparison, this.config.target.dialect)
    
    this.logger.info(`   Generated ${sqlStatements.length} SQL statements`)
    
    if (options.generateSQL) {
      this.logger.info('\nSQL Statements:')
      sqlStatements.forEach(stmt => this.logger.info(stmt))
    }
    
    if (options.apply) {
      const result = await applySchemaSyncronization(this.targetDb, sqlStatements, options)
      
      this.logger.info(`   Applied ${result.appliedStatements} changes`)
      
      if (result.errors.length > 0) {
        this.logger.error(`   Errors: ${result.errors.length}`)
        result.errors.forEach(err => {
          this.logger.error(`     ${err.sql}`)
          this.logger.error(`     ${err.error.message}`)
        })
      }
      
      return {
        success: result.success,
        appliedChanges: result.appliedStatements,
        sqlStatements,
        errors: result.errors,
      }
    }
    
    return {
      success: true,
      appliedChanges: 0,
      sqlStatements,
      errors: [],
    }
  }
  
  /**
   * Introspect source schema
   */
  private async introspectSourceSchema(): Promise<TableSchema[]> {
    if (this.config.source.dialect === 'sqlite') {
      return await introspectSQLiteSchema(this.sourceDb)
    } else {
      return await introspectPostgreSQLSchema(this.sourceDb)
    }
  }
  
  /**
   * Introspect target schema
   */
  private async introspectTargetSchema(): Promise<TableSchema[]> {
    if (this.config.target.dialect === 'sqlite') {
      return await introspectSQLiteSchema(this.targetDb)
    } else {
      return await introspectPostgreSQLSchema(this.targetDb)
    }
  }
  
  /**
   * Filter tables based on config
   */
  private filterTables(tables: TableSchema[]): TableSchema[] {
    let filtered = tables
    
    if (this.config.options?.includeTables && this.config.options.includeTables.length > 0) {
      filtered = filtered.filter(t => this.config.options!.includeTables!.includes(t.name))
    }
    
    if (this.config.options?.excludeTables && this.config.options.excludeTables.length > 0) {
      filtered = filtered.filter(t => !this.config.options!.excludeTables!.includes(t.name))
    }
    
    return filtered
  }
  
  /**
   * Migrate schema
   */
  private async migrateSchema(
    sourceSchema: TableSchema[],
    targetSchema: TableSchema[]
  ): Promise<{
    success: boolean
    schemaChanges: number
    indexesCreated: number
    constraintsApplied: number
    warnings: string[]
  }> {
    const warnings: string[] = []
    let schemaChanges = 0
    let indexesCreated = 0
    let constraintsApplied = 0
    
    // Drop existing tables if requested
    if (this.config.options?.dropTables) {
      this.logger.info('   Dropping existing tables...')
      for (const table of targetSchema) {
        if (sourceSchema.find(t => t.name === table.name)) {
          try {
            await sql.raw(`DROP TABLE IF EXISTS "${table.name}" CASCADE`).execute(this.targetDb)
            this.logger.info(`     Dropped: ${table.name}`)
          } catch (error) {
            warnings.push(`Failed to drop table ${table.name}: ${(error as Error).message}`)
          }
        }
      }
    }
    
    // Create tables
    for (const sourceTable of sourceSchema) {
      try {
        const targetTable = targetSchema.find(t => t.name === sourceTable.name)
        
        if (!targetTable || this.config.options?.dropTables) {
          // Create table
          await this.createTable(sourceTable)
          schemaChanges++
          this.logger.info(`     Created: ${sourceTable.name}`)
          
          // Create indexes
          for (const index of sourceTable.indexes) {
            await this.createIndex(index)
            indexesCreated++
          }
          
          constraintsApplied += sourceTable.constraints.length
        }
      } catch (error) {
        warnings.push(`Failed to create table ${sourceTable.name}: ${(error as Error).message}`)
      }
    }
    
    return {
      success: warnings.length === 0,
      schemaChanges,
      indexesCreated,
      constraintsApplied,
      warnings,
    }
  }
  
  /**
   * Create table in target database
   */
  private async createTable(sourceTable: TableSchema): Promise<void> {
    const targetDialect = this.config.target.dialect
    
    let createSQL = `CREATE TABLE "${sourceTable.name}" (\n`
    
    const columnDefs: string[] = []
    
    for (const column of sourceTable.columns) {
      const targetType = mapType(
        column.type,
        this.config.source.dialect,
        this.config.target.dialect
      )
      
      let colDef = `  "${column.name}" ${targetType}`
      
      if (column.primaryKey && targetDialect === 'postgresql') {
        colDef += ' PRIMARY KEY'
      } else if (column.primaryKey && targetDialect === 'sqlite') {
        colDef += ' PRIMARY KEY'
        if (column.autoIncrement) {
          colDef += ' AUTOINCREMENT'
        }
      }
      
      if (!column.nullable && !column.primaryKey) {
        colDef += ' NOT NULL'
      }
      
      if (column.unique && !column.primaryKey) {
        colDef += ' UNIQUE'
      }
      
      if (column.defaultValue !== null && column.defaultValue !== undefined) {
        colDef += ` DEFAULT ${column.defaultValue}`
      }
      
      columnDefs.push(colDef)
    }
    
    createSQL += columnDefs.join(',\n')
    
    // Add foreign keys
    for (const fk of sourceTable.foreignKeys) {
      const fkCols = fk.columns.map(c => `"${c}"`).join(', ')
      const refCols = fk.referencedColumns.map(c => `"${c}"`).join(', ')
      createSQL += `,\n  FOREIGN KEY (${fkCols}) REFERENCES "${fk.referencedTable}" (${refCols})`
      
      if (fk.onDelete) {
        createSQL += ` ON DELETE ${fk.onDelete}`
      }
      if (fk.onUpdate) {
        createSQL += ` ON UPDATE ${fk.onUpdate}`
      }
    }
    
    createSQL += '\n);'
    
    await sql.raw(createSQL).execute(this.targetDb)
  }
  
  /**
   * Create index in target database
   */
  private async createIndex(index: any): Promise<void> {
    const unique = index.unique ? 'UNIQUE ' : ''
    const columns = index.columns.map((c: string) => `"${c}"`).join(', ')
    
    const createSQL = `CREATE ${unique}INDEX "${index.name}" ON "${index.tableName}" (${columns});`
    
    await sql.raw(createSQL).execute(this.targetDb)
  }
  
  /**
   * Migrate data
   */
  private async migrateData(
    sourceSchema: TableSchema[],
    targetSchema: TableSchema[]
  ): Promise<{
    tablesProcessed: number
    rowsMigrated: number
    errors: any[]
    warnings: string[]
  }> {
    const options: DataMigrationOptions = {
      batchSize: this.config.options?.batchSize || 1000,
      parallel: this.config.options?.parallel || false,
      parallelWorkers: this.config.options?.parallelWorkers || 1,
      continueOnError: this.config.options?.continueOnError || false,
      verbose: this.config.options?.verbose || false,
      onProgress: (progress) => {
        this.logger.info(
          `     ${progress.table}: ${progress.current}/${progress.total} ` +
          `(${progress.percentage.toFixed(1)}%)`
        )
      },
    }
    
    const results = await migrateAllTablesData(
      this.sourceDb,
      this.targetDb,
      sourceSchema,
      targetSchema,
      this.config.source.dialect,
      this.config.target.dialect,
      options
    )
    
    const tablesProcessed = results.length
    const rowsMigrated = results.reduce((sum, r) => sum + r.rowsMigrated, 0)
    const errors = results.flatMap(r => r.errors)
    const warnings: string[] = []
    
    for (const result of results) {
      if (result.errors.length > 0) {
        warnings.push(`Table ${result.tableName} had ${result.errors.length} error(s)`)
      }
      
      this.logger.info(
        `     ${result.tableName}: ${result.rowsMigrated} rows ` +
        `(${(result.duration / 1000).toFixed(2)}s)`
      )
    }
    
    return {
      tablesProcessed,
      rowsMigrated,
      errors,
      warnings,
    }
  }
  
  /**
   * Verify migration
   */
  private async verifyMigration(
    sourceSchema: TableSchema[]
  ): Promise<{
    success: boolean
    warnings: string[]
  }> {
    const warnings: string[] = []
    
    for (const table of sourceSchema) {
      try {
        const verification = await verifyDataMigration(
          this.sourceDb,
          this.targetDb,
          table.name
        )
        
        if (!verification.match) {
          warnings.push(
            `Table ${table.name}: row count mismatch ` +
            `(source: ${verification.sourceCount}, target: ${verification.targetCount})`
          )
        } else {
          this.logger.info(`     ✓ ${table.name}: ${verification.sourceCount} rows`)
        }
      } catch (error) {
        warnings.push(`Failed to verify table ${table.name}: ${(error as Error).message}`)
      }
    }
    
    return {
      success: warnings.length === 0,
      warnings,
    }
  }
}

/**
 * Helper function to create a migration manager
 */
export function createMigrationManager(
  sourceDb: Kysely<any>,
  targetDb: Kysely<any>,
  config: MigrationConfig,
  logger?: Logger
): DatabaseMigrationManager {
  return new DatabaseMigrationManager(sourceDb, targetDb, config, logger)
}

