/**
 * Schema introspection for migration tools
 */

import type { Kysely } from '../kysely.js'
import { sql } from '../raw-builder/sql.js'
import type { TableSchema, ColumnSchema, IndexSchema, ForeignKeySchema, ConstraintSchema } from './migration-types.js'

/**
 * Introspect schema from a SQLite database
 */
export async function introspectSQLiteSchema(db: Kysely<any>): Promise<TableSchema[]> {
  const tables: TableSchema[] = []

  // Get all tables
  const tableRows = await sql<{ name: string }>`
    SELECT name 
    FROM sqlite_master 
    WHERE type = 'table' 
      AND name NOT LIKE 'sqlite_%'
      AND name NOT IN ('kysely_migration', 'kysely_migration_lock', 'sqlite_migrations')
    ORDER BY name
  `.execute(db)

  for (const tableRow of tableRows.rows) {
    const tableName = tableRow.name

    // Get table info
    const columns = await introspectSQLiteColumns(db, tableName)
    const indexes = await introspectSQLiteIndexes(db, tableName)
    const foreignKeys = await introspectSQLiteForeignKeys(db, tableName)
    const constraints = await introspectSQLiteConstraints(db, tableName)

    // Get row count
    const countResult = await sql<{ count: number }>`
      SELECT COUNT(*) as count FROM ${sql.table(tableName)}
    `.execute(db)
    const rowCount = countResult.rows[0]?.count || 0

    // Get primary key
    const primaryKey = columns
      .filter(col => col.primaryKey)
      .map(col => col.name)

    tables.push({
      name: tableName,
      columns,
      primaryKey: primaryKey.length > 0 ? primaryKey : undefined,
      indexes,
      foreignKeys,
      constraints,
      rowCount,
    })
  }

  return tables
}

async function introspectSQLiteColumns(db: Kysely<any>, tableName: string): Promise<ColumnSchema[]> {
  const result = await (db as any).executeQuery({
    sql: `PRAGMA table_info(${tableName})`,
    parameters: [],
    query: { kind: 'SelectQueryNode' } as any,
  })

  return result.rows.map((row: any) => ({
    name: row.name,
    type: row.type || 'TEXT',
    nullable: row.notnull === 0,
    defaultValue: row.dflt_value,
    primaryKey: row.pk === 1,
    autoIncrement: row.type?.toUpperCase() === 'INTEGER' && row.pk === 1,
    unique: false, // Will be determined from indexes
  }))
}

async function introspectSQLiteIndexes(db: Kysely<any>, tableName: string): Promise<IndexSchema[]> {
  const indexRows = await sql<{ name: string }>`
    SELECT name 
    FROM sqlite_master 
    WHERE type = 'index' 
      AND tbl_name = ${tableName}
      AND name NOT LIKE 'sqlite_%'
  `.execute(db)

  const indexes: IndexSchema[] = []

  for (const indexRow of indexRows.rows) {
    const indexName = indexRow.name

    // Get index info
    const result = await (db as any).executeQuery({
      sql: `PRAGMA index_info(${indexName})`,
      parameters: [],
      query: { kind: 'SelectQueryNode' } as any,
    })

    // Get index creation SQL to check if unique
    const sqlResult = await sql<{ sql: string }>`
      SELECT sql 
      FROM sqlite_master 
      WHERE type = 'index' 
        AND name = ${indexName}
    `.execute(db)

    const indexSQL = sqlResult.rows[0]?.sql || ''
    const unique = indexSQL.toUpperCase().includes('UNIQUE')

    const columns = result.rows
      .sort((a: any, b: any) => a.seqno - b.seqno)
      .map((row: any) => row.name)

    indexes.push({
      name: indexName,
      tableName,
      columns,
      unique,
    })
  }

  return indexes
}

