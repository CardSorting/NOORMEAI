# 13 - Production Deployment

This guide covers production deployment considerations for Noormme-based applications.

## Overview

We'll cover:
- Production environment setup
- Database configuration and optimization
- Security considerations
- Performance optimization
- Monitoring and alerting
- Backup and recovery strategies
- Scaling considerations

## Step 1: Production Environment Setup

### Environment Configuration
```typescript
// src/lib/config/production.ts
export const productionConfig = {
  database: {
    dialect: 'sqlite' as const,
    connection: {
      database: process.env.DATABASE_PATH || '/app/data/dreambeesart.db'
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
      enableWALMode: true,
      enableForeignKeys: true,
      cacheSize: -128000, // 128MB cache size for production
      synchronous: 'NORMAL',
      tempStore: 'MEMORY',
      journalMode: 'WAL',
      lockingMode: 'NORMAL'
    }
  },
  security: {
    enableQueryLogging: false, // Disable in production
    enableDebugMode: false,
    maxConnections: 100,
    connectionTimeout: 30000
  },
  monitoring: {
    enableHealthChecks: true,
    healthCheckInterval: 60000, // 1 minute
    enableMetrics: true,
    metricsRetentionDays: 30
  }
};
```

### Docker Configuration
```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create data directory for SQLite database
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### Docker Compose for Production
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/app/data/dreambeesart.db
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=${NEXTAUTH_URL}
    volumes:
      - app_data:/app/data
      - app_logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  app_data:
    driver: local
  app_logs:
    driver: local
```

## Step 2: Database Configuration

### SQLite Production Optimizations
```typescript
// src/lib/db/production-config.ts
import { NOORMME } from 'noormme';

export const productionDatabase = new NOORMME({
  dialect: 'sqlite',
  connection: {
    database: process.env.DATABASE_PATH || '/app/data/dreambeesart.db'
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
    // Production SQLite optimizations
    enableWALMode: true,           // Write-Ahead Logging for better concurrency
    enableForeignKeys: true,       // Enable foreign key constraints
    cacheSize: -128000,           // 128MB cache size
    synchronous: 'NORMAL',         // Balance between safety and speed
    tempStore: 'MEMORY',          // Use memory for temporary storage
    journalMode: 'WAL',           // WAL mode for better performance
    lockingMode: 'NORMAL',        // Normal locking mode
    mmapSize: 268435456,          // 256MB memory-mapped I/O
    pageSize: 4096,               // 4KB page size
    autoVacuum: 'INCREMENTAL'     // Incremental vacuum for maintenance
  }
});

// Apply production optimizations after initialization
export async function applyProductionOptimizations() {
  try {
    await productionDatabase.initialize();
    
    // Additional production settings
    const kysely = productionDatabase.getKysely();
    
    // Set production pragmas
    await kysely.raw('PRAGMA journal_mode = WAL').execute();
    await kysely.raw('PRAGMA synchronous = NORMAL').execute();
    await kysely.raw('PRAGMA cache_size = -128000').execute();
    await kysely.raw('PRAGMA temp_store = MEMORY').execute();
    await kysely.raw('PRAGMA mmap_size = 268435456').execute();
    await kysely.raw('PRAGMA page_size = 4096').execute();
    await kysely.raw('PRAGMA auto_vacuum = INCREMENTAL').execute();
    
    // Create indexes for production queries
    await kysely.raw(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_generation_history_user_id ON generation_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_generation_history_created_at ON generation_history(created_at);
      CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
      CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
      CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);
    `).execute();
    
    console.log('✅ Production database optimizations applied');
  } catch (error) {
    console.error('❌ Failed to apply production optimizations:', error);
    throw error;
  }
}
```

### Database Maintenance Service
```typescript
// src/lib/services/database-maintenance.ts
import { getKysely } from '../db';

export class DatabaseMaintenanceService {
  static async performMaintenance(): Promise<void> {
    console.log('🔧 Starting database maintenance...');
    
    try {
      await Promise.all([
        this.vacuumDatabase(),
        this.analyzeDatabase(),
        this.optimizeDatabase(),
        this.cleanupOldData()
      ]);
      
      console.log('✅ Database maintenance completed');
    } catch (error) {
      console.error('❌ Database maintenance failed:', error);
      throw error;
    }
  }

