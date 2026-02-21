# Kysely Integration with Noormme

Noormme provides seamless integration with Kysely, a type-safe SQL query builder. This allows you to write complex queries with full type safety and IntelliSense support.

## Getting Kysely Instance

```typescript
import { getKysely } from './db/noormme';

// Get the Kysely instance
const kysely = getKysely();
```

## Basic Query Operations

### Select Queries

```typescript
// Simple select
const users = await kysely
  .selectFrom('users')
  .selectAll()
  .execute();

// Select specific columns
const userEmails = await kysely
  .selectFrom('users')
  .select(['id', 'email', 'name'])
  .execute();

// Select with conditions
const activeUsers = await kysely
  .selectFrom('users')
  .selectAll()
  .where('active', '=', true)
  .execute();
```

### Insert Operations

```typescript
// Single insert
const newUser = await kysely
  .insertInto('users')
  .values({
    id: crypto.randomUUID(),
    name: 'John Doe',
    email: 'john@example.com',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  .returning('id')
  .executeTakeFirst();

// Multiple inserts
const newUsers = await kysely
  .insertInto('users')
  .values([
    {
      id: crypto.randomUUID(),
      name: 'Jane Doe',
      email: 'jane@example.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      name: 'Bob Smith',
      email: 'bob@example.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  ])
  .returning(['id', 'name', 'email'])
  .execute();
```

### Update Operations

```typescript
// Update single record
const updatedUser = await kysely
  .updateTable('users')
  .set({
    name: 'John Updated',
    updated_at: new Date().toISOString(),
  })
  .where('id', '=', '123')
  .returning(['id', 'name', 'email'])
  .executeTakeFirst();

// Update multiple records
const updatedUsers = await kysely
  .updateTable('users')
  .set({
    updated_at: new Date().toISOString(),
  })
  .where('active', '=', false)
  .returning(['id', 'name'])
  .execute();
```

### Delete Operations

```typescript
// Delete single record
await kysely
  .deleteFrom('users')
  .where('id', '=', '123')
  .execute();

// Delete multiple records
await kysely
  .deleteFrom('users')
  .where('active', '=', false)
  .execute();
```

## Complex Queries

### Joins

```typescript
// Inner join
const usersWithRoles = await kysely
  .selectFrom('users')
  .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
  .innerJoin('roles', 'roles.id', 'user_roles.role_id')
  .select([
    'users.id',
    'users.name',
    'users.email',
    'roles.name as role_name'
  ])
  .execute();

// Left join
const usersWithOptionalRoles = await kysely
  .selectFrom('users')
  .leftJoin('user_roles', 'user_roles.user_id', 'users.id')
  .leftJoin('roles', 'roles.id', 'user_roles.role_id')
  .select([
    'users.id',
    'users.name',
    'users.email',
    'roles.name as role_name'
  ])
  .execute();
```

### Aggregations

```typescript
// Count records
const userCount = await kysely
  .selectFrom('users')
  .select(kysely.fn.count('id').as('count'))
  .executeTakeFirst();

// Group by with aggregation
const roleStats = await kysely
  .selectFrom('user_roles')
  .innerJoin('roles', 'roles.id', 'user_roles.role_id')
  .select([
    'roles.name as role_name',
    kysely.fn.count('user_roles.user_id').as('user_count')
  ])
  .groupBy('roles.name')
  .execute();
```

### Subqueries

```typescript
// Subquery in WHERE clause
const usersWithRecentActivity = await kysely
  .selectFrom('users')
  .selectAll()
  .where('id', 'in', (qb) =>
    qb
      .selectFrom('user_sessions')
      .select('user_id')
      .where('created_at', '>=', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
  )
  .execute();

// Subquery in SELECT clause
const usersWithSessionCount = await kysely
  .selectFrom('users')
  .select([
    'users.id',
    'users.name',
    'users.email',
    (qb) =>
      qb
        .selectFrom('user_sessions')
        .select(kysely.fn.count('id').as('session_count'))
        .whereRef('user_sessions.user_id', '=', 'users.id')
        .as('session_count')
  ])
  .execute();
```

## Real-World Examples

### User Authentication Queries

