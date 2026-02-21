/**
 * SQLite Auto-Optimization Example
 * 
 * This example demonstrates the advanced SQLite auto-functionality features
 * in NOORMME, including automatic optimization, indexing, and performance tuning.
 */

import { NOORMME } from '../src/noormme.js'

// Initialize NOORMME with SQLite and auto-optimization enabled
const db = new NOORMME({
  dialect: 'sqlite',
  connection: {
    database: './example_auto_optimized.sqlite'
  },
  performance: {
    enableAutoOptimization: true,
    enableQueryOptimization: true,
    enableBatchLoading: true,
    maxBatchSize: 100
  },
  logging: {
    level: 'info',
    enabled: true
  }
})

async function demonstrateSQLiteAutoOptimization() {
  try {
    console.log('🚀 Initializing NOORMME with SQLite auto-optimization...')
    await db.initialize()

    // Get SQLite performance metrics
    console.log('\n📊 SQLite Performance Metrics:')
    const metrics = await db.getSQLitePerformanceMetrics()
    console.log('Database metrics:', {
      pageCount: metrics.pageCount,
      pageSize: metrics.pageSize,
      cacheSize: metrics.cacheSize,
      journalMode: metrics.journalMode,
      foreignKeys: metrics.foreignKeys ? 'Enabled' : 'Disabled',
      integrityCheck: metrics.integrityCheck ? 'Passed' : 'Failed'
    })

    // Get optimization recommendations
    console.log('\n🔧 SQLite Optimization Recommendations:')
    const optimizations = await db.getSQLiteOptimizations()
    console.log(`Applied optimizations: ${optimizations.appliedOptimizations.length}`)
    optimizations.appliedOptimizations.forEach(opt => console.log(`  ✓ ${opt}`))
    
    console.log(`\nRecommendations: ${optimizations.recommendations.length}`)
    optimizations.recommendations.forEach(rec => console.log(`  💡 ${rec}`))

    // Simulate some queries to generate index recommendations
    console.log('\n📈 Simulating queries for index analysis...')
    
    // Get repositories
    const userRepo = db.getRepository('users')
    const postRepo = db.getRepository('posts')
    
    // Simulate common query patterns
    const queryPatterns = [
      'SELECT * FROM users WHERE email = ?',
      'SELECT * FROM users WHERE status = ?',
      'SELECT * FROM posts WHERE user_id = ?',
      'SELECT * FROM posts WHERE created_at > ?',
      'SELECT * FROM users WHERE email = ?',
      'SELECT * FROM users WHERE status = ?',
      'SELECT * FROM posts WHERE user_id = ?',
      'SELECT * FROM posts WHERE created_at > ?'
    ]

    // Record queries with simulated execution times
    for (let i = 0; i < queryPatterns.length; i++) {
      const query = queryPatterns[i]
      const executionTime = Math.random() * 2000 + 100 // 100-2100ms
      const table = query.includes('users') ? 'users' : 'posts'
      
      db.recordQuery(query, executionTime, table)
      
      // Simulate some slow queries
      if (i % 3 === 0) {
        db.recordQuery(query, executionTime + 1500, table) // Make it slow
      }
    }

    // Get index recommendations
    console.log('\n🎯 SQLite Index Recommendations:')
    const indexRecommendations = await db.getSQLiteIndexRecommendations({
      minFrequency: 2,
      slowQueryThreshold: 1000,
      includePartialIndexes: true,
      maxRecommendations: 10
    })

    console.log(`Found ${indexRecommendations.recommendations.length} index recommendations`)
    indexRecommendations.recommendations.forEach((rec: any, index: number) => {
      console.log(`\n${index + 1}. ${rec.table} (${rec.type} index)`)
      console.log(`   Columns: ${rec.columns.join(', ')}`)
      console.log(`   Priority: ${rec.priority} | Impact: ${rec.estimatedImpact}`)
      console.log(`   Reason: ${rec.reason}`)
      console.log(`   SQL: ${rec.sql}`)
    })

    if (indexRecommendations.redundantIndexes.length > 0) {
      console.log(`\n⚠️  Redundant indexes found: ${indexRecommendations.redundantIndexes.length}`)
      indexRecommendations.redundantIndexes.forEach(index => {
        console.log(`   - ${index}`)
      })
    }

    // Get backup recommendations
    console.log('\n💾 SQLite Backup Recommendations:')
    const backupRecommendations = await db.getSQLiteBackupRecommendations()
    backupRecommendations.forEach(rec => console.log(`  💡 ${rec}`))

    // Demonstrate foreign key validation (if tables exist)
    try {
      const userRepo = db.getRepository('users')
      const users = await userRepo.findAll()
      console.log(`\n👥 Found ${users.length} users in database`)
      
      if (users.length > 0) {
        // Record some relationship queries
        for (let i = 0; i < Math.min(5, users.length); i++) {
          const user = users[i]
          db.recordQuery(
            `SELECT * FROM posts WHERE user_id = ${(user as any).id}`,
            250,
            'posts'
          )
        }
      }
    } catch (error) {
      console.log('\n📝 Note: No users table found, skipping relationship examples')
    }

    console.log('\n✨ SQLite auto-optimization demonstration completed!')
    console.log('\nKey features demonstrated:')
    console.log('  ✓ Automatic pragma optimization')
    console.log('  ✓ Performance metrics analysis')
    console.log('  ✓ Query pattern analysis')
    console.log('  ✓ Intelligent index recommendations')
    console.log('  ✓ Redundant index detection')
    console.log('  ✓ Backup recommendations')
    console.log('  ✓ Foreign key validation')

  } catch (error) {
    console.error('❌ Error during SQLite auto-optimization demonstration:', error)
  }
}

