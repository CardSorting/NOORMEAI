/**
 * Comprehensive unit tests for Repository Factory functionality
 */

import { describe, it, before, after } from 'mocha'
import { expect } from 'chai'
import { withTestDatabase, performanceHelper } from '../setup/test-helpers.js'
import { getEnabledDatabases } from '../setup/test-config.js'

describe('Repository Factory', () => {
  const enabledDatabases = getEnabledDatabases()
  
  if (enabledDatabases.length === 0) {
    console.warn('No databases enabled for testing')
    return
  }

  describe('Repository Creation', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should create repository with all CRUD operations', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Check that all CRUD operations exist
          expect(typeof userRepo.findById).to.equal('function')
          expect(typeof userRepo.findAll).to.equal('function')
          expect(typeof userRepo.create).to.equal('function')
          expect(typeof userRepo.update).to.equal('function')
          expect(typeof userRepo.delete).to.equal('function')
          
          // Check that relationship operations exist
          expect(typeof userRepo.findWithRelations).to.equal('function')
          expect(typeof userRepo.loadRelationships).to.equal('function')
        }))
        
        it('should create different repositories for different tables', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          expect(userRepo).to.not.equal(postRepo)
          expect(typeof userRepo.findById).to.equal('function')
          expect(typeof postRepo.findById).to.equal('function')
        }))
        
        it('should cache repository instances', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const repo1 = db.getRepository('users')
          const repo2 = db.getRepository('users')
          
          expect(repo1).to.equal(repo2)
        }))
      })
    }
  })

  describe('CRUD Operations', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should create new entities', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          const newUser = await userRepo.create({
            id: 'new-user',
            email: 'newuser@example.com',
            firstName: 'New',
            lastName: 'User',
            active: true
          })
          expect(newUser).to.exist
          expect((newUser as any).id).to.equal('new-user')
          expect((newUser as any).email).to.equal('newuser@example.com')
          expect((newUser as any).firstName).to.equal('New')
          expect((newUser as any).lastName).to.equal('User')
          expect((newUser as any).active).to.be.true
        }))
        
        it('should find entities by ID', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          const user = await userRepo.findById('user-1')
          expect(user).to.exist
          expect((user as any).id).to.equal('user-1')
          expect((user as any).email).to.equal('john@example.com')
        }))
        
        it('should return null for non-existent entities', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          const user = await userRepo.findById('non-existent-user')
          expect(user).to.be.null
        }))
        
        it('should find all entities', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          const users = await userRepo.findAll()
          expect(users).to.be.an('array')
          expect(users.length).to.be.greaterThan(0)
          
          // Should include our test users
          const userIds = users.map((u: any) => u.id)
          expect(userIds).to.include('user-1')
          expect(userIds).to.include('user-2')
          expect(userIds).to.include('user-3')
        }))
        
        it('should update entities', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Get existing user
          const user = await userRepo.findById('user-1')
          expect(user).to.exist
          
          // Update user
          const userToUpdate = user as any
          userToUpdate.firstName = 'Updated'
          userToUpdate.lastName = 'Name'
          
          const updatedUser = await userRepo.update(userToUpdate)
          expect(updatedUser).to.exist
          expect((updatedUser as any).firstName).to.equal('Updated')
          expect((updatedUser as any).lastName).to.equal('Name')
          
          // Verify update persisted
          const verifyUser = await userRepo.findById('user-1')
          expect((verifyUser as any).firstName).to.equal('Updated')
          expect((verifyUser as any).lastName).to.equal('Name')
        }))
        
        it('should delete entities', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Create a user to delete
          const user = await userRepo.create({
            id: 'delete-user',
            email: 'delete@example.com',
            firstName: 'Delete',
            lastName: 'User',
            active: true
          })
          expect(user).to.exist
          
          // Delete the user
          const deleted = await userRepo.delete('delete-user')
          expect(deleted).to.be.true
          
          // Verify user is deleted
          const deletedUser = await userRepo.findById('delete-user')
          expect(deletedUser).to.be.null
        }))
        
        it('should return false when deleting non-existent entities', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          const deleted = await userRepo.delete('non-existent-user')
          expect(deleted).to.be.false
        }))
      })
    }
  })

  describe('Custom Finder Methods', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should generate findBy methods for unique columns', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Should have findByEmail method
          expect(typeof (userRepo as any).findByEmail).to.equal('function')
          
          const user = await (userRepo as any).findByEmail('john@example.com')
          expect(user).to.exist
          expect((user as any).email).to.equal('john@example.com')
        }))
        
        it('should generate findManyBy methods for non-unique columns', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Should have findManyByFirstName method
          expect(typeof (userRepo as any).findManyByFirstName).to.equal('function')
          
          const users = await (userRepo as any).findManyByFirstName('John')
          expect(users).to.be.an('array')
          expect(users.length).to.be.greaterThan(0)
          
          for (const user of users) {
            expect((user as any).firstName).to.equal('John')
          }
        }))
        
        it('should generate count method', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          expect(typeof userRepo.count).to.equal('function')
          
          const count = await userRepo.count()
          expect(count).to.be.a('number')
          expect(count).to.be.greaterThan(0)
        }))
        
        it('should generate exists method', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          expect(typeof userRepo.exists).to.equal('function')
          
          const exists = await userRepo.exists('user-1')
          expect(exists).to.be.true
          
          const notExists = await userRepo.exists('non-existent-user')
          expect(notExists).to.be.false
        }))
      })
    }
  })

  describe('Relationship Operations', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should find entities with relations', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          const user = await userRepo.findWithRelations('user-1', ['posts'])
          expect(user).to.exist
          expect((user as any).id).to.equal('user-1')
          
          // Should have posts relation loaded
          expect((user as any).posts).to.exist
          expect((user as any).posts).to.be.an('array')
        }))
        
        it('should return null for non-existent entities with relations', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          const user = await userRepo.findWithRelations('non-existent-user', ['posts'])
          expect(user).to.be.null
        }))
        
        it('should load relationships for multiple entities', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          const users = await userRepo.findAll()
          expect(users).to.be.an('array')
          expect(users.length).to.be.greaterThan(0)
          
          await userRepo.loadRelationships(users, ['posts'])
          
          // All users should have posts relation loaded
          for (const user of users) {
            expect((user as any).posts).to.exist
            expect((user as any).posts).to.be.an('array')
          }
        }))
        
        it('should handle empty relations array', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          const user = await userRepo.findWithRelations('user-1', [])
          expect(user).to.exist
          expect((user as any).id).to.equal('user-1')
        }))
        
        it('should handle non-existent relations gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          const user = await userRepo.findWithRelations('user-1', ['nonExistentRelation'])
          expect(user).to.exist
          expect((user as any).id).to.equal('user-1')
          
          // Non-existent relation should not be loaded
          expect((user as any).nonExistentRelation).to.be.undefined
        }))
      })
    }
  })

  describe('Batch Loading', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should batch load relationships efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Create multiple users for batch testing
          const users: any[] = []
          for (let i = 0; i < 10; i++) {
            const user = await userRepo.create({
              id: `batch-user-${i}`,
              email: `batch${i}@example.com`,
              firstName: `Batch${i}`,
              lastName: 'User',
              active: true
            })
            users.push(user)
          }
          
          // Batch load relationships
          const start = performance.now()
          await userRepo.loadRelationships(users, ['posts'])
          const duration = performance.now() - start
          
          // Should be efficient (less than 1 second for 10 users)
          expect(duration).to.be.lessThan(1000)
          
          // All users should have posts relation loaded
          for (const user of users) {
            expect((user as any).posts).to.exist
            expect((user as any).posts).to.be.an('array')
          }
          
          // Clean up
          for (const user of users) {
            await userRepo.delete((user as any).id)
          }
        }))
        
        it('should handle large batches', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Create a large batch of users
          const users: any[] = []
          for (let i = 0; i < 100; i++) {
            const user = await userRepo.create({
              id: `large-batch-user-${i}`,
              email: `largebatch${i}@example.com`,
              firstName: `LargeBatch${i}`,
              lastName: 'User',
              active: true
            })
            users.push(user)
          }
          
          // Batch load relationships
          const start = performance.now()
          await userRepo.loadRelationships(users, ['posts'])
          const duration = performance.now() - start
          
          // Should be efficient even for large batches
          expect(duration).to.be.lessThan(5000) // 5 seconds max
          
          // All users should have posts relation loaded
          for (const user of users) {
            expect((user as any).posts).to.exist
            expect((user as any).posts).to.be.an('array')
          }
          
          // Clean up
          for (const user of users) {
            await userRepo.delete((user as any).id)
          }
        }))
      })
    }
  })

  describe('Error Handling', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should handle database errors gracefully', withTestDatabase(dialect, async (testDb) => {
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
          } catch (error) {
            // Expected error
            expect(error).to.be.instanceOf(Error)
          }
        }))
        
        it('should handle connection errors gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Close the database connection
          await db.close()
          
          // Operations should fail gracefully
          try {
            await userRepo.findAll()
          } catch (error) {
            // Expected error
            expect(error).to.be.instanceOf(Error)
          }
        }))
        
        it('should handle invalid entity data', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Try to update with invalid data
          try {
            await userRepo.update({
              id: 'user-1',
              email: null as any, // Invalid email
              firstName: 'Invalid',
              lastName: 'User',
              active: true
            } as any)
          } catch (error) {
            // Expected error
            expect(error).to.be.instanceOf(Error)
          }
        }))
      })
    }
  })

  describe('Performance', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should create repositories efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const duration = await performanceHelper.measure('repository-creation', async () => {
            // Create multiple repositories
            for (let i = 0; i < 100; i++) {
              db.getRepository('users')
              db.getRepository('posts')
              db.getRepository('comments')
            }
          })
          // Should be very fast due to caching
          expect(duration).to.be.lessThan(100) // 100ms max
        }))
        
        it('should perform CRUD operations efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Test create performance
          const createDuration = await performanceHelper.measure('create-operation', async () => {
            const user = await userRepo.create({
              id: 'perf-user',
              email: 'perf@example.com',
              firstName: 'Perf',
              lastName: 'User',
              active: true
            })
            return user
          })
          expect(createDuration).to.be.lessThan(1000) // 1 second max
          
          // Test find performance
          const findDuration = await performanceHelper.measure('find-operation', async () => {
            const user = await userRepo.findById('perf-user')
            return user
          })
          expect(findDuration).to.be.lessThan(500) // 500ms max
          
          // Test update performance
          const updateDuration = await performanceHelper.measure('update-operation', async () => {
            const user = await userRepo.findById('perf-user')
            if (user) {
              (user as any).firstName = 'Updated'
              return await userRepo.update(user as any)
            }
            return null
          })
          expect(updateDuration).to.be.lessThan(500) // 500ms max
          
          // Test delete performance
          const deleteDuration = await performanceHelper.measure('delete-operation', async () => {
            return await userRepo.delete('perf-user')
          })
          expect(deleteDuration).to.be.lessThan(500) // 500ms max
        }))
        
        it('should handle concurrent operations efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Create multiple users concurrently
          const start = performance.now()
          const promises: Promise<any>[] = []
          
          for (let i = 0; i < 10; i++) {
            promises.push(
              userRepo.create({
                id: `concurrent-user-${i}`,
                email: `concurrent${i}@example.com`,
                firstName: `Concurrent${i}`,
                lastName: 'User',
                active: true
              })
            )
          }
          
          const users = await Promise.all(promises)
          const duration = performance.now() - start
          
          expect(users).to.be.an('array')
          expect(users.length).to.equal(10)
          expect(duration).to.be.lessThan(2000) // 2 seconds max
          
          // Clean up
          for (const user of users) {
            await userRepo.delete((user as any).id)
          }
        }))
      })
    }
  })
})