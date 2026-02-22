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
// Migration constants - moved from old migration system
const DEFAULT_MIGRATION_TABLE = 'kysely_migration'
const DEFAULT_MIGRATION_LOCK_TABLE = 'kysely_migration_lock'
import { sql } from '../../raw-builder/sql.js'
import { QueryCreator } from '../../query-creator.js'

interface SqliteSystemDatabase {
  // https://www.sqlite.org/schematab.html#alternative_names
  sqlite_master: SQliteMasterTable
}

// https://www.sqlite.org/interpretation_of_the_schema_table
interface SQliteMasterTable {
  name: string
  rootpage: number | null
  sql: string
  tbl_name: string
  type: 'index' | 'table' | 'trigger' | 'view'
}

// https://www.sqlite.org/pragma.html#pragma_table_info
interface PragmaTableInfo {
  cid: number
  dflt_value: unknown
  name: string
  notnull: 0 | 1
  pk: number
  type: string
}

export class SqliteIntrospector extends DatabaseIntrospector {
  readonly #db: Kysely<SqliteSystemDatabase>

  constructor(db: Kysely<any>) {
    super(db)
    this.#db = db
  }

  async getSchemas(): Promise<SchemaMetadata[]> {
    // Sqlite doesn't support schemas.
    return []
  }

  async getTables(
    options: DatabaseMetadataOptions = { withInternalKyselyTables: false },
  ): Promise<TableMetadata[]> {
    return await this.#getTableMetadata(options)
  }

  async getMetadata(
    options?: DatabaseMetadataOptions,
  ): Promise<DatabaseMetadata> {
    return {
      tables: await this.getTables(options),
    }
  }

