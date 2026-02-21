/**
 * End-to-end tests for complete workflows
 * New implementation with proper TypeScript typing
 */

import { describe, it } from 'mocha'
import { expect } from 'chai'
import { withTestDatabase, performanceHelper } from '../setup/test-helpers.js'
import { getEnabledDatabases } from '../setup/test-config.js'

// Define proper TypeScript interfaces for test entities
interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  active: boolean
}

interface Profile {
  id: string
  userId: string
  bio: string
  avatar: string
  website: string
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

interface Tag {
  id: string
  name: string
  color: string
}

interface UserWithRelations extends User {
  profiles?: Profile[]
  posts?: Post[]
  comments?: Comment[]
}

interface PostWithRelations extends Post {
  tags?: Tag[]
  comments?: Comment[]
}

/**
 * Full Workflow Test Suite
 * Tests complete CRUD operations and complex relationships
 */
class FullWorkflowTestSuite {
  private enabledDatabases: ('sqlite' | 'postgresql' | 'mysql' | 'mssql')[]

  constructor() {
    this.enabledDatabases = getEnabledDatabases()
    
    if (this.enabledDatabases.length === 0) {
      console.warn('No databases enabled for testing')
    }
  }

  /**
   * Test complete user management workflow
   */
  async testUserManagementWorkflow(db: any): Promise<void> {
    const userRepo = db.getRepository('users')
    const profileRepo = db.getRepository('profiles')
    const postRepo = db.getRepository('posts')
    const commentRepo = db.getRepository('comments')
    
    // 1. Create a new user
    const user = await userRepo.create({
      id: 'workflow-user',
      email: 'workflow@example.com',
      firstName: 'Workflow',
      lastName: 'User',
      active: true
    }) as User
    
    expect(user).to.exist
    expect(user.id).to.equal('workflow-user')
    
    // 2. Create user profile
    const profile = await profileRepo.create({
      id: 'workflow-profile',
      userId: user.id,
      bio: 'Workflow test user',
      avatar: 'https://example.com/avatar.jpg',
      website: 'https://workflow.example.com'
    }) as Profile
    
    expect(profile).to.exist
    expect(profile.userId).to.equal(user.id)
    
    // 3. Create posts for the user
    const posts: Post[] = []
    for (let i = 0; i < 3; i++) {
      const post = await postRepo.create({
        id: `workflow-post-${i}`,
        userId: user.id,
        title: `Workflow Post ${i}`,
        content: `This is workflow post ${i} content.`,
        published: i % 2 === 0
      }) as Post
      posts.push(post)
    }
    
    expect(posts.length).to.equal(3)
    
    // 4. Create comments on posts
    const comments: Comment[] = []
    for (let i = 0; i < 6; i++) {
      const comment = await commentRepo.create({
        id: `workflow-comment-${i}`,
        postId: posts[i % 3].id,
        userId: user.id,
        content: `This is comment ${i} on post ${i % 3}.`
      }) as Comment
      comments.push(comment)
    }
    
    expect(comments.length).to.equal(6)
    
    // 5. Read user with all relationships
    const userWithRelations = await userRepo.findWithRelations(user.id, ['profiles', 'posts']) as UserWithRelations
    
    expect(userWithRelations).to.exist
    expect(userWithRelations?.profiles).to.exist
    expect(userWithRelations?.posts).to.exist
    expect(userWithRelations?.posts?.length).to.equal(3)
    
    // 6. Update user information
    if (userWithRelations) {
      userWithRelations.firstName = 'Updated'
      userWithRelations.lastName = 'Name'
      
      const updatedUser = await userRepo.update(userWithRelations) as User
      
      expect(updatedUser.firstName).to.equal('Updated')
      expect(updatedUser.lastName).to.equal('Name')
    }
    
    // 7. Update profile
    const updatedProfile = await profileRepo.findById(profile.id) as Profile
    if (updatedProfile) {
      updatedProfile.bio = 'Updated bio'
      
      const newProfile = await profileRepo.update(updatedProfile) as Profile
      
      expect(newProfile.bio).to.equal('Updated bio')
    }
    
    // 8. Update posts
    for (const post of posts) {
      const postToUpdate = await postRepo.findById(post.id) as Post
      if (postToUpdate) {
        postToUpdate.title = `Updated ${postToUpdate.title}`
        await postRepo.update(postToUpdate)
      }
    }
    
    // 9. Verify updates
    const verifyUser = await userRepo.findById(user.id) as User
    expect(verifyUser?.firstName).to.equal('Updated')
    
    const verifyProfile = await profileRepo.findById(profile.id) as Profile
    expect(verifyProfile?.bio).to.equal('Updated bio')
    
    // 10. Clean up - delete in reverse order
    for (const comment of comments) {
      await commentRepo.delete(comment.id)
    }
    
    for (const post of posts) {
      await postRepo.delete(post.id)
    }
    
    await profileRepo.delete(profile.id)
    await userRepo.delete(user.id)
    
    // 11. Verify cleanup
    const deletedUser = await userRepo.findById(user.id)
    expect(deletedUser).to.be.null
  }