async function introspectSQLiteForeignKeys(db: Kysely<any>, tableName: string): Promise<ForeignKeySchema[]> {
  const result = await (db as any).executeQuery({
    sql: `PRAGMA foreign_key_list(${tableName})`,
    parameters: [],
    query: { kind: 'SelectQueryNode' } as any,
  })

  // Group by id (foreign key constraint id)
  const fkMap = new Map<number, any[]>()
  for (const row of result.rows) {
    if (!fkMap.has(row.id)) {
      fkMap.set(row.id, [])
    }
    fkMap.get(row.id)!.push(row)
  }

  const foreignKeys: ForeignKeySchema[] = []

  for (const rows of fkMap.values()) {
    const first = rows[0]
    foreignKeys.push({
      columns: rows.map(r => r.from),
      referencedTable: first.table,
      referencedColumns: rows.map(r => r.to),
      onDelete: first.on_delete,
      onUpdate: first.on_update,
    })
  }

  return foreignKeys
}

async function introspectSQLiteConstraints(db: Kysely<any>, tableName: string): Promise<ConstraintSchema[]> {
  // Get CREATE TABLE statement
  const result = await sql<{ sql: string }>`
    SELECT sql 
    FROM sqlite_master 
    WHERE type = 'table' 
      AND name = ${tableName}
  `.execute(db)

  const createSQL = result.rows[0]?.sql || ''
  const constraints: ConstraintSchema[] = []

  // Parse CHECK constraints
  const checkMatches = createSQL.matchAll(/CHECK\s*\(([^)]+)\)/gi)
  for (const match of checkMatches) {
    constraints.push({
      type: 'CHECK',
      expression: match[1],
    })
  }

  return constraints
}

/**
 * Introspect schema from a PostgreSQL database
 */
export async function introspectPostgreSQLSchema(db: Kysely<any>): Promise<TableSchema[]> {
  const tables: TableSchema[] = []

  // Get all tables
  const tableRows = await sql<{ table_name: string }>`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('kysely_migration', 'kysely_migration_lock', 'sqlite_migrations')
    ORDER BY table_name
  `.execute(db)

  for (const tableRow of tableRows.rows) {
    const tableName = tableRow.table_name

    // Get table info
    const columns = await introspectPostgreSQLColumns(db, tableName)
    const indexes = await introspectPostgreSQLIndexes(db, tableName)
    const foreignKeys = await introspectPostgreSQLForeignKeys(db, tableName)
    const constraints = await introspectPostgreSQLConstraints(db, tableName)

    // Get row count
    const countResult = await sql<{ count: string }>`
      SELECT COUNT(*) as count FROM ${sql.table(tableName)}
    `.execute(db)
    const rowCount = parseInt(countResult.rows[0]?.count || '0', 10)

    // Get primary key
    const primaryKey = columns
      .filter(col => col.primaryKey)
      .map(col => col.name)

    tables.push({
      name: tableName,
      columns,
      primaryKey: primaryKey.length > 0 ? primaryKey : undefined,
      indexes,
      foreignKeys,
      constraints,
      rowCount,
    })
  }

  return tables
}

