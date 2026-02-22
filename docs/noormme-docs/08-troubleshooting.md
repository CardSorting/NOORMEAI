# Troubleshooting Guide

This guide helps you diagnose and resolve common issues when using Noormme in production applications.

## Apostolic Initialization Errors

### Issue: "NOORMME must be initialized before getting repositories"

**Error:**
```
Error: NOORMME must be initialized before getting repositories. Call await db.initialize() first.
```

**Cause:**
You are trying to call `db.getRepository('table')` or access `db.agent` before calling `await db.initialize()`.

**Solution:**
Ensure you `await db.initialize()` at the very beginning of your application's lifecycle.

```typescript
// Correct pattern
const db = new NOORMME(config);

async function start() {
  await db.initialize(); // Initialize first!
  const userRepo = db.getRepository('users');
}
```

## Common Issues

### Database Connection Issues

#### Issue: SQLite database file not found

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

#### Issue: PostgreSQL connection failed

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
- Ensure PostgreSQL is running.
- Verify host, port, username, and password.
- Check if the database exists (`createdb myapp`).
- If using SSL, ensure your configuration is correct for your provider (e.g., Supabase, Neon).

```typescript
const db = new NOORMME({
  dialect: 'postgresql',
  connection: {
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    ssl: process.env.NODE_ENV === 'production'
  }
});
```

#### Issue: Permission denied (SQLite)

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

#### Issue: Database locked (SQLite)

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

#### Issue: Custom finder methods not working

**Error:**
```
TypeError: userRepo.findManyByEmail is not a function
```

**Solution:**
- Ensure the table has the required column.
- Re-initialize the repository *after* migrations have run.
- Check for typo in the column name (e.g., `user_email` vs `email`).

### Kysely Query Issues

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

**Solution:**
```typescript
// Enable query analysis (Dialect Specific)
const db = new NOORMME({
  dialect: 'sqlite',
  connection: { database: './data/app.db' },
  automation: {
    enableQueryAnalysis: true
  }
});

// For SQLite, get optimization recommendations
if (db.config.dialect === 'sqlite') {
  const optimizations = await db.getSQLiteOptimizations();
  console.log('Recommendations:', optimizations.recommendations);
}

// Create indexes for frequently queried columns
await kysely.executeQuery(
  sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`
);
```

### Configuration Issues

#### Issue: Invalid configuration

**Error:**
```
Error: Invalid configuration: dialect must be "sqlite" or "postgresql"
```

**Solution:**
```typescript
// Validate configuration
function validateConfig(config: any) {
  if (!config.dialect || !['sqlite', 'postgresql'].includes(config.dialect)) {
    throw new Error('dialect must be "sqlite" or "postgresql"');
  }
  
  return config;
}

const validatedConfig = validateConfig(config);
const db = new NOORMME(validatedConfig);
```

## Debugging Techniques

### Enable Debug Logging

```typescript
const db = new NOORMME({
  dialect: 'sqlite',
  connection: { database: './app.db' },
  logging: {
    level: 'debug',
    enabled: true,
    logQueries: true
  }
});
```

### Database Health Monitoring

```typescript
// Monitor database health
async function monitorDatabaseHealth() {
  try {
    const health = await db.healthCheck();
    if (!health.healthy) {
      console.error('Database unhealthy:', health.error);
    }
    return health;
  } catch (error) {
    console.error('Health check crashed:', error.message);
  }
}
```

## Best Practices

1. **Always Handle Errors**: Wrap repository calls in try-catch.
2. **Use Transactions**: For multi-table updates to ensure atomicity.
3. **Environment Isolation**: Use separate databases for `development`, `test`, and `production`.
4. **Monitor Pool Size**: For PostgreSQL, monitor `waitingCount` to detect pool exhaustion.

## Next Steps

- [Real-World Examples](./05-real-world-examples.md) - Authentication, RBAC, caching examples
- [Configuration Reference](./06-configuration-reference.md) - Complete configuration options
- [API Reference](./07-api-reference.md) - Full API documentation
