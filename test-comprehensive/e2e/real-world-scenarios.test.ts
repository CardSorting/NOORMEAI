/**
 * End-to-end tests for real-world scenarios
 * New implementation with proper TypeScript typing and class-based architecture
 */

import { describe, it } from 'mocha'
import { expect } from 'chai'
import { withTestDatabase, performanceHelper } from '../setup/test-helpers.js'
import { getEnabledDatabases } from '../setup/test-config.js'

// Define proper TypeScript interfaces for scenario entities
interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  active: boolean
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

interface ProductData {
  name: string
  price: number
  category: string
}

interface InventoryData {
  name: string
  stock: number
  price: number
}

interface TransactionData {
  itemId: number
  quantity: number
  customerId: string
}

interface SocialPostData {
  content: string
  hashtags: number[]
  likes: number
}

interface UserAnalytics {
  totalUsers: number
  activeUsers: number
  inactiveUsers: number
  userEngagement: Map<string, number>
}

interface ContentAnalytics {
  totalPosts: number
  publishedPosts: number
  draftPosts: number
  totalComments: number
  averageCommentsPerPost: number
}

interface EngagementAnalytics {
  totalEngagement: number
  averageEngagementPerUser: number
  highEngagementUsers: Array<{ userId: string; engagement: number }>
  lowEngagementUsers: Array<{ userId: string; engagement: number }>
}

interface PerformanceMetrics {
  postsWithComments: number
  postsWithoutComments: number
  averageCommentsPerPost: number
  mostCommentedPost: { postId: string; comments: number } | null
  leastCommentedPost: { postId: string; comments: number } | null
}

interface ComprehensiveReport {
  summary: {
    totalUsers: number
    totalPosts: number
    totalComments: number
    totalEngagement: number
  }
  userMetrics: UserAnalytics
  contentMetrics: ContentAnalytics
  engagementMetrics: EngagementAnalytics
  performanceMetrics: PerformanceMetrics
  generatedAt: string
}

/**
 * Real-World Scenarios Test Suite
 * Tests complex business scenarios and analytics
 */
class RealWorldScenariosTestSuite {
  private enabledDatabases: ('sqlite')[]

  constructor() {
    this.enabledDatabases = getEnabledDatabases()
    
    if (this.enabledDatabases.length === 0) {
      console.warn('No databases enabled for testing')
    }
  }

