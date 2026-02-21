# 12 - Performance Optimization

This guide covers optimizing SQLite performance with Noormme for production use, including query optimization, indexing strategies, and monitoring.

## Overview

We'll optimize:
- SQLite configuration for production workloads
- Query performance and indexing strategies
- Caching implementation and optimization
- Connection pooling and resource management
- Monitoring and performance metrics

## Step 1: SQLite Production Configuration

### Optimized Noormme Configuration
```typescript
// src/lib/db/noormme.ts
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
    maxBatchSize: 1000
  },
  optimization: {
    // WAL mode for better concurrency
    enableWALMode: true,
    
    // Cache size (negative = KB, positive = pages)
    cacheSize: -64000, // 64MB cache
    
    // Synchronous mode: OFF (fastest), NORMAL (balanced), FULL (safest)
    synchronous: 'NORMAL',
    
    // Use memory for temporary storage
    tempStore: 'MEMORY',
    
    // Enable foreign keys
    enableForeignKeys: true,
    
    // Journal mode
    journalMode: 'WAL',
    
    // Locking mode
    lockingMode: 'NORMAL',
    
    // Auto vacuum
    autoVacuum: 'INCREMENTAL',
    
    // Page size (4096 is optimal for most use cases)
    pageSize: 4096,
    
    // Busy timeout
    busyTimeout: 30000
  }
}) as unknown as NOORMME.Config;
```

### Production Environment Settings
```typescript
// src/lib/db/production-config.ts
export function getProductionConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    optimization: {
      enableWALMode: true,
      cacheSize: isProduction ? -128000 : -32000, // 128MB in production, 32MB in dev
      synchronous: isProduction ? 'NORMAL' : 'FULL',
      tempStore: 'MEMORY',
      enableForeignKeys: true,
      journalMode: 'WAL',
      lockingMode: 'NORMAL',
      autoVacuum: 'INCREMENTAL',
      pageSize: 4096,
      busyTimeout: isProduction ? 60000 : 30000
    }
  };
}
```

## Step 2: Database Indexing Strategy

### Create Essential Indexes
```typescript
// src/lib/db/indexes.ts
import { getKysely } from './db';

export async function createProductionIndexes() {
  const kysely = getKysely();
  
  const indexes = [
    // User indexes
    { name: 'idx_users_email', table: 'users', columns: ['email'], unique: true },
    { name: 'idx_users_created_at', table: 'users', columns: ['created_at'] },
    { name: 'idx_users_active', table: 'users', columns: ['active'] },
    
    // Session indexes
    { name: 'idx_sessions_token', table: 'sessions', columns: ['session_token'], unique: true },
    { name: 'idx_sessions_user_id', table: 'sessions', columns: ['user_id'] },
    { name: 'idx_sessions_expires', table: 'sessions', columns: ['expires'] },
    
    // Account indexes
    { name: 'idx_accounts_provider', table: 'accounts', columns: ['provider', 'provider_account_id'], unique: true },
    { name: 'idx_accounts_user_id', table: 'accounts', columns: ['user_id'] },
    
    // Role indexes
    { name: 'idx_user_roles_user_id', table: 'user_roles', columns: ['user_id', 'role_id'], unique: true },
    { name: 'idx_role_permissions_role_id', table: 'role_permissions', columns: ['role_id', 'permission_id'], unique: true },
    
    // Generation history indexes
    { name: 'idx_generation_history_user_id', table: 'generation_history', columns: ['user_id'] },
    { name: 'idx_generation_history_created_at', table: 'generation_history', columns: ['created_at'] },
    { name: 'idx_generation_history_status', table: 'generation_history', columns: ['status'] },
    
    // Composite indexes for common queries
    { name: 'idx_users_active_created', table: 'users', columns: ['active', 'created_at'] },
    { name: 'idx_sessions_user_expires', table: 'sessions', columns: ['user_id', 'expires'] }
  ];
  
  for (const index of indexes) {
    try {
      const unique = index.unique ? 'UNIQUE ' : '';
      const columns = index.columns.join(', ');
      const sql = `CREATE ${unique}INDEX IF NOT EXISTS ${index.name} ON ${index.table} (${columns})`;
      
      await kysely.executeQuery({ sql, parameters: [] });
      console.log(`✅ Created index: ${index.name}`);
    } catch (error) {
      console.error(`❌ Failed to create index ${index.name}:`, error);
    }
  }
}

// Analyze tables for optimal index recommendations
export async function analyzeTables() {
  const kysely = getKysely();
  
  const tables = ['users', 'sessions', 'accounts', 'generation_history'];
  
  for (const table of tables) {
    try {
      await kysely.executeQuery({ 
        sql: `ANALYZE ${table}`, 
        parameters: [] 
      });
      console.log(`✅ Analyzed table: ${table}`);
    } catch (error) {
      console.error(`❌ Failed to analyze ${table}:`, error);
    }
  }
}
```

