/**
 * Database Migration Example
 * 
 * This example demonstrates the migration tools for moving databases
 * between SQLite and PostgreSQL.
 */

import { NOORMME } from 'noormme'
import { 
  createMigrationManager,
  compareSchemas,
  type MigrationConfig,
} from 'noormme/helpers/postgresql'

/**
 * Example 1: Migrate from SQLite to PostgreSQL
 */
async function migrateSQLiteToPostgres() {
  console.log('📊 Example 1: SQLite to PostgreSQL Migration\n')
  
  // Initialize source database (SQLite)
  const sourceDb = new NOORMME({
    dialect: 'sqlite',
    connection: {
      database: './source.sqlite',
      host: '',
      port: 0,
      username: '',
      password: '',
    },
  })
  
  // Initialize target database (PostgreSQL)
  const targetDb = new NOORMME({
    dialect: 'postgresql',
    connection: {
      host: 'localhost',
      port: 5432,
      database: 'target_db',
      username: 'postgres',
      password: 'secret',
    },
  })
  
  try {
    // Initialize both databases
    await sourceDb.initialize()
    await targetDb.initialize()
    
    // Create migration configuration
    const config: MigrationConfig = {
      source: {
        dialect: 'sqlite',
        database: './source.sqlite',
      },
      target: {
        dialect: 'postgresql',
        database: 'target_db',
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'secret',
      },
      options: {
        batchSize: 1000,
        parallel: false,
        dropTables: false,
        continueOnError: false,
        verbose: true,
        excludeTables: ['kysely_migration', 'sqlite_migrations'],
      },
    }
    
    // Create migration manager
    const migrationManager = createMigrationManager(
      sourceDb.getKysely(),
      targetDb.getKysely(),
      config
    )
    
    // Perform migration
    const result = await migrationManager.migrate()
    
    if (result.success) {
      console.log('✅ Migration completed successfully!')
      console.log(`   Tables: ${result.tablesProcessed}`)
      console.log(`   Rows: ${result.rowsMigrated}`)
      console.log(`   Duration: ${(result.duration / 1000).toFixed(2)}s`)
      console.log(`   Schema changes: ${result.summary.schemaChanges}`)
      console.log(`   Indexes created: ${result.summary.indexesCreated}`)
    } else {
      console.error('❌ Migration failed!')
      console.error(`   Errors: ${result.errors.length}`)
      result.errors.forEach(err => {
        console.error(`   - ${err.message}`)
      })
    }
    
    if (result.warnings.length > 0) {
      console.log('\n⚠️  Warnings:')
      result.warnings.forEach(warning => {
        console.log(`   - ${warning}`)
      })
    }
    
  } catch (error) {
    console.error('Migration error:', error)
  } finally {
    await sourceDb.close()
    await targetDb.close()
  }
}

/**
 * Example 2: Compare schemas without migrating
 */
async function compareSchemaExample() {
  console.log('\n📊 Example 2: Schema Comparison\n')
  
  const sourceDb = new NOORMME('sqlite:./source.sqlite')
  const targetDb = new NOORMME('postgresql://postgres:secret@localhost:5432/target_db')
  
  try {
    await sourceDb.initialize()
    await targetDb.initialize()
    
    const config: MigrationConfig = {
      source: {
        dialect: 'sqlite',
        database: './source.sqlite',
      },
      target: {
        dialect: 'postgresql',
        database: 'target_db',
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'secret',
      },
    }
    
    const migrationManager = createMigrationManager(
      sourceDb.getKysely(),
      targetDb.getKysely(),
      config
    )
    
    // Compare schemas
    const comparison = await migrationManager.compareSchemas()
    
    console.log('Schema Comparison Results:')
    console.log(`   Compatible: ${comparison.compatible}`)
    console.log(`   Total differences: ${comparison.summary.totalDifferences}`)
    console.log(`   Tables added: ${comparison.summary.tablesAdded}`)
    console.log(`   Tables removed: ${comparison.summary.tablesRemoved}`)
    console.log(`   Tables modified: ${comparison.summary.tablesModified}`)
    
    if (comparison.differences.length > 0) {
      console.log('\nDifferences:')
      comparison.differences.forEach(diff => {
        console.log(`   ${diff.type}: ${diff.table}${diff.column ? `.${diff.column}` : ''}`)
        if (diff.details.message) {
          console.log(`      ${diff.details.message}`)
        }
      })
    }
    
  } catch (error) {
    console.error('Comparison error:', error)
  } finally {
    await sourceDb.close()
    await targetDb.close()
  }
}

/**
 * Example 3: Sync schemas (generate SQL only)
 */
async function syncSchemaExample() {
  console.log('\n🔄 Example 3: Schema Synchronization\n')
  
  const sourceDb = new NOORMME('sqlite:./source.sqlite')
  const targetDb = new NOORMME('postgresql://postgres:secret@localhost:5432/target_db')
  
  try {
    await sourceDb.initialize()
    await targetDb.initialize()
    
    const config: MigrationConfig = {
      source: {
        dialect: 'sqlite',
        database: './source.sqlite',
      },
      target: {
        dialect: 'postgresql',
        database: 'target_db',
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'secret',
      },
    }
    
    const migrationManager = createMigrationManager(
      sourceDb.getKysely(),
      targetDb.getKysely(),
      config
    )
    
    // Generate sync SQL (don't apply)
    const syncResult = await migrationManager.syncSchema({
      generateSQL: true,
      apply: false,
    })
    
    console.log(`Generated ${syncResult.sqlStatements.length} SQL statements:\n`)
    syncResult.sqlStatements.forEach((stmt, index) => {
      console.log(`${index + 1}. ${stmt}`)
    })
    
  } catch (error) {
    console.error('Sync error:', error)
  } finally {
    await sourceDb.close()
    await targetDb.close()
  }
}

