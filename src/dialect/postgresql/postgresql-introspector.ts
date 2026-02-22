import {
  DatabaseIntrospector,
  DatabaseMetadata,
  DatabaseMetadataOptions,
  SchemaMetadata,
  TableMetadata,
  ColumnMetadata,
  IndexMetadata,
  ForeignKeyMetadata,
} from '../database-introspector.js'
import { Kysely } from '../../kysely.js'
import { sql } from '../../raw-builder/sql.js'

// Migration constants
const DEFAULT_MIGRATION_TABLE = 'kysely_migration'
const DEFAULT_MIGRATION_LOCK_TABLE = 'kysely_migration_lock'

interface RawColumnMetadata {
  table_name: string
  column_name: string
  ordinal_position: number
  column_default: string | null
  is_nullable: 'YES' | 'NO'
  data_type: string
  udt_name: string
  character_maximum_length: number | null
  numeric_precision: number | null
  numeric_scale: number | null
  datetime_precision: number | null
  is_identity: 'YES' | 'NO'
  is_generated: 'NEVER' | 'ALWAYS' | 'BY DEFAULT'
  element_type: string | null
}

interface RawIndexMetadata {
  table_name: string
  index_name: string
  column_name: string
  is_unique: boolean
  is_primary_key: boolean
}

interface RawForeignKeyMetadata {
  constraint_name: string
  table_name: string
  column_name: string
  foreign_table_name: string
  foreign_column_name: string
  on_delete: string | null
  on_update: string | null
}

export class PostgresIntrospector extends DatabaseIntrospector {
  readonly #db: Kysely<any>

  constructor(db: Kysely<any>) {
    super(db)
    this.#db = db
  }

