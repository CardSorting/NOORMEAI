# 03 - Repository Pattern Migration

This guide covers migrating direct database calls to Noormme's repository pattern for cleaner, more maintainable code.

## Overview

We'll migrate from direct database queries to Noormme's repository pattern:
- Replace direct Kysely calls with repository methods
- Implement custom finder methods
- Maintain type safety throughout
- Optimize performance with repository caching

## Step 1: Understanding Repository Pattern Benefits

**Before (Direct Database Calls):**
```typescript
// Scattered throughout codebase
const users = await db.selectFrom('users').where('active', '=', true).execute();
const user = await db.selectFrom('users').where('id', '=', userId).executeTakeFirst();
await db.insertInto('users').values(userData).execute();
```

**After (Repository Pattern):**
```typescript
// Centralized, reusable, type-safe
const userRepo = db.getRepository('users');
const users = await userRepo.findMany({ active: true });
const user = await userRepo.findById(userId);
await userRepo.create(userData);
```

## Step 2: Migrating User Operations

### Before Migration
```typescript
// src/lib/user-service.ts
import { db } from './db';

export class UserService {
  static async getUserById(id: string) {
    return await db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
  }

  static async getUserByEmail(email: string) {
    return await db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirst();
  }

  static async createUser(userData: NewUser) {
    return await db
      .insertInto('users')
      .values(userData)
      .returningAll()
      .executeTakeFirst();
  }

  static async updateUser(id: string, updates: Partial<NewUser>) {
    return await db
      .updateTable('users')
      .set(updates)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
  }

  static async deleteUser(id: string) {
    await db
      .deleteFrom('users')
      .where('id', '=', id)
      .execute();
  }

  static async getActiveUsers() {
    return await db
      .selectFrom('users')
      .selectAll()
      .where('active', '=', true)
      .execute();
  }
}
```

### After Migration
```typescript
// src/lib/user-service.ts
import { getRepository } from './db';

export class UserService {
  static async getUserById(id: string) {
    const userRepo = getRepository('users');
    return await userRepo.findById(id) as Record<string, unknown> | null;
  }

  static async getUserByEmail(email: string) {
    const userRepo = getRepository('users');
    const users = await userRepo.findManyByEmail(email) as Record<string, unknown>[] | null;
    return users?.[0] || null;
  }

  static async createUser(userData: Record<string, unknown>) {
    const userRepo = getRepository('users');
    return await userRepo.create(userData) as Record<string, unknown>;
  }

  static async updateUser(id: string, updates: Record<string, unknown>) {
    const userRepo = getRepository('users');
    return await userRepo.update({ id, ...updates }) as Record<string, unknown>;
  }

  static async deleteUser(id: string) {
    const userRepo = getRepository('users');
    await userRepo.delete(id);
  }

  static async getActiveUsers() {
    const userRepo = getRepository('users');
    return await userRepo.findMany({ active: true }) as Record<string, unknown>[];
  }
}
```

## Step 3: Migrating Complex Queries

For queries that don't fit the repository pattern, use Kysely integration:

### Before Migration
```typescript
// src/lib/role-service.ts
export class RoleService {
  static async getUserRoles(userId: string) {
    return await db
      .selectFrom('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .select(['roles.id', 'roles.name', 'roles.description'])
      .where('user_roles.user_id', '=', userId)
      .execute();
  }

  static async getUsersWithRoles() {
    return await db
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
  }
}
```

### After Migration
```typescript
// src/lib/role-service.ts
import { getRepository, getKysely } from './db';

export class RoleService {
  static async getUserRoles(userId: string) {
    const kysely = getKysely();
    return await kysely
      .selectFrom('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .select(['roles.id', 'roles.name', 'roles.description'])
      .where('user_roles.user_id', '=', userId)
      .execute();
  }

  static async getUsersWithRoles() {
    const kysely = getKysely();
    return await kysely
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
  }

  // Simple role operations use repository
  static async getRoleById(id: string) {
    const roleRepo = getRepository('roles');
    return await roleRepo.findById(id) as Record<string, unknown> | null;
  }

  static async createRole(roleData: Record<string, unknown>) {
    const roleRepo = getRepository('roles');
    return await roleRepo.create(roleData) as Record<string, unknown>;
  }
}
```

