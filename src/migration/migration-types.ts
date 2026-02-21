/**
 * Types and interfaces for database migration tools
 */

export interface MigrationConfig {
  /** Source database configuration */
  source: {
    dialect: 'sqlite' | 'postgresql'
    database: string
    host?: string
    port?: number
    username?: string
    password?: string
    ssl?: boolean | object
  }
  /** Target database configuration */
  target: {
    dialect: 'sqlite' | 'postgresql'
    database: string
    host?: string
    port?: number
    username?: string
    password?: string
    ssl?: boolean | object
  }
  /** Migration options */
  options?: {
    /** Skip data migration, only migrate schema */
    schemaOnly?: boolean
    /** Skip schema migration, only migrate data */
    dataOnly?: boolean
    /** Batch size for data migration */
    batchSize?: number
    /** Enable parallel data migration */
    parallel?: boolean
    /** Number of parallel workers */
    parallelWorkers?: number
    /** Drop target tables before migration */
    dropTables?: boolean
    /** Continue on error */
    continueOnError?: boolean
    /** Dry run mode - don't actually execute */
    dryRun?: boolean
    /** Custom type mappings */
    typeMappings?: Record<string, string>
    /** Tables to exclude from migration */
    excludeTables?: string[]
    /** Only migrate these tables */
    includeTables?: string[]
    /** Enable verbose logging */
    verbose?: boolean
  }
}

export interface TableSchema {
  name: string
  columns: ColumnSchema[]
  primaryKey?: string[]
  indexes: IndexSchema[]
  foreignKeys: ForeignKeySchema[]
  constraints: ConstraintSchema[]
  rowCount?: number
}

export interface ColumnSchema {
  name: string
  type: string
  nullable: boolean
  defaultValue?: string | null
  autoIncrement?: boolean
  primaryKey?: boolean
  unique?: boolean
}

export interface IndexSchema {
  name: string
  tableName: string
  columns: string[]
  unique: boolean
  partial?: string
}

export interface ForeignKeySchema {
  name?: string
  columns: string[]
  referencedTable: string
  referencedColumns: string[]
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'
}

export interface ConstraintSchema {
  name?: string
  type: 'CHECK' | 'UNIQUE' | 'PRIMARY_KEY' | 'FOREIGN_KEY'
  expression?: string
  columns?: string[]
}

export interface SchemaDifference {
  type: 'table_added' | 'table_removed' | 'table_modified' | 
        'column_added' | 'column_removed' | 'column_modified' |
        'index_added' | 'index_removed' | 'constraint_added' | 'constraint_removed'
  table: string
  column?: string
  details: {
    source?: any
    target?: any
    message?: string
  }
}

export interface MigrationResult {
  success: boolean
  duration: number
  tablesProcessed: number
  rowsMigrated: number
  errors: MigrationError[]
  warnings: string[]
  summary: {
    schemaChanges: number
    dataChanges: number
    indexesCreated: number
    constraintsApplied: number
  }
}

export interface MigrationError {
  table?: string
  column?: string
  message: string
  error: Error
  fatal: boolean
}

export interface DataMigrationProgress {
  table: string
  current: number
  total: number
  percentage: number
  estimatedTimeRemaining?: number
}

export type MigrationProgressCallback = (progress: DataMigrationProgress) => void

export interface SchemaComparisonResult {
  differences: SchemaDifference[]
  sourceSchema: TableSchema[]
  targetSchema: TableSchema[]
  compatible: boolean
  summary: {
    tablesAdded: number
    tablesRemoved: number
    tablesModified: number
    totalDifferences: number
  }
}

export interface SyncOptions {
  /** Apply changes to target database */
  apply?: boolean
  /** Generate SQL for manual execution */
  generateSQL?: boolean
  /** Backup target before sync */
  backup?: boolean
  /** Force sync even if incompatible */
  force?: boolean
}

export interface TypeMapping {
  sourceType: string
  targetType: string
  transformation?: (value: any) => any
}

