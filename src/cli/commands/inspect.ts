import chalk from 'chalk'
import { NOORMME } from '../../noormme.js'
import { TableInfo, RelationshipInfo } from '../../types/index.js'
import { sanitizeDatabasePath, validateIdentifier } from '../../util/security-validator.js'

export async function inspect(tableName?: string, options: {
  database?: string
  relationships?: boolean
  optimizations?: boolean
  indexes?: boolean
  performance?: boolean
} = {}) {
  console.log(chalk.blue.bold('\n🔍 NOORMME Schema Inspection - Intelligent Database Discovery\n'))

  try {
    // SECURITY: Validate and sanitize database path to prevent path traversal attacks
    const databasePathInput = options.database || process.env.DATABASE_PATH || './database.sqlite'
    const databasePath = sanitizeDatabasePath(databasePathInput)

    const db = new NOORMME({
      dialect: 'sqlite',
      connection: {
        database: databasePath,
        host: 'localhost',
        port: 0,
        username: '',
        password: ''
      }
    })
    await db.initialize()

    console.log(chalk.gray(`📁 Database: ${databasePath}\n`))

    const schemaInfo = await db.getSchemaInfo()

    if (tableName) {
      // SECURITY: Validate table name to prevent SQL injection
      validateIdentifier(tableName, 'table name')

      // Show specific table with automation insights
      const table = schemaInfo.tables.find(t => t.name === tableName)
      if (!table) {
        console.error(chalk.red(`❌ Table '${tableName}' not found`))
        console.log(chalk.gray('Available tables:'))
        schemaInfo.tables.forEach(t => console.log(chalk.gray(`  - ${t.name}`)))
        process.exit(1)
      }

      const rowCount = await getTableRowCount(db, tableName)
      showTableDetails(table, schemaInfo.relationships, db, rowCount)

      // Show automation insights for the table
      if (options.optimizations) {
        await showTableOptimizations(table, db)
      }

      if (options.indexes) {
        await showTableIndexAnalysis(table, db)
      }

      if (options.performance) {
        await showTablePerformanceMetrics(table, db)
      }
    } else {
      // Show all tables with automation overview
      console.log(chalk.green(`📊 Discovered ${schemaInfo.tables.length} tables with complete automation:\n`))

      const rowCounts = new Map<string, number>()
      for (const table of schemaInfo.tables) {
        rowCounts.set(table.name, await getTableRowCount(db, table.name))
      }

      showTablesList(schemaInfo.tables, rowCounts)

      if (options.relationships) {
        console.log('\n' + chalk.blue.bold('🔗 Relationships:\n'))
        showRelationships(schemaInfo.relationships)
      }

      if (options.optimizations) {
        console.log('\n' + chalk.blue.bold('🔧 Optimization Overview:\n'))
        await showOptimizationOverview(db)
      }

      if (options.indexes) {
        console.log('\n' + chalk.blue.bold('📊 Index Analysis:\n'))
        await showIndexAnalysis(db)
      }

      if (options.performance) {
        console.log('\n' + chalk.blue.bold('⚡ Performance Metrics:\n'))
        await showPerformanceOverview(db)
      }

      // Show automation recommendations
      console.log('\n' + chalk.blue.bold('💡 Automation Recommendations:\n'))
      await showAutomationRecommendations(schemaInfo, db)
    }

    await db.close()

  } catch (error) {
    console.error(chalk.red('❌ Inspection failed:'), error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

async function getTableRowCount(db: NOORMME, tableName: string): Promise<number> {
  try {
    const introspector = (db.getKysely() as any).getExecutor().adapter.createIntrospector(db.getKysely())
    return await introspector.getRowCount(tableName)
  } catch {
    return 0
  }
}

function showTablesList(tables: TableInfo[], rowCounts: Map<string, number>): void {
  const tableData = tables.map(table => ({
    name: table.name,
    rows: rowCounts.get(table.name) ?? 0,
    columns: table.columns.length,
    primaryKey: table.primaryKey?.join(', ') || 'None',
    foreignKeys: table.foreignKeys.length,
    indexes: table.indexes.length
  }))

  // Simple table formatting
  console.log(chalk.gray('┌─' + '─'.repeat(20) + '┬─' + '─'.repeat(10) + '┬─' + '─'.repeat(8) + '┬─' + '─'.repeat(15) + '┬─' + '─'.repeat(5) + '┬─' + '─'.repeat(8) + '┐'))
  console.log(chalk.gray('│ ') + chalk.bold('Table Name'.padEnd(19)) + chalk.gray('│ ') + chalk.bold('Rows'.padEnd(9)) + chalk.gray('│ ') + chalk.bold('Cols'.padEnd(7)) + chalk.gray('│ ') + chalk.bold('Primary Key'.padEnd(14)) + chalk.gray('│ ') + chalk.bold('FKs'.padEnd(4)) + chalk.gray('│ ') + chalk.bold('Indexes'.padEnd(7)) + chalk.gray('│'))
  console.log(chalk.gray('├─' + '─'.repeat(20) + '┼─' + '─'.repeat(10) + '┼─' + '─'.repeat(8) + '┼─' + '─'.repeat(15) + '┼─' + '─'.repeat(5) + '┼─' + '─'.repeat(8) + '┤'))

  tableData.forEach(table => {
    console.log(
      chalk.gray('│ ') + chalk.cyan(table.name.padEnd(19)) +
      chalk.gray('│ ') + String(table.rows.toLocaleString()).padEnd(9) +
      chalk.gray('│ ') + String(table.columns).padEnd(7) +
      chalk.gray('│ ') + table.primaryKey.padEnd(14) +
      chalk.gray('│ ') + String(table.foreignKeys).padEnd(4) +
      chalk.gray('│ ') + String(table.indexes).padEnd(7) +
      chalk.gray('│')
    )
  })

  console.log(chalk.gray('└─' + '─'.repeat(20) + '┴─' + '─'.repeat(10) + '┴─' + '─'.repeat(8) + '┴─' + '─'.repeat(15) + '┴─' + '─'.repeat(5) + '┴─' + '─'.repeat(8) + '┘'))
}

async function showTableOptimizations(table: TableInfo, db: NOORMME): Promise<void> {
  try {
    console.log(chalk.blue('\n🔧 Optimization Analysis for ' + table.name + ':'))

    // Check for missing indexes
    const indexRecs = await db.getSQLiteIndexRecommendations()
    const tableRecommendations = indexRecs.recommendations.filter((rec: any) => rec.table === table.name)

    if (tableRecommendations.length > 0) {
      console.log(chalk.yellow(`💡 ${tableRecommendations.length} optimization recommendations:`))
      tableRecommendations.forEach((rec: any, index: number) => {
        console.log(chalk.gray(`  ${index + 1}. ${rec.column}: ${rec.reason} (${rec.impact} impact)`))
      })
    } else {
      console.log(chalk.green('✅ No optimization recommendations for this table'))
    }

    // Check for foreign key constraints
    if (table.foreignKeys.length === 0 && table.columns.some(col => col.name.includes('_id'))) {
      console.log(chalk.yellow('💡 Consider adding foreign key constraints for data integrity'))
    }

  } catch (error) {
    console.error(chalk.red('❌ Failed to get optimization analysis:'), error instanceof Error ? error.message : error)
  }
}

async function showTableIndexAnalysis(table: TableInfo, db: NOORMME): Promise<void> {
  try {
    console.log(chalk.blue('\n📊 Index Analysis for ' + table.name + ':'))

    // Show current indexes
    if (table.indexes.length > 0) {
      console.log(chalk.green(`✅ ${table.indexes.length} indexes found:`))
      table.indexes.forEach((index, i) => {
        const type = index.unique ? 'UNIQUE' : 'INDEX'
        console.log(chalk.gray(`  ${i + 1}. ${index.name} (${type}): ${index.columns.join(', ')}`))
      })
    } else {
      console.log(chalk.yellow('⚠️ No indexes found - consider adding indexes for frequently queried columns'))
    }

    // Show index recommendations
    const indexRecs = await db.getSQLiteIndexRecommendations()
    const tableRecommendations = indexRecs.recommendations.filter((rec: any) => rec.table === table.name)

    if (tableRecommendations.length > 0) {
      console.log(chalk.blue(`\n💡 Index recommendations:`))
      tableRecommendations.forEach((rec: any, index: number) => {
        console.log(chalk.gray(`  ${index + 1}. CREATE INDEX idx_${rec.table}_${rec.column} ON ${rec.table}(${rec.column});`))
        console.log(chalk.gray(`     Reason: ${rec.reason}`))
      })
    }

  } catch (error) {
    console.error(chalk.red('❌ Failed to get index analysis:'), error instanceof Error ? error.message : error)
  }
}

async function showTablePerformanceMetrics(table: TableInfo, db: NOORMME): Promise<void> {
  try {
    console.log(chalk.blue('\n⚡ Performance Metrics for ' + table.name + ':'))

    // Get performance metrics
    const metrics = await db.getSQLitePerformanceMetrics()

    console.log(chalk.gray(`  Table size: ${table.columns.length} columns`))
    console.log(chalk.gray(`  Indexes: ${table.indexes.length}`))
    console.log(chalk.gray(`  Foreign keys: ${table.foreignKeys.length}`))
    console.log(chalk.gray(`  Cache hit rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`))

    // Performance score for this table
    let score = 0
    if (table.indexes.length > 0) score += 25
    if (table.foreignKeys.length > 0) score += 25
    if (table.primaryKey && table.primaryKey.length > 0) score += 25
    if (table.columns.length <= 20) score += 25 // Reasonable column count

    const scoreColor = score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red'
    console.log(chalk[scoreColor](`  Performance score: ${score}/100`))

  } catch (error) {
    console.error(chalk.red('❌ Failed to get performance metrics:'), error instanceof Error ? error.message : error)
  }
}

async function showOptimizationOverview(db: NOORMME): Promise<void> {
  try {
    const optimizations = await db.getSQLiteOptimizations()

    console.log(chalk.green(`✅ Applied optimizations: ${optimizations.appliedOptimizations.length}`))
    if (optimizations.appliedOptimizations.length > 0) {
      optimizations.appliedOptimizations.forEach((opt: string, index: number) => {
        console.log(chalk.gray(`  ${index + 1}. ${opt}`))
      })
    }

    if (optimizations.warnings.length > 0) {
      console.log(chalk.yellow(`\n⚠️ Warnings: ${optimizations.warnings.length}`))
      optimizations.warnings.forEach((warning: string, index: number) => {
        console.log(chalk.gray(`  ${index + 1}. ${warning}`))
      })
    }

  } catch (error) {
    console.error(chalk.red('❌ Failed to get optimization overview:'), error instanceof Error ? error.message : error)
  }
}

async function showIndexAnalysis(db: NOORMME): Promise<void> {
  try {
    const indexRecs = await db.getSQLiteIndexRecommendations()

    if (indexRecs.recommendations.length > 0) {
      console.log(chalk.yellow(`💡 ${indexRecs.recommendations.length} index recommendations available:`))
      indexRecs.recommendations.slice(0, 10).forEach((rec: any, index: number) => {
        console.log(chalk.gray(`  ${index + 1}. ${rec.table}.${rec.column} - ${rec.reason}`))
      })

      if (indexRecs.recommendations.length > 10) {
        console.log(chalk.gray(`  ... and ${indexRecs.recommendations.length - 10} more recommendations`))
      }
    } else {
      console.log(chalk.green('✅ No index recommendations at this time'))
    }

  } catch (error) {
    console.error(chalk.red('❌ Failed to get index analysis:'), error instanceof Error ? error.message : error)
  }
}

async function showPerformanceOverview(db: NOORMME): Promise<void> {
  try {
    const metrics = await db.getSQLitePerformanceMetrics()

    console.log(chalk.gray(`Cache hit rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`))
    console.log(chalk.gray(`Average query time: ${metrics.averageQueryTime.toFixed(2)}ms`))
    console.log(chalk.gray(`Database size: ${(metrics.databaseSize / 1024 / 1024).toFixed(2)}MB`))
    console.log(chalk.gray(`Page count: ${metrics.pageCount.toLocaleString()}`))
    console.log(chalk.gray(`WAL mode: ${metrics.walMode ? 'Enabled' : 'Disabled'}`))
    console.log(chalk.gray(`Foreign keys: ${metrics.foreignKeys ? 'Enabled' : 'Disabled'}`))

  } catch (error) {
    console.error(chalk.red('❌ Failed to get performance overview:'), error instanceof Error ? error.message : error)
  }
}

async function showAutomationRecommendations(schemaInfo: any, db: NOORMME): Promise<void> {
  try {
    const recommendations: string[] = []

    // Check for tables without indexes
    const tablesWithoutIndexes = schemaInfo.tables.filter((table: any) =>
      table.indexes.length === 0 && table.columns.length > 1
    )
    if (tablesWithoutIndexes.length > 0) {
      recommendations.push(`Consider adding indexes to tables: ${tablesWithoutIndexes.map((t: any) => t.name).join(', ')}`)
    }

    // Check for missing foreign keys
    const tablesWithIdColumns = schemaInfo.tables.filter((table: any) =>
      table.columns.some((col: any) => col.name.includes('_id')) && table.foreignKeys.length === 0
    )
    if (tablesWithIdColumns.length > 0) {
      recommendations.push(`Add foreign key constraints to tables: ${tablesWithIdColumns.map((t: any) => t.name).join(', ')}`)
    }

    // Check performance metrics
    const metrics = await db.getSQLitePerformanceMetrics()
    if (metrics.cacheHitRate < 0.8) {
      recommendations.push('Run optimization to improve cache hit rate')
    }
    if (metrics.averageQueryTime > 100) {
      recommendations.push('Apply performance optimizations for faster queries')
    }
    if (!metrics.walMode) {
      recommendations.push('Enable WAL mode for better concurrency')
    }

    // Check for index recommendations
    const indexRecs = await db.getSQLiteIndexRecommendations()
    if (indexRecs.recommendations.length > 0) {
      recommendations.push(`Apply ${indexRecs.recommendations.length} index recommendations`)
    }

    if (recommendations.length > 0) {
      recommendations.forEach((rec, index) => {
        console.log(chalk.gray(`  ${index + 1}. ${rec}`))
      })

      console.log(chalk.blue('\n💡 To apply recommendations:'))
      console.log(chalk.gray('• Run: npx noormme optimize'))
      console.log(chalk.gray('• Run: npx noormme analyze --report'))
      console.log(chalk.gray('• Use: npx noormme watch --auto-optimize'))
    } else {
      console.log(chalk.green('✅ Your database is well-optimized!'))
    }

  } catch (error) {
    console.error(chalk.red('❌ Failed to get automation recommendations:'), error instanceof Error ? error.message : error)
  }
}

function showTableDetails(table: TableInfo, relationships: RelationshipInfo[], db?: NOORMME, rowCount: number = 0): void {
  console.log(chalk.green.bold(`Table: ${table.name}`))
  if (table.schema) {
    console.log(chalk.gray(`Schema: ${table.schema}`))
  }
  console.log(chalk.gray(`Rows: ${rowCount.toLocaleString()}`))
  console.log()

  // Columns
  console.log(chalk.blue.bold('Columns:'))
  console.log(chalk.gray('┌─' + '─'.repeat(25) + '┬─' + '─'.repeat(15) + '┬─' + '─'.repeat(8) + '┬─' + '─'.repeat(10) + '┐'))
  console.log(chalk.gray('│ ') + chalk.bold('Name'.padEnd(24)) + chalk.gray('│ ') + chalk.bold('Type'.padEnd(14)) + chalk.gray('│ ') + chalk.bold('Nullable'.padEnd(7)) + chalk.gray('│ ') + chalk.bold('Default'.padEnd(9)) + chalk.gray('│'))
  console.log(chalk.gray('├─' + '─'.repeat(25) + '┼─' + '─'.repeat(15) + '┼─' + '─'.repeat(8) + '┼─' + '─'.repeat(10) + '┤'))

  table.columns.forEach(col => {
    const name = col.isPrimaryKey ? chalk.yellow(`${col.name} (PK)`) : col.name
    const nullable = col.nullable ? chalk.green('YES') : chalk.red('NO')
    const defaultValue = col.defaultValue ? String(col.defaultValue) : ''

    console.log(
      chalk.gray('│ ') + name.padEnd(24) +
      chalk.gray('│ ') + col.type.padEnd(14) +
      chalk.gray('│ ') + nullable.padEnd(7) +
      chalk.gray('│ ') + defaultValue.padEnd(9) +
      chalk.gray('│')
    )
  })

  console.log(chalk.gray('└─' + '─'.repeat(25) + '┴─' + '─'.repeat(15) + '┴─' + '─'.repeat(8) + '┴─' + '─'.repeat(10) + '┘'))

  // Primary Key
  if (table.primaryKey && table.primaryKey.length > 0) {
    console.log()
    console.log(chalk.blue.bold('Primary Key:'))
    console.log(chalk.gray(`  ${table.primaryKey.join(', ')}`))
  }

  // Foreign Keys
  if (table.foreignKeys.length > 0) {
    console.log()
    console.log(chalk.blue.bold('Foreign Keys:'))
    table.foreignKeys.forEach(fk => {
      console.log(chalk.gray(`  ${fk.column} → ${fk.referencedTable}.${fk.referencedColumn}`))
      if (fk.onDelete) console.log(chalk.gray(`    ON DELETE ${fk.onDelete}`))
      if (fk.onUpdate) console.log(chalk.gray(`    ON UPDATE ${fk.onUpdate}`))
    })
  }

  // Indexes
  if (table.indexes.length > 0) {
    console.log()
    console.log(chalk.blue.bold('Indexes:'))
    table.indexes.forEach(idx => {
      const type = idx.unique ? chalk.yellow('UNIQUE') : 'INDEX'
      console.log(chalk.gray(`  ${idx.name} (${type}): ${idx.columns.join(', ')}`))
    })
  }

  // Relationships for this table
  const tableRelationships = relationships.filter(r =>
    r.fromTable === table.name || r.toTable === table.name
  )

  if (tableRelationships.length > 0) {
    console.log()
    console.log(chalk.blue.bold('Relationships:'))
    tableRelationships.forEach(rel => {
      const direction = rel.fromTable === table.name ? '→' : '←'
      const otherTable = rel.fromTable === table.name ? rel.toTable : rel.fromTable
      const type = rel.type.toUpperCase().replace('-', ' ')

      console.log(chalk.gray(`  ${rel.name} (${type}) ${direction} ${otherTable}`))
    })
  }

  // Usage example
  console.log()
  console.log(chalk.blue.bold('Usage Example:'))
  console.log(chalk.gray('```typescript'))
  console.log(chalk.gray(`const ${table.name}Repo = db.getRepository('${table.name}')`))
  console.log(chalk.gray(`const records = await ${table.name}Repo.findAll()`))
  console.log(chalk.gray(`const record = await ${table.name}Repo.findById(1)`))

  if (tableRelationships.length > 0) {
    const relationshipNames = tableRelationships.map(r => `'${r.name}'`).join(', ')
    console.log(chalk.gray(`const withRelations = await ${table.name}Repo.findWithRelations(1, [${relationshipNames}])`))
  }

  console.log(chalk.gray('```'))
}

function showRelationships(relationships: RelationshipInfo[]): void {
  if (relationships.length === 0) {
    console.log(chalk.gray('No relationships found.'))
    return
  }

  relationships.forEach(rel => {
    const type = rel.type.toUpperCase().replace('-', ' ')
    console.log(chalk.cyan(`${rel.name} (${type})`))
    console.log(chalk.gray(`  ${rel.fromTable}.${rel.fromColumn} → ${rel.toTable}.${rel.toColumn}`))

    if (rel.throughTable) {
      console.log(chalk.gray(`  Through: ${rel.throughTable}`))
    }
    console.log()
  })
}