/**
 * Comprehensive integration tests for database operations
 * New implementation with proper TypeScript typing and class-based architecture
 */

import { describe, it } from 'mocha'
import { expect } from 'chai'
import { withTestDatabase, withMultipleDatabases, performanceHelper } from '../setup/test-helpers.js'
import { getEnabledDatabases } from '../setup/test-config.js'

// Define proper TypeScript interfaces for database operations
interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  active: boolean
  age?: number
}

interface Post {
  id: string
  userId: string
  title: string
  content: string
  published: boolean
}

interface Comment {
  id: string
  postId: string
  userId: string
  content: string
}

interface UserWithRelations extends User {
  posts?: Post[]
  comments?: Comment[]
}

interface PostWithRelations extends Post {
  user?: User
  comments?: Comment[]
}

interface PerformanceMetrics {
  createTime: number
  readTime: number
  updateTime: number
  deleteTime: number
  totalTime: number
}

/**
 * Database Operations Integration Test Suite
 * Tests comprehensive database operations and performance
 */
class DatabaseOperationsTestSuite {
  private enabledDatabases: ('sqlite' | 'postgresql' | 'mysql' | 'mssql')[]

  constructor() {
    this.enabledDatabases = getEnabledDatabases()
    
    if (this.enabledDatabases.length === 0) {
      console.warn('No databases enabled for testing')
    }
  }

  /**
   * Test complete CRUD lifecycle
   */
  async testCrudLifecycle(db: any): Promise<void> {
    const userRepo = db.getRepository('users')
    
    // Create
    const newUser = await userRepo.create({
      id: 'crud-user',
      email: 'crud@example.com',
      firstName: 'CRUD',
      lastName: 'User',
      active: true
    }) as User
    
    expect(newUser).to.exist
    expect(newUser.id).to.equal('crud-user')
    expect(newUser.email).to.equal('crud@example.com')
    
    // Read
    const foundUser = await userRepo.findById('crud-user') as User
    expect(foundUser).to.exist
    expect(foundUser?.id).to.equal('crud-user')
    expect(foundUser?.email).to.equal('crud@example.com')
    
    // Update
    if (foundUser) {
      foundUser.firstName = 'Updated'
      foundUser.lastName = 'Name'
      
      const updatedUser = await userRepo.update(foundUser) as User
      expect(updatedUser.firstName).to.equal('Updated')
      expect(updatedUser.lastName).to.equal('Name')
    }
    
    // Delete
    const deleted = await userRepo.delete('crud-user')
    expect(deleted).to.be.true
    
    // Verify deletion
    const deletedUser = await userRepo.findById('crud-user')
    expect(deletedUser).to.be.null
  }

  /**
   * Test bulk operations
   */
  async testBulkOperations(db: any): Promise<void> {
    const userRepo = db.getRepository('users')
    
    // Create multiple users
    const users: User[] = []
    for (let i = 0; i < 10; i++) {
      const user = await userRepo.create({
        id: `bulk-user-${i}`,
        email: `bulk${i}@example.com`,
        firstName: `Bulk${i}`,
        lastName: 'User',
        active: true
      }) as User
      users.push(user)
    }
    
    expect(users.length).to.equal(10)
    
    // Read all users
    const allUsers = await userRepo.findAll() as User[]
    const bulkUsers = allUsers.filter(user => user.id.startsWith('bulk-user-'))
    expect(bulkUsers.length).to.equal(10)
    
    // Update all users
    for (const user of users) {
      const userToUpdate = await userRepo.findById(user.id) as User
      if (userToUpdate) {
        userToUpdate.firstName = `Updated${userToUpdate.firstName}`
        await userRepo.update(userToUpdate)
      }
    }
    
    // Verify updates
    for (const user of users) {
      const updatedUser = await userRepo.findById(user.id) as User
      expect(updatedUser?.firstName).to.equal(`Updated${user.firstName}`)
    }
    
    // Delete all users
    for (const user of users) {
      const deleted = await userRepo.delete(user.id)
      expect(deleted).to.be.true
    }
    
    // Verify deletions
    for (const user of users) {
      const deletedUser = await userRepo.findById(user.id)
      expect(deletedUser).to.be.null
    }
  }

