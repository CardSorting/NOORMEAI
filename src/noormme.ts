import { Kysely } from './kysely.js'
import type { Dialect } from './dialect/dialect.js'
import { DatabaseIntrospector } from './dialect/database-introspector.js'
import { SchemaDiscovery } from './schema/schema-discovery.js'
import { TypeGenerator } from './types/type-generator.js'
import { RepositoryFactory } from './repository/repository-factory.js'
import { RelationshipEngine } from './relationships/relationship-engine.js'
import { CacheManager } from './cache/cache-manager.js'
import { Logger } from './logging/logger.js'
import {
  NOORMConfig,
  SchemaInfo,
  Repository,
  RelationshipInfo,
  SchemaChange,
} from './types/index.js'
import { NoormError, TableNotFoundError } from './errors/NoormError.js'
import { config as loadDotenv } from 'dotenv'
import { SchemaWatcher, WatchOptions } from './watch/schema-watcher.js'
import { MetricsCollector } from './performance/services/metrics-collector.js'
import { SQLiteAutoOptimizer } from './dialect/sqlite/sqlite-auto-optimizer.js'
import { SQLiteAutoIndexer } from './dialect/sqlite/sqlite-auto-indexer.js'
import { SqliteDialect } from './dialect/sqlite/sqlite-dialect.js'
import { PostgresDialect } from './dialect/postgresql/postgresql-dialect.js'
import { sql as rawSql } from './raw-builder/sql.js'
import Database from 'better-sqlite3'
import { Pool } from 'pg'
import { CompiledQuery } from './query-compiler/compiled-query.js'
import { SessionManager } from './agentic/SessionManager.js'
import { VectorIndexer } from './agentic/VectorIndexer.js'
import { AgentSchemaHelper } from './helpers/agent-schema.js'
import { Cortex } from './agentic/Cortex.js'
import { SchemaEvolutionHelper } from './helpers/schema-evolution.js'
import { SQLiteMigrationManager } from './sqlite-migration/sqlite-migration-manager.js'

// Global initialization lock to prevent concurrent initialization
const globalInitLock = new Map<string, Promise<void>>()

/**
 * NOORMME - No ORM, just magic!
 * Zero-configuration pseudo-ORM that works with any existing database
 */
export class NOORMME {
  private db: Kysely<any>
  private config: NOORMConfig
  private dialect: Dialect
  private schemaDiscovery: SchemaDiscovery
  private typeGenerator: TypeGenerator
  private repositoryFactory: RepositoryFactory
  private relationshipEngine: RelationshipEngine
  private cacheManager: CacheManager
  private logger: Logger
  private schemaWatcher: SchemaWatcher | null = null
  private metricsCollector: MetricsCollector | null = null
  private sqliteAutoOptimizer: SQLiteAutoOptimizer | null = null
  private sqliteAutoIndexer: SQLiteAutoIndexer | null = null
  private initialized = false
  private repositories = new Map<string, Repository<any>>()
  private instanceId: string
  private schemaChangeCallbacks: Array<(changes: SchemaChange[]) => void> = []

  /**
   * Agentic persistence module
   */
  public agent: {
    sessions: SessionManager
    vectors: VectorIndexer | null
    schema: AgentSchemaHelper
    cortex: Cortex
    evolution: SchemaEvolutionHelper
  }