  /**
   * Test complete blog workflow
   */
  async testBlogWorkflow(db: any): Promise<void> {
    const userRepo = db.getRepository('users')
    const postRepo = db.getRepository('posts')
    const commentRepo = db.getRepository('comments')
    const tagRepo = db.getRepository('tags')
    
    // 1. Create blog authors
    const authors: User[] = []
    for (let i = 0; i < 3; i++) {
      const author = await userRepo.create({
        id: `blog-author-${i}`,
        email: `author${i}@blog.com`,
        firstName: `Author${i}`,
        lastName: 'Blogger',
        active: true
      }) as User
      authors.push(author)
    }
    
    // 2. Create blog tags
    const tags: Tag[] = []
    const tagNames = ['Technology', 'Programming', 'Database', 'Testing']
    for (let i = 0; i < tagNames.length; i++) {
      const tag = await tagRepo.create({
        id: `blog-tag-${i}`,
        name: tagNames[i],
        color: `#${i}${i}${i}${i}${i}${i}`
      }) as Tag
      tags.push(tag)
    }
    
    // 3. Create blog posts
    const posts: Post[] = []
    for (let i = 0; i < 10; i++) {
      const post = await postRepo.create({
        id: `blog-post-${i}`,
        userId: authors[i % 3].id,
        title: `Blog Post ${i}: ${tagNames[i % 4]} Topic`,
        content: `This is the content for blog post ${i}. It covers ${tagNames[i % 4]} topics.`,
        published: i % 3 !== 0 // 2/3 of posts are published
      }) as Post
      posts.push(post)
    }
    
    // 4. Create post-tag relationships
    const kysely = db.getKysely()
    for (let i = 0; i < posts.length; i++) {
      await kysely
        .insertInto('post_tags')
        .values({
          postId: posts[i].id,
          tagId: tags[i % tags.length].id
        })
        .execute()
    }
    
    // 5. Create comments on published posts
    const comments: Comment[] = []
    const publishedPosts = posts.filter(p => p.published)
    for (let i = 0; i < publishedPosts.length * 2; i++) {
      const comment = await commentRepo.create({
        id: `blog-comment-${i}`,
        postId: publishedPosts[i % publishedPosts.length].id,
        userId: authors[i % 3].id,
        content: `Great post! Comment ${i}`
      }) as Comment
      comments.push(comment)
    }
    
    // 6. Read blog data with relationships
    const authorsWithPosts = await userRepo.loadRelationships(authors, ['posts']) as UserWithRelations[]
    
    for (const author of authorsWithPosts) {
      expect(author.posts).to.exist
      expect(author.posts).to.be.an('array')
      expect(author.posts?.length).to.be.greaterThan(0)
    }
    
    // 7. Get published posts with tags and comments
    const publishedPostsWithRelations = await postRepo.loadRelationships(publishedPosts, ['tags', 'comments']) as PostWithRelations[]
    
    for (const post of publishedPostsWithRelations) {
      expect(post.tags).to.exist
      expect(post.comments).to.exist
      expect(post.tags?.length).to.be.greaterThan(0)
      expect(post.comments?.length).to.be.greaterThan(0)
    }
    
    // 8. Update post status (publish/unpublish)
    for (const post of posts) {
      if (!post.published) {
        const postToUpdate = await postRepo.findById(post.id) as Post
        if (postToUpdate) {
          postToUpdate.published = true
          await postRepo.update(postToUpdate)
        }
      }
    }
    
    // 9. Verify all posts are now published
    const allPosts = await postRepo.findAll() as Post[]
    const allPublished = allPosts.filter(p => p.published)
    expect(allPublished.length).to.equal(posts.length)
    
    // 10. Clean up
    for (const comment of comments) {
      await commentRepo.delete(comment.id)
    }
    
    for (let i = 0; i < posts.length; i++) {
      await kysely
        .deleteFrom('post_tags')
        .where('postId', '=', posts[i].id)
        .execute()
      await postRepo.delete(posts[i].id)
    }
    
    for (const tag of tags) {
      await tagRepo.delete(tag.id)
    }
    
    for (const author of authors) {
      await userRepo.delete(author.id)
    }
  }

