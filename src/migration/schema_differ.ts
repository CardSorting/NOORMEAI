/**
 * Schema diff and synchronization tools
 */

import type { Kysely } from '../kysely.js'
import { sql } from '../raw-builder/sql.js'
import type { 
  TableSchema, 
  SchemaDifference, 
  SchemaComparisonResult,
  SyncOptions 
} from './migration-types.js'
import { mapType, areTypesCompatible } from './type_mapper.js'

/**
 * Compare two schemas and return differences
 */
export function compareSchemas(
  sourceSchema: TableSchema[],
  targetSchema: TableSchema[],
  sourceDialect: 'sqlite' | 'postgresql',
  targetDialect: 'sqlite' | 'postgresql'
): SchemaComparisonResult {
  const differences: SchemaDifference[] = []
  
  const sourceTableMap = new Map(sourceSchema.map(t => [t.name, t]))
  const targetTableMap = new Map(targetSchema.map(t => [t.name, t]))
  
  // Find added and modified tables
  for (const sourceTable of sourceSchema) {
    const targetTable = targetTableMap.get(sourceTable.name)
    
    if (!targetTable) {
      // Table exists in source but not in target
      differences.push({
        type: 'table_added',
        table: sourceTable.name,
        details: {
          source: sourceTable,
          message: `Table '${sourceTable.name}' needs to be created`,
        },
      })
    } else {
      // Compare columns
      const columnDiffs = compareColumns(
        sourceTable,
        targetTable,
        sourceDialect,
        targetDialect
      )
      differences.push(...columnDiffs)
      
      // Compare indexes
      const indexDiffs = compareIndexes(sourceTable, targetTable)
      differences.push(...indexDiffs)
      
      // Compare constraints
      const constraintDiffs = compareConstraints(sourceTable, targetTable)
      differences.push(...constraintDiffs)
    }
  }
  
  // Find removed tables
  for (const targetTable of targetSchema) {
    if (!sourceTableMap.has(targetTable.name)) {
      differences.push({
        type: 'table_removed',
        table: targetTable.name,
        details: {
          target: targetTable,
          message: `Table '${targetTable.name}' exists in target but not in source`,
        },
      })
    }
  }
  
  // Calculate summary
  const tablesAdded = differences.filter(d => d.type === 'table_added').length
  const tablesRemoved = differences.filter(d => d.type === 'table_removed').length
  const tablesModified = new Set(
    differences
      .filter(d => ['column_added', 'column_removed', 'column_modified', 'index_added', 'index_removed'].includes(d.type))
      .map(d => d.table)
  ).size
  
  return {
    differences,
    sourceSchema,
    targetSchema,
    compatible: differences.length === 0,
    summary: {
      tablesAdded,
      tablesRemoved,
      tablesModified,
      totalDifferences: differences.length,
    },
  }
}

function compareColumns(
  sourceTable: TableSchema,
  targetTable: TableSchema,
  sourceDialect: 'sqlite' | 'postgresql',
  targetDialect: 'sqlite' | 'postgresql'
): SchemaDifference[] {
  const differences: SchemaDifference[] = []
  
  const sourceColumnMap = new Map(sourceTable.columns.map(c => [c.name, c]))
  const targetColumnMap = new Map(targetTable.columns.map(c => [c.name, c]))
  
  // Check for added and modified columns
  for (const sourceColumn of sourceTable.columns) {
    const targetColumn = targetColumnMap.get(sourceColumn.name)
    
    if (!targetColumn) {
      differences.push({
        type: 'column_added',
        table: sourceTable.name,
        column: sourceColumn.name,
        details: {
          source: sourceColumn,
          message: `Column '${sourceColumn.name}' needs to be added`,
        },
      })
    } else {
      // Compare column properties
      const sourceType = sourceColumn.type
      const targetType = targetColumn.type
      
      const compatible = areTypesCompatible(sourceType, targetType, sourceDialect, targetDialect)
      
      if (!compatible) {
        differences.push({
          type: 'column_modified',
          table: sourceTable.name,
          column: sourceColumn.name,
          details: {
            source: sourceColumn,
            target: targetColumn,
            message: `Column '${sourceColumn.name}' type mismatch: source has '${sourceType}', target has '${targetType}'`,
          },
        })
      } else if (sourceColumn.nullable !== targetColumn.nullable) {
        differences.push({
          type: 'column_modified',
          table: sourceTable.name,
          column: sourceColumn.name,
          details: {
            source: sourceColumn,
            target: targetColumn,
            message: `Column '${sourceColumn.name}' nullability differs`,
          },
        })
      }
    }
  }
  
  // Check for removed columns
  for (const targetColumn of targetTable.columns) {
    if (!sourceColumnMap.has(targetColumn.name)) {
      differences.push({
        type: 'column_removed',
        table: sourceTable.name,
        column: targetColumn.name,
        details: {
          target: targetColumn,
          message: `Column '${targetColumn.name}' exists in target but not in source`,
        },
      })
    }
  }
  
  return differences
}

