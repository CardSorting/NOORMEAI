# Runtime ORM Features

Noormme is primarily a runtime ORM that provides dynamic database operations without requiring build-time code generation. This document covers the runtime features that make Noormme powerful for production applications.

## Runtime Table Discovery

Noormme automatically discovers your database schema at runtime and provides dynamic access to tables and columns:

```typescript
import { db } from './db/noormme';

// Initialize database (discovers schema automatically)
await db.initialize();

// Get schema information at runtime
const schemaInfo = await db.getSchemaInfo();
console.log('Discovered tables:', schemaInfo.tables.map(t => t.name));

// Access any table dynamically
const userRepo = db.getRepository('users');
const roleRepo = db.getRepository('roles');
const permissionRepo = db.getRepository('permissions');
```

## Dynamic Repository Generation

Repositories are created dynamically based on your actual table schema:

```typescript
// Get repository for any table (created at runtime)
const userRepo = db.getRepository('users');

// All these methods are available based on your actual table columns:
await userRepo.findById('123');
await userRepo.findManyByEmail('john@example.com');
await userRepo.findManyByName('John Doe');
await userRepo.findAll({ limit: 10 });
await userRepo.create(userData);
await userRepo.update('123', updateData);
```

## Runtime Custom Finder Generation

Noormme automatically generates custom finder methods based on your table columns:

```typescript
// For a users table with columns: id, email, name, created_at
const userRepo = db.getRepository('users');

// These methods are automatically available:
await userRepo.findManyByEmail('john@example.com');
await userRepo.findManyByName('John Doe');
await userRepo.findOneByEmail('john@example.com');
await userRepo.findById('123');

// For a roles table with columns: id, name, description
const roleRepo = db.getRepository('roles');

// These methods are automatically available:
await roleRepo.findManyByName('admin');
await roleRepo.findOneByName('admin');
await roleRepo.findById('456');
```

## Dynamic Kysely Integration

Kysely instance is provided with full type safety for your actual schema:

```typescript
import { getKysely } from './db/noormme';

const kysely = getKysely();

// Type-safe queries based on your actual schema
const result = await kysely
  .selectFrom('users')
  .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
  .innerJoin('roles', 'roles.id', 'user_roles.role_id')
  .select(['users.name', 'roles.name as role_name'])
  .where('users.active', '=', true)
  .execute();
```

## Runtime Configuration

Noormme supports runtime configuration for different environments:

```typescript
// Development configuration
const devConfig = {
  dialect: 'sqlite' as const,
  connection: { database: './data/dev.db' },
  automation: {
    enableAutoOptimization: true,
    enableIndexRecommendations: true,
    enableQueryAnalysis: true,
    enableMigrationGeneration: true
  },
  performance: {
    enableCaching: false, // Disable in development
    maxCacheSize: 100
  },
  optimization: {
    enableWALMode: false, // Disable in development
    enableForeignKeys: true,
    cacheSize: -2000,
    synchronous: 'NORMAL' as const,
    tempStore: 'MEMORY' as const
  }
};

// Production configuration
const prodConfig = {
  dialect: 'sqlite' as const,
  connection: { database: './data/production.db' },
  automation: {
    enableAutoOptimization: true,
    enableIndexRecommendations: true,
    enableQueryAnalysis: true,
    enableMigrationGeneration: false // Disable in production
  },
  performance: {
    enableCaching: true, // Enable in production
    maxCacheSize: 1000
  },
  optimization: {
    enableWALMode: true, // Enable in production
    enableForeignKeys: true,
    cacheSize: -64000,
    synchronous: 'NORMAL' as const,
    tempStore: 'MEMORY' as const
  }
};

// Use configuration based on environment
const config = process.env.NODE_ENV === 'production' ? prodConfig : devConfig;
const db = new NOORMME(config);
```

## Runtime Health Monitoring

Health checks and monitoring work at runtime:

```typescript
// Runtime health check
export async function healthCheck() {
  try {
    const start = Date.now();
    
    // Test database connection with a simple query
    const usersRepo = db.getRepository('users');
    await usersRepo.findAll({ limit: 1 });
    
    const responseTime = Date.now() - start;
    
    return {
      healthy: true,
      responseTime,
      timestamp: new Date().toISOString(),
      connectionPool: getConnectionStats()
    };
  } catch (error) {
    console.error('Database health check failed:', error);
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      connectionPool: getConnectionStats()
    };
  }
}

// Runtime connection statistics
export function getConnectionStats() {
  return {
    database: 'SQLite',
    dialect: 'noormme',
    timestamp: new Date().toISOString(),
    status: dbInitialized ? 'connected' : 'disconnected'
  };
}
```

## Runtime Schema Operations

Schema operations work dynamically at runtime:

```typescript
// Get current schema information
const schemaInfo = await db.getSchemaInfo();
console.log(`Found ${schemaInfo.tables.length} tables:`);
schemaInfo.tables.forEach(table => {
  console.log(`  - ${table.name} (${table.columns.length} columns)`);
  table.columns.forEach(column => {
    console.log(`    - ${column.name}: ${column.type} ${column.primaryKey ? '(PK)' : ''}`);
  });
});

// Get optimization recommendations
const optimizations = await db.getSQLiteOptimizations();
console.log('Optimization recommendations:', optimizations.recommendations);
```

