# Getting Started with Noormme

This guide shows you how to set up Noormme as a production-ready SQLite ORM, based on the real-world implementation in the DreamBeesArt application.

## Installation

```bash
npm install noormme
```

## Basic Setup

### 1. Database Configuration

Create a database configuration file:

```typescript
// src/lib/db/noormme.ts
import { NOORMME } from 'noormme';

// Noormme configuration for SQLite
const db = new NOORMME({
  dialect: 'sqlite',
  connection: {
    database: './data/dreambeesart.db'
  },
  automation: {
    enableAutoOptimization: true,     // Auto-optimize SQLite settings
    enableIndexRecommendations: true, // Generate index suggestions
    enableQueryAnalysis: true,        // Analyze query patterns
    enableMigrationGeneration: true   // Auto-generate migrations
  },
  performance: {
    enableCaching: true,              // Enable intelligent caching
    enableBatchOperations: true,      // Optimize batch operations
    maxCacheSize: 1000               // Maximum cache entries
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

### 2. Database Initialization

```typescript
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
```

### 3. Export Database Utilities

```typescript
// Export the Noormme instance
export { db };

// Export convenience methods for repositories
export const getRepository = (tableName: string) => db.getRepository(tableName);

// Export Kysely instance for complex queries
export const getKysely = () => db.getKysely();

// Export schema info for type generation
export const getSchemaInfo = () => db.getSchemaInfo();

// Export optimization recommendations
export const getOptimizationRecommendations = () => db.getSQLiteOptimizations();

// Export health check and monitoring
export const healthCheck = async () => {
  try {
    const start = Date.now();
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
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      connectionPool: getConnectionStats()
    };
  }
};

// Export connection statistics
export const getConnectionStats = () => {
  return {
    database: 'SQLite',
    dialect: 'noormme',
    timestamp: new Date().toISOString(),
    status: dbInitialized ? 'connected' : 'disconnected'
  };
};
```

## Configuration Options

### Connection Settings

```typescript
connection: {
  database: './data/dreambeesart.db'  // SQLite database file path
}
```

### Automation Features

```typescript
automation: {
  enableAutoOptimization: true,     // Auto-optimize SQLite settings
  enableIndexRecommendations: true, // Generate index suggestions
  enableQueryAnalysis: true,        // Analyze query patterns
  enableMigrationGeneration: true   // Auto-generate migrations
}
```

### Performance Optimization

```typescript
performance: {
  enableCaching: true,              // Enable intelligent caching
  enableBatchOperations: true,      // Optimize batch operations
  maxCacheSize: 1000               // Maximum cache entries
}
```

### SQLite Optimization

```typescript
optimization: {
  enableWALMode: true,             // Enable WAL mode for better concurrency
  enableForeignKeys: true,         // Enable foreign key constraints
  cacheSize: -64000,               // 64MB cache size
  synchronous: 'NORMAL',           // Synchronous mode
  tempStore: 'MEMORY'              // Use memory for temp storage
}
```

## Basic Usage

### Repository Pattern

```typescript
import { getRepository } from './db/noormme';

// Get a repository for a table
const userRepo = getRepository('users');

// Basic CRUD operations
const user = await userRepo.findById('123');
const users = await userRepo.findAll({ limit: 10 });
const newUser = await userRepo.create(userData);
const updatedUser = await userRepo.update('123', updateData);

// Custom finder methods (automatically generated)
const usersByEmail = await userRepo.findManyByEmail('john@example.com');
const userByEmail = await userRepo.findOneByEmail('john@example.com');
```

### Kysely Integration

```typescript
import { getKysely } from './db/noormme';

const kysely = getKysely();

// Complex queries with full type safety
const result = await kysely
  .selectFrom('users')
  .innerJoin('roles', 'roles.id', 'users.role_id')
  .selectAll()
  .where('users.active', '=', true)
  .execute();
```

## Health Monitoring

### Health Check Function

```typescript
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

## Next Steps

- [Repository Pattern](./02-repository-pattern.md) - Learn about CRUD operations and custom finders
- [Kysely Integration](./03-kysely-integration.md) - Complex queries and joins
- [Production Features](./04-production-features.md) - Health checks, monitoring, optimization
- [Real-World Examples](./05-real-world-examples.md) - Authentication, RBAC, caching examples
