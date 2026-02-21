# 08 - Caching Layer Migration

This guide covers migrating the caching layer from PostgreSQL-specific caching to Noormme-compatible caching.

## Overview

We'll migrate:
- Database query caching
- User session caching
- RBAC permission caching
- Cache invalidation strategies
- Performance optimization with caching

## Step 1: Understanding Noormme Caching

### Cache Architecture
```typescript
// src/lib/cache/types.ts
export interface CacheConfig {
  namespace: string;
  ttl: number; // Time to live in seconds
  maxSize?: number; // Maximum cache size
  compression?: boolean; // Enable compression
}

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  compressed?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  memoryUsage: number;
}
```

### Base Cache Service
```typescript
// src/lib/cache/base-cache.ts
import { getKysely } from '../db';
import type { CacheConfig, CacheEntry, CacheStats } from './types';

export abstract class BaseCacheService<T> {
  protected config: CacheConfig;
  protected stats: CacheStats;

  constructor(config: CacheConfig) {
    this.config = config;
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      memoryUsage: 0
    };
  }

  abstract get(key: string): Promise<T | null>;
  abstract set(key: string, value: T, ttl?: number): Promise<void>;
  abstract delete(key: string): Promise<void>;
  abstract deletePattern(pattern: string): Promise<void>;
  abstract clear(): Promise<void>;
  abstract getStats(): CacheStats;

  protected generateKey(key: string): string {
    return `${this.config.namespace}:${key}`;
  }

  protected isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl * 1000;
  }

  protected compress(value: T): string {
    if (!this.config.compression) {
      return JSON.stringify(value);
    }
    // Implement compression logic here
    return JSON.stringify(value);
  }

  protected decompress(data: string): T {
    // Implement decompression logic here
    return JSON.parse(data);
  }
}
```

## Step 2: Database Cache Implementation

### Database Cache Service
```typescript
// src/lib/cache/db-cache.ts
import { BaseCacheService } from './base-cache';
import { getKysely } from '../db';
import type { CacheConfig, CacheEntry, CacheStats } from './types';

export class DatabaseCacheService<T> extends BaseCacheService<T> {
  private kysely = getKysely();

  constructor(config: CacheConfig) {
    super(config);
  }

  async get(key: string): Promise<T | null> {
    try {
      const cacheKey = this.generateKey(key);
      
      const result = await this.kysely
        .selectFrom('cache_entries')
        .selectAll()
        .where('key', '=', cacheKey)
        .executeTakeFirst();

      if (!result) {
        this.stats.misses++;
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(result.value);
      
      if (this.isExpired(entry)) {
        await this.delete(key);
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return entry.value;
    } catch (error) {
      console.error('Cache get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const cacheKey = this.generateKey(key);
      const entryTtl = ttl || this.config.ttl;
      
      const entry: CacheEntry<T> = {
        value,
        timestamp: Date.now(),
        ttl: entryTtl * 1000
      };

      const serializedValue = this.compress(entry);

      await this.kysely
        .insertInto('cache_entries')
        .values({
          key: cacheKey,
          value: serializedValue,
          ttl: entryTtl,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .onConflict((oc) => oc.column('key').doUpdateSet({
          value: serializedValue,
          ttl: entryTtl,
          updated_at: new Date().toISOString()
        }))
        .execute();

      this.stats.size++;
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const cacheKey = this.generateKey(key);
      
      await this.kysely
        .deleteFrom('cache_entries')
        .where('key', '=', cacheKey)
        .execute();

      this.stats.size = Math.max(0, this.stats.size - 1);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      const cachePattern = this.generateKey(pattern);
      
      // SQLite LIKE pattern matching
      await this.kysely
        .deleteFrom('cache_entries')
        .where('key', 'like', cachePattern.replace('*', '%'))
        .execute();

      // Reset size counter (approximate)
      this.stats.size = await this.getCacheSize();
    } catch (error) {
      console.error('Cache delete pattern error:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      const namespacePattern = `${this.config.namespace}:%`;
      
      await this.kysely
        .deleteFrom('cache_entries')
        .where('key', 'like', namespacePattern)
        .execute();

      this.stats.size = 0;
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  async getStats(): Promise<CacheStats> {
    const totalSize = await this.getCacheSize();
    return {
      ...this.stats,
      size: totalSize
    };
  }

  private async getCacheSize(): Promise<number> {
    const namespacePattern = `${this.config.namespace}:%`;
    
    const result = await this.kysely
      .selectFrom('cache_entries')
      .select(this.kysely.fn.count('key').as('count'))
      .where('key', 'like', namespacePattern)
      .executeTakeFirst();

    return Number(result?.count || 0);
  }

  async cleanup(): Promise<void> {
    try {
      const now = Date.now();
      
      await this.kysely
        .deleteFrom('cache_entries')
        .where('updated_at', '<', new Date(now - this.config.ttl * 1000).toISOString())
        .execute();
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }
}
```