  private static async vacuumDatabase(): Promise<void> {
    const kysely = getKysely();
    
    // Incremental vacuum to reclaim space
    await kysely.raw('PRAGMA incremental_vacuum').execute();
    console.log('✅ Incremental vacuum completed');
  }

  private static async analyzeDatabase(): Promise<void> {
    const kysely = getKysely();
    
    // Update query planner statistics
    await kysely.raw('ANALYZE').execute();
    console.log('✅ Database analysis completed');
  }

  private static async optimizeDatabase(): Promise<void> {
    const kysely = getKysely();
    
    // Optimize database
    await kysely.raw('PRAGMA optimize').execute();
    console.log('✅ Database optimization completed');
  }

  private static async cleanupOldData(): Promise<void> {
    const kysely = getKysely();
    
    // Clean up old sessions (older than 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    await kysely
      .deleteFrom('sessions')
      .where('expires', '<', thirtyDaysAgo.toISOString())
      .execute();
    
    // Clean up old cache entries (older than 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    await kysely
      .deleteFrom('cache_entries')
      .where('updated_at', '<', sevenDaysAgo.toISOString())
      .execute();
    
    console.log('✅ Old data cleanup completed');
  }

  static async getDatabaseStats(): Promise<Record<string, unknown>> {
    const kysely = getKysely();
    
    try {
      const [pageCount, pageSize, freelistCount, cacheSize] = await Promise.all([
        kysely.raw('PRAGMA page_count').execute(),
        kysely.raw('PRAGMA page_size').execute(),
        kysely.raw('PRAGMA freelist_count').execute(),
        kysely.raw('PRAGMA cache_size').execute()
      ]);

      const dbSize = (pageCount as any).value * (pageSize as any).value;
      const freePages = (freelistCount as any).value;
      const usedPages = (pageCount as any).value - freePages;
      const usedSize = usedPages * (pageSize as any).value;

      return {
        totalSize: dbSize,
        usedSize: usedSize,
        freeSize: freePages * (pageSize as any).value,
        pageCount: (pageCount as any).value,
        pageSize: (pageSize as any).value,
        cacheSize: (cacheSize as any).value,
        efficiency: ((usedPages / (pageCount as any).value) * 100).toFixed(2) + '%'
      };
    } catch (error) {
      console.error('Failed to get database stats:', error);
      return {};
    }
  }
}
```

## Step 3: Security Configuration

### Security Middleware
```typescript
// src/lib/middleware/security-middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function withSecurity(headers: Record<string, string> = {}) {
  return function (handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>) {
    return async function (request: NextRequest, ...args: any[]): Promise<NextResponse> {
      const response = await handler(request, ...args);
      
      // Add security headers
      const securityHeaders = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';",
        ...headers
      };

      // Add headers to response
      Object.entries(securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    };
  };
}

// Rate limiting middleware
export function withRateLimit(limit: number, windowMs: number = 60000) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return function (handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>) {
    return async function (request: NextRequest, ...args: any[]): Promise<NextResponse> {
      const clientId = request.ip || 'unknown';
      const now = Date.now();
      
      // Clean up expired entries
      for (const [key, value] of requests.entries()) {
        if (now > value.resetTime) {
          requests.delete(key);
        }
      }

      const clientRequests = requests.get(clientId);
      
      if (!clientRequests || now > clientRequests.resetTime) {
        requests.set(clientId, { count: 1, resetTime: now + windowMs });
      } else {
        clientRequests.count++;
        
        if (clientRequests.count > limit) {
          return NextResponse.json(
            { success: false, error: 'Rate limit exceeded' },
            { status: 429 }
          );
        }
      }

      return await handler(request, ...args);
    };
  };
}
```

### Environment Variables Security
```bash
# .env.production
NODE_ENV=production
DATABASE_PATH=/app/data/dreambeesart.db

# Security
NEXTAUTH_SECRET=your-super-secret-key-here
NEXTAUTH_URL=https://yourdomain.com

# Database Security
DB_ENCRYPTION_KEY=your-database-encryption-key

# Monitoring
HEALTH_CHECK_INTERVAL=60000
METRICS_RETENTION_DAYS=30

# Performance
CACHE_SIZE=128000
MAX_BATCH_SIZE=1000
```

## Step 4: Performance Optimization

### Production Performance Service
```typescript
// src/lib/services/performance-service.ts
import { getKysely } from '../db';
import { MetricsService } from '../monitoring/metrics-service';

