# 10 - Monitoring and Health Checks

This guide covers implementing database health checks and monitoring for Noormme-based applications.

## Overview

We'll implement:
- Database health monitoring
- Performance metrics collection
- Error tracking and alerting
- System status endpoints
- Automated health checks
- Monitoring dashboards

## Step 1: Health Check Service

### Database Health Service
```typescript
// src/lib/monitoring/health-service.ts
import { getRepository, getKysely } from '../db';
import { dbCache } from '../cache/db-cache';
import type { HealthStatus, HealthCheck, SystemMetrics } from './types';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: Record<string, HealthCheck>;
  metrics: SystemMetrics;
}

export interface HealthCheck {
  status: 'pass' | 'fail' | 'warn';
  message: string;
  duration: number;
  details?: Record<string, unknown>;
}

export interface SystemMetrics {
  database: {
    connectionStatus: string;
    queryCount: number;
    avgQueryTime: number;
    errorCount: number;
  };
  cache: {
    hitRate: number;
    size: number;
    memoryUsage: number;
  };
  system: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

export class HealthService {
  private static startTime = Date.now();

  static async performHealthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      const [databaseCheck, cacheCheck, systemCheck] = await Promise.all([
        this.checkDatabase(),
        this.checkCache(),
        this.checkSystem()
      ]);

      const checks = {
        database: databaseCheck,
        cache: cacheCheck,
        system: systemCheck
      };

      const overallStatus = this.determineOverallStatus(checks);
      const metrics = await this.collectMetrics();

      return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        checks,
        metrics
      };
    } catch (error) {
      console.error('Health check failed:', error);
      
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          healthService: {
            status: 'fail',
            message: 'Health check service failed',
            duration: Date.now() - startTime,
            details: {
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        },
        metrics: await this.collectMetrics()
      };
    }
  }

  private static async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Test basic connectivity
      const kysely = getKysely();
      await kysely.selectFrom('users').select('id').limit(1).execute();

      // Test repository access
      const userRepo = getRepository('users');
      await userRepo.findAll();

      // Test complex query
      await kysely
        .selectFrom('users')
        .leftJoin('user_roles', 'user_roles.user_id', 'users.id')
        .leftJoin('roles', 'roles.id', 'user_roles.role_id')
        .select(['users.id', 'roles.name'])
        .limit(1)
        .execute();

      const duration = Date.now() - startTime;
      
      return {
        status: duration < 1000 ? 'pass' : duration < 3000 ? 'warn' : 'fail',
        message: `Database connection healthy (${duration}ms)`,
        duration,
        details: {
          queryTime: duration,
          connectionType: 'sqlite'
        }
      };
    } catch (error) {
      return {
        status: 'fail',
        message: 'Database connection failed',
        duration: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  private static async checkCache(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Test cache operations
      const testKey = 'health-check-test';
      const testValue = { timestamp: Date.now() };
      
      await dbCache.set(testKey, testValue, 60);
      const retrieved = await dbCache.get(testKey);
      await dbCache.delete(testKey);

      if (!retrieved || retrieved.timestamp !== testValue.timestamp) {
        return {
          status: 'fail',
          message: 'Cache read/write test failed',
          duration: Date.now() - startTime
        };
      }

      const stats = await dbCache.getStats();
      const duration = Date.now() - startTime;
      
      return {
        status: 'pass',
        message: `Cache operational (${duration}ms)`,
        duration,
        details: {
          hitRate: stats.hitRate,
          size: stats.size,
          memoryUsage: stats.memoryUsage
        }
      };
    } catch (error) {
      return {
        status: 'fail',
        message: 'Cache system failed',
        duration: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  private static async checkSystem(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const uptime = Date.now() - this.startTime;
      const memoryUsage = process.memoryUsage();
      
      const duration = Date.now() - startTime;
      
      return {
        status: 'pass',
        message: `System operational (${duration}ms)`,
        duration,
        details: {
          uptime,
          memoryUsage: {
            rss: memoryUsage.rss,
            heapTotal: memoryUsage.heapTotal,
            heapUsed: memoryUsage.heapUsed,
            external: memoryUsage.external
          },
          nodeVersion: process.version,
          platform: process.platform
        }
      };
    } catch (error) {
      return {
        status: 'fail',
        message: 'System check failed',
        duration: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  private static determineOverallStatus(checks: Record<string, HealthCheck>): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(checks).map(check => check.status);
    
    if (statuses.includes('fail')) {
      return 'unhealthy';
    }
    
    if (statuses.includes('warn')) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  private static async collectMetrics(): Promise<SystemMetrics> {
    try {
      const [databaseMetrics, cacheStats] = await Promise.all([
        this.getDatabaseMetrics(),
        dbCache.getStats()
      ]);

      const memoryUsage = process.memoryUsage();

      return {
        database: databaseMetrics,
        cache: {
          hitRate: cacheStats.hitRate,
          size: cacheStats.size,
          memoryUsage: cacheStats.memoryUsage
        },
        system: {
          uptime: Date.now() - this.startTime,
          memoryUsage: memoryUsage.heapUsed,
          cpuUsage: process.cpuUsage().user / 1000000 // Convert to seconds
        }
      };
    } catch (error) {
      console.error('Failed to collect metrics:', error);
      return {
        database: {
          connectionStatus: 'unknown',
          queryCount: 0,
          avgQueryTime: 0,
          errorCount: 0
        },
        cache: {
          hitRate: 0,
          size: 0,
          memoryUsage: 0
        },
        system: {
          uptime: Date.now() - this.startTime,
          memoryUsage: 0,
          cpuUsage: 0
        }
      };
    }
  }

  private static async getDatabaseMetrics(): Promise<SystemMetrics['database']> {
    try {
      const kysely = getKysely();
      
      // Get basic database info
      const userCount = await kysely
        .selectFrom('users')
        .select(kysely.fn.count('id').as('count'))
        .executeTakeFirst();

      const generationCount = await kysely
        .selectFrom('generation_history')
        .select(kysely.fn.count('id').as('count'))
        .executeTakeFirst();

      return {
        connectionStatus: 'connected',
        queryCount: Number(userCount?.count || 0) + Number(generationCount?.count || 0),
        avgQueryTime: 0, // Would need query logging to calculate
        errorCount: 0 // Would need error tracking to calculate
      };
    } catch (error) {
      return {
        connectionStatus: 'error',
        queryCount: 0,
        avgQueryTime: 0,
        errorCount: 1
      };
    }
  }
}
```