## Step 4: Migrating Cached Database Service

Update your cached database service to use repositories:

### Before Migration
```typescript
// src/lib/cached-db.ts
import { db } from './db';

export class CachedDatabaseService {
  static async getUserById(userId: string): Promise<User | null> {
    const cacheKey = `user:${userId}:profile`;
    const cached = await dbCache.get<User>('user-sessions', cacheKey);
    
    if (cached) return cached;

    const user = await db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', userId)
      .executeTakeFirst();
    
    if (user) {
      await dbCache.set('user-sessions', cacheKey, user);
    }
    
    return user || null;
  }
}
```

### After Migration
```typescript
// src/lib/cached-db.ts
import { getRepository } from './db';
import { dbCache, CacheUtils } from './db-cache';

export class CachedDatabaseService {
  static async getUserById(userId: string): Promise<Record<string, unknown> | null> {
    const cacheKey = CacheUtils.userKey(userId, 'profile');
    const cached = await dbCache.get<Record<string, unknown>>('user-sessions', cacheKey);
    
    if (cached) return cached;

    const userRepo = getRepository('users');
    const user = await userRepo.findById(userId);
    
    if (user) {
      await dbCache.set('user-sessions', cacheKey, user);
    }
    
    return user as Record<string, unknown> | null;
  }

  static async getUserByEmail(email: string): Promise<Record<string, unknown> | null> {
    const cacheKey = CacheUtils.userKey(email, 'email');
    const cached = await dbCache.get<Record<string, unknown>>('user-sessions', cacheKey);
    
    if (cached) return cached;

    const userRepo = getRepository('users');
    const users = await userRepo.findManyByEmail(email);
    const user = users?.[0];
    
    if (user) {
      await dbCache.set('user-sessions', cacheKey, user);
    }
    
    return user as Record<string, unknown> | null;
  }
}
```

## Step 5: Creating Custom Repository Extensions

For complex business logic, extend the repository pattern:

```typescript
// src/lib/extended-user-repository.ts
import { getRepository, getKysely } from './db';

export class ExtendedUserRepository {
  private userRepo = getRepository('users');
  private kysely = getKysely();

  async findActiveUsersWithRoles() {
    return await this.kysely
      .selectFrom('users')
      .leftJoin('user_roles', 'user_roles.user_id', 'users.id')
      .leftJoin('roles', 'roles.id', 'user_roles.role_id')
      .select([
        'users.id',
        'users.name',
        'users.email',
        'roles.name as role_name'
      ])
      .where('users.active', '=', true)
      .execute();
  }

  async findUsersByRole(roleName: string) {
    return await this.kysely
      .selectFrom('users')
      .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .selectAll('users')
      .where('roles.name', '=', roleName)
      .execute();
  }

  async getUserStats() {
    return await this.kysely
      .selectFrom('users')
      .select([
        this.kysely.fn.count('id').as('total_users'),
        this.kysely.fn.count('id').filterWhere('active', '=', true).as('active_users')
      ])
      .executeTakeFirst();
  }

  // Simple operations use repository
  async createUser(userData: Record<string, unknown>) {
    return await this.userRepo.create(userData);
  }

  async updateUser(id: string, updates: Record<string, unknown>) {
    return await this.userRepo.update({ id, ...updates });
  }
}
```

## Step 6: Migrating API Routes

Update API routes to use the repository pattern:

### Before Migration
```typescript
// src/app/api/users/route.ts
import { db } from '@/lib/db';

export async function GET() {
  try {
    const users = await db
      .selectFrom('users')
      .selectAll()
      .execute();
    
    return Response.json({ users });
  } catch (error) {
    return Response.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userData = await request.json();
    
    const user = await db
      .insertInto('users')
      .values(userData)
      .returningAll()
      .executeTakeFirst();
    
    return Response.json({ user }, { status: 201 });
  } catch (error) {
    return Response.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
```

### After Migration
```typescript
// src/app/api/users/route.ts
import { getRepository } from '@/lib/db';

export async function GET() {
  try {
    const userRepo = getRepository('users');
    const users = await userRepo.findAll();
    
    return Response.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return Response.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userData = await request.json();
    
    const userRepo = getRepository('users');
    const user = await userRepo.create(userData);
    
    return Response.json({ user }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return Response.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
```

