/**
 * Data migration utilities
 */

import type { Kysely } from '../kysely.js'
import { sql } from '../raw-builder/sql.js'
import type {
  TableSchema,
  MigrationError,
  DataMigrationProgress,
  MigrationProgressCallback,
} from './migration-types.js'
import { getValueTransformation } from './type_mapper.js'

export interface DataMigrationOptions {
  batchSize: number
  parallel: boolean
  parallelWorkers: number
  continueOnError: boolean
  onProgress?: MigrationProgressCallback
  verbose?: boolean
}

export interface DataMigrationResult {
  tableName: string
  rowsMigrated: number
  duration: number
  errors: MigrationError[]
}

/**
 * Migrate data from one table to another
 */
export async function migrateTableData(
  sourceDb: Kysely<any>,
  targetDb: Kysely<any>,
  sourceTable: TableSchema,
  targetTable: TableSchema,
  sourceDialect: 'sqlite' | 'postgresql',
  targetDialect: 'sqlite' | 'postgresql',
  options: DataMigrationOptions,
): Promise<DataMigrationResult> {
  const startTime = Date.now()
  const errors: MigrationError[] = []
  let rowsMigrated = 0

  try {
    const totalRows = sourceTable.rowCount || 0

    if (totalRows === 0) {
      return {
        tableName: sourceTable.name,
        rowsMigrated: 0,
        duration: Date.now() - startTime,
        errors: [],
      }
    }

    // Keyset pagination optimization: find a primary key or a unique single-column index
    const pkColumn =
      sourceTable.columns.find((c) => c.primaryKey)?.name ||
      sourceTable.indexes.find((i) => i.unique && i.columns.length === 1)
        ?.columns[0]
    let lastId: any = null

    // Calculate number of batches (approximate)
    const batchCount = Math.ceil(totalRows / options.batchSize)

    for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
      try {
        let query = sourceDb
          .selectFrom(sourceTable.name)
          .selectAll()
          .limit(options.batchSize)

        if (pkColumn) {
          // Use keyset pagination (WHERE id > lastId) - O(log N)
          if (lastId !== null) {
            query = query.where(pkColumn, '>', lastId)
          }
          query = query.orderBy(pkColumn, 'asc')
        } else {
          // Fallback to offset pagination - O(N)
          query = query.offset(batchIndex * options.batchSize)
        }

        const rows = await query.execute()

        if (rows.length === 0) break

        // Update lastId for next iteration
        if (pkColumn) {
          lastId = rows[rows.length - 1][pkColumn]
        }

        const transformedRows = transformRows(
          rows,
          sourceTable,
          targetTable,
          sourceDialect,
          targetDialect,
        )

        await insertBatch(targetDb, targetTable.name, transformedRows)

        rowsMigrated += rows.length

        if (options.onProgress) {
          options.onProgress({
            table: sourceTable.name,
            current: rowsMigrated,
            total: totalRows,
            percentage: Math.min(100, (rowsMigrated / totalRows) * 100),
            estimatedTimeRemaining: calculateETA(
              startTime,
              rowsMigrated,
              totalRows,
            ),
          })
        }
      } catch (error) {
        errors.push({
          table: sourceTable.name,
          message: `Failed to migrate batch ${batchIndex + 1}/${batchCount}`,
          error: error as Error,
          fatal: false,
        })
        if (!options.continueOnError) break
      }
    }

    return {
      tableName: sourceTable.name,
      rowsMigrated,
      duration: Date.now() - startTime,
      errors,
    }
  } catch (error) {
    errors.push({
      table: sourceTable.name,
      message: 'Failed to migrate table data',
      error: error as Error,
      fatal: true,
    })

    return {
      tableName: sourceTable.name,
      rowsMigrated,
      duration: Date.now() - startTime,
      errors,
    }
  }
}

/**
 * Transform rows for target database
 */
function transformRows(
  rows: any[],
  sourceTable: TableSchema,
  targetTable: TableSchema,
  sourceDialect: 'sqlite' | 'postgresql',
  targetDialect: 'sqlite' | 'postgresql',
): any[] {
  // Build transformation map
  const transformations = new Map<string, (value: any) => any>()

  for (const sourceColumn of sourceTable.columns) {
    const targetColumn = targetTable.columns.find(
      (c) => c.name === sourceColumn.name,
    )

    if (targetColumn) {
      const transform = getValueTransformation(
        sourceColumn.type,
        targetColumn.type,
        sourceDialect,
        targetDialect,
      )

      if (transform) {
        transformations.set(sourceColumn.name, transform)
      }
    }
  }

  // Transform rows
  return rows.map((row) => {
    const transformedRow: any = {}

    for (const [columnName, value] of Object.entries(row)) {
      const transform = transformations.get(columnName)
      transformedRow[columnName] = transform ? transform(value) : value
    }

    return transformedRow
  })
}

