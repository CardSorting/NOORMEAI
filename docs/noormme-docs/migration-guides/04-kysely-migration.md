# 04 - Kysely Migration

This guide covers migrating complex queries from direct PostgreSQL Kysely usage to Noormme's Kysely integration.

## Overview

We'll migrate complex queries that don't fit the repository pattern:
- Multi-table joins and complex queries
- Aggregations and analytics queries
- Advanced filtering and sorting
- Transaction management
- Prepared statements and performance optimization

## Step 1: Understanding Noormme's Kysely Integration

Noormme provides access to Kysely through `getKysely()`, maintaining full type safety while adding SQLite-specific optimizations.

### Before Migration
```typescript
// Direct PostgreSQL Kysely usage
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool })
});

// Complex query example
const usersWithRoles = await db
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
```

### After Migration
```typescript
// Noormme's Kysely integration
import { getKysely } from './db';

const kysely = getKysely();

// Same complex query with SQLite optimizations
const usersWithRoles = await kysely
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
```

## Step 2: Migrating Complex Join Queries

### Multi-Table Analytics Queries
```typescript
// Before: PostgreSQL-specific query
export class AnalyticsService {
  static async getUserStatistics() {
    return await db
      .selectFrom('users')
      .leftJoin('user_roles', 'user_roles.user_id', 'users.id')
      .leftJoin('roles', 'roles.id', 'user_roles.role_id')
      .leftJoin('generation_history', 'generation_history.user_id', 'users.id')
      .select([
        'roles.name as role_name',
        db.fn.count('users.id').as('user_count'),
        db.fn.count('generation_history.id').as('generation_count'),
        db.fn.avg('generation_history.created_at').as('avg_generation_time')
      ])
      .groupBy('roles.name')
      .execute();
  }
}
```

```typescript
// After: Noormme Kysely integration
import { getKysely } from './db';

export class AnalyticsService {
  static async getUserStatistics() {
    const kysely = getKysely();
    
    return await kysely
      .selectFrom('users')
      .leftJoin('user_roles', 'user_roles.user_id', 'users.id')
      .leftJoin('roles', 'roles.id', 'user_roles.role_id')
      .leftJoin('generation_history', 'generation_history.user_id', 'users.id')
      .select([
        'roles.name as role_name',
        kysely.fn.count('users.id').as('user_count'),
        kysely.fn.count('generation_history.id').as('generation_count'),
        kysely.fn.avg('generation_history.created_at').as('avg_generation_time')
      ])
      .groupBy('roles.name')
      .execute();
  }
}
```

### Complex Filtering and Sorting
```typescript
// Before: PostgreSQL query with complex filtering
export class UserSearchService {
  static async searchUsers(searchParams: {
    query?: string;
    roleId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }) {
    let query = db
      .selectFrom('users')
      .leftJoin('user_roles', 'user_roles.user_id', 'users.id')
      .leftJoin('roles', 'roles.id', 'user_roles.role_id')
      .select([
        'users.id',
        'users.name',
        'users.email',
        'users.created_at',
        'roles.name as role_name'
      ]);

    if (searchParams.query) {
      query = query.where((eb) =>
        eb.or([
          eb('users.name', 'ilike', `%${searchParams.query}%`),
          eb('users.email', 'ilike', `%${searchParams.query}%`)
        ])
      );
    }

    if (searchParams.roleId) {
      query = query.where('user_roles.role_id', '=', searchParams.roleId);
    }

    if (searchParams.dateFrom) {
      query = query.where('users.created_at', '>=', searchParams.dateFrom);
    }

    if (searchParams.dateTo) {
      query = query.where('users.created_at', '<=', searchParams.dateTo);
    }

    if (searchParams.sortBy) {
      const order = searchParams.sortOrder || 'asc';
      query = query.orderBy(searchParams.sortBy as any, order);
    }

    if (searchParams.limit) {
      query = query.limit(searchParams.limit);
    }

    if (searchParams.offset) {
      query = query.offset(searchParams.offset);
    }

    return await query.execute();
  }
}
```

