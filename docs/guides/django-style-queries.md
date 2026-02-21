# Django-Style Queries for Agents

NOORMME brings Django's powerful ORM patterns to Next.js, providing familiar and intuitive query methods that make autonomous database operations feel natural and expressive for both humans and agents.

## Overview

The Django-style query system in NOORMME provides:

- **Familiar API**: Methods that work just like Django's ORM
- **Lazy Evaluation**: Queries are built up and executed only when needed
- **Method Chaining**: Fluent interface for complex queries
- **Type Safety**: Full TypeScript support with auto-generated types
- **Performance**: Optimized queries with intelligent caching

## Basic Usage

### Getting Started

```typescript
import { NOORMME } from 'noormme'

const db = new NOORMME({
  dialect: 'sqlite',
  connection: { database: './app.db' }
})

await db.initialize()

// Get Django-style repository
const User = db.getRepository('users')
```

### The `objects` Manager

Every repository now includes an `objects` manager that provides Django-style methods:

```typescript
// Django-style syntax
const users = await User.objects.filter({ is_active: true }).all()
const user = await User.objects.get({ email: 'john@example.com' })
const count = await User.objects.count()
```

## Query Methods

### Filtering with `.filter()`

The `.filter()` method allows you to filter records using various operators:

```typescript
// Exact match
const users = await User.objects.filter({ is_active: true }).all()

// Field lookups with operators
const users = await User.objects
  .filter('name', 'contains', 'John')
  .filter('age', 'gte', 18)
  .all()

// Multiple filters (AND logic)
const users = await User.objects
  .filter({ is_active: true })
  .filter('created_at', 'gte', new Date('2024-01-01'))
  .all()
```

#### Supported Filter Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `exact` | Exact match (default) | `filter('name', 'John')` |
| `iexact` | Case-insensitive exact | `filter('name', 'iexact', 'john')` |
| `contains` | Contains substring | `filter('name', 'contains', 'John')` |
| `icontains` | Case-insensitive contains | `filter('name', 'icontains', 'john')` |
| `startswith` | Starts with | `filter('name', 'startswith', 'John')` |
| `istartswith` | Case-insensitive starts with | `filter('name', 'istartswith', 'john')` |
| `endswith` | Ends with | `filter('email', 'endswith', '@gmail.com')` |
| `iendswith` | Case-insensitive ends with | `filter('email', 'iendswith', '@gmail.com')` |
| `in` | In list | `filter('status', 'in', ['active', 'pending'])` |
| `gt` | Greater than | `filter('age', 'gt', 18)` |
| `gte` | Greater than or equal | `filter('age', 'gte', 18)` |
| `lt` | Less than | `filter('age', 'lt', 65)` |
| `lte` | Less than or equal | `filter('age', 'lte', 65)` |
| `range` | Between values | `filter('age', 'range', [18, 65])` |
| `isnull` | Is null/not null | `filter('deleted_at', 'isnull', true)` |

### Excluding with `.exclude()`

The `.exclude()` method filters out records matching the criteria:

```typescript
// Exclude specific records
const users = await User.objects
  .filter({ is_active: true })
  .exclude({ is_admin: true })
  .all()

// Exclude with field lookups
const posts = await Post.objects
  .filter({ published: true })
  .exclude('title', 'contains', 'spam')
  .all()
```

### Ordering with `.order_by()`

The `.order_by()` method sorts the results:

```typescript
// Ascending order (default)
const users = await User.objects.order_by('name').all()

// Descending order (prefix with -)
const users = await User.objects.order_by('-created_at').all()

// Multiple fields
const users = await User.objects
  .order_by('-last_login', 'name')
  .all()
```

### Limiting and Offsetting

```typescript
// Limit results
const users = await User.objects.limit(10).all()

// Offset results
const users = await User.objects.offset(20).limit(10).all()

// Pagination example
const page = 2
const pageSize = 10
const users = await User.objects
  .offset((page - 1) * pageSize)
  .limit(pageSize)
  .all()
```

### Distinct Results

```typescript
// Get unique values
const uniqueNames = await User.objects
  .values_list('name')
  .distinct()
  .all()
```

## Query Execution

### Getting All Results with `.all()`