## Step 2: Metrics Collection Service

### Performance Metrics Service
```typescript
// src/lib/monitoring/metrics-service.ts
import { getKysely } from '../db';

export interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: string;
  success: boolean;
  error?: string;
}

export interface SystemMetrics {
  timestamp: string;
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
  cacheHitRate: number;
  queryCount: number;
  errorCount: number;
}

export class MetricsService {
  private static metrics: QueryMetrics[] = [];
  private static maxMetrics = 1000; // Keep last 1000 queries

  static recordQuery(query: string, duration: number, success: boolean, error?: string): void {
    const metric: QueryMetrics = {
      query: query.substring(0, 100), // Truncate long queries
      duration,
      timestamp: new Date().toISOString(),
      success,
      error
    };

    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  static getQueryMetrics(limit: number = 100): QueryMetrics[] {
    return this.metrics.slice(-limit);
  }

  static getAverageQueryTime(): number {
    if (this.metrics.length === 0) return 0;
    
    const totalTime = this.metrics.reduce((sum, metric) => sum + metric.duration, 0);
    return totalTime / this.metrics.length;
  }

  static getSlowQueries(threshold: number = 1000): QueryMetrics[] {
    return this.metrics.filter(metric => metric.duration > threshold);
  }

  static getErrorRate(): number {
    if (this.metrics.length === 0) return 0;
    
    const errorCount = this.metrics.filter(metric => !metric.success).length;
    return (errorCount / this.metrics.length) * 100;
  }

  static async getDatabaseSize(): Promise<number> {
    try {
      const kysely = getKysely();
      
      // SQLite doesn't have a direct way to get database size,
      // but we can estimate from table sizes
      const tables = ['users', 'sessions', 'accounts', 'roles', 'permissions', 'generation_history'];
      let totalRows = 0;

      for (const table of tables) {
        try {
          const result = await kysely
            .selectFrom(table as any)
            .select(kysely.fn.count('*').as('count'))
            .executeTakeFirst();
          
          totalRows += Number(result?.count || 0);
        } catch (error) {
          // Table might not exist, skip it
          console.warn(`Table ${table} not found or accessible`);
        }
      }

      return totalRows;
    } catch (error) {
      console.error('Failed to get database size:', error);
      return 0;
    }
  }

  static async getTableSizes(): Promise<Record<string, number>> {
    try {
      const kysely = getKysely();
      const tables = ['users', 'sessions', 'accounts', 'roles', 'permissions', 'generation_history'];
      const sizes: Record<string, number> = {};

      for (const table of tables) {
        try {
          const result = await kysely
            .selectFrom(table as any)
            .select(kysely.fn.count('*').as('count'))
            .executeTakeFirst();
          
          sizes[table] = Number(result?.count || 0);
        } catch (error) {
          sizes[table] = 0;
        }
      }

      return sizes;
    } catch (error) {
      console.error('Failed to get table sizes:', error);
      return {};
    }
  }

  static clearMetrics(): void {
    this.metrics = [];
  }
}
```

