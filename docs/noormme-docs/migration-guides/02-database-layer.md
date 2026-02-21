# 02 - Database Layer Migration

This guide covers migrating your existing database layer from PostgreSQL to Noormme, including compatibility layers and initialization.

## Overview

We'll migrate:
- Database connection and initialization
- Compatibility layers for existing code
- Health checks and monitoring
- Connection statistics

## Step 1: Update Kysely Compatibility Layer

If you have existing code importing from `kysely.ts`, create a compatibility layer:

**Before (PostgreSQL):**
```typescript
// src/lib/db/kysely.ts
import { Pool } from 'pg';
import { Kysely, PostgresDialect } from 'kysely';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool,
  }),
});

// Connection pool management
export async function closeConnection() {
  await pool.end();
}

export function getConnectionStats() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}
```

**After (Noormme Compatibility Layer):**
```typescript
// src/lib/db/kysely.ts
// Re-export Noormme database instance and utilities
// This file now serves as a compatibility layer for existing code that imports from './kysely'
export { 
  db, 
  initializeDatabase, 
  getConnectionStats, 
  healthCheck,
  closeDatabase,
  getKysely
} from './noormme';

// Export types for convenience
export type { Database } from './types';
export type { 
  User, 
  Account, 
  Session, 
  VerificationToken,
  GenerationHistory,
  UserPreference,
  ApiKey,
  Role,
  Permission,
  RolePermission,
  UserRole,
  AiModel,
  NewUser,
  NewAccount,
  NewSession,
  NewVerificationToken,
  NewGenerationHistory,
  NewUserPreference,
  NewApiKey,
  NewRole,
  NewPermission,
  NewRolePermission,
  NewUserRole,
  NewAiModel
} from './types';
```

## Step 2: Update Database Check Functions

**Before (PostgreSQL):**
```typescript
// src/lib/check-db.ts
import { db } from './db';

export async function checkDatabaseConnection() {
  try {
    await db.selectFrom('users').select(db.fn.count('id')).execute();
    return { connected: true, error: null };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}
```

**After (Noormme):**
```typescript
// src/lib/check-db.ts
import { getKysely, healthCheck } from './db';

export async function checkDatabaseConnection() {
  try {
    const health = await healthCheck();
    return { connected: health.healthy, error: health.error || null };
  } catch (error) {
    return { 
      connected: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function getDatabaseStats() {
  const kysely = getKysely();
  
  try {
    // Get basic table counts
    const userCount = await kysely
      .selectFrom('users')
      .select(kysely.fn.count('id').as('count'))
      .executeTakeFirst();
      
    const roleCount = await kysely
      .selectFrom('roles')
      .select(kysely.fn.count('id').as('count'))
      .executeTakeFirst();

    return {
      users: userCount?.count || 0,
      roles: roleCount?.count || 0,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting database stats:', error);
    return {
      users: 0,
      roles: 0,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

## Step 3: Update Database Initialization

**Before (PostgreSQL):**
```typescript
// src/lib/db-init.ts
import { db } from './kysely';
import { closeConnection } from './kysely';

