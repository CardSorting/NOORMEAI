# Configuration Reference

This document provides a comprehensive reference for all Noormme configuration options, based on the production implementation in the DreamBeesArt application.

## Basic Configuration

### Minimal Configuration

```typescript
import { NOORMME } from 'noormme';

const db = new NOORMME({
  dialect: 'sqlite',
  connection: {
    database: './data/app.db'
  }
});
```

### Complete Configuration

```typescript
import { NOORMME } from 'noormme';

const db = new NOORMME({
  dialect: 'sqlite',
  connection: {
    database: './data/dreambeesart.db'
  },
  automation: {
    enableAutoOptimization: true,
    enableIndexRecommendations: true,
    enableQueryAnalysis: true,
    enableMigrationGeneration: true
  },
  performance: {
    enableCaching: true,
    enableBatchOperations: true,
    maxCacheSize: 1000
  },
  optimization: {
    enableWALMode: true,
    enableForeignKeys: true,
    cacheSize: -64000,
    synchronous: 'NORMAL',
    tempStore: 'MEMORY'
  }
});
```

## Connection Configuration

### SQLite Connection Options

```typescript
connection: {
  database: './data/dreambeesart.db'  // Path to SQLite database file
}
```

**Options:**
- `database` (string, required): Path to the SQLite database file
  - Can be relative to the current working directory
  - Can be absolute path
  - File will be created if it doesn't exist

**Examples:**
```typescript
// Relative path
connection: { database: './data/app.db' }

// Absolute path
connection: { database: '/var/lib/app/database.db' }

// In-memory database (for testing)
connection: { database: ':memory:' }
```

## Automation Configuration

### Auto-Optimization Features

```typescript
automation: {
  enableAutoOptimization: true,     // Auto-optimize SQLite settings
  enableIndexRecommendations: true, // Generate index suggestions
  enableQueryAnalysis: true,        // Analyze query patterns
  enableMigrationGeneration: true   // Auto-generate migrations
}
```

**Options:**
- `enableAutoOptimization` (boolean, default: `false`): Automatically optimize SQLite settings
- `enableIndexRecommendations` (boolean, default: `false`): Generate index recommendations based on query patterns
- `enableQueryAnalysis` (boolean, default: `false`): Analyze query patterns for optimization
- `enableMigrationGeneration` (boolean, default: `false`): Auto-generate migration files

**Benefits:**
- **Auto-Optimization**: Automatically applies optimal SQLite PRAGMA settings
- **Index Recommendations**: Suggests indexes based on query patterns
- **Query Analysis**: Identifies slow queries and optimization opportunities
- **Migration Generation**: Automatically generates migration files for schema changes

## Performance Configuration

### Caching and Batch Operations

```typescript
performance: {
  enableCaching: true,              // Enable intelligent caching
  enableBatchOperations: true,      // Optimize batch operations
  maxCacheSize: 1000               // Maximum cache entries
}
```

**Options:**
- `enableCaching` (boolean, default: `false`): Enable intelligent query result caching
- `enableBatchOperations` (boolean, default: `false`): Optimize batch insert/update operations
- `maxCacheSize` (number, default: `1000`): Maximum number of cache entries

**Caching Benefits:**
- Reduces database load for frequently accessed data
- Improves response times for repeated queries
- Automatic cache invalidation on data changes

**Batch Operations Benefits:**
- Optimizes multiple insert/update operations
- Reduces transaction overhead
- Improves bulk data operations performance

## SQLite Optimization Configuration

### Database Optimization Settings

```typescript
optimization: {
  enableWALMode: true,             // Enable WAL mode for better concurrency
  enableForeignKeys: true,         // Enable foreign key constraints
  cacheSize: -64000,               // 64MB cache size
  synchronous: 'NORMAL',           // Synchronous mode
  tempStore: 'MEMORY'              // Use memory for temp storage
}
```

### WAL Mode

**Option:** `enableWALMode` (boolean, default: `false`)

**Benefits:**
- Better concurrency (multiple readers can access simultaneously)
- Improved write performance
- Better crash recovery
- Reduced database locking

**When to Enable:**
- Applications with multiple concurrent readers
- High write throughput requirements
- Need for better crash recovery

### Foreign Keys

**Option:** `enableForeignKeys` (boolean, default: `false`)

**Benefits:**
- Data integrity enforcement
- Referential integrity checks
- Prevents orphaned records

**When to Enable:**
- Applications with complex relationships
- Need for data integrity enforcement
- Multi-table operations

### Cache Size

**Option:** `cacheSize` (number, default: `-2000`)

**Values:**
- Negative values: Cache size in KB (e.g., `-64000` = 64MB)
- Positive values: Number of pages to cache
- `0`: Disable caching

**Recommended Values:**
- Small applications: `-2000` (2MB)
- Medium applications: `-64000` (64MB)
- Large applications: `-256000` (256MB)

### Synchronous Mode