export class PerformanceService {
  static async optimizeQueries(): Promise<void> {
    console.log('🚀 Starting query optimization...');
    
    const kysely = getKysely();
    
    // Create additional indexes based on query patterns
    await kysely.raw(`
      -- Composite indexes for common query patterns
      CREATE INDEX IF NOT EXISTS idx_users_email_active ON users(email, active);
      CREATE INDEX IF NOT EXISTS idx_generation_history_user_status ON generation_history(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_generation_history_created_status ON generation_history(created_at, status);
      
      -- Covering indexes for frequently accessed data
      CREATE INDEX IF NOT EXISTS idx_users_profile ON users(id, name, email, image, active);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON sessions(user_id, expires, session_token);
    `).execute();
    
    console.log('✅ Query optimization completed');
  }

  static async analyzeSlowQueries(): Promise<void> {
    const slowQueries = MetricsService.getSlowQueries(1000);
    
    if (slowQueries.length > 0) {
      console.log(`⚠️ Found ${slowQueries.length} slow queries:`);
      slowQueries.forEach(query => {
        console.log(`  - ${query.query} (${query.duration}ms)`);
      });
    }
  }

  static async getPerformanceMetrics(): Promise<Record<string, unknown>> {
    const avgQueryTime = MetricsService.getAverageQueryTime();
    const errorRate = MetricsService.getErrorRate();
    const slowQueries = MetricsService.getSlowQueries(1000);
    
    return {
      averageQueryTime: avgQueryTime,
      errorRate: errorRate,
      slowQueriesCount: slowQueries.length,
      slowQueries: slowQueries.slice(0, 10) // Top 10 slowest queries
    };
  }

  static async warmupCache(): Promise<void> {
    console.log('🔥 Warming up cache...');
    
    const kysely = getKysely();
    
    // Pre-load frequently accessed data
    await Promise.all([
      kysely.selectFrom('roles').selectAll().where('active', '=', true).execute(),
      kysely.selectFrom('permissions').selectAll().execute(),
      kysely.selectFrom('users').selectAll().where('active', '=', true).limit(100).execute()
    ]);
    
    console.log('✅ Cache warmup completed');
  }
}
```

## Step 5: Monitoring and Alerting

### Production Monitoring Setup
```typescript
// src/lib/monitoring/production-monitoring.ts
import { HealthScheduler } from './health-scheduler';
import { ErrorTracker } from './error-tracker';
import { PerformanceService } from '../services/performance-service';

export class ProductionMonitoring {
  static async initialize(): Promise<void> {
    console.log('📊 Initializing production monitoring...');
    
    // Start health checks
    HealthScheduler.start(60000); // Every minute
    
    // Set up error tracking
    process.on('uncaughtException', (error) => {
      ErrorTracker.trackError(error, { source: 'uncaughtException' });
    });
    
    process.on('unhandledRejection', (reason) => {
      ErrorTracker.trackError(
        new Error(String(reason)), 
        { source: 'unhandledRejection' }
      );
    });
    
    // Schedule performance optimizations
    setInterval(async () => {
      try {
        await PerformanceService.analyzeSlowQueries();
      } catch (error) {
        console.error('Performance analysis failed:', error);
      }
    }, 300000); // Every 5 minutes
    
    // Schedule cache warmup
    setInterval(async () => {
      try {
        await PerformanceService.warmupCache();
      } catch (error) {
        console.error('Cache warmup failed:', error);
      }
    }, 1800000); // Every 30 minutes
    
    console.log('✅ Production monitoring initialized');
  }

  static async shutdown(): Promise<void> {
    console.log('🛑 Shutting down monitoring...');
    
    HealthScheduler.stop();
    
    console.log('✅ Monitoring shutdown completed');
  }
}
```

### Alerting Service
```typescript
// src/lib/services/alerting-service.ts
export class AlertingService {
  private static alertCooldowns = new Map<string, number>();
  private static cooldownMs = 300000; // 5 minutes