  /**
   * Test complex data types
   */
  async testComplexDataTypes(db: any): Promise<void> {
    const userRepo = db.getRepository('users')
    
    // Create user with various data types
    const user = await userRepo.create({
      id: 'complex-user',
      email: 'complex@example.com',
      firstName: 'Complex',
      lastName: 'User',
      age: 30,
      active: true
    }) as User
    
    expect(user).to.exist
    expect(user.id).to.equal('complex-user')
    expect(user.email).to.equal('complex@example.com')
    expect(user.firstName).to.equal('Complex')
    expect(user.lastName).to.equal('User')
    expect(user.age).to.equal(30)
    expect(user.active).to.be.true
    
    // Clean up
    await userRepo.delete('complex-user')
  }

  /**
   * Test one-to-many relationships
   */
  async testOneToManyRelationships(db: any): Promise<void> {
    const userRepo = db.getRepository('users')
    const postRepo = db.getRepository('posts')
    
    // Create user and posts
    const user = await userRepo.create({
      id: 'rel-user',
      email: 'rel@example.com',
      firstName: 'Rel',
      lastName: 'User',
      active: true
    }) as User
    
    const posts: Post[] = []
    for (let i = 0; i < 3; i++) {
      const post = await postRepo.create({
        id: `rel-post-${i}`,
        userId: user.id,
        title: `Post ${i}`,
        content: `Content ${i}`,
        published: true
      }) as Post
      posts.push(post)
    }
    
    // Load user with posts
    const userWithPosts = await userRepo.findWithRelations(user.id, ['posts']) as UserWithRelations
    
    expect(userWithPosts).to.exist
    expect(userWithPosts?.posts).to.exist
    expect(userWithPosts?.posts).to.be.an('array')
    expect(userWithPosts?.posts?.length).to.equal(3)
    
    // Verify posts
    if (userWithPosts?.posts) {
      for (const post of userWithPosts.posts) {
        expect(post.userId).to.equal(user.id)
        expect(post.title).to.include('Post')
      }
    }
    
    // Clean up
    for (const post of posts) {
      await postRepo.delete(post.id)
    }
    await userRepo.delete(user.id)
  }

  /**
   * Test many-to-one relationships
   */
  async testManyToOneRelationships(db: any): Promise<void> {
    const userRepo = db.getRepository('users')
    const postRepo = db.getRepository('posts')
    
    // Create user and post
    const user = await userRepo.create({
      id: 'rel-user-2',
      email: 'rel2@example.com',
      firstName: 'Rel2',
      lastName: 'User',
      active: true
    }) as User
    
    const post = await postRepo.create({
      id: 'rel-post-single',
      userId: user.id,
      title: 'Single Post',
      content: 'Single content',
      published: true
    }) as Post
    
    // Load post with user
    const postWithUser = await postRepo.findWithRelations(post.id, ['user']) as PostWithRelations
    
    expect(postWithUser).to.exist
    expect(postWithUser?.user).to.exist
    expect(postWithUser?.user?.id).to.equal(user.id)
    expect(postWithUser?.user?.email).to.equal(user.email)
    
    // Clean up
    await postRepo.delete(post.id)
    await userRepo.delete(user.id)
  }