### Cache Utils
```typescript
// src/lib/cache/cache-utils.ts
export class CacheUtils {
  static userKey(userId: string, type: string): string {
    return `user:${userId}:${type}`;
  }

  static roleKey(roleId: string, type: string): string {
    return `role:${roleId}:${type}`;
  }

  static permissionKey(permissionId: string, type: string): string {
    return `permission:${permissionId}:${type}`;
  }

  static sessionKey(sessionToken: string): string {
    return `session:${sessionToken}`;
  }

  static generationKey(generationId: string, type: string): string {
    return `generation:${generationId}:${type}`;
  }

  static analyticsKey(type: string, params?: Record<string, unknown>): string {
    const paramStr = params ? `:${JSON.stringify(params)}` : '';
    return `analytics:${type}${paramStr}`;
  }

  static apiKey(endpoint: string, params?: Record<string, unknown>): string {
    const paramStr = params ? `:${JSON.stringify(params)}` : '';
    return `api:${endpoint}${paramStr}`;
  }

  static generateHash(data: unknown): string {
    // Simple hash function for cache keys
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}
```

## Step 3: Typed Cache Services

### User Cache Service
```typescript
// src/lib/cache/user-cache.ts
import { DatabaseCacheService } from './db-cache';
import { CacheUtils } from './cache-utils';
import type { DatabaseUser } from '../rbac/types';

export class UserCacheService extends DatabaseCacheService<DatabaseUser> {
  constructor() {
    super({
      namespace: 'users',
      ttl: 3600, // 1 hour
      compression: true
    });
  }

  async getUserProfile(userId: string): Promise<DatabaseUser | null> {
    const key = CacheUtils.userKey(userId, 'profile');
    return await this.get(key);
  }

  async setUserProfile(userId: string, user: DatabaseUser): Promise<void> {
    const key = CacheUtils.userKey(userId, 'profile');
    await this.set(key, user, 3600); // 1 hour TTL
  }

  async getUserRoles(userId: string): Promise<string[] | null> {
    const key = CacheUtils.userKey(userId, 'roles');
    return await this.get(key);
  }

  async setUserRoles(userId: string, roles: string[]): Promise<void> {
    const key = CacheUtils.userKey(userId, 'roles');
    await this.set(key, roles, 1800); // 30 minutes TTL
  }

  async getUserPermissions(userId: string): Promise<Array<{ resource: string; action: string }> | null> {
    const key = CacheUtils.userKey(userId, 'permissions');
    return await this.get(key);
  }

  async setUserPermissions(userId: string, permissions: Array<{ resource: string; action: string }>): Promise<void> {
    const key = CacheUtils.userKey(userId, 'permissions');
    await this.set(key, permissions, 1800); // 30 minutes TTL
  }

  async invalidateUserCache(userId: string): Promise<void> {
    const patterns = [
      CacheUtils.userKey(userId, '*'),
      `user:${userId}:*`
    ];

    for (const pattern of patterns) {
      await this.deletePattern(pattern);
    }
  }

  async checkPermission(userId: string, resource: string, action: string): Promise<boolean | null> {
    const key = CacheUtils.userKey(userId, `permission:${resource}:${action}`);
    return await this.get(key);
  }

  async setPermission(userId: string, resource: string, action: string, hasPermission: boolean): Promise<void> {
    const key = CacheUtils.userKey(userId, `permission:${resource}:${action}`);
    await this.set(key, hasPermission, 1800); // 30 minutes TTL
  }

  async invalidatePermissionCache(userId: string): Promise<void> {
    const patterns = [
      CacheUtils.userKey(userId, 'permission:*'),
      `user:${userId}:permission:*`
    ];

    for (const pattern of patterns) {
      await this.deletePattern(pattern);
    }
  }
}
```

