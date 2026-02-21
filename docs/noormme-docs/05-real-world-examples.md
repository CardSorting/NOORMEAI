# Real-World Examples

This guide shows real-world implementations of Noormme in production applications, specifically from the DreamBeesArt application.

## NextAuth Integration

### Custom Adapter Implementation

```typescript
// src/lib/auth/noormme-adapter.ts
import type { Adapter } from 'next-auth/adapters';
import { db } from '../db/noormme';

export function NoormmeAdapter(): Adapter {
  return {
    async createUser(user: Omit<AdapterUser, 'id'>) {
      const userRepo = db.getRepository('users');
      
      const userData = {
        id: crypto.randomUUID(),
        name: user.name,
        email: user.email || '',
        email_verified: user.emailVerified ? user.emailVerified.toISOString() : null,
        image: user.image,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const createdUser = await userRepo.create(userData) as Record<string, unknown>;

      return {
        id: createdUser.id as string,
        name: createdUser.name as string | null,
        email: createdUser.email as string,
        emailVerified: createdUser.email_verified ? new Date(createdUser.email_verified as string) : null,
        image: createdUser.image as string | null,
      };
    },

    async getUser(id: string) {
      const userRepo = db.getRepository('users');
      const user = await userRepo.findById(id) as Record<string, unknown> | null;
      
      if (!user) return null;

      return {
        id: user.id as string,
        name: user.name as string | null,
        email: user.email as string,
        emailVerified: user.email_verified ? new Date(user.email_verified as string) : null,
        image: user.image as string | null,
      };
    },

    async getUserByEmail(email: string) {
      const userRepo = db.getRepository('users');
      const users = await userRepo.findManyByEmail(email) as Record<string, unknown>[] | null;
      
      if (!users || users.length === 0) return null;
      const user = users[0] as Record<string, unknown>;

      return {
        id: user.id as string,
        name: user.name as string | null,
        email: user.email as string,
        emailVerified: user.email_verified ? new Date(user.email_verified as string) : null,
        image: user.image as string | null,
      };
    },

    async getUserByAccount({ providerAccountId, provider }) {
      const kysely = db.getKysely();
      
      const result = await kysely
        .selectFrom('accounts')
        .innerJoin('users', 'users.id', 'accounts.user_id')
        .selectAll('users')
        .where('accounts.provider', '=', provider)
        .where('accounts.provider_account_id', '=', providerAccountId)
        .executeTakeFirst();

      if (!result) return null;

      return {
        id: result.id,
        name: result.name,
        email: result.email,
        emailVerified: result.email_verified ? new Date(result.email_verified) : null,
        image: result.image,
      };
    },

    async updateUser(user) {
      const userRepo = db.getRepository('users');
      
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };
      
      if (user.name !== undefined) updateData.name = user.name;
      if (user.email !== undefined) updateData.email = user.email;
      if (user.emailVerified !== undefined) updateData.email_verified = user.emailVerified?.toISOString() || null;
      if (user.image !== undefined) updateData.image = user.image;

      const updatedUser = await userRepo.update(user.id, updateData);

      return {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        emailVerified: updatedUser.email_verified ? new Date(updatedUser.email_verified) : null,
        image: updatedUser.image,
      };
    },

    async deleteUser(userId) {
      const kysely = db.getKysely();
      
      // Delete related records first (foreign key constraints)
      await kysely.deleteFrom('sessions').where('user_id', '=', userId).execute();
      await kysely.deleteFrom('accounts').where('user_id', '=', userId).execute();
      await kysely.deleteFrom('generation_history').where('user_id', '=', userId).execute();
      await kysely.deleteFrom('user_preferences').where('user_id', '=', userId).execute();
      await kysely.deleteFrom('api_keys').where('user_id', '=', userId).execute();
      await kysely.deleteFrom('user_roles').where('user_id', '=', userId).execute();
      
      // Delete user
      await kysely.deleteFrom('users').where('id', '=', userId).execute();
    },

    async linkAccount(account) {
      const kysely = db.getKysely();
      
      const accountData = {
        id: crypto.randomUUID(),
        user_id: account.userId,
        type: account.type,
        provider: account.provider,
        provider_account_id: account.providerAccountId,
        refresh_token: account.refresh_token,
        access_token: account.access_token,
        expires_at: account.expires_at,
        token_type: account.token_type,
        scope: account.scope,
        id_token: account.id_token,
        session_state: account.session_state,
      };

      await kysely.insertInto('accounts').values(accountData).execute();

      return account;
    },

    async unlinkAccount({ providerAccountId, provider }) {
      const kysely = db.getKysely();
      
      await kysely
        .deleteFrom('accounts')
        .where('provider', '=', provider)
        .where('provider_account_id', '=', providerAccountId)
        .execute();
    },

    async createSession(session) {
      const kysely = db.getKysely();
      
      const sessionData = {
        session_token: session.sessionToken,
        user_id: session.userId,
        expires: session.expires.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await kysely.insertInto('sessions').values(sessionData).execute();

      return session;
    },

    async getSessionAndUser(sessionToken) {
      const kysely = db.getKysely();
      
      const result = await kysely
        .selectFrom('sessions')
        .innerJoin('users', 'users.id', 'sessions.user_id')
        .selectAll('users')
        .select('sessions.session_token', 'sessions.expires')
        .where('sessions.session_token', '=', sessionToken)
        .executeTakeFirst();

      if (!result) return null;

      return {
        session: {
          sessionToken: result.session_token,
          userId: result.id,
          expires: new Date(result.expires),
        },
        user: {
          id: result.id,
          name: result.name,
          email: result.email,
          emailVerified: result.email_verified ? new Date(result.email_verified) : null,
          image: result.image,
        },
      };
    },

    async updateSession(session) {
      const kysely = db.getKysely();
      
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };
      
      if (session.expires !== undefined) updateData.expires = session.expires.toISOString();
      if (session.userId !== undefined) updateData.user_id = session.userId;

      await kysely
        .updateTable('sessions')
        .set(updateData)
        .where('session_token', '=', session.sessionToken)
        .execute();

      return session;
    },

    async deleteSession(sessionToken) {
      const kysely = db.getKysely();
      
      await kysely
        .deleteFrom('sessions')
        .where('session_token', '=', sessionToken)
        .execute();
    },

    async createVerificationToken(token) {
      const kysely = db.getKysely();
      
      const tokenData = {
        identifier: token.identifier,
        token: token.token,
        expires: token.expires.toISOString(),
      };

      await kysely.insertInto('verification_tokens').values(tokenData).execute();

      return token;
    },

    async useVerificationToken({ identifier, token }) {
      const kysely = db.getKysely();
      
      const result = await kysely
        .selectFrom('verification_tokens')
        .selectAll()
        .where('identifier', '=', identifier)
        .where('token', '=', token)
        .executeTakeFirst();

      if (!result) return null;

      // Delete the token after use
      await kysely
        .deleteFrom('verification_tokens')
        .where('identifier', '=', identifier)
        .where('token', '=', token)
        .execute();

      return {
        identifier: result.identifier,
        token: result.token,
        expires: new Date(result.expires),
      };
    },
  };
}
```

