# Migration Guide

This guide helps you migrate from the old monolithic schema discovery to the new factory/dialect-based architecture.

## Overview of Changes

The schema discovery system has been refactored from a single monolithic file to a modular, dialect-specific architecture. The changes provide:

- **Better Performance**: Database-specific optimizations
- **Enhanced Maintainability**: Clear separation of concerns
- **Improved Extensibility**: Easy addition of new database dialects
- **Complete Implementations**: No more placeholders or TODOs

## Breaking Changes

### None! 🎉

The new architecture is **100% backward compatible**. All existing code continues to work without any changes.

```typescript
// This still works exactly as before
const schema = await db.discoverSchema()
```

## New Features Available

### 1. Dialect-Specific Coordinators

You can now access dialect-specific functionality:

```typescript
import { DiscoveryFactory, PostgreSQLDiscoveryCoordinator } from 'noormme'

const factory = DiscoveryFactory.getInstance()
const coordinator = factory.createDiscoveryCoordinator('postgresql') as PostgreSQLDiscoveryCoordinator

// Get PostgreSQL-specific recommendations
const recommendations = await coordinator.getRecommendations(db, schema.tables)
```

### 2. Enhanced Metadata

PostgreSQL and SQLite now provide enhanced metadata:

```typescript
// PostgreSQL tables now include:
// - Index usage statistics
// - Constraint performance analysis
// - Extension information
// - Performance recommendations

// SQLite tables now include:
// - PRAGMA-based optimization info
// - Foreign key support status
// - Integrity check results
// - Configuration recommendations
```

### 3. Capability Checking

Check what features are supported by your database:

```typescript
const factory = DiscoveryFactory.getInstance()
const capabilities = factory.getDialectCapabilities('postgresql')

if (capabilities.supportsMaterializedViews) {
  // Use materialized view features
}

if (capabilities.supportsDeferredConstraints) {
  // Use deferred constraint features
}
```

## Migration Strategies

### Option 1: No Changes (Recommended)

Continue using the existing API. The new architecture works transparently:

```typescript
// Your existing code continues to work
const db = new NOORMME({
  dialect: 'postgresql',
  connection: { /* ... */ }
})

await db.initialize()
const schema = await db.discoverSchema()
```

### Option 2: Gradual Migration

Gradually adopt new features while keeping existing code:

```typescript
// Phase 1: Keep existing code
const schema = await db.discoverSchema()

// Phase 2: Add capability checking
const factory = DiscoveryFactory.getInstance()
const capabilities = factory.getDialectCapabilities('postgresql')

// Phase 3: Use dialect-specific features
if (capabilities.supportsMaterializedViews) {
  const coordinator = factory.createDiscoveryCoordinator('postgresql')
  const recommendations = await coordinator.getRecommendations(db, schema.tables)
}
```

### Option 3: Full Migration

Migrate to the new architecture for maximum benefits:

```typescript
import { 
  DiscoveryFactory, 
  PostgreSQLDiscoveryCoordinator,
  SchemaDiscoveryCoordinator 
} from 'noormme'

// Use the new coordinator directly
const coordinator = SchemaDiscoveryCoordinator.getInstance()
const schema = await coordinator.discoverSchema(db, {
  includeViews: true,
  excludeTables: ['temp_*']
})

// Get dialect-specific coordinator
const factory = DiscoveryFactory.getInstance()
const pgCoordinator = factory.createDiscoveryCoordinator('postgresql') as PostgreSQLDiscoveryCoordinator

// Use PostgreSQL-specific features
const recommendations = await pgCoordinator.getRecommendations(db, schema.tables)
const capabilities = pgCoordinator.getCapabilities()
```

## Performance Improvements

### Automatic Optimizations

The new architecture provides automatic performance improvements:

1. **Parallel Processing**: Table discovery runs in parallel
2. **Database-Specific Queries**: Uses native SQL for each database
3. **Optimized Metadata**: Retrieves only necessary information
4. **Caching**: Singleton instances prevent repeated instantiation

### Measuring Performance

Compare performance before and after migration:

```typescript
console.time('Schema Discovery')
const schema = await db.discoverSchema()
console.timeEnd('Schema Discovery')

console.log(`Discovered ${schema.tables.length} tables in ${performance.now()}ms`)
```

## Database-Specific Features

### PostgreSQL Enhancements

New PostgreSQL-specific features available:

```typescript
const pgCoordinator = factory.createDiscoveryCoordinator('postgresql') as PostgreSQLDiscoveryCoordinator

// Get index usage statistics
const recommendations = await pgCoordinator.getRecommendations(db, schema.tables)

// Check PostgreSQL capabilities
const capabilities = pgCoordinator.getCapabilities()
console.log('Supports JSONB:', capabilities.supportsCustomTypes)
console.log('Supports Extensions:', capabilities.supportsExtensions)
```

**New Metadata Available:**
- Index usage statistics from `pg_stat_user_indexes`
- Constraint performance analysis
- Extension information
- Connection pool statistics
- Configuration settings

### SQLite Enhancements