  /**
   * Test complex relationships with comments
   */
  async testComplexRelationships(db: any): Promise<void> {
    const userRepo = db.getRepository('users')
    const postRepo = db.getRepository('posts')
    const commentRepo = db.getRepository('comments')
    
    // Create user, post, and comments
    const user = await userRepo.create({
      id: 'complex-rel-user',
      email: 'complex-rel@example.com',
      firstName: 'ComplexRel',
      lastName: 'User',
      active: true
    }) as User
    
    const post = await postRepo.create({
      id: 'complex-rel-post',
      userId: user.id,
      title: 'Complex Post',
      content: 'Complex content',
      published: true
    }) as Post
    
    const comments: Comment[] = []
    for (let i = 0; i < 3; i++) {
      const comment = await commentRepo.create({
        id: `complex-rel-comment-${i}`,
        postId: post.id,
        userId: user.id,
        content: `Comment ${i}`
      }) as Comment
      comments.push(comment)
    }
    
    // Load post with comments and user
    const postWithRelations = await postRepo.findWithRelations(post.id, ['user', 'comments']) as PostWithRelations
    
    expect(postWithRelations).to.exist
    expect(postWithRelations?.user).to.exist
    expect(postWithRelations?.comments).to.exist
    expect(postWithRelations?.comments?.length).to.equal(3)
    
    // Verify relationships
    if (postWithRelations?.user) {
      expect(postWithRelations.user.id).to.equal(user.id)
    }
    
    if (postWithRelations?.comments) {
      for (const comment of postWithRelations.comments) {
        expect(comment.postId).to.equal(post.id)
        expect(comment.userId).to.equal(user.id)
      }
    }
    
    // Clean up
    for (const comment of comments) {
      await commentRepo.delete(comment.id)
    }
    await postRepo.delete(post.id)
    await userRepo.delete(user.id)
  }

  /**
   * Test performance with large datasets
   */
  async testPerformanceWithLargeDatasets(db: any): Promise<void> {
    const userRepo = db.getRepository('users')
    const postRepo = db.getRepository('posts')
    
    // Create large dataset
    const users: User[] = []
    const posts: Post[] = []
    
    // Create 100 users
    for (let i = 0; i < 100; i++) {
      const user = await userRepo.create({
        id: `perf-user-${i}`,
        email: `perf${i}@example.com`,
        firstName: `Perf${i}`,
        lastName: 'User',
        active: true
      }) as User
      users.push(user)
    }
    
    // Create 500 posts
    for (let i = 0; i < 500; i++) {
      const post = await postRepo.create({
        id: `perf-post-${i}`,
        userId: users[i % users.length].id,
        title: `Performance Post ${i}`,
        content: `Performance content ${i}`,
        published: true
      }) as Post
      posts.push(post)
    }
    
    // Test performance
    const duration = await performanceHelper.measure('large-dataset-operations', async () => {
      // Bulk read operations
      const allUsers = await userRepo.findAll()
      const allPosts = await postRepo.findAll()
      
      // Update operations
      for (const user of users.slice(0, 10)) {
        const userToUpdate = await userRepo.findById(user.id) as User
        if (userToUpdate) {
          userToUpdate.firstName = `Updated${userToUpdate.firstName}`
          await userRepo.update(userToUpdate)
        }
      }
      
      // Delete operations
      for (const post of posts.slice(0, 10)) {
        await postRepo.delete(post.id)
      }
    })
    
    // Should complete within reasonable time
    expect(duration).to.be.lessThan(10000) // 10 seconds max
    
    // Clean up remaining data
    for (const post of posts.slice(10)) {
      await postRepo.delete(post.id)
    }
    
    for (const user of users) {
      await userRepo.delete(user.id)
    }
  }