```typescript
// Execute the query and get all results
const users = await User.objects
  .filter({ is_active: true })
  .order_by('name')
  .all()
```

### Getting Single Results

```typescript
// Get single record (throws if none or multiple found)
try {
  const user = await User.objects.get({ email: 'john@example.com' })
} catch (error) {
  // Handle "not found" or "multiple found" errors
}

// Get first record (returns null if none found)
const user = await User.objects.first()

// Get last record (returns null if none found)
const user = await User.objects.last()
```

### Counting and Existence

```typescript
// Count total records
const totalUsers = await User.objects.count()

// Count filtered records
const activeUsers = await User.objects
  .filter({ is_active: true })
  .count()

// Check if any records exist
const hasUsers = await User.objects.exists()

// Check if filtered records exist
const hasActiveUsers = await User.objects
  .filter({ is_active: true })
  .exists()
```

## Aggregations

### Using `.aggregate()`

```typescript
// Basic aggregations
const stats = await User.objects.aggregate({
  total: { field: '*', function: 'count' },
  avg_age: { field: 'age', function: 'avg' },
  max_age: { field: 'age', function: 'max' },
  min_age: { field: 'age', function: 'min' },
  total_score: { field: 'score', function: 'sum' }
})

console.log(stats)
// { total: 100, avg_age: 32.5, max_age: 65, min_age: 18, total_score: 15000 }
```

### Supported Aggregation Functions

| Function | Description | Example |
|----------|-------------|---------|
| `count` | Count records | `{ field: '*', function: 'count' }` |
| `sum` | Sum values | `{ field: 'score', function: 'sum' }` |
| `avg` | Average values | `{ field: 'age', function: 'avg' }` |
| `min` | Minimum value | `{ field: 'created_at', function: 'min' }` |
| `max` | Maximum value | `{ field: 'created_at', function: 'max' }` |

## Data Manipulation

### Creating Records

```typescript
// Create single record
const user = await User.objects.create({
  name: 'John Doe',
  email: 'john@example.com',
  is_active: true
})

// Bulk create
const users = await User.objects.bulk_create([
  { name: 'User 1', email: 'user1@example.com' },
  { name: 'User 2', email: 'user2@example.com' },
  { name: 'User 3', email: 'user3@example.com' }
])
```

### Get or Create

```typescript
// Get existing record or create new one
const [user, created] = await User.objects.get_or_create(
  { email: 'john@example.com' }, // lookup fields
  { name: 'John Doe', is_active: true } // defaults if creating
)

if (created) {
  console.log('Created new user')
} else {
  console.log('Found existing user')
}
```

### Update or Create

```typescript
// Update existing record or create new one
const [user, wasCreated] = await User.objects.update_or_create(
  { email: 'john@example.com' }, // lookup fields
  { name: 'John Doe', is_active: true, last_login: new Date() } // values to set
)
```

### Bulk Updates

```typescript
// Update multiple records
const updatedCount = await User.objects
  .filter({ is_active: false })
  .update({ last_login: new Date() })

console.log(`Updated ${updatedCount} users`)
```

### Bulk Deletes

```typescript
// Delete multiple records
const deletedCount = await User.objects
  .filter({ email: 'endswith', '@temp.com' })
  .delete()

console.log(`Deleted ${deletedCount} temporary users`)
```

## Values and Values List

### Getting Specific Fields

```typescript
// Get only specific fields (returns objects)
const users = await User.objects
  .filter({ is_active: true })
  .values('name', 'email')
  .all()

// Get field values as list
const names = await User.objects
  .filter({ is_active: true })
  .values_list('name')
  .all()
// Returns: [['John'], ['Jane'], ['Bob']]

// Get flat list of values
const names = await User.objects
  .filter({ is_active: true })
  .values_list('name', true) // flat=true
  .all()
// Returns: ['John', 'Jane', 'Bob']
```

## Relationship Loading

### Select Related (JOIN queries)

```typescript
// Load related objects in a single query
const posts = await Post.objects
  .filter({ published: true })
  .select_related('author') // JOIN with users table
  .order_by('-created_at')
  .limit(10)
  .all()

// Access related data without additional queries
posts.forEach(post => {
  console.log(post.title, post.author.name) // No N+1 queries!
})
```

### Prefetch Related (Separate queries)