## Runtime Error Handling

Runtime error handling with proper type information:

```typescript
// Runtime error handling
try {
  const userRepo = db.getRepository('users');
  const user = await userRepo.findById('123');
  return user;
} catch (error) {
  if (error instanceof DatabaseConnectionError) {
    console.error('Database connection failed:', error.message);
    // Handle connection error
  } else if (error instanceof QueryExecutionError) {
    console.error('Query execution failed:', error.message, error.sql);
    // Handle query error
  } else {
    console.error('Unexpected error:', error);
    // Handle unexpected error
  }
  throw error;
}
```

## Runtime Performance Monitoring

Performance monitoring works at runtime:

```typescript
// Runtime performance monitoring
export function withPerformanceMonitoring<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  
  return operation()
    .then(result => {
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query: ${operationName} took ${duration}ms`);
      }
      return result;
    })
    .catch(error => {
      const duration = Date.now() - start;
      console.error(`Query failed: ${operationName} after ${duration}ms`, error);
      throw error;
    });
}

// Usage
const user = await withPerformanceMonitoring('getUserById', () =>
  userRepo.findById(userId)
);
```

## Runtime Caching

Intelligent caching works at runtime:

```typescript
// Runtime caching example
export class CachedDatabaseService {
  static async getUserById(userId: string): Promise<Record<string, unknown> | null> {
    const cacheKey = `user:${userId}`;
    const cached = await dbCache.get<Record<string, unknown>>('user-sessions', cacheKey);
    
    if (cached) return cached;

    const userRepo = getRepository('users');
    const user = await userRepo.findById(userId);
    
    if (user) {
      await dbCache.set('user-sessions', cacheKey, user);
    }
    
    return user || null;
  }

  static async getUserByEmail(email: string): Promise<Record<string, unknown> | null> {
    const cacheKey = `user:email:${email}`;
    const cached = await dbCache.get<Record<string, unknown>>('user-sessions', cacheKey);
    
    if (cached) return cached;

    const userRepo = getRepository('users');
    const users = await userRepo.findManyByEmail(email);
    const user = users && users.length > 0 ? users[0] : null;
    
    if (user) {
      await dbCache.set('user-sessions', cacheKey, user);
      // Also cache by user ID
      await dbCache.set('user-sessions', `user:${user.id}`, user);
    }
    
    return user || null;
  }
}
```

## Runtime Migration Support

Migration system works at runtime:

```typescript
// Runtime migration runner
export class MigrationRunner {
  async run(): Promise<void> {
    console.log('🚀 Starting database migrations...');
    
    const migrationsDir = './src/lib/migrations/files';
    const migrationFiles = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const migrationId = file.replace('.sql', '');
      
      // Check if migration already applied
      const isApplied = await this.tracker.isMigrationApplied(migrationId);
      if (isApplied) {
        console.log(`⏭️  Skipping ${migrationId} (already applied)`);
        continue;
      }

      console.log(`📝 Applying migration: ${migrationId}`);
      
      try {
        const sqlContent = readFileSync(join(migrationsDir, file), 'utf-8');
        await db.getKysely().executeQuery(sql.raw(sqlContent));
        await this.tracker.markMigrationAsApplied(migrationId);
        console.log(`✅ Applied migration: ${migrationId}`);
      } catch (error) {
        console.error(`❌ Failed to apply migration ${migrationId}:`, error);
        throw error;
      }
    }
    
    console.log('🎉 All migrations completed successfully!');
  }
}
```

## Best Practices for Runtime ORM

### 1. Initialize Once

```typescript
// Initialize database once at application startup
let dbInitialized = false;

export async function initializeDatabase() {
  if (dbInitialized) {
    return; // Already initialized
  }

  try {
    await db.initialize();
    dbInitialized = true;
    console.log('✅ Database initialized successfully with Noormme');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}
```

### 2. Use Repository Pattern for Simple Operations

```typescript
// Use repository pattern for simple CRUD operations
const userRepo = getRepository('users');
const user = await userRepo.findById('123');
const users = await userRepo.findManyByEmail('john@example.com');
```

### 3. Use Kysely for Complex Queries

```typescript
// Use Kysely for complex queries and joins
const kysely = getKysely();
const result = await kysely
  .selectFrom('users')
  .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
  .innerJoin('roles', 'roles.id', 'user_roles.role_id')
  .select(['users.name', 'roles.name as role_name'])
  .where('users.active', '=', true)
  .execute();
```

### 4. Implement Caching for Performance

```typescript
// Implement intelligent caching
const cacheKey = `user:${userId}`;
const cached = await cache.get(cacheKey);
if (cached) return cached;

const user = await userRepo.findById(userId);
await cache.set(cacheKey, user);
return user;
```

### 5. Handle Errors Gracefully

```typescript
// Always handle errors gracefully
try {
  const user = await userRepo.findById(userId);
  return user;
} catch (error) {
  console.error('Database operation failed:', error);
  throw error;
}
```

## Next Steps

- [Repository Pattern](./02-repository-pattern.md) - Learn about CRUD operations and custom finders
- [Kysely Integration](./03-kysely-integration.md) - Complex queries and joins
- [Production Features](./04-production-features.md) - Health checks, monitoring, optimization
- [Real-World Examples](./05-real-world-examples.md) - Authentication, RBAC, caching examples
