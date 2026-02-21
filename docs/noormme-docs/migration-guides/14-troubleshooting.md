# 14 - Troubleshooting Migration Issues

This guide covers common issues encountered during PostgreSQL to SQLite migration with Noormme and their solutions.

## Overview

Based on our real-world migration experience, this guide addresses:
- TypeScript compilation errors
- Database connection issues
- Performance problems
- Data integrity issues
- Authentication system problems

## Common Issues and Solutions

### 1. TypeScript Compilation Errors

#### Issue: Connection Configuration Type Errors
**Error:**
```
Type '{ database: string; }' is missing the following properties from type 'ConnectionConfig': host, port, username, password
```

**Solution:**
```typescript
// Use type assertion for SQLite configuration
const db = new NOORMME({
  dialect: 'sqlite',
  connection: {
    database: './data/dreambeesart.db'
  }
}) as unknown as NOORMME.Config;
```

#### Issue: Repository Method Type Errors
**Error:**
```
Property 'findAll' does not exist on type 'Repository'
```

**Solution:**
```typescript
// Use proper method names and parameters
const userRepo = db.getRepository('users');
const users = await userRepo.findAll(); // Remove unsupported parameters
```

#### Issue: Kysely Query Type Errors
**Error:**
```
Expected 1 arguments, but got 2.
```

**Solution:**
```typescript
// Use array syntax for multiple selections
.select(['sessions.session_token', 'sessions.expires'])
// Instead of
.select('sessions.session_token', 'sessions.expires')
```

### 2. Database Connection Issues

#### Issue: Database File Not Created
**Error:**
```
ENOENT: no such file or directory, open './data/dreambeesart.db'
```

**Solution:**
```bash
# Create data directory
mkdir -p data

# Ensure proper permissions
chmod 755 data
```

#### Issue: Database Locked
**Error:**
```
SQLITE_BUSY: database is locked
```

**Solution:**
```typescript
// Add connection timeout and retry logic
const db = new NOORMME({
  dialect: 'sqlite',
  connection: {
    database: './data/dreambeesart.db'
  },
  optimization: {
    synchronous: 'NORMAL', // Less strict locking
    timeout: 30000,        // 30 second timeout
    retry: true            // Enable retry logic
  }
});
```

#### Issue: Foreign Key Constraint Errors
**Error:**
```
FOREIGN KEY constraint failed
```

**Solution:**
```typescript
// Ensure proper migration order
const MIGRATION_ORDER = [
  'roles',           // No dependencies
  'permissions',     // No dependencies
  'users',           // No dependencies
  'user_roles',      // Depends on users and roles
  'accounts',        // Depends on users
  // ... other tables
];
```

### 3. Authentication System Issues

#### Issue: NextAuth Adapter Type Errors
**Error:**
```
Type '(user: any) => Promise<AdapterUser>' is not assignable to type 'Adapter'
```

**Solution:**
```typescript
import type { Adapter, AdapterUser, AdapterAccount, AdapterSession, VerificationToken } from 'next-auth/adapters';

export function NoormmeAdapter(): Adapter {
  return {
    async createUser(user: Omit<AdapterUser, 'id'>) {
      // Implementation with proper types
    },
    // ... other methods with correct signatures
  };
}
```

#### Issue: Session Token Not Found
**Error:**
```
Session token not found in database
```

**Solution:**
```typescript
// Ensure proper session cleanup
async deleteUser(userId: string) {
  const kysely = db.getKysely();
  
  // Delete sessions first
  await kysely.deleteFrom('sessions').where('user_id', '=', userId).execute();
  
  // Then delete user
  await kysely.deleteFrom('users').where('id', '=', userId).execute();
}
```

#### Issue: Email Verification Issues
**Error:**
```
Invalid email verification token
```

**Solution:**
```typescript
// Proper date handling for verification tokens
async createVerificationToken(token: VerificationToken) {
  const tokenData = {
    identifier: token.identifier,
    token: token.token,
    expires: token.expires.toISOString(), // Convert to ISO string
  };
  
  await kysely.insertInto('verification_tokens').values(tokenData).execute();
  return token;
}
```

### 4. Performance Issues

#### Issue: Slow Query Performance
**Problem:** Queries are significantly slower than PostgreSQL

**Solution:**
```typescript
// Enable WAL mode and optimize cache
const db = new NOORMME({
  dialect: 'sqlite',
  connection: { database: './data/dreambeesart.db' },
  optimization: {
    enableWALMode: true,        // Better concurrency
    cacheSize: -64000,          // 64MB cache
    synchronous: 'NORMAL',      // Balance safety/speed
    tempStore: 'MEMORY',        // Use memory for temp
    enableForeignKeys: true     // Enable FK constraints
  }
});

// Create proper indexes
await kysely.executeQuery({
  sql: 'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
  parameters: []
});
```