### Session Cache Service
```typescript
// src/lib/cache/session-cache.ts
import { DatabaseCacheService } from './db-cache';
import { CacheUtils } from './cache-utils';
import type { DatabaseSession } from '../rbac/types';

export class SessionCacheService extends DatabaseCacheService<DatabaseSession> {
  constructor() {
    super({
      namespace: 'sessions',
      ttl: 86400, // 24 hours
      compression: true
    });
  }

  async getSession(sessionToken: string): Promise<DatabaseSession | null> {
    const key = CacheUtils.sessionKey(sessionToken);
    return await this.get(key);
  }

  async setSession(sessionToken: string, session: DatabaseSession): Promise<void> {
    const key = CacheUtils.sessionKey(sessionToken);
    
    // Calculate TTL based on session expiry
    const expiresAt = new Date(session.expires);
    const now = new Date();
    const ttl = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
    
    await this.set(key, session, ttl);
  }

  async deleteSession(sessionToken: string): Promise<void> {
    const key = CacheUtils.sessionKey(sessionToken);
    await this.delete(key);
  }

  async deleteUserSessions(userId: string): Promise<void> {
    const pattern = `user:${userId}:sessions:*`;
    await this.deletePattern(pattern);
  }

  async cleanupExpiredSessions(): Promise<void> {
    // This would be called by a background job
    await this.cleanup();
  }
}
```

### Analytics Cache Service
```typescript
// src/lib/cache/analytics-cache.ts
import { DatabaseCacheService } from './db-cache';
import { CacheUtils } from './cache-utils';

export interface AnalyticsData {
  type: string;
  data: unknown;
  timestamp: number;
  ttl: number;
}

export class AnalyticsCacheService extends DatabaseCacheService<AnalyticsData> {
  constructor() {
    super({
      namespace: 'analytics',
      ttl: 3600, // 1 hour
      compression: true
    });
  }

  async getAnalytics(type: string, params?: Record<string, unknown>): Promise<unknown | null> {
    const key = CacheUtils.analyticsKey(type, params);
    const cached = await this.get(key);
    return cached?.data || null;
  }

  async setAnalytics(type: string, data: unknown, ttl?: number, params?: Record<string, unknown>): Promise<void> {
    const key = CacheUtils.analyticsKey(type, params);
    const analyticsData: AnalyticsData = {
      type,
      data,
      timestamp: Date.now(),
      ttl: (ttl || this.config.ttl) * 1000
    };
    await this.set(key, analyticsData, ttl);
  }

  async invalidateAnalytics(type?: string): Promise<void> {
    if (type) {
      const pattern = CacheUtils.analyticsKey(type, undefined) + '*';
      await this.deletePattern(pattern);
    } else {
      await this.clear();
    }
  }
}
```

## Step 4: Updated Cached Database Service

