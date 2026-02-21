/**
 * Stress tests for NOORM system
 */

import { describe, it, before, after } from 'mocha'
import { expect } from 'chai'
import { withTestDatabase, performanceHelper, memoryHelper } from '../setup/test-helpers.js'
import { getEnabledDatabases } from '../setup/test-config.js'

// Define types for our test entities
interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  age?: number
  active: boolean
  createdAt?: Date
  updatedAt?: Date
  posts?: Post[]
}

interface Post {
  id: string
  userId: string
  title: string
  content: string
  published: boolean
  createdAt?: Date
  updatedAt?: Date
  comments?: Comment[]
}

interface Comment {
  id: string
  postId: string
  userId: string
  content: string
  createdAt?: Date
  updatedAt?: Date
}

describe('Stress Tests', () => {
  const enabledDatabases = getEnabledDatabases()
  
  if (enabledDatabases.length === 0) {
    console.warn('No databases enabled for testing')
    return
  }

  describe('Database Stress Tests', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should handle large number of concurrent operations', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository<User>('users')
          
          // Test concurrent operations
          const start = performance.now()
          const promises: Promise<User>[] = []
          
          // Create 100 users concurrently
          for (let i = 0; i < 100; i++) {
            promises.push(
              userRepo.create({
                id: `stress-user-${i}`,
                email: `stress${i}@example.com`,
                firstName: `Stress${i}`,
                lastName: 'User',
                active: true
              })
            )
          }
          
          const users = await Promise.all(promises)
          const duration = performance.now() - start
          
          // Should handle concurrent operations efficiently
          expect(duration).to.be.lessThan(10000) // 10 seconds max
          expect(users.length).to.equal(100)
          
          // Clean up
          for (const user of users) {
            await userRepo.delete(user.id)
          }
        }))

        it('should handle memory efficiently with large datasets', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository<User>('users')
          
          // Test memory usage with large dataset
          const { delta } = await memoryHelper.measureMemory(async () => {
            const users: User[] = []
            
            // Create 1000 users
            for (let i = 0; i < 1000; i++) {
              const user = await userRepo.create({
                id: `memory-stress-user-${i}`,
                email: `memorystress${i}@example.com`,
                firstName: `MemoryStress${i}`,
                lastName: 'User',
                active: true
              })
              users.push(user)
            }
            
            // Read all users
            const allUsers = await userRepo.findAll()
            expect(allUsers.length).to.be.greaterThanOrEqual(1000)
            
            // Clean up
            for (const user of users) {
              await userRepo.delete(user.id)
            }
          })
          
          // Memory usage should be reasonable
          expect(delta.heapUsed).to.be.lessThan(200) // 200MB limit
        }))

        it('should handle rapid CRUD operations', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository<User>('users')
          
          // Test rapid CRUD operations
          const duration = await performanceHelper.measure('rapid-crud', async () => {
            const users: User[] = []
            
            // Create users
            for (let i = 0; i < 50; i++) {
              const user = await userRepo.create({
                id: `rapid-user-${i}`,
                email: `rapid${i}@example.com`,
                firstName: `Rapid${i}`,
                lastName: 'User',
                active: true
              })
              users.push(user)
            }
            
            // Update users
            for (const user of users) {
              user.firstName = `Updated${user.firstName}`
              await userRepo.update(user)
            }
            
            // Read users
            for (const user of users) {
              await userRepo.findById(user.id)
            }
            
            // Delete users
            for (const user of users) {
              await userRepo.delete(user.id)
            }
          })
          
          // Should handle rapid operations efficiently
          expect(duration).to.be.lessThan(15000) // 15 seconds max
        }))

        it('should handle long-running operations', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository<User>('users')
          
          // Test long-running operations
          const duration = await performanceHelper.measure('long-running', async () => {
            const users: User[] = []
            
            // Create users in batches
            for (let batch = 0; batch < 10; batch++) {
              const batchUsers: User[] = []
              
              for (let i = 0; i < 20; i++) {
                const user = await userRepo.create({
                  id: `long-user-${batch}-${i}`,
                  email: `long${batch}${i}@example.com`,
                  firstName: `Long${batch}${i}`,
                  lastName: 'User',
                  active: true
                })
                batchUsers.push(user)
              }
              
              users.push(...batchUsers)
              
              // Small delay between batches
              await new Promise(resolve => setTimeout(resolve, 10))
            }
            
            // Clean up
            for (const user of users) {
              await userRepo.delete(user.id)
            }
          })
          
          // Should handle long-running operations efficiently
          expect(duration).to.be.lessThan(30000) // 30 seconds max
        }))
      })
    }
  })

  describe('Relationship Stress Tests', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should handle large relationship graphs', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository<User>('users')
          const postRepo = db.getRepository<Post>('posts')
          const commentRepo = db.getRepository<Comment>('comments')
          
          // Create large relationship graph
          const users: User[] = []
          const posts: Post[] = []
          const comments: Comment[] = []
          
          // Create 50 users
          for (let i = 0; i < 50; i++) {
            const user = await userRepo.create({
              id: `graph-user-${i}`,
              email: `graph${i}@example.com`,
              firstName: `Graph${i}`,
              lastName: 'User',
              active: true
            })
            users.push(user)
          }
          
          // Create 200 posts (4 per user)
          for (let i = 0; i < 200; i++) {
            const post = await postRepo.create({
              id: `graph-post-${i}`,
              userId: users[i % 50].id,
              title: `Graph Post ${i}`,
              content: `Graph Content ${i}`,
              published: true
            })
            posts.push(post)
          }
          
          // Create 400 comments (2 per post)
          for (let i = 0; i < 400; i++) {
            const comment = await commentRepo.create({
              id: `graph-comment-${i}`,
              postId: posts[i % 200].id,
              userId: users[i % 50].id,
              content: `Graph Comment ${i}`
            })
            comments.push(comment)
          }
          
          // Test relationship loading performance
          const duration = await performanceHelper.measure('large-relationship-graph', async () => {
            // Load users with posts
            await userRepo.loadRelationships(users, ['posts'])
            
            // Load posts with comments
            await postRepo.loadRelationships(posts, ['comments'])
          })
          
          // Should handle large relationship graphs efficiently
          expect(duration).to.be.lessThan(10000) // 10 seconds max
          
          // Verify relationships are loaded
          for (const user of users) {
            expect(user.posts).to.exist
            expect(user.posts).to.be.an('array')
          }
          
          for (const post of posts) {
            expect(post.comments).to.exist
            expect(post.comments).to.be.an('array')
          }
          
          // Clean up
          for (const comment of comments) {
            await commentRepo.delete(comment.id)
          }
          for (const post of posts) {
            await postRepo.delete(post.id)
          }
          for (const user of users) {
            await userRepo.delete(user.id)
          }
        }))

        it('should handle deep relationship chains', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository<User>('users')
          const postRepo = db.getRepository<Post>('posts')
          const commentRepo = db.getRepository<Comment>('comments')
          
          // Create deep relationship chain
          const user = await userRepo.create({
            id: 'deep-user',
            email: 'deep@example.com',
            firstName: 'Deep',
            lastName: 'User',
            active: true
          })
          const posts: Post[] = []
          const comments: Comment[] = []
          
          // Create 20 posts
          for (let i = 0; i < 20; i++) {
            const post = await postRepo.create({
              id: `deep-post-${i}`,
              userId: user.id,
              title: `Deep Post ${i}`,
              content: `Deep Content ${i}`,
              published: true
            })
            posts.push(post)
            
            // Create 10 comments per post
            for (let j = 0; j < 10; j++) {
              const comment = await commentRepo.create({
                id: `deep-comment-${i}-${j}`,
                postId: post.id,
                userId: user.id,
                content: `Deep Comment ${i}-${j}`
              })
              comments.push(comment)
            }
          }
          
          // Test deep relationship loading performance
          const duration = await performanceHelper.measure('deep-relationship-chain', async () => {
            // Load user with posts
            const userWithPosts = await userRepo.findWithRelations(user.id, ['posts'])
            
            // Load each post with comments
            if (userWithPosts && userWithPosts.posts) {
              for (const post of userWithPosts.posts) {
                await postRepo.findWithRelations(post.id, ['comments'])
              }
            }
          })
          
          // Should handle deep relationship chains efficiently
          expect(duration).to.be.lessThan(5000) // 5 seconds max
          
          // Clean up
          for (const comment of comments) {
            await commentRepo.delete(comment.id)
          }
          for (const post of posts) {
            await postRepo.delete(post.id)
          }
          await userRepo.delete(user.id)
        }))
      })
    }
  })

  describe('Transaction Stress Tests', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should handle concurrent transactions', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Test concurrent transactions
          const start = performance.now()
          const promises: Promise<any>[] = []
          
          for (let i = 0; i < 20; i++) {
            promises.push(
              db.transaction(async (trx) => {
                const user = await trx
                  .insertInto('users')
                  .values({
                    id: `concurrent-tx-user-${i}`,
                    email: `concurrenttx${i}@example.com`,
                    firstName: `ConcurrentTx${i}`,
                    lastName: 'User',
                    active: true
                  })
                  .returningAll()
                  .executeTakeFirstOrThrow()
                
                return user
              })
            )
          }
          
          const results = await Promise.all(promises)
          const duration = performance.now() - start
          
          // Should handle concurrent transactions efficiently
          expect(duration).to.be.lessThan(10000) // 10 seconds max
          expect(results.length).to.equal(20)
          
          // Clean up
          const userRepo = db.getRepository<User>('users')
          for (const result of results) {
            await userRepo.delete(result.id)
          }
        }))

        it('should handle large transactions', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Test large transaction
          const duration = await performanceHelper.measure('large-transaction', async () => {
            const result = await db.transaction(async (trx) => {
              const users: any[] = []
              const posts: any[] = []
              
              // Create 100 users
              for (let i = 0; i < 100; i++) {
                const user = await trx
                  .insertInto('users')
                  .values({
                    id: `large-tx-user-${i}`,
                    email: `largetx${i}@example.com`,
                    firstName: `LargeTx${i}`,
                    lastName: 'User',
                    active: true
                  })
                  .returningAll()
                  .executeTakeFirstOrThrow()
                users.push(user)
              }
              
              // Create 200 posts
              for (let i = 0; i < 200; i++) {
                const post = await trx
                  .insertInto('posts')
                  .values({
                    id: `large-tx-post-${i}`,
                    userId: users[i % 100].id,
                    title: `Large Tx Post ${i}`,
                    content: `Large Tx Content ${i}`,
                    published: true
                  })
                  .returningAll()
                  .executeTakeFirstOrThrow()
                posts.push(post)
              }
              
              return { users, posts }
            })
            return result
          })
          
          // Should handle large transactions efficiently
          expect(duration).to.be.lessThan(15000) // 15 seconds max
          
          // Clean up
          const userRepo = db.getRepository<User>('users')
          const postRepo = db.getRepository<Post>('posts')
          
          for (let i = 0; i < 200; i++) {
            await postRepo.delete(`large-tx-post-${i}`)
          }
          for (let i = 0; i < 100; i++) {
            await userRepo.delete(`large-tx-user-${i}`)
          }
        }))

        it('should handle transaction rollbacks efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Test transaction rollback performance
          const duration = await performanceHelper.measure('transaction-rollbacks', async () => {
            const promises: Promise<void>[] = []
            
            // Create 50 transactions that will rollback
            for (let i = 0; i < 50; i++) {
              promises.push(
                db.transaction(async (trx) => {
                  // Create user
                  await trx
                    .insertInto('users')
                    .values({
                      id: `rollback-user-${i}`,
                      email: `rollback${i}@example.com`,
                      firstName: `Rollback${i}`,
                      lastName: 'User',
                      active: true
                    })
                    .execute()
                  
                  // Force rollback
                  throw new Error(`Rollback test ${i}`)
                }).catch(() => {
                  // Expected error
                })
              )
            }
            
            await Promise.all(promises)
          })
          
          // Should handle transaction rollbacks efficiently
          expect(duration).to.be.lessThan(10000) // 10 seconds max
          
          // Verify no users were created (all rolled back)
          const userRepo = db.getRepository<User>('users')
          for (let i = 0; i < 50; i++) {
            const user = await userRepo.findById(`rollback-user-${i}`)
            expect(user).to.be.null
          }
        }))
      })
    }
  })

  describe('Cache Stress Tests', () => {
    it('should handle cache stress efficiently', async () => {
      const { CacheManager } = await import('../../src/cache/cache-manager.js')
      const cache = new CacheManager({ maxSize: 10000 })
      
      // Test cache stress
      const duration = await performanceHelper.measure('cache-stress', async () => {
        const promises: Promise<void>[] = []
        
        // Concurrent cache operations
        for (let i = 0; i < 1000; i++) {
          promises.push(cache.set(`stress-key-${i}`, `stress-value-${i}`))
        }
        
        await Promise.all(promises)
        
        // Concurrent cache reads
        const readPromises: Promise<any>[] = []
        for (let i = 0; i < 1000; i++) {
          readPromises.push(Promise.resolve(cache.get(`stress-key-${i}`)))
        }
        
        await Promise.all(readPromises)
      })
      
      // Should handle cache stress efficiently
      expect(duration).to.be.lessThan(2000) // 2 seconds max
      
      // Verify cache state
      expect(cache.size()).to.equal(1000)
    })

    it('should handle cache memory stress efficiently', async () => {
      const { CacheManager } = await import('../../src/cache/cache-manager.js')
      const cache = new CacheManager({ maxSize: 5000 })
      
      // Test cache memory stress
      const { delta } = await memoryHelper.measureMemory(async () => {
        // Add large values to cache
        for (let i = 0; i < 1000; i++) {
          const largeValue = 'x'.repeat(1000) // 1KB string
          await cache.set(`memory-stress-key-${i}`, largeValue)
        }
        
        // Access all values
        for (let i = 0; i < 1000; i++) {
          cache.get(`memory-stress-key-${i}`)
        }
      })
      
      // Memory usage should be reasonable
      expect(delta.heapUsed).to.be.lessThan(100) // 100MB limit
    })
  })

  describe('System Resource Stress Tests', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should handle system resource constraints', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository<User>('users')
          
          // Test system resource constraints
          const duration = await performanceHelper.measure('system-resources', async () => {
            const promises: Promise<User>[] = []
            
            // Create many concurrent operations
            for (let i = 0; i < 50; i++) {
              promises.push(
                userRepo.create({
                  id: `resource-user-${i}`,
                  email: `resource${i}@example.com`,
                  firstName: `Resource${i}`,
                  lastName: 'User',
                  active: true
                })
              )
            }
            
            const users = await Promise.all(promises)
            
            // Perform many read operations
            const readPromises: Promise<User[]>[] = []
            for (let i = 0; i < 100; i++) {
              readPromises.push(userRepo.findAll())
            }
            
            await Promise.all(readPromises)
            
            // Clean up
            for (const user of users) {
              await userRepo.delete(user.id)
            }
          })
          
          // Should handle system resource constraints efficiently
          expect(duration).to.be.lessThan(20000) // 20 seconds max
        }))

        it('should handle memory pressure efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository<User>('users')
          
          // Test memory pressure
          const { delta } = await memoryHelper.measureMemory(async () => {
            const users: User[] = []
            
            // Create users in batches to simulate memory pressure
            for (let batch = 0; batch < 5; batch++) {
              const batchUsers: User[] = []
              
              for (let i = 0; i < 100; i++) {
                const user = await userRepo.create({
                  id: `pressure-user-${batch}-${i}`,
                  email: `pressure${batch}${i}@example.com`,
                  firstName: `Pressure${batch}${i}`,
                  lastName: 'User',
                  active: true
                })
                batchUsers.push(user)
              }
              
              users.push(...batchUsers)
              
              // Read all users to increase memory usage
              const allUsers = await userRepo.findAll()
              expect(allUsers.length).to.be.greaterThan(0)
            }
            
            // Clean up
            for (const user of users) {
              await userRepo.delete(user.id)
            }
          })
          
          // Memory usage should be reasonable even under pressure
          expect(delta.heapUsed).to.be.lessThan(300) // 300MB limit
        }))
      })
    }
  })
})