  static async sendAlert(
    level: 'info' | 'warning' | 'error' | 'critical',
    title: string,
    message: string,
    context?: Record<string, unknown>
  ): Promise<void> {
    const alertKey = `${level}:${title}`;
    const now = Date.now();
    
    // Check cooldown
    const lastAlert = this.alertCooldowns.get(alertKey);
    if (lastAlert && now - lastAlert < this.cooldownMs) {
      return; // Skip alert due to cooldown
    }
    
    this.alertCooldowns.set(alertKey, now);
    
    const alert = {
      level,
      title,
      message,
      context,
      timestamp: new Date().toISOString(),
      service: 'dreambeesart'
    };
    
    // Log alert
    console.log(`🚨 ALERT [${level.toUpperCase()}]: ${title}`, alert);
    
    // Here you would integrate with your alerting system
    // Examples: Slack, Discord, email, PagerDuty, etc.
    await this.sendToSlack(alert);
    await this.sendToDiscord(alert);
    await this.sendEmail(alert);
  }

  private static async sendToSlack(alert: any): Promise<void> {
    // Implement Slack webhook integration
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return;

    try {
      // Implementation here
    } catch (error) {
      console.error('Failed to send Slack alert:', error);
    }
  }

  private static async sendToDiscord(alert: any): Promise<void> {
    // Implement Discord webhook integration
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;

    try {
      // Implementation here
    } catch (error) {
      console.error('Failed to send Discord alert:', error);
    }
  }

  private static async sendEmail(alert: any): Promise<void> {
    // Implement email alert integration
    const emailConfig = {
      to: process.env.ALERT_EMAIL,
      subject: `[${alert.level.toUpperCase()}] ${alert.title}`,
      body: alert.message
    };

    if (!emailConfig.to) return;

    try {
      // Implementation here
    } catch (error) {
      console.error('Failed to send email alert:', error);
    }
  }
}
```

## Step 6: Backup and Recovery

### Backup Service
```typescript
// src/lib/services/backup-service.ts
import fs from 'fs/promises';
import path from 'path';

export class BackupService {
  private static backupDir = process.env.BACKUP_DIR || '/app/backups';

