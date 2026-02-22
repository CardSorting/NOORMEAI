import type { Kysely } from '../kysely.js'
import { sql } from '../raw-builder/sql.js'

export interface SchemaMetadata {
  name: string
}

export interface TableMetadata {
  name: string
  schema?: string
  isView?: boolean
  columns: ColumnMetadata[]
  indexes: IndexMetadata[]
  foreignKeys: ForeignKeyMetadata[]
}

export interface ColumnMetadata {
  name: string
  type: string
  nullable: boolean
  defaultValue?: any
  isPrimaryKey: boolean
  isAutoIncrement: boolean
  maxLength?: number
  precision?: number
  scale?: number
}

export interface IndexMetadata {
  name: string
  columns: string[]
  unique: boolean
}

export interface ForeignKeyMetadata {
  name: string
  column: string
  referencedTable: string
  referencedColumn: string
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'
}

export interface DatabaseMetadataOptions {
  withInternalKyselyTables?: boolean
}

export interface DatabaseMetadata {
  tables: TableMetadata[]
}

/**
 * Base database introspector that queries database metadata.
 * Specific dialects should extend this class.
 */
export class DatabaseIntrospector {
  constructor(protected db: Kysely<any>) {}

  /**
   * Get all schemas in the database
   */
  async getSchemas(): Promise<SchemaMetadata[]> {
    try {
      const result = await sql<{ schema_name: string }>`
        select schema_name
        from information_schema.schemata
        order by schema_name
      `.execute(this.db)

      return result.rows.map((row) => ({
        name: row.schema_name,
      }))
    } catch (e) {
      return []
    }
  }

  /**
   * Get all tables in the database
   */
  async getTables(options?: DatabaseMetadataOptions): Promise<TableMetadata[]> {
    try {
      const result = await sql<{
        table_name: string
        table_schema: string
        table_type: string
      }>`
        select table_name, table_schema, table_type
        from information_schema.tables
        where table_schema not in ('information_schema', 'pg_catalog', 'sys')
        order by table_name
      `.execute(this.db)

      const tables: TableMetadata[] = []

      for (const row of result.rows) {
        if (
          !options?.withInternalKyselyTables &&
          (row.table_name.includes('kysely_') ||
            row.table_name.includes('noorm_'))
        ) {
          continue
        }

        tables.push({
          name: row.table_name,
          schema: row.table_schema,
          isView: row.table_type === 'VIEW',
          columns: await this.getColumns(row.table_name),
          indexes: await this.getIndexes(row.table_name),
          foreignKeys: await this.getForeignKeys(row.table_name),
        })
      }

      return tables
    } catch (e) {
      return []
    }
  }

  /**
   * Get metadata for all tables
   */
  async getMetadata(
    options?: DatabaseMetadataOptions,
  ): Promise<DatabaseMetadata> {
    return {
      tables: await this.getTables(options),
    }
  }

  /**
   * Get columns for a specific table
   */
  async getColumns(tableName: string): Promise<ColumnMetadata[]> {
    try {
      const result = await sql<{
        column_name: string
        data_type: string
        is_nullable: string
        column_default: any
      }>`
        select column_name, data_type, is_nullable, column_default
        from information_schema.columns
        where table_name = ${tableName}
        order by ordinal_position
      `.execute(this.db)

      return result.rows.map((row) => ({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === 'YES',
        defaultValue: row.column_default,
        isPrimaryKey: false, // Defaulting to false, dialects should override
        isAutoIncrement: false,
      }))
    } catch (e) {
      return []
    }
  }

  /**
   * Get indexes for a specific table
   */
  async getIndexes(tableName: string): Promise<IndexMetadata[]> {
    // Standard SQL doesn't have a uniform way to get indexes in information_schema
    // Dialects must override this.
    return []
  }

  /**
   * Get foreign keys for a specific table
   */
  async getForeignKeys(tableName: string): Promise<ForeignKeyMetadata[]> {
    try {
      const result = await sql<{
        constraint_name: string
        column_name: string
        referenced_table_name: string
        referenced_column_name: string
      }>`
        select
          kcu.constraint_name,
          kcu.column_name,
          ccu.table_name as referenced_table_name,
          ccu.column_name as referenced_column_name
        from information_schema.key_column_usage kcu
        join information_schema.constraint_column_usage ccu
          on kcu.constraint_name = ccu.constraint_name
        where kcu.table_name = ${tableName}
      `.execute(this.db)

      return result.rows.map((row) => ({
        name: row.constraint_name,
        column: row.column_name,
        referencedTable: row.referenced_table_name,
        referencedColumn: row.referenced_column_name,
      }))
    } catch (e) {
      return []
    }
  }

  /**
   * Get view definition for a specific view
   */
  async getViewDefinition(viewName: string): Promise<string | null> {
    try {
      const result = await sql<{ view_definition: string }>`
        select view_definition
        from information_schema.views
        where table_name = ${viewName}
      `.execute(this.db)

      return result.rows[0]?.view_definition || null
    } catch (e) {
      return null
    }
  }

  /**
   * Get row count for a specific table
   */
  async getRowCount(tableName: string): Promise<number> {
    try {
      const result = await this.db
        .selectFrom(tableName)
        .select((eb) => eb.fn.countAll<number | string>().as('count'))
        .executeTakeFirst()
      return Number(result?.count || 0)
    } catch (error) {
      return 0
    }
  }
}