**Option:** `synchronous` (string, default: `'FULL'`)

**Values:**
- `'OFF'`: No synchronization (fastest, least safe)
- `'NORMAL'`: Normal synchronization (good balance)
- `'FULL'`: Full synchronization (safest, slowest)

**When to Use:**
- `'OFF'`: Testing environments, temporary data
- `'NORMAL'`: Most production applications
- `'FULL'`: Critical data integrity requirements

### Temporary Storage

**Option:** `tempStore` (string, default: `'FILE'`)

**Values:**
- `'FILE'`: Use temporary files (default)
- `'MEMORY'`: Use memory for temporary storage

**Benefits of Memory:**
- Faster temporary operations
- Reduced disk I/O
- Better performance for complex queries

**When to Use Memory:**
- Applications with complex queries
- Sufficient RAM available
- Performance-critical applications

## Environment-Specific Configuration

### Development Configuration

```typescript
const db = new NOORMME({
  dialect: 'sqlite',
  connection: {
    database: './data/dev.db'
  },
  automation: {
    enableAutoOptimization: true,
    enableIndexRecommendations: true,
    enableQueryAnalysis: true,
    enableMigrationGeneration: true
  },
  performance: {
    enableCaching: false,  // Disable caching in development
    enableBatchOperations: true,
    maxCacheSize: 100
  },
  optimization: {
    enableWALMode: false,  // Disable WAL in development
    enableForeignKeys: true,
    cacheSize: -2000,      // Smaller cache
    synchronous: 'NORMAL',
    tempStore: 'MEMORY'
  }
});
```

### Production Configuration

```typescript
const db = new NOORMME({
  dialect: 'sqlite',
  connection: {
    database: './data/production.db'
  },
  automation: {
    enableAutoOptimization: true,
    enableIndexRecommendations: true,
    enableQueryAnalysis: true,
    enableMigrationGeneration: false  // Disable auto-migrations in production
  },
  performance: {
    enableCaching: true,   // Enable caching in production
    enableBatchOperations: true,
    maxCacheSize: 1000
  },
  optimization: {
    enableWALMode: true,   // Enable WAL in production
    enableForeignKeys: true,
    cacheSize: -64000,     // Larger cache
    synchronous: 'NORMAL',
    tempStore: 'MEMORY'
  }
});
```

### Testing Configuration

```typescript
const db = new NOORMME({
  dialect: 'sqlite',
  connection: {
    database: ':memory:'  // In-memory database for tests
  },
  automation: {
    enableAutoOptimization: false,
    enableIndexRecommendations: false,
    enableQueryAnalysis: false,
    enableMigrationGeneration: false
  },
  performance: {
    enableCaching: false,
    enableBatchOperations: false,
    maxCacheSize: 0
  },
  optimization: {
    enableWALMode: false,
    enableForeignKeys: true,
    cacheSize: 0,
    synchronous: 'OFF',    // Fastest for tests
    tempStore: 'MEMORY'
  }
});
```

## Configuration Validation

### Configuration Schema

```typescript
interface NoormmeConfig {
  dialect: 'sqlite';
  connection: {
    database: string;
  };
  automation?: {
    enableAutoOptimization?: boolean;
    enableIndexRecommendations?: boolean;
    enableQueryAnalysis?: boolean;
    enableMigrationGeneration?: boolean;
  };
  performance?: {
    enableCaching?: boolean;
    enableBatchOperations?: boolean;
    maxCacheSize?: number;
  };
  optimization?: {
    enableWALMode?: boolean;
    enableForeignKeys?: boolean;
    cacheSize?: number;
    synchronous?: 'OFF' | 'NORMAL' | 'FULL';
    tempStore?: 'FILE' | 'MEMORY';
  };
}
```

### Configuration Validation Function

```typescript
function validateConfig(config: any): NoormmeConfig {
  // Validate required fields
  if (!config.dialect || config.dialect !== 'sqlite') {
    throw new Error('dialect must be "sqlite"');
  }
  
  if (!config.connection?.database) {
    throw new Error('connection.database is required');
  }
  
  // Validate optional fields
  if (config.performance?.maxCacheSize && config.performance.maxCacheSize < 0) {
    throw new Error('performance.maxCacheSize must be non-negative');
  }
  
  if (config.optimization?.synchronous && !['OFF', 'NORMAL', 'FULL'].includes(config.optimization.synchronous)) {
    throw new Error('optimization.synchronous must be one of: OFF, NORMAL, FULL');
  }
  
  if (config.optimization?.tempStore && !['FILE', 'MEMORY'].includes(config.optimization.tempStore)) {
    throw new Error('optimization.tempStore must be one of: FILE, MEMORY');
  }
  
  return config as NoormmeConfig;
}
```

## Configuration Best Practices

### 1. Environment-Based Configuration