  static async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup-${timestamp}.db`;
    const backupPath = path.join(this.backupDir, backupName);
    
    // Ensure backup directory exists
    await fs.mkdir(this.backupDir, { recursive: true });
    
    // Copy database file
    const dbPath = process.env.DATABASE_PATH || '/app/data/dreambeesart.db';
    await fs.copyFile(dbPath, backupPath);
    
    console.log(`✅ Backup created: ${backupName}`);
    return backupPath;
  }

  static async restoreBackup(backupPath: string): Promise<void> {
    const dbPath = process.env.DATABASE_PATH || '/app/data/dreambeesart.db';
    
    // Stop application (this would be handled by your deployment system)
    console.log('🛑 Stopping application...');
    
    // Restore database
    await fs.copyFile(backupPath, dbPath);
    
    console.log('✅ Database restored from backup');
    
    // Restart application (this would be handled by your deployment system)
    console.log('🚀 Restarting application...');
  }

  static async cleanupOldBackups(retentionDays: number = 30): Promise<void> {
    const files = await fs.readdir(this.backupDir);
    const cutoffDate = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    
    for (const file of files) {
      if (file.startsWith('backup-') && file.endsWith('.db')) {
        const filePath = path.join(this.backupDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime.getTime() < cutoffDate) {
          await fs.unlink(filePath);
          console.log(`🗑️ Deleted old backup: ${file}`);
        }
      }
    }
  }

  static async scheduleBackups(): Promise<void> {
    // Daily backup at 2 AM
    const dailyBackup = () => {
      const now = new Date();
      const nextBackup = new Date(now);
      nextBackup.setHours(2, 0, 0, 0);
      
      if (nextBackup <= now) {
        nextBackup.setDate(nextBackup.getDate() + 1);
      }
      
      const msUntilBackup = nextBackup.getTime() - now.getTime();
      
      setTimeout(async () => {
        try {
          await this.createBackup();
          await this.cleanupOldBackups();
        } catch (error) {
          console.error('Backup failed:', error);
        }
        
        // Schedule next backup
        dailyBackup();
      }, msUntilBackup);
    };
    
    dailyBackup();
  }
}
```

## Step 7: Scaling Considerations

### Horizontal Scaling Strategy
```typescript
// src/lib/scaling/load-balancer.ts
export class LoadBalancerService {
  static async getHealthyInstances(): Promise<string[]> {
    // This would integrate with your load balancer or service discovery
    const instances = process.env.INSTANCE_URLS?.split(',') || [];
    const healthyInstances: string[] = [];
    
    for (const instance of instances) {
      try {
        const response = await fetch(`${instance}/api/health`, {
          timeout: 5000
        });
        
        if (response.ok) {
          healthyInstances.push(instance);
        }
      } catch (error) {
        console.warn(`Instance ${instance} is unhealthy:`, error);
      }
    }
    
    return healthyInstances;
  }

  static async distributeLoad(): Promise<string> {
    const healthyInstances = await this.getHealthyInstances();
    
    if (healthyInstances.length === 0) {
      throw new Error('No healthy instances available');
    }
    
    // Simple round-robin load balancing
    const randomIndex = Math.floor(Math.random() * healthyInstances.length);
    return healthyInstances[randomIndex];
  }
}
```

### Database Sharding (if needed)
```typescript
// src/lib/scaling/database-sharding.ts
export class DatabaseShardingService {
  private static shards = new Map<string, any>();

  static async initializeShards(): Promise<void> {
    const shardCount = parseInt(process.env.DATABASE_SHARD_COUNT || '1');
    
    for (let i = 0; i < shardCount; i++) {
      const shardDb = new NOORMME({
        dialect: 'sqlite',
        connection: {
          database: `/app/data/shard-${i}.db`
        }
      });
      
      await shardDb.initialize();
      this.shards.set(`shard-${i}`, shardDb);
    }
  }

  static getShard(userId: string): any {
    // Simple hash-based sharding
    const hash = this.hashString(userId);
    const shardIndex = hash % this.shards.size;
    return this.shards.get(`shard-${shardIndex}`);
  }

  private static hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}
```

## Step 8: Deployment Scripts

### Production Deployment Script
```bash
#!/bin/bash
# deploy.sh

set -e

echo "🚀 Starting production deployment..."

# Build the application
echo "📦 Building application..."
npm run build

# Run database migrations
echo "🗄️ Running database migrations..."
npm run db:migrate

# Apply production optimizations
echo "⚡ Applying production optimizations..."
npm run db:optimize

# Create backup before deployment
echo "💾 Creating backup..."
npm run backup:create

# Deploy with Docker
echo "🐳 Deploying with Docker..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for health check
echo "🏥 Waiting for health check..."
sleep 30

# Verify deployment
echo "✅ Verifying deployment..."
curl -f http://localhost:3000/api/health || exit 1

echo "🎉 Deployment completed successfully!"
```

### Health Check Script
```bash
#!/bin/bash
# health-check.sh

ENDPOINT="http://localhost:3000/api/health"
MAX_ATTEMPTS=30
ATTEMPT=1

echo "🏥 Checking application health..."

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo "Attempt $ATTEMPT/$MAX_ATTEMPTS..."
    
    if curl -f -s "$ENDPOINT" > /dev/null; then
        echo "✅ Application is healthy!"
        exit 0
    fi
    
    echo "⏳ Waiting 10 seconds..."
    sleep 10
    ATTEMPT=$((ATTEMPT + 1))
done

echo "❌ Health check failed after $MAX_ATTEMPTS attempts"
exit 1
```

## Common Issues and Solutions

### Issue: Database Locking
- **Problem**: SQLite database locked errors
- **Solution**: Implement proper connection pooling and retry logic

### Issue: Memory Usage
- **Problem**: High memory consumption
- **Solution**: Optimize cache settings and implement memory monitoring

### Issue: Slow Queries
- **Problem**: Performance degradation
- **Solution**: Add indexes and optimize query patterns

### Issue: Backup Failures
- **Problem**: Backup process failing
- **Solution**: Implement retry logic and monitoring

## Best Practices

1. **Regular Backups**: Implement automated daily backups
2. **Health Monitoring**: Continuous health checks and alerting
3. **Performance Monitoring**: Track and optimize slow queries
4. **Security**: Implement proper security headers and rate limiting
5. **Scaling**: Plan for horizontal scaling if needed
6. **Maintenance**: Regular database maintenance and optimization
7. **Documentation**: Keep deployment and operations documentation updated

## Next Steps

Once production deployment is configured, proceed to [14-troubleshooting.md](./14-troubleshooting.md) for common issues and solutions.