#### Issue: Memory Usage High
**Problem:** Application uses too much memory

**Solution:**
```typescript
// Use streaming for large datasets
async function getUsersStream() {
  const kysely = db.getKysely();
  const batchSize = 100;
  let offset = 0;
  
  while (true) {
    const batch = await kysely
      .selectFrom('users')
      .selectAll()
      .limit(batchSize)
      .offset(offset)
      .execute();
    
    if (batch.length === 0) break;
    
    // Process batch
    for (const user of batch) {
      // Process user
    }
    
    offset += batchSize;
  }
}
```

### 5. Data Integrity Issues

#### Issue: Duplicate Data
**Problem:** Data appears duplicated after migration

**Solution:**
```typescript
// Use INSERT OR REPLACE for migration
const insertSQL = `
  INSERT OR REPLACE INTO ${tableName} 
  (${columns.join(', ')}) 
  VALUES ${placeholders}
`;
```

#### Issue: Missing Foreign Key Relationships
**Problem:** Orphaned records after migration

**Solution:**
```typescript
// Validate foreign keys after migration
async function validateForeignKeys() {
  const kysely = db.getKysely();
  
  // Check for orphaned user_roles
  const orphanedUserRoles = await kysely
    .selectFrom('user_roles')
    .leftJoin('users', 'users.id', 'user_roles.user_id')
    .where('users.id', 'is', null)
    .execute();
  
  if (orphanedUserRoles.length > 0) {
    console.warn(`Found ${orphanedUserRoles.length} orphaned user_roles`);
    // Clean up orphaned records
    await kysely
      .deleteFrom('user_roles')
      .where('user_id', 'in', orphanedUserRoles.map(r => r.user_id))
      .execute();
  }
}
```

### 6. Caching Issues

#### Issue: Cache Not Working
**Problem:** Cached data not being retrieved

**Solution:**
```typescript
// Ensure proper cache key generation
export class CacheUtils {
  static userKey(userId: string, suffix: string): string {
    return `user:${userId}:${suffix}`;
  }
  
  static paginatedKey(baseKey: string, page: number, limit: number): string {
    return `${baseKey}:page:${page}:limit:${limit}`;
  }
}

// Use consistent cache patterns
const cacheKey = CacheUtils.userKey(userId, 'profile');
const cached = await dbCache.get<Record<string, unknown>>('user-sessions', cacheKey);
```

#### Issue: Stale Cache Data
**Problem:** Cache contains outdated information

**Solution:**
```typescript
// Implement cache invalidation
async function updateUser(userId: string, updates: Partial<User>) {
  const kysely = getKysely();
  
  // Update database
  await kysely
    .updateTable('users')
    .set(updates)
    .where('id', '=', userId)
    .execute();
  
  // Invalidate cache
  const cacheKey = CacheUtils.userKey(userId, 'profile');
  await dbCache.delete('user-sessions', cacheKey);
  
  // Clear related caches
  await dbCache.deletePattern('user-sessions', `user:${userId}:*`);
}
```

### 7. Build and Deployment Issues

#### Issue: Build Fails Due to Migration Scripts
**Error:**
```
Module not found: Can't resolve 'scripts/migrate-to-sqlite.ts'
```

**Solution:**
```json
// tsconfig.json
{
  "compilerOptions": {
    // ... your options
  },
  "exclude": ["node_modules", "scripts"]
}
```

#### Issue: Database File Not Found in Production
**Problem:** SQLite file not found in deployed application

**Solution:**
```typescript
// Ensure database directory exists
import fs from 'fs';
import path from 'path';

const dbDir = path.dirname('./data/dreambeesart.db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
```

### 8. Monitoring and Debugging

#### Issue: No Visibility into Database Performance
**Problem:** Can't monitor database health