## Step 3: Health Check API Routes

### Health Check Endpoint
```typescript
// src/app/api/health/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { HealthService } from '@/lib/monitoring/health-service';
import { MetricsService } from '@/lib/monitoring/metrics-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';

    const health = await HealthService.performHealthCheck();

    const response = {
      status: health.status,
      timestamp: health.timestamp,
      checks: health.checks,
      ...(detailed && {
        metrics: health.metrics,
        queryMetrics: MetricsService.getQueryMetrics(50),
        averageQueryTime: MetricsService.getAverageQueryTime(),
        errorRate: MetricsService.getErrorRate()
      })
    };

    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;

    return NextResponse.json(response, { status: statusCode });
  } catch (error) {
    console.error('Health check endpoint error:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 });
  }
}
```

### Metrics Endpoint
```typescript
// src/app/api/admin/metrics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/middleware/rbac-middleware';
import { MetricsService } from '@/lib/monitoring/metrics-service';
import { HealthService } from '@/lib/monitoring/health-service';

export const GET = requireAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';
    const limit = parseInt(searchParams.get('limit') || '100');

    let metrics;

    switch (type) {
      case 'queries':
        metrics = {
          recentQueries: MetricsService.getQueryMetrics(limit),
          slowQueries: MetricsService.getSlowQueries(1000),
          averageQueryTime: MetricsService.getAverageQueryTime(),
          errorRate: MetricsService.getErrorRate()
        };
        break;

      case 'database':
        metrics = {
          tableSizes: await MetricsService.getTableSizes(),
          totalRecords: await MetricsService.getDatabaseSize()
        };
        break;

      case 'system':
        const health = await HealthService.performHealthCheck();
        metrics = health.metrics;
        break;

      default:
        metrics = {
          queryMetrics: {
            recentQueries: MetricsService.getQueryMetrics(50),
            slowQueries: MetricsService.getSlowQueries(1000),
            averageQueryTime: MetricsService.getAverageQueryTime(),
            errorRate: MetricsService.getErrorRate()
          },
          database: {
            tableSizes: await MetricsService.getTableSizes(),
            totalRecords: await MetricsService.getDatabaseSize()
          },
          system: (await HealthService.performHealthCheck()).metrics
        };
    }

    return NextResponse.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Metrics endpoint error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});

export const DELETE = requireAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    switch (type) {
      case 'queries':
        MetricsService.clearMetrics();
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid metrics type to clear' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: `Metrics ${type} cleared successfully`
    });
  } catch (error) {
    console.error('Clear metrics error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clear metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});
```

