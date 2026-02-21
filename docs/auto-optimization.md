# Autonomous Database Governance

NOORMME's governance features allow your agents to manage and heal their own persistence layers autonomously.

## 🎯 Overview

NOORMME automatically analyzes your database usage patterns and applies optimizations to improve performance. These optimizations include:

- **Pragma Optimization**: SQLite-specific performance settings
- **Index Recommendations**: Intelligent index suggestions based on query patterns
- **Foreign Key Validation**: Constraint validation and auto-fixing
- **Query Analysis**: N+1 query detection and performance monitoring
- **Backup Recommendations**: Intelligent backup strategies
- **Performance Drift Detection**: Autonomous monitoring for execution latency regressions

## ⚡ Automatic Pragma Optimization

NOORMME automatically applies these SQLite optimizations during initialization:

### WAL Mode
```typescript
// Automatically enabled for better concurrency
PRAGMA journal_mode = WAL
```

**Benefits**:
- 2-3x improvement in concurrent read performance
- Better write concurrency
- Reduced lock contention

### Cache Optimization
```typescript
// Automatically sets optimal cache size
PRAGMA cache_size = -64000  // 64MB cache
```

**Benefits**:
- 20-50% improvement in query performance
- Reduced disk I/O
- Better memory utilization

### Foreign Key Support
```typescript
// Automatically enables foreign key constraints
PRAGMA foreign_keys = ON
```

**Benefits**:
- Data integrity enforcement
- Better relationship handling
- Automatic constraint validation

### Additional Optimizations
```typescript
// Synchronous mode for optimal performance
PRAGMA synchronous = NORMAL

// Memory-based temporary storage
PRAGMA temp_store = MEMORY

// Incremental auto-vacuum for space reclamation
PRAGMA auto_vacuum = INCREMENTAL
```

## 🔍 Intelligent Index Recommendations

NOORMME analyzes your query patterns and recommends optimal indexes:

### Query Pattern Analysis
```typescript
// Record queries for analysis
db.recordQuery('SELECT * FROM users WHERE email = ?', 250, 'users')
db.recordQuery('SELECT * FROM posts WHERE user_id = ?', 180, 'posts')

// Get index recommendations
const recommendations = await db.getSQLiteIndexRecommendations({
  minFrequency: 3,        // Minimum query frequency
  slowQueryThreshold: 1000, // Slow query threshold (ms)
  includePartialIndexes: true,
  maxRecommendations: 20
})
```

### Recommendation Types

#### Single Column Indexes
```sql
-- For frequently queried columns
CREATE INDEX idx_users_email ON users (email)
CREATE INDEX idx_posts_status ON posts (status)
```

#### Composite Indexes
```sql
-- For multi-column queries
CREATE INDEX idx_posts_user_status ON posts (user_id, status)
CREATE INDEX idx_orders_customer_date ON orders (customer_id, created_at)
```

#### Foreign Key Indexes
```sql
-- For better JOIN performance
CREATE INDEX idx_posts_user_id ON posts (user_id)
CREATE INDEX idx_comments_post_id ON comments (post_id)
```

### Example Output
```typescript
{
  recommendations: [
    {
      table: 'users',
      columns: ['email'],
      type: 'single',
      priority: 'high',
      reason: 'Frequently queried column (8 times, avg 1250ms)',
      estimatedImpact: 'high',
      sql: 'CREATE INDEX "idx_users_email" ON "users" ("email")'
    },
    {
      table: 'posts',
      columns: ['user_id', 'created_at'],
      type: 'composite',
      priority: 'medium',
      reason: 'Composite index for multiple WHERE columns (5 times)',
      estimatedImpact: 'medium',
      sql: 'CREATE INDEX "idx_posts_user_id_created_at" ON "posts" ("user_id", "created_at")'
    }
  ],
  redundantIndexes: ['idx_old_index'],
  missingIndexes: ['idx_users_email'],
  performanceImpact: 'high'
}
```

## 🔗 Foreign Key Validation

NOORMME automatically validates foreign key constraints and suggests improvements:

### Validation Features
```typescript
// Validate foreign key constraints
const validation = await constraintDiscovery.validateForeignKeyConstraints(db)

console.log('Validation results:', {
  isValid: validation.isValid,
  issues: validation.issues,
  recommendations: validation.recommendations,
  orphanedRecords: validation.orphanedRecords,
  performanceImpact: validation.performanceImpact
})
```

### Auto-Fix Capabilities
```typescript
// Auto-fix common foreign key issues
const fixResult = await constraintDiscovery.autoFixForeignKeyIssues(db, {
  createMissingIndexes: true,    // Create missing indexes
  enableForeignKeys: true,       // Enable foreign key constraints
  cleanupOrphanedRecords: false, // Clean up orphaned records
  dryRun: true                   // Preview changes without applying
})

console.log('Fix results:', {
  applied: fixResult.applied,    // Successfully applied fixes
  failed: fixResult.failed,      // Failed fixes
  skipped: fixResult.skipped     // Skipped fixes
})
```

### Common Issues Detected
- **Orphaned Records**: Records referencing non-existent foreign keys
- **Missing Indexes**: Foreign key columns without indexes
- **Invalid References**: References to non-existent tables/columns
- **Disabled Constraints**: Foreign key constraints not enabled

## 📊 Performance Monitoring

NOORMME continuously monitors your database performance:

### Query Analysis
```typescript
// Get performance metrics
const metrics = await db.getSQLitePerformanceMetrics()

console.log('Database metrics:', {
  databaseSize: `${(metrics.pageCount * metrics.pageSize / 1024).toFixed(2)} KB`,
  cacheSize: metrics.cacheSize,
  journalMode: metrics.journalMode,
  foreignKeys: metrics.foreignKeys ? 'Enabled' : 'Disabled',
  integrityCheck: metrics.integrityCheck ? 'Passed' : 'Failed',
  freelistCount: metrics.freelistCount,
  autoVacuum: metrics.autoVacuum
})
```

### N+1 Query Detection
NOORMME automatically detects N+1 query patterns:

```typescript
// Example N+1 pattern detection
// Query: SELECT * FROM users WHERE id = ?
// Detected: Same query executed 5+ times in quick succession
// Recommendation: Use batch loading or JOINs
```

### Performance Drift Monitoring
NOORMME's `SelfTestRegistry` autonomously detects execution regressions using high-fidelity telemetry:

```typescript
// Register a performance drift probe
await db.agent.cortex.registerProbe(
  'latency_monitor', 
  'audit:check_performance_drift'
)
```

**Internal Logic**:
1.  **Baseline Extraction**: Automatically aggregates the average execution time of the previous 100 queries from `agent_metrics`.
2.  **Recent Sampling**: Takes a rolling average of the most recent 20 queries.
3.  **Anomaly Detection**: If the recent sample is **> 50% slower** than the historical baseline, the probe fails (Status: `fail`), triggering an autonomous repair ritual.

### Proactive Indexing & Rituals
The engine doesn't just wait for slow queries; it proactively suggests structural improvements:
- **Contextual Analysis**: Uses `recordQuery` metadata to identify "Knowledge Hotspots" that require index optimization.
- **Ritual Orchestration**: Automated background loops (scheduled via `RitualOrchestrator`) handle database `VACUUM`, `ANALYZE`, and stale history pruning without agent intervention.

## 💾 Backup Recommendations

NOORMME provides intelligent backup strategies:

```typescript
// Get backup recommendations
const backupRecs = await db.getSQLiteBackupRecommendations()

backupRecs.forEach(rec => console.log(`💡 ${rec}`))

// Example recommendations:
// - "When using WAL mode, ensure to backup both the main database file and WAL file for consistency"
// - "For large databases, consider using SQLite backup API or .backup command for efficient backups"
// - "Perform backups during low-activity periods to minimize lock contention"
```

### WAL Mode Considerations
When using WAL mode, NOORMME recommends:
- Backing up both the main database file and WAL file
- Using SQLite's backup API for consistency
- Performing backups during low-activity periods

## 🔧 Configuration Options

### Enable/Disable Auto-Optimization
```typescript
const db = new NOORMME({
  dialect: 'sqlite',
  connection: { database: './app.sqlite' },
  performance: {
    enableAutoOptimization: true,    // Enable automatic optimizations
    enableQueryOptimization: true,   // Enable query analysis
    enableBatchLoading: true,        // Enable batch loading
    maxBatchSize: 100                // Maximum batch size
  }
})
```

### Custom Optimization Settings
```typescript
// Get default configuration
const config = sqliteAutoOptimizer.getDefaultConfig()

// Customize settings
config.cacheSize = -128000  // 128MB cache
config.journalMode = 'WAL'
config.autoVacuumMode = 'INCREMENTAL'

// Apply custom optimizations
const result = await sqliteAutoOptimizer.optimizeDatabase(db, config)
```

## 📈 Performance Impact

### Measured Improvements
- **WAL Mode**: 2-3x improvement in concurrent read performance
- **Cache Optimization**: 20-50% improvement in query performance
- **Index Recommendations**: 5-10x improvement for targeted queries
- **Foreign Key Indexes**: 3-5x improvement in JOIN performance

### Real-world Examples
```typescript
// Before optimization
// Query: SELECT * FROM users WHERE email = 'john@example.com'
// Execution time: 1250ms
// Index: None

// After optimization
// Query: SELECT * FROM users WHERE email = 'john@example.com'
// Execution time: 15ms
// Index: idx_users_email
// Improvement: 83x faster
```

## 🎯 Best Practices

### 1. Let NOORMME Handle Optimization
```typescript
// Enable automatic optimizations
const db = new NOORMME({
  performance: { enableAutoOptimization: true }
})
```

### 2. Monitor Performance Regularly
```typescript
// Get optimization recommendations
const optimizations = await db.getSQLiteOptimizations()

// Apply recommended indexes
const indexRecs = await db.getSQLiteIndexRecommendations()
```

### 3. Use Dry-Run Mode
```typescript
// Preview changes before applying
const fixResult = await constraintDiscovery.autoFixForeignKeyIssues(db, {
  dryRun: true
})
```

### 4. Monitor Query Patterns
```typescript
// Record queries for analysis
db.recordQuery('SELECT * FROM users WHERE status = ?', 250, 'users')
```

## 🚀 Getting Started

To enable auto-optimization:

1. **Initialize NOORMME** with auto-optimization enabled
2. **Record queries** for pattern analysis
3. **Review recommendations** and apply as needed
4. **Monitor performance** metrics regularly

```typescript
const db = new NOORMME({
  dialect: 'sqlite',
  connection: { database: './app.sqlite' },
  performance: { enableAutoOptimization: true }
})

await db.initialize()

// Start recording queries
db.recordQuery('SELECT * FROM users WHERE email = ?', 250, 'users')

// Get recommendations
const recommendations = await db.getSQLiteIndexRecommendations()
console.log('Recommended indexes:', recommendations.recommendations)
```

## 🎉 Conclusion

NOORMME's auto-optimization features ensure your SQLite database performs at its best automatically. With intelligent index recommendations, foreign key validation, and performance monitoring, you can focus on building your application while NOORMME handles the optimization.

**Happy optimizing! 🚀**
