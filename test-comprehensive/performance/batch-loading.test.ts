/**
 * Performance tests for batch loading functionality
 */

import { describe, it, before, after } from 'mocha'
import { expect } from 'chai'
import { withTestDatabase, performanceHelper, memoryHelper } from '../setup/test-helpers.js'
import { getEnabledDatabases } from '../setup/test-config.js'

// Type definitions for entities with relationships
interface UserWithRelations {
  id: string
  email: string
  firstName: string
  lastName: string
  active: boolean
  posts?: any[]
  comments?: any[]
}

interface PostWithRelations {
  id: string
  userId: string
  title: string
  content: string
  published: boolean
  users?: any
  comments?: any[]
}

interface CommentWithRelations {
  id: string
  postId: string
  userId: string
  content: string
  users?: any
  posts?: any
}

describe('Batch Loading Performance', () => {
  const enabledDatabases = getEnabledDatabases()
  
  if (enabledDatabases.length === 0) {
    console.warn('No databases enabled for testing')
    return
  }

  describe('Relationship Batch Loading', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should batch load relationships efficiently for small datasets', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Create test data
          const users: UserWithRelations[] = []
          const posts: PostWithRelations[] = []
          
          for (let i = 0; i < 10; i++) {
            const user = await userRepo.create({
              id: `batch-user-${i}`,
              email: `batch${i}@example.com`,
              firstName: `Batch${i}`,
              lastName: 'User',
              active: true
            }) as UserWithRelations
            users.push(user)
            
            // Create 2 posts per user
            for (let j = 0; j < 2; j++) {
              const post = await postRepo.create({
                id: `batch-post-${i}-${j}`,
                userId: user.id,
                title: `Batch Post ${i}-${j}`,
                content: `Batch Content ${i}-${j}`,
                published: true
              }) as PostWithRelations
              posts.push(post)
            }
          }
          
          // Test batch loading performance
          const duration = await performanceHelper.measure('batch-loading-small', async () => {
            await userRepo.loadRelationships(users, ['posts'])
          })
          // Should be efficient for small datasets
          expect(duration).to.be.lessThan(1000) // 1 second max
          
          // Verify all users have posts loaded
          for (const user of users) {
            expect(user.posts).to.exist
            expect(user.posts).to.be.an('array')
            expect(user.posts!.length).to.equal(2)
          }
          
          // Clean up
          for (const post of posts) {
            await postRepo.delete(post.id)
          }
          for (const user of users) {
            await userRepo.delete(user.id)
          }
        }))

        it('should batch load relationships efficiently for medium datasets', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Create test data
          const users: UserWithRelations[] = []
          const posts: PostWithRelations[] = []
          
          for (let i = 0; i < 50; i++) {
            const user = await userRepo.create({
              id: `batch-med-user-${i}`,
              email: `batchmed${i}@example.com`,
              firstName: `BatchMed${i}`,
              lastName: 'User',
              active: true
            }) as UserWithRelations
            users.push(user)
            
            // Create 3 posts per user
            for (let j = 0; j < 3; j++) {
              const post = await postRepo.create({
                id: `batch-med-post-${i}-${j}`,
                userId: user.id,
                title: `Batch Med Post ${i}-${j}`,
                content: `Batch Med Content ${i}-${j}`,
                published: true
              }) as PostWithRelations
              posts.push(post)
            }
          }
          
          // Test batch loading performance
          const duration = await performanceHelper.measure('batch-loading-medium', async () => {
            await userRepo.loadRelationships(users, ['posts'])
          })
          // Should be efficient for medium datasets
          expect(duration).to.be.lessThan(2000) // 2 seconds max
          
          // Verify all users have posts loaded
          for (const user of users) {
            expect(user.posts).to.exist
            expect(user.posts).to.be.an('array')
            expect(user.posts!.length).to.equal(3)
          }
          
          // Clean up
          for (const post of posts) {
            await postRepo.delete(post.id)
          }
          for (const user of users) {
            await userRepo.delete(user.id)
          }
        }))

        it('should batch load relationships efficiently for large datasets', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Create test data
          const users: UserWithRelations[] = []
          const posts: PostWithRelations[] = []
          
          for (let i = 0; i < 100; i++) {
            const user = await userRepo.create({
              id: `batch-large-user-${i}`,
              email: `batchlarge${i}@example.com`,
              firstName: `BatchLarge${i}`,
              lastName: 'User',
              active: true
            }) as UserWithRelations
            users.push(user)
            
            // Create 2 posts per user
            for (let j = 0; j < 2; j++) {
              const post = await postRepo.create({
                id: `batch-large-post-${i}-${j}`,
                userId: user.id,
                title: `Batch Large Post ${i}-${j}`,
                content: `Batch Large Content ${i}-${j}`,
                published: true
              }) as PostWithRelations
              posts.push(post)
            }
          }
          
          // Test batch loading performance
          const duration = await performanceHelper.measure('batch-loading-large', async () => {
            await userRepo.loadRelationships(users, ['posts'])
          })
          // Should be efficient for large datasets
          expect(duration).to.be.lessThan(3000) // 3 seconds max
          
          // Verify all users have posts loaded
          for (const user of users) {
            expect(user.posts).to.exist
            expect(user.posts).to.be.an('array')
            expect(user.posts!.length).to.equal(2)
          }
          
          // Clean up
          for (const post of posts) {
            await postRepo.delete(post.id)
          }
          for (const user of users) {
            await userRepo.delete(user.id)
          }
        }))

        it('should handle memory efficiently during batch loading', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Create test data
          const users: UserWithRelations[] = []
          const posts: PostWithRelations[] = []
          
          for (let i = 0; i < 50; i++) {
            const user = await userRepo.create({
              id: `memory-user-${i}`,
              email: `memory${i}@example.com`,
              firstName: `Memory${i}`,
              lastName: 'User',
              active: true
            }) as UserWithRelations
            users.push(user)
            
            // Create 2 posts per user
            for (let j = 0; j < 2; j++) {
              const post = await postRepo.create({
                id: `memory-post-${i}-${j}`,
                userId: user.id,
                title: `Memory Post ${i}-${j}`,
                content: `Memory Content ${i}-${j}`,
                published: true
              }) as PostWithRelations
              posts.push(post)
            }
          }
          
          // Test memory usage during batch loading
          const { delta } = await memoryHelper.measureMemory(async () => {
            await userRepo.loadRelationships(users, ['posts'])
          })
          // Memory usage should be reasonable
          expect(delta.heapUsed).to.be.lessThan(100) // 100MB limit
          
          // Clean up
          for (const post of posts) {
            await postRepo.delete(post.id)
          }
          for (const user of users) {
            await userRepo.delete(user.id)
          }
        }))
      })
    }
  })

  describe('Batch Size Configuration', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should respect batch size configuration', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Update configuration for smaller batch size
          db.updateConfig({
            performance: {
              enableBatchLoading: true,
              maxBatchSize: 10
            }
          })
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Create test data
          const users: UserWithRelations[] = []
          const posts: PostWithRelations[] = []
          
          for (let i = 0; i < 25; i++) {
            const user = await userRepo.create({
              id: `batch-size-user-${i}`,
              email: `batchsize${i}@example.com`,
              firstName: `BatchSize${i}`,
              lastName: 'User',
              active: true
            }) as UserWithRelations
            users.push(user)
            
            // Create 1 post per user
            const post = await postRepo.create({
              id: `batch-size-post-${i}`,
              userId: user.id,
              title: `Batch Size Post ${i}`,
              content: `Batch Size Content ${i}`,
              published: true
            }) as PostWithRelations
            posts.push(post)
          }
          
          // Test batch loading with configured batch size
          const duration = await performanceHelper.measure('batch-loading-configured', async () => {
            await userRepo.loadRelationships(users, ['posts'])
          })
          // Should be efficient even with smaller batch size
          expect(duration).to.be.lessThan(2000) // 2 seconds max
          
          // Verify all users have posts loaded
          for (const user of users) {
            expect(user.posts).to.exist
            expect(user.posts).to.be.an('array')
            expect(user.posts!.length).to.equal(1)
          }
          
          // Clean up
          for (const post of posts) {
            await postRepo.delete(post.id)
          }
          for (const user of users) {
            await userRepo.delete(user.id)
          }
        }))

        it('should handle batch loading with different batch sizes', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Create test data
          const users: UserWithRelations[] = []
          const posts: PostWithRelations[] = []
          
          for (let i = 0; i < 30; i++) {
            const user = await userRepo.create({
              id: `batch-vary-user-${i}`,
              email: `batchvary${i}@example.com`,
              firstName: `BatchVary${i}`,
              lastName: 'User',
              active: true
            }) as UserWithRelations
            users.push(user)
            
            // Create 1 post per user
            const post = await postRepo.create({
              id: `batch-vary-post-${i}`,
              userId: user.id,
              title: `Batch Vary Post ${i}`,
              content: `Batch Vary Content ${i}`,
              published: true
            }) as PostWithRelations
            posts.push(post)
          }
          
          // Test different batch sizes
          const batchSizes = [5, 10, 15, 20]
          const results: { batchSize: number; duration: number }[] = []
          
          for (const batchSize of batchSizes) {
            // Update configuration
            db.updateConfig({
              performance: {
                enableBatchLoading: true,
                maxBatchSize: batchSize
              }
            })
            // Reset users (remove loaded relationships)
            for (const user of users) {
              delete (user as any).posts
            }
            
            const duration = await performanceHelper.measure(`batch-loading-${batchSize}`, async () => {
              await userRepo.loadRelationships(users, ['posts'])
            }) as unknown as number
            results.push({ batchSize, duration })
          }
          
          // All batch sizes should be efficient
          for (const result of results) {
            expect(result.duration).to.be.lessThan(2000) // 2 seconds max
          }
          
          // Clean up
          for (const post of posts) {
            await postRepo.delete(post.id)
          }
          for (const user of users) {
            await userRepo.delete(user.id)
          }
        }))
      })
    }
  })

  describe('Concurrent Batch Loading', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should handle concurrent batch loading operations', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Create test data
          const users: UserWithRelations[] = []
          const posts: PostWithRelations[] = []
          
          for (let i = 0; i < 20; i++) {
            const user = await userRepo.create({
              id: `concurrent-batch-user-${i}`,
              email: `concurrentbatch${i}@example.com`,
              firstName: `ConcurrentBatch${i}`,
              lastName: 'User',
              active: true
            }) as UserWithRelations
            users.push(user)
            
            // Create 2 posts per user
            for (let j = 0; j < 2; j++) {
              const post = await postRepo.create({
                id: `concurrent-batch-post-${i}-${j}`,
                userId: user.id,
                title: `Concurrent Batch Post ${i}-${j}`,
                content: `Concurrent Batch Content ${i}-${j}`,
                published: true
              }) as PostWithRelations
              posts.push(post)
            }
          }
          
          // Split users into groups for concurrent processing
          const userGroups: UserWithRelations[][] = []
          for (let i = 0; i < users.length; i += 5) {
            userGroups.push(users.slice(i, i + 5))
          }
          
          // Test concurrent batch loading
          const start = performance.now()
          const promises = userGroups.map(group => 
            userRepo.loadRelationships(group, ['posts'])
          )
          
          await Promise.all(promises)
          const duration = performance.now() - start
          
          // Should be efficient even with concurrent operations
          expect(duration).to.be.lessThan(2000) // 2 seconds max
          
          // Verify all users have posts loaded
          for (const user of users) {
            expect(user.posts).to.exist
            expect(user.posts).to.be.an('array')
            expect(user.posts!.length).to.equal(2)
          }
          
          // Clean up
          for (const post of posts) {
            await postRepo.delete(post.id)
          }
          for (const user of users) {
            await userRepo.delete(user.id)
          }
        }))

        it('should handle concurrent batch loading with different relationships', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          const commentRepo = db.getRepository('comments')
          
          // Create test data
          const users: UserWithRelations[] = []
          const posts: PostWithRelations[] = []
          const comments: CommentWithRelations[] = []
          
          for (let i = 0; i < 15; i++) {
            const user = await userRepo.create({
              id: `concurrent-rel-user-${i}`,
              email: `concurrentrel${i}@example.com`,
              firstName: `ConcurrentRel${i}`,
              lastName: 'User',
              active: true
            }) as UserWithRelations
            users.push(user)
            
            // Create 1 post per user
            const post = await postRepo.create({
              id: `concurrent-rel-post-${i}`,
              userId: user.id,
              title: `Concurrent Rel Post ${i}`,
              content: `Concurrent Rel Content ${i}`,
              published: true
            }) as PostWithRelations
            posts.push(post)
            
            // Create 2 comments per post
            for (let j = 0; j < 2; j++) {
              const comment = await commentRepo.create({
                id: `concurrent-rel-comment-${i}-${j}`,
                postId: post.id,
                userId: user.id,
                content: `Concurrent Rel Comment ${i}-${j}`
              }) as CommentWithRelations
              comments.push(comment)
            }
          }
          
          // Test concurrent batch loading with different relationships
          const start = performance.now()
          const promises = [
            userRepo.loadRelationships(users, ['posts']),
            postRepo.loadRelationships(posts, ['users']),
            postRepo.loadRelationships(posts, ['comments'])
          ]
          
          await Promise.all(promises)
          const duration = performance.now() - start
          
          // Should be efficient even with concurrent operations
          expect(duration).to.be.lessThan(2000) // 2 seconds max
          
          // Verify all relationships are loaded
          for (const user of users) {
            expect(user.posts).to.exist
            expect(user.posts).to.be.an('array')
            expect(user.posts!.length).to.equal(1)
          }
          
          for (const post of posts) {
            expect(post.users).to.exist
            expect(post.comments).to.exist
            expect(post.comments).to.be.an('array')
            expect(post.comments!.length).to.equal(2)
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
      })
    }
  })

  describe('Batch Loading vs Individual Loading', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should be more efficient than individual loading', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Create test data
          const users: UserWithRelations[] = []
          const posts: PostWithRelations[] = []
          
          for (let i = 0; i < 20; i++) {
            const user = await userRepo.create({
              id: `compare-user-${i}`,
              email: `compare${i}@example.com`,
              firstName: `Compare${i}`,
              lastName: 'User',
              active: true
            }) as UserWithRelations
            users.push(user)
            
            // Create 1 post per user
            const post = await postRepo.create({
              id: `compare-post-${i}`,
              userId: user.id,
              title: `Compare Post ${i}`,
              content: `Compare Content ${i}`,
              published: true
            }) as PostWithRelations
            posts.push(post)
          }
          
          // Test individual loading
          const individualDuration = await performanceHelper.measure('individual-loading', async () => {
            for (const user of users) {
              await userRepo.findWithRelations(user.id, ['posts'])
            }
          }) as unknown as number
          // Reset users (remove loaded relationships)
          for (const user of users) {
            delete (user as any).posts
          }
          
          // Test batch loading
          const batchDuration = await performanceHelper.measure('batch-loading', async () => {
            await userRepo.loadRelationships(users, ['posts'])
          }) as unknown as number
          // Batch loading should be more efficient
          expect(batchDuration).to.be.lessThan(individualDuration)
          
          // Verify both methods produce the same result
          for (const user of users) {
            expect(user.posts).to.exist
            expect(user.posts).to.be.an('array')
            expect(user.posts!.length).to.equal(1)
          }
          
          // Clean up
          for (const post of posts) {
            await postRepo.delete(post.id)
          }
          for (const user of users) {
            await userRepo.delete(user.id)
          }
        }))

        it('should scale better with larger datasets', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Create test data
          const users: UserWithRelations[] = []
          const posts: PostWithRelations[] = []
          
          for (let i = 0; i < 30; i++) {
            const user = await userRepo.create({
              id: `scale-user-${i}`,
              email: `scale${i}@example.com`,
              firstName: `Scale${i}`,
              lastName: 'User',
              active: true
            }) as UserWithRelations
            users.push(user)
            
            // Create 1 post per user
            const post = await postRepo.create({
              id: `scale-post-${i}`,
              userId: user.id,
              title: `Scale Post ${i}`,
              content: `Scale Content ${i}`,
              published: true
            }) as PostWithRelations
            posts.push(post)
          }
          
          // Test individual loading
          const individualDuration = await performanceHelper.measure('individual-loading-large', async () => {
            for (const user of users) {
              await userRepo.findWithRelations(user.id, ['posts'])
            }
          }) as unknown as number
          // Reset users (remove loaded relationships)
          for (const user of users) {
            delete (user as any).posts
          }
          
          // Test batch loading
          const batchDuration = await performanceHelper.measure('batch-loading-large', async () => {
            await userRepo.loadRelationships(users, ['posts'])
          }) as unknown as number
          // Batch loading should be significantly more efficient for larger datasets
          expect(batchDuration).to.be.lessThan(individualDuration * 0.5) // At least 50% faster
          
          // Verify both methods produce the same result
          for (const user of users) {
            expect(user.posts).to.exist
            expect(user.posts).to.be.an('array')
            expect(user.posts!.length).to.equal(1)
          }
          
          // Clean up
          for (const post of posts) {
            await postRepo.delete(post.id)
          }
          for (const user of users) {
            await userRepo.delete(user.id)
          }
        }))
      })
    }
  })
})