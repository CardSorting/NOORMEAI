# Production Features

Noormme provides comprehensive production-ready features for monitoring, optimization, and maintaining your SQLite database in production environments.

## Health Monitoring

### Database Health Check

```typescript
// src/lib/db/noormme.ts
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
```

### Connection Statistics

```typescript
export function getConnectionStats() {
  return {
    database: 'SQLite',
    dialect: 'noormme',
    timestamp: new Date().toISOString(),
    status: dbInitialized ? 'connected' : 'disconnected'
  };
}
```

### Health Check API Endpoint

```typescript
// src/app/api/admin/database/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { healthCheck, getConnectionStats } from '@/lib/db';

export async function GET(_request: NextRequest) {
  try {
    const health = await healthCheck();
    const stats = getConnectionStats();
    
    return NextResponse.json({
      status: 'success',
      data: {
        health,
        stats,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    
    return NextResponse.json(
      {
        status: 'error',
        message: 'Database health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
```

## Performance Optimization

### SQLite Optimization Configuration

```typescript
// Noormme configuration with optimization settings
const db = new NOORMME({
  dialect: 'sqlite',
  connection: {
    database: './data/dreambeesart.db'
  },
  optimization: {
    enableWALMode: true,             // Enable WAL mode for better concurrency
    enableForeignKeys: true,         // Enable foreign key constraints
    cacheSize: -64000,               // 64MB cache size
    synchronous: 'NORMAL',           // Synchronous mode
    tempStore: 'MEMORY'              // Use memory for temp storage
  }
});
```

### WAL Mode Benefits

WAL (Write-Ahead Logging) mode provides:
- **Better Concurrency**: Multiple readers can access the database simultaneously
- **Improved Performance**: Faster write operations
- **Crash Recovery**: Better recovery from crashes
- **Reduced Locking**: Fewer database locks

### Cache Configuration

```typescript
performance: {
  enableCaching: true,              // Enable intelligent caching
  enableBatchOperations: true,      // Optimize batch operations
  maxCacheSize: 1000               // Maximum cache entries
}
```

### Index Recommendations

```typescript
// Get optimization recommendations
export const getOptimizationRecommendations = () => db.getSQLiteOptimizations();

// Usage
const optimizations = await getOptimizationRecommendations();
console.log('Optimization recommendations:', optimizations);
```

## Schema Management

### Schema Information

```typescript
// Get schema information
export const getSchemaInfo = () => db.getSchemaInfo();

// Usage
const schemaInfo = await getSchemaInfo();
console.log('Tables:', schemaInfo.tables);
console.log('Columns:', schemaInfo.tables[0].columns);
```

### Schema Discovery

```typescript
// Discover database schema
const schemaInfo = await getSchemaInfo();
console.log(`Discovered ${schemaInfo.tables.length} tables:`);
schemaInfo.tables.forEach(table => {
  console.log(`  - ${table.name} (${table.columns.length} columns)`);
});
```

## Migration System

### Migration Runner

```typescript
// src/lib/migrations/migration-runner.ts
import { db } from '@/lib/db';
import { MigrationTracker } from './migration-tracker';
import { sql } from 'kysely';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export class MigrationRunner {
  private tracker: MigrationTracker;

  constructor() {
    this.tracker = new MigrationTracker();
  }

  async run(): Promise<void> {
    console.log('🚀 Starting database migrations...');
    
    const migrationsDir = join(process.cwd(), 'src/lib/migrations/files');
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

  async status(): Promise<void> {
    const appliedMigrations = await this.tracker.getAppliedMigrations();
    console.log('📊 Migration Status:');
    console.log(`Applied migrations: ${appliedMigrations.length}`);
    appliedMigrations.forEach(migration => {
      console.log(`  ✅ ${migration.migration_id} - ${migration.applied_at}`);
    });
  }

  async verify(): Promise<void> {
    const migrationsDir = join(process.cwd(), 'src/lib/migrations/files');
    const migrationFiles = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    const appliedMigrations = await this.tracker.getAppliedMigrations();
    const appliedIds = appliedMigrations.map(m => m.migration_id);

    console.log('🔍 Migration Verification:');
    console.log(`Total migration files: ${migrationFiles.length}`);
    console.log(`Applied migrations: ${appliedMigrations.length}`);

    const missingMigrations = migrationFiles
      .map(f => f.replace('.sql', ''))
      .filter(id => !appliedIds.includes(id));

    if (missingMigrations.length > 0) {
      console.log('⚠️  Missing migrations:');
      missingMigrations.forEach(id => console.log(`  - ${id}`));
    } else {
      console.log('✅ All migrations are applied');
    }
  }
}
```

### Migration Tracker

