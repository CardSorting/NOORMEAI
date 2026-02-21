import chalk from 'chalk'
import { NOORMME } from '../../noormme.js'

export async function analyze(options: {
  database?: string
  slowQueries?: boolean
  indexes?: boolean
  patterns?: boolean
  report?: boolean
}) {
  console.log(chalk.blue.bold('\n🔍 NOORMME Query Analysis - Intelligent Performance Insights\n'))

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

    const metrics = db.getPerformanceMetrics() as any // Cast to any to access extended props

    // Analyze query patterns
    if (options.patterns !== false) {
      console.log(chalk.blue('📊 Analyzing Query Patterns...'))
      try {
        console.log(chalk.green(`\n📈 Query Pattern Analysis:`))
        console.log(chalk.gray(`  Total queries executed: ${metrics.totalQueries || metrics.queryCount}`))
        console.log(chalk.gray(`  Average execution time: ${metrics.averageExecutionTime?.toFixed(2) || metrics.averageQueryTime.toFixed(2)}ms`))

        if (metrics.queryPatterns && metrics.queryPatterns.length > 0) {
          console.log(chalk.blue('\n  Top Query Patterns:'))
          metrics.queryPatterns.slice(0, 5).forEach((p: any, i: number) => {
            console.log(chalk.gray(`  ${i + 1}. [${p.frequency}x] ${p.pattern.substring(0, 80)}${p.pattern.length > 80 ? '...' : ''}`))
            console.log(chalk.gray(`     Avg time: ${p.averageTime.toFixed(2)}ms`))
          })
        } else {
          console.log(chalk.gray('  No significant query patterns detected yet.'))
        }

      } catch (error) {
        console.error(chalk.red('❌ Query pattern analysis failed:'), error instanceof Error ? error.message : error)
      }
    }

    // Analyze slow queries specifically
    if (options.slowQueries) {
      console.log(chalk.blue('\n🐌 Analyzing Slow Queries...'))
      try {
        if (metrics.topSlowQueries && metrics.topSlowQueries.length > 0) {
          console.log(chalk.yellow(`\n⚠️ Found ${metrics.slowQueries} slow queries:`))
          metrics.topSlowQueries.forEach((q: any, i: number) => {
            console.log(chalk.gray(`  ${i + 1}. ${q.query.substring(0, 100)}`))
            console.log(chalk.gray(`     Avg time: ${q.averageTime.toFixed(2)}ms | Count: ${q.count}`))
          })
        } else {
          console.log(chalk.green('  ✅ No slow queries detected.'))
        }
      } catch (error) {
        console.error(chalk.red('❌ Slow query analysis failed:'), error instanceof Error ? error.message : error)
      }
    }

    // Generate index recommendations
    if (options.indexes !== false) {
      console.log(chalk.blue('\n📊 Generating Index Recommendations...'))
      try {
        const indexRecs = await db.getSQLiteIndexRecommendations()
        
        if (indexRecs.recommendations.length > 0) {
          console.log(chalk.green(`\n💡 Index Recommendations:`))
          indexRecs.recommendations.forEach((rec: any, index: number) => {
            console.log(chalk.gray(`  ${index + 1}. Table: ${rec.table}`))
            console.log(chalk.gray(`     Column: ${rec.column}`))
            console.log(chalk.gray(`     Reason: ${rec.reason}`))
            console.log(chalk.gray(`     Impact: ${rec.impact}`))
            console.log(chalk.gray(`     SQL: CREATE INDEX idx_${rec.table}_${rec.column} ON ${rec.table}(${rec.column});`))
            console.log('')
          })
        } else {
          console.log(chalk.gray('No index recommendations at this time'))
        }
      } catch (error) {
        console.error(chalk.red('❌ Index recommendation analysis failed:'), error instanceof Error ? error.message : error)
      }
    }

    // Generate detailed performance report
    if (options.report) {
      console.log(chalk.blue('\n📋 Generating Detailed Performance Report...'))
      try {
        const sqliteMetrics = await db.getSQLitePerformanceMetrics()
        const schemaInfo = await db.getSchemaInfo()
        
        console.log(chalk.green.bold(`\n📊 Performance Report for ${databasePath}`))
        console.log(chalk.gray('=' .repeat(60)))
        
        console.log(chalk.blue('\n🗄️ Database Information:'))
        console.log(chalk.gray(`  Tables: ${schemaInfo.tables.length}`))
        console.log(chalk.gray(`  Relationships: ${schemaInfo.relationships.length}`))
        console.log(chalk.gray(`  Database size: ${(sqliteMetrics.databaseSize / 1024 / 1024).toFixed(2)}MB`))
        console.log(chalk.gray(`  Page count: ${sqliteMetrics.pageCount.toLocaleString()}`))
        console.log(chalk.gray(`  Free pages: ${sqliteMetrics.freePages.toLocaleString()}`))
        
        console.log(chalk.blue('\n⚡ Performance Metrics:'))
        console.log(chalk.gray(`  Cache hit rate: ${(sqliteMetrics.cacheHitRate * 100).toFixed(1)}%`))
        console.log(chalk.gray(`  Average query time: ${sqliteMetrics.averageQueryTime.toFixed(2)}ms`))
        console.log(chalk.gray(`  Total queries executed: ${sqliteMetrics.totalQueries}`))
        console.log(chalk.gray(`  Slow queries (>1000ms): ${sqliteMetrics.slowQueries}`))
        
        if (metrics.warningCount && Object.keys(metrics.warningCount).length > 0) {
          console.log(chalk.yellow('\n⚠️ Warnings:'))
          Object.entries(metrics.warningCount).forEach(([type, count]) => {
            console.log(chalk.gray(`  ${type}: ${count}`))
          })
        }
        
        console.log(chalk.blue('\n🔧 Optimization Status:'))
        console.log(chalk.gray(`  WAL mode: ${sqliteMetrics.walMode ? 'Enabled' : 'Disabled'}`))
        console.log(chalk.gray(`  Foreign keys: ${sqliteMetrics.foreignKeys ? 'Enabled' : 'Disabled'}`))
        console.log(chalk.gray(`  Auto vacuum: ${sqliteMetrics.autoVacuum}`))
        console.log(chalk.gray(`  Journal mode: ${sqliteMetrics.journalMode}`))
        console.log(chalk.gray(`  Synchronous: ${sqliteMetrics.synchronous}`))
        
        // Performance score
        let score = 0
        if (sqliteMetrics.cacheHitRate > 0.8) score += 25
        if (sqliteMetrics.averageQueryTime < 100) score += 25
        if (sqliteMetrics.walMode) score += 25
        if (sqliteMetrics.foreignKeys) score += 25
        
        const scoreColor = score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red'
        console.log(chalk.blue('\n🎯 Overall Performance Score:'))
        console.log(chalk[scoreColor](`  ${score}/100 ${score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Needs Improvement'}`))
        
      } catch (error) {
        console.error(chalk.red('❌ Performance report generation failed:'), error instanceof Error ? error.message : error)
      }
    }

    // Recommendations
    console.log(chalk.blue('\n💡 Recommendations:'))
    console.log(chalk.gray('• Run "npx noormme optimize" to apply performance optimizations'))
    console.log(chalk.gray('• Use "npx noormme watch" for continuous monitoring'))
    console.log(chalk.gray('• Check "npx noormme status" regularly to track improvements'))
    console.log(chalk.gray('• Consider adding indexes for frequently queried columns'))

    await db.close()

  } catch (error) {
    console.error(chalk.red('❌ Analysis failed:'), error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
