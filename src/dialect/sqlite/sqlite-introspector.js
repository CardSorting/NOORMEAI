"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqliteIntrospector = void 0;
const database_introspector_js_1 = require("../database-introspector.js");
// Migration constants - moved from old migration system
const DEFAULT_MIGRATION_TABLE = 'kysely_migration';
const DEFAULT_MIGRATION_LOCK_TABLE = 'kysely_migration_lock';
const sql_js_1 = require("../../raw-builder/sql.js");
class SqliteIntrospector extends database_introspector_js_1.DatabaseIntrospector {
    #db;
    constructor(db) {
        super(db);
        this.#db = db;
    }
    async getSchemas() {
        // Sqlite doesn't support schemas.
        return [];
    }
    async getTables(options = { withInternalKyselyTables: false }) {
        return await this.#getTableMetadata(options);
    }
    async getMetadata(options) {
        return {
            tables: await this.getTables(options),
        };
    }
    #tablesQuery(qb, options) {
        let tablesQuery = qb
            .selectFrom('sqlite_master')
            .where('type', 'in', ['table', 'view'])
            .where('name', 'not like', 'sqlite_%')
            .select(['name', 'sql', 'type'])
            .orderBy('name');
        if (!options.withInternalKyselyTables) {
            tablesQuery = tablesQuery
                .where('name', '!=', DEFAULT_MIGRATION_TABLE)
                .where('name', '!=', DEFAULT_MIGRATION_LOCK_TABLE);
        }
        return tablesQuery;
    }
    async #getTableMetadata(options) {
        const tablesResult = await this.#tablesQuery(this.#db, options).execute();
        // Get column metadata for each table separately since PRAGMA doesn't work in joins
        const columnsByTable = {};
        for (const table of tablesResult) {
            try {
                const columns = await (0, sql_js_1.sql) `PRAGMA table_info(${sql_js_1.sql.lit(table.name)})`.execute(this.#db);
                columnsByTable[table.name] = columns.rows;
            }
            catch (error) {
                console.warn(`Failed to get columns for table ${table.name}:`, error);
                columnsByTable[table.name] = [];
            }
        }
        return tablesResult.map(({ name, sql, type }) => {
            // Enhanced auto-increment detection
            const autoIncrementInfo = this.detectAutoIncrement(sql, columnsByTable[name] ?? []);
            const columns = columnsByTable[name] ?? [];
            return {
                name: name,
                isView: type === 'view',
                columns: columns.map((col) => ({
                    name: col.name,
                    type: col.type,
                    nullable: !col.notnull,
                    isAutoIncrement: autoIncrementInfo.isAutoIncrement && col.name === autoIncrementInfo.columnName,
                    defaultValue: col.dflt_value,
                    isPrimaryKey: col.pk > 0
                })),
                indexes: [],
                foreignKeys: []
            };
        });
    }
    /**
     * Enhanced auto-increment detection for SQLite
     */
    detectAutoIncrement(sql, columns) {
        if (!sql) {
            return { isAutoIncrement: false, columnName: null, type: 'none' };
        }
        // Method 1: Check for explicit AUTOINCREMENT keyword
        const autoIncrementMatch = sql.match(/(\w+)\s+INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/i);
        if (autoIncrementMatch) {
            return {
                isAutoIncrement: true,
                columnName: autoIncrementMatch[1].replace(/["`]/g, ''),
                type: 'autoincrement'
            };
        }
        // Method 2: Check for INTEGER PRIMARY KEY (implicit auto-increment)
        const integerPkMatch = sql.match(/(\w+)\s+INTEGER\s+PRIMARY\s+KEY/i);
        if (integerPkMatch) {
            return {
                isAutoIncrement: true,
                columnName: integerPkMatch[1].replace(/["`]/g, ''),
                type: 'rowid'
            };
        }
        // Method 3: Check columns for INTEGER PRIMARY KEY
        const pkColumns = columns.filter((col) => col.pk > 0);
        if (pkColumns.length === 1) {
            const pkCol = pkColumns[0];
            if (pkCol.type.toLowerCase() === 'integer') {
                return {
                    isAutoIncrement: true,
                    columnName: pkCol.name,
                    type: 'rowid'
                };
            }
        }
        // Method 4: Check for rowid usage (SQLite's implicit primary key)
        const hasExplicitPk = columns.some((col) => col.pk > 0);
        if (!hasExplicitPk) {
            return {
                isAutoIncrement: true,
                columnName: 'rowid',
                type: 'rowid'
            };
        }
        return { isAutoIncrement: false, columnName: null, type: 'none' };
    }
    /**
     * Extract unique constraints from SQL
     */
    extractUniqueConstraints(sql) {
        if (!sql)
            return [];
        const constraints = [];
        const uniqueMatches = sql.match(/UNIQUE\s*\(([^)]+)\)/gi);
        if (uniqueMatches) {
            for (const match of uniqueMatches) {
                const columnsMatch = match.match(/\(([^)]+)\)/);
                if (columnsMatch) {
                    const columns = columnsMatch[1]
                        .split(',')
                        .map(col => col.trim().replace(/["`]/g, ''));
                    constraints.push(...columns);
                }
            }
        }
        return constraints;
    }
    /**
     * Extract check constraints from SQL
     */
    extractCheckConstraints(sql) {
        if (!sql)
            return [];
        const constraints = [];
        const checkMatches = sql.match(/CHECK\s*\(([^)]+)\)/gi);
        if (checkMatches) {
            for (const match of checkMatches) {
                const conditionMatch = match.match(/\(([^)]+)\)/);
                if (conditionMatch) {
                    constraints.push(conditionMatch[1]);
                }
            }
        }
        return constraints;
    }
    async getColumns(tableName) {
        try {
            // SQLite - use raw SQL for PRAGMA table_info
            const result = await (0, sql_js_1.sql) `PRAGMA table_info(${sql_js_1.sql.lit(tableName)})`.execute(this.#db);
            const sqliteColumns = result.rows;
            return sqliteColumns.map((col) => ({
                name: col.name,
                type: col.type,
                nullable: !col.notnull,
                defaultValue: col.dflt_value,
                isPrimaryKey: !!col.pk,
                isAutoIncrement: col.type.toLowerCase().includes('integer') && col.pk
            }));
        }
        catch (error) {
            console.warn('SQLite column discovery failed:', error);
            return [];
        }
    }
    async getIndexes(tableName) {
        try {
            // SQLite - use raw SQL for PRAGMA index_list
            const result = await (0, sql_js_1.sql) `PRAGMA index_list(${sql_js_1.sql.lit(tableName)})`.execute(this.#db);
            const sqliteIndexes = result.rows;
            const indexes = [];
            for (const idx of sqliteIndexes) {
                try {
                    const infoResult = await (0, sql_js_1.sql) `PRAGMA index_info(${sql_js_1.sql.lit(idx.name)})`.execute(this.#db);
                    const info = infoResult.rows;
                    indexes.push({
                        name: idx.name,
                        unique: !!idx.unique,
                        columns: info.sort((a, b) => a.seqno - b.seqno).map((c) => c.name)
                    });
                }
                catch (e) {
                    console.warn(`Failed to get info for index ${idx.name}`, e);
                    indexes.push({
                        name: idx.name,
                        unique: !!idx.unique,
                        columns: []
                    });
                }
            }
            return indexes;
        }
        catch (error) {
            console.warn('SQLite index discovery failed:', error);
            return [];
        }
    }
    async getForeignKeys(tableName) {
        try {
            // SQLite - use raw SQL for PRAGMA foreign_key_list
            const result = await (0, sql_js_1.sql) `PRAGMA foreign_key_list(${sql_js_1.sql.lit(tableName)})`.execute(this.#db);
            const sqliteFks = result.rows;
            return sqliteFks.map((fk) => ({
                name: `fk_${tableName}_${fk.from}`,
                column: fk.from,
                referencedTable: fk.table,
                referencedColumn: fk.to
            }));
        }
        catch (error) {
            console.warn('SQLite foreign key discovery failed:', error);
            return [];
        }
    }
    async getViewDefinition(viewName) {
        const result = await this.#db
            .selectFrom('sqlite_master')
            .select('sql')
            .where('name', '=', viewName)
            .where('type', '=', 'view')
            .executeTakeFirst();
        return result?.sql || null;
    }
}
exports.SqliteIntrospector = SqliteIntrospector;
