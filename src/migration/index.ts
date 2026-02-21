/**
 * Database Migration Tools
 * 
 * Comprehensive migration tools for NOORMME:
 * - Automated SQLite to PostgreSQL migration
 * - Schema diff and sync tools
 * - Data migration utilities
 */

export * from './migration-types.js'
export * from './type_mapper.js'
export * from './schema_introspector.js'
export * from './schema_differ.js'
export * from './data_migrator.js'
export * from './database_migration_manager.js'

// Re-export main classes and functions for convenience
export {
  DatabaseMigrationManager,
  createMigrationManager,
} from './database_migration_manager.js'

export {
  introspectSQLiteSchema,
  introspectPostgreSQLSchema,
} from './schema_introspector.js'

export {
  compareSchemas,
  generateSyncSQL,
  applySchemaSyncronization,
} from './schema_differ.js'

export {
  migrateTableData,
  migrateAllTablesData,
  verifyDataMigration,
  truncateTable,
} from './data_migrator.js'

export {
  mapType,
  getValueTransformation,
  areTypesCompatible,
  SQLITE_TO_POSTGRES_TYPES,
  POSTGRES_TO_SQLITE_TYPES,
} from './type_mapper.js'