```typescript
// config/database.ts
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const baseConfig = {
  dialect: 'sqlite' as const,
  connection: {
    database: process.env.DATABASE_URL || './data/app.db'
  }
};

const developmentConfig = {
  ...baseConfig,
  automation: {
    enableAutoOptimization: true,
    enableIndexRecommendations: true,
    enableQueryAnalysis: true,
    enableMigrationGeneration: true
  },
  performance: {
    enableCaching: false,
    enableBatchOperations: true,
    maxCacheSize: 100
  },
  optimization: {
    enableWALMode: false,
    enableForeignKeys: true,
    cacheSize: -2000,
    synchronous: 'NORMAL' as const,
    tempStore: 'MEMORY' as const
  }
};

const productionConfig = {
  ...baseConfig,
  automation: {
    enableAutoOptimization: true,
    enableIndexRecommendations: true,
    enableQueryAnalysis: true,
    enableMigrationGeneration: false
  },
  performance: {
    enableCaching: true,
    enableBatchOperations: true,
    maxCacheSize: 1000
  },
  optimization: {
    enableWALMode: true,
    enableForeignKeys: true,
    cacheSize: -64000,
    synchronous: 'NORMAL' as const,
    tempStore: 'MEMORY' as const
  }
};

const testConfig = {
  ...baseConfig,
  connection: {
    database: ':memory:'
  },
  automation: {
    enableAutoOptimization: false,
    enableIndexRecommendations: false,
    enableQueryAnalysis: false,
    enableMigrationGeneration: false
  },
  performance: {
    enableCaching: false,
    enableBatchOperations: false,
    maxCacheSize: 0
  },
  optimization: {
    enableWALMode: false,
    enableForeignKeys: true,
    cacheSize: 0,
    synchronous: 'OFF' as const,
    tempStore: 'MEMORY' as const
  }
};

export const config = isDevelopment 
  ? developmentConfig 
  : isProduction 
    ? productionConfig 
    : testConfig;
```

### 2. Configuration Loading

```typescript
// Load configuration from environment variables
function loadConfig(): NoormmeConfig {
  return {
    dialect: 'sqlite',
    connection: {
      database: process.env.DATABASE_URL || './data/app.db'
    },
    automation: {
      enableAutoOptimization: process.env.ENABLE_AUTO_OPTIMIZATION === 'true',
      enableIndexRecommendations: process.env.ENABLE_INDEX_RECOMMENDATIONS === 'true',
      enableQueryAnalysis: process.env.ENABLE_QUERY_ANALYSIS === 'true',
      enableMigrationGeneration: process.env.ENABLE_MIGRATION_GENERATION === 'true'
    },
    performance: {
      enableCaching: process.env.ENABLE_CACHING === 'true',
      enableBatchOperations: process.env.ENABLE_BATCH_OPERATIONS === 'true',
      maxCacheSize: parseInt(process.env.MAX_CACHE_SIZE || '1000')
    },
    optimization: {
      enableWALMode: process.env.ENABLE_WAL_MODE === 'true',
      enableForeignKeys: process.env.ENABLE_FOREIGN_KEYS === 'true',
      cacheSize: parseInt(process.env.CACHE_SIZE || '-64000'),
      synchronous: (process.env.SYNCHRONOUS as 'OFF' | 'NORMAL' | 'FULL') || 'NORMAL',
      tempStore: (process.env.TEMP_STORE as 'FILE' | 'MEMORY') || 'MEMORY'
    }
  };
}
```

### 3. Configuration Validation

```typescript
// Validate configuration before use
function createDatabase(config: NoormmeConfig) {
  try {
    const validatedConfig = validateConfig(config);
    return new NOORMME(validatedConfig);
  } catch (error) {
    console.error('Invalid database configuration:', error);
    throw error;
  }
}
```

## Troubleshooting Configuration

### Common Configuration Issues

1. **Database File Permissions**
   ```typescript
   // Ensure database directory exists and is writable
   import { mkdirSync } from 'fs';
   import { dirname } from 'path';
   
   const dbPath = './data/app.db';
   mkdirSync(dirname(dbPath), { recursive: true });
   ```

2. **Memory Limitations**
   ```typescript
   // Adjust cache size based on available memory
   const cacheSize = process.env.NODE_ENV === 'production' ? -64000 : -2000;
   ```

3. **WAL Mode Issues**
   ```typescript
   // Disable WAL mode if experiencing issues
   optimization: {
     enableWALMode: false,
     // ... other options
   }
   ```

### Configuration Debugging

```typescript
// Log configuration for debugging
function logConfig(config: NoormmeConfig) {
  console.log('Database Configuration:', {
    dialect: config.dialect,
    database: config.connection.database,
    automation: config.automation,
    performance: config.performance,
    optimization: config.optimization
  });
}
```

## Next Steps

- [API Reference](./07-api-reference.md) - Full API documentation
- [Troubleshooting](./08-troubleshooting.md) - Common issues and solutions
- [Real-World Examples](./05-real-world-examples.md) - Authentication, RBAC, caching examples
