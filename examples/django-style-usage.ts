/**
 * Django-Style Usage Examples for NOORMME
 * 
 * This example demonstrates how NOORMME brings Django's powerful ORM patterns
 * to Next.js applications, providing familiar and intuitive query methods.
 */

import { NOORMME } from '../src/noormme.js'

// Initialize NOORMME with auto-discovery
const db = new NOORMME({
  dialect: 'sqlite',
  connection: { database: './example.db' }
})

await db.initialize()

// Get repositories with Django-style objects manager
const User = db.getRepository('users')
const Post = db.getRepository('posts')
const Comment = db.getRepository('comments')

// ============================================================================
// Django-Style Query Patterns
// ============================================================================

async function demonstrateDjangoPatterns() {
  console.log('🚀 Django-Style ORM Patterns with NOORMME\n')

  // ============================================================================
  // 1. Basic Filtering (Django's .filter())
  // ============================================================================
  
  console.log('1️⃣ Basic Filtering')
  
  // Django-style filtering
  const activeUsers = await User.objects
    .filter({ is_active: true })
    .all()
  
  const johnUsers = await User.objects
    .filter('name', 'contains', 'John')
    .all()
  
  const recentPosts = await Post.objects
    .filter('created_at', 'gte', new Date('2024-01-01'))
    .all()
  
  console.log(`Found ${activeUsers.length} active users`)
  console.log(`Found ${johnUsers.length} users with 'John' in name`)
  console.log(`Found ${recentPosts.length} recent posts\n`)

  // ============================================================================
  // 2. Advanced Filtering with Operators
  // ============================================================================
  
  console.log('2️⃣ Advanced Filtering with Operators')
  
  // Django-style field lookups
  const emailUsers = await User.objects
    .filter('email', 'endswith', '@gmail.com')
    .all()
  
  const rangeUsers = await User.objects
    .filter('age', 'range', [18, 65])
    .all()
  
  const nullUsers = await User.objects
    .filter('last_login', 'isnull', true)
    .all()
  
  console.log(`Found ${emailUsers.length} Gmail users`)
  console.log(`Found ${rangeUsers.length} users aged 18-65`)
  console.log(`Found ${nullUsers.length} users who never logged in\n`)

  // ============================================================================
  // 3. Exclusions (Django's .exclude())
  // ============================================================================
  
  console.log('3️⃣ Exclusions')
  
  const nonAdminUsers = await User.objects
    .filter({ is_active: true })
    .exclude({ is_admin: true })
    .all()
  
  const nonSpamPosts = await Post.objects
    .filter({ published: true })
    .exclude('title', 'contains', 'spam')
    .all()
  
  console.log(`Found ${nonAdminUsers.length} active non-admin users`)
  console.log(`Found ${nonSpamPosts.length} non-spam published posts\n`)

  // ============================================================================
  // 4. Ordering (Django's .order_by())
  // ============================================================================
  
  console.log('4️⃣ Ordering')
  
  const usersByDate = await User.objects
    .filter({ is_active: true })
    .order_by('-created_at', 'name')
    .all()
  
  const topPosts = await Post.objects
    .filter({ published: true })
    .order_by('-view_count', '-created_at')
    .limit(10)
    .all()
  
  console.log(`Found ${usersByDate.length} users ordered by creation date`)
  console.log(`Found ${topPosts.length} top posts\n`)

  // ============================================================================
  // 5. Chaining and Lazy Evaluation
  // ============================================================================
  
  console.log('5️⃣ Query Chaining')
  
  const query = Post.objects
    .filter({ published: true })
    .exclude('title', 'contains', 'draft')
    .order_by('-created_at')
  
  // Query hasn't been executed yet - lazy evaluation!
  console.log('Query created but not executed yet')
  
  // Now execute the query
  const publishedPosts = await query.all()
  console.log(`Found ${publishedPosts.length} published posts\n`)

  // ============================================================================
  // 6. Aggregations (Django's .aggregate())
  // ============================================================================
  
  console.log('6️⃣ Aggregations')
  
  const userStats = await User.objects.aggregate({
    total: { field: '*', function: 'count' },
    avg_age: { field: 'age', function: 'avg' },
    max_age: { field: 'age', function: 'max' },
    min_age: { field: 'age', function: 'min' }
  })
  
  const postStats = await Post.objects
    .filter({ published: true })
    .aggregate({
      total_posts: { field: '*', function: 'count' },
      total_views: { field: 'view_count', function: 'sum' },
      avg_views: { field: 'view_count', function: 'avg' }
    })
  
  console.log('User Statistics:', userStats)
  console.log('Post Statistics:', postStats)
  console.log()

  // ============================================================================
  // 7. Single Object Operations (Django's .get())
  // ============================================================================
  
  console.log('7️⃣ Single Object Operations')
  
  try {
    const specificUser = await User.objects.get({ email: 'john@example.com' })
    console.log('Found user:', specificUser.name)
  } catch (error) {
    console.log('User not found or multiple users found')
  }
  
  const firstUser = await User.objects.first()
  const lastUser = await User.objects.last()
  
  console.log(`First user: ${firstUser?.name}`)
  console.log(`Last user: ${lastUser?.name}`)
  console.log()

  // ============================================================================
  // 8. Counting and Existence Checks
  // ============================================================================
  
  console.log('8️⃣ Counting and Existence')
  
  const userCount = await User.objects.count()
  const activeUserCount = await User.objects.filter({ is_active: true }).count()
  const hasUsers = await User.objects.exists()
  const hasActiveUsers = await User.objects.filter({ is_active: true }).exists()
  
  console.log(`Total users: ${userCount}`)
  console.log(`Active users: ${activeUserCount}`)
  console.log(`Has users: ${hasUsers}`)
  console.log(`Has active users: ${hasActiveUsers}`)
  console.log()

  // ============================================================================
  // 9. Creation and Updates (Django's .create(), .get_or_create(), etc.)
  // ============================================================================
  
  console.log('9️⃣ Creation and Updates')
  
  // Create a new user
  const newUser = await User.objects.create({
    name: 'Alice Johnson',
    email: 'alice@example.com',
    is_active: true
  })
  console.log('Created user:', newUser.name)
  
  // Get or create (won't create if exists)
  const [user, created] = await User.objects.get_or_create(
    { email: 'bob@example.com' },
    { name: 'Bob Smith', is_active: true }
  )
  console.log(`${created ? 'Created' : 'Found existing'} user:`, user.name)
  
  // Update or create
  const [updatedUser, wasCreated] = await User.objects.update_or_create(
    { email: 'charlie@example.com' },
    { name: 'Charlie Brown', is_active: true, last_login: new Date() }
  )
  console.log(`${wasCreated ? 'Created' : 'Updated'} user:`, updatedUser.name)
  console.log()

  // ============================================================================
  // 10. Bulk Operations
  // ============================================================================
  
  console.log('🔟 Bulk Operations')
  
  const bulkUsers = await User.objects.bulk_create([
    { name: 'User 1', email: 'user1@example.com', is_active: true },
    { name: 'User 2', email: 'user2@example.com', is_active: true },
    { name: 'User 3', email: 'user3@example.com', is_active: false }
  ])
  console.log(`Bulk created ${bulkUsers.length} users`)
  
  // Bulk update
  const updatedCount = await User.objects
    .filter({ is_active: false })
    .update({ last_login: new Date() })
  console.log(`Bulk updated ${updatedCount} inactive users`)
  
  // Bulk delete
  const deletedCount = await User.objects
    .filter({ email__endswith: '@temp.com' })
    .delete()
  console.log(`Bulk deleted ${deletedCount} temporary users`)
  console.log()

  // ============================================================================
  // 11. Values and Values List (Django's .values(), .values_list())
  // ============================================================================
  
  console.log('1️⃣1️⃣ Values and Values List')
  
  const userNames = await User.objects
    .filter({ is_active: true })
    .values_list('name', true) // flat=True
  
  const userEmails = await User.objects
    .filter({ is_active: true })
    .values_list('email')
  
  console.log('Active user names:', userNames.slice(0, 5))
  console.log('Active user emails:', userEmails.slice(0, 5))
  console.log()

  // ============================================================================
  // 12. Complex Queries with Multiple Conditions
  // ============================================================================
  
  console.log('1️⃣2️⃣ Complex Queries')
  
  const complexQuery = await User.objects
    .filter({ is_active: true })
    .filter('age', 'gte', 18)
    .exclude('email', 'contains', 'spam')
    .order_by('-last_login', 'name')
    .limit(20)
    .all()
  
  console.log(`Found ${complexQuery.length} users matching complex criteria`)
  
  // ============================================================================
  // 13. Relationship Loading (Django's .select_related(), .prefetch_related())
  // ============================================================================
  
  console.log('1️⃣3️⃣ Relationship Loading')
  
  // Note: These would be implemented with actual relationship loading
  const postsWithAuthors = await Post.objects
    .filter({ published: true })
    .select_related('author') // JOIN query
    .order_by('-created_at')
    .limit(10)
    .all()
  
  const usersWithPosts = await User.objects
    .filter({ is_active: true })
    .prefetch_related('posts', 'comments') // Separate queries
    .limit(10)
    .all()
  
  console.log(`Found ${postsWithAuthors.length} posts with authors`)
  console.log(`Found ${usersWithPosts.length} users with posts and comments`)
}

