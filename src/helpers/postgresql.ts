/**
 * PostgreSQL helper utilities for NOORMME
 * 
 * This module provides helper functions and utilities specific to PostgreSQL.
 */

import { Pool, PoolConfig } from 'pg'
import { PostgresDialect } from '../dialect/postgresql/postgresql-dialect.js'
import { NOORMME } from '../noormme.js'
import { NOORMConfig } from '../types/index.js'

/**
 * Create a PostgreSQL connection pool
 * 
 * @example
 * ```typescript
 * import { createPostgresPool } from 'noormme/helpers/postgresql'
 * 
 * const pool = createPostgresPool({
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'myapp',
 *   user: 'postgres',
 *   password: 'secret',
 *   max: 20
 * })
 * ```
 */
export function createPostgresPool(config: PoolConfig): Pool {
  return new Pool(config)
}

/**
 * Create a NOORMME instance with PostgreSQL
 * 
 * @example
 * ```typescript
 * import { createPostgresNoormme } from 'noormme/helpers/postgresql'
 * 
 * const db = createPostgresNoormme({
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'myapp',
 *   user: 'postgres',
 *   password: 'secret'
 * })
 * 
 * await db.initialize()
 * ```
 */
export function createPostgresNoormme(poolConfig: PoolConfig): NOORMME {
  const host = typeof poolConfig.host === 'string' ? poolConfig.host : 'localhost'
  const port = typeof poolConfig.port === 'number' ? poolConfig.port : 5432
  const database = typeof poolConfig.database === 'string' ? poolConfig.database : ''
  const user = typeof poolConfig.user === 'string' ? poolConfig.user : undefined
  const password = typeof poolConfig.password === 'string' ? poolConfig.password : undefined
  const ssl = typeof poolConfig.ssl === 'boolean' || (poolConfig.ssl && typeof poolConfig.ssl === 'object')
    ? poolConfig.ssl
    : undefined
  
  const config: NOORMConfig = {
    dialect: 'postgresql',
    connection: {
      host,
      port,
      database,
      username: user,
      password: password,
      ssl,
      pool: {
        max: typeof poolConfig.max === 'number' ? poolConfig.max : undefined,
        min: typeof poolConfig.min === 'number' ? poolConfig.min : undefined,
        idleTimeoutMillis: typeof poolConfig.idleTimeoutMillis === 'number' ? poolConfig.idleTimeoutMillis : undefined,
      }
    }
  }
  
  return new NOORMME(config)
}

/**
 * Parse a PostgreSQL connection string
 * 
 * @example
 * ```typescript
 * import { parsePostgresUrl } from 'noormme/helpers/postgresql'
 * 
 * const config = parsePostgresUrl('postgresql://user:pass@localhost:5432/mydb')
 * const db = new NOORMME(config)
 * ```
 */
export function parsePostgresUrl(connectionString: string): NOORMConfig {
  const db = new NOORMME(connectionString)
  return db['config'] // Access private config for parsing
}

/**
 * Common PostgreSQL configuration presets
 */
export const PostgresPresets = {
  /**
   * Development preset - minimal connections, relaxed timeouts
   */
  development: {
    max: 5,
    min: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },
  
  /**
   * Production preset - balanced connections and timeouts
   */
  production: {
    max: 20,
    min: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 2000,
  },
  
  /**
   * High-traffic preset - many connections, fast timeouts
   */
  highTraffic: {
    max: 50,
    min: 10,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 1000,
  },
} as const

export { PostgresDialect }
export type { Pool, PoolConfig }

// Export PostgreSQL-specific features
export {
  PostgresArrayHelpers,
  PostgresJSONHelpers,
  PostgresFullTextHelpers,
  PostgresMaterializedViewHelpers,
} from '../dialect/postgresql/postgresql-features.js'

export type {
  PostgresArrayType,
  PostgresFullTextType,
  PostgresColumnType,
} from '../dialect/postgresql/postgresql-features.js'

// Export migration tools
export {
  createMigrationManager,
  DatabaseMigrationManager,
  introspectPostgreSQLSchema,
  introspectSQLiteSchema,
  compareSchemas,
  generateSyncSQL,
  migrateTableData,
  migrateAllTablesData,
  verifyDataMigration,
  mapType,
  SQLITE_TO_POSTGRES_TYPES,
  POSTGRES_TO_SQLITE_TYPES,
} from '../migration/index.js'

export type {
  MigrationConfig,
  MigrationResult,
  TableSchema,
  ColumnSchema,
  IndexSchema,
  ForeignKeySchema,
  SchemaComparisonResult,
  SchemaDifference,
  SyncOptions,
  DataMigrationProgress,
  MigrationProgressCallback,
} from '../migration/index.js'