  constructor(configOrConnectionString?: NOORMConfig | string) {
    // Load .env if it exists
    loadDotenv({ path: '.env' })

    // Handle different constructor signatures
    let config: NOORMConfig
    if (!configOrConnectionString) {
      // Try to read from environment
      const databaseUrl = process.env.DATABASE_URL
      if (!databaseUrl) {
        throw new NoormError('No database configuration provided', {
          operation: 'initialization',
          suggestion:
            'Either pass a connection string or set DATABASE_URL in .env',
        })
      }
      config = this.parseConnectionString(databaseUrl)
    } else if (typeof configOrConnectionString === 'string') {
      config = this.parseConnectionString(configOrConnectionString)
    } else {
      config = configOrConnectionString
    }

    this.config = this.mergeConfig(config)
    this.logger = new Logger(this.config.logging)
    this.cacheManager = new CacheManager(this.config.cache)

    // Generate unique instance ID for this NOORMME instance
    this.instanceId = `${this.config.dialect}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Initialize Kysely with the provided dialect
    this.dialect = this.createDialect()
    this.db = new Kysely({
      dialect: this.dialect,
      log: this.config.logging?.enabled
        ? this.logger.createKyselyLogger()
        : undefined,
    })

    // Initialize core components
    this.schemaDiscovery = new SchemaDiscovery(
      this.db,
      this.config.introspection,
      this.dialect,
    )
    this.typeGenerator = new TypeGenerator(this.config.introspection)

    // Initialize agentic module first so it can be passed to repository factory
    const agenticConfig = this.config.agentic || {}
    this.agent = {
      sessions: new SessionManager(this.db, agenticConfig),
      vectors: agenticConfig.vectorConfig
        ? new VectorIndexer(
            this.db,
            agenticConfig.vectorConfig,
            agenticConfig.memoriesTable,
          )
        : null,
      schema: new AgentSchemaHelper(this.db, agenticConfig),
      cortex: new Cortex(this.db, this.config as any),
      evolution: new SchemaEvolutionHelper(this.db),
    }

    this.repositoryFactory = new RepositoryFactory(
      this.db,
      this.config.performance,
      this.agent.cortex,
    )
    this.relationshipEngine = new RelationshipEngine(
      this.db,
      this.config.performance,
    )
  }

  /**
   * Initialize NOORMME - discovers schema and generates types
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('NOORMME already initialized')
      return
    }

    // Check if another instance is already initializing the same database
    const lockKey = `${this.config.dialect}-${this.config.connection.database || 'default'}`
    if (globalInitLock.has(lockKey)) {
      this.logger.info(
        `Waiting for another instance to finish initializing ${lockKey}...`,
      )
      await globalInitLock.get(lockKey)

      // Check again after waiting
      if (this.initialized) {
        this.logger.warn('NOORMME already initialized after waiting')
        return
      }
    }

    // Create initialization promise and store it
    const initPromise = this._doInitialize()
    globalInitLock.set(lockKey, initPromise)

    try {
      await initPromise
    } finally {
      // Clean up the lock
      globalInitLock.delete(lockKey)
    }
  }

  private async _doInitialize(): Promise<void> {
    try {
      this.logger.info('Initializing NOORMME...')

      // Test database connection using the dialect-specific introspector
      const introspector = this.dialect.createIntrospector(this.db)
      let tables: any[] = []

      try {
        tables = await introspector.getTables()
        this.logger.info('Database connection successful')
      } catch (error) {
        this.logger.warn(
          'Database connection test failed, but continuing with initialization:',
          error,
        )
        // Continue with empty schema if connection test fails
      }

      // Discover schema - handle empty databases gracefully
      this.logger.info('Discovering database schema...')
      let schemaInfo
      try {
        schemaInfo = await this.schemaDiscovery.discoverSchema()
        this.logger.info(`Discovered ${schemaInfo.tables.length} tables`)
      } catch (error) {
        // In test mode, throw the error instead of silently continuing
        if (process.env.NODE_ENV === 'test') {
          this.logger.error('Schema discovery failed in test mode:', error)
          throw new Error(
            `Schema discovery failed: ${error instanceof Error ? error.message : String(error)}`,
          )
        }

        this.logger.warn('Schema discovery failed, using empty schema:', error)
        // Create empty schema info if discovery fails
        schemaInfo = {
          tables: [],
          relationships: [],
          views: [],
        }
      }

      // Generate types - handle empty schema gracefully
      this.logger.info('Generating TypeScript types...')
      let generatedTypes
      try {
        generatedTypes = this.typeGenerator.generateTypes(schemaInfo)
        this.logger.info(
          `Generated types for ${generatedTypes.entities.length} entities`,
        )
      } catch (error) {
        this.logger.warn('Type generation failed, using empty types:', error)
        // Create empty type info if generation fails
        generatedTypes = {
          entities: [],
          relationships: [],
          types: {},
        }
      }

      // Cache schema and types - handle caching errors gracefully
      try {
        await this.cacheManager.set('schema', schemaInfo)
        await this.cacheManager.set('types', generatedTypes)
      } catch (error) {
        this.logger.warn(
          'Failed to cache schema/types, continuing without cache:',
          error,
        )
      }

      // Initialize relationship engine - handle empty relationships
      try {
        this.relationshipEngine.initialize(schemaInfo.relationships)
      } catch (error) {
        this.logger.warn('Failed to initialize relationship engine:', error)
      }

      // Initialize metrics collector for development mode
      this.metricsCollector = new MetricsCollector(
        {
          enabled: process.env.NODE_ENV === 'development',
          slowQueryThreshold: 1000,
          nPlusOneDetection: true,
          missingIndexDetection: true,
          persistPath:
            process.env.NOORMME_METRICS_PATH || '.noormme/metrics.json',
        } as any,
        this.logger,
      )

      // Initialize SQLite-specific auto-optimization features
      if (this.config.dialect === 'sqlite') {
        this.sqliteAutoOptimizer = SQLiteAutoOptimizer.getInstance(this.logger)
        this.sqliteAutoIndexer = SQLiteAutoIndexer.getInstance(this.logger)

        // Apply automatic optimizations if enabled (default: true)
        const enableAutoOptimization =
          this.config.automation?.enableAutoOptimization !== false
        if (enableAutoOptimization) {
          await this.applySQLiteAutoOptimizations()
        }
      }

      this.initialized = true
      this.logger.info('NOORMME initialized successfully!')
    } catch (error) {
      this.logger.error('Failed to initialize NOORMME:', error)
      throw error
    }
  }

  /**
   * Check if NOORMME is initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Apply SQLite auto-optimizations
   */
  private async applySQLiteAutoOptimizations(): Promise<void> {
    if (!this.sqliteAutoOptimizer) return

    try {
      this.logger.info('Applying SQLite auto-optimizations...')

      const config = this.sqliteAutoOptimizer.getDefaultConfig()
      const result = await this.sqliteAutoOptimizer.optimizeDatabase(
        this.db,
        config,
      )

      if (result.appliedOptimizations.length > 0) {
        this.logger.info(
          `Applied ${result.appliedOptimizations.length} SQLite optimizations`,
        )
        result.appliedOptimizations.forEach((opt) =>
          this.logger.debug(`  ✓ ${opt}`),
        )
      }

      if (result.recommendations.length > 0) {
        this.logger.info(
          `Generated ${result.recommendations.length} recommendations`,
        )
        result.recommendations.forEach((rec) =>
          this.logger.debug(`  💡 ${rec}`),
        )
      }

      if (result.warnings.length > 0) {
        this.logger.warn(`Found ${result.warnings.length} warnings`)
        result.warnings.forEach((warning) =>
          this.logger.warn(`  ⚠️ ${warning}`),
        )
      }
    } catch (error) {
      this.logger.warn('Failed to apply SQLite auto-optimizations:', error)
    }
  }

  /**
   * Get SQLite optimization recommendations
   */
  async getSQLiteOptimizations(): Promise<any> {
    if (this.config.dialect !== 'sqlite' || !this.sqliteAutoOptimizer) {
      throw new NoormError(
        'SQLite optimizations are only available for SQLite databases',
      )
    }

    const config = this.sqliteAutoOptimizer.getDefaultConfig()
    return await this.sqliteAutoOptimizer.optimizeDatabase(this.db, config)
  }

  /**
   * Get SQLite index recommendations
   */
  async getSQLiteIndexRecommendations(options?: {
    minFrequency?: number
    slowQueryThreshold?: number
    includePartialIndexes?: boolean
    maxRecommendations?: number
  }): Promise<any> {
    if (this.config.dialect !== 'sqlite' || !this.sqliteAutoIndexer) {
      throw new NoormError(
        'SQLite index recommendations are only available for SQLite databases',
      )
    }

    return await this.sqliteAutoIndexer.analyzeAndRecommend(this.db, options)
  }

  /**
   * Record query for SQLite auto-indexing analysis
   */
  recordQuery(query: string, executionTime: number, table?: string): void {
    if (this.config.dialect === 'sqlite' && this.sqliteAutoIndexer) {
      this.sqliteAutoIndexer.recordQuery(query, executionTime, table)
    }

    if (this.metricsCollector) {
      this.metricsCollector.recordQuery(query, executionTime, { table })
    }
  }

  /**
   * Get SQLite performance metrics
   */
  async getSQLitePerformanceMetrics(): Promise<any> {
    if (this.config.dialect !== 'sqlite' || !this.sqliteAutoOptimizer) {
      throw new NoormError(
        'SQLite performance metrics are only available for SQLite databases',
      )
    }

    return await this.sqliteAutoOptimizer.analyzeDatabase(this.db)
  }

  /**
   * Get SQLite backup recommendations
   */
  async getSQLiteBackupRecommendations(): Promise<string[]> {
    if (this.config.dialect !== 'sqlite' || !this.sqliteAutoOptimizer) {
      throw new NoormError(
        'SQLite backup recommendations are only available for SQLite databases',
      )
    }

    return await this.sqliteAutoOptimizer.getBackupRecommendations(this.db)
  }

  /**
   * Get cache statistics
   */
  getCacheStatistics() {
    return this.cacheManager.getStats()
  }

  /**
   * Get migration manager (SQLite only)
   */
  getMigrationManager(): SQLiteMigrationManager {
    if (this.config.dialect !== 'sqlite') {
      throw new NoormError(
        'Migration manager is currently only available for SQLite',
      )
    }
    // Note: User must call await manager.initialize() after getting it
    return SQLiteMigrationManager.getInstance(
      this.db,
      this.config.automation,
      this.logger,
    )
  }

  /**
   * Get a repository for the specified table
   */
  getRepository<T>(tableName: string): Repository<T> {
    if (!this.initialized) {
      throw new Error(
        'NOORMME must be initialized before getting repositories. Call await db.initialize() first.',
      )
    }

    if (this.repositories.has(tableName)) {
      return this.repositories.get(tableName)!
    }

    const schemaInfo = this.cacheManager.get<SchemaInfo>('schema')
    if (!schemaInfo) {
      throw new Error('Schema not found. Please reinitialize NOORMME.')
    }

    const table = schemaInfo.tables.find((t) => t.name === tableName)
    if (!table) {
      const availableTables = schemaInfo.tables.map((t) => t.name)
      throw new TableNotFoundError(tableName, availableTables)
    }

    const repository = this.repositoryFactory.createRepository<T>(
      table,
      schemaInfo.relationships,
    )
    this.repositories.set(tableName, repository)

    return repository
  }

  /**
   * Get schema information
   */
  async getSchemaInfo(): Promise<SchemaInfo> {
    if (!this.initialized) {
      throw new Error('NOORMME must be initialized first')
    }

    const cached = this.cacheManager.get<SchemaInfo>('schema')
    if (cached) {
      return cached
    }

    // Re-discover schema if not cached
    return await this.schemaDiscovery.discoverSchema()
  }

  /**
   * Refresh schema (useful when database structure changes)
   */
  async refreshSchema(): Promise<SchemaInfo> {
    this.logger.info('Refreshing schema...')

    const schemaInfo = await this.schemaDiscovery.discoverSchema()
    const generatedTypes = this.typeGenerator.generateTypes(schemaInfo)

    // Update cache
    await this.cacheManager.set('schema', schemaInfo)
    await this.cacheManager.set('types', generatedTypes)

    // Clear existing repositories
    this.repositories.clear()

    // Reinitialize relationship engine
    this.relationshipEngine.initialize(schemaInfo.relationships)

    this.logger.info('Schema refreshed successfully')
    return schemaInfo
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<NOORMConfig>): void {
    this.config = this.mergeConfig({ ...this.config, ...updates })

    // Update components with new config
    if (this.config.logging) {
      this.logger.updateConfig(this.config.logging)
    }
    if (this.config.cache) {
      this.cacheManager.updateConfig(this.config.cache)
    }

    this.logger.info('Configuration updated')
  }

  /**
   * Start monitoring schema changes in development mode
   */
  async startSchemaWatching(options?: WatchOptions): Promise<void> {
    if (!this.initialized) {
      throw new NoormError(
        'NOORMME must be initialized before starting schema watching',
      )
    }

    // If watcher already exists (e.g., from onSchemaChange), recreate it with new options
    if (this.schemaWatcher) {
      this.schemaWatcher.stopWatching()
    }

    this.schemaWatcher = new SchemaWatcher(
      this.db,
      this.schemaDiscovery,
      this.logger,
      options,
    )

    // Register all previously registered callbacks
    for (const callback of this.schemaChangeCallbacks) {
      this.schemaWatcher.onSchemaChange(callback)
    }

    // Auto-refresh schema when changes detected
    this.schemaWatcher.onSchemaChange(async (changes) => {
      this.logger.info(`Schema changes detected: ${changes.length} changes`)
      changes.forEach((change) => {
        this.logger.info(`  - ${change.type}: ${change.table}`)
      })

      try {
        await this.refreshSchema()
        this.logger.info('Schema refreshed successfully')
      } catch (error) {
        this.logger.error('Failed to refresh schema:', error)
      }
    })

    await this.schemaWatcher.startWatching()
  }

  /**
   * Stop monitoring schema changes
   */
  stopSchemaWatching(): void {
    if (this.schemaWatcher) {
      this.schemaWatcher.stopWatching()
      // Don't set to null - keep watcher instance for potential restart
    }
  }

  /**
   * Register callback for schema changes
   */
  onSchemaChange(callback: (changes: SchemaChange[]) => void): void {
    // Store callback so it can be re-registered if watcher is recreated
    this.schemaChangeCallbacks.push(callback)

    // If watcher already exists, register callback immediately
    if (this.schemaWatcher) {
      this.schemaWatcher.onSchemaChange(callback)
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    const baseMetrics = {
      queryCount: this.logger.getQueryCount(),
      averageQueryTime: this.logger.getAverageQueryTime(),
      cacheHitRate: this.cacheManager.getHitRate(),
      repositoryCount: this.repositories.size,
    }

    if (this.metricsCollector) {
      return {
        ...baseMetrics,
        ...this.metricsCollector.getPerformanceStats(),
      }
    }

    return baseMetrics
  }

  /**
   * Enable query performance monitoring
   */
  enablePerformanceMonitoring(options?: any): void {
    if (!this.initialized) {
      throw new NoormError(
        'NOORMME must be initialized before enabling performance monitoring',
      )
    }

    const schemaInfo = this.cacheManager.get<SchemaInfo>('schema')
    if (!schemaInfo) {
      throw new NoormError('Schema not found. Please reinitialize NOORMME.')
    }

    this.metricsCollector = new MetricsCollector(
      {
        enabled: true,
        slowQueryThreshold: options?.slowQueryThreshold || 1000,
        nPlusOneDetection: true,
        missingIndexDetection: true,
      },
      this.logger,
    )

    this.logger.info('Query performance monitoring enabled')
  }

  /**
   * Disable query performance monitoring
   */
  disablePerformanceMonitoring(): void {
    if (this.metricsCollector) {
      this.metricsCollector.clear()
      this.metricsCollector = null
      this.logger.info('Query performance monitoring disabled')
    }
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    this.logger.info('Closing NOORMME...')

    // Stop schema watching if running
    this.stopSchemaWatching()

    await this.db.destroy()
    await this.cacheManager.close()

    this.initialized = false
    this.repositories.clear()

    this.logger.info('NOORMME closed')
  }

  /**
   * Alias for close() - for backward compatibility
   */
  async destroy(): Promise<void> {
    return this.close()
  }

  /**
   * Get the underlying Kysely instance for custom queries
   */
  getKysely(): Kysely<any> {
    return this.db
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(callback: (trx: Kysely<any>) => Promise<T>): Promise<T> {
    return await this.db.transaction().execute(callback)
  }

  /**
   * Execute raw SQL
   */
  async execute(sqlString: string, parameters?: unknown[]): Promise<unknown> {
    const compiledQuery = CompiledQuery.raw(sqlString, parameters || [])
    return await this.db.executeQuery(compiledQuery)
  }

  private mergeConfig(config: NOORMConfig): NOORMConfig {
    return {
      dialect: config.dialect,
      connection: config.connection,
      introspection: {
        includeViews: false,
        excludeTables: [],
        customTypeMappings: {},
        ...config.introspection,
      },
      cache: {
        ttl: 300000, // 5 minutes
        maxSize: 1000,
        strategy: 'lru',
        ...config.cache,
      },
      logging: {
        level: 'info',
        enabled: true,
        ...config.logging,
      },
      performance: {
        enableQueryOptimization: true,
        enableBatchLoading: true,
        maxBatchSize: 100,
        ...config.performance,
      },
      agentic: config.agentic,
      automation: config.automation,
    }
  }

  /**
   * Parse connection string into NOORMConfig
   */
  private parseConnectionString(connectionString: string): NOORMConfig {
    try {
      const url = new URL(connectionString)

      let dialect: NOORMConfig['dialect']
      switch (url.protocol) {
        case 'sqlite:':
          dialect = 'sqlite'
          break
        case 'postgres:':
        case 'postgresql:':
          dialect = 'postgresql'
          break
        case 'mysql:':
          dialect = 'mysql'
          break
        default:
          throw new NoormError(
            `Unsupported database protocol: ${url.protocol}`,
            {
              operation: 'connection_string_parsing',
              suggestion:
                'Supported protocols: sqlite, postgresql, postgres, mysql',
            },
          )
      }

      if (dialect === 'sqlite') {
        return {
          dialect,
          connection: {
            database: url.pathname,
            host: '',
            port: 0,
            username: '',
            password: '',
          },
        }
      }

      if (dialect === 'postgresql' || dialect === 'mysql') {
        // Parse query parameters for SSL and pool configuration
        const searchParams = new URLSearchParams(url.search)
        const sslParam = searchParams.get('ssl') || searchParams.get('sslmode')

        let ssl: boolean | object = false
        if (sslParam) {
          if (sslParam === 'true' || sslParam === 'require') {
            ssl = true
          } else if (sslParam === 'false' || sslParam === 'disable') {
            ssl = false
          } else {
            // For other SSL modes, we'll need more configuration
            ssl = {
              rejectUnauthorized: sslParam !== 'allow' && sslParam !== 'prefer',
            }
          }
        }

        return {
          dialect,
          connection: {
            host: url.hostname || 'localhost',
            port: url.port
              ? parseInt(url.port, 10)
              : this.getDefaultPort(dialect),
            database: url.pathname.replace(/^\//, ''),
            username: url.username || undefined,
            password: url.password || undefined,
            ssl,
            pool: {
              max: searchParams.get('pool_max')
                ? parseInt(searchParams.get('pool_max')!, 10)
                : 10,
              min: searchParams.get('pool_min')
                ? parseInt(searchParams.get('pool_min')!, 10)
                : 0,
            },
          },
        }
      }

      return {
        dialect,
        connection: {
          host: url.hostname || 'localhost',
          port: url.port ? parseInt(url.port) : this.getDefaultPort(dialect),
          database: url.pathname.slice(1), // Remove leading slash
          username: url.username || '',
          password: url.password || '',
          ssl:
            url.searchParams.get('ssl') === 'true' ||
            url.searchParams.get('sslmode') === 'require',
        },
      }
    } catch (error) {
      throw new NoormError(
        `Failed to parse connection string: ${error instanceof Error ? error.message : String(error)}`,
        {
          operation: 'connection_string_parsing',
          suggestion:
            'Ensure connection string format is: protocol://username:password@host:port/database',
        },
      )
    }
  }

  /**
   * Get default port for database dialect
   */
  private getDefaultPort(dialect: NOORMConfig['dialect']): number {
    switch (dialect) {
      case 'sqlite':
        return 0
      case 'postgresql':
        return 5432
      case 'mysql':
        return 3306
      default:
        return 0
    }
  }

  private createDialect(): Dialect {
    const { dialect, connection } = this.config

    switch (dialect) {
      case 'sqlite':
        return new SqliteDialect({
          database: new Database(connection.database, { timeout: 5000 }),
        })

      case 'postgresql':
        return new PostgresDialect({
          poolConfig: {
            host: connection.host,
            port: connection.port,
            database: connection.database,
            user: connection.username,
            password: connection.password,
            ssl: connection.ssl,
            max: connection.pool?.max ?? 10,
            min: connection.pool?.min ?? 0,
            idleTimeoutMillis: connection.pool?.idleTimeoutMillis ?? 10000,
          },
        })

      default:
        throw new Error(`Unsupported dialect: ${dialect}`)
    }
  }
}

// Export the main class as default
export default NOORMME