  /**
   * Test complete e-commerce customer journey
   */
  async testEcommerceCustomerJourney(db: any): Promise<void> {
    const userRepo = db.getRepository('users')
    const postRepo = db.getRepository('posts')
    const commentRepo = db.getRepository('comments')
    const tagRepo = db.getRepository('tags')
    
    // 1. Customer Registration
    const customer = await userRepo.create({
      id: 'ecom-customer-1',
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      active: true
    }) as User

    // 2. Product Catalog (using posts as products)
    const products: Post[] = []
    const productData: ProductData[] = [
      { name: 'Wireless Headphones', price: 99.99, category: 'Electronics' },
      { name: 'Smart Watch', price: 199.99, category: 'Electronics' },
      { name: 'Coffee Maker', price: 149.99, category: 'Appliances' },
      { name: 'Running Shoes', price: 129.99, category: 'Sports' },
      { name: 'Laptop Stand', price: 49.99, category: 'Office' }
    ]
    
    for (let i = 0; i < productData.length; i++) {
      const product = await postRepo.create({
        id: `product-${i}`,
        userId: 'system',
        title: productData[i].name,
        content: `High-quality ${productData[i].name} for ${productData[i].category} category. Price: $${productData[i].price}`,
        published: true
      }) as Post
      products.push(product)
    }
    
    // 3. Product Categories (using tags)
    const categories: Tag[] = []
    const categoryNames = ['Electronics', 'Appliances', 'Sports', 'Office']
    for (let i = 0; i < categoryNames.length; i++) {
      const category = await tagRepo.create({
        id: `category-${i}`,
        name: categoryNames[i],
        color: `#${i}${i}${i}${i}${i}${i}`
      }) as Tag
      categories.push(category)
    }
    
    // 4. Product-Category Relationships
    const kysely = db.getKysely()
    for (let i = 0; i < products.length; i++) {
      const categoryIndex = categoryNames.indexOf(productData[i].category)
      if (categoryIndex !== -1) {
        await kysely
          .insertInto('post_tags')
          .values({
            postId: products[i].id,
            tagId: categories[categoryIndex].id
          })
          .execute()
      }
    }
    
    // 5. Customer Reviews (using comments as reviews)
    const reviews: Comment[] = []
    const reviewData = [
      { productId: 0, rating: 5, text: 'Excellent sound quality!' },
      { productId: 0, rating: 4, text: 'Good value for money' },
      { productId: 1, rating: 5, text: 'Love the fitness tracking features' },
      { productId: 2, rating: 3, text: 'Works well but could be quieter' },
      { productId: 3, rating: 5, text: 'Very comfortable for running' }
    ]
    
    for (let i = 0; i < reviewData.length; i++) {
      const review = await commentRepo.create({
        id: `review-${i}`,
        postId: products[reviewData[i].productId].id,
        userId: customer.id,
        content: `${reviewData[i].rating}/5 stars - ${reviewData[i].text}`
      }) as Comment
      reviews.push(review)
    }
    
    // 6. Browse Products by Category
    const electronicsProducts = await kysely
      .selectFrom('posts')
      .innerJoin('post_tags', 'post_tags.postId', 'posts.id')
      .innerJoin('tags', 'tags.id', 'post_tags.tagId')
      .selectAll('posts')
      .where('tags.name', '=', 'Electronics')
      .execute()
    
    expect(electronicsProducts.length).to.be.greaterThan(0)
    
    // 7. View Product Details with Reviews
    const productWithReviews = await postRepo.findWithRelations(products[0].id, ['comments'])
    expect(productWithReviews?.comments).to.exist
    expect(productWithReviews?.comments?.length).to.be.greaterThan(0)
    
    // 8. Customer Profile Management
    const customerProfile = await userRepo.findById(customer.id) as User
    if (customerProfile) {
      customerProfile.firstName = 'Johnny'
      customerProfile.lastName = 'Smith'
      
      const updatedCustomer = await userRepo.update(customerProfile) as User
      expect(updatedCustomer.firstName).to.equal('Johnny')
      expect(updatedCustomer.lastName).to.equal('Smith')
    }
    
    // 9. Order History (simulated with reviews)
    const customerReviews = await commentRepo.findAll() as Comment[]
    const customerOrderHistory = customerReviews.filter(review => review.userId === customer.id)
    expect(customerOrderHistory.length).to.equal(reviewData.length)
    
    // 10. Product Recommendations (based on categories)
    const customerCategories = new Set<string>()
    for (const review of customerOrderHistory) {
      const product = products.find(p => p.id === review.postId)
      if (product) {
        const productIndex = products.indexOf(product)
        customerCategories.add(productData[productIndex].category)
      }
    }
    
    expect(customerCategories.size).to.be.greaterThan(0)
    
    // 11. Clean up
    for (const review of reviews) {
      await commentRepo.delete(review.id)
    }
    
    for (let i = 0; i < products.length; i++) {
      await kysely
        .deleteFrom('post_tags')
        .where('postId', '=', products[i].id)
        .execute()
      await postRepo.delete(products[i].id)
    }
    
    for (const category of categories) {
      await tagRepo.delete(category.id)
    }
    
    await userRepo.delete(customer.id)
  }

