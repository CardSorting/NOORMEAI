/**
 * Comprehensive integration tests for migration system
 */

import { describe, it, before, after } from 'mocha'
import { expect } from 'chai'
import { withTestDatabase, performanceHelper } from '../setup/test-helpers.js'
import { getEnabledDatabases } from '../setup/test-config.js'
import { createNodeMigrationManager } from '../../src/migration/node-migration-manager.js'
import { NOORMME } from '../../src/noormme.js'

describe('Migration System Integration', () => {
  const enabledDatabases = getEnabledDatabases()
  
  if (enabledDatabases.length === 0) {
    console.warn('No databases enabled for testing')
    return
  }

  describe('Migration Manager Integration', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should integrate with NOORMME instance', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Create migration manager
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations',
            migrationTimeout: 30000,
            maxConcurrentMigrations: 3
          })
          
          // Initialize migration system
          await migrationManager.initialize()
          
          // Get status
          const status = await migrationManager.getStatus()
          expect(status).to.exist
          expect(status).to.have.property('totalFiles')
          expect(status).to.have.property('appliedMigrations')
          expect(status).to.have.property('pendingMigrations')
          
          // Check if up to date
          const isUpToDate = await migrationManager.isUpToDate()
          expect(isUpToDate).to.be.a('boolean')
          
          // Get pending count
          const pendingCount = await migrationManager.getPendingCount()
          expect(pendingCount).to.be.a('number')
          expect(pendingCount).to.be.at.least(0)
          
          // Clean up
          await migrationManager.cleanup()
        }))
        
        it('should handle migration execution', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Create migration manager
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          
          // Initialize migration system
          await migrationManager.initialize()
          
          // Execute migrations
          const result = await migrationManager.migrate()
          
          expect(result).to.exist
          expect(result).to.have.property('success')
          expect(result).to.have.property('executed')
          expect(result).to.have.property('failed')
          expect(result).to.have.property('duration')
          
          expect(result.success).to.be.a('boolean')
          expect(result.executed).to.be.a('number')
          expect(result.failed).to.be.a('number')
          expect(result.duration).to.be.a('number')
          expect(result.duration).to.be.at.least(0)
          
          // Clean up
          await migrationManager.cleanup()
        }))
        
        it('should create migration files', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Create migration manager
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          
          // Initialize migration system
          await migrationManager.initialize()
          
          // Create a test migration
          const migrationContent = `
            CREATE TABLE IF NOT EXISTS test_migration_table (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `
          
          const fileName = await migrationManager.createMigration('test_migration', migrationContent)
          
          expect(fileName).to.exist
          expect(fileName).to.be.a('string')
          expect(fileName).to.include('test_migration')
          
          // Clean up
          await migrationManager.cleanup()
        }))
        
        it('should handle configuration updates', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Create migration manager with initial config
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations',
            migrationTimeout: 30000,
            maxConcurrentMigrations: 3
          })
          
          // Get initial configuration
          const initialConfig = migrationManager.getConfig()
          expect(initialConfig.migrationTimeout).to.equal(30000)
          expect(initialConfig.maxConcurrentMigrations).to.equal(3)
          
          // Update configuration
          migrationManager.updateConfig({
            migrationTimeout: 60000,
            maxConcurrentMigrations: 5
          })
          
          // Get updated configuration
          const updatedConfig = migrationManager.getConfig()
          expect(updatedConfig.migrationTimeout).to.equal(60000)
          expect(updatedConfig.maxConcurrentMigrations).to.equal(5)
          
          // Clean up
          await migrationManager.cleanup()
        }))
        
        it('should provide component access', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Create migration manager
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          
          // Get components
          const components = migrationManager.getComponents()
          
          expect(components).to.exist
          expect(components).to.have.property('core')
          expect(components).to.have.property('resourceManager')
          expect(components).to.have.property('logger')
          
          // Clean up
          await migrationManager.cleanup()
        }))
      })
    }
  })
  
  describe('Migration with Database Operations', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should work with database operations after migration', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Create migration manager
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          
          // Initialize and run migrations
          await migrationManager.initialize()
          await migrationManager.migrate()
          
          // Test database operations after migration
          const userRepo = db.getRepository('users')
          
          // Create user
          const user = await userRepo.create({
            id: 'migration-user',
            email: 'migration@example.com',
            firstName: 'Migration',
            lastName: 'User',
            active: true
          })
          
          expect(user).to.exist
          expect((user as any).id).to.equal('migration-user')
          
          // Find user
          const foundUser = await userRepo.findById('migration-user')
          expect(foundUser).to.exist
          expect((foundUser as any)!.email).to.equal('migration@example.com')
          
          // Update user
          ;(foundUser as any)!.firstName = 'Updated'
          const updatedUser = await userRepo.update(foundUser!)
          expect((updatedUser as any).firstName).to.equal('Updated')
          
          // Delete user
          const deleted = await userRepo.delete('migration-user')
          expect(deleted).to.be.true
          
          // Clean up
          await migrationManager.cleanup()
        }))
        
        it('should handle relationships after migration', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Create migration manager
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          
          // Initialize and run migrations
          await migrationManager.initialize()
          await migrationManager.migrate()
          
          // Test relationship operations after migration
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Create user and post
          const user = await userRepo.create({
            id: 'rel-migration-user',
            email: 'relmigration@example.com',
            firstName: 'RelMigration',
            lastName: 'User',
            active: true
          })
          
          const post = await postRepo.create({
            id: 'rel-migration-post',
            userId: (user as any).id,
            title: 'Rel Migration Post',
            content: 'Rel Migration Content',
            published: true
          })
          
          // Load user with posts
          const userWithPosts = await userRepo.findWithRelations((user as any).id, ['posts'])
          
          expect(userWithPosts).to.exist
          expect((userWithPosts as any)!.posts).to.exist
          expect((userWithPosts as any)!.posts.length).to.equal(1)
          expect((userWithPosts as any)!.posts[0].id).to.equal('rel-migration-post')
          
          // Clean up
          await postRepo.delete('rel-migration-post')
          await userRepo.delete('rel-migration-user')
          await migrationManager.cleanup()
        }))
        
        it('should handle transactions after migration', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Create migration manager
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          
          // Initialize and run migrations
          await migrationManager.initialize()
          await migrationManager.migrate()
          
          // Test transaction operations after migration
          const userRepo = db.getRepository('users')
          
          // Execute transaction
          const result = await db.transaction(async (trx) => {
            const user = await trx
              .insertInto('users')
              .values({
                id: 'tx-migration-user',
                email: 'txmigration@example.com',
                firstName: 'TxMigration',
                lastName: 'User',
                active: true
              })
              .returningAll()
              .executeTakeFirstOrThrow()
            
            return user
          })
          
          expect(result).to.exist
          expect(result.id).to.equal('tx-migration-user')
          
          // Verify user exists
          const user = await userRepo.findById('tx-migration-user')
          expect(user).to.exist
          expect((user as any)!.email).to.equal('txmigration@example.com')
          
          // Clean up
          await userRepo.delete('tx-migration-user')
          await migrationManager.cleanup()
        }))
      })
    }
  })
  
  describe('Migration Performance', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should initialize migration system efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Create migration manager
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          
          // Test initialization performance
          const duration = await performanceHelper.measure('migration-initialization', async () => {
            await migrationManager.initialize()
          })
          
          // Should be efficient
          expect(duration).to.be.lessThan(5000) // 5 seconds max
          
          // Clean up
          await migrationManager.cleanup()
        }))
        
        it('should execute migrations efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Create migration manager
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          
          // Initialize migration system
          await migrationManager.initialize()
          
          // Test migration execution performance
          const duration = await performanceHelper.measure('migration-execution', async () => {
            const result = await migrationManager.migrate()
            return result
          })
          
          // Should be efficient
          expect(duration).to.be.lessThan(10000) // 10 seconds max
          
          // Clean up
          await migrationManager.cleanup()
        }))
        
        it('should get status efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Create migration manager
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          
          // Initialize migration system
          await migrationManager.initialize()
          
          // Test status retrieval performance
          const duration = await performanceHelper.measure('migration-status', async () => {
            const status = await migrationManager.getStatus()
            return status
          })
          
          // Should be very fast
          expect(duration).to.be.lessThan(1000) // 1 second max
          
          // Clean up
          await migrationManager.cleanup()
        }))
        
        it('should handle concurrent migration operations', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Create migration manager
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          
          // Initialize migration system
          await migrationManager.initialize()
          
          // Test concurrent operations
          const start = performance.now()
          const promises: Promise<any>[] = []
          
          // Concurrent status checks
          for (let i = 0; i < 10; i++) {
            promises.push(migrationManager.getStatus())
          }
          
          const results = await Promise.all(promises)
          const duration = performance.now() - start
          
          // Should be efficient
          expect(duration).to.be.lessThan(2000) // 2 seconds max
          expect(results.length).to.equal(10)
          
          // Clean up
          await migrationManager.cleanup()
        }))
      })
    }
  })
  
  describe('Migration Error Handling', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should handle invalid migration directory', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Create migration manager with invalid directory
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: '/invalid/path/that/does/not/exist'
          })
          
          try {
            await migrationManager.initialize()
          } catch (error) {
            // Expected error
            expect(error).to.be.instanceOf(Error)
          }
        }))
        
        it('should handle migration execution errors', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Create migration manager
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          
          try {
            await migrationManager.initialize()
            
            // Try to create migration with invalid SQL
            await migrationManager.createMigration('invalid_migration', 'INVALID SQL CONTENT')
          } catch (error) {
            // Expected error
            expect(error).to.be.instanceOf(Error)
          }
        }))
        
        it('should handle database connection errors', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Create migration manager
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          
          // Initialize migration system
          await migrationManager.initialize()
          
          // Close database connection
          await db.close()
          
          // Operations should fail gracefully
          try {
            await migrationManager.getStatus()
          } catch (error) {
            // Expected error
            expect(error).to.be.instanceOf(Error)
          }
        }))
      })
    }
  })
  
  describe('Migration Configuration', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should use default configuration', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Create migration manager with default config
          const migrationManager = await createNodeMigrationManager(db.getKysely())
          
          const config = migrationManager.getConfig()
          expect(config).to.exist
          expect(config.migrationsDirectory).to.equal('./migrations')
          expect(config.migrationTimeout).to.equal(30000)
          expect(config.maxConcurrentMigrations).to.equal(3)
          
          // Clean up
          await migrationManager.cleanup()
        }))
        
        it('should override default configuration', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Create migration manager with custom config
          const customConfig = {
            migrationsDirectory: './custom-migrations',
            migrationTimeout: 60000,
            maxConcurrentMigrations: 5,
            maxRetries: 5,
            retryDelay: 5000,
            logLevel: 'DEBUG' as const,
            enableConsole: false
          }
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), customConfig)
          
          const config = migrationManager.getConfig()
          expect(config.migrationsDirectory).to.equal(customConfig.migrationsDirectory)
          expect(config.migrationTimeout).to.equal(customConfig.migrationTimeout)
          expect(config.maxConcurrentMigrations).to.equal(customConfig.maxConcurrentMigrations)
          expect(config.maxRetries).to.equal(customConfig.maxRetries)
          expect(config.retryDelay).to.equal(customConfig.retryDelay)
          expect(config.logLevel).to.equal(customConfig.logLevel)
          expect(config.enableConsole).to.equal(customConfig.enableConsole)
          
          // Clean up
          await migrationManager.cleanup()
        }))
        
        it('should handle partial configuration updates', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Create migration manager
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          
          // Update only some configuration
          migrationManager.updateConfig({
            migrationTimeout: 45000,
            logLevel: 'WARN'
          })
          
          const config = migrationManager.getConfig()
          expect(config.migrationTimeout).to.equal(45000)
          expect(config.logLevel).to.equal('WARN')
          
          // Other config should remain unchanged
          expect(config.migrationsDirectory).to.equal('./test-migrations')
          expect(config.maxConcurrentMigrations).to.equal(3)
          
          // Clean up
          await migrationManager.cleanup()
        }))
      })
    }
  })
  
  describe('Migration with NOORMME Configuration', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should work with NOORMME configuration changes', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Create migration manager
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          
          // Initialize migration system
          await migrationManager.initialize()
          
          // Update NOORMME configuration
          db.updateConfig({
            logging: {
              level: 'debug',
              enabled: true
            }
          })
          
          // Migration manager should still work
          const status = await migrationManager.getStatus()
          expect(status).to.exist
          expect(status).to.have.property('totalFiles')
          
          // Clean up
          await migrationManager.cleanup()
        }))
        
        it('should handle NOORMME cache configuration', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Create migration manager
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          
          // Initialize migration system
          await migrationManager.initialize()
          
          // Update NOORMME cache configuration
          db.updateConfig({
            cache: {
              ttl: 600000,
              maxSize: 2000
            }
          })
          
          // Migration manager should still work
          const status = await migrationManager.getStatus()
          expect(status).to.exist
          
          // Clean up
          await migrationManager.cleanup()
        }))
        
        it('should handle NOORMME performance configuration', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Create migration manager
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          
          // Initialize migration system
          await migrationManager.initialize()
          
          // Update NOORMME performance configuration
          db.updateConfig({
            performance: {
              enableQueryOptimization: true,
              enableBatchLoading: true,
              maxBatchSize: 200
            }
          })
          
          // Migration manager should still work
          const status = await migrationManager.getStatus()
          expect(status).to.exist
          
          // Clean up
          await migrationManager.cleanup()
        }))
      })
    }
  })
})