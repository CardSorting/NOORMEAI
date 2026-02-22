"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLiteMigrationManager = void 0;
const sql_js_1 = require("../raw-builder/sql.js");
const logger_js_1 = require("../logging/logger.js");
const sqlite_auto_optimizer_js_1 = require("../dialect/sqlite/sqlite-auto-optimizer.js");
const sqlite_auto_indexer_js_1 = require("../dialect/sqlite/sqlite-auto-indexer.js");
const sqlite_migration_provider_js_1 = require("./sqlite-migration-provider.js");
const node_fs_1 = require("node:fs");
const path = __importStar(require("node:path"));
const node_crypto_1 = require("node:crypto");
/**
 * SQLite Migration Manager - Focused on SQLite automation and optimization
 * Integrates with existing SQLite auto-optimization features
 */
class SQLiteMigrationManager {
    static instance = null;
    db;
    config;
    logger;
    optimizer;
    indexer;
    provider;
    isInitialized = false;
    constructor(db, config = {}, logger) {
        this.db = db;
        this.logger = logger;
        this.config = {
            enableAutoOptimization: true,
            enableIndexRecommendations: true,
            enableConstraintValidation: true,
            enablePerformanceMonitoring: true,
            migrationDirectory: './migrations',
            backupBeforeMigration: true,
            dryRun: false,
            ...config
        };
        this.optimizer = sqlite_auto_optimizer_js_1.SQLiteAutoOptimizer.getInstance(logger);
        this.indexer = sqlite_auto_indexer_js_1.SQLiteAutoIndexer.getInstance(logger);
        this.provider = sqlite_migration_provider_js_1.SQLiteMigrationProvider.getInstance({
            migrationDirectory: this.config.migrationDirectory
        }, logger);
    }
    static getInstance(db, config, logger) {
        if (!SQLiteMigrationManager.instance) {
            if (!logger) {
                logger = new logger_js_1.Logger({ level: 'info', enabled: true });
            }
            SQLiteMigrationManager.instance = new SQLiteMigrationManager(db, config, logger);
        }
        return SQLiteMigrationManager.instance;
    }
    /**
     * Initialize the SQLite migration system
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        this.logger.info('🚀 Initializing SQLite Migration Manager...');
        try {
            // Create migrations table if it doesn't exist
            await this.createMigrationsTable();
            // Apply initial SQLite optimizations
            if (this.config.enableAutoOptimization) {
                await this.applyInitialOptimizations();
            }
            this.isInitialized = true;
            this.logger.info('✅ SQLite Migration Manager initialized successfully');
        }
        catch (error) {
            this.logger.error('❌ Failed to initialize SQLite Migration Manager:', error);
            throw error;
        }
    }
    /**
     * Create the migrations tracking table
     */
    async createMigrationsTable() {
        await (0, sql_js_1.sql) `
      CREATE TABLE IF NOT EXISTS sqlite_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        checksum TEXT,
        optimization_applied BOOLEAN DEFAULT FALSE,
        index_recommendations TEXT,
        performance_impact TEXT
      )
    `.execute(this.db);
        // Create index for faster lookups
        await (0, sql_js_1.sql) `
      CREATE INDEX IF NOT EXISTS idx_sqlite_migrations_name 
      ON sqlite_migrations(name)
    `.execute(this.db);
    }
    /**
     * Apply initial SQLite optimizations
     */
    async applyInitialOptimizations() {
        this.logger.info('🔧 Applying initial SQLite optimizations...');
        try {
            const optimizations = await this.optimizer.optimizeDatabase(this.db, {
                enableAutoPragma: true,
                enableAutoIndexing: false, // We'll handle indexing separately
                enablePerformanceTuning: true,
                enableBackupRecommendations: false,
                slowQueryThreshold: 1000,
                autoVacuumMode: 'INCREMENTAL',
                journalMode: 'WAL',
                synchronous: 'NORMAL',
                cacheSize: -64000, // 64MB
                tempStore: 'MEMORY'
            });
            this.logger.info(`✅ Applied ${optimizations.appliedOptimizations.length} optimizations`);
            if (optimizations.warnings.length > 0) {
                this.logger.warn(`⚠️ ${optimizations.warnings.length} warnings:`, optimizations.warnings);
            }
        }
        catch (error) {
            this.logger.error('❌ Failed to apply initial optimizations:', error);
            throw error;
        }
    }
    /**
     * Plan SQLite migrations with optimization recommendations
     */
    async planMigrations() {
        this.logger.info('📋 Planning SQLite migrations...');
        try {
            // Get pending migrations
            const pendingMigrations = await this.getPendingMigrations();
            // Get optimization recommendations
            const optimizationRecs = await this.optimizer.optimizeDatabase(this.db);
            // Get index recommendations
            const indexRecs = await this.indexer.analyzeAndRecommend(this.db, {
                minFrequency: 3,
                slowQueryThreshold: 1000,
                maxRecommendations: 10
            });
            const plan = {
                migrations: pendingMigrations,
                optimizations: optimizationRecs.recommendations || [],
                indexRecommendations: indexRecs.recommendations.map(r => r.sql),
                estimatedImpact: this.calculateImpact(pendingMigrations.length, optimizationRecs.recommendations?.length || 0),
                dryRun: this.config.dryRun
            };
            this.logger.info(`📊 Migration plan: ${plan.migrations.length} migrations, ${plan.optimizations.length} optimizations, ${plan.indexRecommendations.length} index recommendations`);
            return plan;
        }
        catch (error) {
            this.logger.error('❌ Failed to plan migrations:', error);
            throw error;
        }
    }
    /**
     * Execute SQLite migrations with automatic optimization
     */
    async executeMigrations() {
        const startTime = Date.now();
        this.logger.info('🔄 Executing SQLite migrations...');
        try {
            const plan = await this.planMigrations();
            if (plan.migrations.length === 0) {
                this.logger.info('✅ No pending migrations');
                return {
                    success: true,
                    migrationsApplied: 0,
                    optimizationsApplied: [],
                    indexRecommendations: [],
                    performanceImpact: 'low',
                    duration: Date.now() - startTime,
                    warnings: []
                };
            }
            const result = {
                success: false,
                migrationsApplied: 0,
                optimizationsApplied: [],
                indexRecommendations: [],
                performanceImpact: 'low',
                duration: 0,
                warnings: []
            };
            // Execute migrations in transaction
            await this.db.transaction().execute(async (trx) => {
                for (const migration of plan.migrations) {
                    await this.executeMigration(trx, migration);
                    result.migrationsApplied++;
                }
                // Apply optimizations after migrations
                if (this.config.enableAutoOptimization && plan.optimizations.length > 0) {
                    const optimizationResult = await this.optimizer.optimizeDatabase(trx, {
                        enableAutoPragma: true,
                        enableAutoIndexing: false,
                        enablePerformanceTuning: true,
                        enableBackupRecommendations: false,
                        slowQueryThreshold: 1000,
                        autoVacuumMode: 'INCREMENTAL',
                        journalMode: 'WAL',
                        synchronous: 'NORMAL',
                        cacheSize: -64000,
                        tempStore: 'MEMORY'
                    });
                    result.optimizationsApplied = optimizationResult.appliedOptimizations;
                    result.warnings.push(...optimizationResult.warnings);
                }
                // Record index recommendations
                if (this.config.enableIndexRecommendations) {
                    result.indexRecommendations = plan.indexRecommendations;
                }
            });
            result.success = true;
            result.performanceImpact = plan.estimatedImpact;
            result.duration = Date.now() - startTime;
            this.logger.info(`✅ Migration completed: ${result.migrationsApplied} migrations applied in ${result.duration}ms`);
            return result;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error('❌ Migration failed:', error);
            return {
                success: false,
                migrationsApplied: 0,
                optimizationsApplied: [],
                indexRecommendations: [],
                performanceImpact: 'low',
                duration,
                warnings: [error instanceof Error ? error.message : 'Unknown error']
            };
        }
    }
    /**
     * Execute a single migration
     */
    async executeMigration(trx, migrationName) {
        this.logger.info(`📝 Executing migration: ${migrationName}`);
        const migration = await this.provider.getMigration(migrationName);
        if (!migration) {
            throw new Error(`Migration ${migrationName} not found`);
        }
        try {
            // Execute the migration content
            await sql_js_1.sql.raw(migration.content).execute(trx);
            // Record the migration
            await trx
                .insertInto('sqlite_migrations')
                .values({
                name: migrationName,
                applied_at: new Date(),
                checksum: migration.checksum,
                optimization_applied: true,
                performance_impact: 'medium'
            })
                .execute();
            this.logger.info(`✅ Migration ${migrationName} applied successfully`);
        }
        catch (error) {
            this.logger.error(`❌ Failed to execute migration ${migrationName}:`, error);
            throw error;
        }
    }
    /**
     * Get pending migrations
     */
    async getPendingMigrations() {
        // Discover all available migrations from filesystem
        const availableMigrations = await this.provider.discoverMigrations();
        // Get applied migrations from database
        const appliedMigrations = await this.db
            .selectFrom('sqlite_migrations')
            .select('name')
            .execute();
        const appliedNames = new Set(appliedMigrations.map(m => m.name));
        // Filter out applied migrations
        return availableMigrations
            .filter(m => !appliedNames.has(m.name))
            .map(m => m.name);
    }
    /**
     * Generate a new migration file
     */
    async generateMigration(description, operation = 'create_table', options = {}) {
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
        const fileName = `${timestamp}_${description.toLowerCase().replace(/\s+/g, '_')}.sql`;
        const filePath = path.join(this.config.migrationDirectory, fileName);
        const content = this.provider.generateOptimizedMigration(operation, options.tableName || 'new_table', options);
        // Ensure directory exists
        await node_fs_1.promises.mkdir(this.config.migrationDirectory, { recursive: true });
        await node_fs_1.promises.writeFile(filePath, content);
        return { fileName, filePath, content };
    }
    /**
     * Rollback the last applied migration
     */
    async rollbackLastMigration() {
        const lastMigration = await this.db
            .selectFrom('sqlite_migrations')
            .selectAll()
            .orderBy('applied_at', 'desc')
            .executeTakeFirst();
        if (!lastMigration) {
            return { success: false };
        }
        // In a real rollback, you'd execute the 'down' SQL.
        // For NOORMME's simplified automation, we focus on record management.
        await this.db
            .deleteFrom('sqlite_migrations')
            .where('id', '=', lastMigration.id)
            .execute();
        return { success: true, migrationName: lastMigration.name };
    }
    /**
     * Calculate performance impact
     */
    calculateImpact(migrationCount, optimizationCount) {
        const total = migrationCount + optimizationCount;
        if (total === 0)
            return 'low';
        if (total <= 3)
            return 'medium';
        return 'high';
    }
    /**
     * Calculate checksum for migration content
     */
    calculateChecksum(content) {
        return (0, node_crypto_1.createHash)('sha256').update(content).digest('hex');
    }
    /**
     * Get migration status
     */
    async getStatus() {
        const migrations = await this.db
            .selectFrom('sqlite_migrations')
            .selectAll()
            .orderBy('applied_at', 'desc')
            .execute();
        const pending = await this.getPendingMigrations();
        return {
            totalMigrations: migrations.length + pending.length,
            appliedMigrations: migrations.length,
            pendingMigrations: pending.length,
            lastMigration: migrations[0]?.name,
            lastAppliedAt: migrations[0]?.applied_at,
            appliedList: migrations
        };
    }
    /**
     * Record query for performance analysis
     */
    recordQuery(query, executionTime, table) {
        if (this.config.enablePerformanceMonitoring) {
            this.indexer.recordQuery(query, executionTime, table);
        }
    }
    /**
     * Get performance metrics
     */
    async getPerformanceMetrics() {
        return await this.optimizer.analyzeDatabase(this.db);
    }
    /**
     * Get index recommendations
     */
    async getIndexRecommendations() {
        return await this.indexer.analyzeAndRecommend(this.db);
    }
    /**
     * Get optimization recommendations
     */
    async getOptimizationRecommendations() {
        return await this.optimizer.optimizeDatabase(this.db);
    }
}
exports.SQLiteMigrationManager = SQLiteMigrationManager;