  /**
   * Test inventory management scenario
   */
  async testInventoryManagement(db: any): Promise<void> {
    const userRepo = db.getRepository('users')
    const postRepo = db.getRepository('posts')
    const commentRepo = db.getRepository('comments')
    
    // 1. Create inventory items (using posts as inventory)
    const inventoryItems: Post[] = []
    const inventoryData: InventoryData[] = [
      { name: 'Product A', stock: 100, price: 29.99 },
      { name: 'Product B', stock: 50, price: 49.99 },
      { name: 'Product C', stock: 200, price: 19.99 },
      { name: 'Product D', stock: 75, price: 39.99 },
      { name: 'Product E', stock: 25, price: 99.99 }
    ]
    
    for (let i = 0; i < inventoryData.length; i++) {
      const item = await postRepo.create({
        id: `inventory-${i}`,
        userId: 'system',
        title: inventoryData[i].name,
        content: `Stock: ${inventoryData[i].stock} units, Price: $${inventoryData[i].price}`,
        published: true
      }) as Post
      inventoryItems.push(item)
    }
    
    // 2. Simulate sales transactions (using comments as transactions)
    const transactions: Comment[] = []
    const transactionData: TransactionData[] = [
      { itemId: 0, quantity: 5, customerId: 'customer-1' },
      { itemId: 1, quantity: 2, customerId: 'customer-2' },
      { itemId: 0, quantity: 3, customerId: 'customer-3' },
      { itemId: 2, quantity: 10, customerId: 'customer-1' },
      { itemId: 3, quantity: 1, customerId: 'customer-4' }
    ]
    
    for (let i = 0; i < transactionData.length; i++) {
      const transaction = await commentRepo.create({
        id: `transaction-${i}`,
        postId: inventoryItems[transactionData[i].itemId].id,
        userId: transactionData[i].customerId,
        content: `Sold ${transactionData[i].quantity} units`
      }) as Comment
      transactions.push(transaction)
    }
    
    // 3. Calculate current stock levels
    const stockLevels = new Map<string, number>()
    for (let i = 0; i < inventoryData.length; i++) {
      stockLevels.set(inventoryItems[i].id, inventoryData[i].stock)
    }
    
    // Deduct sold quantities
    for (const transaction of transactions) {
      const transactionIndex = transactions.indexOf(transaction)
      const quantity = transactionData[transactionIndex].quantity
      const currentStock = stockLevels.get(transaction.postId) || 0
      stockLevels.set(transaction.postId, currentStock - quantity)
    }
    
    // 4. Identify low stock items
    const lowStockItems = Array.from(stockLevels.entries())
      .filter(([itemId, stock]) => stock < 30)
      .map(([itemId, stock]) => ({ itemId, stock }))
    
    expect(lowStockItems.length).to.be.greaterThan(0)
    
    // 5. Calculate total sales revenue
    let totalRevenue = 0
    for (const transaction of transactions) {
      const transactionIndex = transactions.indexOf(transaction)
      const itemId = transactionData[transactionIndex].itemId
      const quantity = transactionData[transactionIndex].quantity
      const price = inventoryData[itemId].price
      totalRevenue += quantity * price
    }
    
    expect(totalRevenue).to.be.greaterThan(0)
    
    // 6. Generate inventory report
    const inventoryReport = {
      totalItems: inventoryItems.length,
      totalTransactions: transactions.length,
      totalRevenue: totalRevenue,
      lowStockItems: lowStockItems,
      stockLevels: Object.fromEntries(stockLevels)
    }
    
    expect(inventoryReport.totalItems).to.equal(inventoryData.length)
    expect(inventoryReport.totalTransactions).to.equal(transactionData.length)
    
    // 7. Clean up
    for (const transaction of transactions) {
      await commentRepo.delete(transaction.id)
    }
    
    for (const item of inventoryItems) {
      await postRepo.delete(item.id)
    }
  }