### Cached Database Service with Noormme
```typescript
// src/lib/cached-db.ts
import { getRepository, getKysely } from './db';
import { userCache, sessionCache, analyticsCache } from './cache';
import type { GenerationHistory, AiModel, Role, Permission } from './db/types';

export class CachedDatabaseService {
  // User operations with caching
  static async getUserById(userId: string) {
    // Try cache first
    const cached = await userCache.getUserProfile(userId);
    if (cached) {
      return cached as Record<string, unknown>;
    }

    // Fetch from database
    const userRepo = getRepository('users');
    const user = await userRepo.findById(userId) as Record<string, unknown> | null;

    if (user) {
      // Cache the result
      await userCache.setUserProfile(userId, user as DatabaseUser);
    }

    return user;
  }

  static async getUserRoles(userId: string): Promise<string[]> {
    // Try cache first
    const cached = await userCache.getUserRoles(userId);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const kysely = getKysely();
    const userRoles = await kysely
      .selectFrom('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .select('roles.name')
      .where('user_roles.user_id', '=', userId)
      .where('roles.active', '=', true)
      .execute();

    const roles = userRoles.map(ur => ur.name);

    // Cache the result
    await userCache.setUserRoles(userId, roles);

    return roles;
  }

  static async getUserPermissions(userId: string): Promise<Array<{ resource: string; action: string }>> {
    // Try cache first
    const cached = await userCache.getUserPermissions(userId);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const kysely = getKysely();
    const permissions = await kysely
      .selectFrom('user_roles')
      .innerJoin('role_permissions', 'role_permissions.role_id', 'user_roles.role_id')
      .innerJoin('permissions', 'permissions.id', 'role_permissions.permission_id')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .select(['permissions.resource', 'permissions.action'])
      .where('user_roles.user_id', '=', userId)
      .where('roles.active', '=', true)
      .execute();

    const userPermissions = permissions.map(p => ({
      resource: p.resource,
      action: p.action
    }));

    // Cache the result
    await userCache.setUserPermissions(userId, userPermissions);

    return userPermissions;
  }

  // Generation history operations
  static async getGenerationHistory(userId: string, limit = 10): Promise<GenerationHistory[]> {
    const kysely = getKysely();
    
    const history = await kysely
      .selectFrom('generation_history')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .execute() as GenerationHistory[];

    return history;
  }

  static async createGenerationHistory(data: Omit<GenerationHistory, 'id'>): Promise<GenerationHistory> {
    const kysely = getKysely();
    
    const now = new Date().toISOString();
    const generationData = {
      ...data,
      created_at: now,
      updated_at: now
    };

    const result = await kysely
      .insertInto('generation_history')
      .values(generationData)
      .returningAll()
      .executeTakeFirst() as GenerationHistory;

    return result;
  }

  // AI Models operations
  static async getAiModels(): Promise<AiModel[]> {
    // Try cache first
    const cached = await analyticsCache.getAnalytics('ai_models');
    if (cached) {
      return cached as AiModel[];
    }

    // Fetch from database
    const kysely = getKysely();
    const models = await kysely
      .selectFrom('ai_models')
      .selectAll()
      .execute() as AiModel[];

    // Cache the result
    await analyticsCache.setAnalytics('ai_models', models, 3600); // 1 hour TTL

    return models;
  }

  // Role operations
  static async getRoles(): Promise<Role[]> {
    // Try cache first
    const cached = await analyticsCache.getAnalytics('roles');
    if (cached) {
      return cached as Role[];
    }

    // Fetch from database
    const kysely = getKysely();
    const roles = await kysely
      .selectFrom('roles')
      .selectAll()
      .where('active', '=', true)
      .execute() as Role[];

    // Cache the result
    await analyticsCache.setAnalytics('roles', roles, 1800); // 30 minutes TTL

    return roles;
  }

  // Permission operations
  static async getPermissions(): Promise<Permission[]> {
    // Try cache first
    const cached = await analyticsCache.getAnalytics('permissions');
    if (cached) {
      return cached as Permission[];
    }

    // Fetch from database
    const kysely = getKysely();
    const permissions = await kysely
      .selectFrom('permissions')
      .selectAll()
      .execute() as Permission[];

    // Cache the result
    await analyticsCache.setAnalytics('permissions', permissions, 3600); // 1 hour TTL

    return permissions;
  }

  // Cache invalidation methods
  static async invalidateUserCache(userId: string): Promise<void> {
    await userCache.invalidateUserCache(userId);
  }

  static async invalidateRoleCache(roleId: string): Promise<void> {
    await analyticsCache.invalidateAnalytics('roles');
  }

  static async invalidatePermissionCache(): Promise<void> {
    await analyticsCache.invalidateAnalytics('permissions');
  }

  static async invalidateAllCaches(): Promise<void> {
    await Promise.all([
      userCache.clear(),
      sessionCache.clear(),
      analyticsCache.clear()
    ]);
  }

  // Health check
  static async healthCheck(): Promise<{ status: string; details: Record<string, unknown> }> {
    try {
      const [userStats, sessionStats, analyticsStats] = await Promise.all([
        userCache.getStats(),
        sessionCache.getStats(),
        analyticsCache.getStats()
      ]);

      return {
        status: 'healthy',
        details: {
          userCache: userStats,
          sessionCache: sessionStats,
          analyticsCache: analyticsStats
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
}
```

## Step 5: Cache Middleware