### Dynamic Index Creation Based on Query Patterns
```typescript
// src/lib/db/query-analyzer.ts
export class QueryAnalyzer {
  private kysely = getKysely();
  private slowQueries: Array<{ sql: string; count: number; avgTime: number }> = [];
  
  async analyzeSlowQueries() {
    // Get query statistics (SQLite doesn't have built-in query stats)
    const queryStats = await this.getQueryStats();
    
    for (const query of queryStats) {
      if (query.avgTime > 100) { // Queries slower than 100ms
        await this.recommendIndexes(query.sql);
      }
    }
  }
  
  private async recommendIndexes(sql: string) {
    // Simple heuristic-based index recommendations
    const whereClause = this.extractWhereClause(sql);
    
    if (whereClause) {
      const columns = this.extractColumns(whereClause);
      if (columns.length > 0) {
        await this.createRecommendedIndex(sql, columns);
      }
    }
  }
  
  private extractWhereClause(sql: string): string | null {
    const match = sql.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+GROUP\s+BY|\s+LIMIT|$)/i);
    return match ? match[1] : null;
  }
  
  private extractColumns(whereClause: string): string[] {
    // Extract column names from WHERE clause
    const columnMatches = whereClause.match(/(\w+)\s*[=<>!]/g);
    return columnMatches ? columnMatches.map(match => match.split(/\s/)[0]) : [];
  }
  
  private async createRecommendedIndex(sql: string, columns: string[]) {
    const tableName = this.extractTableName(sql);
    if (!tableName) return;
    
    const indexName = `idx_${tableName}_${columns.join('_')}`;
    
    try {
      const sql = `CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${columns.join(', ')})`;
      await this.kysely.executeQuery({ sql, parameters: [] });
      console.log(`✅ Created recommended index: ${indexName}`);
    } catch (error) {
      console.error(`❌ Failed to create recommended index:`, error);
    }
  }
}
```

## Step 3: Query Optimization

### Optimized Query Patterns
```typescript
// src/lib/db/optimized-queries.ts
import { getKysely, getRepository } from './db';

export class OptimizedQueries {
  private kysely = getKysely();
  
  // Use LIMIT for pagination
  async getUsersPaginated(page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;
    
    return await this.kysely
      .selectFrom('users')
      .selectAll()
      .where('active', '=', true)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();
  }
  
  // Use EXISTS instead of IN for better performance
  async getUsersWithRoles() {
    return await this.kysely
      .selectFrom('users')
      .selectAll('users')
      .where((eb) => 
        eb.exists(
          eb.selectFrom('user_roles')
            .select('user_id')
            .whereRef('user_roles.user_id', '=', 'users.id')
        )
      )
      .execute();
  }
  
  // Use specific column selection instead of SELECT *
  async getUserBasicInfo(userId: string) {
    return await this.kysely
      .selectFrom('users')
      .select(['id', 'name', 'email', 'image'])
      .where('id', '=', userId)
      .executeTakeFirst();
  }
  
  // Use prepared statements for repeated queries
  private getUserByIdStmt = this.kysely
    .selectFrom('users')
    .selectAll()
    .where('id', '=', this.kysely.param('userId'))
    .prepare();
  
  async getUserByIdPrepared(userId: string) {
    return await this.getUserByIdStmt.execute({ userId });
  }
  
  // Batch operations with transactions
  async batchUpdateUsers(updates: Array<{ id: string; data: Record<string, unknown> }>) {
    return await this.kysely.transaction().execute(async (trx) => {
      const results = [];
      
      for (const update of updates) {
        const result = await trx
          .updateTable('users')
          .set(update.data)
          .where('id', '=', update.id)
          .returningAll()
          .executeTakeFirst();
        
        results.push(result);
      }
      
      return results;
    });
  }
}
```

