# Noormme - Production-Ready SQLite ORM

Noormme is a comprehensive SQLite ORM designed for production applications. It provides a clean, type-safe interface for database operations with built-in performance optimization and production features.

## Overview

Noormme is a modern SQLite ORM that provides:
- **Repository Pattern**: Clean, type-safe database operations with custom finders
- **Kysely Integration**: Complex queries with full type safety and IntelliSense
- **Production Features**: Health checks, monitoring, optimization, and caching
- **Performance Optimization**: Built-in SQLite tuning, WAL mode, and intelligent caching
- **Real-World Integrations**: NextAuth adapter, RBAC system, and migration management
- **Runtime ORM**: Works at runtime with dynamic table discovery and optimization

## Documentation Structure

### Core Documentation
- [`01-getting-started.md`](./01-getting-started.md) - Basic setup and configuration
- [`02-repository-pattern.md`](./02-repository-pattern.md) - Repository pattern usage
- [`03-kysely-integration.md`](./03-kysely-integration.md) - Complex queries with Kysely
- [`04-production-features.md`](./04-production-features.md) - Health checks, monitoring, optimization
- [`05-real-world-examples.md`](./05-real-world-examples.md) - Authentication, RBAC, caching examples
- [`06-configuration-reference.md`](./06-configuration-reference.md) - Complete configuration options
- [`07-api-reference.md`](./07-api-reference.md) - Full API documentation
- [`08-troubleshooting.md`](./08-troubleshooting.md) - Common issues and solutions
- [`09-runtime-orm-features.md`](./09-runtime-orm-features.md) - Runtime ORM capabilities and features
- [`10-oauth-authentication-fix.md`](./10-oauth-authentication-fix.md) - OAuth authentication implementation and troubleshooting

### Migration Guides
- [`migration-guides/`](./migration-guides/) - Complete PostgreSQL to SQLite migration documentation
  - Step-by-step migration from PostgreSQL to Noormme
  - Real-world examples from DreamBeesArt application
  - Authentication, RBAC, and caching system migration
  - Data migration scripts and validation tools
  - Troubleshooting and performance optimization

## Quick Start

```typescript
import { NOORMME } from 'noormme';

// Initialize Noormme with production-ready configuration
const db = new NOORMME({
  dialect: 'sqlite',
  connection: { database: './data/app.db' },
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

// Initialize database
await db.initialize();

// Repository Pattern - Simple CRUD operations
const userRepo = db.getRepository('users');
const user = await userRepo.findById('123');
const users = await userRepo.findManyByEmail('john@example.com'); // Custom finder
const newUser = await userRepo.create(userData);

// Kysely Integration - Complex queries with full type safety
const kysely = db.getKysely();
const result = await kysely
  .selectFrom('users')
  .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
  .innerJoin('roles', 'roles.id', 'user_roles.role_id')
  .select(['users.name', 'roles.name as role_name'])
  .where('users.active', '=', true)
  .execute();

// Production Features - Health monitoring
const health = await db.healthCheck();
console.log('Database health:', health.healthy);
```

## Production Implementation

This documentation is based on the real-world implementation in the DreamBeesArt application, which demonstrates:

- **NextAuth Integration**: Complete authentication system with custom adapter
- **RBAC System**: Role-based access control with intelligent caching
- **Performance Optimization**: SQLite tuning, WAL mode, and query optimization
- **Health Monitoring**: Database health checks and connection statistics
- **Migration System**: Schema versioning and automated migrations
- **Caching Strategy**: Multi-layer caching for optimal performance

## Key Features Demonstrated

1. **Repository Pattern**: Clean CRUD operations with automatically generated custom finders
2. **Kysely Integration**: Complex queries with full type safety and IntelliSense
3. **Custom Finders**: `findManyByEmail()`, `findManyByName()`, `findManyByUserId()` etc.
4. **Production Monitoring**: Health checks, performance metrics, and connection statistics
5. **Authentication Integration**: Complete NextAuth adapter implementation
6. **RBAC Implementation**: Role-based access control with permission caching
7. **SQLite Optimization**: WAL mode, cache tuning, and performance monitoring

## Getting Started

Start with [`01-getting-started.md`](./01-getting-started.md) for basic setup, then explore the specific areas you need for your implementation.

### Quick Navigation

- **New to Noormme?** Start with [Getting Started](./01-getting-started.md)
- **Need CRUD operations?** Check out [Repository Pattern](./02-repository-pattern.md)
- **Complex queries?** See [Kysely Integration](./03-kysely-integration.md)
- **Production deployment?** Review [Production Features](./04-production-features.md)
- **Real-world examples?** Explore [Real-World Examples](./05-real-world-examples.md)
- **Runtime ORM features?** Learn about [Runtime ORM Features](./09-runtime-orm-features.md)
- **OAuth authentication issues?** See [OAuth Authentication Fix](./10-oauth-authentication-fix.md)

## Contributing

This documentation is based on real production usage. If you find gaps or have improvements, please contribute by documenting your own implementation patterns.