```typescript
// Get user with account information
async function getUserByAccount(providerAccountId: string, provider: string) {
  const result = await kysely
    .selectFrom('accounts')
    .innerJoin('users', 'users.id', 'accounts.user_id')
    .selectAll('users')
    .where('accounts.provider', '=', provider)
    .where('accounts.provider_account_id', '=', providerAccountId)
    .executeTakeFirst();

  if (!result) return null;

  return {
    id: result.id,
    name: result.name,
    email: result.email,
    emailVerified: result.email_verified ? new Date(result.email_verified) : null,
    image: result.image,
  };
}

// Get session with user information
async function getSessionAndUser(sessionToken: string) {
  const result = await kysely
    .selectFrom('sessions')
    .innerJoin('users', 'users.id', 'sessions.user_id')
    .selectAll('users')
    .select('sessions.session_token', 'sessions.expires')
    .where('sessions.session_token', '=', sessionToken)
    .executeTakeFirst();

  if (!result) return null;

  return {
    session: {
      sessionToken: result.session_token,
      userId: result.id,
      expires: new Date(result.expires),
    },
    user: {
      id: result.id,
      name: result.name,
      email: result.email,
      emailVerified: result.email_verified ? new Date(result.email_verified) : null,
      image: result.image,
    },
  };
}
```

### RBAC Queries

```typescript
// Get user roles
async function getUserRoles(userId: string): Promise<string[]> {
  const result = await kysely
    .selectFrom('user_roles')
    .innerJoin('roles', 'roles.id', 'user_roles.role_id')
    .select(['roles.name'])
    .where('user_roles.user_id', '=', userId)
    .execute();

  return result.map(r => r.name);
}

// Get user permissions
async function getUserPermissions(userId: string): Promise<{ roles: string[]; permissions: Set<string> }> {
  const result = await kysely
    .selectFrom('user_roles')
    .innerJoin('roles', 'roles.id', 'user_roles.role_id')
    .innerJoin('role_permissions', 'role_permissions.role_id', 'roles.id')
    .innerJoin('permissions', 'permissions.id', 'role_permissions.permission_id')
    .select(['roles.name as role_name', 'permissions.name as permission_name'])
    .where('user_roles.user_id', '=', userId)
    .execute();

  const roleSet = new Set<string>();
  const permissionSet = new Set<string>();

  for (const row of result) {
    roleSet.add(row.role_name);
    permissionSet.add(row.permission_name);
  }

  return {
    roles: Array.from(roleSet),
    permissions: permissionSet,
  };
}
```

### Pagination Queries

```typescript
// Paginated user list
async function getUsersPaginated(page: number = 1, limit: number = 20) {
  const offset = (page - 1) * limit;

  // Get total count and paginated data in parallel
  const [total, result] = await Promise.all([
    kysely
      .selectFrom('users')
      .select(kysely.fn.count('id').as('count'))
      .executeTakeFirst()
      .then(row => Number(row?.count || 0)),
    kysely
      .selectFrom('users')
      .selectAll()
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute()
  ]);

  return {
    data: result,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}
```

## Transactions

### Basic Transaction

```typescript
// Simple transaction
await kysely.transaction().execute(async (trx) => {
  // Insert user
  const user = await trx
    .insertInto('users')
    .values({
      id: crypto.randomUUID(),
      name: 'John Doe',
      email: 'john@example.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .returning('id')
    .executeTakeFirst();

  // Insert user role
  await trx
    .insertInto('user_roles')
    .values({
      id: crypto.randomUUID(),
      user_id: user!.id,
      role_id: 'user-role-id',
      created_at: new Date().toISOString(),
    })
    .execute();
});
```

### Complex Transaction with Error Handling

```typescript
// Transaction with error handling
async function createUserWithRole(userData: any, roleName: string) {
  try {
    const result = await kysely.transaction().execute(async (trx) => {
      // Get role ID
      const role = await trx
        .selectFrom('roles')
        .select('id')
        .where('name', '=', roleName)
        .executeTakeFirst();

      if (!role) {
        throw new Error(`Role '${roleName}' not found`);
      }

      // Insert user
      const user = await trx
        .insertInto('users')
        .values({
          ...userData,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .returning('id')
        .executeTakeFirst();

      // Insert user role
      await trx
        .insertInto('user_roles')
        .values({
          id: crypto.randomUUID(),
          user_id: user!.id,
          role_id: role.id,
          created_at: new Date().toISOString(),
        })
        .execute();

      return user;
    });

    return result;
  } catch (error) {
    console.error('Transaction failed:', error);
    throw error;
  }
}
```