### API Cache Middleware
```typescript
// src/lib/middleware/cache-middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { analyticsCache } from '../cache';
import { CacheUtils } from '../cache/cache-utils';

export interface CacheOptions {
  ttl?: number;
  key?: string;
  params?: Record<string, unknown>;
  skipCache?: (request: NextRequest) => boolean;
}

export function withCache(options: CacheOptions = {}) {
  return function (handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>) {
    return async function (request: NextRequest, ...args: any[]): Promise<NextResponse> {
      try {
        // Skip cache if condition is met
        if (options.skipCache && options.skipCache(request)) {
          return await handler(request, ...args);
        }

        // Generate cache key
        const endpoint = request.nextUrl.pathname;
        const params = options.params || Object.fromEntries(request.nextUrl.searchParams);
        const key = options.key || CacheUtils.apiKey(endpoint, params);

        // Try to get from cache
        const cached = await analyticsCache.getAnalytics(key);
        if (cached) {
          return NextResponse.json(cached, {
            headers: {
              'X-Cache': 'HIT',
              'X-Cache-Key': key
            }
          });
        }

        // Call handler and cache response
        const response = await handler(request, ...args);
        
        if (response.ok) {
          const data = await response.json();
          await analyticsCache.setAnalytics(key, data, options.ttl || 300); // 5 minutes default
        }

        return response.clone({
          headers: {
            ...response.headers,
            'X-Cache': 'MISS',
            'X-Cache-Key': key
          }
        });
      } catch (error) {
        console.error('Cache middleware error:', error);
        // Fallback to handler without caching
        return await handler(request, ...args);
      }
    };
  };
}

// Convenience functions
export const cacheFor5Minutes = withCache({ ttl: 300 });
export const cacheFor1Hour = withCache({ ttl: 3600 });
export const cacheFor1Day = withCache({ ttl: 86400 });

// Skip cache for authenticated requests
export const cachePublicOnly = withCache({
  skipCache: (request) => {
    const authHeader = request.headers.get('authorization');
    return !!authHeader;
  }
});
```

## Step 6: Cache Management API

### Cache Management Routes
```typescript
// src/app/api/admin/cache/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/middleware/rbac-middleware';
import { CachedDatabaseService } from '@/lib/cached-db';
import { userCache, sessionCache, analyticsCache } from '@/lib/cache';

export const GET = requireAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'stats':
        const [userStats, sessionStats, analyticsStats] = await Promise.all([
          userCache.getStats(),
          sessionCache.getStats(),
          analyticsCache.getStats()
        ]);

        return NextResponse.json({
          success: true,
          data: {
            userCache: userStats,
            sessionCache: sessionStats,
            analyticsCache: analyticsStats
          }
        });

      case 'health':
        const health = await CachedDatabaseService.healthCheck();
        return NextResponse.json({
          success: true,
          data: health
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Cache management error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get cache information',
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
    const userId = searchParams.get('userId');

    switch (type) {
      case 'user':
        if (userId) {
          await CachedDatabaseService.invalidateUserCache(userId);
        } else {
          await userCache.clear();
        }
        break;

      case 'session':
        await sessionCache.clear();
        break;

      case 'analytics':
        await analyticsCache.clear();
        break;

      case 'all':
        await CachedDatabaseService.invalidateAllCaches();
        break;

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid cache type'
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Cache ${type} cleared successfully`
    });
  } catch (error) {
    console.error('Cache clear error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clear cache',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});
```

## Step 7: Background Cache Maintenance

### Cache Cleanup Service
```typescript
// src/lib/services/cache-cleanup-service.ts
import { userCache, sessionCache, analyticsCache } from '../cache';
import { getKysely } from '../db';

export class CacheCleanupService {
  static async cleanupExpiredEntries(): Promise<void> {
    console.log('🧹 Starting cache cleanup...');
    
    try {
      await Promise.all([
        userCache.cleanup(),
        sessionCache.cleanupExpiredSessions(),
        analyticsCache.cleanup()
      ]);

      console.log('✅ Cache cleanup completed');
    } catch (error) {
      console.error('❌ Cache cleanup failed:', error);
    }
  }

