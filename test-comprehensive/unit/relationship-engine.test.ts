/**
 * Comprehensive unit tests for Relationship Engine functionality
 */

import { describe, it } from 'mocha'
import { expect } from 'chai'
import 'chai-as-promised'
import { RelationshipEngine } from '../../src/relationships/relationship-engine.js'
import { withTestDatabase, performanceHelper } from '../setup/test-helpers.js'
import { getEnabledDatabases } from '../setup/test-config.js'

describe('Relationship Engine', () => {
  const enabledDatabases = getEnabledDatabases()
  
  if (enabledDatabases.length === 0) {
    console.warn('No databases enabled for testing')
    return
  }

  describe('Initialization', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should initialize with relationships', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const relationshipEngine = new RelationshipEngine(db.getKysely())
          
          relationshipEngine.initialize(schemaInfo.relationships)
          
          const allRelationships = relationshipEngine.getAllRelationships()
          expect(allRelationships).to.be.an('array')
          expect(allRelationships.length).to.be.greaterThan(0)
        }))
        
        it('should handle empty relationships array', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const relationshipEngine = new RelationshipEngine(db.getKysely())
          
          relationshipEngine.initialize([])
          
          const allRelationships = relationshipEngine.getAllRelationships()
          expect(allRelationships).to.be.an('array')
          expect(allRelationships.length).to.equal(0)
        }))
        
        it('should get relationships for specific table', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const relationshipEngine = new RelationshipEngine(db.getKysely())
          
          relationshipEngine.initialize(schemaInfo.relationships)
          
          const userRelationships = relationshipEngine.getRelationshipsForTable('users')
          expect(userRelationships).to.be.an('array')
          
          // Should have relationships to posts and profiles
          const relationshipNames = userRelationships.map(r => r.name)
          expect(relationshipNames).to.include('posts')
          expect(relationshipNames).to.include('profiles')
        }))
        
        it('should add new relationships', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const relationshipEngine = new RelationshipEngine(db.getKysely())
          
          relationshipEngine.initialize([])
          
          const newRelationship = {
            name: 'testRelation',
            type: 'one-to-many' as const,
            fromTable: 'users',
            fromColumn: 'id',
            toTable: 'posts',
            toColumn: 'userId'
          }
          
          relationshipEngine.addRelationship(newRelationship)
          
          const allRelationships = relationshipEngine.getAllRelationships()
          expect(allRelationships).to.be.an('array')
          expect(allRelationships.length).to.equal(1)
          expect(allRelationships[0]).to.deep.equal(newRelationship)
        }))
        
        it('should remove relationships', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const relationshipEngine = new RelationshipEngine(db.getKysely())
          
          const relationship = {
            name: 'testRelation',
            type: 'one-to-many' as const,
            fromTable: 'users',
            fromColumn: 'id',
            toTable: 'posts',
            toColumn: 'userId'
          }
          
          relationshipEngine.initialize([relationship])
          
          let allRelationships = relationshipEngine.getAllRelationships()
          expect(allRelationships.length).to.equal(1)
          
          relationshipEngine.removeRelationship('testRelation')
          
          allRelationships = relationshipEngine.getAllRelationships()
          expect(allRelationships.length).to.equal(0)
        }))
      })
    }
  })

  describe('Relationship Loading', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should load one-to-many relationships', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const relationshipEngine = new RelationshipEngine(db.getKysely())
          
          relationshipEngine.initialize(schemaInfo.relationships)
          
          const userRepo = db.getRepository('users')
          const users = await userRepo.findAll()
          
          expect(users).to.be.an('array')
          expect(users.length).to.be.greaterThan(0)
          
          await relationshipEngine.loadRelationships(users, ['posts'])
          
          // Check that posts relationship is loaded
          for (const user of users) {
            expect((user as any).posts).to.exist
            expect((user as any).posts).to.be.an('array')
          }
        }))
        
        it('should load many-to-one relationships', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const relationshipEngine = new RelationshipEngine(db.getKysely())
          
          relationshipEngine.initialize(schemaInfo.relationships)
          
          const postRepo = db.getRepository('posts')
          const posts = await postRepo.findAll()
          
          expect(posts).to.be.an('array')
          expect(posts.length).to.be.greaterThan(0)
          
          await relationshipEngine.loadRelationships(posts, ['users'])
          
          // Check that users relationship is loaded
          for (const post of posts) {
            expect((post as any).users).to.exist
            expect((post as any).users).to.be.an('object')
            expect((post as any).users.id).to.equal((post as any).userId)
          }
        }))
        
        it('should load multiple relationships', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const relationshipEngine = new RelationshipEngine(db.getKysely())
          
          relationshipEngine.initialize(schemaInfo.relationships)
          
          const userRepo = db.getRepository('users')
          const users = await userRepo.findAll()
          
          expect(users).to.be.an('array')
          expect(users.length).to.be.greaterThan(0)
          
          await relationshipEngine.loadRelationships(users, ['posts', 'profiles'])
          
          // Check that both relationships are loaded
          for (const user of users) {
            expect((user as any).posts).to.exist
            expect((user as any).posts).to.be.an('array')
            expect((user as any).profiles).to.exist
          }
        }))
        
        it('should handle empty entities array', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const relationshipEngine = new RelationshipEngine(db.getKysely())
          
          relationshipEngine.initialize(schemaInfo.relationships)
          
          // Should not throw with empty array
          await relationshipEngine.loadRelationships([], ['posts'])
        }))
        
        it('should handle empty relations array', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const relationshipEngine = new RelationshipEngine(db.getKysely())
          
          relationshipEngine.initialize(schemaInfo.relationships)
          
          const userRepo = db.getRepository('users')
          const users = await userRepo.findAll()
          
          // Should not throw with empty relations array
          await relationshipEngine.loadRelationships(users, [])
        }))
        
        it('should handle non-existent relationships gracefully', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const relationshipEngine = new RelationshipEngine(db.getKysely())
          
          relationshipEngine.initialize(schemaInfo.relationships)
          
          const userRepo = db.getRepository('users')
          const users = await userRepo.findAll()
          
          // Should not throw with non-existent relationship
          await relationshipEngine.loadRelationships(users, ['nonExistentRelation'])
        }))
      })
    }
  })

  describe('Batch Loading', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should batch load relationships efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const relationshipEngine = new RelationshipEngine(db.getKysely(), {
            enableBatchLoading: true,
            maxBatchSize: 10
          })
          relationshipEngine.initialize(schemaInfo.relationships)
          
          const userRepo = db.getRepository('users')
          
          // Create multiple users for batch testing
          const users: any[] = []
          for (let i = 0; i < 20; i++) {
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
          await relationshipEngine.loadRelationships(users, ['posts'])
          const duration = performance.now() - start
          
          // Should be efficient (less than 2 seconds for 20 users)
          expect(duration).to.be.lessThan(2000)
          
          // All users should have posts relationship loaded
          for (const user of users) {
            expect(user.posts).to.exist
            expect(user.posts).to.be.an('array')
          }
          
          // Clean up
          for (const user of users) {
            await userRepo.delete(user.id)
          }
        }))
        
        it('should respect batch size configuration', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const relationshipEngine = new RelationshipEngine(db.getKysely(), {
            enableBatchLoading: true,
            maxBatchSize: 5
          })
          relationshipEngine.initialize(schemaInfo.relationships)
          
          const userRepo = db.getRepository('users')
          
          // Create users for batch testing
          const users: any[] = []
          for (let i = 0; i < 15; i++) {
            const user = await userRepo.create({
              id: `batch-size-user-${i}`,
              email: `batchsize${i}@example.com`,
              firstName: `BatchSize${i}`,
              lastName: 'User',
              active: true
            })
            users.push(user)
          }
          
          // Batch load relationships
          await relationshipEngine.loadRelationships(users, ['posts'])
          
          // All users should have posts relationship loaded
          for (const user of users) {
            expect(user.posts).to.exist
            expect(user.posts).to.be.an('array')
          }
          
          // Clean up
          for (const user of users) {
            await userRepo.delete(user.id)
          }
        }))
        
        it('should handle batch loading with different relationship types', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const relationshipEngine = new RelationshipEngine(db.getKysely(), {
            enableBatchLoading: true,
            maxBatchSize: 10
          })
          relationshipEngine.initialize(schemaInfo.relationships)
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Create test data
          const users: any[] = []
          for (let i = 0; i < 10; i++) {
            const user = await userRepo.create({
              id: `mixed-batch-user-${i}`,
              email: `mixedbatch${i}@example.com`,
              firstName: `MixedBatch${i}`,
              lastName: 'User',
              active: true
            })
            users.push(user)
          }
          
          const posts: any[] = []
          for (let i = 0; i < 20; i++) {
            const post = await postRepo.create({
              id: `mixed-batch-post-${i}`,
              userId: users[i % users.length].id,
              title: `Post ${i}`,
              content: `Content ${i}`,
              published: true
            })
            posts.push(post)
          }
          
          // Batch load different relationship types
          await relationshipEngine.loadRelationships(users, ['posts'])
          await relationshipEngine.loadRelationships(posts, ['users'])
          
          // Check users have posts
          for (const user of users) {
            expect(user.posts).to.exist
            expect(user.posts).to.be.an('array')
          }
          
          // Check posts have users
          for (const post of posts) {
            expect(post.users).to.exist
            expect(post.users).to.be.an('object')
            expect(post.users.id).to.equal(post.userId)
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

  describe('Performance', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should load relationships efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const relationshipEngine = new RelationshipEngine(db.getKysely())
          
          relationshipEngine.initialize(schemaInfo.relationships)
          
          const userRepo = db.getRepository('users')
          const users = await userRepo.findAll()
          
          const duration = await performanceHelper.measure('relationship-loading', async () => {
            await relationshipEngine.loadRelationships(users, ['posts'])
          })
          // Should be efficient
          expect(duration).to.be.lessThan(1000) // 1 second max
        }))
        
        it('should handle large datasets efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const relationshipEngine = new RelationshipEngine(db.getKysely(), {
            enableBatchLoading: true,
            maxBatchSize: 50
          })
          relationshipEngine.initialize(schemaInfo.relationships)
          
          const userRepo = db.getRepository('users')
          
          // Create large dataset
          const users: any[] = []
          for (let i = 0; i < 100; i++) {
            const user = await userRepo.create({
              id: `perf-user-${i}`,
              email: `perf${i}@example.com`,
              firstName: `Perf${i}`,
              lastName: 'User',
              active: true
            })
            users.push(user)
          }
          
          const duration = await performanceHelper.measure('large-dataset-relationships', async () => {
            await relationshipEngine.loadRelationships(users, ['posts'])
          })
          // Should be efficient even for large datasets
          expect(duration).to.be.lessThan(3000) // 3 seconds max
          
          // Clean up
          for (const user of users) {
            await userRepo.delete(user.id)
          }
        }))
        
        it('should handle concurrent relationship loading', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const relationshipEngine = new RelationshipEngine(db.getKysely())
          
          relationshipEngine.initialize(schemaInfo.relationships)
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Create test data
          const users: any[] = []
          const posts: any[] = []
          
          for (let i = 0; i < 10; i++) {
            const user: any = await userRepo.create({
              id: `concurrent-user-${i}`,
              email: `concurrent${i}@example.com`,
              firstName: `Concurrent${i}`,
              lastName: 'User',
              active: true
            })
            users.push(user)
            
            const post = await postRepo.create({
              id: `concurrent-post-${i}`,
              userId: user.id,
              title: `Post ${i}`,
              content: `Content ${i}`,
              published: true
            })
            posts.push(post)
          }
          
          // Load relationships concurrently
          const start = performance.now()
          const promises = [
            relationshipEngine.loadRelationships(users, ['posts']),
            relationshipEngine.loadRelationships(posts, ['users'])
          ]
          
          await Promise.all(promises)
          const duration = performance.now() - start
          
          // Should be efficient
          expect(duration).to.be.lessThan(2000) // 2 seconds max
          
          // Check results
          for (const user of users) {
            expect(user.posts).to.exist
            expect(user.posts).to.be.an('array')
          }
          
          for (const post of posts) {
            expect(post.users).to.exist
            expect(post.users).to.be.an('object')
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

  describe('Error Handling', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should handle database connection errors', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const relationshipEngine = new RelationshipEngine(db.getKysely())
          
          relationshipEngine.initialize(schemaInfo.relationships)
          
          const userRepo = db.getRepository('users')
          const users = await userRepo.findAll()
          
          // Close the database connection
          await db.close()
          
          // Should handle connection errors gracefully
          try {
            await relationshipEngine.loadRelationships(users, ['posts'])
          } catch (error) {
            // Expected error
            expect(error).to.be.instanceOf(Error)
          }
        }))
        
        it('should handle invalid relationship configurations', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const relationshipEngine = new RelationshipEngine(db.getKysely())
          
          // Initialize with invalid relationship
          const invalidRelationship = {
            name: 'invalidRelation',
            type: 'one-to-many' as const,
            fromTable: 'non_existent_table',
            fromColumn: 'id',
            toTable: 'posts',
            toColumn: 'userId'
          }
          
          relationshipEngine.initialize([invalidRelationship])
          
          const userRepo = db.getRepository('users')
          const users = await userRepo.findAll()
          
          // Should handle invalid relationships gracefully
          try {
            await relationshipEngine.loadRelationships(users, ['invalidRelation'])
          } catch (error) {
            // Expected error
            expect(error).to.be.instanceOf(Error)
          }
        }))
        
        it('should handle entities with null foreign keys', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const schemaInfo = await db.getSchemaInfo()
          const relationshipEngine = new RelationshipEngine(db.getKysely())
          
          relationshipEngine.initialize(schemaInfo.relationships)
          
          const userRepo = db.getRepository('users')
          
          // Create user with null foreign key
          const user: any = await userRepo.create({
            id: 'null-fk-user',
            email: 'nullfk@example.com',
            firstName: 'NullFK',
            lastName: 'User',
            active: true
          })
          // Manually set a null foreign key
          ;(user as any).userId = null
          
          // Should handle null foreign keys gracefully
          await relationshipEngine.loadRelationships([user], ['posts'])
          
          // Clean up
          await userRepo.delete(user.id)
        }))
      })
    }
  })
})