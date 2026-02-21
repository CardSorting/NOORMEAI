/**
 * SQLite Migration Example
 * 
 * This example demonstrates the new SQLite-focused migration system
 * that integrates with NOORMME's auto-optimization features.
 */

import { NOORMME, createSQLiteMigrationManager, createSQLiteMigrationProvider } from 'noormme'

async function demonstrateSQLiteMigrations() {
  console.log('🚀 SQLite Migration System Demo\n')

  // Initialize NOORMME with SQLite
  const db = new NOORMME({
    dialect: 'sqlite',
    connection: {
      database: './demo_migration.sqlite'
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
    console.log('📊 Initializing database...')
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

    // Create migration provider
    const migrationProvider = await createSQLiteMigrationProvider({
      migrationDirectory: './migrations',
      fileExtensions: ['.sql', '.ts'],
      encoding: 'utf8'
    })

    // Initialize migration system
    console.log('🔧 Initializing migration system...')
    await migrationManager.initialize()

    // Discover available migrations
    console.log('🔍 Discovering migrations...')
    const migrations = await migrationProvider.discoverMigrations()
    console.log(`Found ${migrations.length} migration files:`)
    migrations.forEach(migration => {
      console.log(`  - ${migration.name} (${migration.timestamp.toISOString()})`)
    })

    // Validate migrations
    console.log('\n✅ Validating migrations...')
    migrations.forEach(migration => {
      const validation = migrationProvider.validateMigration(migration)
      if (validation.valid) {
        console.log(`  ✓ ${migration.name} - Valid`)
      } else {
        console.log(`  ✗ ${migration.name} - Invalid:`)
        validation.errors.forEach(error => console.log(`    - ${error}`))
      }
    })

    // Plan migrations
    console.log('\n📋 Planning migrations...')
    const plan = await migrationManager.planMigrations()
    console.log('Migration Plan:')
    console.log(`  - Migrations to apply: ${plan.migrations.length}`)
    console.log(`  - Optimizations to apply: ${plan.optimizations.length}`)
    console.log(`  - Index recommendations: ${plan.indexRecommendations.length}`)
    console.log(`  - Estimated impact: ${plan.estimatedImpact}`)
    console.log(`  - Dry run: ${plan.dryRun}`)

    if (plan.migrations.length > 0) {
      console.log('\n📝 Pending migrations:')
      plan.migrations.forEach(migration => console.log(`  - ${migration}`))
    }

    if (plan.optimizations.length > 0) {
      console.log('\n🔧 Pending optimizations:')
      plan.optimizations.forEach(optimization => console.log(`  - ${optimization}`))
    }

    if (plan.indexRecommendations.length > 0) {
      console.log('\n📊 Index recommendations:')
      plan.indexRecommendations.forEach(index => console.log(`  - ${index}`))
    }

    // Execute migrations
    console.log('\n🔄 Executing migrations...')
    const result = await migrationManager.executeMigrations()

    if (result.success) {
      console.log('✅ Migration completed successfully!')
      console.log(`  - Migrations applied: ${result.migrationsApplied}`)
      console.log(`  - Optimizations applied: ${result.optimizationsApplied.length}`)
      console.log(`  - Index recommendations: ${result.indexRecommendations.length}`)
      console.log(`  - Duration: ${result.duration}ms`)
      console.log(`  - Performance impact: ${result.performanceImpact}`)
      
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
    }

    // Get final status
    const status = await migrationManager.getStatus()
    console.log('\n📊 Final Migration Status:')
    console.log(`  - Total migrations: ${status.totalMigrations}`)
    console.log(`  - Applied migrations: ${status.appliedMigrations}`)
    console.log(`  - Pending migrations: ${status.pendingMigrations}`)
    if (status.lastMigration) {
      console.log(`  - Last migration: ${status.lastMigration}`)
      console.log(`  - Last applied at: ${status.lastAppliedAt}`)
    }

    // Demonstrate performance monitoring
    console.log('\n📈 Performance Monitoring:')
    
    // Record some sample queries
    migrationManager.recordQuery('SELECT * FROM users WHERE email = ?', 150, 'users')
    migrationManager.recordQuery('SELECT * FROM posts WHERE user_id = ?', 200, 'posts')
    migrationManager.recordQuery('SELECT * FROM users WHERE status = ?', 180, 'users')
    migrationManager.recordQuery('SELECT * FROM posts WHERE published = ?', 120, 'posts')
    
    console.log('Recorded sample queries for analysis')

    // Get performance metrics
    const metrics = await migrationManager.getPerformanceMetrics()
    console.log('Performance metrics:')
    console.log(`  - Database size: ${metrics.databaseSize || 'N/A'}`)
    console.log(`  - Cache size: ${metrics.cacheSize || 'N/A'}`)
    console.log(`  - Journal mode: ${metrics.journalMode || 'N/A'}`)
    console.log(`  - Foreign keys: ${metrics.foreignKeys ? 'Enabled' : 'Disabled'}`)

    // Get index recommendations
    const indexRecs = await migrationManager.getIndexRecommendations()
    console.log('\n📊 Index Analysis:')
    console.log(`  - Total recommendations: ${indexRecs.recommendations?.length || 0}`)
    console.log(`  - Performance impact: ${indexRecs.performanceImpact || 'N/A'}`)
    console.log(`  - Summary: ${indexRecs.summary || 'N/A'}`)

    // Get optimization recommendations
    const optRecs = await migrationManager.getOptimizationRecommendations()
    console.log('\n🔧 Optimization Recommendations:')
    console.log(`  - Total recommendations: ${optRecs.recommendations?.length || 0}`)
    if (optRecs.recommendations && optRecs.recommendations.length > 0) {
      optRecs.recommendations.forEach(rec => console.log(`  - ${rec}`))
    }

    console.log('\n🎉 SQLite Migration Demo completed successfully!')

  } catch (error) {
    console.error('❌ Demo failed:', error)
  }
}

async function demonstrateMigrationProvider() {
  console.log('\n🔧 Migration Provider Demo\n')

  const migrationProvider = await createSQLiteMigrationProvider({
    migrationDirectory: './migrations',
    fileExtensions: ['.sql', '.ts'],
    encoding: 'utf8'
  })

  // Generate optimized migration content
  console.log('📝 Generating optimized migration content...')
  
  const createTableMigration = migrationProvider.generateOptimizedMigration(
    'create_table',
    'users',
    {
      columns: [
        { name: 'id', type: 'integer', primaryKey: true, autoIncrement: true },
        { name: 'email', type: 'text', notNull: true, unique: true },
        { name: 'name', type: 'text', notNull: true },
        { name: 'created_at', type: 'datetime', defaultValue: 'CURRENT_TIMESTAMP' }
      ],
      indexes: [
        { columns: ['email'] },
        { columns: ['created_at'] }
      ],
      constraints: [
        'CHECK (email LIKE "%@%")'
      ]
    }
  )

  console.log('Generated CREATE TABLE migration:')
  console.log(createTableMigration)

  const addColumnMigration = migrationProvider.generateOptimizedMigration(
    'add_column',
    'users',
    {
      column: {
        name: 'status',
        type: 'text',
        notNull: true,
        defaultValue: 'active',
        index: true
      }
    }
  )

  console.log('\nGenerated ADD COLUMN migration:')
  console.log(addColumnMigration)

  const addIndexMigration = migrationProvider.generateOptimizedMigration(
    'add_index',
    'users',
    {
      index: {
        columns: ['status', 'created_at']
      }
    }
  )

  console.log('\nGenerated ADD INDEX migration:')
  console.log(addIndexMigration)
}

// Run the demos
async function main() {
  await demonstrateSQLiteMigrations()
  await demonstrateMigrationProvider()
}

main().catch(console.error)