```typescript
// src/lib/migrations/migration-tracker.ts
import { db } from '@/lib/db';
import { sql } from 'kysely';
import { randomUUID } from 'crypto';

export class MigrationTracker {
  async initialize(): Promise<void> {
    // Create migrations table if it doesn't exist
    await db.getKysely().executeQuery(
      sql`CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        migration_id TEXT UNIQUE NOT NULL,
        applied_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`
    );
  }

  async isMigrationApplied(migrationId: string): Promise<boolean> {
    const result = await db.getKysely()
      .selectFrom('migrations')
      .select('id')
      .where('migration_id', '=', migrationId)
      .executeTakeFirst();

    return !!result;
  }

  async markMigrationAsApplied(migrationId: string): Promise<void> {
    await db.getKysely()
      .insertInto('migrations')
      .values({
        id: randomUUID(),
        migration_id: migrationId,
        applied_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .execute();
  }

  async getAppliedMigrations(): Promise<Array<{ migration_id: string; applied_at: string }>> {
    return db.getKysely()
      .selectFrom('migrations')
      .select(['migration_id', 'applied_at'])
      .orderBy('applied_at', 'asc')
      .execute();
  }
}
```

### Migration Files

```sql
-- src/lib/migrations/files/001_initial_schema.sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  email_verified TEXT,
  image TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions(name);
```

## Connection Management

### Connection Pooling

```typescript
// Connection pool configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  min: 5,  // Minimum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
  // SSL configuration for production
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Query timeout
  query_timeout: 30000, // 30 seconds
  // Statement timeout
  statement_timeout: 30000, // 30 seconds
  // Application name for monitoring
  application_name: 'dreambeesart-web',
});
```

### Connection Monitoring

```typescript
// Connection pool monitoring
let connectionStats = {
  totalConnections: 0,
  activeConnections: 0,
  idleConnections: 0,
  waitingClients: 0,
};

// Monitor connection pool health
setInterval(() => {
  connectionStats = {
    totalConnections: pool.totalCount,
    activeConnections: pool.totalCount - pool.idleCount,
    idleConnections: pool.idleCount,
    waitingClients: pool.waitingCount,
  };
  
  // Log warnings if pool is under stress
  if (connectionStats.waitingClients > 0) {
    console.warn('⚠️ Database connection pool under stress:', connectionStats);
  }
  
  // Log pool stats every 5 minutes in development
  if (process.env.NODE_ENV === 'development' && Math.random() < 0.1) {
    console.log('📊 Database pool stats:', connectionStats);
  }
}, 300000); // Check every 5 minutes
```

### Graceful Shutdown

```typescript
// Graceful shutdown
export async function closeDatabase() {
  try {
    // Noormme handles cleanup automatically
    console.log('🔌 Database connections closed');
  } catch (error) {
    console.error('❌ Error closing database connections:', error);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});
```

## Monitoring and Logging

### Query Performance Monitoring

```typescript
// Query performance monitoring
export function withMonitoring<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  
  return operation()
    .then(result => {
      const duration = Date.now() - start;
      console.log(`✅ ${operationName} completed in ${duration}ms`);
      return result;
    })
    .catch(error => {
      const duration = Date.now() - start;
      console.error(`❌ ${operationName} failed after ${duration}ms:`, error);
      throw error;
    });
}

// Usage
export async function assignRoleToUser(userId: string, roleName: string): Promise<void> {
  return withMonitoring('assignRoleToUser', async () => {
    const rolesRepo = getRepository('roles');
    const userRolesRepo = getRepository('user_roles');
    
    const roles = await rolesRepo.findManyByName(roleName);
    if (!roles || roles.length === 0) {
      throw new Error(`Role '${roleName}' not found`);
    }
    
    const role = roles[0];
    
    // Check if user already has this role
    const existingUserRoles = await userRolesRepo.findManyByUserId(userId);
    const existingUserRole = existingUserRoles.find(ur => ur.role_id === role.id);
    
    if (!existingUserRole) {
      await userRolesRepo.create({
        id: randomUUID(),
        user_id: userId,
        role_id: role.id,
        created_at: new Date().toISOString(),
      });
    }
  });
}
```

### Error Tracking

```typescript
// Error tracking and logging
export function logError(error: Error, context: Record<string, any> = {}) {
  console.error('Database Error:', {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  });
  
  // Send to error tracking service (e.g., Sentry)
  // Sentry.captureException(error, { extra: context });
}

// Usage in database operations
try {
  const user = await userRepo.findById(userId);
  return user;
} catch (error) {
  logError(error as Error, { userId, operation: 'findById' });
  throw error;
}
```

## Performance Tuning

### SQLite PRAGMA Settings