  /**
   * Test complete e-commerce workflow
   */
  async testEcommerceWorkflow(db: any): Promise<void> {
    const userRepo = db.getRepository('users')
    const postRepo = db.getRepository('posts')
    const commentRepo = db.getRepository('comments')
    
    // 1. Create customers
    const customers: User[] = []
    for (let i = 0; i < 5; i++) {
      const customer = await userRepo.create({
        id: `customer-${i}`,
        email: `customer${i}@shop.com`,
        firstName: `Customer${i}`,
        lastName: 'Shopper',
        active: true
      }) as User
      customers.push(customer)
    }
    
    // 2. Create product posts (using posts as products)
    const products: Post[] = []
    const productNames = ['Laptop', 'Phone', 'Tablet', 'Headphones', 'Keyboard']
    for (let i = 0; i < productNames.length; i++) {
      const product = await postRepo.create({
        id: `product-${i}`,
        userId: 'system', // System user for products
        title: `${productNames[i]} - Premium Quality`,
        content: `Description of ${productNames[i]}. High quality product with great features.`,
        published: true
      }) as Post
      products.push(product)
    }
    
    // 3. Create reviews (using comments as reviews)
    const reviews: Comment[] = []
    for (let i = 0; i < 20; i++) {
      const review = await commentRepo.create({
        id: `review-${i}`,
        postId: products[i % products.length].id,
        userId: customers[i % customers.length].id,
        content: `Great product! Rating: ${(i % 5) + 1}/5 stars.`
      }) as Comment
      reviews.push(review)
    }
    
    // 4. Read product catalog with reviews
    const productsWithReviews = await postRepo.loadRelationships(products, ['comments']) as PostWithRelations[]
    
    for (const product of productsWithReviews) {
      expect(product.comments).to.exist
      expect(product.comments?.length).to.be.greaterThan(0)
    }
    
    // 5. Get customer purchase history (reviews as purchases)
    const customersWithReviews = await userRepo.loadRelationships(customers, ['comments']) as UserWithRelations[]
    
    for (const customer of customersWithReviews) {
      expect(customer.comments).to.exist
      expect(customer.comments?.length).to.be.greaterThan(0)
    }
    
    // 6. Update product information
    for (const product of products) {
      const productToUpdate = await postRepo.findById(product.id) as Post
      if (productToUpdate) {
        productToUpdate.title = `Updated ${productToUpdate.title}`
        productToUpdate.content = `Updated description: ${productToUpdate.content}`
        
        await postRepo.update(productToUpdate)
      }
    }
    
    // 7. Update customer information
    for (const customer of customers) {
      const customerToUpdate = await userRepo.findById(customer.id) as User
      if (customerToUpdate) {
        customerToUpdate.firstName = `Updated${customerToUpdate.firstName}`
        
        await userRepo.update(customerToUpdate)
      }
    }
    
    // 8. Verify updates
    const updatedProducts = await postRepo.findAll() as Post[]
    for (const product of updatedProducts) {
      if (product.id.startsWith('product-')) {
        expect(product.title).to.include('Updated')
      }
    }
    
    const updatedCustomers = await userRepo.findAll() as User[]
    for (const customer of updatedCustomers) {
      if (customer.id.startsWith('customer-')) {
        expect(customer.firstName).to.include('Updated')
      }
    }
    
    // 9. Clean up
    for (const review of reviews) {
      await commentRepo.delete(review.id)
    }
    
    for (const product of products) {
      await postRepo.delete(product.id)
    }
    
    for (const customer of customers) {
      await userRepo.delete(customer.id)
    }
  }

