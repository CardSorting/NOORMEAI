"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseIntrospector = void 0;
const sql_js_1 = require("../raw-builder/sql.js");
/**
 * Base database introspector that queries database metadata.
 * Specific dialects should extend this class.
 */
class DatabaseIntrospector {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * Get all schemas in the database
     */
    async getSchemas() {
        try {
            const result = await (0, sql_js_1.sql) `
        select schema_name
        from information_schema.schemata
        order by schema_name
      `.execute(this.db);
            return result.rows.map((row) => ({
                name: row.schema_name,
            }));
        }
        catch (e) {
            return [];
        }
    }
    /**
     * Get all tables in the database
     */
    async getTables(options) {
        try {
            const result = await (0, sql_js_1.sql) `
        select table_name, table_schema, table_type
        from information_schema.tables
        where table_schema not in ('information_schema', 'pg_catalog', 'sys')
        order by table_name
      `.execute(this.db);
            const tables = [];
            for (const row of result.rows) {
                if (!options?.withInternalKyselyTables && (row.table_name.includes('kysely_') || row.table_name.includes('noorm_'))) {
                    continue;
                }
                tables.push({
                    name: row.table_name,
                    schema: row.table_schema,
                    isView: row.table_type === 'VIEW',
                    columns: await this.getColumns(row.table_name),
                    indexes: await this.getIndexes(row.table_name),
                    foreignKeys: await this.getForeignKeys(row.table_name),
                });
            }
            return tables;
        }
        catch (e) {
            return [];
        }
    }
    /**
     * Get metadata for all tables
     */
    async getMetadata(options) {
        return {
            tables: await this.getTables(options),
        };
    }
    /**
     * Get columns for a specific table
     */
    async getColumns(tableName) {
        try {
            const result = await (0, sql_js_1.sql) `
        select column_name, data_type, is_nullable, column_default
        from information_schema.columns
        where table_name = ${tableName}
        order by ordinal_position
      `.execute(this.db);
            return result.rows.map((row) => ({
                name: row.column_name,
                type: row.data_type,
                nullable: row.is_nullable === 'YES',
                defaultValue: row.column_default,
                isPrimaryKey: false, // Defaulting to false, dialects should override
                isAutoIncrement: false,
            }));
        }
        catch (e) {
            return [];
        }
    }
    /**
     * Get indexes for a specific table
     */
    async getIndexes(tableName) {
        // Standard SQL doesn't have a uniform way to get indexes in information_schema
        // Dialects must override this.
        return [];
    }
    /**
     * Get foreign keys for a specific table
     */
    async getForeignKeys(tableName) {
        try {
            const result = await (0, sql_js_1.sql) `
        select
          kcu.constraint_name,
          kcu.column_name,
          ccu.table_name as referenced_table_name,
          ccu.column_name as referenced_column_name
        from information_schema.key_column_usage kcu
        join information_schema.constraint_column_usage ccu
          on kcu.constraint_name = ccu.constraint_name
        where kcu.table_name = ${tableName}
      `.execute(this.db);
            return result.rows.map((row) => ({
                name: row.constraint_name,
                column: row.column_name,
                referencedTable: row.referenced_table_name,
                referencedColumn: row.referenced_column_name,
            }));
        }
        catch (e) {
            return [];
        }
    }
    /**
     * Get view definition for a specific view
     */
    async getViewDefinition(viewName) {
        try {
            const result = await (0, sql_js_1.sql) `
        select view_definition
        from information_schema.views
        where table_name = ${viewName}
      `.execute(this.db);
            return result.rows[0]?.view_definition || null;
        }
        catch (e) {
            return null;
        }
    }
    /**
     * Get row count for a specific table
     */
    async getRowCount(tableName) {
        try {
            const result = await this.db
                .selectFrom(tableName)
                .select((eb) => eb.fn.countAll().as('count'))
                .executeTakeFirst();
            return Number(result?.count || 0);
        }
        catch (error) {
            return 0;
        }
    }
}
exports.DatabaseIntrospector = DatabaseIntrospector;
