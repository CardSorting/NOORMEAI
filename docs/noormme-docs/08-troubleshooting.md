# Troubleshooting Guide

This guide helps you diagnose and resolve common issues when using Noormme in production applications.

## Common Issues

### Database Connection Issues

#### Issue: Database file not found

**Error:**
```
Error: SQLITE_CANTOPEN: unable to open database file
```

**Solution:**
```typescript
// Ensure database directory exists
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const dbPath = './data/app.db';
mkdirSync(dirname(dbPath), { recursive: true });

const db = new NOORMME({
  dialect: 'sqlite',
  connection: { database: dbPath }
});
```

#### Issue: Permission denied

**Error:**
```
Error: SQLITE_READONLY: attempt to write a readonly database
```

**Solution:**
```typescript
// Check file permissions
import { access, chmod } from 'fs/promises';

try {
  await access('./data/app.db', fs.constants.W_OK);
} catch (error) {
  // Fix permissions
  await chmod('./data/app.db', 0o664);
}
```

#### Issue: Database locked

**Error:**
```
Error: SQLITE_BUSY: database is locked
```

**Solution:**
```typescript
// Enable WAL mode for better concurrency
const db = new NOORMME({
  dialect: 'sqlite',
  connection: { database: './data/app.db' },
  optimization: {
    enableWALMode: true,
    synchronous: 'NORMAL'
  }
});
```

### Repository Issues

#### Issue: Table not found

**Error:**
```
Error: no such table: users
```

**Solution:**
```typescript
// Check if table exists
const schemaInfo = await db.getSchemaInfo();
const tableExists = schemaInfo.tables.some(table => table.name === 'users');

if (!tableExists) {
  // Create table or run migrations
  await runMigrations();
}
```

#### Issue: Column not found

**Error:**
```
Error: no such column: email
```

**Solution:**
```typescript
// Check table schema
const schemaInfo = await db.getSchemaInfo();
const userTable = schemaInfo.tables.find(table => table.name === 'users');
const emailColumn = userTable?.columns.find(col => col.name === 'email');

if (!emailColumn) {
  // Add column or update schema
  await addColumn('users', 'email', 'TEXT');
}
```

#### Issue: Custom finder methods not working

**Error:**
```
TypeError: userRepo.findManyByEmail is not a function
```

**Solution:**
```typescript
// Ensure table has the required column
const schemaInfo = await db.getSchemaInfo();
const userTable = schemaInfo.tables.find(table => table.name === 'users');
const hasEmailColumn = userTable?.columns.some(col => col.name === 'email');

if (!hasEmailColumn) {
  // Add email column to users table
  await addColumn('users', 'email', 'TEXT');
}

// Reinitialize repository
const userRepo = db.getRepository('users');
```

### Kysely Query Issues

#### Issue: Type safety errors

**Error:**
```
Type 'string' is not assignable to type 'number'
```

**Solution:**
```typescript
// Use proper type assertions
const user = await kysely
  .selectFrom('users')
  .select(['id', 'name', 'email'])
  .where('id', '=', userId as string) // Explicit type assertion
  .executeTakeFirst();
```

#### Issue: Join query errors

**Error:**
```
Error: no such column: users.role_id
```

**Solution:**
```typescript
// Check table relationships
const schemaInfo = await db.getSchemaInfo();
const userTable = schemaInfo.tables.find(table => table.name === 'users');
const hasRoleId = userTable?.columns.some(col => col.name === 'role_id');

if (!hasRoleId) {
  // Add foreign key column
  await addColumn('users', 'role_id', 'TEXT');
  await addForeignKey('users', 'role_id', 'roles', 'id');
}

// Use proper join syntax
const result = await kysely
  .selectFrom('users')
  .innerJoin('roles', 'roles.id', 'users.role_id')
  .selectAll()
  .execute();
```

#### Issue: Transaction errors

**Error:**
```
Error: Transaction failed: constraint failed
```

**Solution:**
```typescript
// Handle transaction errors gracefully
try {
  await kysely.transaction().execute(async (trx) => {
    await trx.insertInto('users').values(userData).execute();
    await trx.insertInto('user_roles').values(roleData).execute();
  });
} catch (error) {
  console.error('Transaction failed:', error);
  // Handle rollback or retry logic
  throw error;
}
```

### Performance Issues

#### Issue: Slow queries

**Symptoms:**
- Queries taking longer than expected
- High CPU usage
- Memory consumption issues

