// NOORMME Usage Examples
// This file shows how to use the generated types and repositories

import { NOORMME } from 'noormme'
import { createRepositoryFactory } from './repositories'
import { automationConfig } from './automation.config'

// Initialize NOORMME with automation
const db = new NOORMME(automationConfig)
await db.initialize()

// Create repository factory
const repositories = createRepositoryFactory(db)

// Example 1: Basic CRUD operations
async function basicCrudExample() {
  const usersRepo = repositories.users
  
  // Create a new record
  const newUsers = await usersRepo.create({
    // Add your data here
  })
  
  // Find by ID
  const users = await usersRepo.findById(newUsers.id)
  
  // Update record
  const updatedUsers = await usersRepo.update(newUsers.id, {
    // Add fields to update
  })
  
  // Delete record
  await usersRepo.delete(newUsers.id)
}

// Example 2: Using dynamic finders
async function dynamicFinderExample() {
  const usersRepo = repositories.users
  
  // Dynamic finders will be available based on your table columns
}

// Example 3: Direct repository access
async function directRepositoryExample() {
  // Get repository directly from NOORMME
  const usersRepo = db.getRepository('users')
  
  // Use all repository methods
  const allUserss = await usersRepo.findAll()
  const count = await usersRepo.count()
  const exists = await usersRepo.exists(1)
}

// Example 4: Complex queries with Kysely
async function complexQueryExample() {
  const kysely = db.getKysely()
  
  // Type-safe complex queries
  const result = await kysely
    .selectFrom('users')
    .selectAll()
    .where('status', '=', 'active')
    .orderBy('created_at', 'desc')
    .limit(10)
    .execute()
}

// Example 5: Performance monitoring
async function performanceExample() {
  // Get performance metrics
  const metrics = await db.getSQLitePerformanceMetrics()
  console.log('Cache hit rate:', metrics.cacheHitRate)
  console.log('Average query time:', metrics.averageQueryTime)
  
  // Get optimization recommendations
  const recommendations = await db.getSQLiteIndexRecommendations()
  console.log('Recommended indexes:', recommendations.recommendations)
}

// Example 6: Migration management
async function migrationExample() {
  const migrationManager = db.getMigrationManager()
  
  // Initialize migration manager
  await migrationManager.initialize()
  
  // Generate a new migration
  await migrationManager.generateMigration('add_new_column')
  
  // Apply migrations
  await migrationManager.executeMigrations()
  
  // Check migration status
  const status = await migrationManager.getStatus()
  console.log('Migration status:', status)
}

// Run examples
async function runExamples() {
  try {
    console.log('🚀 Running NOORMME examples...')
    
    await basicCrudExample()
    console.log('✅ Basic CRUD example completed')
    
    await dynamicFinderExample()
    console.log('✅ Dynamic finder example completed')
    
    await directRepositoryExample()
    console.log('✅ Direct repository example completed')
    
    await complexQueryExample()
    console.log('✅ Complex query example completed')
    
    await performanceExample()
    console.log('✅ Performance example completed')
    
    console.log('🎉 All examples completed successfully!')
    
  } catch (error) {
    console.error('❌ Example failed:', error)
  } finally {
    await db.close()
  }
}

// Uncomment to run examples
// runExamples()
