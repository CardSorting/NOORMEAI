"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOORMME = void 0;
const kysely_js_1 = require("./kysely.js");
const schema_discovery_js_1 = require("./schema/schema-discovery.js");
const type_generator_js_1 = require("./types/type-generator.js");
const repository_factory_js_1 = require("./repository/repository-factory.js");
const relationship_engine_js_1 = require("./relationships/relationship-engine.js");
const cache_manager_js_1 = require("./cache/cache-manager.js");
const logger_js_1 = require("./logging/logger.js");
const NoormError_js_1 = require("./errors/NoormError.js");
const dotenv_1 = require("dotenv");
const schema_watcher_js_1 = require("./watch/schema-watcher.js");
const metrics_collector_js_1 = require("./performance/services/metrics-collector.js");
const sqlite_auto_optimizer_js_1 = require("./dialect/sqlite/sqlite-auto-optimizer.js");
const sqlite_auto_indexer_js_1 = require("./dialect/sqlite/sqlite-auto-indexer.js");
const sqlite_dialect_js_1 = require("./dialect/sqlite/sqlite-dialect.js");
const postgresql_dialect_js_1 = require("./dialect/postgresql/postgresql-dialect.js");
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const compiled_query_js_1 = require("./query-compiler/compiled-query.js");
const SessionManager_js_1 = require("./agentic/SessionManager.js");
const VectorIndexer_js_1 = require("./agentic/VectorIndexer.js");
const agent_schema_js_1 = require("./helpers/agent-schema.js");
const Cortex_js_1 = require("./agentic/Cortex.js");
const schema_evolution_js_1 = require("./helpers/schema-evolution.js");
const sqlite_migration_manager_js_1 = require("./sqlite-migration/sqlite-migration-manager.js");
// Global initialization lock to prevent concurrent initialization
const globalInitLock = new Map();
/**
 * NOORMME - No ORM, just magic!
 * Zero-configuration pseudo-ORM that works with any existing database
 */