function compareIndexes(sourceTable: TableSchema, targetTable: TableSchema): SchemaDifference[] {
  const differences: SchemaDifference[] = []
  
  const sourceIndexMap = new Map(sourceTable.indexes.map(i => [i.name, i]))
  const targetIndexMap = new Map(targetTable.indexes.map(i => [i.name, i]))
  
  // Check for added indexes
  for (const sourceIndex of sourceTable.indexes) {
    const targetIndex = targetIndexMap.get(sourceIndex.name)
    
    if (!targetIndex) {
      differences.push({
        type: 'index_added',
        table: sourceTable.name,
        details: {
          source: sourceIndex,
          message: `Index '${sourceIndex.name}' needs to be created`,
        },
      })
    }
  }
  
  // Check for removed indexes
  for (const targetIndex of targetTable.indexes) {
    if (!sourceIndexMap.has(targetIndex.name)) {
      differences.push({
        type: 'index_removed',
        table: sourceTable.name,
        details: {
          target: targetIndex,
          message: `Index '${targetIndex.name}' exists in target but not in source`,
        },
      })
    }
  }
  
  return differences
}

function compareConstraints(sourceTable: TableSchema, targetTable: TableSchema): SchemaDifference[] {
  const differences: SchemaDifference[] = []
  
  // Simple comparison - just check counts for now
  if (sourceTable.constraints.length > targetTable.constraints.length) {
    differences.push({
      type: 'constraint_added',
      table: sourceTable.name,
      details: {
        message: `${sourceTable.constraints.length - targetTable.constraints.length} constraint(s) need to be added`,
      },
    })
  } else if (sourceTable.constraints.length < targetTable.constraints.length) {
    differences.push({
      type: 'constraint_removed',
      table: sourceTable.name,
      details: {
        message: `${targetTable.constraints.length - sourceTable.constraints.length} constraint(s) exist in target but not in source`,
      },
    })
  }
  
  return differences
}

/**
 * Generate SQL to synchronize target schema with source schema
 */
export function generateSyncSQL(
  comparison: SchemaComparisonResult,
  targetDialect: 'sqlite' | 'postgresql'
): string[] {
  const sqlStatements: string[] = []
  
  for (const diff of comparison.differences) {
    switch (diff.type) {
      case 'table_added':
        if (diff.details.source) {
          const createTableSQL = generateCreateTableSQL(
            diff.details.source as TableSchema,
            targetDialect
          )
          sqlStatements.push(createTableSQL)
        }
        break
        
      case 'column_added':
        if (diff.details.source && diff.column) {
          const addColumnSQL = generateAddColumnSQL(
            diff.table,
            diff.details.source,
            targetDialect
          )
          sqlStatements.push(addColumnSQL)
        }
        break
        
      case 'index_added':
        if (diff.details.source) {
          const createIndexSQL = generateCreateIndexSQL(
            diff.details.source,
            targetDialect
          )
          sqlStatements.push(createIndexSQL)
        }
        break
        
      // Note: Removing tables/columns is dangerous, so we don't auto-generate those
      case 'table_removed':
        sqlStatements.push(`-- WARNING: Table '${diff.table}' should be dropped (manual action required)`)
        break
        
      case 'column_removed':
        sqlStatements.push(`-- WARNING: Column '${diff.table}.${diff.column}' should be dropped (manual action required)`)
        break
    }
  }
  
  return sqlStatements
}