```typescript
// After: SQLite-optimized query
import { getKysely } from './db';

export class UserSearchService {
  static async searchUsers(searchParams: {
    query?: string;
    roleId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }) {
    const kysely = getKysely();
    
    let query = kysely
      .selectFrom('users')
      .leftJoin('user_roles', 'user_roles.user_id', 'users.id')
      .leftJoin('roles', 'roles.id', 'user_roles.role_id')
      .select([
        'users.id',
        'users.name',
        'users.email',
        'users.created_at',
        'roles.name as role_name'
      ]);

    if (searchParams.query) {
      query = query.where((eb) =>
        eb.or([
          eb('users.name', 'like', `%${searchParams.query}%`),
          eb('users.email', 'like', `%${searchParams.query}%`)
        ])
      );
    }

    if (searchParams.roleId) {
      query = query.where('user_roles.role_id', '=', searchParams.roleId);
    }

    if (searchParams.dateFrom) {
      query = query.where('users.created_at', '>=', searchParams.dateFrom.toISOString());
    }

    if (searchParams.dateTo) {
      query = query.where('users.created_at', '<=', searchParams.dateTo.toISOString());
    }

    if (searchParams.sortBy) {
      const order = searchParams.sortOrder || 'asc';
      query = query.orderBy(searchParams.sortBy as any, order);
    }

    if (searchParams.limit) {
      query = query.limit(searchParams.limit);
    }

    if (searchParams.offset) {
      query = query.offset(searchParams.offset);
    }

    return await query.execute();
  }
}
```

## Step 3: Migrating Transaction Management

### Complex Transaction Operations
```typescript
// Before: PostgreSQL transactions
export class UserManagementService {
  static async createUserWithRole(userData: NewUser, roleId: string) {
    return await db.transaction().execute(async (trx) => {
      // Create user
      const user = await trx
        .insertInto('users')
        .values(userData)
        .returningAll()
        .executeTakeFirst();

      if (!user) {
        throw new Error('Failed to create user');
      }

      // Assign role
      await trx
        .insertInto('user_roles')
        .values({
          user_id: user.id,
          role_id: roleId,
          created_at: new Date().toISOString()
        })
        .execute();

      // Create default preferences
      await trx
        .insertInto('user_preferences')
        .values({
          user_id: user.id,
          theme: 'light',
          notifications: true,
          created_at: new Date().toISOString()
        })
        .execute();

      return user;
    });
  }
}
```

```typescript
// After: Noormme transaction management
import { getKysely } from './db';

export class UserManagementService {
  static async createUserWithRole(userData: Record<string, unknown>, roleId: string) {
    const kysely = getKysely();
    
    return await kysely.transaction().execute(async (trx) => {
      // Create user
      const user = await trx
        .insertInto('users')
        .values(userData)
        .returningAll()
        .executeTakeFirst();

      if (!user) {
        throw new Error('Failed to create user');
      }

      // Assign role
      await trx
        .insertInto('user_roles')
        .values({
          user_id: user.id,
          role_id: roleId,
          created_at: new Date().toISOString()
        })
        .execute();

      // Create default preferences
      await trx
        .insertInto('user_preferences')
        .values({
          user_id: user.id,
          theme: 'light',
          notifications: true,
          created_at: new Date().toISOString()
        })
        .execute();

      return user;
    });
  }
}
```

## Step 4: Migrating Prepared Statements

### Performance-Critical Queries
```typescript
// Before: PostgreSQL prepared statements
export class PerformanceOptimizedService {
  private getUserByIdStmt = db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', db.param('userId'))
    .prepare();

  private getUserSessionsStmt = db
    .selectFrom('sessions')
    .selectAll()
    .where('user_id', '=', db.param('userId'))
    .where('expires', '>', db.param('now'))
    .prepare();

  async getUserWithActiveSessions(userId: string) {
    const user = await this.getUserByIdStmt.execute({ userId });
    const sessions = await this.getUserSessionsStmt.execute({ 
      userId, 
      now: new Date().toISOString() 
    });

    return { user, sessions };
  }
}
```

```typescript
// After: Noormme prepared statements
import { getKysely } from './db';

export class PerformanceOptimizedService {
  private kysely = getKysely();
  
  private getUserByIdStmt = this.kysely
    .selectFrom('users')
    .selectAll()
    .where('id', '=', this.kysely.param('userId'))
    .prepare();

  private getUserSessionsStmt = this.kysely
    .selectFrom('sessions')
    .selectAll()
    .where('user_id', '=', this.kysely.param('userId'))
    .where('expires', '>', this.kysely.param('now'))
    .prepare();

  async getUserWithActiveSessions(userId: string) {
    const user = await this.getUserByIdStmt.execute({ userId });
    const sessions = await this.getUserSessionsStmt.execute({ 
      userId, 
      now: new Date().toISOString() 
    });

    return { user, sessions };
  }
}
```

## Step 5: Migrating Aggregation Queries