```typescript
// Load related objects with separate queries (for many-to-many)
const users = await User.objects
  .filter({ is_active: true })
  .prefetch_related('posts', 'comments') // Separate queries for each relationship
  .limit(10)
  .all()

// Access related data without additional queries
users.forEach(user => {
  console.log(user.name, user.posts.length, user.comments.length) // No N+1 queries!
})
```

## Method Chaining

Django-style queries support method chaining, allowing you to build complex queries:

```typescript
const query = User.objects
  .filter({ is_active: true })
  .filter('age', 'gte', 18)
  .exclude('email', 'contains', 'spam')
  .order_by('-last_login', 'name')
  .limit(20)

// Query hasn't been executed yet - lazy evaluation!
console.log('Query built but not executed')

// Execute when you need the results
const users = await query.all()
```

## Next.js Integration

### Server Components

```typescript
// app/users/page.tsx
export default async function UsersPage() {
  const users = await User.objects
    .filter({ is_active: true })
    .order_by('-last_login')
    .limit(50)
    .all()

  return (
    <div>
      {users.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  )
}
```

### Server Actions

```typescript
// app/actions.ts
'use server'

export async function createUser(formData: FormData) {
  const user = await User.objects.create({
    name: formData.get('name'),
    email: formData.get('email'),
    is_active: true
  })
  
  revalidatePath('/users')
  return user
}

export async function updateUserStatus(userId: string, isActive: boolean) {
  const updatedCount = await User.objects
    .filter({ id: userId })
    .update({ is_active: isActive })
  
  revalidatePath('/users')
  return updatedCount
}
```

### API Routes

```typescript
// app/api/users/stats/route.ts
export async function GET() {
  const stats = await User.objects.aggregate({
    total: { field: '*', function: 'count' },
    active: { field: 'is_active', function: 'count' },
    avg_age: { field: 'age', function: 'avg' }
  })
  
  return Response.json(stats)
}
```

## Performance Tips

### 1. Use Indexes

```sql
-- Create indexes for frequently filtered columns
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_posts_published ON posts(published);
```

### 2. Limit Results

```typescript
// Always limit large result sets
const users = await User.objects
  .filter({ is_active: true })
  .limit(100) // Prevent large queries
  .all()
```

### 3. Use Select Related for Foreign Keys

```typescript
// Good: Single query with JOIN
const posts = await Post.objects
  .select_related('author')
  .all()

// Avoid: N+1 queries
const posts = await Post.objects.all()
for (const post of posts) {
  const author = await User.objects.get({ id: post.author_id }) // N+1!
}
```

### 4. Use Prefetch Related for Many-to-Many

```typescript
// Good: Separate queries for many-to-many
const users = await User.objects
  .prefetch_related('groups', 'permissions')
  .all()

// Avoid: N+1 queries
const users = await User.objects.all()
for (const user of users) {
  const groups = await user.groups.all() // N+1!
}
```

## Error Handling

```typescript
try {
  const user = await User.objects.get({ email: 'nonexistent@example.com' })
} catch (error) {
  if (error.message.includes('No users found')) {
    console.log('User not found')
  } else if (error.message.includes('Multiple users found')) {
    console.log('Multiple users found with that email')
  } else {
    console.error('Unexpected error:', error)
  }
}
```

## Migration from Django

If you're coming from Django, the syntax is very similar:

```python
# Django Python
users = User.objects.filter(
    is_active=True,
    age__gte=18
).exclude(
    email__contains='spam'
).order_by('-last_login', 'name')[:20]
```

```typescript
// NOORMME TypeScript
const users = await User.objects
  .filter({ is_active: true })
  .filter('age', 'gte', 18)
  .exclude('email', 'contains', 'spam')
  .order_by('-last_login', 'name')
  .limit(20)
  .all()
```

The main differences:
- Use `await` for async operations
- Use `limit()` instead of slice notation `[:20]`
- Use `all()` to execute the query
- Field lookups use method parameters instead of `__` syntax

## Conclusion

NOORMME's Django-style query system brings the familiar and powerful Django ORM patterns to Next.js applications. With full TypeScript support, lazy evaluation, and optimized performance, you get the best of both worlds: Django's intuitive API with modern JavaScript/TypeScript development.