### Query Performance Monitoring
```typescript
// src/lib/db/query-monitor.ts
export class QueryMonitor {
  private slowQueries: Array<{ sql: string; duration: number; timestamp: Date }> = [];
  private queryStats: Map<string, { count: number; totalTime: number; avgTime: number }> = new Map();
  
  logQuery(sql: string, duration: number) {
    // Track slow queries
    if (duration > 100) { // 100ms threshold
      this.slowQueries.push({ sql, duration, timestamp: new Date() });
      
      // Keep only last 1000 slow queries
      if (this.slowQueries.length > 1000) {
        this.slowQueries = this.slowQueries.slice(-1000);
      }
    }
    
    // Track query statistics
    const normalizedSql = this.normalizeSql(sql);
    const stats = this.queryStats.get(normalizedSql) || { count: 0, totalTime: 0, avgTime: 0 };
    
    stats.count++;
    stats.totalTime += duration;
    stats.avgTime = stats.totalTime / stats.count;
    
    this.queryStats.set(normalizedSql, stats);
  }
  
  getSlowQueries() {
    return this.slowQueries;
  }
  
  getQueryStats() {
    return Array.from(this.queryStats.entries()).map(([sql, stats]) => ({
      sql,
      ...stats
    }));
  }
  
  getTopSlowQueries(limit: number = 10) {
    return Array.from(this.queryStats.entries())
      .sort((a, b) => b[1].avgTime - a[1].avgTime)
      .slice(0, limit)
      .map(([sql, stats]) => ({ sql, ...stats }));
  }
  
  private normalizeSql(sql: string): string {
    // Normalize SQL for grouping similar queries
    return sql
      .replace(/\d+/g, '?') // Replace numbers with placeholders
      .replace(/'[^']*'/g, '?') // Replace strings with placeholders
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
}
```

## Step 4: Caching Optimization

### Intelligent Caching Strategy
```typescript
// src/lib/db/optimized-cache.ts
import { dbCache, CacheUtils } from './db-cache';

export class OptimizedCache {
  private kysely = getKysely();
  
  // Multi-level caching
  async getUserWithRoles(userId: string) {
    // Level 1: User profile cache
    const userKey = CacheUtils.userKey(userId, 'profile');
    let user = await dbCache.get<Record<string, unknown>>('users', userKey);
    
    if (!user) {
      const userRepo = getRepository('users');
      user = await userRepo.findById(userId) as Record<string, unknown>;
      if (user) {
        await dbCache.set('users', userKey, user, 3600); // 1 hour TTL
      }
    }
    
    // Level 2: User roles cache
    const rolesKey = CacheUtils.userKey(userId, 'roles');
    let roles = await dbCache.get<string[]>('user-roles', rolesKey);
    
    if (!roles) {
      roles = await this.getUserRoles(userId);
      if (roles) {
        await dbCache.set('user-roles', rolesKey, roles, 1800); // 30 minutes TTL
      }
    }
    
    return { user, roles };
  }
  
  // Cache warming
  async warmCache() {
    console.log('🔥 Warming cache...');
    
    // Warm frequently accessed data
    await this.warmActiveUsers();
    await this.warmPopularRoles();
    await this.warmSystemStats();
    
    console.log('✅ Cache warming completed');
  }
  
  private async warmActiveUsers() {
    const activeUsers = await this.kysely
      .selectFrom('users')
      .select(['id', 'name', 'email'])
      .where('active', '=', true)
      .execute();
    
    for (const user of activeUsers) {
      const cacheKey = CacheUtils.userKey(user.id as string, 'profile');
      await dbCache.set('users', cacheKey, user, 3600);
    }
    
    console.log(`🔥 Warmed ${activeUsers.length} active users`);
  }
  
  private async warmPopularRoles() {
    const popularRoles = await this.kysely
      .selectFrom('roles')
      .selectAll()
      .where('active', '=', true)
      .execute();
    
    for (const role of popularRoles) {
      const cacheKey = `role:${role.id}:permissions`;
      await dbCache.set('roles', cacheKey, role, 7200); // 2 hours TTL
    }
    
    console.log(`🔥 Warmed ${popularRoles.length} popular roles`);
  }
  
  // Cache invalidation strategies
  async invalidateUserCache(userId: string) {
    const patterns = [
      CacheUtils.userKey(userId, '*'),
      `user:${userId}:*`,
      `user-roles:${userId}:*`
    ];
    
    for (const pattern of patterns) {
      await dbCache.deletePattern('users', pattern);
      await dbCache.deletePattern('user-roles', pattern);
    }
  }
  
  // Cache compression for large objects
  async setCompressed(key: string, value: any, ttl?: number) {
    const compressed = await this.compress(JSON.stringify(value));
    await dbCache.set('compressed', key, compressed, ttl);
  }
  
  async getCompressed(key: string) {
    const compressed = await dbCache.get<string>('compressed', key);
    if (compressed) {
      const decompressed = await this.decompress(compressed);
      return JSON.parse(decompressed);
    }
    return null;
  }
  
  private async compress(data: string): Promise<string> {
    // Use compression library like pako
    const compressed = Buffer.from(data).toString('base64');
    return compressed;
  }
  
  private async decompress(compressed: string): Promise<string> {
    return Buffer.from(compressed, 'base64').toString();
  }
}
```