  static async cleanupCacheTable(): Promise<void> {
    const kysely = getKysely();
    
    try {
      // Remove entries older than 7 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7);

      const result = await kysely
        .deleteFrom('cache_entries')
        .where('updated_at', '<', cutoffDate.toISOString())
        .execute();

      console.log(`🗑️ Cleaned up ${result.length} expired cache entries`);
    } catch (error) {
      console.error('❌ Cache table cleanup failed:', error);
    }
  }

  static async getCacheStats(): Promise<Record<string, unknown>> {
    const kysely = getKysely();
    
    try {
      const stats = await kysely
        .selectFrom('cache_entries')
        .select([
          kysely.fn.count('key').as('total_entries'),
          kysely.fn.sum('ttl').as('total_ttl'),
          kysely.fn.avg('ttl').as('avg_ttl')
        ])
        .executeTakeFirst();

      return {
        totalEntries: Number(stats?.total_entries || 0),
        totalTtl: Number(stats?.total_ttl || 0),
        avgTtl: Number(stats?.avg_ttl || 0)
      };
    } catch (error) {
      console.error('❌ Failed to get cache stats:', error);
      return {};
    }
  }
}
```

## Step 8: Testing Cache System

### Cache Test Suite
```typescript
// src/lib/__tests__/cache-system.test.ts
import { UserCacheService, SessionCacheService, AnalyticsCacheService } from '../cache';
import { CachedDatabaseService } from '../cached-db';
import { initializeDatabase } from '../db';

describe('Cache System Tests', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  describe('User Cache Service', () => {
    test('should cache user profile', async () => {
      const userCache = new UserCacheService();
      const testUser = {
        id: 'test-user-cache',
        name: 'Test User',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await userCache.setUserProfile(testUser.id, testUser);
      const cached = await userCache.getUserProfile(testUser.id);

      expect(cached).toEqual(testUser);
    });

    test('should cache user roles', async () => {
      const userCache = new UserCacheService();
      const testRoles = ['user', 'admin'];

      await userCache.setUserRoles('test-user', testRoles);
      const cached = await userCache.getUserRoles('test-user');

      expect(cached).toEqual(testRoles);
    });

    test('should invalidate user cache', async () => {
      const userCache = new UserCacheService();
      
      await userCache.setUserProfile('test-user', testUser);
      await userCache.setUserRoles('test-user', ['user']);
      
      await userCache.invalidateUserCache('test-user');
      
      const profile = await userCache.getUserProfile('test-user');
      const roles = await userCache.getUserRoles('test-user');
      
      expect(profile).toBeNull();
      expect(roles).toBeNull();
    });
  });

  describe('Cached Database Service', () => {
    test('should cache and retrieve user data', async () => {
      // Create test user
      const kysely = getKysely();
      const user = await kysely
        .insertInto('users')
        .values({
          id: 'test-cached-user',
          name: 'Cached User',
          email: 'cached@example.com',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .returningAll()
        .executeTakeFirst();

      // First call - should fetch from database
      const user1 = await CachedDatabaseService.getUserById(user!.id);
      expect(user1).toBeDefined();

      // Second call - should fetch from cache
      const user2 = await CachedDatabaseService.getUserById(user!.id);
      expect(user2).toBeDefined();

      // Cleanup
      await kysely.deleteFrom('users').where('id', '=', user!.id).execute();
    });

    test('should handle cache health check', async () => {
      const health = await CachedDatabaseService.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.details).toHaveProperty('userCache');
      expect(health.details).toHaveProperty('sessionCache');
      expect(health.details).toHaveProperty('analyticsCache');
    });
  });
});
```

## Common Issues and Solutions

### Issue: Cache Invalidation
- **Problem**: Stale data in cache after updates
- **Solution**: Implement proper cache invalidation strategies

### Issue: Memory Usage
- **Problem**: Cache growing too large
- **Solution**: Implement TTL and cleanup mechanisms

### Issue: Cache Consistency
- **Problem**: Data inconsistency between cache and database
- **Solution**: Use write-through or write-behind caching strategies

## Performance Benefits

1. **Reduced Database Load**: Frequently accessed data served from cache
2. **Faster Response Times**: Cache hits are much faster than database queries
3. **Better User Experience**: Reduced latency for common operations
4. **Scalability**: Cache reduces database connection pressure

## Next Steps

Once caching layer is migrated, proceed to [09-api-routes.md](./09-api-routes.md) to migrate API routes to use Noormme.