## Step 4: Database Query Monitoring

### Query Interceptor
```typescript
// src/lib/monitoring/query-interceptor.ts
import { MetricsService } from './metrics-service';

export class QueryInterceptor {
  static wrapKyselyQuery(originalQuery: any) {
    return new Proxy(originalQuery, {
      get(target, prop) {
        if (prop === 'execute' || prop === 'executeTakeFirst' || prop === 'executeTakeFirstOrThrow') {
          return async function (...args: any[]) {
            const startTime = Date.now();
            let success = true;
            let error: string | undefined;

            try {
              const result = await target[prop].apply(target, args);
              return result;
            } catch (err) {
              success = false;
              error = err instanceof Error ? err.message : 'Unknown error';
              throw err;
            } finally {
              const duration = Date.now() - startTime;
              const query = target.toString();
              
              MetricsService.recordQuery(query, duration, success, error);
            }
          };
        }

        return target[prop];
      }
    });
  }

  static wrapRepositoryMethod(originalMethod: any, methodName: string) {
    return async function (...args: any[]) {
      const startTime = Date.now();
      let success = true;
      let error: string | undefined;

      try {
        const result = await originalMethod.apply(this, args);
        return result;
      } catch (err) {
        success = false;
        error = err instanceof Error ? err.message : 'Unknown error';
        throw err;
      } finally {
        const duration = Date.now() - startTime;
        const query = `Repository.${methodName}`;
        
        MetricsService.recordQuery(query, duration, success, error);
      }
    };
  }
}
```

## Step 5: Automated Health Checks

### Health Check Scheduler
```typescript
// src/lib/monitoring/health-scheduler.ts
import { HealthService } from './health-service';
import { MetricsService } from './metrics-service';

export class HealthScheduler {
  private static intervalId: NodeJS.Timeout | null = null;
  private static healthHistory: Array<{ timestamp: string; status: string }> = [];
  private static maxHistory = 100;

  static start(intervalMs: number = 60000): void {
    if (this.intervalId) {
      console.log('Health scheduler already running');
      return;
    }

    console.log(`Starting health checks every ${intervalMs}ms`);
    
    this.intervalId = setInterval(async () => {
      try {
        const health = await HealthService.performHealthCheck();
        
        // Store health status
        this.healthHistory.push({
          timestamp: health.timestamp,
          status: health.status
        });

        // Keep only recent history
        if (this.healthHistory.length > this.maxHistory) {
          this.healthHistory = this.healthHistory.slice(-this.maxHistory);
        }

        // Log health status
        if (health.status !== 'healthy') {
          console.warn(`Health check failed: ${health.status}`, health.checks);
        }

        // Alert on consecutive failures
        await this.checkForAlerts();
      } catch (error) {
        console.error('Health check scheduler error:', error);
      }
    }, intervalMs);
  }

  static stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Health scheduler stopped');
    }
  }

  static getHealthHistory(): Array<{ timestamp: string; status: string }> {
    return [...this.healthHistory];
  }

  private static async checkForAlerts(): Promise<void> {
    const recentFailures = this.healthHistory
      .slice(-5) // Check last 5 health checks
      .filter(h => h.status !== 'healthy');

    if (recentFailures.length >= 3) {
      console.error('ALERT: Multiple consecutive health check failures detected');
      // Here you could send alerts to monitoring systems
      // await this.sendAlert('Health check failures', recentFailures);
    }
  }

  private static async sendAlert(title: string, details: any): Promise<void> {
    // Implement alerting logic here
    // This could send emails, Slack messages, or webhooks
    console.log(`ALERT: ${title}`, details);
  }
}
```

## Step 6: Monitoring Dashboard API

