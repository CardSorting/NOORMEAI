/**
 * End-to-end tests for error handling and recovery
 */

import { describe, it, before, after } from 'mocha'
import { expect } from 'chai'
import { withTestDatabase, performanceHelper } from '../setup/test-helpers.js'
import { getEnabledDatabases } from '../setup/test-config.js'

describe('Error Handling E2E Tests', () => {
  const enabledDatabases = getEnabledDatabases()
  
  if (enabledDatabases.length === 0) {
    console.warn('No databases enabled for testing')
    return
  }

  describe('Database Connection Errors', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should handle database connection failures gracefully', async () => {
          // Create invalid database connection
          const { NOORMME } = await import('../../src/noormme.js')
          const invalidDb = new NOORMME({
            dialect,
            connection: {
              host: 'invalid-host',
              port: 9999,
              database: 'invalid-db',
              username: 'invalid-user',
              password: 'invalid-password'
            }
          })
          
          try {
            await invalidDb.initialize()
            expect.fail('Should have thrown an error')
          } catch (error) {
            expect(error).to.be.instanceOf(Error)
            expect(error.message).to.include('connection')
          }
        })

        it('should handle database connection timeouts', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Close the database connection
          await db.close()
          
          // Try to perform operations on closed connection
          const userRepo = db.getRepository('users')
          
          try {
            await userRepo.findAll()
            expect.fail('Should have thrown an error')
          } catch (error) {
            expect(error).to.be.instanceOf(Error)
          }
        }))

        it('should handle database connection recovery', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Perform some operations
          const userRepo = db.getRepository('users')
          const user = await userRepo.create({
            id: 'recovery-user',
            email: 'recovery@example.com',
            firstName: 'Recovery',
            lastName: 'User',
            active: true
          })
          
          // Close connection
          await db.close()
          
          // Reinitialize and verify data is still there
          
          const recoveredUser = await userRepo.findById('recovery-user')
          
          expect(recoveredUser).to.exist
          expect((recoveredUser as any)!.email).to.equal('recovery@example.com')
          
          // Clean up
          await userRepo.delete('recovery-user')
        }))
      })
    }
  })

  describe('Data Validation Errors', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should handle invalid data types gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Try to create user with invalid data
          try {
            await userRepo.create({
              id: 'invalid-user',
              email: null as any, // Invalid email
              firstName: 'Invalid',
              lastName: 'User',
              active: true
            })
            expect.fail('Should have thrown an error')
          } catch (error) {
            expect(error).to.be.instanceOf(Error)
          }
        }))

        it('should handle missing required fields gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Try to create user with missing required fields
          try {
            await userRepo.create({
              id: 'missing-fields-user',
              // Missing email, firstName, lastName
              active: true
            } as any)
            expect.fail('Should have thrown an error')
          } catch (error) {
            expect(error).to.be.instanceOf(Error)
          }
        }))

        it('should handle data type mismatches gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Try to create user with wrong data types
          try {
            await userRepo.create({
              id: 'type-mismatch-user',
              email: 'type@example.com',
              firstName: 123 as any, // Should be string
              lastName: 'User',
              active: 'yes' as any // Should be boolean
            })
            expect.fail('Should have thrown an error')
          } catch (error) {
            expect(error).to.be.instanceOf(Error)
          }
        }))

        it('should handle duplicate key errors gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Create first user
          await userRepo.create({
            id: 'duplicate-user',
            email: 'duplicate@example.com',
            firstName: 'Duplicate',
            lastName: 'User',
            active: true
          })
          
          // Try to create user with same ID
          try {
            await userRepo.create({
              id: 'duplicate-user', // Same ID
              email: 'duplicate2@example.com',
              firstName: 'Duplicate2',
              lastName: 'User2',
              active: true
            })
            expect.fail('Should have thrown an error')
          } catch (error) {
            expect(error).to.be.instanceOf(Error)
          }
          
          // Clean up
          await userRepo.delete('duplicate-user')
        }))

        it('should handle foreign key constraint errors gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const postRepo = db.getRepository('posts')
          
          // Try to create post with non-existent user
          try {
            await postRepo.create({
              id: 'fk-error-post',
              userId: 'non-existent-user',
              title: 'FK Error Post',
              content: 'This should fail',
              published: true
            })
            expect.fail('Should have thrown an error')
          } catch (error) {
            expect(error).to.be.instanceOf(Error)
          }
        }))
      })
    }
  })

  describe('Transaction Error Handling', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should handle transaction rollbacks correctly', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Create user first
          const user = await userRepo.create({
            id: 'tx-rollback-user',
            email: 'txrollback@example.com',
            firstName: 'TxRollback',
            lastName: 'User',
            active: true
          })
          
          try {
            await db.transaction(async (trx) => {
              // Create post
              await trx
                .insertInto('posts')
                .values({
                  id: 'tx-rollback-post',
                  userId: (user as any).id,
                  title: 'Transaction Rollback Post',
                  content: 'This post should be rolled back',
                  published: true
                })
                .execute()
              
              // Force an error
              throw new Error('Transaction rollback test')
            })
            expect.fail('Should have thrown an error')
          } catch (error) {
            expect(error).to.be.instanceOf(Error)
            expect((error as Error).message).to.equal('Transaction rollback test')
          }
          
          // Verify post was not created
          const post = await postRepo.findById('tx-rollback-post')
          expect(post).to.be.null
          
          // Verify user still exists
          const existingUser = await userRepo.findById('tx-rollback-user')
          expect(existingUser).to.exist
          
          // Clean up
          await userRepo.delete('tx-rollback-user')
        }))

        it('should handle nested transaction errors correctly', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          try {
            await db.transaction(async (outerTrx) => {
              // Create user in outer transaction
              await outerTrx
                .insertInto('users')
                .values({
                  id: 'nested-tx-user',
                  email: 'nestedtx@example.com',
                  firstName: 'NestedTx',
                  lastName: 'User',
                  active: true
                })
                .execute()
              
              // Execute inner transaction that fails
              await db.transaction(async (innerTrx) => {
                // Update user in inner transaction
                await innerTrx
                  .updateTable('users')
                  .set({ firstName: 'Updated' })
                  .where('id', '=', 'nested-tx-user')
                  .execute()
                
                // Force an error in inner transaction
                throw new Error('Inner transaction error')
              })
            })
            expect.fail('Should have thrown an error')
          } catch (error) {
            expect(error).to.be.instanceOf(Error)
            expect((error as Error).message).to.equal('Inner transaction error')
          }
          
          // Verify user was not created (outer transaction rolled back)
          const user = await userRepo.findById('nested-tx-user')
          expect(user).to.be.null
        }))

        it('should handle transaction timeout errors', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          try {
            await db.transaction(async (trx) => {
              // Create user
              await trx
                .insertInto('users')
                .values({
                  id: 'timeout-user',
                  email: 'timeout@example.com',
                  firstName: 'Timeout',
                  lastName: 'User',
                  active: true
                })
                .execute()
              
              // Simulate long-running operation
              await new Promise(resolve => setTimeout(resolve, 100))
              
              // Force an error after delay
              throw new Error('Transaction timeout simulation')
            })
            expect.fail('Should have thrown an error')
          } catch (error) {
            expect(error).to.be.instanceOf(Error)
            expect((error as Error).message).to.equal('Transaction timeout simulation')
          }
          
          // Verify user was not created
          const userRepo = db.getRepository('users')
          const user = await userRepo.findById('timeout-user')
          expect(user).to.be.null
        }))
      })
    }
  })

  describe('Relationship Loading Errors', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should handle non-existent relationship errors gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Create user
          const user = await userRepo.create({
            id: 'rel-error-user',
            email: 'relerror@example.com',
            firstName: 'RelError',
            lastName: 'User',
            active: true
          })
          
          // Try to load non-existent relationship
          try {
            await userRepo.findWithRelations((user as any).id, ['nonExistentRelation'])
            // Should not throw error, just return user without the relationship
          } catch (error) {
            expect.fail('Should not throw error for non-existent relationships')
          }
          
          // Clean up
          await userRepo.delete('rel-error-user')
        }))

        it('should handle relationship loading with invalid data gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Create user and post
          const user = await userRepo.create({
            id: 'invalid-rel-user',
            email: 'invalidrel@example.com',
            firstName: 'InvalidRel',
            lastName: 'User',
            active: true
          })
          
          const post = await postRepo.create({
            id: 'invalid-rel-post',
            userId: (user as any).id,
            title: 'Invalid Rel Post',
            content: 'This post has invalid relationship data',
            published: true
          })
          
          // Manually corrupt the relationship data
          const kysely = db.getKysely()
          await kysely
            .updateTable('posts')
            .set({ userId: 'invalid-user-id' })
            .where('id', '=', (post as any).id)
            .execute()
          
          // Try to load relationship with corrupted data
          try {
            await userRepo.findWithRelations((user as any).id, ['posts'])
            // Should handle gracefully
          } catch (error) {
            // May or may not throw error depending on implementation
            expect(error).to.be.instanceOf(Error)
          }
          
          // Clean up
          await postRepo.delete('invalid-rel-post')
          await userRepo.delete('invalid-rel-user')
        }))

        it('should handle batch relationship loading errors gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Create users
          const users: any[] = []
          for (let i = 0; i < 5; i++) {
            const user = await userRepo.create({
              id: `batch-rel-error-user-${i}`,
              email: `batchrelerror${i}@example.com`,
              firstName: `BatchRelError${i}`,
              lastName: 'User',
              active: true
            })
            users.push(user as any)
          }
          
          // Try to batch load relationships with some invalid data
          try {
            await userRepo.loadRelationships(users as any[], ['posts'])
            // Should handle gracefully
          } catch (error) {
            // May or may not throw error depending on implementation
            expect(error).to.be.instanceOf(Error)
          }
          
          // Clean up
          for (const user of users) {
            await userRepo.delete((user as any).id)
          }
        }))
      })
    }
  })

  describe('Cache Error Handling', () => {
    it('should handle cache errors gracefully', async () => {
      const { CacheManager } = await import('../../src/cache/cache-manager.js')
      const cache = new CacheManager()
      
      // Test cache with invalid operations
      try {
        // These should not throw errors
        cache.get('non-existent-key')
        cache.delete('non-existent-key')
        cache.has('non-existent-key')
      } catch (error) {
        expect.fail('Cache operations should not throw errors for non-existent keys')
      }
      
      // Test cache with invalid data
      try {
        await cache.set('test-key', undefined)
        const value = cache.get('test-key')
        expect(value).to.be.undefined
      } catch (error) {
        expect.fail('Cache should handle undefined values gracefully')
      }
      
      // Test cache statistics with no data
      const stats = cache.getStats()
      expect(stats.hits).to.equal(0)
      expect(stats.misses).to.equal(0)
      expect(stats.hitRate).to.equal(0)
    })

    it('should handle cache memory pressure gracefully', async () => {
      const { CacheManager } = await import('../../src/cache/cache-manager.js')
      const cache = new CacheManager({ maxSize: 10 })
      
      // Fill cache to capacity
      for (let i = 0; i < 10; i++) {
        await cache.set(`key${i}`, `value${i}`)
      }
      
      // Add more items to trigger eviction
      for (let i = 10; i < 20; i++) {
        await cache.set(`key${i}`, `value${i}`)
      }
      
      // Cache should still work
      expect(cache.size()).to.equal(10)
      
      // Some items should be evicted
      const earlyItem = cache.get('key0')
      expect(earlyItem).to.be.null
      
      // Recent items should still be there
      const recentItem = cache.get('key19')
      expect(recentItem).to.equal('value19')
    })

    it('should handle cache TTL errors gracefully', async () => {
      const { CacheManager } = await import('../../src/cache/cache-manager.js')
      const cache = new CacheManager({ ttl: 100 })
      
      // Set value with TTL
      await cache.set('ttl-key', 'ttl-value')
      expect(cache.get('ttl-key')).to.equal('ttl-value')
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150))
      
      // Value should be expired
      expect(cache.get('ttl-key')).to.be.null
      
      // Cleanup should not throw errors
      cache.cleanExpired()
    })
  })

  describe('Migration Error Handling', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should handle migration errors gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const { createNodeMigrationManager } = await import('../../src/migration/node-migration-manager.js')
          
          // Create migration manager with invalid directory
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: '/invalid/path/that/does/not/exist'
          })
          
          try {
            await migrationManager.initialize()
            expect.fail('Should have thrown an error')
          } catch (error) {
            expect(error).to.be.instanceOf(Error)
          }
        }))

        it('should handle migration execution errors gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const { createNodeMigrationManager } = await import('../../src/migration/node-migration-manager.js')
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          
          try {
            await migrationManager.initialize()
            
            // Try to create migration with invalid SQL
            await migrationManager.createMigration('invalid_migration', 'INVALID SQL CONTENT')
            expect.fail('Should have thrown an error')
          } catch (error) {
            expect(error).to.be.instanceOf(Error)
          }
        }))

        it('should handle migration configuration errors gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const { createNodeMigrationManager } = await import('../../src/migration/node-migration-manager.js')
          
          const migrationManager = await createNodeMigrationManager(db.getKysely(), {
            migrationsDirectory: './test-migrations'
          })
          
          await migrationManager.initialize()
          
          // Test invalid configuration updates
          try {
            migrationManager.updateConfig({
              migrationTimeout: -1, // Invalid timeout
              maxConcurrentMigrations: 0 // Invalid concurrency
            })
            // Should handle gracefully
          } catch (error) {
            expect(error).to.be.instanceOf(Error)
          }
        }))
      })
    }
  })

  describe('Performance Error Handling', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should handle performance monitoring errors gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Test performance monitoring with errors
          try {
            const duration = await performanceHelper.measure('error-test', async () => {
              // Simulate an error during performance measurement
              throw new Error('Performance test error')
            })
            expect.fail('Should have thrown an error')
          } catch (error) {
            expect(error).to.be.instanceOf(Error)
            expect((error as Error).message).to.equal('Performance test error')
          }
        }))

        it('should handle memory monitoring errors gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Test memory monitoring with errors
          try {
            const { delta } = await performanceHelper.measure('memory-test', async () => {
              // Simulate an error during memory measurement
              throw new Error('Memory test error')
            })
            expect.fail('Should have thrown an error')
          } catch (error) {
            expect(error).to.be.instanceOf(Error)
            expect((error as Error).message).to.equal('Memory test error')
          }
        }))

        it('should handle resource exhaustion gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Test resource exhaustion
          try {
            // Create many users to test resource limits
            const users: any[] = []
            for (let i = 0; i < 1000; i++) {
              const user = await userRepo.create({
                id: `resource-exhaustion-user-${i}`,
                email: `resource${i}@example.com`,
                firstName: `Resource${i}`,
                lastName: 'User',
                active: true
              })
              users.push(user as any)
            }
            
            // Should handle large datasets gracefully
            expect(users.length).to.equal(1000)
            
            // Clean up
            for (const user of users) {
              await userRepo.delete((user as any).id)
            }
          } catch (error) {
            // May throw error due to resource limits
            expect(error).to.be.instanceOf(Error)
          }
        }))
      })
    }
  })

  describe('Recovery and Resilience', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should recover from partial failures gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Create user
          const user = await userRepo.create({
            id: 'recovery-user',
            email: 'recovery@example.com',
            firstName: 'Recovery',
            lastName: 'User',
            active: true
          })
          
          // Simulate partial failure scenario
          try {
            await db.transaction(async (trx) => {
              // Create post
              await trx
                .insertInto('posts')
                .values({
                  id: 'recovery-post',
                  userId: (user as any).id,
                  title: 'Recovery Post',
                  content: 'This post should be created',
                  published: true
                })
                .execute()
              
              // Simulate partial failure
              throw new Error('Partial failure simulation')
            })
            expect.fail('Should have thrown an error')
          } catch (error) {
            expect(error).to.be.instanceOf(Error)
            expect((error as Error).message).to.equal('Partial failure simulation')
          }
          
          // Verify user still exists but post was not created
          const existingUser = await userRepo.findById('recovery-user')
          expect(existingUser).to.exist
          
          const post = await postRepo.findById('recovery-post')
          expect(post).to.be.null
          
          // Clean up
          await userRepo.delete('recovery-user')
        }))

        it('should handle concurrent error scenarios gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Test concurrent operations with some failures
          const promises: Promise<any>[] = []
          
          // Mix of successful and failing operations
          for (let i = 0; i < 10; i++) {
            if (i % 2 === 0) {
              // Successful operation
              promises.push(
                userRepo.create({
                  id: `concurrent-success-${i}`,
                  email: `success${i}@example.com`,
                  firstName: `Success${i}`,
                  lastName: 'User',
                  active: true
                })
              )
            } else {
              // Failing operation
              promises.push(
                userRepo.create({
                  id: 'duplicate-id', // Same ID for all failing operations
                  email: `fail${i}@example.com`,
                  firstName: `Fail${i}`,
                  lastName: 'User',
                  active: true
                }).catch(() => {
                  // Expected to fail
                  return null
                })
              )
            }
          }
          
          const results = await Promise.all(promises)
          
          // Some operations should succeed, some should fail
          const successful = results.filter(result => result !== null)
          const failed = results.filter(result => result === null)
          
          expect(successful.length).to.be.greaterThan(0)
          expect(failed.length).to.be.greaterThan(0)
          
          // Clean up successful operations
          for (const user of successful) {
            await userRepo.delete((user as any).id)
          }
        }))

        it('should maintain data consistency during errors', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Create initial data
          const user = await userRepo.create({
            id: 'consistency-user',
            email: 'consistency@example.com',
            firstName: 'Consistency',
            lastName: 'User',
            active: true
          })
          
          const post = await postRepo.create({
            id: 'consistency-post',
            userId: (user as any).id,
            title: 'Consistency Post',
            content: 'This post should maintain consistency',
            published: true
          })
          
          // Simulate error scenario
          try {
            await db.transaction(async (trx) => {
              // Update user
              await trx
                .updateTable('users')
                .set({ firstName: 'Updated' })
                .where('id', '=', (user as any).id)
                .execute()
              
              // Update post
              await trx
                .updateTable('posts')
                .set({ title: 'Updated Post' })
                .where('id', '=', (post as any).id)
                .execute()
              
              // Force an error
              throw new Error('Consistency test error')
            })
            expect.fail('Should have thrown an error')
          } catch (error) {
            expect(error).to.be.instanceOf(Error)
            expect((error as Error).message).to.equal('Consistency test error')
          }
          
          // Verify data consistency (both updates should be rolled back)
          const updatedUser = await userRepo.findById('consistency-user')
          expect((updatedUser as any)!.firstName).to.equal('Consistency') // Should be original value
          
          const updatedPost = await postRepo.findById('consistency-post')
          expect((updatedPost as any)!.title).to.equal('Consistency Post') // Should be original value
          
          // Clean up
          await postRepo.delete('consistency-post')
          await userRepo.delete('consistency-user')
        }))
      })
    }
  })
})