class NOORMME {
    db;
    config;
    dialect;
    schemaDiscovery;
    typeGenerator;
    repositoryFactory;
    relationshipEngine;
    cacheManager;
    logger;
    schemaWatcher = null;
    metricsCollector = null;
    sqliteAutoOptimizer = null;
    sqliteAutoIndexer = null;
    initialized = false;
    repositories = new Map();
    instanceId;
    schemaChangeCallbacks = [];
    /**
     * Agentic persistence module
     */
    agent;
    constructor(configOrConnectionString) {
        // Load .env if it exists
        (0, dotenv_1.config)({ path: '.env' });
        // Handle different constructor signatures
        let config;
        if (!configOrConnectionString) {
            // Try to read from environment
            const databaseUrl = process.env.DATABASE_URL;
            if (!databaseUrl) {
                throw new NoormError_js_1.NoormError('No database configuration provided', {
                    operation: 'initialization',
                    suggestion: 'Either pass a connection string or set DATABASE_URL in .env',
                });
            }
            config = this.parseConnectionString(databaseUrl);
        }
        else if (typeof configOrConnectionString === 'string') {
            config = this.parseConnectionString(configOrConnectionString);
        }
        else {
            config = configOrConnectionString;
        }
        this.config = this.mergeConfig(config);
        this.logger = new logger_js_1.Logger(this.config.logging);
        this.cacheManager = new cache_manager_js_1.CacheManager(this.config.cache);
        // Generate unique instance ID for this NOORMME instance
        this.instanceId = `${this.config.dialect}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        // Initialize Kysely with the provided dialect
        this.dialect = this.createDialect();
        this.db = new kysely_js_1.Kysely({
            dialect: this.dialect,
            log: this.config.logging?.enabled ? this.logger.createKyselyLogger() : undefined
        });
        // Initialize core components
        this.schemaDiscovery = new schema_discovery_js_1.SchemaDiscovery(this.db, this.config.introspection, this.dialect);
        this.typeGenerator = new type_generator_js_1.TypeGenerator(this.config.introspection);
        // Initialize agentic module first so it can be passed to repository factory
        const agenticConfig = this.config.agentic || {};
        this.agent = {
            sessions: new SessionManager_js_1.SessionManager(this.db, agenticConfig),
            vectors: agenticConfig.vectorConfig
                ? new VectorIndexer_js_1.VectorIndexer(this.db, agenticConfig.vectorConfig, agenticConfig.memoriesTable)
                : null,
            schema: new agent_schema_js_1.AgentSchemaHelper(this.db, agenticConfig),
            cortex: new Cortex_js_1.Cortex(this.db, this.config),
            evolution: new schema_evolution_js_1.SchemaEvolutionHelper(this.db)
        };
        this.repositoryFactory = new repository_factory_js_1.RepositoryFactory(this.db, this.config.performance, this.agent.cortex);
        this.relationshipEngine = new relationship_engine_js_1.RelationshipEngine(this.db, this.config.performance);
    }
    /**
     * Initialize NOORMME - discovers schema and generates types
     */
    async initialize() {
        if (this.initialized) {
            this.logger.warn('NOORMME already initialized');
            return;
        }
        // Check if another instance is already initializing the same database
        const lockKey = `${this.config.dialect}-${this.config.connection.database || 'default'}`;
        if (globalInitLock.has(lockKey)) {
            this.logger.info(`Waiting for another instance to finish initializing ${lockKey}...`);
            await globalInitLock.get(lockKey);
            // Check again after waiting
            if (this.initialized) {
                this.logger.warn('NOORMME already initialized after waiting');
                return;
            }
        }
        // Create initialization promise and store it
        const initPromise = this._doInitialize();
        globalInitLock.set(lockKey, initPromise);
        try {
            await initPromise;
        }
        finally {
            // Clean up the lock
            globalInitLock.delete(lockKey);
        }
    }
    async _doInitialize() {
        try {
            this.logger.info('Initializing NOORMME...');
            // Test database connection using the dialect-specific introspector
            const introspector = this.dialect.createIntrospector(this.db);
            let tables = [];
            try {
                tables = await introspector.getTables();
                this.logger.info('Database connection successful');
            }
            catch (error) {
                this.logger.warn('Database connection test failed, but continuing with initialization:', error);
                // Continue with empty schema if connection test fails
            }
            // Discover schema - handle empty databases gracefully
            this.logger.info('Discovering database schema...');
            let schemaInfo;
            try {
                schemaInfo = await this.schemaDiscovery.discoverSchema();
                this.logger.info(`Discovered ${schemaInfo.tables.length} tables`);
            }
            catch (error) {
                // In test mode, throw the error instead of silently continuing
                if (process.env.NODE_ENV === 'test') {
                    this.logger.error('Schema discovery failed in test mode:', error);
                    throw new Error(`Schema discovery failed: ${error instanceof Error ? error.message : String(error)}`);
                }
                this.logger.warn('Schema discovery failed, using empty schema:', error);
                // Create empty schema info if discovery fails
                schemaInfo = {
                    tables: [],
                    relationships: [],
                    views: []
                };
            }
            // Generate types - handle empty schema gracefully
            this.logger.info('Generating TypeScript types...');
            let generatedTypes;
            try {
                generatedTypes = this.typeGenerator.generateTypes(schemaInfo);
                this.logger.info(`Generated types for ${generatedTypes.entities.length} entities`);
            }
            catch (error) {
                this.logger.warn('Type generation failed, using empty types:', error);
                // Create empty type info if generation fails
                generatedTypes = {
                    entities: [],
                    relationships: [],
                    types: {}
                };
            }
            // Cache schema and types - handle caching errors gracefully
            try {
                await this.cacheManager.set('schema', schemaInfo);
                await this.cacheManager.set('types', generatedTypes);
            }
            catch (error) {
                this.logger.warn('Failed to cache schema/types, continuing without cache:', error);
            }
            // Initialize relationship engine - handle empty relationships
            try {
                this.relationshipEngine.initialize(schemaInfo.relationships);
            }
            catch (error) {
                this.logger.warn('Failed to initialize relationship engine:', error);
            }
            // Initialize metrics collector for development mode
            this.metricsCollector = new metrics_collector_js_1.MetricsCollector({
                enabled: process.env.NODE_ENV === 'development',
                slowQueryThreshold: 1000,
                nPlusOneDetection: true,
                missingIndexDetection: true,
                persistPath: process.env.NOORMME_METRICS_PATH || '.noormme/metrics.json'
            }, this.logger);
            // Initialize SQLite-specific auto-optimization features
            if (this.config.dialect === 'sqlite') {
                this.sqliteAutoOptimizer = sqlite_auto_optimizer_js_1.SQLiteAutoOptimizer.getInstance(this.logger);
                this.sqliteAutoIndexer = sqlite_auto_indexer_js_1.SQLiteAutoIndexer.getInstance(this.logger);
                // Apply automatic optimizations if enabled (default: true)
                const enableAutoOptimization = this.config.automation?.enableAutoOptimization !== false;
                if (enableAutoOptimization) {
                    await this.applySQLiteAutoOptimizations();
                }
            }
            this.initialized = true;
            this.logger.info('NOORMME initialized successfully!');
        }
        catch (error) {
            this.logger.error('Failed to initialize NOORMME:', error);
            throw error;
        }
    }
    /**
     * Check if NOORMME is initialized
     */
    isInitialized() {
        return this.initialized;
    }
    /**
     * Apply SQLite auto-optimizations
     */
    async applySQLiteAutoOptimizations() {
        if (!this.sqliteAutoOptimizer)
            return;
        try {
            this.logger.info('Applying SQLite auto-optimizations...');
            const config = this.sqliteAutoOptimizer.getDefaultConfig();
            const result = await this.sqliteAutoOptimizer.optimizeDatabase(this.db, config);
            if (result.appliedOptimizations.length > 0) {
                this.logger.info(`Applied ${result.appliedOptimizations.length} SQLite optimizations`);
                result.appliedOptimizations.forEach(opt => this.logger.debug(`  ✓ ${opt}`));
            }
            if (result.recommendations.length > 0) {
                this.logger.info(`Generated ${result.recommendations.length} recommendations`);
                result.recommendations.forEach(rec => this.logger.debug(`  💡 ${rec}`));
            }
            if (result.warnings.length > 0) {
                this.logger.warn(`Found ${result.warnings.length} warnings`);
                result.warnings.forEach(warning => this.logger.warn(`  ⚠️ ${warning}`));
            }
        }
        catch (error) {
            this.logger.warn('Failed to apply SQLite auto-optimizations:', error);
        }
    }
    /**
     * Get SQLite optimization recommendations
     */
    async getSQLiteOptimizations() {
        if (this.config.dialect !== 'sqlite' || !this.sqliteAutoOptimizer) {
            throw new NoormError_js_1.NoormError('SQLite optimizations are only available for SQLite databases');
        }
        const config = this.sqliteAutoOptimizer.getDefaultConfig();
        return await this.sqliteAutoOptimizer.optimizeDatabase(this.db, config);
    }
    /**
     * Get SQLite index recommendations
     */
    async getSQLiteIndexRecommendations(options) {
        if (this.config.dialect !== 'sqlite' || !this.sqliteAutoIndexer) {
            throw new NoormError_js_1.NoormError('SQLite index recommendations are only available for SQLite databases');
        }
        return await this.sqliteAutoIndexer.analyzeAndRecommend(this.db, options);
    }
    /**
     * Record query for SQLite auto-indexing analysis
     */
    recordQuery(query, executionTime, table) {
        if (this.config.dialect === 'sqlite' && this.sqliteAutoIndexer) {
            this.sqliteAutoIndexer.recordQuery(query, executionTime, table);
        }
        if (this.metricsCollector) {
            this.metricsCollector.recordQuery(query, executionTime, { table });
        }
    }
    /**
     * Get SQLite performance metrics
     */
    async getSQLitePerformanceMetrics() {
        if (this.config.dialect !== 'sqlite' || !this.sqliteAutoOptimizer) {
            throw new NoormError_js_1.NoormError('SQLite performance metrics are only available for SQLite databases');
        }
        return await this.sqliteAutoOptimizer.analyzeDatabase(this.db);
    }
    /**
     * Get SQLite backup recommendations
     */
    async getSQLiteBackupRecommendations() {
        if (this.config.dialect !== 'sqlite' || !this.sqliteAutoOptimizer) {
            throw new NoormError_js_1.NoormError('SQLite backup recommendations are only available for SQLite databases');
        }
        return await this.sqliteAutoOptimizer.getBackupRecommendations(this.db);
    }
    /**
     * Get cache statistics
     */
    getCacheStatistics() {
        return this.cacheManager.getStats();
    }
    /**
     * Get migration manager (SQLite only)
     */
    getMigrationManager() {
        if (this.config.dialect !== 'sqlite') {
            throw new NoormError_js_1.NoormError('Migration manager is currently only available for SQLite');
        }
        // Note: User must call await manager.initialize() after getting it
        return sqlite_migration_manager_js_1.SQLiteMigrationManager.getInstance(this.db, this.config.automation, this.logger);
    }
    /**
     * Get a repository for the specified table
     */
    getRepository(tableName) {
        if (!this.initialized) {
            throw new Error('NOORMME must be initialized before getting repositories. Call await db.initialize() first.');
        }
        if (this.repositories.has(tableName)) {
            return this.repositories.get(tableName);
        }
        const schemaInfo = this.cacheManager.get('schema');
        if (!schemaInfo) {
            throw new Error('Schema not found. Please reinitialize NOORMME.');
        }
        const table = schemaInfo.tables.find(t => t.name === tableName);
        if (!table) {
            const availableTables = schemaInfo.tables.map(t => t.name);
            throw new NoormError_js_1.TableNotFoundError(tableName, availableTables);
        }
        const repository = this.repositoryFactory.createRepository(table, schemaInfo.relationships);
        this.repositories.set(tableName, repository);
        return repository;
    }
    /**
     * Get schema information
     */
    async getSchemaInfo() {
        if (!this.initialized) {
            throw new Error('NOORMME must be initialized first');
        }
        const cached = this.cacheManager.get('schema');
        if (cached) {
            return cached;
        }
        // Re-discover schema if not cached
        return await this.schemaDiscovery.discoverSchema();
    }
    /**
     * Refresh schema (useful when database structure changes)
     */
    async refreshSchema() {
        this.logger.info('Refreshing schema...');
        const schemaInfo = await this.schemaDiscovery.discoverSchema();
        const generatedTypes = this.typeGenerator.generateTypes(schemaInfo);
        // Update cache
        await this.cacheManager.set('schema', schemaInfo);
        await this.cacheManager.set('types', generatedTypes);
        // Clear existing repositories
        this.repositories.clear();
        // Reinitialize relationship engine
        this.relationshipEngine.initialize(schemaInfo.relationships);
        this.logger.info('Schema refreshed successfully');
        return schemaInfo;
    }
    /**
     * Update configuration
     */
    updateConfig(updates) {
        this.config = this.mergeConfig({ ...this.config, ...updates });
        // Update components with new config
        if (this.config.logging) {
            this.logger.updateConfig(this.config.logging);
        }
        if (this.config.cache) {
            this.cacheManager.updateConfig(this.config.cache);
        }
        this.logger.info('Configuration updated');
    }
    /**
     * Start monitoring schema changes in development mode
     */
    async startSchemaWatching(options) {
        if (!this.initialized) {
            throw new NoormError_js_1.NoormError('NOORMME must be initialized before starting schema watching');
        }
        // If watcher already exists (e.g., from onSchemaChange), recreate it with new options
        if (this.schemaWatcher) {
            this.schemaWatcher.stopWatching();
        }
        this.schemaWatcher = new schema_watcher_js_1.SchemaWatcher(this.db, this.schemaDiscovery, this.logger, options);
        // Register all previously registered callbacks
        for (const callback of this.schemaChangeCallbacks) {
            this.schemaWatcher.onSchemaChange(callback);
        }
        // Auto-refresh schema when changes detected
        this.schemaWatcher.onSchemaChange(async (changes) => {
            this.logger.info(`Schema changes detected: ${changes.length} changes`);
            changes.forEach(change => {
                this.logger.info(`  - ${change.type}: ${change.table}`);
            });
            try {
                await this.refreshSchema();
                this.logger.info('Schema refreshed successfully');
            }
            catch (error) {
                this.logger.error('Failed to refresh schema:', error);
            }
        });
        await this.schemaWatcher.startWatching();
    }
    /**
     * Stop monitoring schema changes
     */
    stopSchemaWatching() {
        if (this.schemaWatcher) {
            this.schemaWatcher.stopWatching();
            // Don't set to null - keep watcher instance for potential restart
        }
    }
    /**
     * Register callback for schema changes
     */
    onSchemaChange(callback) {
        // Store callback so it can be re-registered if watcher is recreated
        this.schemaChangeCallbacks.push(callback);
        // If watcher already exists, register callback immediately
        if (this.schemaWatcher) {
            this.schemaWatcher.onSchemaChange(callback);
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
            repositoryCount: this.repositories.size
        };
        if (this.metricsCollector) {
            return {
                ...baseMetrics,
                ...this.metricsCollector.getPerformanceStats()
            };
        }
        return baseMetrics;
    }
    /**
     * Enable query performance monitoring
     */
    enablePerformanceMonitoring(options) {
        if (!this.initialized) {
            throw new NoormError_js_1.NoormError('NOORMME must be initialized before enabling performance monitoring');
        }
        const schemaInfo = this.cacheManager.get('schema');
        if (!schemaInfo) {
            throw new NoormError_js_1.NoormError('Schema not found. Please reinitialize NOORMME.');
        }
        this.metricsCollector = new metrics_collector_js_1.MetricsCollector({
            enabled: true,
            slowQueryThreshold: options?.slowQueryThreshold || 1000,
            nPlusOneDetection: true,
            missingIndexDetection: true
        }, this.logger);
        this.logger.info('Query performance monitoring enabled');
    }
    /**
     * Disable query performance monitoring
     */
    disablePerformanceMonitoring() {
        if (this.metricsCollector) {
            this.metricsCollector.clear();
            this.metricsCollector = null;
            this.logger.info('Query performance monitoring disabled');
        }
    }
    /**
     * Close database connections
     */
    async close() {
        this.logger.info('Closing NOORMME...');
        // Stop schema watching if running
        this.stopSchemaWatching();
        await this.db.destroy();
        await this.cacheManager.close();
        this.initialized = false;
        this.repositories.clear();
        this.logger.info('NOORMME closed');
    }
    /**
     * Alias for close() - for backward compatibility
     */
    async destroy() {
        return this.close();
    }
    /**
     * Get the underlying Kysely instance for custom queries
     */
    getKysely() {
        return this.db;
    }
    /**
     * Execute a transaction
     */
    async transaction(callback) {
        return await this.db.transaction().execute(callback);
    }
    /**
     * Execute raw SQL
     */
    async execute(sqlString, parameters) {
        const compiledQuery = compiled_query_js_1.CompiledQuery.raw(sqlString, parameters || []);
        return await this.db.executeQuery(compiledQuery);
    }
    mergeConfig(config) {
        return {
            dialect: config.dialect,
            connection: config.connection,
            introspection: {
                includeViews: false,
                excludeTables: [],
                customTypeMappings: {},
                ...config.introspection
            },
            cache: {
                ttl: 300000, // 5 minutes
                maxSize: 1000,
                strategy: 'lru',
                ...config.cache
            },
            logging: {
                level: 'info',
                enabled: true,
                ...config.logging
            },
            performance: {
                enableQueryOptimization: true,
                enableBatchLoading: true,
                maxBatchSize: 100,
                ...config.performance
            }
        };
    }
    /**
     * Parse connection string into NOORMConfig
     */
    parseConnectionString(connectionString) {
        try {
            const url = new URL(connectionString);
            let dialect;
            switch (url.protocol) {
                case 'sqlite:':
                    dialect = 'sqlite';
                    break;
                case 'postgres:':
                case 'postgresql:':
                    dialect = 'postgresql';
                    break;
                case 'mysql:':
                    dialect = 'mysql';
                    break;
                default:
                    throw new NoormError_js_1.NoormError(`Unsupported database protocol: ${url.protocol}`, {
                        operation: 'connection_string_parsing',
                        suggestion: 'Supported protocols: sqlite, postgresql, postgres, mysql'
                    });
            }
            if (dialect === 'sqlite') {
                return {
                    dialect,
                    connection: {
                        database: url.pathname,
                        host: '',
                        port: 0,
                        username: '',
                        password: ''
                    }
                };
            }
            if (dialect === 'postgresql' || dialect === 'mysql') {
                // Parse query parameters for SSL and pool configuration
                const searchParams = new URLSearchParams(url.search);
                const sslParam = searchParams.get('ssl') || searchParams.get('sslmode');
                let ssl = false;
                if (sslParam) {
                    if (sslParam === 'true' || sslParam === 'require') {
                        ssl = true;
                    }
                    else if (sslParam === 'false' || sslParam === 'disable') {
                        ssl = false;
                    }
                    else {
                        // For other SSL modes, we'll need more configuration
                        ssl = { rejectUnauthorized: sslParam !== 'allow' && sslParam !== 'prefer' };
                    }
                }
                return {
                    dialect,
                    connection: {
                        host: url.hostname || 'localhost',
                        port: url.port ? parseInt(url.port, 10) : this.getDefaultPort(dialect),
                        database: url.pathname.replace(/^\//, ''),
                        username: url.username || undefined,
                        password: url.password || undefined,
                        ssl,
                        pool: {
                            max: searchParams.get('pool_max') ? parseInt(searchParams.get('pool_max'), 10) : 10,
                            min: searchParams.get('pool_min') ? parseInt(searchParams.get('pool_min'), 10) : 0,
                        }
                    }
                };
            }
            return {
                dialect,
                connection: {
                    host: url.hostname || 'localhost',
                    port: url.port ? parseInt(url.port) : this.getDefaultPort(dialect),
                    database: url.pathname.slice(1), // Remove leading slash
                    username: url.username || '',
                    password: url.password || '',
                    ssl: url.searchParams.get('ssl') === 'true' || url.searchParams.get('sslmode') === 'require'
                }
            };
        }
        catch (error) {
            throw new NoormError_js_1.NoormError(`Failed to parse connection string: ${error instanceof Error ? error.message : String(error)}`, {
                operation: 'connection_string_parsing',
                suggestion: 'Ensure connection string format is: protocol://username:password@host:port/database'
            });
        }
    }
    /**
     * Get default port for database dialect
     */
    getDefaultPort(dialect) {
        switch (dialect) {
            case 'sqlite': return 0;
            case 'postgresql': return 5432;
            case 'mysql': return 3306;
            default: return 0;
        }
    }
    createDialect() {
        const { dialect, connection } = this.config;
        switch (dialect) {
            case 'sqlite':
                return new sqlite_dialect_js_1.SqliteDialect({
                    database: new better_sqlite3_1.default(connection.database)
                });
            case 'postgresql':
                return new postgresql_dialect_js_1.PostgresDialect({
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
                    }
                });
            default:
                throw new Error(`Unsupported dialect: ${dialect}`);
        }
    }
}
exports.NOORMME = NOORMME;
// Export the main class as default
exports.default = NOORMME;