/**
 * Insert batch of rows into target database
 */
async function insertBatch(
  db: Kysely<any>,
  tableName: string,
  rows: any[],
): Promise<void> {
  if (rows.length === 0) {
    return
  }

  // Use Kysely's batch insert
  await db.insertInto(tableName).values(rows).execute()
}

/**
 * Calculate estimated time remaining
 */
function calculateETA(
  startTime: number,
  completed: number,
  total: number,
): number {
  if (completed === 0) {
    return 0
  }

  const elapsed = Date.now() - startTime
  const rate = completed / elapsed
  const remaining = Math.max(0, total - completed)

  return remaining / rate
}

/**
 * Migrate data for all tables in parallel
 */
export async function migrateAllTablesData(
  sourceDb: Kysely<any>,
  targetDb: Kysely<any>,
  sourceTables: TableSchema[],
  targetTables: TableSchema[],
  sourceDialect: 'sqlite' | 'postgresql',
  targetDialect: 'sqlite' | 'postgresql',
  options: DataMigrationOptions,
): Promise<DataMigrationResult[]> {
  const targetTableMap = new Map(targetTables.map((t) => [t.name, t]))
  const results: DataMigrationResult[] = []

  // Filter tables that exist in both source and target
  const tablesToMigrate = sourceTables.filter((st) =>
    targetTableMap.has(st.name),
  )

  if (options.parallel && options.parallelWorkers > 1) {
    // Migrate tables in parallel batches
    const workerCount = Math.min(
      options.parallelWorkers,
      tablesToMigrate.length,
    )
    const chunks = chunkArray(tablesToMigrate, workerCount)

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map((sourceTable) => {
          const targetTable = targetTableMap.get(sourceTable.name)!
          return migrateTableData(
            sourceDb,
            targetDb,
            sourceTable,
            targetTable,
            sourceDialect,
            targetDialect,
            options,
          )
        }),
      )

      results.push(...chunkResults)
    }
  } else {
    // Migrate tables sequentially
    for (const sourceTable of tablesToMigrate) {
      const targetTable = targetTableMap.get(sourceTable.name)!
      const result = await migrateTableData(
        sourceDb,
        targetDb,
        sourceTable,
        targetTable,
        sourceDialect,
        targetDialect,
        options,
      )
      results.push(result)
    }
  }

  return results
}

/**
 * Verify data migration
 */
export async function verifyDataMigration(
  sourceDb: Kysely<any>,
  targetDb: Kysely<any>,
  tableName: string,
): Promise<{
  match: boolean
  sourceCount: number
  targetCount: number
  difference: number
}> {
  // Get row counts
  const sourceCountResult = await sql<{ count: any }>`
    SELECT COUNT(*) as count FROM ${sql.table(tableName)}
  `.execute(sourceDb)

  const targetCountResult = await sql<{ count: any }>`
    SELECT COUNT(*) as count FROM ${sql.table(tableName)}
  `.execute(targetDb)

  const sourceCount =
    typeof sourceCountResult.rows[0]?.count === 'string'
      ? parseInt(sourceCountResult.rows[0].count, 10)
      : sourceCountResult.rows[0]?.count || 0

  const targetCount =
    typeof targetCountResult.rows[0]?.count === 'string'
      ? parseInt(targetCountResult.rows[0].count, 10)
      : targetCountResult.rows[0]?.count || 0

  return {
    match: sourceCount === targetCount,
    sourceCount,
    targetCount,
    difference: Math.abs(sourceCount - targetCount),
  }
}

/**
 * Utility: chunk array into smaller arrays
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

/**
 * Truncate table (useful for re-migration)
 */
export async function truncateTable(
  db: Kysely<any>,
  tableName: string,
  dialect: 'sqlite' | 'postgresql',
): Promise<void> {
  if (dialect === 'postgresql') {
    await sql.raw(`TRUNCATE TABLE "${tableName}" CASCADE`).execute(db)
  } else {
    await sql.raw(`DELETE FROM "${tableName}"`).execute(db)
    // Reset autoincrement counter in SQLite
    await sql
      .raw(`DELETE FROM sqlite_sequence WHERE name = '${tableName}'`)
      .execute(db)
  }
}