  /**
   * Test social media platform scenario
   */
  async testSocialMediaPlatform(db: any): Promise<void> {
    const userRepo = db.getRepository('users')
    const postRepo = db.getRepository('posts')
    const commentRepo = db.getRepository('comments')
    const tagRepo = db.getRepository('tags')
    
    // 1. Create social media users
    const users: User[] = []
    for (let i = 0; i < 20; i++) {
      const user = await userRepo.create({
        id: `social-user-${i}`,
        email: `user${i}@social.com`,
        firstName: `Social${i}`,
        lastName: 'User',
        active: true
      }) as User
      users.push(user)
    }
    
    // 2. Create trending hashtags
    const hashtags: Tag[] = []
    const hashtagNames = ['#tech', '#lifestyle', '#food', '#travel', '#fitness', '#music']
    for (let i = 0; i < hashtagNames.length; i++) {
      const hashtag = await tagRepo.create({
        id: `hashtag-${i}`,
        name: hashtagNames[i],
        color: `#${i}${i}${i}${i}${i}${i}`
      }) as Tag
      hashtags.push(hashtag)
    }
    
    // 3. Create social media posts
    const posts: Post[] = []
    const postData: SocialPostData[] = [
      { content: 'Just tried this amazing new restaurant!', hashtags: [0, 1], likes: 15 },
      { content: 'Beautiful sunset from my vacation', hashtags: [0, 3], likes: 25 },
      { content: 'Morning workout complete!', hashtags: [4], likes: 8 },
      { content: 'New album dropped and it\'s fire!', hashtags: [5], likes: 30 },
      { content: 'Tech conference was incredible', hashtags: [0], likes: 20 }
    ]
    
    for (let i = 0; i < 50; i++) {
      const postIndex = i % postData.length
      const post = await postRepo.create({
        id: `social-post-${i}`,
        userId: users[i % users.length].id,
        title: `Social Post ${i}`,
        content: postData[postIndex].content,
        published: true
      }) as Post
      posts.push(post)
    }
    
    // 4. Create post-hashtag relationships
    const kysely = db.getKysely()
    for (let i = 0; i < posts.length; i++) {
      const postIndex = i % postData.length
      for (const hashtagIndex of postData[postIndex].hashtags) {
        await kysely
          .insertInto('post_tags')
          .values({
            postId: posts[i].id,
            tagId: hashtags[hashtagIndex].id
          })
          .execute()
      }
    }
    
    // 5. Create comments and interactions
    const comments: Comment[] = []
    for (let i = 0; i < 100; i++) {
      const comment = await commentRepo.create({
        id: `social-comment-${i}`,
        postId: posts[i % posts.length].id,
        userId: users[i % users.length].id,
        content: `Great post! Comment ${i}`
      }) as Comment
      comments.push(comment)
    }
    
    // 6. Calculate user engagement metrics
    const userEngagement = new Map<string, number>()
    for (const user of users) {
      const userPosts = posts.filter(post => post.userId === user.id)
      const userComments = comments.filter(comment => comment.userId === user.id)
      const engagement = userPosts.length * 2 + userComments.length // Posts worth 2 points, comments 1 point
      userEngagement.set(user.id, engagement)
    }
    
    expect(userEngagement.size).to.equal(users.length)
    
    // 7. Find trending hashtags
    const hashtagUsage = new Map<string, number>()
    for (const post of posts) {
      const postIndex = posts.indexOf(post)
      for (const hashtagIndex of postData[postIndex % postData.length].hashtags) {
        const hashtagId = hashtags[hashtagIndex].id
        hashtagUsage.set(hashtagId, (hashtagUsage.get(hashtagId) || 0) + 1)
      }
    }
    
    const trendingHashtags = Array.from(hashtagUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
    
    expect(trendingHashtags.length).to.be.greaterThan(0)
    
    // 8. Generate user recommendations
    const userRecommendations = new Map<string, User[]>()
    for (const user of users) {
      const userPosts = posts.filter(post => post.userId === user.id)
      const userHashtags = new Set<number>()
      
      for (const post of userPosts) {
        const postIndex = posts.indexOf(post)
        for (const hashtagIndex of postData[postIndex % postData.length].hashtags) {
          userHashtags.add(hashtagIndex)
        }
      }
      
      // Find other users with similar interests
      const similarUsers = users.filter(otherUser => {
        if (otherUser.id === user.id) return false
        
        const otherUserPosts = posts.filter(post => post.userId === otherUser.id)
        const otherUserHashtags = new Set<number>()
        
        for (const post of otherUserPosts) {
          const postIndex = posts.indexOf(post)
          for (const hashtagIndex of postData[postIndex % postData.length].hashtags) {
            otherUserHashtags.add(hashtagIndex)
          }
        }
        
        // Check for common hashtags
        const commonHashtags = new Set([...userHashtags].filter(x => otherUserHashtags.has(x)))
        return commonHashtags.size > 0
      })
      userRecommendations.set(user.id, similarUsers.slice(0, 2)) // Top 2 recommendations
    }
    
    expect(userRecommendations.size).to.equal(users.length)
    
    // 9. Clean up
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
    
    for (const hashtag of hashtags) {
      await tagRepo.delete(hashtag.id)
    }
    
    for (const user of users) {
      await userRepo.delete(user.id)
    }
  }

  /**
   * Test content management system scenario
   */
  async testContentManagementSystem(db: any): Promise<void> {
    const userRepo = db.getRepository('users')
    const postRepo = db.getRepository('posts')
    const commentRepo = db.getRepository('comments')
    const tagRepo = db.getRepository('tags')
    
    // 1. Create Content Team
    const teamMembers: User[] = []
    const roles = ['Editor', 'Writer', 'Reviewer', 'Publisher']
    
    for (let i = 0; i < 10; i++) {
      const member = await userRepo.create({
        id: `team-member-${i}`,
        email: `member${i}@cms.com`,
        firstName: `Team${i}`,
        lastName: roles[i % roles.length],
        active: true
      }) as User
      teamMembers.push(member)
    }
    
    // 2. Create Content Categories
    const categories: Tag[] = []
    const categoryNames = ['Technology', 'Business', 'Lifestyle', 'Education', 'Entertainment']
    for (let i = 0; i < categoryNames.length; i++) {
      const category = await tagRepo.create({
        id: `cms-category-${i}`,
        name: categoryNames[i],
        color: `#${i}${i}${i}${i}${i}${i}`
      }) as Tag
      categories.push(category)
    }
    
    // 3. Create Content Articles
    const articles: Post[] = []
    for (let i = 0; i < 30; i++) {
      const article = await postRepo.create({
        id: `article-${i}`,
        userId: teamMembers[i % teamMembers.length].id,
        title: `CMS Article ${i}: ${categoryNames[i % categoryNames.length]} Topic`,
        content: `This is a comprehensive article about ${categoryNames[i % categoryNames.length]}. It covers various aspects and provides detailed information.`,
        published: i % 3 !== 0 // 2/3 of articles are published
      }) as Post
      articles.push(article)
    }
    
    // 4. Create article-category relationships
    const kysely = db.getKysely()
    for (let i = 0; i < articles.length; i++) {
      await kysely
        .insertInto('post_tags')
        .values({
          postId: articles[i].id,
          tagId: categories[i % categories.length].id
        })
        .execute()
    }
    
    // 5. Create editorial comments
    const editorialComments: Comment[] = []
    for (let i = 0; i < 60; i++) {
      const comment = await commentRepo.create({
        id: `editorial-comment-${i}`,
        postId: articles[i % articles.length].id,
        userId: teamMembers[i % teamMembers.length].id,
        content: `Editorial feedback ${i}: This article needs ${i % 2 === 0 ? 'more detail' : 'better structure'}.`
      }) as Comment
      editorialComments.push(comment)
    }
    
    // 6. Content workflow management
    const draftArticles = articles.filter(article => !article.published)
    const publishedArticles = articles.filter(article => article.published)
    
    expect(draftArticles.length).to.be.greaterThan(0)
    expect(publishedArticles.length).to.be.greaterThan(0)
    
    // 7. Editorial review process
    for (const article of draftArticles) {
      const articleToUpdate = await postRepo.findById(article.id) as Post
      if (articleToUpdate) {
        articleToUpdate.published = true
        articleToUpdate.title = `✅ ${articleToUpdate.title}` // Mark as approved
        await postRepo.update(articleToUpdate)
      }
    }
    
    // 8. Content performance tracking
    const contentPerformance = {
      totalArticles: articles.length,
      publishedArticles: publishedArticles.length,
      draftArticles: draftArticles.length,
      totalComments: editorialComments.length,
      averageCommentsPerArticle: editorialComments.length / articles.length
    }
    
    expect(contentPerformance.totalArticles).to.equal(30)
    expect(contentPerformance.publishedArticles).to.be.greaterThan(0)
    
    // 9. Team productivity metrics
    const teamProductivity = new Map<string, number>()
    for (const member of teamMembers) {
      const memberArticles = articles.filter(article => article.userId === member.id)
      const memberComments = editorialComments.filter(comment => comment.userId === member.id)
      const productivity = memberArticles.length * 2 + memberComments.length
      teamProductivity.set(member.id, productivity)
    }
    
    expect(teamProductivity.size).to.equal(teamMembers.length)
    
    // 10. Clean up
    for (const comment of editorialComments) {
      await commentRepo.delete(comment.id)
    }
    
    for (let i = 0; i < articles.length; i++) {
      await kysely
        .deleteFrom('post_tags')
        .where('postId', '=', articles[i].id)
        .execute()
      await postRepo.delete(articles[i].id)
    }
    
    for (const category of categories) {
      await tagRepo.delete(category.id)
    }
    
    for (const member of teamMembers) {
      await userRepo.delete(member.id)
    }
  }

  /**
   * Test analytics and reporting scenario
   */
  async testAnalyticsAndReporting(db: any): Promise<void> {
    const userRepo = db.getRepository('users')
    const postRepo = db.getRepository('posts')
    const commentRepo = db.getRepository('comments')
    const tagRepo = db.getRepository('tags')
    
    // 1. Create test data for analytics
    const users: User[] = []
    for (let i = 0; i < 50; i++) {
      const user = await userRepo.create({
        id: `analytics-user-${i}`,
        email: `analytics${i}@example.com`,
        firstName: `Analytics${i}`,
        lastName: 'User',
        active: i % 10 !== 0 // 90% active users
      }) as User
      users.push(user)
    }
    
    const posts: Post[] = []
    for (let i = 0; i < 100; i++) {
      const post = await postRepo.create({
        id: `analytics-post-${i}`,
        userId: users[i % users.length].id,
        title: `Analytics Post ${i}`,
        content: `This is analytics test post ${i}.`,
        published: i % 5 !== 0 // 80% published
      }) as Post
      posts.push(post)
    }
    
    const comments: Comment[] = []
    for (let i = 0; i < 200; i++) {
      const comment = await commentRepo.create({
        id: `analytics-comment-${i}`,
        postId: posts[i % posts.length].id,
        userId: users[i % users.length].id,
        content: `Analytics comment ${i}`
      }) as Comment
      comments.push(comment)
    }
    
    const tags: Tag[] = []
    const tagNames = ['Tech', 'Business', 'Lifestyle', 'Education']
    for (let i = 0; i < tagNames.length; i++) {
      const tag = await tagRepo.create({
        id: `analytics-tag-${i}`,
        name: tagNames[i],
        color: `#${i}${i}${i}${i}${i}${i}`
      }) as Tag
      tags.push(tag)
    }
    
    // 2. User Analytics
    const userAnalytics: UserAnalytics = {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.active).length,
      inactiveUsers: users.filter(u => !u.active).length,
      userEngagement: new Map()
    }
    
    // Calculate user engagement
    for (const user of users) {
      const userPosts = posts.filter(post => post.userId === user.id)
      const userComments = comments.filter(comment => comment.userId === user.id)
      const engagement = userPosts.length * 2 + userComments.length
      userAnalytics.userEngagement.set(user.id, engagement)
    }
    
    expect(userAnalytics.totalUsers).to.equal(50)
    expect(userAnalytics.activeUsers).to.be.greaterThan(0)
    
    // 3. Content Analytics
    const contentAnalytics: ContentAnalytics = {
      totalPosts: posts.length,
      publishedPosts: posts.filter(p => p.published).length,
      draftPosts: posts.filter(p => !p.published).length,
      totalComments: comments.length,
      averageCommentsPerPost: comments.length / posts.length
    }
    
    expect(contentAnalytics.totalPosts).to.equal(100)
    expect(contentAnalytics.publishedPosts).to.be.greaterThan(0)
    
    // 4. Engagement Analytics
    const engagementAnalytics: EngagementAnalytics = {
      totalEngagement: 0,
      averageEngagementPerUser: 0,
      highEngagementUsers: [],
      lowEngagementUsers: []
    }
    
    engagementAnalytics.totalEngagement = Array.from(userAnalytics.userEngagement.values())
      .reduce((sum, engagement) => sum + engagement, 0)
    
    engagementAnalytics.averageEngagementPerUser = engagementAnalytics.totalEngagement / users.length
    
    // Identify high and low engagement users
    const sortedUsers = Array.from(userAnalytics.userEngagement.entries())
      .sort((a, b) => b[1] - a[1])
    
    engagementAnalytics.highEngagementUsers = sortedUsers
      .slice(0, 10)
      .map(([userId, engagement]) => ({ userId, engagement }))
    
    engagementAnalytics.lowEngagementUsers = sortedUsers
      .slice(-10)
      .map(([userId, engagement]) => ({ userId, engagement }))
    
    expect(engagementAnalytics.totalEngagement).to.be.greaterThan(0)
    expect(engagementAnalytics.highEngagementUsers.length).to.equal(10)
    expect(engagementAnalytics.lowEngagementUsers.length).to.equal(10)
    
    // 5. Content Performance Metrics
    const performanceMetrics: PerformanceMetrics = {
      postsWithComments: 0,
      postsWithoutComments: 0,
      averageCommentsPerPost: 0,
      mostCommentedPost: null,
      leastCommentedPost: null
    }
    
    const publishedPosts = posts.filter(p => p.published)
    const postsWithComments = publishedPosts.filter(post => 
      comments.some(comment => comment.postId === post.id)
    )
    
    performanceMetrics.postsWithComments = postsWithComments.length
    performanceMetrics.postsWithoutComments = publishedPosts.length - postsWithComments.length
    performanceMetrics.averageCommentsPerPost = comments.length / publishedPosts.length
    
    // Find most and least commented posts
    const postCommentCounts = new Map<string, number>()
    for (const post of publishedPosts) {
      const commentCount = comments.filter(c => c.postId === post.id).length
      postCommentCounts.set(post.id, commentCount)
    }
    
    const sortedPosts = Array.from(postCommentCounts.entries())
      .sort((a, b) => b[1] - a[1])
    
    if (sortedPosts.length > 0) {
      performanceMetrics.mostCommentedPost = {
        postId: sortedPosts[0][0],
        comments: sortedPosts[0][1]
      }
      performanceMetrics.leastCommentedPost = {
        postId: sortedPosts[sortedPosts.length - 1][0],
        comments: sortedPosts[sortedPosts.length - 1][1]
      }
    }
    
    expect(performanceMetrics.postsWithComments).to.be.greaterThan(0)
    expect(performanceMetrics.averageCommentsPerPost).to.be.greaterThan(0)
    
    // 6. Generate Comprehensive Report
    const comprehensiveReport: ComprehensiveReport = {
      summary: {
        totalUsers: userAnalytics.totalUsers,
        totalPosts: contentAnalytics.totalPosts,
        totalComments: contentAnalytics.totalComments,
        totalEngagement: engagementAnalytics.totalEngagement
      },
      userMetrics: userAnalytics,
      contentMetrics: contentAnalytics,
      engagementMetrics: engagementAnalytics,
      performanceMetrics: performanceMetrics,
      generatedAt: new Date().toISOString()
    }
    
    expect(comprehensiveReport.summary.totalUsers).to.equal(50)
    expect(comprehensiveReport.summary.totalPosts).to.equal(100)
    expect(comprehensiveReport.summary.totalComments).to.equal(200)
    expect(comprehensiveReport.generatedAt).to.exist
    
    // 7. Clean up
    for (const comment of comments) {
      await commentRepo.delete(comment.id)
    }
    
    for (const post of posts) {
      await postRepo.delete(post.id)
    }
    
    for (const tag of tags) {
      await tagRepo.delete(tag.id)
    }
    
    for (const user of users) {
      await userRepo.delete(user.id)
    }
  }