## Advanced Features

### Raw SQL Queries

```typescript
import { sql } from 'kysely';

// Raw SQL query
const result = await kysely.executeQuery(
  sql`SELECT * FROM users WHERE created_at > ${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)}`
);

// Raw SQL with parameters
const users = await kysely.executeQuery(
  sql`SELECT * FROM users WHERE name LIKE ${'%' + searchTerm + '%'}`
);
```

### Conditional Queries

```typescript
// Build queries conditionally
function buildUserQuery(filters: { name?: string; email?: string; active?: boolean }) {
  let query = kysely.selectFrom('users').selectAll();

  if (filters.name) {
    query = query.where('name', 'like', `%${filters.name}%`);
  }

  if (filters.email) {
    query = query.where('email', 'like', `%${filters.email}%`);
  }

  if (filters.active !== undefined) {
    query = query.where('active', '=', filters.active);
  }

  return query;
}

// Usage
const users = await buildUserQuery({ name: 'John', active: true }).execute();
```

### Query Building with Functions

```typescript
// Reusable query builders
function createUserQuery() {
  return kysely.selectFrom('users').selectAll();
}

function withActiveUsers(query: any) {
  return query.where('active', '=', true);
}

function withRecentUsers(query: any, days: number = 30) {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return query.where('created_at', '>=', cutoffDate.toISOString());
}

// Usage
const activeRecentUsers = await withRecentUsers(
  withActiveUsers(createUserQuery()),
  7
).execute();
```

## Performance Optimization

### Query Optimization

```typescript
// Use selectAll() sparingly
const users = await kysely
  .selectFrom('users')
  .select(['id', 'name', 'email']) // Only select needed columns
  .execute();

// Use limit for large datasets
const recentUsers = await kysely
  .selectFrom('users')
  .selectAll()
  .orderBy('created_at', 'desc')
  .limit(100)
  .execute();

// Use indexes effectively
const userByEmail = await kysely
  .selectFrom('users')
  .selectAll()
  .where('email', '=', 'john@example.com') // Ensure email column is indexed
  .execute();
```

### Batch Operations

```typescript
// Batch insert
const users = [
  { id: crypto.randomUUID(), name: 'User 1', email: 'user1@example.com' },
  { id: crypto.randomUUID(), name: 'User 2', email: 'user2@example.com' },
  { id: crypto.randomUUID(), name: 'User 3', email: 'user3@example.com' },
];

await kysely
  .insertInto('users')
  .values(users)
  .execute();

// Batch update
await kysely
  .updateTable('users')
  .set({ updated_at: new Date().toISOString() })
  .where('id', 'in', ['user1', 'user2', 'user3'])
  .execute();
```

## Best Practices

### 1. Use Type Safety

```typescript
// Define interfaces for your data
interface User {
  id: string;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// Use with Kysely
const users: User[] = await kysely
  .selectFrom('users')
  .selectAll()
  .execute();
```

### 2. Handle Errors Gracefully

```typescript
try {
  const user = await kysely
    .selectFrom('users')
    .selectAll()
    .where('id', '=', userId)
    .executeTakeFirst();

  if (!user) {
    throw new Error('User not found');
  }

  return user;
} catch (error) {
  console.error('Error fetching user:', error);
  throw error;
}
```

### 3. Use Transactions for Complex Operations

```typescript
// Always use transactions for operations that modify multiple tables
await kysely.transaction().execute(async (trx) => {
  // Multiple related operations
  await trx.insertInto('users').values(userData).execute();
  await trx.insertInto('user_roles').values(roleData).execute();
  await trx.insertInto('user_preferences').values(preferencesData).execute();
});
```

### 4. Optimize Queries

```typescript
// Use appropriate indexes
// Create indexes for frequently queried columns
await kysely.executeQuery(
  sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`
);

// Use limit for large datasets
const users = await kysely
  .selectFrom('users')
  .selectAll()
  .limit(1000)
  .execute();
```

## Next Steps

- [Production Features](./04-production-features.md) - Health checks, monitoring, optimization
- [Real-World Examples](./05-real-world-examples.md) - Authentication, RBAC, caching examples
- [Configuration Reference](./06-configuration-reference.md) - Complete configuration options
- [API Reference](./07-api-reference.md) - Full API documentation
