import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { RelationshipNotFoundError } from '../../src/errors/NoormError.js'
import { createTestDatabase, cleanupTestDatabase, setupTestSchema, TestDataFactory } from '../../src/testing/test-utils.js'

describe('Relationship Counting', () => {
  let db: NOORMME
  let factory: TestDataFactory

  beforeEach(async () => {
    db = await createTestDatabase({ seed: true })
    factory = new TestDataFactory(db)
  })

  afterEach(async () => {
    await cleanupTestDatabase(db)
  })

  describe('Single Relationship Counting', () => {
    it('should count posts for a user', async () => {
      // Create a user with posts
      const user = await factory.createUser()
      await factory.createPosts(user.id, 3)

      const userRepo = db.getRepository('users')
      const userWithCount = await userRepo.withCount(user.id, ['posts'])

      expect(userWithCount.id).toBe(user.id)
      expect(userWithCount.name).toBe(user.name)
      expect(userWithCount.postsCount).toBe(3)
    })

    it('should return zero count when no related records exist', async () => {
      const user = await factory.createUser()

      const userRepo = db.getRepository('users')
      const userWithCount = await userRepo.withCount(user.id, ['posts'])

      expect(userWithCount.postsCount).toBe(0)
    })

    it('should count comments for a user', async () => {
      // Create user, post, and comments
      const user = await factory.createUser()
      const post = await factory.createPost(user.id)
      await factory.createComments(post.id, user.id, 5)

      const userRepo = db.getRepository('users')
      const userWithCount = await userRepo.withCount(user.id, ['comments'])

      expect(userWithCount.commentsCount).toBe(5)
    })
  })

  describe('Multiple Relationship Counting', () => {
    it('should count multiple relationships for a user', async () => {
      // Create user with posts and comments
      const user = await factory.createUser()
      const posts = await factory.createPosts(user.id, 2)

      // Create comments on different posts
      await factory.createComments(posts[0].id, user.id, 3)
      await factory.createComments(posts[1].id, user.id, 2)

      const userRepo = db.getRepository('users')
      const userWithCount = await userRepo.withCount(user.id, ['posts', 'comments'])

      expect(userWithCount.postsCount).toBe(2)
      expect(userWithCount.commentsCount).toBe(5)
      expect(userWithCount.id).toBe(user.id)
      expect(userWithCount.name).toBe(user.name)
    })

    it('should handle mixed zero and non-zero counts', async () => {
      const user = await factory.createUser()
      await factory.createPosts(user.id, 2) // Has posts but no comments

      const userRepo = db.getRepository('users')
      const userWithCount = await userRepo.withCount(user.id, ['posts', 'comments'])

      expect(userWithCount.postsCount).toBe(2)
      expect(userWithCount.commentsCount).toBe(0)
    })
  })

  describe('Different Entity Types', () => {
    it('should count comments for a post', async () => {
      const user = await factory.createUser()
      const post = await factory.createPost(user.id)
      await factory.createComments(post.id, user.id, 4)

      const postRepo = db.getRepository('posts')
      const postWithCount = await postRepo.withCount(post.id, ['comments'])

      expect(postWithCount.commentsCount).toBe(4)
      expect(postWithCount.title).toBe(post.title)
    })

    it('should count across multiple users commenting', async () => {
      const users = await factory.createUsers(3)
      const post = await factory.createPost(users[0].id)

      // Each user makes 2 comments
      for (const user of users) {
        await factory.createComments(post.id, user.id, 2)
      }

      const postRepo = db.getRepository('posts')
      const postWithCount = await postRepo.withCount(post.id, ['comments'])

      expect(postWithCount.commentsCount).toBe(6) // 3 users × 2 comments each
    })
  })

  describe('Error Handling', () => {
    it('should throw error for invalid relationship name', async () => {
      const user = await factory.createUser()
      const userRepo = db.getRepository('users')

      await expect(async () => {
        await userRepo.withCount(user.id, ['invalid_relationship'])
      }).rejects.toThrow(RelationshipNotFoundError)
    })

    it('should provide helpful error message for invalid relationship', async () => {
      const user = await factory.createUser()
      const userRepo = db.getRepository('users')

      try {
        await userRepo.withCount(user.id, ['invalid_relationship'])
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(RelationshipNotFoundError)
        const relationshipError = error as RelationshipNotFoundError
        expect(relationshipError.context.table).toBe('users')
        expect(relationshipError.context.availableOptions).toBeDefined()
        expect(relationshipError.message).toContain('invalid_relationship')
      }
    })

    it('should throw error for non-existent entity', async () => {
      const userRepo = db.getRepository('users')

      await expect(async () => {
        await userRepo.withCount(99999, ['posts'])
      }).rejects.toThrow()
    })

    it('should validate all relationship names before execution', async () => {
      const user = await factory.createUser()
      const userRepo = db.getRepository('users')

      // One valid, one invalid relationship
      await expect(async () => {
        await userRepo.withCount(user.id, ['posts', 'invalid_relationship'])
      }).rejects.toThrow(RelationshipNotFoundError)
    })
  })

  describe('Performance Considerations', () => {
    it('should not load related data, only count', async () => {
      const user = await factory.createUser()
      await factory.createPosts(user.id, 100) // Large number of posts

      const userRepo = db.getRepository('users')
      const userWithCount = await userRepo.withCount(user.id, ['posts'])

      // Should have count but no actual post data loaded
      expect(userWithCount.postsCount).toBe(100)
      expect(userWithCount.posts).toBeUndefined() // Posts should not be loaded
      expect(Object.keys(userWithCount)).not.toContain('posts')
    })

    it('should execute single query per relationship', async () => {
      // This test would require query monitoring to verify
      // For now, we ensure functionality works
      const user = await factory.createUser()
      await factory.createPosts(user.id, 5)

      const userRepo = db.getRepository('users')
      const userWithCount = await userRepo.withCount(user.id, ['posts'])

      expect(userWithCount.postsCount).toBe(5)
    })
  })

  describe('Complex Scenarios', () => {
    it('should handle relationships with NULL foreign keys', async () => {
      // Create orphaned comments (posts deleted but comments remain with NULL post_id)
      const user = await factory.createUser()
      const post = await factory.createPost(user.id)
      await factory.createComments(post.id, user.id, 3)

      // Simulate orphaned comments by setting post_id to NULL
      const kysely = db.getKysely()
      await kysely
        .updateTable('comments')
        .set({ post_id: null })
        .where('user_id', '=', user.id)
        .execute()

      const userRepo = db.getRepository('users')
      const userWithCount = await userRepo.withCount(user.id, ['comments'])

      // Should count comments for the user
      expect(userWithCount.commentsCount).toBe(3)
    })

    it('should work with empty relationship array', async () => {
      const user = await factory.createUser()
      const userRepo = db.getRepository('users')

      const userWithCount = await userRepo.withCount(user.id, [])

      // Should return user without any count properties
      expect(userWithCount.id).toBe(user.id)
      expect(userWithCount.name).toBe(user.name)
      expect(Object.keys(userWithCount).filter(key => key.endsWith('Count'))).toHaveLength(0)
    })
  })
})