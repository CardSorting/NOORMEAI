import chalk from 'chalk'
import { NOORMME } from '../../noormme.js'
import { promises as fs } from 'fs'
import * as path from 'path'
import { NOORMConfig, SchemaInfo, TableInfo } from '../../types/index.js'
import { SQLiteMigrationManager } from '../../sqlite-migration/sqlite-migration-manager.js'

interface IndexRecommendation {
  table: string
  column: string
  reason: string
}

export async function status(options: {
  database?: string
  metrics?: boolean
  optimizations?: boolean
  cache?: boolean
}) {
  console.log(chalk.blue.bold('\n📊 NOORMME Status - Automation Dashboard\n'))

  try {
    // Initialize NOORMME with database path
    const databasePath = options.database || process.env.DATABASE_PATH || './database.sqlite'
    const db = new NOORMME({
      dialect: 'sqlite',
      connection: { 
        database: databasePath,
        host: 'localhost',
        port: 0,
        username: '',
        password: ''
      },
      performance: {
        enableQueryOptimization: true
      }
    })
    await db.initialize()

    console.log(chalk.gray(`📁 Database: ${databasePath}\n`))

    // Get schema information
    const schemaInfo = await db.getSchemaInfo()
    
    // Basic status
    console.log(chalk.green.bold('🏗️ Database Schema:'))
    console.log(chalk.gray(`  Tables: ${schemaInfo.tables.length}`))
    console.log(chalk.gray(`  Relationships: ${schemaInfo.relationships.length}`))
    console.log(chalk.gray(`  Total columns: ${schemaInfo.tables.reduce((sum, table) => sum + table.columns.length, 0)}`))
    console.log(chalk.gray(`  Total indexes: ${schemaInfo.tables.reduce((sum, table) => sum + table.indexes.length, 0)}`))
    console.log(chalk.gray(`  Total foreign keys: ${schemaInfo.tables.reduce((sum, table) => sum + table.foreignKeys.length, 0)}`))

    // Automation status
    console.log(chalk.blue.bold('\n🤖 Automation Status:'))
    const automationStatus = await getAutomationStatus(db)
    console.log(chalk.gray(`  Auto-optimization: ${automationStatus.autoOptimization ? '✅ Enabled' : '❌ Disabled'}`))
    console.log(chalk.gray(`  Query analysis: ${automationStatus.queryAnalysis ? '✅ Enabled' : '❌ Disabled'}`))
    console.log(chalk.gray(`  Auto-indexing: ${automationStatus.autoIndexing ? '✅ Enabled' : '❌ Disabled'}`))
    console.log(chalk.gray(`  Schema monitoring: ${automationStatus.schemaMonitoring ? '✅ Enabled' : '❌ Disabled'}`))

    // Performance metrics
    if (options.metrics !== false) {
      console.log(chalk.blue.bold('\n⚡ Performance Metrics:'))
      try {
        const metrics = await db.getSQLitePerformanceMetrics()
        
        // Calculate performance score
        let score = 0
        const scoreFactors: string[] = []
        
        if (metrics.cacheHitRate > 0.8) {
          score += 25
          scoreFactors.push('Good cache hit rate')
        }
        if (metrics.averageQueryTime < 100) {
          score += 25
          scoreFactors.push('Fast query execution')
        }
        if (metrics.walMode) {
          score += 25
          scoreFactors.push('WAL mode enabled')
        }
        if (metrics.foreignKeys) {
          score += 25
          scoreFactors.push('Foreign keys enabled')
        }

        const scoreColor = score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red'
        console.log(chalk[scoreColor](`  Overall Score: ${score}/100 ${score >= 80 ? '🟢' : score >= 60 ? '🟡' : '🔴'}`))
        
        console.log(chalk.gray(`  Cache hit rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`))
        console.log(chalk.gray(`  Average query time: ${metrics.averageQueryTime.toFixed(2)}ms`))
        console.log(chalk.gray(`  Total queries: ${metrics.totalQueries.toLocaleString()}`))
        console.log(chalk.gray(`  Slow queries: ${metrics.slowQueries}`))
        console.log(chalk.gray(`  Database size: ${(metrics.databaseSize / 1024 / 1024).toFixed(2)}MB`))
        console.log(chalk.gray(`  Page count: ${metrics.pageCount.toLocaleString()}`))
        console.log(chalk.gray(`  Free pages: ${metrics.freePages.toLocaleString()}`))

        if (scoreFactors.length > 0) {
          console.log(chalk.green(`\n  ✅ Performance factors:`))
          scoreFactors.forEach(factor => {
            console.log(chalk.gray(`    • ${factor}`))
          })
        }

      } catch (error) {
        console.error(chalk.red('❌ Failed to get performance metrics:'), error instanceof Error ? error.message : error)
      }
    }

    // Applied optimizations
    if (options.optimizations !== false) {
      console.log(chalk.blue.bold('\n🔧 Applied Optimizations:'))
      try {
        const optimizations = await db.getSQLiteOptimizations()
        
        if (optimizations.appliedOptimizations.length > 0) {
          console.log(chalk.green(`  ✅ ${optimizations.appliedOptimizations.length} optimizations applied:`))
          optimizations.appliedOptimizations.forEach((opt: string) => {
            console.log(chalk.gray(`    • ${opt}`))
          })
        } else {
          console.log(chalk.gray('  No optimizations applied yet'))
        }

        if (optimizations.warnings.length > 0) {
          console.log(chalk.yellow(`\n  ⚠️ ${optimizations.warnings.length} warnings:`))
          optimizations.warnings.forEach((warning: string) => {
            console.log(chalk.gray(`    • ${warning}`))
          })
        }

        // Show current PRAGMA settings
        console.log(chalk.blue('\n  📋 Current SQLite Settings:'))
        console.log(chalk.gray(`    WAL mode: ${optimizations.walMode ? 'Enabled' : 'Disabled'}`))
        console.log(chalk.gray(`    Foreign keys: ${optimizations.foreignKeys ? 'Enabled' : 'Disabled'}`))
        console.log(chalk.gray(`    Auto vacuum: ${optimizations.autoVacuum}`))
        console.log(chalk.gray(`    Journal mode: ${optimizations.journalMode}`))
        console.log(chalk.gray(`    Synchronous: ${optimizations.synchronous}`))
        console.log(chalk.gray(`    Cache size: ${optimizations.cacheSize} pages`))

      } catch (error) {
        console.error(chalk.red('❌ Failed to get optimization status:'), error instanceof Error ? error.message : error)
      }
    }

    // Cache statistics
    if (options.cache !== false) {
      console.log(chalk.blue.bold('\n💾 Cache Statistics:'))
      try {
        const cacheStats = db.getCacheStatistics()
        
        console.log(chalk.gray(`  Size: ${cacheStats.size} items`))
        console.log(chalk.gray(`  Hits: ${cacheStats.hits}`))
        console.log(chalk.gray(`  Misses: ${cacheStats.misses}`))
        console.log(chalk.gray(`  Hit Rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`))

      } catch (error) {
        console.error(chalk.red('❌ Failed to get cache statistics:'), error instanceof Error ? error.message : error)
      }
    }

    // Index recommendations
    console.log(chalk.blue.bold('\n💡 Index Recommendations:'))
    try {
      const indexRecs = await db.getSQLiteIndexRecommendations()
      
      if (indexRecs.recommendations.length > 0) {
        console.log(chalk.yellow(`  📊 ${indexRecs.recommendations.length} recommendations available:`))
      indexRecs.recommendations.slice(0, 5).forEach((rec: IndexRecommendation, index: number) => {
        console.log(chalk.gray(`    ${index + 1}. ${rec.table}.${rec.column} - ${rec.reason}`))
      })
        
        if (indexRecs.recommendations.length > 5) {
          console.log(chalk.gray(`    ... and ${indexRecs.recommendations.length - 5} more`))
        }
        
        console.log(chalk.blue('\n  💡 To apply recommendations:'))
        console.log(chalk.gray('    npx noormme optimize --indexes'))
      } else {
        console.log(chalk.green('  ✅ No index recommendations at this time'))
      }

    } catch (error) {
      console.error(chalk.red('❌ Failed to get index recommendations:'), error instanceof Error ? error.message : error)
    }

    // Migration status
    console.log(chalk.blue.bold('\n🔄 Migration Status:'))
    try {
      const migrationManager = SQLiteMigrationManager.getInstance(db.getKysely())
      await migrationManager.initialize()
      const migrationStatus = await migrationManager.getStatus()

      console.log(chalk.gray(`  Total migrations: ${migrationStatus.totalMigrations}`))
      console.log(chalk.gray(`  Applied: ${migrationStatus.appliedMigrations}`))
      console.log(chalk.gray(`  Pending: ${migrationStatus.pendingMigrations}`))
      
      if (migrationStatus.lastMigration) {
        console.log(chalk.gray(`  Last migration: ${migrationStatus.lastMigration}`))
        console.log(chalk.gray(`  Applied at: ${new Date(migrationStatus.lastAppliedAt!).toLocaleString()}`))
      } else {
        console.log(chalk.gray('  No migrations applied yet'))
      }

    } catch (error) {
      console.error(chalk.red('❌ Failed to get migration status:'), error instanceof Error ? error.message : error)
    }

    // File system status
    console.log(chalk.blue.bold('\n📁 File System Status:'))
    try {
      const dbStats = await fs.stat(databasePath)
      const generatedDir = path.join(process.cwd(), 'generated')
      const migrationsDir = path.join(process.cwd(), 'migrations')
      
      console.log(chalk.gray(`  Database file: ${(dbStats.size / 1024 / 1024).toFixed(2)}MB`))
      console.log(chalk.gray(`  Last modified: ${dbStats.mtime.toLocaleString()}`))
      
      // Check for generated files
      try {
        const generatedFiles = await fs.readdir(generatedDir)
        console.log(chalk.gray(`  Generated files: ${generatedFiles.length} files in ./generated/`))
      } catch {
        console.log(chalk.gray(`  Generated files: None (run 'npx noormme generate')`))
      }
      
      // Check for migrations
      try {
        const migrationFiles = await fs.readdir(migrationsDir)
        console.log(chalk.gray(`  Migration files: ${migrationFiles.length} files in ./migrations/`))
      } catch {
        console.log(chalk.gray(`  Migration files: None (run 'npx noormme migrate --generate')`))
      }

    } catch (error) {
      console.error(chalk.red('❌ Failed to get file system status:'), error instanceof Error ? error.message : error)
    }

    // Recommendations
    console.log(chalk.blue.bold('\n💡 Recommendations:'))
    const recommendations = await generateRecommendations(db, schemaInfo)
    if (recommendations.length > 0) {
      recommendations.forEach((rec, index) => {
        console.log(chalk.gray(`  ${index + 1}. ${rec}`))
      })
    } else {
      console.log(chalk.green('  ✅ Your database is well-optimized!'))
    }

    await db.close()

  } catch (error) {
    console.error(chalk.red('❌ Status check failed:'), error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

async function getAutomationStatus(db: NOORMME) {
  try {
    const config = (db as unknown as { config: NOORMConfig }).config
    return {
      autoOptimization: config.automation?.enableAutoOptimization ?? true,
      queryAnalysis: config.performance?.enableQueryOptimization ?? true,
      autoIndexing: config.automation?.enableIndexRecommendations ?? true,
      schemaMonitoring: config.automation?.enableSchemaWatcher ?? false
    }
  } catch {
    return {
      autoOptimization: true,
      queryAnalysis: true,
      autoIndexing: true,
      schemaMonitoring: false
    }
  }
}

async function generateRecommendations(db: NOORMME, schemaInfo: SchemaInfo): Promise<string[]> {
  const recommendations: string[] = []
  
  try {
    // Check performance metrics
    const metrics = await db.getSQLitePerformanceMetrics()
    
    if (metrics.cacheHitRate < 0.8) {
      recommendations.push('Consider increasing cache size - cache hit rate is low')
    }
    
    if (metrics.averageQueryTime > 100) {
      recommendations.push('Run optimization to improve query performance')
    }
    
    if (!metrics.walMode) {
      recommendations.push('Enable WAL mode for better concurrency')
    }
    
    if (!metrics.foreignKeys) {
      recommendations.push('Enable foreign key constraints for data integrity')
    }
    
    // Check for index recommendations
    const indexRecs = await db.getSQLiteIndexRecommendations()
    if (indexRecs.recommendations.length > 0) {
      recommendations.push(`Apply ${indexRecs.recommendations.length} index recommendations`)
    }
    
    // Check migration status
    try {
      const migrationManager = SQLiteMigrationManager.getInstance(db.getKysely())
      await migrationManager.initialize()
      const migrationStatus = await migrationManager.getStatus()
      
      if (migrationStatus.pendingMigrations > 0) {
        recommendations.push(`Apply ${migrationStatus.pendingMigrations} pending migrations`)
      }
    } catch {
      // Ignore migration errors in recommendations
    }
    
    // Check for tables without indexes
    const tablesWithoutIndexes = schemaInfo.tables.filter((table: TableInfo) => 
      table.indexes.length === 0 && table.columns.length > 1
    )
    if (tablesWithoutIndexes.length > 0) {
      recommendations.push(`Consider adding indexes to tables: ${tablesWithoutIndexes.map((t: TableInfo) => t.name).join(', ')}`)
    }
    
  } catch (error) {
    recommendations.push('Run full analysis to get detailed recommendations')
  }
  
  return recommendations
}
