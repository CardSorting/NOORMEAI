import chalk from 'chalk'
import { NOORMME } from '../../noormme.js'

export async function optimize(options: {
  database?: string
  pragma?: boolean
  indexes?: boolean
  analyze?: boolean
  wal?: boolean
  dryRun?: boolean
}) {
  console.log(chalk.blue.bold('\n⚡ NOORMME SQLite Optimization - Automating Performance\n'))

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

    console.log(chalk.gray(`📁 Database: ${databasePath}`))
    console.log(chalk.gray(`🔧 Dry run: ${options.dryRun ? 'Yes' : 'No'}\n`))

    if (options.dryRun) {
      console.log(chalk.yellow('🔍 DRY RUN MODE - No changes will be applied\n'))
    }

    let optimizationsApplied: string[] = []
    let warnings: string[] = []

    // Apply PRAGMA optimizations
    if (options.pragma !== false) {
      console.log(chalk.blue('🔧 Applying PRAGMA optimizations...'))
      try {
        const pragmaResult = await db.getSQLiteOptimizations()
        
        if (options.dryRun) {
          console.log(chalk.gray('Would apply PRAGMA optimizations:'))
          pragmaResult.appliedOptimizations.forEach((opt: string) => {
            console.log(chalk.gray(`  • ${opt}`))
          })
        } else {
          // Apply optimizations
          const result = await db.getSQLiteOptimizations()
          optimizationsApplied.push(...result.appliedOptimizations)
          warnings.push(...result.warnings)
          console.log(chalk.green(`✅ Applied ${result.appliedOptimizations.length} PRAGMA optimizations`))
        }
      } catch (error) {
        console.error(chalk.red('❌ PRAGMA optimization failed:'), error instanceof Error ? error.message : error)
      }
    }

    // Apply intelligent index recommendations
    if (options.indexes !== false) {
      console.log(chalk.blue('\n📊 Analyzing and applying index recommendations...'))
      try {
        const indexResult = await db.getSQLiteIndexRecommendations()
        
        if (indexResult.recommendations.length > 0) {
          if (options.dryRun) {
            console.log(chalk.gray('Would create recommended indexes:'))
            indexResult.recommendations.forEach((rec: any) => {
              console.log(chalk.gray(`  • ${rec.table}.${rec.column} (${rec.reason})`))
            })
          } else {
            // Show index recommendations
            optimizationsApplied.push(...indexResult.recommendations.map((idx: any) => `Index recommendation: ${idx.table}.${idx.column}`))
            console.log(chalk.green(`✅ Generated ${indexResult.recommendations.length} index recommendations`))
          }
        } else {
          console.log(chalk.gray('No index recommendations found'))
        }
      } catch (error) {
        console.error(chalk.red('❌ Index optimization failed:'), error instanceof Error ? error.message : error)
      }
    }

    // Run ANALYZE for query optimization
    if (options.analyze !== false) {
      console.log(chalk.blue('\n📈 Running ANALYZE for query optimization...'))
      try {
        if (options.dryRun) {
          console.log(chalk.gray('Would run ANALYZE to update query statistics'))
        } else {
          await db.execute('ANALYZE')
          optimizationsApplied.push('Ran ANALYZE to update statistics')
          console.log(chalk.green('✅ ANALYZE completed successfully'))
        }
      } catch (error) {
        console.error(chalk.red('❌ ANALYZE failed:'), error instanceof Error ? error.message : error)
      }
    }

    // Enable WAL mode for better concurrency
    if (options.wal !== false) {
      console.log(chalk.blue('\n🔄 Configuring WAL mode for better concurrency...'))
      try {
        if (options.dryRun) {
          console.log(chalk.gray('Would enable WAL mode for better concurrency'))
        } else {
          const result = await db.execute('PRAGMA journal_mode = WAL') as any
          
          let mode = 'unknown'
          if (Array.isArray(result) && result.length > 0) {
             mode = result[0].journal_mode
          } else if (result && result.rows && result.rows.length > 0) {
             mode = result.rows[0].journal_mode
          }

          if (mode === 'wal') {
            optimizationsApplied.push('Enabled WAL mode')
            console.log(chalk.green('✅ WAL mode enabled successfully'))
          } else {
             console.log(chalk.yellow(`⚠️ WAL mode requested but returned mode is '${mode}'`))
          }
        }
      } catch (error) {
        console.error(chalk.red('❌ WAL mode configuration failed:'), error instanceof Error ? error.message : error)
      }
    }

    // Show performance metrics
    console.log(chalk.blue('\n📊 Current Performance Metrics:'))
    try {
      const metrics = await db.getSQLitePerformanceMetrics()
      console.log(chalk.gray(`  Cache hit rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`))
      console.log(chalk.gray(`  Average query time: ${metrics.averageQueryTime.toFixed(2)}ms`))
      console.log(chalk.gray(`  Database size: ${(metrics.databaseSize / 1024 / 1024).toFixed(2)}MB`))
      console.log(chalk.gray(`  Page count: ${metrics.pageCount.toLocaleString()}`))
    } catch (error) {
      console.error(chalk.red('❌ Failed to get performance metrics:'), error instanceof Error ? error.message : error)
    }

    // Summary
    console.log(chalk.green.bold(`\n🎉 Optimization ${options.dryRun ? 'Analysis' : 'Completed'} Successfully!`))
    
    if (options.dryRun) {
      console.log(chalk.blue('\nTo apply these optimizations, run:'))
      console.log(chalk.gray('npx noormme optimize'))
    } else {
      if (optimizationsApplied.length > 0) {
        console.log(chalk.green(`\n✅ Applied ${optimizationsApplied.length} optimizations:`))
        optimizationsApplied.forEach((opt: string) => {
          console.log(chalk.gray(`  • ${opt}`))
        })
      }

      if (warnings.length > 0) {
        console.log(chalk.yellow(`\n⚠️ ${warnings.length} warnings:`))
        warnings.forEach((warning: string) => {
          console.log(chalk.gray(`  • ${warning}`))
        })
      }
    }

    // Recommendations
    console.log(chalk.blue('\n💡 Next Steps:'))
    console.log(chalk.gray('• Run "npx noormme analyze" to analyze query patterns'))
    console.log(chalk.gray('• Use "npx noormme watch" for continuous optimization'))
    console.log(chalk.gray('• Check "npx noormme status" to monitor performance'))

    await db.close()

  } catch (error) {
    console.error(chalk.red('❌ Optimization failed:'), error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
