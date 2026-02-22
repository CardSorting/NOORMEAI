"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLiteAutoOptimizer = void 0;
const sql_js_1 = require("../../raw-builder/sql.js");
/**
 * SQLite Auto-Optimizer that automatically applies performance optimizations
 * and provides intelligent recommendations for SQLite databases
 */
class SQLiteAutoOptimizer {
    logger;
    static instance;
    optimizationHistory = new Map();
    constructor(logger) {
        this.logger = logger;
    }
    static getInstance(logger) {
        if (!SQLiteAutoOptimizer.instance) {
            SQLiteAutoOptimizer.instance = new SQLiteAutoOptimizer(logger);
        }
        return SQLiteAutoOptimizer.instance;
    }
    /**
     * Get default optimization configuration
     */
    getDefaultConfig() {
        return {
            enableAutoPragma: true,
            enableAutoIndexing: true,
            enablePerformanceTuning: true,
            enableBackupRecommendations: true,
            slowQueryThreshold: 1000,
            autoVacuumMode: 'INCREMENTAL',
            journalMode: 'WAL',
            synchronous: 'NORMAL',
            cacheSize: -64000, // 64MB cache
            tempStore: 'MEMORY'
        };
    }
    /**
     * Analyze current SQLite configuration and performance
     */
    async analyzeDatabase(db) {
        try {
            const [pageCount, pageSize, freelistCount, schemaVersion, userVersion, applicationId, cacheSize, synchronous, journalMode, autoVacuum, tempStore, foreignKeys] = await Promise.all([
                this.getPragmaValue(db, 'page_count'),
                this.getPragmaValue(db, 'page_size'),
                this.getPragmaValue(db, 'freelist_count'),
                this.getPragmaValue(db, 'schema_version'),
                this.getPragmaValue(db, 'user_version'),
                this.getPragmaValue(db, 'application_id'),
                this.getPragmaValue(db, 'cache_size'),
                this.getPragmaValue(db, 'synchronous'),
                this.getPragmaValue(db, 'journal_mode'),
                this.getPragmaValue(db, 'auto_vacuum'),
                this.getPragmaValue(db, 'temp_store'),
                this.getPragmaValue(db, 'foreign_keys')
            ]);
            // Run integrity check
            const integrityResult = await (0, sql_js_1.sql) `PRAGMA integrity_check`.execute(db);
            const integrityCheck = integrityResult.rows.length === 1 &&
                integrityResult.rows[0].integrity_check === 'ok';
            return {
                pageCount: Number(pageCount),
                pageSize: Number(pageSize),
                freelistCount: Number(freelistCount),
                schemaVersion: Number(schemaVersion),
                userVersion: Number(userVersion),
                applicationId: Number(applicationId),
                cacheSize: Number(cacheSize),
                synchronous: Number(synchronous),
                journalMode: String(journalMode),
                autoVacuum: Number(autoVacuum),
                tempStore: Number(tempStore),
                foreignKeys: Number(foreignKeys),
                integrityCheck
            };
        }
        catch (error) {
            this.logger.warn('Failed to analyze SQLite database:', error);
            throw error;
        }
    }
    /**
     * Apply automatic optimizations based on configuration
     */
    async optimizeDatabase(db, config = this.getDefaultConfig()) {
        const result = {
            appliedOptimizations: [],
            recommendations: [],
            performanceImpact: 'low',
            warnings: []
        };
        try {
            // Analyze current state
            const metrics = await this.analyzeDatabase(db);
            // Apply pragma optimizations
            if (config.enableAutoPragma) {
                await this.applyPragmaOptimizations(db, config, metrics, result);
            }
            // Apply performance tuning
            if (config.enablePerformanceTuning) {
                await this.applyPerformanceTuning(db, config, metrics, result);
            }
            // Generate recommendations
            await this.generateRecommendations(db, metrics, result);
            // Store optimization history
            const dbId = await this.getDatabaseId(db);
            this.optimizationHistory.set(dbId, result);
            this.logger.info(`Applied ${result.appliedOptimizations.length} SQLite optimizations`);
            return result;
        }
        catch (error) {
            this.logger.error('Failed to optimize SQLite database:', error);
            result.warnings.push(`Optimization failed: ${error}`);
            return result;
        }
    }
    /**
     * Apply pragma-based optimizations
     */
    async applyPragmaOptimizations(db, config, metrics, result) {
        const optimizations = [];
        // Enable WAL mode for better concurrency
        if (metrics.journalMode !== 'wal' && config.journalMode === 'WAL') {
            try {
                await (0, sql_js_1.sql) `PRAGMA journal_mode = WAL`.execute(db);
                optimizations.push('Enabled WAL mode for better concurrency');
                result.performanceImpact = 'high';
            }
            catch (error) {
                result.warnings.push('Failed to enable WAL mode');
            }
        }
        // Set cache size
        if (Math.abs(metrics.cacheSize) < Math.abs(config.cacheSize)) {
            try {
                await (0, sql_js_1.sql) `PRAGMA cache_size = ${sql_js_1.sql.lit(config.cacheSize)}`.execute(db);
                optimizations.push(`Set cache size to ${config.cacheSize}`);
                result.performanceImpact = 'medium';
            }
            catch (error) {
                result.warnings.push('Failed to set cache size');
            }
        }
        // Enable foreign keys
        if (metrics.foreignKeys === 0) {
            try {
                await (0, sql_js_1.sql) `PRAGMA foreign_keys = ON`.execute(db);
                optimizations.push('Enabled foreign key constraints');
                result.performanceImpact = 'low';
            }
            catch (error) {
                result.warnings.push('Failed to enable foreign keys');
            }
        }
        // Set synchronous mode
        const syncModes = ['OFF', 'NORMAL', 'FULL', 'EXTRA'];
        const targetSync = syncModes.indexOf(config.synchronous);
        if (metrics.synchronous !== targetSync) {
            try {
                await (0, sql_js_1.sql) `PRAGMA synchronous = ${sql_js_1.sql.lit(config.synchronous)}`.execute(db);
                optimizations.push(`Set synchronous mode to ${config.synchronous}`);
                result.performanceImpact = 'medium';
            }
            catch (error) {
                result.warnings.push('Failed to set synchronous mode');
            }
        }
        // Set temp store
        const tempStores = ['DEFAULT', 'FILE', 'MEMORY'];
        const targetTemp = tempStores.indexOf(config.tempStore);
        if (metrics.tempStore !== targetTemp) {
            try {
                await (0, sql_js_1.sql) `PRAGMA temp_store = ${sql_js_1.sql.lit(config.tempStore)}`.execute(db);
                optimizations.push(`Set temp store to ${config.tempStore}`);
                result.performanceImpact = 'low';
            }
            catch (error) {
                result.warnings.push('Failed to set temp store');
            }
        }
        result.appliedOptimizations.push(...optimizations);
    }
    /**
     * Apply performance tuning optimizations
     */
    async applyPerformanceTuning(db, config, metrics, result) {
        const optimizations = [];
        // Run ANALYZE for query optimization
        try {
            await (0, sql_js_1.sql) `ANALYZE`.execute(db);
            optimizations.push('Ran ANALYZE for query optimization');
            result.performanceImpact = 'medium';
        }
        catch (error) {
            result.warnings.push('Failed to run ANALYZE');
        }
        // Optimize database (SQLite 3.18+)
        try {
            await (0, sql_js_1.sql) `PRAGMA optimize`.execute(db);
            optimizations.push('Ran PRAGMA optimize for automatic tuning');
            result.performanceImpact = 'low';
        }
        catch (error) {
            // PRAGMA optimize is not available in older SQLite versions
            this.logger.debug('PRAGMA optimize not available in this SQLite version');
        }
        // Set auto vacuum mode
        const vacuumModes = ['NONE', 'FULL', 'INCREMENTAL'];
        const targetVacuum = vacuumModes.indexOf(config.autoVacuumMode);
        if (metrics.autoVacuum !== targetVacuum) {
            try {
                await (0, sql_js_1.sql) `PRAGMA auto_vacuum = ${sql_js_1.sql.lit(config.autoVacuumMode)}`.execute(db);
                optimizations.push(`Set auto vacuum to ${config.autoVacuumMode}`);
                result.performanceImpact = 'medium';
            }
            catch (error) {
                result.warnings.push('Failed to set auto vacuum mode');
            }
        }
        result.appliedOptimizations.push(...optimizations);
    }
    /**
     * Generate intelligent recommendations
     */
    async generateRecommendations(db, metrics, result) {
        const recommendations = [];
        // Check for large freelist (fragmentation)
        if (metrics.freelistCount > 100) {
            recommendations.push(`High fragmentation detected (${metrics.freelistCount} free pages). Consider running VACUUM to reclaim space.`);
        }
        // Check for integrity issues
        if (!metrics.integrityCheck) {
            recommendations.push('Database integrity check failed. Run PRAGMA integrity_check for details.');
        }
        // Check for missing indexes (simplified)
        const tables = await this.getTableList(db);
        for (const table of tables) {
            const indexes = await this.getTableIndexes(db, table);
            if (indexes.length === 0) {
                recommendations.push(`Table '${table}' has no indexes. Consider adding indexes for frequently queried columns.`);
            }
        }
        // Check cache efficiency
        if (Math.abs(metrics.cacheSize) < 32000) {
            recommendations.push('Consider increasing cache_size for better performance with larger databases.');
        }
        // Check for WAL mode benefits
        if (metrics.journalMode !== 'wal') {
            recommendations.push('Consider enabling WAL mode for better concurrent read performance.');
        }
        result.recommendations.push(...recommendations);
    }
    /**
     * Get pragma value
     */
    async getPragmaValue(db, pragma) {
        try {
            const result = await (0, sql_js_1.sql) `PRAGMA ${sql_js_1.sql.id(pragma)}`.execute(db);
            return result.rows[0]?.[pragma] ?? null;
        }
        catch (error) {
            this.logger.debug(`Failed to get PRAGMA ${pragma}:`, error);
            return null;
        }
    }
    /**
     * Get database identifier for history tracking
     */
    async getDatabaseId(db) {
        try {
            const result = await (0, sql_js_1.sql) `PRAGMA database_list`.execute(db);
            const mainDb = result.rows.find((db) => db.seq === 0);
            return mainDb?.file || 'unknown';
        }
        catch (error) {
            return 'unknown';
        }
    }
    /**
     * Get list of tables
     */
    async getTableList(db) {
        try {
            const result = await db
                .selectFrom('sqlite_master')
                .select('name')
                .where('type', '=', 'table')
                .where('name', 'not like', 'sqlite_%')
                .execute();
            return result.map(row => row.name);
        }
        catch (error) {
            this.logger.debug('Failed to get table list:', error);
            return [];
        }
    }
    /**
     * Get indexes for a table
     */
    async getTableIndexes(db, tableName) {
        try {
            const result = await (0, sql_js_1.sql) `PRAGMA index_list(${sql_js_1.sql.lit(tableName)})`.execute(db);
            return result.rows || [];
        }
        catch (error) {
            this.logger.debug(`Failed to get indexes for table ${tableName}:`, error);
            return [];
        }
    }
    /**
     * Get optimization history for a database
     */
    getOptimizationHistory(dbId) {
        if (!dbId)
            return null;
        return this.optimizationHistory.get(dbId) || null;
    }
    /**
     * Clear optimization history
     */
    clearHistory() {
        this.optimizationHistory.clear();
    }
    /**
     * Get backup recommendations
     */
    async getBackupRecommendations(db) {
        const recommendations = [];
        const metrics = await this.analyzeDatabase(db);
        // Check for WAL files
        if (metrics.journalMode === 'wal') {
            recommendations.push('When using WAL mode, ensure to backup both the main database file and WAL file for consistency.');
        }
        // Check database size
        const dbSize = metrics.pageCount * metrics.pageSize;
        if (dbSize > 100 * 1024 * 1024) { // 100MB
            recommendations.push('For large databases, consider using SQLite backup API or .backup command for efficient backups.');
        }
        // Check for active transactions
        recommendations.push('Perform backups during low-activity periods to minimize lock contention.');
        return recommendations;
    }
    /**
     * Suggest index optimizations based on query patterns
     */
    async suggestIndexOptimizations(db, queryPatterns) {
        const suggestions = [];
        // Analyze common WHERE clauses
        const whereColumns = new Map();
        for (const query of queryPatterns) {
            const whereMatch = query.match(/WHERE\s+([^ORDER\s]+)/i);
            if (whereMatch) {
                const whereClause = whereMatch[1];
                const columnMatches = whereClause.match(/(\w+)\s*[=<>]/g);
                if (columnMatches) {
                    for (const match of columnMatches) {
                        const column = match.replace(/\s*[=<>].*/, '').trim();
                        whereColumns.set(column, (whereColumns.get(column) || 0) + 1);
                    }
                }
            }
        }
        // Suggest indexes for frequently queried columns
        for (const [column, count] of whereColumns.entries()) {
            if (count >= 3) {
                suggestions.push(`Consider adding an index on '${column}' (used in ${count} queries)`);
            }
        }
        return suggestions;
    }
}
exports.SQLiteAutoOptimizer = SQLiteAutoOptimizer;