  #tablesQuery(
    qb: QueryCreator<SqliteSystemDatabase> | Kysely<SqliteSystemDatabase>,
    options: DatabaseMetadataOptions,
  ) {
    let tablesQuery = qb
      .selectFrom('sqlite_master')
      .where('type', 'in', ['table', 'view'])
      .where('name', 'not like', 'sqlite_%')
      .select(['name', 'sql', 'type'])
      .orderBy('name')

    if (!options.withInternalKyselyTables) {
      tablesQuery = tablesQuery
        .where('name', '!=', DEFAULT_MIGRATION_TABLE)
        .where('name', '!=', DEFAULT_MIGRATION_LOCK_TABLE)
    }
    return tablesQuery
  }

  async #getTableMetadata(
    options: DatabaseMetadataOptions,
  ): Promise<TableMetadata[]> {
    const tablesResult = await this.#tablesQuery(this.#db, options).execute()

    // Get column metadata for each table separately since PRAGMA doesn't work in joins
    const columnsByTable: Record<string, PragmaTableInfo[]> = {}

    for (const table of tablesResult) {
      try {
        const columns =
          await sql`PRAGMA table_info(${sql.lit(table.name)})`.execute(this.#db)
        columnsByTable[table.name] = columns.rows as PragmaTableInfo[]
      } catch (error) {
        console.warn(`Failed to get columns for table ${table.name}:`, error)
        columnsByTable[table.name] = []
      }
    }

    return tablesResult.map(({ name, sql, type }) => {
      // Enhanced auto-increment detection
      const autoIncrementInfo = this.detectAutoIncrement(
        sql,
        columnsByTable[name] ?? [],
      )

      const columns = columnsByTable[name] ?? []

      return {
        name: name,
        isView: type === 'view',
        columns: columns.map((col) => ({
          name: col.name,
          type: col.type,
          nullable: !col.notnull,
          isAutoIncrement:
            autoIncrementInfo.isAutoIncrement &&
            col.name === autoIncrementInfo.columnName,
          defaultValue: col.dflt_value,
          isPrimaryKey: col.pk > 0,
        })),
        indexes: [],
        foreignKeys: [],
      }
    })
  }

  /**
   * Enhanced auto-increment detection for SQLite
   */
  private detectAutoIncrement(
    sql: string | undefined,
    columns: PragmaTableInfo[],
  ): {
    isAutoIncrement: boolean
    columnName: string | null
    type: 'autoincrement' | 'rowid' | 'none'
  } {
    if (!sql) {
      return { isAutoIncrement: false, columnName: null, type: 'none' }
    }

    // Method 1: Check for explicit AUTOINCREMENT keyword
    const autoIncrementMatch = sql.match(
      /(\w+)\s+INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/i,
    )
    if (autoIncrementMatch) {
      return {
        isAutoIncrement: true,
        columnName: autoIncrementMatch[1].replace(/["`]/g, ''),
        type: 'autoincrement',
      }
    }

    // Method 2: Check for INTEGER PRIMARY KEY (implicit auto-increment)
    const integerPkMatch = sql.match(/(\w+)\s+INTEGER\s+PRIMARY\s+KEY/i)
    if (integerPkMatch) {
      return {
        isAutoIncrement: true,
        columnName: integerPkMatch[1].replace(/["`]/g, ''),
        type: 'rowid',
      }
    }

    // Method 3: Check columns for INTEGER PRIMARY KEY
    const pkColumns = columns.filter((col: PragmaTableInfo) => col.pk > 0)
    if (pkColumns.length === 1) {
      const pkCol = pkColumns[0]
      if (pkCol.type.toLowerCase() === 'integer') {
        return {
          isAutoIncrement: true,
          columnName: pkCol.name,
          type: 'rowid',
        }
      }
    }

    // Method 4: Check for rowid usage (SQLite's implicit primary key)
    const hasExplicitPk = columns.some((col: PragmaTableInfo) => col.pk > 0)
    if (!hasExplicitPk) {
      return {
        isAutoIncrement: true,
        columnName: 'rowid',
        type: 'rowid',
      }
    }

    return { isAutoIncrement: false, columnName: null, type: 'none' }
  }

  /**
   * Extract unique constraints from SQL
   */
  private extractUniqueConstraints(sql: string | undefined): string[] {
    if (!sql) return []

    const constraints: string[] = []
    const uniqueMatches = sql.match(/UNIQUE\s*\(([^)]+)\)/gi)

    if (uniqueMatches) {
      for (const match of uniqueMatches) {
        const columnsMatch = match.match(/\(([^)]+)\)/)
        if (columnsMatch) {
          const columns = columnsMatch[1]
            .split(',')
            .map((col) => col.trim().replace(/["`]/g, ''))
          constraints.push(...columns)
        }
      }
    }

    return constraints
  }

  /**
   * Extract check constraints from SQL
   */
  private extractCheckConstraints(sql: string | undefined): string[] {
    if (!sql) return []

    const constraints: string[] = []
    const checkMatches = sql.match(/CHECK\s*\(([^)]+)\)/gi)

    if (checkMatches) {
      for (const match of checkMatches) {
        const conditionMatch = match.match(/\(([^)]+)\)/)
        if (conditionMatch) {
          constraints.push(conditionMatch[1])
        }
      }
    }

    return constraints
  }

  async getColumns(tableName: string): Promise<ColumnMetadata[]> {
    try {
      // SQLite - use raw SQL for PRAGMA table_info
      const result =
        await sql`PRAGMA table_info(${sql.lit(tableName)})`.execute(this.#db)
      const sqliteColumns = result.rows as any[]

      return sqliteColumns.map((col: any) => ({
        name: col.name,
        type: col.type,
        nullable: !col.notnull,
        defaultValue: col.dflt_value,
        isPrimaryKey: !!col.pk,
        isAutoIncrement: col.type.toLowerCase().includes('integer') && col.pk,
      }))
    } catch (error) {
      console.warn('SQLite column discovery failed:', error)
      return []
    }
  }

  async getIndexes(tableName: string): Promise<IndexMetadata[]> {
    try {
      // SQLite - use raw SQL for PRAGMA index_list
      const result =
        await sql`PRAGMA index_list(${sql.lit(tableName)})`.execute(this.#db)
      const sqliteIndexes = result.rows as any[]

      const indexes: IndexMetadata[] = []

      for (const idx of sqliteIndexes) {
        try {
          const infoResult =
            await sql`PRAGMA index_info(${sql.lit(idx.name)})`.execute(this.#db)
          const info = infoResult.rows as any[]

          indexes.push({
            name: idx.name,
            unique: !!idx.unique,
            columns: info
              .sort((a, b) => a.seqno - b.seqno)
              .map((c: any) => c.name),
          })
        } catch (e) {
          console.warn(`Failed to get info for index ${idx.name}`, e)
          indexes.push({
            name: idx.name,
            unique: !!idx.unique,
            columns: [],
          })
        }
      }

      return indexes
    } catch (error) {
      console.warn('SQLite index discovery failed:', error)
      return []
    }
  }

  async getForeignKeys(tableName: string): Promise<ForeignKeyMetadata[]> {
    try {
      // SQLite - use raw SQL for PRAGMA foreign_key_list
      const result =
        await sql`PRAGMA foreign_key_list(${sql.lit(tableName)})`.execute(
          this.#db,
        )
      const sqliteFks = result.rows as any[]

      return sqliteFks.map((fk: any) => ({
        name: `fk_${tableName}_${fk.from}`,
        column: fk.from,
        referencedTable: fk.table,
        referencedColumn: fk.to,
      }))
    } catch (error) {
      console.warn('SQLite foreign key discovery failed:', error)
      return []
    }
  }

  async getViewDefinition(viewName: string): Promise<string | null> {
    const result = await this.#db
      .selectFrom('sqlite_master')
      .select('sql')
      .where('name', '=', viewName)
      .where('type', '=', 'view')
      .executeTakeFirst()

    return result?.sql || null
  }
}