## Step 7: Testing Repository Migration

Create tests to verify the migration:

```typescript
// src/lib/__tests__/repository-migration.test.ts
import { getRepository, initializeDatabase } from '../db';

describe('Repository Migration', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  describe('User Repository', () => {
    test('should create and find user', async () => {
      const userRepo = getRepository('users');
      
      const userData = {
        id: 'test-user-1',
        name: 'Test User',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const createdUser = await userRepo.create(userData);
      expect(createdUser).toBeDefined();

      const foundUser = await userRepo.findById('test-user-1');
      expect(foundUser?.email).toBe('test@example.com');

      // Cleanup
      await userRepo.delete('test-user-1');
    });

    test('should update user', async () => {
      const userRepo = getRepository('users');
      
      // Create user
      const userData = {
        id: 'test-user-2',
        name: 'Test User',
        email: 'test2@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      await userRepo.create(userData);

      // Update user
      const updatedUser = await userRepo.update({ 
        id: 'test-user-2', 
        name: 'Updated User' 
      });
      
      expect(updatedUser?.name).toBe('Updated User');

      // Cleanup
      await userRepo.delete('test-user-2');
    });
  });

  describe('Role Repository', () => {
    test('should create and find role', async () => {
      const roleRepo = getRepository('roles');
      
      const roleData = {
        id: 'test-role-1',
        name: 'test-role',
        description: 'Test role',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const createdRole = await roleRepo.create(roleData);
      expect(createdRole).toBeDefined();

      const foundRole = await roleRepo.findById('test-role-1');
      expect(foundRole?.name).toBe('test-role');

      // Cleanup
      await roleRepo.delete('test-role-1');
    });
  });
});
```

## Step 8: Performance Considerations

### Batch Operations
```typescript
// Use repository for batch operations when available
export class BatchUserService {
  static async createMultipleUsers(usersData: Record<string, unknown>[]) {
    const userRepo = getRepository('users');
    
    // Repository handles batching internally
    const results = [];
    for (const userData of usersData) {
      const user = await userRepo.create(userData);
      results.push(user);
    }
    
    return results;
  }

  // For complex batch operations, use Kysely
  static async updateUsersBatch(updates: Array<{ id: string; data: Record<string, unknown> }>) {
    const kysely = getKysely();
    
    // Use transaction for batch updates
    return await kysely.transaction().execute(async (trx) => {
      const results = [];
      for (const update of updates) {
        const result = await trx
          .updateTable('users')
          .set(update.data)
          .where('id', '=', update.id)
          .returningAll()
          .executeTakeFirst();
        results.push(result);
      }
      return results;
    });
  }
}
```

### Caching Integration
```typescript
// Integrate repository with caching
export class CachedUserRepository {
  private userRepo = getRepository('users');

  async findByIdWithCache(userId: string) {
    const cacheKey = CacheUtils.userKey(userId, 'profile');
    const cached = await dbCache.get<Record<string, unknown>>('users', cacheKey);
    
    if (cached) return cached;

    const user = await this.userRepo.findById(userId);
    if (user) {
      await dbCache.set('users', cacheKey, user);
    }
    
    return user as Record<string, unknown> | null;
  }

  async updateWithCacheInvalidation(id: string, updates: Record<string, unknown>) {
    const result = await this.userRepo.update({ id, ...updates });
    
    // Invalidate cache
    const cacheKey = CacheUtils.userKey(id, 'profile');
    await dbCache.delete('users', cacheKey);
    
    return result;
  }
}
```

## Common Issues and Solutions

### Type Safety Issues
- **Issue**: Repository returns `unknown` types
- **Solution**: Use type assertions with proper error handling

### Performance Issues
- **Issue**: Repository methods are slower than direct queries
- **Solution**: Use Kysely for complex queries, repository for simple CRUD

### Missing Repository Methods
- **Issue**: Repository doesn't have specific finder methods
- **Solution**: Use Kysely for complex queries, extend repository for common patterns

## Next Steps

Once repository migration is complete, proceed to [04-kysely-migration.md](./04-kysely-migration.md) to migrate complex queries to Noormme's Kysely integration.