```typescript
// Optimize SQLite settings
export async function optimizeSQLite() {
  const kysely = db.getKysely();
  
  // Enable WAL mode
  await kysely.executeQuery(sql`PRAGMA journal_mode=WAL`);
  
  // Set cache size
  await kysely.executeQuery(sql`PRAGMA cache_size=-64000`);
  
  // Enable foreign keys
  await kysely.executeQuery(sql`PRAGMA foreign_keys=ON`);
  
  // Set synchronous mode
  await kysely.executeQuery(sql`PRAGMA synchronous=NORMAL`);
  
  // Use memory for temp storage
  await kysely.executeQuery(sql`PRAGMA temp_store=MEMORY`);
  
  console.log('✅ SQLite optimization settings applied');
}
```

### Index Optimization

```typescript
// Create indexes for performance
export async function createIndexes() {
  const kysely = db.getKysely();
  
  // User indexes
  await kysely.executeQuery(sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
  await kysely.executeQuery(sql`CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)`);
  
  // Role indexes
  await kysely.executeQuery(sql`CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name)`);
  
  // Permission indexes
  await kysely.executeQuery(sql`CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions(name)`);
  
  // User role indexes
  await kysely.executeQuery(sql`CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id)`);
  await kysely.executeQuery(sql`CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id)`);
  
  console.log('✅ Database indexes created');
}
```

### Query Optimization

```typescript
// Analyze query performance
export async function analyzeQueryPerformance() {
  const kysely = db.getKysely();
  
  // Get query plan
  const plan = await kysely.executeQuery(
    sql`EXPLAIN QUERY PLAN SELECT * FROM users WHERE email = 'test@example.com'`
  );
  
  console.log('Query Plan:', plan);
  
  // Get table statistics
  const stats = await kysely.executeQuery(
    sql`SELECT name, sql FROM sqlite_master WHERE type='table'`
  );
  
  console.log('Table Statistics:', stats);
}
```

## Backup and Recovery

### Database Backup

```typescript
// Create database backup
export async function createBackup(backupPath: string) {
  const kysely = db.getKysely();
  
  // Create backup using SQLite backup API
  await kysely.executeQuery(sql`VACUUM INTO ${sql.raw(`'${backupPath}'`)}`);
  
  console.log(`✅ Database backup created: ${backupPath}`);
}

// Scheduled backups
export function scheduleBackups() {
  // Create daily backup at 2 AM
  cron.schedule('0 2 * * *', async () => {
    const backupPath = `./backups/dreambeesart-${new Date().toISOString().split('T')[0]}.db`;
    await createBackup(backupPath);
  });
}
```

### Database Recovery

```typescript
// Restore from backup
export async function restoreFromBackup(backupPath: string) {
  try {
    // Close current database
    await closeDatabase();
    
    // Copy backup to main database
    await fs.copyFile(backupPath, './data/dreambeesart.db');
    
    // Reinitialize database
    await initializeDatabase();
    
    console.log(`✅ Database restored from backup: ${backupPath}`);
  } catch (error) {
    console.error('❌ Database restore failed:', error);
    throw error;
  }
}
```

## Best Practices

### 1. Monitor Performance

```typescript
// Always monitor query performance
const start = Date.now();
const result = await userRepo.findAll();
const duration = Date.now() - start;

if (duration > 1000) {
  console.warn(`Slow query detected: ${duration}ms`);
}
```

### 2. Use Connection Pooling

```typescript
// Configure connection pool appropriately
const pool = new Pool({
  max: 20, // Adjust based on your needs
  min: 5,
  idleTimeoutMillis: 30000,
});
```

### 3. Implement Health Checks

```typescript
// Regular health checks
setInterval(async () => {
  const health = await healthCheck();
  if (!health.healthy) {
    console.error('Database health check failed:', health.error);
  }
}, 60000); // Check every minute
```

### 4. Handle Errors Gracefully

```typescript
// Always handle database errors
try {
  const result = await db.operation();
  return result;
} catch (error) {
  logError(error as Error, { operation: 'db.operation' });
  throw error;
}
```

### 5. Use Transactions for Complex Operations

```typescript
// Use transactions for operations that modify multiple tables
await kysely.transaction().execute(async (trx) => {
  await trx.insertInto('users').values(userData).execute();
  await trx.insertInto('user_roles').values(roleData).execute();
});
```

## Next Steps

- [Real-World Examples](./05-real-world-examples.md) - Authentication, RBAC, caching examples
- [Configuration Reference](./06-configuration-reference.md) - Complete configuration options
- [API Reference](./07-api-reference.md) - Full API documentation
- [Troubleshooting](./08-troubleshooting.md) - Common issues and solutions
