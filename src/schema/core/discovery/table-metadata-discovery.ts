import type { Kysely } from '../../../kysely.js'
import { DatabaseIntrospector } from '../../../dialect/database-introspector.js'
import { TableInfo } from '../../../types/index.js'
import { TableMetadata, SchemaDiscoveryConfig } from '../types/schema-discovery-types.js'
import { TypeMapper } from '../utils/type-mapper.js'

/**
 * Specialized service for discovering table metadata
 */
export class TableMetadataDiscovery {
  private static instance: TableMetadataDiscovery

  static getInstance(): TableMetadataDiscovery {
    if (!TableMetadataDiscovery.instance) {
      TableMetadataDiscovery.instance = new TableMetadataDiscovery()
    }
    return TableMetadataDiscovery.instance
  }

  /**
   * Discover all tables in the database
   */
  async discoverTables(
    introspector: DatabaseIntrospector,
    config: SchemaDiscoveryConfig = {}
  ): Promise<TableInfo[]> {
    const tables = await introspector.getTables()
    
    // Process tables in parallel to reduce total time
    const tablePromises = tables.map(async (table) => {
      return await this.processTable(table, introspector, config)
    })

    // Wait for all table processing to complete
    const results = await Promise.all(tablePromises)
    
    // Filter out null results and return valid table infos
    return results.filter((table): table is TableInfo => table !== null)
  }

  /**
   * Process a single table to get its metadata
   */
  private async processTable(
    table: any,
    introspector: DatabaseIntrospector,
    config: SchemaDiscoveryConfig
  ): Promise<TableInfo | null> {
    // Skip excluded tables
    if (config.excludeTables?.includes(table.name)) {
      return null
    }

    try {
      // Get columns, indexes, and foreign keys for this table
      const [columns, indexes, foreignKeys] = await Promise.all([
        introspector.getColumns(table.name).catch(() => []),
        introspector.getIndexes(table.name).catch(() => []),
        introspector.getForeignKeys(table.name).catch(() => [])
      ])

      // Find primary key columns
      const primaryKeyColumns = columns
        .filter((col: any) => col.isPrimaryKey)
        .map((col: any) => col.name)

      return {
        name: table.name,
        schema: table.schema,
        columns: columns.map((col: any) => TypeMapper.mapColumnInfo(col, config.customTypeMappings)),
        primaryKey: primaryKeyColumns.length > 0 ? primaryKeyColumns : undefined,
        indexes: indexes.map((idx: any) => ({
          name: idx.name,
          columns: idx.columns,
          unique: idx.unique
        })),
        foreignKeys: foreignKeys.map((fk: any) => ({
          name: fk.name,
          column: fk.column,
          referencedTable: fk.referencedTable,
          referencedColumn: fk.referencedColumn,
          onDelete: fk.onDelete,
          onUpdate: fk.onUpdate
        }))
      }
    } catch (error) {
      console.warn(`Failed to get metadata for table ${table.name}:`, error)
      return null
    }
  }

  /**
   * Get table statistics
   */
  async getTableStatistics(introspector: DatabaseIntrospector, tableName: string): Promise<any> {
    try {
      const rowCount = await introspector.getRowCount(tableName)
      const columns = await introspector.getColumns(tableName)
      const indexes = await introspector.getIndexes(tableName)
      const foreignKeys = await introspector.getForeignKeys(tableName)

      return {
        rowCount,
        columnCount: columns.length,
        indexCount: indexes.length,
        foreignKeyCount: foreignKeys.length,
        lastModified: new Date(), // Fallback
        indexes: indexes.map(idx => idx.name),
        constraints: foreignKeys.map(fk => fk.name)
      }
    } catch (error) {
      console.warn(`Failed to get statistics for table ${tableName}:`, error)
      return null
    }
  }

  /**
   * Validate table structure
   */
  validateTableStructure(table: TableInfo): { isValid: boolean; issues: string[] } {
    const issues: string[] = []

    // Check for required fields
    if (!table.name) {
      issues.push('Table name is required')
    }

    if (!table.columns || table.columns.length === 0) {
      issues.push('Table must have at least one column')
    }

    // Check for duplicate column names
    const columnNames = table.columns.map(col => col.name)
    const duplicates = columnNames.filter((name, index) => columnNames.indexOf(name) !== index)
    if (duplicates.length > 0) {
      issues.push(`Duplicate column names found: ${duplicates.join(', ')}`)
    }

    // Check for valid primary key
    if (table.primaryKey && table.primaryKey.length > 0) {
      const primaryKeyColumns = table.primaryKey
      const invalidPkColumns = primaryKeyColumns.filter(pkCol => 
        !table.columns.some(col => col.name === pkCol)
      )
      if (invalidPkColumns.length > 0) {
        issues.push(`Primary key references non-existent columns: ${invalidPkColumns.join(', ')}`)
      }
    }

    return {
      isValid: issues.length === 0,
      issues
    }
  }
}