function generateCreateTableSQL(table: TableSchema, targetDialect: 'sqlite' | 'postgresql'): string {
  const columns = table.columns.map(col => {
    let colDef = `"${col.name}" ${col.type}`
    
    if (col.primaryKey) {
      colDef += ' PRIMARY KEY'
    }
    if (col.autoIncrement && targetDialect === 'sqlite') {
      colDef += ' AUTOINCREMENT'
    }
    if (!col.nullable) {
      colDef += ' NOT NULL'
    }
    if (col.unique && !col.primaryKey) {
      colDef += ' UNIQUE'
    }
    if (col.defaultValue !== null && col.defaultValue !== undefined) {
      colDef += ` DEFAULT ${col.defaultValue}`
    }
    
    return colDef
  }).join(',\n  ')
  
  let sql = `CREATE TABLE "${table.name}" (\n  ${columns}`
  
  // Add foreign keys
  if (table.foreignKeys.length > 0) {
    for (const fk of table.foreignKeys) {
      const fkCols = fk.columns.map(c => `"${c}"`).join(', ')
      const refCols = fk.referencedColumns.map(c => `"${c}"`).join(', ')
      sql += `,\n  FOREIGN KEY (${fkCols}) REFERENCES "${fk.referencedTable}" (${refCols})`
      
      if (fk.onDelete) {
        sql += ` ON DELETE ${fk.onDelete}`
      }
      if (fk.onUpdate) {
        sql += ` ON UPDATE ${fk.onUpdate}`
      }
    }
  }
  
  sql += '\n);'
  
  return sql
}

function generateAddColumnSQL(tableName: string, column: any, targetDialect: 'sqlite' | 'postgresql'): string {
  let sql = `ALTER TABLE "${tableName}" ADD COLUMN "${column.name}" ${column.type}`
  
  if (!column.nullable) {
    sql += ' NOT NULL'
  }
  if (column.defaultValue !== null && column.defaultValue !== undefined) {
    sql += ` DEFAULT ${column.defaultValue}`
  }
  
  return sql + ';'
}

function generateCreateIndexSQL(index: any, targetDialect: 'sqlite' | 'postgresql'): string {
  const unique = index.unique ? 'UNIQUE ' : ''
  const columns = index.columns.map((c: string) => `"${c}"`).join(', ')
  
  return `CREATE ${unique}INDEX "${index.name}" ON "${index.tableName}" (${columns});`
}

/**
 * Apply schema synchronization to target database
 */
export async function applySchemaSyncronization(
  targetDb: Kysely<any>,
  sqlStatements: string[],
  options: SyncOptions = {}
): Promise<{
  success: boolean
  appliedStatements: number
  errors: Array<{ sql: string; error: Error }>
}> {
  const errors: Array<{ sql: string; error: Error }> = []
  let appliedStatements = 0
  
  if (options.apply === false) {
    return {
      success: true,
      appliedStatements: 0,
      errors: [],
    }
  }
  
  for (const sqlStatement of sqlStatements) {
    // Skip comments
    if (sqlStatement.trim().startsWith('--')) {
      continue
    }
    
    try {
      await sql.raw(sqlStatement).execute(targetDb)
      appliedStatements++
    } catch (error) {
      errors.push({
        sql: sqlStatement,
        error: error as Error,
      })
      
      if (!options.force) {
        break
      }
    }
  }
  
  return {
    success: errors.length === 0,
    appliedStatements,
    errors,
  }
}

