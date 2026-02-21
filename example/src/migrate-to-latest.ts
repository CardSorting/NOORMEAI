import { NOORMME, createSQLiteMigrationManager } from 'noormme'
import { config } from './config'

async function migrateToLatest() {
  // Initialize NOORMME with SQLite
  const db = new NOORMME({
    dialect: 'sqlite',
    connection: {
      database: config.database.database || './app.sqlite'
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

  try {
    // Initialize the database
    await db.initialize()

    // Create SQLite migration manager
    const migrationManager = await createSQLiteMigrationManager(db, {
      enableAutoOptimization: true,
      enableIndexRecommendations: true,
      enableConstraintValidation: true,
      enablePerformanceMonitoring: true,
      migrationDirectory: './migrations',
      backupBeforeMigration: true,
      dryRun: false
    })

    // Initialize migration system
    await migrationManager.initialize()

    // Plan migrations
    const plan = await migrationManager.planMigrations()
    console.log('📋 Migration Plan:')
    console.log(`- ${plan.migrations.length} migrations to apply`)
    console.log(`- ${plan.optimizations.length} optimizations to apply`)
    console.log(`- ${plan.indexRecommendations.length} index recommendations`)
    console.log(`- Estimated impact: ${plan.estimatedImpact}`)

    // Execute migrations
    const result = await migrationManager.executeMigrations()

    if (result.success) {
      console.log('✅ Migration completed successfully!')
      console.log(`- ${result.migrationsApplied} migrations applied`)
      console.log(`- ${result.optimizationsApplied.length} optimizations applied`)
      console.log(`- Duration: ${result.duration}ms`)
      console.log(`- Performance impact: ${result.performanceImpact}`)
      
      if (result.optimizationsApplied.length > 0) {
        console.log('\n🔧 Applied optimizations:')
        result.optimizationsApplied.forEach(opt => console.log(`  - ${opt}`))
      }
      
      if (result.indexRecommendations.length > 0) {
        console.log('\n📊 Index recommendations:')
        result.indexRecommendations.forEach(idx => console.log(`  - ${idx}`))
      }
      
      if (result.warnings.length > 0) {
        console.log('\n⚠️ Warnings:')
        result.warnings.forEach(warning => console.log(`  - ${warning}`))
      }
    } else {
      console.error('❌ Migration failed')
      if (result.warnings.length > 0) {
        result.warnings.forEach(warning => console.error(`  - ${warning}`))
      }
      process.exit(1)
    }

    // Get final status
    const status = await migrationManager.getStatus()
    console.log('\n📊 Migration Status:')
    console.log(`- Total migrations: ${status.totalMigrations}`)
    console.log(`- Applied migrations: ${status.appliedMigrations}`)
    console.log(`- Pending migrations: ${status.pendingMigrations}`)
    if (status.lastMigration) {
      console.log(`- Last migration: ${status.lastMigration}`)
      console.log(`- Last applied at: ${status.lastAppliedAt}`)
    }

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

migrateToLatest()