  /**
   * Run all tests for a specific database dialect
   */
  async runTestsForDialect(dialect: 'sqlite'): Promise<void> {
    describe(`${dialect.toUpperCase()}`, () => {
      it('should handle complete e-commerce customer journey', withTestDatabase(dialect, async (testDb) => {
        const { db } = testDb
        
        await this.testEcommerceCustomerJourney(db)
      }))

      it('should handle inventory management scenario', withTestDatabase(dialect, async (testDb) => {
        const { db } = testDb
        
        await this.testInventoryManagement(db)
      }))

      it('should handle social media platform scenario', withTestDatabase(dialect, async (testDb) => {
        const { db } = testDb
        
        await this.testSocialMediaPlatform(db)
      }))

      it('should handle content management system scenario', withTestDatabase(dialect, async (testDb) => {
        const { db } = testDb
        
        await this.testContentManagementSystem(db)
      }))

      it('should handle analytics and reporting scenario', withTestDatabase(dialect, async (testDb) => {
        const { db } = testDb
        
        await this.testAnalyticsAndReporting(db)
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

    describe('Real-World Scenarios E2E Tests', () => {
      describe('E-Commerce Platform Scenario', () => {
        for (const dialect of this.enabledDatabases) {
          this.runTestsForDialect(dialect)
        }
      })

      describe('Inventory Management Scenario', () => {
        for (const dialect of this.enabledDatabases) {
          this.runTestsForDialect(dialect)
        }
      })

      describe('Social Media Platform Scenario', () => {
        for (const dialect of this.enabledDatabases) {
          this.runTestsForDialect(dialect)
        }
      })

      describe('Content Management System Scenario', () => {
        for (const dialect of this.enabledDatabases) {
          this.runTestsForDialect(dialect)
        }
      })

      describe('Analytics and Reporting Scenario', () => {
        for (const dialect of this.enabledDatabases) {
          this.runTestsForDialect(dialect)
        }
      })
    })
  }
}

// Initialize the test suite
const testSuite = new RealWorldScenariosTestSuite()
testSuite.initialize()