## Step 5: Connection Management

### Connection Pooling and Resource Management
```typescript
// src/lib/db/connection-manager.ts
export class ConnectionManager {
  private kysely = getKysely();
  private connectionStats = {
    activeConnections: 0,
    totalQueries: 0,
    slowQueries: 0,
    lastActivity: new Date()
  };
  
  async executeWithMetrics<T>(operation: () => Promise<T>): Promise<T> {
    const start = Date.now();
    this.connectionStats.totalQueries++;
    this.connectionStats.lastActivity = new Date();
    
    try {
      const result = await operation();
      const duration = Date.now() - start;
      
      if (duration > 100) {
        this.connectionStats.slowQueries++;
      }
      
      return result;
    } catch (error) {
      console.error('Query execution failed:', error);
      throw error;
    }
  }
  
  getConnectionStats() {
    return {
      ...this.connectionStats,
      slowQueryRate: this.connectionStats.totalQueries > 0 
        ? (this.connectionStats.slowQueries / this.connectionStats.totalQueries) * 100 
        : 0
    };
  }
  
  // Database maintenance
  async performMaintenance() {
    console.log('🔧 Performing database maintenance...');
    
    try {
      // Analyze tables
      await this.kysely.executeQuery({ sql: 'ANALYZE', parameters: [] });
      
      // Incremental vacuum
      await this.kysely.executeQuery({ sql: 'VACUUM', parameters: [] });
      
      // Update statistics
      await this.updateStatistics();
      
      console.log('✅ Database maintenance completed');
    } catch (error) {
      console.error('❌ Database maintenance failed:', error);
    }
  }
  
  private async updateStatistics() {
    const tables = ['users', 'sessions', 'accounts', 'generation_history'];
    
    for (const table of tables) {
      await this.kysely.executeQuery({ 
        sql: `ANALYZE ${table}`, 
        parameters: [] 
      });
    }
  }
}
```

## Step 6: Performance Monitoring

### Real-time Performance Metrics
```typescript
// src/lib/db/performance-monitor.ts
export class PerformanceMonitor {
  private kysely = getKysely();
  private metrics: {
    queriesPerSecond: number;
    averageResponseTime: number;
    slowQueryCount: number;
    cacheHitRate: number;
    connectionCount: number;
  } = {
    queriesPerSecond: 0,
    averageResponseTime: 0,
    slowQueryCount: 0,
    cacheHitRate: 0,
    connectionCount: 0
  };
  
  async getDatabaseMetrics() {
    // Get database file size
    const sizeResult = await this.kysely.executeQuery({
      sql: "SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()",
      parameters: []
    });
    
    // Get table statistics
    const tableStats = await this.getTableStatistics();
    
    // Get index usage
    const indexStats = await this.getIndexStatistics();
    
    return {
      ...this.metrics,
      databaseSize: sizeResult.rows[0]?.size || 0,
      tableStats,
      indexStats,
      timestamp: new Date().toISOString()
    };
  }
  
  private async getTableStatistics() {
    const tables = ['users', 'sessions', 'accounts', 'generation_history'];
    const stats: Record<string, any> = {};
    
    for (const table of tables) {
      try {
        const countResult = await this.kysely
          .selectFrom(table as any)
          .select(this.kysely.fn.count('*').as('count'))
          .executeTakeFirst();
        
        stats[table] = {
          rowCount: Number(countResult?.count || 0)
        };
      } catch (error) {
        stats[table] = { error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
    
    return stats;
  }
  
  private async getIndexStatistics() {
    const indexResult = await this.kysely.executeQuery({
      sql: "SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'",
      parameters: []
    });
    
    return indexResult.rows.map(row => ({
      name: row.name,
      table: row.tbl_name
    }));
  }
  
  // Performance alerts
  checkPerformanceAlerts() {
    const alerts: string[] = [];
    
    if (this.metrics.averageResponseTime > 500) {
      alerts.push('High average response time detected');
    }
    
    if (this.metrics.slowQueryCount > 10) {
      alerts.push('Multiple slow queries detected');
    }
    
    if (this.metrics.cacheHitRate < 0.8) {
      alerts.push('Low cache hit rate detected');
    }
    
    return alerts;
  }
}
```