  /**
   * Test transaction handling
   */
  async testTransactionHandling(db: any): Promise<void> {
    const userRepo = db.getRepository('users')
    const postRepo = db.getRepository('posts')
    
    // Test successful transaction
    const result = await db.transaction(async (trx) => {
      const user = await userRepo.create({
        id: 'tx-user',
        email: 'tx@example.com',
        firstName: 'Tx',
        lastName: 'User',
        active: true
      }, trx) as User
      
      const post = await postRepo.create({
        id: 'tx-post',
        userId: user.id,
        title: 'Transaction Post',
        content: 'Transaction content',
        published: true
      }, trx) as Post
      
      return { user, post }
    })
    
    expect(result).to.exist
    expect(result.user.id).to.equal('tx-user')
    expect(result.post.id).to.equal('tx-post')
    
    // Verify data was committed
    const savedUser = await userRepo.findById('tx-user') as User
    const savedPost = await postRepo.findById('tx-post') as Post
    
    expect(savedUser).to.exist
    expect(savedPost).to.exist
    expect(savedPost?.userId).to.equal(savedUser?.id)
    
    // Test failed transaction (rollback)
    try {
      await db.transaction(async (trx) => {
        await userRepo.create({
          id: 'tx-fail-user',
          email: 'tx-fail@example.com',
          firstName: 'TxFail',
          lastName: 'User',
          active: true
        }, trx)
        
        // Simulate error
        throw new Error('Transaction failed')
      })
    } catch (error) {
      expect(error.message).to.equal('Transaction failed')
    }
    
    // Verify rollback - user should not exist
    const failedUser = await userRepo.findById('tx-fail-user')
    expect(failedUser).to.be.null
    
    // Clean up
    await postRepo.delete('tx-post')
    await userRepo.delete('tx-user')
  }

  /**
   * Test concurrent operations
   */
  async testConcurrentOperations(db: any): Promise<void> {
    const userRepo = db.getRepository('users')
    
    // Create initial user
    const user = await userRepo.create({
      id: 'concurrent-user',
      email: 'concurrent@example.com',
      firstName: 'Concurrent',
      lastName: 'User',
      active: true
    }) as User
    
    // Test concurrent updates
    const updatePromises: Promise<any>[] = []
    for (let i = 0; i < 10; i++) {
      updatePromises.push(
        userRepo.update({
          ...user,
          firstName: `Concurrent${i}`
        })
      )
    }
    
    await Promise.all(updatePromises)
    
    // Verify final state
    const finalUser = await userRepo.findById('concurrent-user') as User
    expect(finalUser).to.exist
    expect(finalUser?.firstName).to.match(/^Concurrent\d+$/)
    
    // Clean up
    await userRepo.delete('concurrent-user')
  }

  /**
   * Test error handling
   */
  async testErrorHandling(db: any): Promise<void> {
    const userRepo = db.getRepository('users')
    
    // Test duplicate key error
    await userRepo.create({
      id: 'error-user',
      email: 'error@example.com',
      firstName: 'Error',
      lastName: 'User',
      active: true
    })
    
    try {
      await userRepo.create({
        id: 'error-user', // Duplicate ID
        email: 'error2@example.com',
        firstName: 'Error2',
        lastName: 'User2',
        active: true
      })
      expect.fail('Should have thrown duplicate key error')
    } catch (error) {
      expect(error).to.exist
      // Error should be related to duplicate key
    }
    
    // Test not found error
    const notFoundUser = await userRepo.findById('non-existent-user')
    expect(notFoundUser).to.be.null
    
    // Clean up
    await userRepo.delete('error-user')
  }

  /**
   * Test multi-database operations
   */
  async testMultiDatabaseOperations(databases: Array<{ db: any; dialect: string }>): Promise<void> {
    const results: Array<{ db: any; dialect: string; user: User }> = []
    
    for (const { db, dialect } of databases) {
      
      
      const userRepo = db.getRepository('users')
      
      // Create user in each database
      const user = await userRepo.create({
        id: `multi-db-user-${dialect}`,
        email: `multi-db-${dialect}@example.com`,
        firstName: `Multi${dialect}`,
        lastName: 'User',
        active: true
      }) as User
      
      results.push({ db, dialect, user })
    }
    
    // Verify users exist in all databases
    for (const { db, dialect, user } of results) {
      const userRepo = db.getRepository('users')
      const foundUser = await userRepo.findById(user.id) as User
      
      expect(foundUser).to.exist
      expect(foundUser?.id).to.equal(user.id)
      expect(foundUser?.email).to.equal(user.email)
      
      // Clean up
      await userRepo.delete(user.id)
    }
  }