### Auth Configuration

```typescript
// src/lib/auth.ts
import { NoormmeAdapter } from './auth/noormme-adapter'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import { getUserPermissions } from '@/lib/rbac'

export const authOptions = {
  adapter: NoormmeAdapter(),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt' as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signOut: '/auth/signout',
  },
  callbacks: {
    async jwt({ token, user, account, trigger }) {
      // Only fetch permissions on initial sign in or when explicitly triggered
      if (user && (trigger === 'signIn' || account)) {
        token.id = user.id

        // Add roles and permissions to token (only on initial sign-in)
        try {
          const userPerms = await getUserPermissions(user.id)
          token.roles = userPerms.roles
          token.permissions = Array.from(userPerms.permissions)
        } catch (error) {
          console.error('Error fetching user permissions:', error)
          token.roles = []
          token.permissions = []
        }
      }

      // Ensure token always has these properties
      if (!token.roles) token.roles = []
      if (!token.permissions) token.permissions = []

      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.roles = token.roles as string[]
        session.user.permissions = token.permissions as string[]
      }
      return session
    },
  },
}
```

## RBAC (Role-Based Access Control) Implementation

### Permission System

```typescript
// src/lib/rbac.ts
import { db, getRepository, getKysely } from '@/lib/db';
import { randomUUID } from 'crypto';
import { CachedDatabaseService } from './cached-db';

// Permission constants
export const PERMISSIONS = {
  // User management
  USERS_VIEW: 'users:read',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',

  // Role management
  ROLES_VIEW: 'roles:read',
  ROLES_CREATE: 'roles:create',
  ROLES_UPDATE: 'roles:update',
  ROLES_DELETE: 'roles:delete',
  ROLES_ASSIGN: 'roles:assign',

  // Permission management
  PERMISSIONS_VIEW: 'permissions:read',
  PERMISSIONS_CREATE: 'permissions:create',
  PERMISSIONS_UPDATE: 'permissions:update',
  PERMISSIONS_DELETE: 'permissions:delete',

  // Task management
  TASKS_VIEW_OWN: 'tasks:read:own',
  TASKS_CREATE: 'tasks:create',
  TASKS_UPDATE: 'tasks:update',
  TASKS_DELETE: 'tasks:delete',
  TASKS_CANCEL: 'tasks:cancel',

  // Image management
  IMAGES_VIEW_OWN: 'images:read:own',
  IMAGES_CREATE: 'images:create',
  IMAGES_GENERATE: 'images:generate',
  IMAGES_UPDATE: 'images:update',
  IMAGES_DELETE: 'images:delete',
  IMAGES_DELETE_ALL: 'images:delete:all',
  IMAGES_DELETE_OWN: 'images:delete:own',
} as const;

// Role constants
export const ROLES = {
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  USER: 'user',
  GUEST: 'guest',
} as const;

// Role assignment
export async function assignRoleToUser(userId: string, roleName: string): Promise<void> {
  const rolesRepo = getRepository('roles');
  const userRolesRepo = getRepository('user_roles');
  
  const roles = await rolesRepo.findManyByName(roleName);
  if (!roles || roles.length === 0) {
    throw new Error(`Role '${roleName}' not found`);
  }
  
  const role = roles[0];
  
  // Check if user already has this role
  const existingUserRoles = await userRolesRepo.findManyByUserId(userId);
  const existingUserRole = existingUserRoles.find(ur => ur.role_id === role.id);
  
  if (!existingUserRole) {
    await userRolesRepo.create({
      id: randomUUID(),
      user_id: userId,
      role_id: role.id,
      created_at: new Date().toISOString(),
    });
  }
}

// Role removal
export async function removeRoleFromUser(userId: string, roleName: string): Promise<void> {
  const rolesRepo = getRepository('roles');
  const userRolesRepo = getRepository('user_roles');
  const kysely = getKysely();
  
  const roles = await rolesRepo.findManyByName(roleName);
  if (!roles || roles.length === 0) {
    throw new Error(`Role '${roleName}' not found`);
  }
  
  const role = roles[0];

  await kysely
    .deleteFrom('user_roles')
    .where('user_id', '=', userId)
    .where('role_id', '=', role.id)
    .execute();
}

// Role creation
export async function createRole(name: string, description?: string, isSystem: boolean = false): Promise<string> {
  const id = randomUUID();
  const rolesRepo = getRepository('roles');
  
  await rolesRepo.create({ 
    id, 
    name, 
    description,
    is_system: isSystem,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  
  return id;
}

// Permission creation
export async function createPermission(
  name: string,
  description?: string,
  isSystem: boolean = false
): Promise<string> {
  const id = randomUUID();
  const permissionsRepo = getRepository('permissions');
  
  await permissionsRepo.create({ 
    id, 
    name, 
    description,
    is_system: isSystem,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  
  return id;
}

// Permission assignment to role
export async function assignPermissionToRole(roleName: string, permissionName: string): Promise<void> {
  const rolesRepo = getRepository('roles');
  const permissionsRepo = getRepository('permissions');
  const rolePermissionsRepo = getRepository('role_permissions');
  
  const roles = await rolesRepo.findManyByName(roleName);
  const permissions = await permissionsRepo.findManyByName(permissionName);

  if (!roles || roles.length === 0) {
    throw new Error(`Role '${roleName}' not found`);
  }
  
  if (!permissions || permissions.length === 0) {
    throw new Error(`Permission '${permissionName}' not found`);
  }

  const role = roles[0];
  const permission = permissions[0];

  // Check if role already has this permission
  const existingRolePermissions = await rolePermissionsRepo.findManyByRoleId(role.id);
  const existing = existingRolePermissions.find(rp => rp.permission_id === permission.id);

  if (!existing) {
    await rolePermissionsRepo.create({
      id: randomUUID(),
      role_id: role.id,
      permission_id: permission.id,
      created_at: new Date().toISOString(),
    });
  }
}

// Get user permissions (cached)
export async function getUserPermissions(userId: string): Promise<{ roles: string[]; permissions: Set<string> }> {
  return CachedDatabaseService.getUserPermissions(userId);
}

// Check if user has role
export async function userHasRole(userId: string, roleName: string): Promise<boolean> {
  return CachedDatabaseService.userHasRole(userId, roleName);
}

// Check if user has permission
export async function userHasPermission(userId: string, permissionName: string): Promise<boolean> {
  return CachedDatabaseService.userHasPermission(userId, permissionName);
}
```