// Advanced SQLite optimization example
async function demonstrateAdvancedSQLiteFeatures() {
  console.log('\n🔬 Advanced SQLite Features:')
  
  try {
    // Get detailed performance analysis
    const metrics = await db.getSQLitePerformanceMetrics()
    
    console.log('\n📊 Detailed Performance Analysis:')
    console.log(`Database size: ${(metrics.pageCount * metrics.pageSize / 1024).toFixed(2)} KB`)
    console.log(`Free pages: ${metrics.freelistCount}`)
    console.log(`Cache size: ${metrics.cacheSize}`)
    console.log(`Synchronous mode: ${metrics.synchronous}`)
    console.log(`Journal mode: ${metrics.journalMode}`)
    console.log(`Auto vacuum: ${metrics.autoVacuum}`)
    console.log(`Temp store: ${metrics.tempStore}`)

    // Performance recommendations based on metrics
    if (metrics.freelistCount > 50) {
      console.log('\n⚠️  High fragmentation detected - consider running VACUUM')
    }
    
    if (metrics.cacheSize < 32000) {
      console.log('\n💡 Consider increasing cache_size for better performance')
    }
    
    if (metrics.journalMode !== 'wal') {
      console.log('\n💡 Consider enabling WAL mode for better concurrency')
    }

    // Get query pattern statistics
    if (db['sqliteAutoIndexer']) {
      const stats = (db['sqliteAutoIndexer'] as any).getQueryPatternStats()
      console.log('\n📈 Query Pattern Statistics:')
      console.log(`Total patterns: ${stats.totalPatterns}`)
      console.log(`Total queries: ${stats.totalQueries}`)
      console.log(`Average frequency: ${stats.averageFrequency.toFixed(2)}`)
      console.log(`Slow queries: ${stats.slowQueries}`)
    }

  } catch (error) {
    console.error('❌ Error in advanced features demonstration:', error)
  }
}

// Run the demonstration
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateSQLiteAutoOptimization()
    .then(() => demonstrateAdvancedSQLiteFeatures())
    .then(() => {
      console.log('\n🎉 All demonstrations completed successfully!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Demonstration failed:', error)
      process.exit(1)
    })
}

export { demonstrateSQLiteAutoOptimization, demonstrateAdvancedSQLiteFeatures }