/**
 * Example 4: Schema-only migration
 */
async function schemaOnlyMigration() {
  console.log('\n🔧 Example 4: Schema-Only Migration\n')
  
  const sourceDb = new NOORMME('sqlite:./source.sqlite')
  const targetDb = new NOORMME('postgresql://postgres:secret@localhost:5432/target_db')
  
  try {
    await sourceDb.initialize()
    await targetDb.initialize()
    
    const config: MigrationConfig = {
      source: {
        dialect: 'sqlite',
        database: './source.sqlite',
      },
      target: {
        dialect: 'postgresql',
        database: 'target_db',
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'secret',
      },
      options: {
        schemaOnly: true, // Only migrate schema, not data
        dropTables: true,
      },
    }
    
    const migrationManager = createMigrationManager(
      sourceDb.getKysely(),
      targetDb.getKysely(),
      config
    )
    
    const result = await migrationManager.migrate()
    
    console.log('Schema migration result:')
    console.log(`   Success: ${result.success}`)
    console.log(`   Schema changes: ${result.summary.schemaChanges}`)
    console.log(`   Indexes created: ${result.summary.indexesCreated}`)
    
  } catch (error) {
    console.error('Schema migration error:', error)
  } finally {
    await sourceDb.close()
    await targetDb.close()
  }
}

/**
 * Example 5: Selective table migration
 */
async function selectiveTableMigration() {
  console.log('\n📦 Example 5: Selective Table Migration\n')
  
  const sourceDb = new NOORMME('sqlite:./source.sqlite')
  const targetDb = new NOORMME('postgresql://postgres:secret@localhost:5432/target_db')
  
  try {
    await sourceDb.initialize()
    await targetDb.initialize()
    
    const config: MigrationConfig = {
      source: {
        dialect: 'sqlite',
        database: './source.sqlite',
      },
      target: {
        dialect: 'postgresql',
        database: 'target_db',
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'secret',
      },
      options: {
        // Only migrate specific tables
        includeTables: ['users', 'posts', 'comments'],
        batchSize: 500,
        verbose: true,
      },
    }
    
    const migrationManager = createMigrationManager(
      sourceDb.getKysely(),
      targetDb.getKysely(),
      config
    )
    
    const result = await migrationManager.migrate()
    
    console.log('Selective migration result:')
    console.log(`   Success: ${result.success}`)
    console.log(`   Tables: ${result.tablesProcessed}`)
    console.log(`   Rows: ${result.rowsMigrated}`)
    
  } catch (error) {
    console.error('Selective migration error:', error)
  } finally {
    await sourceDb.close()
    await targetDb.close()
  }
}

/**
 * Example 6: PostgreSQL to SQLite migration (reverse)
 */
async function migratePostgresToSQLite() {
  console.log('\n📊 Example 6: PostgreSQL to SQLite Migration\n')
  
  const sourceDb = new NOORMME('postgresql://postgres:secret@localhost:5432/source_db')
  const targetDb = new NOORMME('sqlite:./target.sqlite')
  
  try {
    await sourceDb.initialize()
    await targetDb.initialize()
    
    const config: MigrationConfig = {
      source: {
        dialect: 'postgresql',
        database: 'source_db',
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'secret',
      },
      target: {
        dialect: 'sqlite',
        database: './target.sqlite',
      },
      options: {
        batchSize: 1000,
        dropTables: true,
        verbose: true,
      },
    }
    
    const migrationManager = createMigrationManager(
      sourceDb.getKysely(),
      targetDb.getKysely(),
      config
    )
    
    const result = await migrationManager.migrate()
    
    console.log('Reverse migration result:')
    console.log(`   Success: ${result.success}`)
    console.log(`   Tables: ${result.tablesProcessed}`)
    console.log(`   Rows: ${result.rowsMigrated}`)
    
  } catch (error) {
    console.error('Reverse migration error:', error)
  } finally {
    await sourceDb.close()
    await targetDb.close()
  }
}

// Run examples
async function main() {
  const exampleToRun = process.argv[2] || '1'
  
  console.log('🚀 NOORMME Database Migration Examples\n')
  console.log('=' .repeat(60) + '\n')
  
  switch (exampleToRun) {
    case '1':
      await migrateSQLiteToPostgres()
      break
    case '2':
      await compareSchemaExample()
      break
    case '3':
      await syncSchemaExample()
      break
    case '4':
      await schemaOnlyMigration()
      break
    case '5':
      await selectiveTableMigration()
      break
    case '6':
      await migratePostgresToSQLite()
      break
    case 'all':
      await migrateSQLiteToPostgres()
      await compareSchemaExample()
      await syncSchemaExample()
      await schemaOnlyMigration()
      await selectiveTableMigration()
      await migratePostgresToSQLite()
      break
    default:
      console.log('Usage: node database-migration-example.js [1-6|all]')
      console.log('\nExamples:')
      console.log('  1: SQLite to PostgreSQL migration')
      console.log('  2: Schema comparison')
      console.log('  3: Schema synchronization')
      console.log('  4: Schema-only migration')
      console.log('  5: Selective table migration')
      console.log('  6: PostgreSQL to SQLite migration')
      console.log('  all: Run all examples')
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('🎉 Examples completed!')
}

main().catch(console.error)

