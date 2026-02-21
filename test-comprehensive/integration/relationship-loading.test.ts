/**
 * Comprehensive integration tests for relationship loading
 */

import { describe, it, before, after } from 'mocha'
import { expect } from 'chai'
import { withTestDatabase, performanceHelper } from '../setup/test-helpers.js'
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
  profiles?: any
}

interface PostWithRelations {
  id: string
  userId: string
  title: string
  content: string
  published: boolean
  users?: any
  comments?: any[]
  tags?: any[]
}

interface CommentWithRelations {
  id: string
  postId: string
  userId: string
  content: string
  users?: any
  posts?: any
}

interface TagWithRelations {
  id: string
  name: string
  color?: string
  posts?: any[]
}

describe('Relationship Loading Integration', () => {
  const enabledDatabases = getEnabledDatabases()
  
  if (enabledDatabases.length === 0) {
    console.warn('No databases enabled for testing')
    return
  }

  describe('One-to-Many Relationships', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should load users with their posts', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Create user and posts
          const user = await userRepo.create({
            id: 'user-with-posts',
            email: 'userwithposts@example.com',
            firstName: 'User',
            lastName: 'WithPosts',
            active: true
          }) as any
          
          const posts: any[] = []
          for (let i = 0; i < 5; i++) {
            const post = await postRepo.create({
              id: `user-post-${i}`,
              userId: user.id,
              title: `Post ${i}`,
              content: `Content ${i}`,
              published: i % 2 === 0
            }) as any
            posts.push(post as any)
          }
          
          // Load user with posts
          const userWithPosts = await userRepo.findWithRelations(user.id, ['posts']) as UserWithRelations | null
          
          expect(userWithPosts).to.exist
          expect(userWithPosts!.id).to.equal(user.id)
          expect(userWithPosts!.posts).to.exist
          expect(userWithPosts!.posts).to.be.an('array')
          expect(userWithPosts!.posts!.length).to.equal(5)
          
          // Verify posts
          for (const post of userWithPosts!.posts!) {
            expect(post.userId).to.equal(user.id)
            expect(post.title).to.include('Post')
            expect(post.content).to.include('Content')
          }
          
          // Clean up
          for (const post of posts) {
            await postRepo.delete((post as any).id)
          }
          await userRepo.delete((user as any).id)
        }))
        
        it('should load users with their comments', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          const commentRepo = db.getRepository('comments')
          
          // Create user, post, and comments
          const user = await userRepo.create({
            id: 'user-with-comments',
            email: 'userwithcomments@example.com',
            firstName: 'User',
            lastName: 'WithComments',
            active: true
          }) as any
          
          const post = await postRepo.create({
            id: 'comment-post',
            userId: user.id,
            title: 'Comment Post',
            content: 'Comment Content',
            published: true
          }) as any
          
          const comments: any[] = []
          for (let i = 0; i < 3; i++) {
            const comment = await commentRepo.create({
              id: `user-comment-${i}`,
              postId: post.id,
              userId: user.id,
              content: `Comment ${i}`
            }) as any
            comments.push(comment as any)
          }
          
          // Load user with comments
          const userWithComments = await userRepo.findWithRelations(user.id, ['comments']) as UserWithRelations | null
          
          expect(userWithComments).to.exist
          expect(userWithComments!.id).to.equal(user.id)
          expect(userWithComments!.comments).to.exist
          expect(userWithComments!.comments).to.be.an('array')
          expect(userWithComments!.comments!.length).to.equal(3)
          
          // Verify comments
          for (const comment of userWithComments!.comments!) {
            expect(comment.userId).to.equal(user.id)
            expect(comment.postId).to.equal(post.id)
            expect(comment.content).to.include('Comment')
          }
          
          // Clean up
          for (const comment of comments) {
            await commentRepo.delete((comment as any).id)
          }
          await postRepo.delete((post as any).id)
          await userRepo.delete((user as any).id)
        }))
        
        it('should load users with their profiles', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const profileRepo = db.getRepository('profiles')
          
          // Create user and profile
          const user = await userRepo.create({
            id: 'user-with-profile',
            email: 'userwithprofile@example.com',
            firstName: 'User',
            lastName: 'WithProfile',
            active: true
          }) as any
          
          const profile = await profileRepo.create({
            id: 'user-profile',
            userId: user.id,
            bio: 'Test bio',
            avatar: 'https://example.com/avatar.jpg',
            website: 'https://example.com'
          }) as any
          
          // Load user with profile
          const userWithProfile = await userRepo.findWithRelations(user.id, ['profiles']) as UserWithRelations | null
          
          expect(userWithProfile).to.exist
          expect(userWithProfile!.id).to.equal(user.id)
          expect(userWithProfile!.profiles).to.exist
          expect(userWithProfile!.profiles).to.be.an('object')
          expect(userWithProfile!.profiles!.id).to.equal(profile.id)
          expect(userWithProfile!.profiles!.userId).to.equal(user.id)
          expect(userWithProfile!.profiles!.bio).to.equal('Test bio')
          
          // Clean up
          await profileRepo.delete((profile as any).id)
          await userRepo.delete((user as any).id)
        }))
      })
    }
  })
  
  describe('Many-to-One Relationships', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should load posts with their users', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Create user and post
          const user = await userRepo.create({
            id: 'post-user',
            email: 'postuser@example.com',
            firstName: 'Post',
            lastName: 'User',
            active: true
          }) as any
          
          const post = await postRepo.create({
            id: 'post-with-user',
            userId: user.id,
            title: 'Post With User',
            content: 'Post Content',
            published: true
          }) as any
          
          // Load post with user
          const postWithUser = await postRepo.findWithRelations(post.id, ['users']) as PostWithRelations | null
          
          expect(postWithUser).to.exist
          expect(postWithUser!.id).to.equal(post.id)
          expect(postWithUser!.users).to.exist
          expect(postWithUser!.users).to.be.an('object')
          expect(postWithUser!.users!.id).to.equal(user.id)
          expect(postWithUser!.users!.email).to.equal(user.email)
          expect(postWithUser!.users!.firstName).to.equal('Post')
          expect(postWithUser!.users!.lastName).to.equal('User')
          
          // Clean up
          await postRepo.delete((post as any).id)
          await userRepo.delete((user as any).id)
        }))
        
        it('should load comments with their users', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          const commentRepo = db.getRepository('comments')
          
          // Create user, post, and comment
          const user = await userRepo.create({
            id: 'comment-user',
            email: 'commentuser@example.com',
            firstName: 'Comment',
            lastName: 'User',
            active: true
          }) as any
          
          const post = await postRepo.create({
            id: 'comment-post',
            userId: user.id,
            title: 'Comment Post',
            content: 'Comment Content',
            published: true
          }) as any
          
          const comment = await commentRepo.create({
            id: 'comment-with-user',
            postId: post.id,
            userId: user.id,
            content: 'Comment Content'
          }) as any
          
          // Load comment with user
          const commentWithUser = await commentRepo.findWithRelations(comment.id, ['users']) as CommentWithRelations | null
          
          expect(commentWithUser).to.exist
          expect(commentWithUser!.id).to.equal(comment.id)
          expect(commentWithUser!.users).to.exist
          expect(commentWithUser!.users).to.be.an('object')
          expect(commentWithUser!.users!.id).to.equal(user.id)
          expect(commentWithUser!.users!.email).to.equal(user.email)
          
          // Clean up
          await commentRepo.delete((comment as any).id)
          await postRepo.delete((post as any).id)
          await userRepo.delete((user as any).id)
        }))
        
        it('should load comments with their posts', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          const commentRepo = db.getRepository('comments')
          
          // Create user, post, and comment
          const user = await userRepo.create({
            id: 'comment-post-user',
            email: 'commentpostuser@example.com',
            firstName: 'CommentPost',
            lastName: 'User',
            active: true
          }) as any
          
          const post = await postRepo.create({
            id: 'comment-post-ref',
            userId: user.id,
            title: 'Comment Post Ref',
            content: 'Comment Post Content',
            published: true
          }) as any
          
          const comment = await commentRepo.create({
            id: 'comment-with-post',
            postId: post.id,
            userId: user.id,
            content: 'Comment Content'
          }) as any
          
          // Load comment with post
          const commentWithPost = await commentRepo.findWithRelations(comment.id, ['posts']) as CommentWithRelations | null
          
          expect(commentWithPost).to.exist
          expect(commentWithPost!.id).to.equal(comment.id)
          expect(commentWithPost!.posts).to.exist
          expect(commentWithPost!.posts).to.be.an('object')
          expect(commentWithPost!.posts!.id).to.equal(post.id)
          expect(commentWithPost!.posts!.title).to.equal('Comment Post Ref')
          expect(commentWithPost!.posts!.content).to.equal('Comment Post Content')
          
          // Clean up
          await commentRepo.delete((comment as any).id)
          await postRepo.delete((post as any).id)
          await userRepo.delete((user as any).id)
        }))
      })
    }
  })
  
  describe('Many-to-Many Relationships', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should load posts with their tags', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          const tagRepo = db.getRepository('tags')
          
          // Create user, post, and tags
          const user = await userRepo.create({
            id: 'tag-user',
            email: 'taguser@example.com',
            firstName: 'Tag',
            lastName: 'User',
            active: true
          }) as any
          
          const post = await postRepo.create({
            id: 'post-with-tags',
            userId: user.id,
            title: 'Post With Tags',
            content: 'Post Content',
            published: true
          }) as any
          
          const tags: any[] = []
          for (let i = 0; i < 3; i++) {
            const tag = await tagRepo.create({
              id: `post-tag-${i}`,
              name: `Tag ${i}`,
              color: `#${i}${i}${i}${i}${i}${i}`
            }) as any
            tags.push(tag as any)
          }
          
          // Create post-tag relationships
          const kysely = db.getKysely()
          for (const tag of tags) {
            await kysely
              .insertInto('post_tags')
              .values({
                postId: (post as any).id,
                tagId: (tag as any).id
              })
              .execute()
          }
          
          // Load post with tags
          const postWithTags = await postRepo.findWithRelations(post.id, ['tags']) as PostWithRelations | null
          
          expect(postWithTags).to.exist
          expect(postWithTags!.id).to.equal(post.id)
          expect(postWithTags!.tags).to.exist
          expect(postWithTags!.tags).to.be.an('array')
          expect(postWithTags!.tags!.length).to.equal(3)
          
          // Verify tags
          for (const tag of postWithTags!.tags!) {
            expect(tag.name).to.include('Tag')
            expect(tag.color).to.include('#')
          }
          
          // Clean up
          for (const tag of tags) {
            await kysely
              .deleteFrom('post_tags')
              .where('postId', '=', (post as any).id)
              .where('tagId', '=', (tag as any).id)
              .execute()
            await tagRepo.delete((tag as any).id)
          }
          await postRepo.delete((post as any).id)
          await userRepo.delete((user as any).id)
        }))
        
        it('should load tags with their posts', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          const tagRepo = db.getRepository('tags')
          
          // Create user, posts, and tag
          const user = await userRepo.create({
            id: 'tag-posts-user',
            email: 'tagpostsuser@example.com',
            firstName: 'TagPosts',
            lastName: 'User',
            active: true
          }) as any
          
          const posts: any[] = []
          for (let i = 0; i < 2; i++) {
            const post = await postRepo.create({
              id: `tag-post-${i}`,
              userId: user.id,
              title: `Tag Post ${i}`,
              content: `Tag Post Content ${i}`,
              published: true
            }) as any
            posts.push(post as any)
          }
          
          const tag = await tagRepo.create({
            id: 'tag-with-posts',
            name: 'Tag With Posts',
            color: '#123456'
          }) as any
          
          // Create post-tag relationships
          const kysely = db.getKysely()
          for (const post of posts) {
            await kysely
              .insertInto('post_tags')
              .values({
                postId: (post as any).id,
                tagId: (tag as any).id
              })
              .execute()
          }
          
          // Load tag with posts
          const tagWithPosts = await tagRepo.findWithRelations(tag.id, ['posts']) as TagWithRelations | null
          
          expect(tagWithPosts).to.exist
          expect(tagWithPosts!.id).to.equal(tag.id)
          expect(tagWithPosts!.posts).to.exist
          expect(tagWithPosts!.posts).to.be.an('array')
          expect(tagWithPosts!.posts!.length).to.equal(2)
          
          // Verify posts
          for (const post of tagWithPosts!.posts!) {
            expect(post.title).to.include('Tag Post')
            expect(post.content).to.include('Tag Post Content')
          }
          
          // Clean up
          for (const post of posts) {
            await kysely
              .deleteFrom('post_tags')
              .where('postId', '=', (post as any).id)
              .where('tagId', '=', (tag as any).id)
              .execute()
            await postRepo.delete((post as any).id)
          }
          await tagRepo.delete((tag as any).id)
          await userRepo.delete((user as any).id)
        }))
      })
    }
  })
  
  describe('Nested Relationships', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should load users with posts and comments', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          const commentRepo = db.getRepository('comments')
          
          // Create user, posts, and comments
          const user = await userRepo.create({
            id: 'nested-user',
            email: 'nested@example.com',
            firstName: 'Nested',
            lastName: 'User',
            active: true
          }) as any
          
          const posts: any[] = []
          for (let i = 0; i < 2; i++) {
            const post = await postRepo.create({
              id: `nested-post-${i}`,
              userId: user.id,
              title: `Nested Post ${i}`,
              content: `Nested Content ${i}`,
              published: true
            }) as any
            posts.push(post as any)
            
            // Create comments for each post
            for (let j = 0; j < 2; j++) {
              await commentRepo.create({
                id: `nested-comment-${i}-${j}`,
                postId: post.id,
                userId: user.id,
                content: `Comment ${i}-${j}`
              }) as any
            }
          }
          
          // Load user with posts
          const userWithPosts = await userRepo.findWithRelations(user.id, ['posts']) as UserWithRelations | null
          
          expect(userWithPosts).to.exist
          expect(userWithPosts!.posts).to.exist
          expect(userWithPosts!.posts!.length).to.equal(2)
          
          // Load each post with comments
          for (const post of userWithPosts!.posts!) {
            const postWithComments = await postRepo.findWithRelations(post.id, ['comments']) as PostWithRelations | null
            expect(postWithComments!.comments).to.exist
            expect(postWithComments!.comments!.length).to.equal(2)
            
            for (const comment of postWithComments!.comments!) {
              expect(comment.postId).to.equal(post.id)
              expect(comment.userId).to.equal(user.id)
            }
          }
          
          // Clean up
          for (const post of posts) {
            const comments = await commentRepo.findAll()
            const postComments = comments.filter((c: any) => c.postId === (post as any).id)
            for (const comment of postComments) {
              await commentRepo.delete((comment as any).id)
            }
            await postRepo.delete((post as any).id)
          }
          await userRepo.delete((user as any).id)
        }))
        
        it('should load posts with users and comments', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          const commentRepo = db.getRepository('comments')
          
          // Create user, post, and comments
          const user = await userRepo.create({
            id: 'nested-post-user',
            email: 'nestedpost@example.com',
            firstName: 'NestedPost',
            lastName: 'User',
            active: true
          }) as any
          
          const post = await postRepo.create({
            id: 'nested-post',
            userId: user.id,
            title: 'Nested Post',
            content: 'Nested Content',
            published: true
          }) as any
          
          const comments: any[] = []
          for (let i = 0; i < 3; i++) {
            const comment = await commentRepo.create({
              id: `nested-post-comment-${i}`,
              postId: post.id,
              userId: user.id,
              content: `Comment ${i}`
            }) as any
            comments.push(comment as any)
          }
          
          // Load post with user
          const postWithUser = await postRepo.findWithRelations(post.id, ['users']) as PostWithRelations | null
          expect(postWithUser!.users).to.exist
          expect(postWithUser!.users!.id).to.equal(user.id)
          
          // Load post with comments
          const postWithComments = await postRepo.findWithRelations(post.id, ['comments']) as PostWithRelations | null
          expect(postWithComments!.comments).to.exist
          expect(postWithComments!.comments!.length).to.equal(3)
          
          // Load each comment with user
          for (const comment of postWithComments!.comments!) {
            const commentWithUser = await commentRepo.findWithRelations(comment.id, ['users']) as CommentWithRelations | null
            expect(commentWithUser!.users).to.exist
            expect(commentWithUser!.users!.id).to.equal(user.id)
          }
          
          // Clean up
          for (const comment of comments) {
            await commentRepo.delete((comment as any).id)
          }
          await postRepo.delete((post as any).id)
          await userRepo.delete((user as any).id)
        }))
      })
    }
  })
  
  describe('Batch Loading', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should batch load relationships for multiple users', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Create multiple users and posts
          const users: any[] = []
          const posts: any[] = []
          
          for (let i = 0; i < 5; i++) {
            const user = await userRepo.create({
              id: `batch-user-${i}`,
              email: `batch${i}@example.com`,
              firstName: `Batch${i}`,
              lastName: 'User',
              active: true
            }) as any
            users.push(user as any)
            
            // Create 2 posts per user
            for (let j = 0; j < 2; j++) {
              const post = await postRepo.create({
                id: `batch-post-${i}-${j}`,
                userId: user.id,
                title: `Batch Post ${i}-${j}`,
                content: `Batch Content ${i}-${j}`,
                published: true
              }) as any
              posts.push(post as any)
            }
          }
          
          // Batch load relationships
          const start = performance.now()
          await userRepo.loadRelationships(users, ['posts'])
          const duration = performance.now() - start
          
          // Should be efficient
          expect(duration).to.be.lessThan(2000) // 2 seconds max
          
          // Verify all users have posts loaded
          for (const user of users) {
            const userWithPosts = user as UserWithRelations
            expect(userWithPosts.posts).to.exist
            expect(userWithPosts.posts).to.be.an('array')
            expect(userWithPosts.posts!.length).to.equal(2)
            
            for (const post of userWithPosts.posts!) {
              expect(post.userId).to.equal((user as any).id)
              expect(post.title).to.include('Batch Post')
            }
          }
          
          // Clean up
          for (const post of posts) {
            await postRepo.delete((post as any).id)
          }
          for (const user of users) {
            await userRepo.delete((user as any).id)
          }
        }))
        
        it('should batch load relationships for multiple posts', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Create user and multiple posts
          const user = await userRepo.create({
            id: 'batch-posts-user',
            email: 'batchposts@example.com',
            firstName: 'BatchPosts',
            lastName: 'User',
            active: true
          }) as any
          
          const posts: any[] = []
          for (let i = 0; i < 10; i++) {
            const post = await postRepo.create({
              id: `batch-posts-${i}`,
              userId: user.id,
              title: `Batch Post ${i}`,
              content: `Batch Content ${i}`,
              published: true
            }) as any
            posts.push(post as any)
          }
          
          // Batch load relationships
          const start = performance.now()
          await postRepo.loadRelationships(posts, ['users'])
          const duration = performance.now() - start
          
          // Should be efficient
          expect(duration).to.be.lessThan(1000) // 1 second max
          
          // Verify all posts have user loaded
          for (const post of posts) {
            const postWithUsers = post as PostWithRelations
            expect(postWithUsers.users).to.exist
            expect(postWithUsers.users).to.be.an('object')
            expect(postWithUsers.users!.id).to.equal((user as any).id)
            expect(postWithUsers.users!.email).to.equal((user as any).email)
          }
          
          // Clean up
          for (const post of posts) {
            await postRepo.delete((post as any).id)
          }
          await userRepo.delete((user as any).id)
        }))
        
        it('should handle large batch sizes efficiently', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Create large batch of users and posts
          const users: any[] = []
          const posts: any[] = []
          
          for (let i = 0; i < 20; i++) {
            const user = await userRepo.create({
              id: `large-batch-user-${i}`,
              email: `largebatch${i}@example.com`,
              firstName: `LargeBatch${i}`,
              lastName: 'User',
              active: true
            }) as any
            users.push(user as any)
            
            // Create 1 post per user
            const post = await postRepo.create({
              id: `large-batch-post-${i}`,
              userId: user.id,
              title: `Large Batch Post ${i}`,
              content: `Large Batch Content ${i}`,
              published: true
            }) as any
            posts.push(post as any)
          }
          
          // Batch load relationships
          const start = performance.now()
          await userRepo.loadRelationships(users, ['posts'])
          const duration = performance.now() - start
          
          // Should be efficient even for large batches
          expect(duration).to.be.lessThan(3000) // 3 seconds max
          
          // Verify all users have posts loaded
          for (const user of users) {
            const userWithPosts = user as UserWithRelations
            expect(userWithPosts.posts).to.exist
            expect(userWithPosts.posts).to.be.an('array')
            expect(userWithPosts.posts!.length).to.equal(1)
            expect(userWithPosts.posts![0].userId).to.equal((user as any).id)
          }
          
          // Clean up
          for (const post of posts) {
            await postRepo.delete((post as any).id)
          }
          for (const user of users) {
            await userRepo.delete((user as any).id)
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
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Create test data
          const user = await userRepo.create({
            id: 'perf-user',
            email: 'perf@example.com',
            firstName: 'Perf',
            lastName: 'User',
            active: true
          }) as any
          
          const posts: any[] = []
          for (let i = 0; i < 10; i++) {
            const post = await postRepo.create({
              id: `perf-post-${i}`,
              userId: user.id,
              title: `Perf Post ${i}`,
              content: `Perf Content ${i}`,
              published: true
            }) as any
            posts.push(post as any)
          }
          
          // Test relationship loading performance
          const duration = await performanceHelper.measure('relationship-loading', async () => {
            const userWithPosts = await userRepo.findWithRelations(user.id, ['posts']) as UserWithRelations | null
            return userWithPosts
          })
          
          // Should be efficient
          expect(duration).to.be.lessThan(1000) // 1 second max
          
          // Clean up
          for (const post of posts) {
            await postRepo.delete((post as any).id)
          }
          await userRepo.delete((user as any).id)
        }))
        
        it('should handle concurrent relationship loading', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          const postRepo = db.getRepository('posts')
          
          // Create test data
          const users: any[] = []
          const posts: any[] = []
          
          for (let i = 0; i < 5; i++) {
            const user = await userRepo.create({
              id: `concurrent-user-${i}`,
              email: `concurrent${i}@example.com`,
              firstName: `Concurrent${i}`,
              lastName: 'User',
              active: true
            }) as any
            users.push(user as any)
            
            const post = await postRepo.create({
              id: `concurrent-post-${i}`,
              userId: user.id,
              title: `Concurrent Post ${i}`,
              content: `Concurrent Content ${i}`,
              published: true
            }) as any
            posts.push(post as any)
          }
          
          // Concurrent relationship loading
          const start = performance.now()
          const promises = users.map((user: any) => 
            userRepo.findWithRelations(user.id, ['posts']) as Promise<UserWithRelations | null>
          )
          
          const results = await Promise.all(promises)
          const duration = performance.now() - start
          
          // Should be efficient
          expect(duration).to.be.lessThan(2000) // 2 seconds max
          expect(results.length).to.equal(5)
          
          // Verify results
          for (let i = 0; i < results.length; i++) {
            const result = results[i]
            expect(result).to.exist
            expect(result!.posts).to.exist
            expect(result!.posts!.length).to.equal(1)
            expect(result!.posts![0].userId).to.equal((users[i] as any).id)
          }
          
          // Clean up
          for (const post of posts) {
            await postRepo.delete((post as any).id)
          }
          for (const user of users) {
            await userRepo.delete((user as any).id)
          }
        }))
      })
    }
  })
})