## Caching Strategy

### Intelligent Caching Service

```typescript
// src/lib/cached-db.ts
import { db, getRepository, getKysely } from './db'
import { dbCache, CacheUtils } from './db-cache'

export interface UserPermissions {
  roles: string[]
  permissions: Set<string>
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export class CachedDatabaseService {
  // User-related cached queries
  static async getUserById(userId: string): Promise<any | null> {
    const cacheKey = CacheUtils.userKey(userId, 'profile')
    const cached = await dbCache.get<any>('user-sessions', cacheKey)
    
    if (cached) return cached

    const userRepo = getRepository('users');
    const user = await userRepo.findById(userId);
    
    if (user) {
      await dbCache.set('user-sessions', cacheKey, user)
    }
    
    return user || null
  }

  static async getUserByEmail(email: string): Promise<any | null> {
    const cacheKey = `user:email:${email}`
    const cached = await dbCache.get<any>('user-sessions', cacheKey)
    
    if (cached) return cached

    const userRepo = getRepository('users');
    const users = await userRepo.findManyByEmail(email);
    const user = users && users.length > 0 ? users[0] : null;
    
    if (user) {
      await dbCache.set('user-sessions', cacheKey, user)
      // Also cache by user ID
      await dbCache.set('user-sessions', CacheUtils.userKey(user.id, 'profile'), user)
    }
    
    return user || null
  }

  // RBAC cached queries
  static async getUserRoles(userId: string): Promise<string[]> {
    const cacheKey = CacheUtils.userKey(userId, 'roles')
    const cached = await dbCache.get<string[]>('user-roles', cacheKey)
    
    if (cached) return cached

    const kysely = getKysely();
    const result = await kysely
      .selectFrom('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .select(['roles.name'])
      .where('user_roles.user_id', '=', userId)
      .execute()

    const roleNames = result.map(r => r.name)
    await dbCache.set('user-roles', cacheKey, roleNames)
    return roleNames
  }

  static async getUserPermissions(userId: string): Promise<UserPermissions> {
    const cacheKey = CacheUtils.userKey(userId, 'permissions')
    const cached = await dbCache.get<UserPermissions>('user-permissions', cacheKey)
    
    if (cached) return cached

    const kysely = getKysely();
    const result = await kysely
      .selectFrom('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .innerJoin('role_permissions', 'role_permissions.role_id', 'roles.id')
      .innerJoin('permissions', 'permissions.id', 'role_permissions.permission_id')
      .select(['roles.name as role_name', 'permissions.name as permission_name'])
      .where('user_roles.user_id', '=', userId)
      .execute()

    const roleSet = new Set<string>()
    const permissionSet = new Set<string>()

    for (const row of result) {
      roleSet.add(row.role_name)
      permissionSet.add(row.permission_name)
    }

    const userPermissions: UserPermissions = {
      roles: Array.from(roleSet),
      permissions: permissionSet,
    }

    await dbCache.set('user-permissions', cacheKey, userPermissions)
    return userPermissions
  }

  static async userHasRole(userId: string, roleName: string): Promise<boolean> {
    const roles = await this.getUserRoles(userId)
    return roles.includes(roleName)
  }

  static async userHasPermission(userId: string, permissionName: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId)
    return permissions.permissions.has(permissionName)
  }

  // Cache invalidation methods
  static async invalidateUserCache(userId: string): Promise<void> {
    await Promise.all([
      dbCache.invalidatePattern('user-sessions', new RegExp(`user:${userId}:`)),
      dbCache.invalidatePattern('user-roles', new RegExp(`user:${userId}:`)),
      dbCache.invalidatePattern('user-permissions', new RegExp(`user:${userId}:`)),
      dbCache.invalidatePattern('user-preferences', new RegExp(`user:${userId}:`)),
      dbCache.invalidatePattern('generation-history', new RegExp(`user:${userId}:`)),
    ])
  }

  static async invalidateSystemCache(): Promise<void> {
    await Promise.all([
      dbCache.clear('system-roles'),
      dbCache.clear('system-permissions'),
      dbCache.clear('ai-models'),
    ])
  }

  // Clear all caches (useful for development)
  static async clearAllCaches(): Promise<void> {
    await dbCache.clearAll()
  }
}
```

