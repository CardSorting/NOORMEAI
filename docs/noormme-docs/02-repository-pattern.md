# Repository Pattern with Noormme

The repository pattern in Noormme provides a clean, type-safe interface for database operations. This guide shows how to use repositories effectively in production applications.

## Basic Repository Usage

### Getting a Repository

```typescript
import { db } from './db/noormme';

// Get repository for any table
const userRepo = db.getRepository('users');
const roleRepo = db.getRepository('roles');
```

## 🧬 Agentic Queries with the `objects` Manager

Every repository provides an `objects` manager that supports a Django-style chaining API. This is the sovereign way for agents to perform complex sifting and mutation tasks.

### Chaining Filters

```typescript
// Sifting verified agents
const activeAgents = await db.getRepository('agents').objects
  .filter({ status: 'active', is_verified: true })
  .order_by('-last_active')
  .all();

// Exclusion patterns
const nonSystemRoles = await db.getRepository('roles').objects
  .exclude({ is_system: true })
  .all();
```

### High-Throughput Aggregation

```typescript
const totalUsers = await userRepo.objects.count();
const hasAdmin = await userRepo.objects.filter({ role: 'admin' }).exists();
```

### Chained Mutations

```typescript
// Bulk update via filter
await db.getRepository('tasks').objects
  .filter({ status: 'stale' })
  .update({ status: 'archived' });

// Bulk cleanup
await db.getRepository('telemetry_logs').objects
  .filter({ severity: 'low' })
  .delete();
```

## Standard CRUD Operations

#### Create

```typescript
// Create a new user
const userData = {
  id: crypto.randomUUID(),
  name: 'John Doe',
  email: 'john@example.com',
  created_at: new Date().toISOString(),
};

const createdUser = await userRepo.create(userData);
```

#### Read

```typescript
// Find by ID
const user = await userRepo.findById('123');

// Find all users
const allUsers = await userRepo.findAll();
```

#### Update

```typescript
// Update user data
const updatedUser = await userRepo.update({
  id: '123',
  name: 'Jane Doe'
});
```

#### Delete

```typescript
// Delete user
await userRepo.delete('123');
```

## Custom Finder Methods

Noormme automatically generates custom finder methods based on your table schema. These methods are synthesized at runtime and provide type-safe access to your data:

### Automatic Method Generation

Noormme automatically generates finder methods based on your table columns:

- `findManyBy[ColumnName]()` - Returns array of records
- `findOneBy[ColumnName]()` - Returns single record or null
- `findBy[ColumnName]()` - Alias for findOneBy[ColumnName]()

**Example for a `users` table with columns: `id`, `email`, `name`, `created_at`**
```typescript
const userRepo = db.getRepository('users');

// All these methods are automatically available:
await userRepo.findManyByEmail('john@example.com');
await userRepo.findManyByName('John Doe');
await userRepo.findOneByEmail('john@example.com');
await userRepo.findById('123'); // Special case for primary key
```

## Best Practices

### 1. Prefer `objects` for Complex Logic
While `findAll` and `findById` are simple, the `objects` manager is significantly more powerful for agents needing to sift through large datasets with multiple constraints.

### 2. Handle Schema Evolution
Since repositories are dynamic, always call `await db.initialize()` before accessing them to ensure they reflect the latest **DNA Mutations**.

---

## Next Steps

- [**Agentic Intelligence**](../agentic-intelligence.md) - How repositories power the Curiosity Engine.
- [**Kysely Integration**](./03-kysely-integration.md) - Dropping down to raw, type-safe SQL.
- [**API Reference**](./07-api-reference.md) - Full method reference.