### Complex Analytics and Reporting
```typescript
// Before: PostgreSQL aggregations
export class ReportingService {
  static async getGenerationStats(dateFrom: Date, dateTo: Date) {
    return await db
      .selectFrom('generation_history')
      .innerJoin('users', 'users.id', 'generation_history.user_id')
      .select([
        'users.id as user_id',
        'users.name as user_name',
        db.fn.count('generation_history.id').as('total_generations'),
        db.fn.sum('generation_history.tokens_used').as('total_tokens'),
        db.fn.avg('generation_history.processing_time').as('avg_processing_time')
      ])
      .where('generation_history.created_at', '>=', dateFrom)
      .where('generation_history.created_at', '<=', dateTo)
      .groupBy(['users.id', 'users.name'])
      .orderBy('total_generations', 'desc')
      .execute();
  }

  static async getDailyGenerationTrends(days: number = 30) {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    return await db
      .selectFrom('generation_history')
      .select([
        db.fn('date', 'generation_history.created_at').as('date'),
        db.fn.count('generation_history.id').as('count'),
        db.fn.sum('generation_history.tokens_used').as('tokens')
      ])
      .where('generation_history.created_at', '>=', dateFrom)
      .groupBy(db.fn('date', 'generation_history.created_at'))
      .orderBy('date', 'asc')
      .execute();
  }
}
```

```typescript
// After: SQLite aggregations
import { getKysely } from './db';

export class ReportingService {
  static async getGenerationStats(dateFrom: Date, dateTo: Date) {
    const kysely = getKysely();
    
    return await kysely
      .selectFrom('generation_history')
      .innerJoin('users', 'users.id', 'generation_history.user_id')
      .select([
        'users.id as user_id',
        'users.name as user_name',
        kysely.fn.count('generation_history.id').as('total_generations'),
        kysely.fn.sum('generation_history.tokens_used').as('total_tokens'),
        kysely.fn.avg('generation_history.processing_time').as('avg_processing_time')
      ])
      .where('generation_history.created_at', '>=', dateFrom.toISOString())
      .where('generation_history.created_at', '<=', dateTo.toISOString())
      .groupBy(['users.id', 'users.name'])
      .orderBy('total_generations', 'desc')
      .execute();
  }

  static async getDailyGenerationTrends(days: number = 30) {
    const kysely = getKysely();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    return await kysely
      .selectFrom('generation_history')
      .select([
        kysely.fn('date', 'generation_history.created_at').as('date'),
        kysely.fn.count('generation_history.id').as('count'),
        kysely.fn.sum('generation_history.tokens_used').as('tokens')
      ])
      .where('generation_history.created_at', '>=', dateFrom.toISOString())
      .groupBy(kysely.fn('date', 'generation_history.created_at'))
      .orderBy('date', 'asc')
      .execute();
  }
}
```

## Step 6: Migrating Subqueries and CTEs

### Complex Subquery Operations
```typescript
// Before: PostgreSQL subqueries
export class AdvancedQueryService {
  static async getUsersWithRecentActivity(days: number = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return await db
      .selectFrom('users')
      .selectAll('users')
      .where('id', 'in', (eb) =>
        eb.selectFrom('generation_history')
          .select('user_id')
          .where('created_at', '>=', cutoffDate)
      )
      .execute();
  }

  static async getTopPerformers(limit: number = 10) {
    return await db
      .with('user_stats', (db) =>
        db.selectFrom('generation_history')
          .select([
            'user_id',
            db.fn.count('id').as('generation_count'),
            db.fn.avg('processing_time').as('avg_time')
          ])
          .groupBy('user_id')
      )
      .selectFrom('users')
      .innerJoin('user_stats', 'user_stats.user_id', 'users.id')
      .select([
        'users.id',
        'users.name',
        'user_stats.generation_count',
        'user_stats.avg_time'
      ])
      .orderBy('user_stats.generation_count', 'desc')
      .limit(limit)
      .execute();
  }
}
```

```typescript
// After: SQLite subqueries
import { getKysely } from './db';

export class AdvancedQueryService {
  static async getUsersWithRecentActivity(days: number = 7) {
    const kysely = getKysely();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return await kysely
      .selectFrom('users')
      .selectAll('users')
      .where('id', 'in', (eb) =>
        eb.selectFrom('generation_history')
          .select('user_id')
          .where('created_at', '>=', cutoffDate.toISOString())
      )
      .execute();
  }

  static async getTopPerformers(limit: number = 10) {
    const kysely = getKysely();
    
    return await kysely
      .with('user_stats', (kysely) =>
        kysely.selectFrom('generation_history')
          .select([
            'user_id',
            kysely.fn.count('id').as('generation_count'),
            kysely.fn.avg('processing_time').as('avg_time')
          ])
          .groupBy('user_id')
      )
      .selectFrom('users')
      .innerJoin('user_stats', 'user_stats.user_id', 'users.id')
      .select([
        'users.id',
        'users.name',
        'user_stats.generation_count',
        'user_stats.avg_time'
      ])
      .orderBy('user_stats.generation_count', 'desc')
      .limit(limit)
      .execute();
  }
}
```