**Solution:**
```typescript
// Enable query analysis
const db = new NOORMME({
  dialect: 'sqlite',
  connection: { database: './data/app.db' },
  automation: {
    enableQueryAnalysis: true
  }
});

// Get optimization recommendations
const optimizations = await db.getSQLiteOptimizations();
console.log('Recommendations:', optimizations.recommendations);

// Create indexes for frequently queried columns
await kysely.executeQuery(
  sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`
);
```

#### Issue: Memory usage

**Symptoms:**
- High memory consumption
- Out of memory errors
- Slow performance

**Solution:**
```typescript
// Optimize cache settings
const db = new NOORMME({
  dialect: 'sqlite',
  connection: { database: './data/app.db' },
  performance: {
    enableCaching: true,
    maxCacheSize: 500 // Reduce cache size
  },
  optimization: {
    cacheSize: -32000, // Reduce SQLite cache
    tempStore: 'MEMORY'
  }
});

// Use pagination for large datasets
const users = await kysely
  .selectFrom('users')
  .selectAll()
  .limit(100)
  .offset(0)
  .execute();
```

#### Issue: Concurrent access problems

**Symptoms:**
- Database locks
- Timeout errors
- Inconsistent data

**Solution:**
```typescript
// Enable WAL mode
const db = new NOORMME({
  dialect: 'sqlite',
  connection: { database: './data/app.db' },
  optimization: {
    enableWALMode: true,
    synchronous: 'NORMAL'
  }
});

// Use proper transaction isolation
await kysely.transaction().execute(async (trx) => {
  // All operations within transaction
  await trx.insertInto('users').values(userData).execute();
  await trx.updateTable('roles').set(roleData).execute();
});
```

### Configuration Issues

#### Issue: Invalid configuration

**Error:**
```
Error: Invalid configuration: dialect must be "sqlite"
```

**Solution:**
```typescript
// Validate configuration
function validateConfig(config: any) {
  if (!config.dialect || config.dialect !== 'sqlite') {
    throw new Error('dialect must be "sqlite"');
  }
  
  if (!config.connection?.database) {
    throw new Error('connection.database is required');
  }
  
  return config;
}

const validatedConfig = validateConfig(config);
const db = new NOORMME(validatedConfig);
```

#### Issue: Environment-specific configuration

**Error:**
```
Error: Database connection failed in production
```

**Solution:**
```typescript
// Environment-specific configuration
const config = {
  dialect: 'sqlite' as const,
  connection: {
    database: process.env.NODE_ENV === 'production' 
      ? '/var/lib/app/database.db'
      : './data/app.db'
  },
  optimization: {
    enableWALMode: process.env.NODE_ENV === 'production',
    synchronous: process.env.NODE_ENV === 'production' ? 'NORMAL' : 'OFF'
  }
};
```

### Migration Issues

#### Issue: Migration failures

**Error:**
```
Error: Migration 001_initial_schema failed
```

**Solution:**
```typescript
// Handle migration errors
async function runMigrations() {
  const migrationsDir = './src/lib/migrations/files';
  const migrationFiles = readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    try {
      console.log(`Applying migration: ${file}`);
      const sqlContent = readFileSync(join(migrationsDir, file), 'utf-8');
      await db.getKysely().executeQuery(sql.raw(sqlContent));
      console.log(`✅ Applied migration: ${file}`);
    } catch (error) {
      console.error(`❌ Migration ${file} failed:`, error);
      // Handle migration failure (rollback, manual intervention, etc.)
      throw error;
    }
  }
}
```

#### Issue: Schema drift

**Error:**
```
Error: Table structure doesn't match expected schema
```

**Solution:**
```typescript
// Verify schema integrity
async function verifySchema() {
  const schemaInfo = await db.getSchemaInfo();
  const expectedTables = ['users', 'roles', 'permissions'];
  
  for (const tableName of expectedTables) {
    const table = schemaInfo.tables.find(t => t.name === tableName);
    if (!table) {
      console.error(`Missing table: ${tableName}`);
      // Create missing table
      await createTable(tableName);
    }
  }
}
```

## Debugging Techniques

### Enable Debug Logging

```typescript
// Enable debug mode
const DEBUG_DB = process.env.DEBUG_DB === 'true';