export async function initializeDatabase() {
  try {
    // Test connection
    await db.selectFrom('users').select(db.fn.count('id')).execute();
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

export async function closeDatabase() {
  await closeConnection();
}
```

**After (Noormme):**
```typescript
// src/lib/db-init.ts
import { 
  initializeDatabase as initNoormme, 
  healthCheck, 
  closeDatabase as closeNoormme 
} from './noormme';

export async function initializeDatabase() {
  try {
    await initNoormme();
    
    // Run health check
    const health = await healthCheck();
    if (health.healthy) {
      console.log('✅ Database initialized and healthy');
    } else {
      console.warn('⚠️ Database initialized but health check failed:', health.error);
    }
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

export async function closeDatabase() {
  await closeNoormme();
}

export { healthCheck, getConnectionStats } from './noormme';
```

## Step 4: Update Application Initialization

**Before (Next.js middleware or layout):**
```typescript
// middleware.ts or layout.tsx
import { initializeDatabase } from '@/lib/db-init';

// Initialize database
initializeDatabase().catch(console.error);
```

**After (Noormme):**
```typescript
// middleware.ts or layout.tsx
import { initializeDatabase } from '@/lib/db';

// Initialize database with health monitoring
initializeDatabase()
  .then(() => {
    console.log('🚀 Application ready with Noormme');
  })
  .catch((error) => {
    console.error('💥 Application startup failed:', error);
    process.exit(1);
  });
```

## Step 5: Create Database Health Monitoring

Create a comprehensive health monitoring system:

```typescript
// src/lib/db-monitor.ts
import { healthCheck, getConnectionStats, getKysely } from './db';

export interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  responseTime: number;
  details: {
    connection: any;
    tables: Record<string, number>;
    errors?: string[];
  };
}

export async function getDetailedHealth(): Promise<DatabaseHealth> {
  const start = Date.now();
  const errors: string[] = [];
  const tables: Record<string, number> = {};

  try {
    // Basic health check
    const basicHealth = await healthCheck();
    
    if (!basicHealth.healthy) {
      errors.push(basicHealth.error || 'Health check failed');
    }

    // Get table counts
    const kysely = getKysely();
    
    try {
      const userCount = await kysely
        .selectFrom('users')
        .select(kysely.fn.count('id').as('count'))
        .executeTakeFirst();
      tables.users = Number(userCount?.count || 0);
    } catch (error) {
      errors.push(`Users table error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    try {
      const roleCount = await kysely
        .selectFrom('roles')
        .select(kysely.fn.count('id').as('count'))
        .executeTakeFirst();
      tables.roles = Number(roleCount?.count || 0);
    } catch (error) {
      errors.push(`Roles table error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    const responseTime = Date.now() - start;
    const status = errors.length === 0 ? 'healthy' : errors.length < 3 ? 'degraded' : 'unhealthy';

    return {
      status,
      timestamp: new Date().toISOString(),
      responseTime,
      details: {
        connection: getConnectionStats(),
        tables,
        errors: errors.length > 0 ? errors : undefined
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - start,
      details: {
        connection: getConnectionStats(),
        tables,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    };
  }
}

// API route for health monitoring
export async function handleHealthCheck(): Promise<Response> {
  const health = await getDetailedHealth();
  
  return new Response(JSON.stringify(health), {
    status: health.status === 'healthy' ? 200 : 503,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

## Step 6: Update TypeScript Configuration

Ensure TypeScript excludes migration scripts:

```json
// tsconfig.json
{
  "compilerOptions": {
    // ... your existing options
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "scripts"]
}
```

## Step 7: Create Migration Utilities

Create utilities for database management:

```typescript
// src/lib/db-utils.ts
import { getKysely, getSchemaInfo, getOptimizationRecommendations } from './db';

export async function getDatabaseInfo() {
  try {
    const kysely = getKysely();
    const schema = getSchemaInfo();
    const optimizations = getOptimizationRecommendations();

    return {
      schema,
      optimizations,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting database info:', error);
    throw error;
  }
}

export async function vacuumDatabase() {
  try {
    const kysely = getKysely();
    await kysely.executeQuery({ sql: 'VACUUM', parameters: [] });
    console.log('✅ Database vacuumed successfully');
  } catch (error) {
    console.error('❌ Database vacuum failed:', error);
    throw error;
  }
}

export async function analyzeDatabase() {
  try {
    const kysely = getKysely();
    await kysely.executeQuery({ sql: 'ANALYZE', parameters: [] });
    console.log('✅ Database analyzed successfully');
  } catch (error) {
    console.error('❌ Database analysis failed:', error);
    throw error;
  }
}
```

## Testing the Migration

Create a test script to verify the database layer migration:

```typescript
// scripts/test-db-layer.ts
import { 
  initializeDatabase, 
  healthCheck, 
  getConnectionStats,
  getKysely 
} from '../src/lib/db';

async function testDatabaseLayer() {
  try {
    console.log('🧪 Testing database layer migration...');
    
    // Test initialization
    await initializeDatabase();
    console.log('✅ Database initialized');
    
    // Test health check
    const health = await healthCheck();
    console.log('✅ Health check:', health.healthy ? 'PASSED' : 'FAILED');
    
    // Test connection stats
    const stats = getConnectionStats();
    console.log('✅ Connection stats:', stats);
    
    // Test Kysely integration
    const kysely = getKysely();
    const result = await kysely
      .selectFrom('users')
      .select(kysely.fn.count('id').as('count'))
      .executeTakeFirst();
    console.log('✅ Kysely integration test:', result);
    
    console.log('🎉 Database layer migration successful!');
  } catch (error) {
    console.error('❌ Database layer migration failed:', error);
    process.exit(1);
  }
}

testDatabaseLayer();
```

## Common Issues and Solutions

### Import Errors
- **Issue**: Existing code can't find database functions
- **Solution**: Update imports to use the new compatibility layer

### Type Errors
- **Issue**: TypeScript errors with new database types
- **Solution**: Ensure all types are properly exported from the compatibility layer

### Health Check Failures
- **Issue**: Health checks fail after migration
- **Solution**: Verify database initialization and table existence

## Next Steps

Once the database layer is migrated, proceed to [03-repository-migration.md](./03-repository-migration.md) to convert direct database calls to the repository pattern.
