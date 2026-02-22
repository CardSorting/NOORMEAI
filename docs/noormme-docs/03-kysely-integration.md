# Kysely Integration with Noormme

Noormme provides seamless integration with Kysely, a type-safe SQL query builder. This allows you to write complex queries with full type safety and IntelliSense support.

## Getting Kysely Instance

```typescript
import { getKysely } from './db/noormme';

// Get the Kysely instance
const kysely = getKysely();
```

## Dialect Agnostic Querying

Kysely abstracts most SQL differences between SQLite and PostgreSQL, but some dialect-specific behaviors remain. NOORMME configures the correct compiler automatically.

### Dialect Differences

| Feature | SQLite | PostgreSQL |
| :--- | :--- | :--- |
| **Placeholders** | `?` | `$1, $2...` |
| **Returning** | Supported in 3.35+ | Fully supported |
| **JSON** | Stringified JSON | Native JSONB |
| **Boolean** | 0 or 1 | `true` or `false` |

### Example: Returning Data

```typescript
// Works on both (NOORMME ensures compatibility)
const result = await kysely
  .insertInto('users')
  .values(userData)
  .returning(['id', 'email'])
  .executeTakeFirst();
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
```

### Delete Operations

```typescript
// Delete single record
await kysely
  .deleteFrom('users')
  .where('id', '=', '123')
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
```

### Aggregations

```typescript
// Count records
const userCount = await kysely
  .selectFrom('users')
  .select(kysely.fn.count('id').as('count'))
  .executeTakeFirst();
```

## Transactions

### Basic Transaction

```typescript
// Simple transaction
await kysely.transaction().execute(async (trx) => {
  // Insert user
  const user = await trx
    .insertInto('users')
    .values(userData)
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
```

## Next Steps

- [Production Features](./04-production-features.md) - Health checks, monitoring, optimization
- [Real-World Examples](./05-real-world-examples.md) - Authentication, RBAC, caching examples
- [Configuration Reference](./06-configuration-reference.md) - Complete configuration options
- [API Reference](./07-api-reference.md) - Full API documentation