## Step 7: Production Deployment Considerations

### Environment-Specific Configuration
```typescript
// src/lib/db/environment-config.ts
export function getEnvironmentConfig() {
  const env = process.env.NODE_ENV;
  const isProduction = env === 'production';
  const isDevelopment = env === 'development';
  
  return {
    database: {
      path: isProduction ? '/var/lib/app/dreambeesart.db' : './data/dreambeesart.db',
      backup: isProduction ? '/var/lib/app/backups/' : './data/backups/',
      wal: isProduction ? '/var/lib/app/dreambeesart.db-wal' : './data/dreambeesart.db-wal'
    },
    performance: {
      cacheSize: isProduction ? -128000 : -32000,
      synchronous: isProduction ? 'NORMAL' : 'FULL',
      busyTimeout: isProduction ? 60000 : 30000,
      maxBatchSize: isProduction ? 2000 : 1000
    },
    monitoring: {
      enableQueryLogging: isProduction,
      slowQueryThreshold: isProduction ? 100 : 50,
      metricsInterval: isProduction ? 60000 : 30000
    }
  };
}
```

### Backup and Recovery
```typescript
// src/lib/db/backup-manager.ts
export class BackupManager {
  private kysely = getKysely();
  
  async createBackup(backupPath: string) {
    console.log('📦 Creating database backup...');
    
    try {
      // Create backup using SQLite backup API
      await this.kysely.executeQuery({
        sql: `VACUUM INTO '${backupPath}'`,
        parameters: []
      });
      
      console.log(`✅ Backup created: ${backupPath}`);
      return backupPath;
    } catch (error) {
      console.error('❌ Backup failed:', error);
      throw error;
    }
  }
  
  async scheduleBackups() {
    // Create daily backups
    setInterval(async () => {
      const timestamp = new Date().toISOString().split('T')[0];
      const backupPath = `./data/backups/dreambeesart_${timestamp}.db`;
      
      try {
        await this.createBackup(backupPath);
        
        // Clean up old backups (keep last 7 days)
        await this.cleanupOldBackups();
      } catch (error) {
        console.error('Scheduled backup failed:', error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours
  }
  
  private async cleanupOldBackups() {
    const fs = require('fs');
    const path = require('path');
    
    const backupDir = './data/backups/';
    const files = fs.readdirSync(backupDir);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    
    for (const file of files) {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(filePath);
        console.log(`🗑️  Cleaned up old backup: ${file}`);
      }
    }
  }
}
```

## Step 8: Performance Testing

### Load Testing Script
```typescript
// scripts/performance-test.ts
import { getKysely, initializeDatabase } from '../src/lib/db';

async function performanceTest() {
  await initializeDatabase();
  const kysely = getKysely();
  
  console.log('🚀 Starting performance test...');
  
  // Test concurrent queries
  const concurrentQueries = 100;
  const startTime = Date.now();
  
  const promises = Array(concurrentQueries).fill(0).map(async (_, i) => {
    return await kysely
      .selectFrom('users')
      .selectAll()
      .limit(10)
      .execute();
  });
  
  await Promise.all(promises);
  
  const duration = Date.now() - startTime;
  const qps = (concurrentQueries / duration) * 1000;
  
  console.log(`✅ Completed ${concurrentQueries} concurrent queries in ${duration}ms`);
  console.log(`📊 Queries per second: ${qps.toFixed(2)}`);
  
  // Test memory usage
  const memUsage = process.memoryUsage();
  console.log(`💾 Memory usage: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
}

performanceTest().catch(console.error);
```

## Common Performance Issues and Solutions

### Issue: Slow Query Performance
**Solution:**
- Add appropriate indexes
- Use query analysis to identify bottlenecks
- Optimize query patterns
- Use prepared statements for repeated queries

### Issue: High Memory Usage
**Solution:**
- Implement query result streaming
- Use pagination for large datasets
- Optimize cache sizes
- Regular garbage collection

### Issue: Database Locking
**Solution:**
- Use WAL mode
- Optimize transaction sizes
- Implement connection pooling
- Use appropriate busy timeouts

## Next Steps

After optimizing performance, proceed to [13-production-deployment.md](./13-production-deployment.md) for production deployment considerations.