  /**
   * Test high-performance data processing workflow
   */
  async testPerformanceWorkflow(db: any): Promise<void> {
    const userRepo = db.getRepository('users')
    const postRepo = db.getRepository('posts')
    const commentRepo = db.getRepository('comments')
    
    // 1. Create large dataset
    const users: User[] = []
    const posts: Post[] = []
    const comments: Comment[] = []
    
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
        content: `This is performance test post ${i}.`,
        published: true
      }) as Post
      posts.push(post)
    }
    
    // Create 1000 comments
    for (let i = 0; i < 1000; i++) {
      const comment = await commentRepo.create({
        id: `perf-comment-${i}`,
        postId: posts[i % posts.length].id,
        userId: users[i % users.length].id,
        content: `Performance comment ${i}`
      }) as Comment
      comments.push(comment)
    }
    
    // 2. Test high-performance operations
    const duration = await performanceHelper.measure('high-performance-workflow', async () => {
      // Batch load all relationships
      await userRepo.loadRelationships(users, ['posts'])
      await postRepo.loadRelationships(posts, ['comments'])
      
      // Perform bulk updates
      for (const user of users) {
        const updatedUser = { ...user, firstName: `Updated${user.firstName}` }
        await userRepo.update(updatedUser)
      }
      
      // Perform bulk reads
      for (const post of posts) {
        await postRepo.findById(post.id)
      }
    })
    
    // Should handle high-performance operations efficiently
    expect(duration).to.be.lessThan(30000) // 30 seconds max
    
    // 3. Verify data integrity
    const updatedUsers = await userRepo.findAll() as User[]
    for (const user of updatedUsers) {
      if (user.id.startsWith('perf-user-')) {
        expect(user.firstName).to.include('Updated')
      }
    }
    
    // 4. Clean up
    for (const comment of comments) {
      await commentRepo.delete(comment.id)
    }
    
    for (const post of posts) {
      await postRepo.delete(post.id)
    }
    
    for (const user of users) {
      await userRepo.delete(user.id)
    }
  }

  /**
   * Test concurrent workflow operations
   */
  async testConcurrentWorkflow(db: any): Promise<void> {
    const userRepo = db.getRepository('users')
    const postRepo = db.getRepository('posts')
    
    // 1. Create initial data
    const users: User[] = []
    for (let i = 0; i < 20; i++) {
      const user = await userRepo.create({
        id: `concurrent-user-${i}`,
        email: `concurrent${i}@example.com`,
        firstName: `Concurrent${i}`,
        lastName: 'User',
        active: true
      }) as User
      users.push(user)
    }
    
    // 2. Test concurrent operations
    const duration = await performanceHelper.measure('concurrent-workflow', async () => {
      const promises: Promise<any>[] = []
      
      // Concurrent user updates
      for (const user of users) {
        promises.push(
          userRepo.update({
            ...user,
            firstName: `Updated${user.firstName}`
          })
        )
      }
      
      // Concurrent post creation
      for (let i = 0; i < 20; i++) {
        promises.push(
          postRepo.create({
            id: `concurrent-post-${i}`,
            userId: users[i].id,
            title: `Concurrent Post ${i}`,
            content: `Concurrent content ${i}`,
            published: true
          })
        )
      }
      
      await Promise.all(promises)
    })
    
    // Should handle concurrent operations efficiently
    expect(duration).to.be.lessThan(10000) // 10 seconds max
    
    // 3. Verify concurrent operations
    const updatedUsers = await userRepo.findAll() as User[]
    for (const user of updatedUsers) {
      if (user.id.startsWith('concurrent-user-')) {
        expect(user.firstName).to.include('Updated')
      }
    }
    
    const allPosts = await postRepo.findAll() as Post[]
    const concurrentPosts = allPosts.filter(p => p.id.startsWith('concurrent-post-'))
    expect(concurrentPosts.length).to.equal(20)
    
    // 4. Clean up
    for (const post of concurrentPosts) {
      await postRepo.delete(post.id)
    }
    
    for (const user of users) {
      await userRepo.delete(user.id)
    }
  }

  /**
   * Run all tests for a specific database dialect
   */
  async runTestsForDialect(dialect: 'sqlite' | 'postgresql' | 'mysql' | 'mssql'): Promise<void> {
    describe(`${dialect.toUpperCase()}`, () => {
      it('should handle complete user management workflow', withTestDatabase(dialect, async (testDb) => {
        const { db } = testDb
        
        await this.testUserManagementWorkflow(db)
      }))

      it('should handle complete blog workflow', withTestDatabase(dialect, async (testDb) => {
        const { db } = testDb
        
        await this.testBlogWorkflow(db)
      }))

      it('should handle complete e-commerce workflow', withTestDatabase(dialect, async (testDb) => {
        const { db } = testDb
        
        await this.testEcommerceWorkflow(db)
      }))

      it('should handle high-performance data processing workflow', withTestDatabase(dialect, async (testDb) => {
        const { db } = testDb
        
        await this.testPerformanceWorkflow(db)
      }))

      it('should handle concurrent workflow operations', withTestDatabase(dialect, async (testDb) => {
        const { db } = testDb
        
        await this.testConcurrentWorkflow(db)
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

    describe('Full Workflow E2E Tests', () => {
      describe('Complete CRUD Workflow', () => {
        for (const dialect of this.enabledDatabases) {
          this.runTestsForDialect(dialect)
        }
      })
    })
  }
}

// Initialize the test suite
const testSuite = new FullWorkflowTestSuite()
testSuite.initialize()