## API Route Examples

### Database Health Check

```typescript
// src/app/api/admin/database/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { healthCheck, getConnectionStats } from '@/lib/db';

export async function GET(_request: NextRequest) {
  try {
    const health = await healthCheck();
    const stats = getConnectionStats();
    
    return NextResponse.json({
      status: 'success',
      data: {
        health,
        stats,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    
    return NextResponse.json(
      {
        status: 'error',
        message: 'Database health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
```

### Session Management

```typescript
// src/app/api/session/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getKysely } from '@/lib/db';

export async function POST() {
  try {
    const kysely = getKysely();
    
    const sessionData = {
      id: crypto.randomUUID(),
      user_agent: 'web-interface',
      created_at: new Date().toISOString(),
      source: 'web-interface'
    };

    const result = await kysely
      .insertInto('sessions')
      .values(sessionData)
      .returning('id')
      .executeTakeFirst();

    return NextResponse.json({
      status: 'success',
      data: {
        sessionId: result?.id,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Session creation failed:', error);
    
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to create session',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
```

## Migration System

### Migration Runner

```typescript
// src/lib/migrations/migration-runner.ts
import { db } from '@/lib/db';
import { MigrationTracker } from './migration-tracker';
import { sql } from 'kysely';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export class MigrationRunner {
  private tracker: MigrationTracker;

  constructor() {
    this.tracker = new MigrationTracker();
  }

  async run(): Promise<void> {
    console.log('🚀 Starting database migrations...');
    
    const migrationsDir = join(process.cwd(), 'src/lib/migrations/files');
    const migrationFiles = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const migrationId = file.replace('.sql', '');
      
      // Check if migration already applied
      const isApplied = await this.tracker.isMigrationApplied(migrationId);
      if (isApplied) {
        console.log(`⏭️  Skipping ${migrationId} (already applied)`);
        continue;
      }

      console.log(`📝 Applying migration: ${migrationId}`);
      
      try {
        const sqlContent = readFileSync(join(migrationsDir, file), 'utf-8');
        await db.getKysely().executeQuery(sql.raw(sqlContent));
        await this.tracker.markMigrationAsApplied(migrationId);
        console.log(`✅ Applied migration: ${migrationId}`);
      } catch (error) {
        console.error(`❌ Failed to apply migration ${migrationId}:`, error);
        throw error;
      }
    }
    
    console.log('🎉 All migrations completed successfully!');
  }

  async status(): Promise<void> {
    const appliedMigrations = await this.tracker.getAppliedMigrations();
    console.log('📊 Migration Status:');
    console.log(`Applied migrations: ${appliedMigrations.length}`);
    appliedMigrations.forEach(migration => {
      console.log(`  ✅ ${migration.migration_id} - ${migration.applied_at}`);
    });
  }
}
```