**Solution:**
```typescript
// Implement comprehensive health checks
export async function getDetailedHealth(): Promise<DatabaseHealth> {
  const start = Date.now();
  const kysely = getKysely();
  
  try {
    // Test basic connectivity
    await kysely.selectFrom('users').select(kysely.fn.count('*')).execute();
    
    // Test complex queries
    const userWithRoles = await kysely
      .selectFrom('users')
      .leftJoin('user_roles', 'user_roles.user_id', 'users.id')
      .leftJoin('roles', 'roles.id', 'user_roles.role_id')
      .selectAll('users')
      .limit(1)
      .execute();
    
    return {
      status: 'healthy',
      responseTime: Date.now() - start,
      timestamp: new Date().toISOString(),
      details: {
        connection: getConnectionStats(),
        lastQueryTime: Date.now() - start,
        activeConnections: 1
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - start,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

## Debugging Tools

### 1. Database Inspector
```typescript
// Create a database inspection utility
export async function inspectDatabase() {
  const kysely = getKysely();
  
  // Get table information
  const tables = await kysely.executeQuery({
    sql: "SELECT name FROM sqlite_master WHERE type='table'",
    parameters: []
  });
  
  // Get index information
  const indexes = await kysely.executeQuery({
    sql: "SELECT name, tbl_name FROM sqlite_master WHERE type='index'",
    parameters: []
  });
  
  // Get database size
  const stats = await kysely.executeQuery({
    sql: "SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()",
    parameters: []
  });
  
  return {
    tables: tables.rows,
    indexes: indexes.rows,
    size: stats.rows[0]?.size || 0
  };
}
```

### 2. Query Performance Monitor
```typescript
// Monitor slow queries
export function createQueryMonitor() {
  const slowQueries: Array<{ sql: string; duration: number; timestamp: Date }> = [];
  
  return {
    logQuery: (sql: string, duration: number) => {
      if (duration > 1000) { // Log queries > 1 second
        slowQueries.push({ sql, duration, timestamp: new Date() });
        console.warn(`Slow query detected: ${duration}ms - ${sql}`);
      }
    },
    
    getSlowQueries: () => slowQueries,
    
    clearLogs: () => slowQueries.length = 0
  };
}
```

### 3. Migration Validation
```typescript
// Validate migration integrity
export async function validateMigrationIntegrity() {
  const kysely = getKysely();
  const issues: string[] = [];
  
  // Check for duplicate emails
  const duplicateEmails = await kysely
    .selectFrom('users')
    .select('email')
    .groupBy('email')
    .having(kysely.fn.count('id'), '>', 1)
    .execute();
  
  if (duplicateEmails.length > 0) {
    issues.push(`Duplicate emails found: ${duplicateEmails.map(u => u.email).join(', ')}`);
  }
  
  // Check for orphaned records
  const orphanedSessions = await kysely
    .selectFrom('sessions')
    .leftJoin('users', 'users.id', 'sessions.user_id')
    .where('users.id', 'is', null)
    .execute();
  
  if (orphanedSessions.length > 0) {
    issues.push(`Found ${orphanedSessions.length} orphaned sessions`);
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}
```

## Prevention Strategies

### 1. Comprehensive Testing
```typescript
// Create migration test suite
describe('Migration Tests', () => {
  test('should migrate all tables', async () => {
    const migratedTables = await getMigratedTables();
    const expectedTables = ['users', 'roles', 'permissions', 'sessions'];
    
    expectedTables.forEach(table => {
      expect(migratedTables).toContain(table);
    });
  });
  
  test('should maintain data integrity', async () => {
    const integrity = await validateMigrationIntegrity();
    expect(integrity.valid).toBe(true);
  });
  
  test('should handle authentication', async () => {
    const adapter = NoormmeAdapter();
    const user = await adapter.createUser({
      name: 'Test User',
      email: 'test@example.com'
    });
    
    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');
  });
});
```

### 2. Monitoring and Alerting
```typescript
// Set up monitoring
export function setupDatabaseMonitoring() {
  setInterval(async () => {
    const health = await getDetailedHealth();
    
    if (health.status !== 'healthy') {
      // Send alert
      console.error('Database health check failed:', health);
      
      // Log to monitoring service
      // await logToMonitoringService(health);
    }
  }, 60000); // Check every minute
}
```

## Getting Help

If you encounter issues not covered in this guide:

1. **Check the logs** - Look for specific error messages
2. **Validate your schema** - Ensure SQLite schema matches your needs
3. **Test incrementally** - Migrate one component at a time
4. **Use debugging tools** - Implement the debugging utilities above
5. **Check Noormme documentation** - Refer to the main Noormme docs
6. **Create minimal reproduction** - Isolate the issue in a simple test case

## Recovery Procedures

### Complete Rollback
```bash
# Stop application
# Restore from backup
npm run migrate:rollback

# Restart application
npm start
```

### Partial Recovery
```typescript
// Recover specific tables
async function recoverTable(tableName: string) {
  // Re-migrate specific table
  await migrateTableData(tableName);
  
  // Validate recovery
  const validation = await validateTable(tableName);
  console.log(`Recovery result for ${tableName}:`, validation);
}
```

Remember: Always test migration procedures in a development environment before applying to production!