### Dashboard Data Endpoint
```typescript
// src/app/api/admin/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/middleware/rbac-middleware';
import { HealthService } from '@/lib/monitoring/health-service';
import { MetricsService } from '@/lib/monitoring/metrics-service';
import { HealthScheduler } from '@/lib/monitoring/health-scheduler';
import { getKysely } from '@/lib/db';

export const GET = requireAdmin(async (request: NextRequest) => {
  try {
    const kysely = getKysely();
    
    // Get comprehensive dashboard data
    const [
      health,
      recentQueries,
      tableSizes,
      userStats,
      generationStats,
      healthHistory
    ] = await Promise.all([
      HealthService.performHealthCheck(),
      MetricsService.getQueryMetrics(20),
      MetricsService.getTableSizes(),
      getUserStatistics(kysely),
      getGenerationStatistics(kysely),
      HealthScheduler.getHealthHistory()
    ]);

    const dashboardData = {
      health: {
        current: health,
        history: healthHistory
      },
      performance: {
        queries: {
          recent: recentQueries,
          slow: MetricsService.getSlowQueries(1000),
          average: MetricsService.getAverageQueryTime(),
          errorRate: MetricsService.getErrorRate()
        },
        database: {
          tableSizes,
          totalRecords: await MetricsService.getDatabaseSize()
        }
      },
      statistics: {
        users: userStats,
        generations: generationStats
      }
    };

    return NextResponse.json({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Dashboard endpoint error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});

async function getUserStatistics(kysely: any) {
  const [totalUsers, activeUsers, newUsersToday, roleDistribution] = await Promise.all([
    kysely.selectFrom('users').select(kysely.fn.count('id').as('count')).executeTakeFirst(),
    kysely.selectFrom('users').select(kysely.fn.count('id').as('count')).where('active', '=', true).executeTakeFirst(),
    kysely.selectFrom('users')
      .select(kysely.fn.count('id').as('count'))
      .where('created_at', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .executeTakeFirst(),
    kysely.selectFrom('users')
      .leftJoin('user_roles', 'user_roles.user_id', 'users.id')
      .leftJoin('roles', 'roles.id', 'user_roles.role_id')
      .select(['roles.name', kysely.fn.count('users.id').as('count')])
      .groupBy('roles.name')
      .execute()
  ]);

  return {
    total: Number(totalUsers?.count || 0),
    active: Number(activeUsers?.count || 0),
    newToday: Number(newUsersToday?.count || 0),
    roleDistribution: roleDistribution.map((r: any) => ({
      role: r.name || 'No Role',
      count: Number(r.count || 0)
    }))
  };
}

async function getGenerationStatistics(kysely: any) {
  const [totalGenerations, todayGenerations, statusDistribution, avgProcessingTime] = await Promise.all([
    kysely.selectFrom('generation_history').select(kysely.fn.count('id').as('count')).executeTakeFirst(),
    kysely.selectFrom('generation_history')
      .select(kysely.fn.count('id').as('count'))
      .where('created_at', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .executeTakeFirst(),
    kysely.selectFrom('generation_history')
      .select(['status', kysely.fn.count('id').as('count')])
      .groupBy('status')
      .execute(),
    kysely.selectFrom('generation_history')
      .select(kysely.fn.avg('processing_time').as('avg_time'))
      .executeTakeFirst()
  ]);

  return {
    total: Number(totalGenerations?.count || 0),
    today: Number(todayGenerations?.count || 0),
    statusDistribution: statusDistribution.map((s: any) => ({
      status: s.status,
      count: Number(s.count || 0)
    })),
    avgProcessingTime: Number(avgProcessingTime?.avg_time || 0)
  };
}
```

## Step 7: Error Tracking