## Best Practices

### 1. Use Repository Pattern for Simple Operations

```typescript
// Simple CRUD operations
const userRepo = getRepository('users');
const user = await userRepo.findById('123');
```

### 2. Use Kysely for Complex Queries

```typescript
// Complex joins and aggregations
const kysely = getKysely();
const result = await kysely
  .selectFrom('users')
  .innerJoin('user_roles', 'user_roles.user_id', 'users.id')
  .innerJoin('roles', 'roles.id', 'user_roles.role_id')
  .select(['users.name', 'roles.name as role_name'])
  .where('users.active', '=', true)
  .execute();
```

### 3. Implement Caching for Performance

```typescript
// Cache frequently accessed data
const cacheKey = `user:${userId}`;
const cached = await cache.get(cacheKey);
if (cached) return cached;

const user = await userRepo.findById(userId);
await cache.set(cacheKey, user);
return user;
```

### 4. Handle Errors Gracefully

```typescript
try {
  const user = await userRepo.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  return user;
} catch (error) {
  console.error('Error fetching user:', error);
  throw error;
}
```

### 5. Use Transactions for Complex Operations

```typescript
const kysely = getKysely();
await kysely.transaction().execute(async (trx) => {
  await trx.insertInto('users').values(userData).execute();
  await trx.insertInto('user_roles').values(roleData).execute();
});
```

## Next Steps

- [Configuration Reference](./06-configuration-reference.md) - Complete configuration options
- [API Reference](./07-api-reference.md) - Full API documentation
- [Troubleshooting](./08-troubleshooting.md) - Common issues and solutions
