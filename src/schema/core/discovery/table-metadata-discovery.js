"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableMetadataDiscovery = void 0;
const type_mapper_js_1 = require("../utils/type-mapper.js");
/**
 * Specialized service for discovering table metadata
 */
class TableMetadataDiscovery {
    static instance;
    static getInstance() {
        if (!TableMetadataDiscovery.instance) {
            TableMetadataDiscovery.instance = new TableMetadataDiscovery();
        }
        return TableMetadataDiscovery.instance;
    }
    /**
     * Discover all tables in the database
     */
    async discoverTables(introspector, config = {}) {
        const tables = await introspector.getTables();
        // Process tables in parallel to reduce total time
        const tablePromises = tables.map(async (table) => {
            return await this.processTable(table, introspector, config);
        });
        // Wait for all table processing to complete
        const results = await Promise.all(tablePromises);
        // Filter out null results and return valid table infos
        return results.filter((table) => table !== null);
    }
    /**
     * Process a single table to get its metadata
     */
    async processTable(table, introspector, config) {
        // Skip excluded tables
        if (config.excludeTables?.includes(table.name)) {
            return null;
        }
        try {
            // Get columns, indexes, and foreign keys for this table
            const [columns, indexes, foreignKeys] = await Promise.all([
                introspector.getColumns(table.name).catch(() => []),
                introspector.getIndexes(table.name).catch(() => []),
                introspector.getForeignKeys(table.name).catch(() => [])
            ]);
            // Find primary key columns
            const primaryKeyColumns = columns
                .filter((col) => col.isPrimaryKey)
                .map((col) => col.name);
            return {
                name: table.name,
                schema: table.schema,
                columns: columns.map((col) => type_mapper_js_1.TypeMapper.mapColumnInfo(col, config.customTypeMappings)),
                primaryKey: primaryKeyColumns.length > 0 ? primaryKeyColumns : undefined,
                indexes: indexes.map((idx) => ({
                    name: idx.name,
                    columns: idx.columns,
                    unique: idx.unique
                })),
                foreignKeys: foreignKeys.map((fk) => ({
                    name: fk.name,
                    column: fk.column,
                    referencedTable: fk.referencedTable,
                    referencedColumn: fk.referencedColumn,
                    onDelete: fk.onDelete,
                    onUpdate: fk.onUpdate
                }))
            };
        }
        catch (error) {
            console.warn(`Failed to get metadata for table ${table.name}:`, error);
            return null;
        }
    }
    /**
     * Get table statistics
     */
    async getTableStatistics(introspector, tableName) {
        try {
            const rowCount = await introspector.getRowCount(tableName);
            const columns = await introspector.getColumns(tableName);
            const indexes = await introspector.getIndexes(tableName);
            const foreignKeys = await introspector.getForeignKeys(tableName);
            return {
                rowCount,
                columnCount: columns.length,
                indexCount: indexes.length,
                foreignKeyCount: foreignKeys.length,
                lastModified: new Date(), // Fallback
                indexes: indexes.map(idx => idx.name),
                constraints: foreignKeys.map(fk => fk.name)
            };
        }
        catch (error) {
            console.warn(`Failed to get statistics for table ${tableName}:`, error);
            return null;
        }
    }
    /**
     * Validate table structure
     */
    validateTableStructure(table) {
        const issues = [];
        // Check for required fields
        if (!table.name) {
            issues.push('Table name is required');
        }
        if (!table.columns || table.columns.length === 0) {
            issues.push('Table must have at least one column');
        }
        // Check for duplicate column names
        const columnNames = table.columns.map(col => col.name);
        const duplicates = columnNames.filter((name, index) => columnNames.indexOf(name) !== index);
        if (duplicates.length > 0) {
            issues.push(`Duplicate column names found: ${duplicates.join(', ')}`);
        }
        // Check for valid primary key
        if (table.primaryKey && table.primaryKey.length > 0) {
            const primaryKeyColumns = table.primaryKey;
            const invalidPkColumns = primaryKeyColumns.filter(pkCol => !table.columns.some(col => col.name === pkCol));
            if (invalidPkColumns.length > 0) {
                issues.push(`Primary key references non-existent columns: ${invalidPkColumns.join(', ')}`);
            }
        }
        return {
            isValid: issues.length === 0,
            issues
        };
    }
}
exports.TableMetadataDiscovery = TableMetadataDiscovery;