New SQLite-specific features available:

```typescript
const sqliteCoordinator = factory.createDiscoveryCoordinator('sqlite') as SQLiteDiscoveryCoordinator

// Get optimization recommendations
const recommendations = await sqliteCoordinator.getRecommendations(db, schema.tables)

// Get configuration recommendations
const configRecs = sqliteCoordinator.getConfigurationRecommendations()
console.log('SQLite Config:', configRecs)

// Check SQLite capabilities
const capabilities = sqliteCoordinator.getCapabilities()
console.log('Foreign Keys Enabled:', capabilities.supportsForeignKeys)
```

**New Metadata Available:**
- PRAGMA-based optimization info
- Foreign key support status
- Integrity check results
- Database statistics
- Compile options

## Troubleshooting Migration Issues

### Common Issues and Solutions

#### 1. Import Errors

**Problem:** Cannot find module errors after refactoring

**Solution:** Update import paths if using internal APIs:

```typescript
// Old (if you were using internal APIs)
import { SchemaDiscoveryCoordinator } from './schema-discovery.coordinator.js'

// New
import { SchemaDiscoveryCoordinator } from 'noormme'
```

#### 2. Type Errors

**Problem:** TypeScript errors with new interfaces

**Solution:** Update type imports:

```typescript
// Old
import { TableInfo } from './types/schema-discovery-types.js'

// New
import { TableInfo } from 'noormme'
```

#### 3. Performance Issues

**Problem:** Slower discovery after migration

**Solution:** Check database connection and query optimization:

```typescript
// Enable debug logging
process.env.DEBUG = 'noormme:schema'

// Check connection pool settings
const db = new NOORMME({
  dialect: 'postgresql',
  connection: {
    // ... connection config
    pool: {
      min: 2,
      max: 10,
      idleTimeoutMillis: 30000
    }
  }
})
```

### Debugging Tips

1. **Enable Debug Logging:**
   ```typescript
   process.env.DEBUG = 'noormme:schema'
   ```

2. **Check Dialect Detection:**
   ```typescript
   const factory = DiscoveryFactory.getInstance()
   console.log('Supported dialects:', factory.getSupportedDialects())
   console.log('Current dialect supported:', factory.isDialectSupported('postgresql'))
   ```

3. **Verify Capabilities:**
   ```typescript
   const capabilities = factory.getDialectCapabilities('postgresql')
   console.log('PostgreSQL capabilities:', capabilities)
   ```

## Testing Migration

### Unit Tests

Update tests to use new architecture:

```typescript
// Before
describe('Schema Discovery', () => {
  it('should discover tables', async () => {
    const schema = await schemaDiscovery.discoverSchema()
    expect(schema.tables).to.have.length.greaterThan(0)
  })
})

// After
describe('Schema Discovery', () => {
  it('should discover tables', async () => {
    const schema = await schemaDiscovery.discoverSchema()
    expect(schema.tables).to.have.length.greaterThan(0)
  })

  it('should provide dialect-specific recommendations', async () => {
    const factory = DiscoveryFactory.getInstance()
    const coordinator = factory.createDiscoveryCoordinator('postgresql')
    const recommendations = await coordinator.getRecommendations(db, schema.tables)
    expect(recommendations).to.be.an('array')
  })
})
```

### Integration Tests

Test with real database connections:

```typescript
describe('PostgreSQL Discovery', () => {
  it('should discover PostgreSQL-specific metadata', async () => {
    const coordinator = factory.createDiscoveryCoordinator('postgresql') as PostgreSQLDiscoveryCoordinator
    const capabilities = coordinator.getCapabilities()
    
    expect(capabilities.supportsExtensions).to.be.true
    expect(capabilities.supportsCustomTypes).to.be.true
  })
})
```

## Rollback Plan

If you encounter issues, you can rollback by:

1. **Revert to Previous Version:**
   ```bash
   git checkout <previous-commit>
   npm install
   ```

2. **Use Legacy Services:**
   The old services are still available for backward compatibility:
   ```typescript
   import { TableDiscoveryService } from 'noormme'
   ```

## Support and Resources

### Documentation
- [README.md](./README.md) - Overview and usage
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Design details
- [API_REFERENCE.md](./API_REFERENCE.md) - Complete API documentation
- [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) - Implementation details

### Community
- GitHub Issues: Report bugs and request features
- Discussions: Ask questions and share experiences
- Pull Requests: Contribute improvements

### Performance Monitoring

Monitor migration success:

```typescript
// Before migration
const startTime = performance.now()
const schema = await db.discoverSchema()
const endTime = performance.now()
console.log(`Discovery time: ${endTime - startTime}ms`)
console.log(`Tables found: ${schema.tables.length}`)

// After migration - should be faster
const startTime = performance.now()
const schema = await db.discoverSchema()
const endTime = performance.now()
console.log(`Discovery time: ${endTime - startTime}ms`)
console.log(`Tables found: ${schema.tables.length}`)
```

The new architecture should provide better performance, more features, and improved maintainability while maintaining 100% backward compatibility.