function debugLog(message: string, data?: any) {
  if (DEBUG_DB) {
    console.log(`[DB DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
}

// Use in database operations
async function getUserById(userId: string) {
  debugLog('Getting user by ID', { userId });
  
  try {
    const user = await userRepo.findById(userId);
    debugLog('User found', { user: user ? 'exists' : 'not found' });
    return user;
  } catch (error) {
    debugLog('Error getting user', { error: error.message });
    throw error;
  }
}
```

### Query Performance Monitoring

```typescript
// Monitor query performance
function withPerformanceMonitoring<T>(
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

### Database Health Monitoring

```typescript
// Monitor database health
async function monitorDatabaseHealth() {
  try {
    const start = Date.now();
    const usersRepo = db.getRepository('users');
    await usersRepo.findAll({ limit: 1 });
    const responseTime = Date.now() - start;
    
    if (responseTime > 5000) {
      console.warn(`Database health check slow: ${responseTime}ms`);
    }
    
    return {
      healthy: true,
      responseTime,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Database health check failed:', error);
    return {
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Run health check periodically
setInterval(monitorDatabaseHealth, 60000); // Every minute
```

## Common Solutions

### Database Initialization

```typescript
// Robust database initialization
async function initializeDatabase() {
  let retries = 3;
  
  while (retries > 0) {
    try {
      await db.initialize();
      console.log('✅ Database initialized successfully');
      return;
    } catch (error) {
      retries--;
      console.error(`❌ Database initialization failed (${retries} retries left):`, error);
      
      if (retries === 0) {
        throw error;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
```

### Error Recovery

```typescript
// Implement error recovery
async function withErrorRecovery<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.error(`Attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        break;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  throw lastError!;
}

// Usage
const user = await withErrorRecovery(() => userRepo.findById(userId));
```

### Connection Pool Management

```typescript
// Manage connection pool
class DatabaseManager {
  private db: NOORMME;
  private isHealthy = true;
  
  constructor(config: NoormmeConfig) {
    this.db = new NOORMME(config);
  }
  
  async initialize() {
    try {
      await this.db.initialize();
      this.isHealthy = true;
    } catch (error) {
      this.isHealthy = false;
      throw error;
    }
  }
  
  async healthCheck() {
    if (!this.isHealthy) {
      return { healthy: false, error: 'Database marked as unhealthy' };
    }
    
    try {
      const start = Date.now();
      const usersRepo = this.db.getRepository('users');
      await usersRepo.findAll({ limit: 1 });
      const responseTime = Date.now() - start;
      
      return {
        healthy: true,
        responseTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.isHealthy = false;
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  getRepository(tableName: string) {
    if (!this.isHealthy) {
      throw new Error('Database is not healthy');
    }
    return this.db.getRepository(tableName);
  }
  
  getKysely() {
    if (!this.isHealthy) {
      throw new Error('Database is not healthy');
    }
    return this.db.getKysely();
  }
}
```

## Best Practices

### 1. Always Handle Errors

```typescript
// Wrap database operations in try-catch
try {
  const user = await userRepo.findById(userId);
  return user;
} catch (error) {
  console.error('Database operation failed:', error);
  throw error;
}
```

### 2. Use Transactions for Complex Operations

```typescript
// Use transactions for operations that modify multiple tables
await kysely.transaction().execute(async (trx) => {
  await trx.insertInto('users').values(userData).execute();
  await trx.insertInto('user_roles').values(roleData).execute();
});
```

### 3. Implement Proper Logging

```typescript
// Log database operations
function logDatabaseOperation(operation: string, data?: any) {
  console.log(`[DB] ${operation}`, data ? JSON.stringify(data) : '');
}

// Usage
logDatabaseOperation('findUserById', { userId });
const user = await userRepo.findById(userId);
logDatabaseOperation('findUserById result', { found: !!user });
```

### 4. Monitor Performance

```typescript
// Monitor query performance
const start = Date.now();
const result = await userRepo.findAll();
const duration = Date.now() - start;

if (duration > 1000) {
  console.warn(`Slow query: ${duration}ms`);
}
```

### 5. Validate Input Data

```typescript
// Validate input before database operations
function validateUserData(data: any) {
  if (!data.email || !data.name) {
    throw new Error('Email and name are required');
  }
  
  if (!isValidEmail(data.email)) {
    throw new Error('Invalid email format');
  }
  
  return data;
}

// Usage
const validatedData = validateUserData(userData);
const user = await userRepo.create(validatedData);
```

## Getting Help

### Enable Debug Mode

```bash
# Set environment variable
export DEBUG_DB=true

# Or in your application
process.env.DEBUG_DB = 'true';
```

### Collect Debug Information

```typescript
// Collect system information for debugging
function collectDebugInfo() {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    memoryUsage: process.memoryUsage(),
    databasePath: './data/app.db',
    timestamp: new Date().toISOString()
  };
}

// Log debug information
console.log('Debug Info:', collectDebugInfo());
```

### Common Debug Commands

```bash
# Check database file
ls -la ./data/app.db

# Check database integrity
sqlite3 ./data/app.db "PRAGMA integrity_check;"

# Check database schema
sqlite3 ./data/app.db ".schema"

# Check database size
du -h ./data/app.db
```

## Next Steps

- [Real-World Examples](./05-real-world-examples.md) - Authentication, RBAC, caching examples
- [Configuration Reference](./06-configuration-reference.md) - Complete configuration options
- [API Reference](./07-api-reference.md) - Full API documentation