  /**
   * Run all tests for a specific database dialect
   */
  async runTestsForDialect(dialect: 'sqlite' | 'postgresql' | 'mysql' | 'mssql'): Promise<void> {
    describe(`${dialect.toUpperCase()}`, () => {
      it('should perform complete CRUD lifecycle', withTestDatabase(dialect, async (testDb) => {
        const { db } = testDb
        
        await this.testCrudLifecycle(db)
      }))

      it('should handle bulk operations', withTestDatabase(dialect, async (testDb) => {
        const { db } = testDb
        
        await this.testBulkOperations(db)
      }))

      it('should handle complex data types', withTestDatabase(dialect, async (testDb) => {
        const { db } = testDb
        
        await this.testComplexDataTypes(db)
      }))

      it('should load one-to-many relationships', withTestDatabase(dialect, async (testDb) => {
        const { db } = testDb
        
        await this.testOneToManyRelationships(db)
      }))

      it('should load many-to-one relationships', withTestDatabase(dialect, async (testDb) => {
        const { db } = testDb
        
        await this.testManyToOneRelationships(db)
      }))

      it('should handle complex relationships with comments', withTestDatabase(dialect, async (testDb) => {
        const { db } = testDb
        
        await this.testComplexRelationships(db)
      }))

      it('should handle performance with large datasets', withTestDatabase(dialect, async (testDb) => {
        const { db } = testDb
        
        await this.testPerformanceWithLargeDatasets(db)
      }))

      it('should handle transaction operations', withTestDatabase(dialect, async (testDb) => {
        const { db } = testDb
        
        await this.testTransactionHandling(db)
      }))

      it('should handle concurrent operations', withTestDatabase(dialect, async (testDb) => {
        const { db } = testDb
        
        await this.testConcurrentOperations(db)
      }))

      it('should handle error scenarios', withTestDatabase(dialect, async (testDb) => {
        const { db } = testDb
        
        await this.testErrorHandling(db)
      }))
    })
  }

  /**
   * Initialize and run all tests
   */
  initialize(): void {
    if (this.enabledDatabases.length === 0) {
      return
    }

    describe('Database Operations Integration', () => {
      describe('CRUD Operations', () => {
        for (const dialect of this.enabledDatabases) {
          this.runTestsForDialect(dialect)
        }
      })

      describe('Relationship Operations', () => {
        for (const dialect of this.enabledDatabases) {
          this.runTestsForDialect(dialect)
        }
      })

      describe('Performance Operations', () => {
        for (const dialect of this.enabledDatabases) {
          this.runTestsForDialect(dialect)
        }
      })

      describe('Transaction Operations', () => {
        for (const dialect of this.enabledDatabases) {
          this.runTestsForDialect(dialect)
        }
      })

      describe('Concurrent Operations', () => {
        for (const dialect of this.enabledDatabases) {
          this.runTestsForDialect(dialect)
        }
      })

      describe('Error Handling', () => {
        for (const dialect of this.enabledDatabases) {
          this.runTestsForDialect(dialect)
        }
      })

      describe('Multi-Database Operations', () => {
        if (this.enabledDatabases.length > 1) {
          it('should handle operations across multiple databases', withMultipleDatabases(this.enabledDatabases, async (databases: any) => {
            // Convert Map to Array format
            const databasesArray = Array.from(databases.values()).map((db: any) => ({
              db: db.db,
              dialect: db.dialect
            }))
            await this.testMultiDatabaseOperations(databasesArray)
          }))
        }
      })
    })
  }
}

// Initialize the test suite
const testSuite = new DatabaseOperationsTestSuite()
testSuite.initialize()