  async getSchemas(): Promise<SchemaMetadata[]> {
    const schemas = await sql<{ schema_name: string }>`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name
    `.execute(this.#db)

    return schemas.rows.map((row) => ({ name: row.schema_name }))
  }

  async getTables(
    options: DatabaseMetadataOptions = { withInternalKyselyTables: false },
  ): Promise<TableMetadata[]> {
    return await this.#getTableMetadata('public', options)
  }

  async getMetadata(
    options?: DatabaseMetadataOptions,
  ): Promise<DatabaseMetadata> {
    return {
      tables: await this.getTables(options),
    }
  }

  async getColumns(tableName: string): Promise<ColumnMetadata[]> {
    const columns = await sql<RawColumnMetadata>`
      SELECT
        c.column_name,
        c.ordinal_position,
        c.column_default,
        c.is_nullable,
        c.data_type,
        c.udt_name,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale,
        c.datetime_precision,
        COALESCE(c.is_identity, 'NO') as is_identity,
        COALESCE(c.identity_generation, 'NEVER') as is_generated,
        e.data_type as element_type
      FROM information_schema.columns c
      LEFT JOIN information_schema.element_types e
        ON e.object_catalog = c.table_catalog
        AND e.object_schema = c.table_schema
        AND e.object_name = c.table_name
        AND e.object_type = 'TABLE'
        AND e.collection_type_identifier = c.dtd_identifier
      WHERE c.table_name = ${tableName}
        AND c.table_schema = 'public'
      ORDER BY c.ordinal_position
    `.execute(this.#db)

    return columns.rows.map((col) => ({
      name: col.column_name,
      type: this.#mapColumnType(col),
      nullable: col.is_nullable === 'YES',
      defaultValue: col.column_default,
      isPrimaryKey: false, // Dialects should handle PK separately
      isAutoIncrement:
        col.is_identity === 'YES' || col.is_generated !== 'NEVER',
    }))
  }

  async getIndexes(tableName: string): Promise<IndexMetadata[]> {
    const indexes = await sql<RawIndexMetadata>`
      SELECT
        i.relname as index_name,
        a.attname as column_name,
        ix.indisunique as is_unique,
        ix.indisprimary as is_primary_key
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_attribute a ON a.attrelid = t.oid
      JOIN pg_namespace n ON n.nspname = 'public'
      WHERE t.relname = ${tableName}
        AND n.oid = t.relnamespace
        AND a.attnum = ANY(ix.indkey)
        AND t.relkind = 'r'
      ORDER BY i.relname, a.attnum
    `.execute(this.#db)

    return this.#parseIndexes(indexes.rows)
  }

  async getForeignKeys(tableName: string): Promise<ForeignKeyMetadata[]> {
    const foreignKeys = await sql<RawForeignKeyMetadata>`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule as on_delete,
        rc.update_rule as on_update
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
        AND rc.constraint_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = ${tableName}
        AND tc.table_schema = 'public'
      ORDER BY tc.constraint_name, kcu.ordinal_position
    `.execute(this.#db)

    return this.#parseForeignKeys(foreignKeys.rows)
  }

  async #getTableMetadata(
    schema: string,
    options: DatabaseMetadataOptions,
  ): Promise<TableMetadata[]> {
    // Get all tables in the schema
    let tablesQuery = sql<{ table_name: string; table_type: string }>`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = ${schema}
        AND table_type IN ('BASE TABLE', 'VIEW')
    `

    if (!options.withInternalKyselyTables) {
      tablesQuery = sql`
        ${tablesQuery}
        AND table_name NOT IN (${DEFAULT_MIGRATION_TABLE}, ${DEFAULT_MIGRATION_LOCK_TABLE})
      `
    }

    tablesQuery = sql`
      ${tablesQuery}
      ORDER BY table_name
    `

    const tables = await tablesQuery.execute(this.#db)

    // Get all columns for these tables
    const columns = await sql<RawColumnMetadata>`
      SELECT
        c.table_name,
        c.column_name,
        c.ordinal_position,
        c.column_default,
        c.is_nullable,
        c.data_type,
        c.udt_name,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale,
        c.datetime_precision,
        COALESCE(c.is_identity, 'NO') as is_identity,
        COALESCE(c.identity_generation, 'NEVER') as is_generated,
        e.data_type as element_type
      FROM information_schema.columns c
      LEFT JOIN information_schema.element_types e
        ON e.object_catalog = c.table_catalog
        AND e.object_schema = c.table_schema
        AND e.object_name = c.table_name
        AND e.object_type = 'TABLE'
        AND e.collection_type_identifier = c.dtd_identifier
      WHERE c.table_schema = ${schema}
      ORDER BY c.table_name, c.ordinal_position
    `.execute(this.#db)

    // Get all indexes
    const indexes = await sql<RawIndexMetadata>`
      SELECT
        t.relname as table_name,
        i.relname as index_name,
        a.attname as column_name,
        ix.indisunique as is_unique,
        ix.indisprimary as is_primary_key
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_attribute a ON a.attrelid = t.oid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = ${schema}
        AND a.attnum = ANY(ix.indkey)
        AND t.relkind = 'r'
      ORDER BY t.relname, i.relname, a.attnum
    `.execute(this.#db)

    // Get all foreign keys
    const foreignKeys = await sql<RawForeignKeyMetadata>`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule as on_delete,
        rc.update_rule as on_update
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
        AND rc.constraint_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = ${schema}
      ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position
    `.execute(this.#db)

    // Group data by table
    const columnsByTable = this.#groupBy(columns.rows, 'table_name')
    const indexesByTable = this.#groupBy(indexes.rows, 'table_name')
    const foreignKeysByTable = this.#groupBy(foreignKeys.rows, 'table_name')

    return tables.rows.map((table) => ({
      name: table.table_name,
      isView: table.table_type === 'VIEW',
      schema,
      columns: (columnsByTable.get(table.table_name) ?? []).map(
        (col): ColumnMetadata => ({
          name: col.column_name,
          type: this.#mapColumnType(col),
          nullable: col.is_nullable === 'YES',
          defaultValue: col.column_default,
          isPrimaryKey: false, // Will be set from index metadata
          isAutoIncrement:
            col.is_identity === 'YES' || col.is_generated !== 'NEVER',
        }),
      ),
      indexes: this.#parseIndexes(indexesByTable.get(table.table_name) ?? []),
      foreignKeys: this.#parseForeignKeys(
        foreignKeysByTable.get(table.table_name) ?? [],
      ),
    }))
  }

  async getViewDefinition(viewName: string): Promise<string | null> {
    const result = await sql<{ view_definition: string }>`
      SELECT view_definition
      FROM information_schema.views
      WHERE table_name = ${viewName}
        AND table_schema = 'public'
    `.execute(this.#db)

    return result.rows[0]?.view_definition || null
  }

  #mapColumnType(col: RawColumnMetadata): string {
    // Handle array types
    if (col.data_type === 'ARRAY' && col.element_type) {
      // Map PostgreSQL element types to standard types
      const elementTypeMap: Record<string, string> = {
        'character varying': 'varchar',
        character: 'char',
        'timestamp without time zone': 'timestamp',
        'timestamp with time zone': 'timestamptz',
        'time without time zone': 'time',
        'time with time zone': 'timetz',
        'double precision': 'double precision',
      }

      const mappedElement = elementTypeMap[col.element_type] || col.element_type
      return `${mappedElement}[]`
    }

    // Handle special PostgreSQL types
    if (col.udt_name === 'tsvector') return 'tsvector'
    if (col.udt_name === 'tsquery') return 'tsquery'

    // Map common PostgreSQL types to standard names
    const typeMap: Record<string, string> = {
      'character varying': 'varchar',
      character: 'char',
      'timestamp without time zone': 'timestamp',
      'timestamp with time zone': 'timestamptz',
      'time without time zone': 'time',
      'time with time zone': 'timetz',
      'double precision': 'double precision',
    }

    return typeMap[col.data_type] || col.data_type
  }

  #groupBy<T, K extends keyof T>(items: T[], key: K): Map<T[K], T[]> {
    const map = new Map<T[K], T[]>()
    for (const item of items) {
      const group = map.get(item[key]) ?? []
      group.push(item)
      map.set(item[key], group)
    }
    return map
  }

  #parseIndexes(rawIndexes: RawIndexMetadata[]): IndexMetadata[] {
    const indexMap = new Map<string, IndexMetadata>()

    for (const rawIndex of rawIndexes) {
      const existing = indexMap.get(rawIndex.index_name)
      if (existing) {
        existing.columns.push(rawIndex.column_name)
      } else {
        indexMap.set(rawIndex.index_name, {
          name: rawIndex.index_name,
          columns: [rawIndex.column_name],
          unique: rawIndex.is_unique,
        })
      }
    }

    return Array.from(indexMap.values())
  }

  #parseForeignKeys(
    rawForeignKeys: RawForeignKeyMetadata[],
  ): ForeignKeyMetadata[] {
    // For now, only return the first foreign key constraint per table
    // PostgreSQL supports composite foreign keys, but the base interface doesn't
    const fkMap = new Map<string, ForeignKeyMetadata>()

    for (const rawFk of rawForeignKeys) {
      if (!fkMap.has(rawFk.constraint_name)) {
        const onDelete = this.#normalizeAction(rawFk.on_delete)
        const onUpdate = this.#normalizeAction(rawFk.on_update)

        fkMap.set(rawFk.constraint_name, {
          name: rawFk.constraint_name,
          column: rawFk.column_name,
          referencedTable: rawFk.foreign_table_name,
          referencedColumn: rawFk.foreign_column_name,
          onDelete,
          onUpdate,
        })
      }
    }

    return Array.from(fkMap.values())
  }

  #normalizeAction(
    action: string | null,
  ): 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION' | undefined {
    if (!action) return undefined

    const normalized = action.toUpperCase()
    if (
      normalized === 'CASCADE' ||
      normalized === 'SET NULL' ||
      normalized === 'RESTRICT' ||
      normalized === 'NO ACTION'
    ) {
      return normalized as 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'
    }

    return undefined
  }
}
