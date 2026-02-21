# 01 - Basic Noormme Setup and Configuration

This guide covers the initial setup of Noormme to replace PostgreSQL in your Next.js application.

## Overview

We'll set up Noormme with production-ready configuration, including:
- SQLite database configuration
- Performance optimization settings
- Automation features
- Type safety configuration

## Step 1: Install Noormme

```bash
npm install noormme
```

## Step 2: Create Noormme Configuration

Create `src/lib/db/noormme.ts`:

```typescript
import { NOORMME } from 'noormme';

// Noormme configuration for SQLite
const db = new NOORMME({
  dialect: 'sqlite',
  connection: {
    host: '',
    port: 0,
    username: '',
    password: '',
    database: './data/dreambeesart.db'
  },
  automation: {
    enableAutoOptimization: true,     // Auto-optimize SQLite settings
    enableIndexRecommendations: true, // Generate index suggestions
    enableQueryAnalysis: true,        // Analyze query patterns
    enableMigrationGeneration: true   // Auto-generate migrations
  },
  performance: {
    maxBatchSize: 1000               // Maximum batch size
  },
  optimization: {
    enableWALMode: true,             // Enable WAL mode for better concurrency
    enableForeignKeys: true,         // Enable foreign key constraints
    cacheSize: -64000,               // 64MB cache size
    synchronous: 'NORMAL',           // Synchronous mode
    tempStore: 'MEMORY'              // Use memory for temp storage
  }
}) as unknown as NOORMME.Config;

// Initialize database
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

// Get connection statistics
export function getConnectionStats() {
  return {
    database: 'SQLite',
    dialect: 'noormme',
    timestamp: new Date().toISOString(),
    status: dbInitialized ? 'connected' : 'disconnected'
  };
}

// Database health check function
export async function healthCheck() {
  try {
    const start = Date.now();
    
    // Test database connection with a simple query
    const usersRepo = db.getRepository('users');
    await usersRepo.findAll();
    
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

// Graceful shutdown
export async function closeDatabase() {
  try {
    // Noormme handles cleanup automatically
    console.log('🔌 Database connections closed');
  } catch (error) {
    console.error('❌ Error closing database connections:', error);
  }
}

// Export the Noormme instance
export { db };

// Export convenience methods for repositories
export const getRepository = (tableName: string) => db.getRepository(tableName);

// Export Kysely instance for complex queries (Noormme provides this)
export const getKysely = () => db.getKysely();

// Export schema info for type generation
export const getSchemaInfo = () => db.getSchemaInfo();

// Export optimization recommendations
export const getOptimizationRecommendations = () => db.getSQLiteOptimizations();
```

## Step 3: Configuration Breakdown

### Connection Configuration
```typescript
connection: {
  host: '',           // Empty for SQLite
  port: 0,            // Not used for SQLite
  username: '',       // Not used for SQLite
  password: '',       // Not used for SQLite
  database: './data/dreambeesart.db'  // SQLite file path
}
```

### Automation Features
```typescript
automation: {
  enableAutoOptimization: true,     // Automatically optimize SQLite settings
  enableIndexRecommendations: true, // Suggest indexes for better performance
  enableQueryAnalysis: true,        // Analyze query patterns
  enableMigrationGeneration: true   // Auto-generate migrations
}
```

### Performance Settings
```typescript
performance: {
  maxBatchSize: 1000  // Maximum batch size for operations
}
```

### SQLite Optimizations
```typescript
optimization: {
  enableWALMode: true,             // Write-Ahead Logging for better concurrency
  enableForeignKeys: true,         // Enable foreign key constraints
  cacheSize: -64000,               // 64MB cache (negative = KB)
  synchronous: 'NORMAL',           // Balance between safety and speed
  tempStore: 'MEMORY'              // Use memory for temporary storage
}
```

## Step 4: Create Database Directory

```bash
mkdir -p data
```

## Step 5: Update Database Index

Update `src/lib/db/index.ts` to export Noormme functions:

```typescript
export { 
  db, 
  initializeDatabase, 
  getConnectionStats, 
  healthCheck,
  closeDatabase,
  getRepository,
  getKysely,
  getSchemaInfo,
  getOptimizationRecommendations
} from './noormme';
```

## Step 6: Initialize Database in Application

In your Next.js application startup (e.g., `src/app/layout.tsx` or middleware):

```typescript
import { initializeDatabase } from '@/lib/db';

// Initialize database on application start
initializeDatabase().catch(console.error);
```

## Type Safety Configuration

The configuration uses type assertion to handle SQLite-specific settings that differ from PostgreSQL connection requirements:

```typescript
}) as unknown as NOORMME.Config;
```

This ensures TypeScript compatibility while allowing SQLite-specific configuration.

## Testing the Setup

Create a simple test to verify the setup:

```typescript
// test-noormme-setup.ts
import { initializeDatabase, healthCheck, getConnectionStats } from './src/lib/db';

async function testSetup() {
  try {
    await initializeDatabase();
    console.log('✅ Database initialized');
    
    const stats = getConnectionStats();
    console.log('📊 Connection stats:', stats);
    
    const health = await healthCheck();
    console.log('🏥 Health check:', health);
    
    console.log('🎉 Noormme setup successful!');
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

testSetup();
```

## Common Issues and Solutions

### TypeScript Errors
- **Issue**: Connection config type errors
- **Solution**: Use type assertion as shown above

### Database File Permissions
- **Issue**: Cannot create database file
- **Solution**: Ensure write permissions in the data directory

### Initialization Errors
- **Issue**: Database fails to initialize
- **Solution**: Check file paths and ensure directory exists

## Next Steps

Once basic setup is complete, proceed to [02-database-layer.md](./02-database-layer.md) to migrate your existing database layer.