## Step 7: Performance Optimization Patterns

### Query Optimization for SQLite
```typescript
// Optimized query patterns for SQLite
export class OptimizedQueryService {
  private kysely = getKysely();

  // Use LIMIT for pagination
  async getPaginatedResults(page: number, limit: number) {
    const offset = (page - 1) * limit;
    
    return await this.kysely
      .selectFrom('users')
      .selectAll()
      .limit(limit)
      .offset(offset)
      .execute();
  }

  // Use EXISTS instead of IN for better performance
  async getUsersWithRoles() {
    return await this.kysely
      .selectFrom('users')
      .selectAll('users')
      .where((eb) =>
        eb.exists(
          eb.selectFrom('user_roles')
            .select('user_id')
            .whereRef('user_roles.user_id', '=', 'users.id')
        )
      )
      .execute();
  }

  // Batch operations with transactions
  async batchUpdateUsers(updates: Array<{ id: string; data: Record<string, unknown> }>) {
    return await this.kysely.transaction().execute(async (trx) => {
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

  // Use specific column selection
  async getBasicUserInfo(userId: string) {
    return await this.kysely
      .selectFrom('users')
      .select(['id', 'name', 'email', 'image'])
      .where('id', '=', userId)
      .executeTakeFirst();
  }
}
```

## Step 8: Testing Complex Queries

### Query Testing Framework
```typescript
// src/lib/__tests__/kysely-migration.test.ts
import { getKysely, initializeDatabase } from '../db';

describe('Kysely Migration Tests', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  describe('Complex Join Queries', () => {
    test('should execute user statistics query', async () => {
      const kysely = getKysely();
      
      const stats = await kysely
        .selectFrom('users')
        .leftJoin('user_roles', 'user_roles.user_id', 'users.id')
        .leftJoin('roles', 'roles.id', 'user_roles.role_id')
        .select([
          'roles.name as role_name',
          kysely.fn.count('users.id').as('user_count')
        ])
        .groupBy('roles.name')
        .execute();

      expect(Array.isArray(stats)).toBe(true);
    });
  });

  describe('Transaction Management', () => {
    test('should handle transaction rollback', async () => {
      const kysely = getKysely();
      
      await expect(
        kysely.transaction().execute(async (trx) => {
          await trx.insertInto('users').values({
            id: 'test-user',
            name: 'Test User',
            email: 'test@example.com',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

          // Force rollback
          throw new Error('Test rollback');
        })
      ).rejects.toThrow('Test rollback');

      // Verify user was not created
      const user = await kysely
        .selectFrom('users')
        .where('id', '=', 'test-user')
        .executeTakeFirst();

      expect(user).toBeUndefined();
    });
  });

  describe('Prepared Statements', () => {
    test('should execute prepared statement', async () => {
      const kysely = getKysely();
      
      const stmt = kysely
        .selectFrom('users')
        .selectAll()
        .where('id', '=', kysely.param('userId'))
        .prepare();

      const user = await stmt.execute({ userId: 'test-user-id' });
      expect(user).toBeDefined();
    });
  });
});
```

## Common Issues and Solutions

### Date Handling
- **Issue**: PostgreSQL dates vs SQLite text dates
- **Solution**: Convert dates to ISO strings for storage and comparison

### Case Sensitivity
- **Issue**: PostgreSQL `ILIKE` vs SQLite `LIKE`
- **Solution**: Use `LIKE` with proper case handling or `COLLATE NOCASE`

### String Functions
- **Issue**: Different string function syntax
- **Solution**: Use SQLite-compatible string functions

### Aggregation Functions
- **Issue**: Some PostgreSQL-specific aggregations
- **Solution**: Use standard SQL aggregations or SQLite equivalents

## Performance Tips

1. **Use Indexes**: Ensure proper indexing for WHERE clauses
2. **Limit Results**: Always use LIMIT for large result sets
3. **Select Specific Columns**: Avoid SELECT * for better performance
4. **Use Transactions**: Group related operations in transactions
5. **Prepared Statements**: Use for repeated queries

## Next Steps

Once complex queries are migrated, proceed to [05-type-safety.md](./05-type-safety.md) to fix TypeScript issues and ensure type safety throughout the application.