// ============================================================================
// Next.js Integration Examples
// ============================================================================

// Example: Server Component usage
export async function getActiveUsers() {
  return await User.objects
    .filter({ is_active: true })
    .order_by('-last_login')
    .limit(50)
    .all()
}

// Example: Server Action usage
export async function createPost(formData: FormData) {
  'use server'
  
  const post = await Post.objects.create({
    title: formData.get('title'),
    content: formData.get('content'),
    author_id: formData.get('author_id'),
    published: true
  })
  
  return post
}

// Example: API Route usage
export async function getUserStats() {
  const stats = await User.objects.aggregate({
    total: { field: '*', function: 'count' },
    active: { field: 'is_active', function: 'count' },
    avg_age: { field: 'age', function: 'avg' }
  })
  
  return stats
}

// ============================================================================
// Django Comparison
// ============================================================================

/*
Django Python Code:                    NOORMME TypeScript Code:

User.objects.filter(                   User.objects.filter({
  is_active=True,                        is_active: true,
  age__gte=18                           age: { __gte: 18 }
).exclude(                             }).exclude({
  email__contains='spam'                 email: { __contains: 'spam' }
).order_by(                            }).order_by(
  '-last_login', 'name'                  '-last_login', 'name'
).limit(20)                            ).limit(20)

User.objects.aggregate(                User.objects.aggregate({
  total=Count('*'),                      total: { field: '*', function: 'count' },
  avg_age=Avg('age')                     avg_age: { field: 'age', function: 'avg' }
)                                      })

User.objects.get_or_create(            User.objects.get_or_create(
  email='user@example.com',              { email: 'user@example.com' },
  defaults={'name': 'User'}              { name: 'User' }
)                                      })

Post.objects.select_related(           Post.objects.select_related(
  'author'                               'author'
).prefetch_related(                     ).prefetch_related(
  'comments', 'tags'                     'comments', 'tags'
)                                       })
*/

// Run the demonstration
demonstrateDjangoPatterns().catch(console.error)
