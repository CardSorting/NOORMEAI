"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLiteIndexDiscovery = void 0;
const sql_js_1 = require("../../../../raw-builder/sql.js");
/**
 * SQLite-specific index discovery
 */
class SQLiteIndexDiscovery {
    static instance;
    static getInstance() {
        if (!SQLiteIndexDiscovery.instance) {
            SQLiteIndexDiscovery.instance = new SQLiteIndexDiscovery();
        }
        return SQLiteIndexDiscovery.instance;
    }
    /**
     * Discover indexes for a specific table in SQLite
     */
    async discoverTableIndexes(db, tableName) {
        try {
            const indexes = await db
                .selectFrom('sqlite_master')
                .select([
                'name',
                'sql as definition',
                (0, sql_js_1.sql) `type = 'index'`.as('isIndex'),
                (0, sql_js_1.sql) `sql LIKE '%UNIQUE%'`.as('unique')
            ])
                .where('type', '=', 'index')
                .where('tbl_name', '=', tableName)
                .execute();
            // Parse column information from SQL definition
            const processedIndexes = indexes.map((index) => ({
                ...index,
                columns: this.extractColumnsFromSQL(index.definition),
                isPrimary: index.name.includes('sqlite_autoindex'),
                comment: null // SQLite doesn't support index comments
            }));
            return processedIndexes;
        }
        catch (error) {
            console.warn(`Failed to discover indexes for SQLite table ${tableName}:`, error);
            return [];
        }
    }
    /**
     * Extract column names from SQLite index definition
     */
    extractColumnsFromSQL(sql) {
        if (!sql)
            return [];
        // Parse columns from CREATE INDEX statement
        // Example: CREATE INDEX idx_name ON table (col1, col2)
        const match = sql.match(/\(([^)]+)\)/);
        if (match) {
            return match[1]
                .split(',')
                .map(col => col.trim().replace(/^\s*["']?|["']?\s*$/g, ''))
                .filter(col => col.length > 0);
        }
        return [];
    }
    /**
     * Get index information from pragma
     */
    async getIndexInfo(db, tableName) {
        try {
            // SQLite pragma index_info
            const result = await (0, sql_js_1.sql) `PRAGMA index_list(${sql_js_1.sql.lit(tableName)})`.execute(db);
            return result.rows || [];
        }
        catch (error) {
            console.warn(`Failed to get index info for SQLite table ${tableName}:`, error);
            return [];
        }
    }
    /**
     * Analyze SQLite index efficiency
     */
    analyzeIndexEfficiency(indexes) {
        const recommendations = [];
        const missingIndexes = [];
        const redundantIndexes = [];
        // Check for auto-generated indexes that might be redundant
        const autoIndexes = indexes.filter(idx => idx.isPrimary);
        if (autoIndexes.length > 1) {
            recommendations.push('Multiple auto-generated indexes found - review table structure');
        }
        // Check for indexes with no columns (invalid)
        const invalidIndexes = indexes.filter(idx => !idx.columns || idx.columns.length === 0);
        for (const idx of invalidIndexes) {
            recommendations.push(`Invalid index found: ${idx.name} (no columns)`);
        }
        // Check for duplicate column combinations
        const columnGroups = new Map();
        for (const index of indexes) {
            const key = index.columns.sort().join(',');
            if (!columnGroups.has(key)) {
                columnGroups.set(key, []);
            }
            columnGroups.get(key).push(index.name);
        }
        for (const [columns, names] of columnGroups) {
            if (names.length > 1) {
                redundantIndexes.push(...names);
                recommendations.push(`Redundant indexes on columns (${columns}): ${names.join(', ')}`);
            }
        }
        return {
            recommendations,
            missingIndexes,
            redundantIndexes
        };
    }
    /**
     * Get table size information for SQLite
     */
    async getTableSize(db, tableName) {
        try {
            const result = await (0, sql_js_1.sql) `SELECT COUNT(*) as rowCount FROM ${sql_js_1.sql.id(tableName)}`.execute(db);
            return {
                rowCount: result.rows?.[0]?.rowCount || 0,
                size: 0, // SQLite doesn't provide direct size info
                lastModified: new Date()
            };
        }
        catch (error) {
            console.warn(`Failed to get table size for SQLite table ${tableName}:`, error);
            return null;
        }
    }
}
exports.SQLiteIndexDiscovery = SQLiteIndexDiscovery;