### Error Tracking Service
```typescript
// src/lib/monitoring/error-tracker.ts
export interface ErrorEvent {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info';
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  userId?: string;
  requestId?: string;
}

export class ErrorTracker {
  private static errors: ErrorEvent[] = [];
  private static maxErrors = 500;

  static trackError(
    error: Error,
    context?: Record<string, unknown>,
    userId?: string,
    requestId?: string
  ): void {
    const errorEvent: ErrorEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level: 'error',
      message: error.message,
      stack: error.stack,
      context,
      userId,
      requestId
    };

    this.errors.push(errorEvent);

    // Keep only recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // Log to console
    console.error('Error tracked:', errorEvent);
  }

  static trackWarning(
    message: string,
    context?: Record<string, unknown>,
    userId?: string
  ): void {
    const warningEvent: ErrorEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      context,
      userId
    };

    this.errors.push(warningEvent);

    console.warn('Warning tracked:', warningEvent);
  }

  static getRecentErrors(limit: number = 50): ErrorEvent[] {
    return this.errors
      .filter(e => e.level === 'error')
      .slice(-limit);
  }

  static getErrorRate(): number {
    const last24Hours = Date.now() - 24 * 60 * 60 * 1000;
    const recentErrors = this.errors.filter(
      e => new Date(e.timestamp).getTime() > last24Hours && e.level === 'error'
    );

    // This is a simplified error rate calculation
    // In production, you'd want more sophisticated metrics
    return recentErrors.length;
  }

  static clearErrors(): void {
    this.errors = [];
  }
}
```

## Step 8: Testing Monitoring System

### Monitoring Tests
```typescript
// src/lib/__tests__/monitoring.test.ts
import { HealthService, MetricsService, ErrorTracker } from '../monitoring';
import { initializeDatabase } from '../db';

describe('Monitoring System Tests', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  describe('Health Service', () => {
    test('should perform health check', async () => {
      const health = await HealthService.performHealthCheck();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('checks');
      expect(health).toHaveProperty('metrics');
      
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
    });

    test('should check database connectivity', async () => {
      const health = await HealthService.performHealthCheck();
      
      expect(health.checks).toHaveProperty('database');
      expect(['pass', 'fail', 'warn']).toContain(health.checks.database.status);
    });
  });

  describe('Metrics Service', () => {
    test('should record query metrics', () => {
      MetricsService.recordQuery('SELECT * FROM users', 100, true);
      MetricsService.recordQuery('SELECT * FROM roles', 200, false, 'Connection failed');
      
      const metrics = MetricsService.getQueryMetrics();
      expect(metrics).toHaveLength(2);
      
      const averageTime = MetricsService.getAverageQueryTime();
      expect(averageTime).toBe(150);
      
      const errorRate = MetricsService.getErrorRate();
      expect(errorRate).toBe(50);
    });

    test('should get slow queries', () => {
      MetricsService.recordQuery('Slow query', 2000, true);
      
      const slowQueries = MetricsService.getSlowQueries(1000);
      expect(slowQueries).toHaveLength(1);
      expect(slowQueries[0].duration).toBe(2000);
    });
  });

  describe('Error Tracker', () => {
    test('should track errors', () => {
      const error = new Error('Test error');
      ErrorTracker.trackError(error, { userId: 'test-user' });
      
      const recentErrors = ErrorTracker.getRecentErrors();
      expect(recentErrors).toHaveLength(1);
      expect(recentErrors[0].message).toBe('Test error');
    });

    test('should track warnings', () => {
      ErrorTracker.trackWarning('Test warning', { context: 'test' });
      
      const recentErrors = ErrorTracker.getRecentErrors();
      expect(recentErrors).toHaveLength(0); // Only errors, not warnings
    });
  });
});
```

## Common Issues and Solutions

### Issue: Health Check Performance
- **Problem**: Health checks taking too long
- **Solution**: Optimize queries and add timeouts

### Issue: Metrics Memory Usage
- **Problem**: Metrics consuming too much memory
- **Solution**: Implement metrics rotation and limits

### Issue: False Alerts
- **Problem**: Too many false positive alerts
- **Solution**: Implement alert thresholds and cooldowns

## Best Practices

1. **Regular Health Checks**: Schedule health checks at appropriate intervals
2. **Comprehensive Metrics**: Track both system and application metrics
3. **Alert Thresholds**: Set meaningful thresholds for alerts
4. **Error Context**: Include relevant context in error tracking
5. **Performance Impact**: Ensure monitoring doesn't impact performance
6. **Data Retention**: Implement appropriate data retention policies

## Next Steps

Once monitoring is implemented, proceed to [11-data-migration.md](./11-data-migration.md) to migrate data from PostgreSQL to SQLite.
