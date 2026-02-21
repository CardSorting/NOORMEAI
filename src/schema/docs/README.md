# Schema Discovery Architecture

This document describes the factory/dialect-based architecture for schema discovery in NOORMME.

## Overview

The schema discovery system has been refactored from a monolithic approach to a modular, dialect-specific architecture. This allows each database type to have its own specialized discovery logic while maintaining a consistent interface.

## Architecture Principles

### 1. Factory Pattern
- **Single Responsibility**: The `DiscoveryFactory` is responsible for creating dialect-specific services
- **Extensibility**: Easy to add new database dialects without modifying existing code
- **Type Safety**: Factory methods return properly typed services

### 2. Dialect-Specific Implementation
- **Database Optimization**: Each dialect uses native SQL queries and features
- **Performance**: Optimized for specific database capabilities
- **Maintainability**: Database-specific logic is isolated and easy to modify

### 3. Layered Architecture
```
┌─────────────────────────────────────┐
│           SchemaDiscovery           │  ← Public API
├─────────────────────────────────────┤
│     SchemaDiscoveryCoordinator      │  ← Central Coordinator
├─────────────────────────────────────┤
│         DiscoveryFactory           │  ← Service Factory
├─────────────────────────────────────┤
│    Dialect-Specific Coordinators   │  ← Database Logic
│  ┌─────────────┐ ┌─────────────────┐│
│  │PostgreSQL   │ │     SQLite      ││
│  │Coordinator  │ │   Coordinator   ││
│  └─────────────┘ └─────────────────┘│
└─────────────────────────────────────┘
```

## Directory Structure

```
src/schema/
├── builders/                       # Schema builders and executors
├── core/                           # Shared components
│   ├── coordinators/               # Central coordination
│   ├── discovery/                  # Generic discovery services
│   ├── factories/                  # Service factories
│   ├── types/                      # Type definitions
│   └── utils/                      # Utility functions
├── dialects/                       # Database-specific implementations
│   ├── postgresql/                 # PostgreSQL implementation
│   ├── sqlite/                     # SQLite implementation
│   ├── mysql/                      # MySQL (future)
│   └── mssql/                      # MSSQL (future)
├── docs/                           # Documentation
├── index.ts                        # Main exports
├── schema-discovery.ts             # Schema discovery entry point
└── schema.ts                       # Core schema functionality
```

## Core Components

### DiscoveryFactory
Creates and manages dialect-specific discovery services.

```typescript
const factory = DiscoveryFactory.getInstance()
const coordinator = factory.createDiscoveryCoordinator('postgresql')
```

### Dialect Coordinators
Each database has its own coordinator that handles:
- Table discovery with database-specific metadata
- Index analysis using native queries
- Constraint discovery with dialect-specific features
- Performance recommendations

### Discovery Services
Specialized services for different aspects:
- **TableMetadataDiscovery**: Generic table structure discovery
- **RelationshipDiscovery**: Foreign key relationship analysis
- **ViewDiscovery**: Database view discovery

## Usage Examples

### Basic Schema Discovery
```typescript
import { NOORMME } from 'noormme'

const db = new NOORMME({
  dialect: 'postgresql',
  connection: { /* ... */ }
})

await db.initialize()
// Uses PostgreSQLDiscoveryCoordinator automatically
```

### Advanced Usage
```typescript
import { DiscoveryFactory, PostgreSQLDiscoveryCoordinator } from 'noormme'

const coordinator = DiscoveryFactory.getInstance()
  .createDiscoveryCoordinator('postgresql') as PostgreSQLDiscoveryCoordinator

const schema = await coordinator.discoverSchema(db, {
  includeViews: true,
  excludeTables: ['temp_*']
})

// Get PostgreSQL-specific recommendations
const recommendations = await coordinator.getRecommendations(db, schema.tables)
```

## Database-Specific Features

### PostgreSQL
- Uses `pg_index`, `pg_constraint`, `pg_tables` system tables
- Supports deferred constraints, partial indexes
- Advanced performance analysis with `pg_stat_*` views
- JSONB column support, array types, custom types

### SQLite
- Uses `sqlite_master`, `PRAGMA` commands
- Foreign key constraint checking
- Integrity verification
- WAL mode optimization recommendations

## Benefits

1. **Performance**: Database-specific optimizations
2. **Maintainability**: Clear separation of concerns
3. **Extensibility**: Easy to add new databases
4. **Type Safety**: Comprehensive TypeScript support
5. **No Placeholders**: Complete implementations for all features

## Migration Guide

The new architecture is backward compatible. Existing code continues to work:

```typescript
// Old way (still works)
const schema = await db.discoverSchema()

// New way (recommended for advanced usage)
const coordinator = DiscoveryFactory.getInstance()
  .createDiscoveryCoordinator(db.getDialect())
const schema = await coordinator.discoverSchema(db)
```

## Future Enhancements

- MySQL dialect implementation
- MSSQL dialect implementation
- Caching layer for schema metadata
- Schema comparison and migration tools
- Performance monitoring and analytics