async function introspectPostgreSQLColumns(db: Kysely<any>, tableName: string): Promise<ColumnSchema[]> {
  const result = await sql<any>`
    SELECT 
      c.column_name,
      c.data_type,
      c.udt_name,
      c.is_nullable,
      c.column_default,
      c.character_maximum_length,
      c.numeric_precision,
      c.numeric_scale,
      COALESCE(e.data_type, '') as element_type,
      (
        SELECT COUNT(*) > 0
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = ${tableName}
          AND kcu.column_name = c.column_name
      ) as is_primary_key
    FROM information_schema.columns c
    LEFT JOIN information_schema.element_types e
      ON c.table_catalog = e.object_catalog
      AND c.table_schema = e.object_schema
      AND c.table_name = e.object_name
      AND c.dtd_identifier = e.collection_type_identifier
    WHERE c.table_schema = 'public' 
      AND c.table_name = ${tableName}
    ORDER BY c.ordinal_position
  `.execute(db)

  return result.rows.map((row: any) => {
    let type = row.data_type

    // Handle array types
    if (type === 'ARRAY' && row.element_type) {
      type = `${row.element_type}[]`
    } else if (type === 'USER-DEFINED') {
      type = row.udt_name
    }

    // Add length/precision for applicable types
    if (row.character_maximum_length) {
      type = `${type}(${row.character_maximum_length})`
    } else if (row.numeric_precision && row.numeric_scale) {
      type = `${type}(${row.numeric_precision},${row.numeric_scale})`
    } else if (row.numeric_precision) {
      type = `${type}(${row.numeric_precision})`
    }

    return {
      name: row.column_name,
      type,
      nullable: row.is_nullable === 'YES',
      defaultValue: row.column_default,
      primaryKey: row.is_primary_key,
      autoIncrement: row.column_default?.includes('nextval'),
      unique: false, // Will be determined from indexes
    }
  })
}

async function introspectPostgreSQLIndexes(db: Kysely<any>, tableName: string): Promise<IndexSchema[]> {
  const result = await sql<any>`
    SELECT
      i.relname as index_name,
      ix.indisunique as is_unique,
      ARRAY_AGG(a.attname ORDER BY a.attnum) as columns,
      pg_get_expr(ix.indpred, ix.indrelid) as partial_index
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    WHERE t.relname = ${tableName}
      AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND i.relname NOT LIKE '%_pkey'
    GROUP BY i.relname, ix.indisunique, ix.indpred, ix.indrelid
  `.execute(db)

  return result.rows.map((row: any) => ({
    name: row.index_name,
    tableName,
    columns: row.columns,
    unique: row.is_unique,
    partial: row.partial_index || undefined,
  }))
}

async function introspectPostgreSQLForeignKeys(db: Kysely<any>, tableName: string): Promise<ForeignKeySchema[]> {
  const result = await sql<any>`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.update_rule,
      rc.delete_rule
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
      AND tc.table_schema = 'public'
      AND tc.table_name = ${tableName}
    ORDER BY tc.constraint_name, kcu.ordinal_position
  `.execute(db)

  // Group by constraint name
  const fkMap = new Map<string, any[]>()
  for (const row of result.rows) {
    if (!fkMap.has(row.constraint_name)) {
      fkMap.set(row.constraint_name, [])
    }
    fkMap.get(row.constraint_name)!.push(row)
  }

  const foreignKeys: ForeignKeySchema[] = []

  for (const [constraintName, rows] of fkMap.entries()) {
    const first = rows[0]
    foreignKeys.push({
      name: constraintName,
      columns: rows.map(r => r.column_name),
      referencedTable: first.foreign_table_name,
      referencedColumns: rows.map(r => r.foreign_column_name),
      onDelete: first.delete_rule?.toUpperCase(),
      onUpdate: first.update_rule?.toUpperCase(),
    })
  }

  return foreignKeys
}

async function introspectPostgreSQLConstraints(db: Kysely<any>, tableName: string): Promise<ConstraintSchema[]> {
  const result = await sql<any>`
    SELECT
      con.conname as constraint_name,
      con.contype as constraint_type,
      pg_get_constraintdef(con.oid) as constraint_definition
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = ${tableName}
      AND con.contype IN ('c', 'u', 'p')
    ORDER BY con.conname
  `.execute(db)

  const constraints: ConstraintSchema[] = []

  for (const row of result.rows) {
    let type: ConstraintSchema['type']

    switch (row.constraint_type) {
      case 'c':
        type = 'CHECK'
        break
      case 'u':
        type = 'UNIQUE'
        break
      case 'p':
        type = 'PRIMARY_KEY'
        break
      default:
        continue
    }

    constraints.push({
      name: row.constraint_name,
      type,
      expression: row.constraint_definition,
    })
  }

  return constraints
}

