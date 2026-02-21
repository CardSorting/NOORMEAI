/**
 * Performance tests for migration system
 */

import { describe, it, before, after } from 'mocha'
import { expect } from 'chai'
import { withTestDatabase, performanceHelper, memoryHelper } from '../setup/test-helpers.js'
import { getEnabledDatabases } from '../setup/test-config.js'
import { createNodeMigrationManager } from '../../src/migration/node-migration-manager.js'

describe('Migration Performance', () => {
  const enabledDatabases = getEnabledDatabases()
  
  if (enabledDatabases.length === 0) {
    console.warn('No databases enabled for testing')
    return
  }

  describe('Migration Manager Initialization', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should initialize efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Test initialization performance
          const migrationManager = await performanceHelper.measure('migration-init', async () => {
            const manager = await createNodeMigrationManager(db.getKysely(), {
              migrationsDirectory: './test-migrations'
            })
            await manager.initialize()
            
            return manager
          })
          
          // Should be reasonably fast
          const initStats = performanceHelper.getStats('migration-init')
          expect(initStats?.average).to.be.lessThan(5000) // 5 seconds max
          
          await migrationManager.cleanup()
        }))

        it('should handle memory efficiently during initialization', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Test memory usage during initialization
          const { delta } = await memoryHelper.measureMemory(async () => {
            const migrationManager = await createNodeMigrationManager(db.getKysely(), {
              migrationsDirectory: './test-migrations'
            })
            await migrationManager.initialize()
            
            await migrationManager.cleanup()
          })
          
          // Memory usage should be reasonable
          expect(delta.heapUsed).to.be.lessThan(50) // 50MB limit
        }))

        it('should handle multiple initializations efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Test multiple initialization performance
          const migrationManagers: any[] = await performanceHelper.measure('migration-multiple-init', async () => {
            const managers: any[] = []
            
            for (let i = 0; i < 5; i++) {
              const manager = await createNodeMigrationManager(db.getKysely(), {
                migrationsDirectory: './test-migrations'
              })
              await manager.initialize()
              managers.push(manager)
            }
            
            return managers
          })
          
          // Should be reasonably fast even with multiple initializations
          const multipleInitStats = performanceHelper.getStats('migration-multiple-init')
          expect(multipleInitStats?.average).to.be.lessThan(10000) // 10 seconds max
          
          // Clean up
          for (const manager of migrationManagers) {
            await manager.cleanup()
          }
        }))
      })
    }
  })

  describe('Migration Status Retrieval', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should get status efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          await migrationManager.initialize()
          
          // Test status retrieval performance
          const status: any = await performanceHelper.measure('migration-status', async () => {
            return await migrationManager.getStatus()
          })
          
          // Should be very fast
          const statusStats = performanceHelper.getStats('migration-status')
          expect(statusStats?.average).to.be.lessThan(1000) // 1 second max
          
          await migrationManager.cleanup()
        }))

        it('should handle concurrent status requests efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          await migrationManager.initialize()
          
          // Test concurrent status requests
          const start = performance.now()
          const promises: Promise<any>[] = []
          
          for (let i = 0; i < 10; i++) {
            promises.push(migrationManager.getStatus())
          }
          
          const results = await Promise.all(promises)
          const duration = performance.now() - start
          
          // Should be efficient even with concurrent requests
          expect(duration).to.be.lessThan(2000) // 2 seconds max
          expect(results.length).to.equal(10)
          
          await migrationManager.cleanup()
        }))

        it('should cache status information efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          await migrationManager.initialize()
          
          // First status request
          await performanceHelper.measure('migration-status-first', async () => {
            await migrationManager.getStatus()
          })
          
          // Second status request (should be cached)
          await performanceHelper.measure('migration-status-second', async () => {
            await migrationManager.getStatus()
          })
          
          // Second request should be faster (cached)
          const firstStats = performanceHelper.getStats('migration-status-first')
          const secondStats = performanceHelper.getStats('migration-status-second')
          expect(secondStats?.average).to.be.lessThan(firstStats?.average || 0)
          
          await migrationManager.cleanup()
        }))
      })
    }
  })

  describe('Migration Execution', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should execute migrations efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          await migrationManager.initialize()
          
          // Test migration execution performance
          const result = await performanceHelper.measure('migration-execution', async () => {
            return await migrationManager.migrate()
          })
          
          // Should be reasonably fast
          const executionStats = performanceHelper.getStats('migration-execution')
          expect(executionStats?.average).to.be.lessThan(10000) // 10 seconds max
          
          await migrationManager.cleanup()
        }))

        it('should handle memory efficiently during migration execution', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          await migrationManager.initialize()
          
          // Test memory usage during migration execution
          const { delta } = await memoryHelper.measureMemory(async () => {
            await migrationManager.migrate()
          })
          
          // Memory usage should be reasonable
          expect(delta.heapUsed).to.be.lessThan(100) // 100MB limit
          
          await migrationManager.cleanup()
        }))

        it('should handle multiple migration executions efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          await migrationManager.initialize()
          
          // First migration execution
          await migrationManager.migrate()
          
          // Test subsequent migration execution performance
          const subsequentResult = await performanceHelper.measure('migration-execution-subsequent', async () => {
            return await migrationManager.migrate()
          })
          
          // Should be very fast for subsequent executions (no pending migrations)
          const subsequentStats = performanceHelper.getStats('migration-execution-subsequent')
          expect(subsequentStats?.average).to.be.lessThan(1000) // 1 second max
          
          await migrationManager.cleanup()
        }))
      })
    }
  })

  describe('Migration File Creation', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should create migration files efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          await migrationManager.initialize()
          
          // Test migration file creation performance
          const fileName = await performanceHelper.measure('migration-create', async () => {
            const migrationContent = `
              CREATE TABLE IF NOT EXISTS test_performance_table (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
              );
            `
            
            return await migrationManager.createMigration('test_performance', migrationContent)
          })
          
          // Should be reasonably fast
          const createStats = performanceHelper.getStats('migration-create')
          expect(createStats?.average).to.be.lessThan(2000) // 2 seconds max
          
          await migrationManager.cleanup()
        }))

        it('should handle multiple migration file creations efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          await migrationManager.initialize()
          
          // Test multiple migration file creation performance
          const fileNames: string[] = await performanceHelper.measure('migration-create-multiple', async () => {
            const names: string[] = []
            
            for (let i = 0; i < 5; i++) {
              const migrationContent = `
                CREATE TABLE IF NOT EXISTS test_performance_table_${i} (
                  id TEXT PRIMARY KEY,
                  name TEXT NOT NULL,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
              `
              
              const fileName = await migrationManager.createMigration(`test_performance_${i}`, migrationContent)
              names.push(fileName)
            }
            
            return names
          })
          
          // Should be reasonably fast even for multiple files
          const multipleCreateStats = performanceHelper.getStats('migration-create-multiple')
          expect(multipleCreateStats?.average).to.be.lessThan(5000) // 5 seconds max
          
          await migrationManager.cleanup()
        }))
      })
    }
  })

  describe('Migration Configuration', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should update configuration efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          await migrationManager.initialize()
          
          // Test configuration update performance
          await performanceHelper.measure('migration-config-update', async () => {
            for (let i = 0; i < 100; i++) {
              migrationManager.updateConfig({
                migrationTimeout: 30000 + i,
                maxConcurrentMigrations: 3 + (i % 5)
              })
            }
          })
          
          // Should be very fast
          const configUpdateStats = performanceHelper.getStats('migration-config-update')
          expect(configUpdateStats?.average).to.be.lessThan(100) // 100ms max
          
          await migrationManager.cleanup()
        }))

        it('should retrieve configuration efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          await migrationManager.initialize()
          
          // Test configuration retrieval performance
          await performanceHelper.measure('migration-config-get', async () => {
            for (let i = 0; i < 1000; i++) {
              migrationManager.getConfig()
            }
          })
          
          // Should be very fast
          const configGetStats = performanceHelper.getStats('migration-config-get')
          expect(configGetStats?.average).to.be.lessThan(50) // 50ms max
          
          await migrationManager.cleanup()
        }))
      })
    }
  })

  describe('Migration Component Access', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should access components efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          await migrationManager.initialize()
          
          // Test component access performance
          await performanceHelper.measure('migration-components', async () => {
            for (let i = 0; i < 1000; i++) {
              migrationManager.getComponents()
            }
          })
          
          // Should be very fast
          const componentsStats = performanceHelper.getStats('migration-components')
          expect(componentsStats?.average).to.be.lessThan(50) // 50ms max
          
          await migrationManager.cleanup()
        }))
      })
    }
  })

  describe('Migration Cleanup', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should cleanup efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          await migrationManager.initialize()
          
          // Test cleanup performance
          await performanceHelper.measure('migration-cleanup', async () => {
            await migrationManager.cleanup()
          })
          
          // Should be reasonably fast
          const cleanupStats = performanceHelper.getStats('migration-cleanup')
          expect(cleanupStats?.average).to.be.lessThan(1000) // 1 second max
        }))

        it('should handle multiple cleanups efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          await migrationManager.initialize()
          
          // Test multiple cleanup performance
          await performanceHelper.measure('migration-cleanup-multiple', async () => {
            for (let i = 0; i < 10; i++) {
              await migrationManager.cleanup()
            }
          })
          
          // Should be reasonably fast even with multiple cleanups
          const multipleCleanupStats = performanceHelper.getStats('migration-cleanup-multiple')
          expect(multipleCleanupStats?.average).to.be.lessThan(2000) // 2 seconds max
        }))
      })
    }
  })

  describe('Migration Resource Management', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should manage resources efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations',
            maxConcurrentMigrations: 5
          })
          await migrationManager.initialize()
          
          // Test resource management performance
          await performanceHelper.measure('migration-resources', async () => {
            // Simulate resource-intensive operations
            const promises: Promise<any>[] = []
            
            for (let i = 0; i < 10; i++) {
              promises.push(migrationManager.getStatus())
            }
            
            await Promise.all(promises)
          })
          
          // Should be efficient even with resource management
          const resourcesStats = performanceHelper.getStats('migration-resources')
          expect(resourcesStats?.average).to.be.lessThan(2000) // 2 seconds max
          
          await migrationManager.cleanup()
        }))

        it('should handle resource constraints efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations',
            maxConcurrentMigrations: 1 // Very restrictive
          })
          await migrationManager.initialize()
          
          // Test resource constraint handling
          await performanceHelper.measure('migration-resource-constraints', async () => {
            // Simulate operations under resource constraints
            const promises: Promise<any>[] = []
            
            for (let i = 0; i < 5; i++) {
              promises.push(migrationManager.getStatus())
            }
            
            await Promise.all(promises)
          })
          
          // Should be efficient even with resource constraints
          const constraintsStats = performanceHelper.getStats('migration-resource-constraints')
          expect(constraintsStats?.average).to.be.lessThan(3000) // 3 seconds max
          
          await migrationManager.cleanup()
        }))
      })
    }
  })

  describe('Migration Performance Metrics', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should track performance metrics efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          await migrationManager.initialize()
          
          // Perform operations to generate metrics
          await migrationManager.getStatus()
          await migrationManager.migrate()
          
          // Test performance metrics tracking
          await performanceHelper.measure('migration-metrics', async () => {
            // Simulate operations that generate metrics
            for (let i = 0; i < 100; i++) {
              await migrationManager.getStatus()
            }
          })
          
          // Should be efficient even with metrics tracking
          const metricsStats = performanceHelper.getStats('migration-metrics')
          expect(metricsStats?.average).to.be.lessThan(2000) // 2 seconds max
          
          await migrationManager.cleanup()
        }))

        it('should handle performance monitoring efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          await migrationManager.initialize()
          
          // Test performance monitoring
          await performanceHelper.measure('migration-monitoring', async () => {
            // Simulate performance monitoring operations
            const promises: Promise<any>[] = []
            
            for (let i = 0; i < 20; i++) {
              promises.push(migrationManager.getStatus())
            }
            
            await Promise.all(promises)
          })
          
          // Should be efficient even with performance monitoring
          const monitoringStats = performanceHelper.getStats('migration-monitoring')
          expect(monitoringStats?.average).to.be.lessThan(2000) // 2 seconds max
          
          await migrationManager.cleanup()
        }))
      })
    }
  })
})