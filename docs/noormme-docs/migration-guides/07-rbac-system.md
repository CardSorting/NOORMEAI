# 07 - RBAC System Migration

This guide covers migrating the role-based access control (RBAC) system from PostgreSQL to Noormme.

## Overview

We'll migrate:
- Role and permission management
- User-role assignments
- Permission checking middleware
- RBAC service layer
- Caching for RBAC queries

## Step 1: Understanding the RBAC Schema

### Database Tables
```sql
-- Roles table
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Permissions table
CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Role-permission assignments
CREATE TABLE role_permissions (
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- User-role assignments
CREATE TABLE user_roles (
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);
```

## Step 2: Type Definitions

### RBAC Types
```typescript
// src/lib/rbac/types.ts
export interface Role {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  id: string;
  name: string;
  description: string | null;
  resource: string;
  action: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRole {
  userId: string;
  roleId: string;
  role: Role;
  createdAt: Date;
}

export interface RolePermission {
  roleId: string;
  permissionId: string;
  permission: Permission;
  createdAt: Date;
}

// Database entity types
export interface DatabaseRole {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DatabasePermission {
  id: string;
  name: string;
  description: string | null;
  resource: string;
  action: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseUserRole {
  user_id: string;
  role_id: string;
  created_at: string;
}

export interface DatabaseRolePermission {
  role_id: string;
  permission_id: string;
  created_at: string;
}

// RBAC operation types
export interface CreateRoleData {
  name: string;
  description?: string;
  active?: boolean;
  permissionIds?: string[];
}

export interface UpdateRoleData {
  name?: string;
  description?: string;
  active?: boolean;
  permissionIds?: string[];
}

export interface CreatePermissionData {
  name: string;
  description?: string;
  resource: string;
  action: string;
}

export interface AssignRoleData {
  userId: string;
  roleId: string;
}

export interface CheckPermissionData {
  userId: string;
  resource: string;
  action: string;
}
```

## Step 3: RBAC Service Layer

### Role Service
```typescript
// src/lib/services/role-service.ts
import { getRepository, getKysely } from '../db';
import { roleCache } from '../cache/typed-cache';
import { CacheUtils } from '../cache/db-cache';
import type { 
  Role, 
  CreateRoleData, 
  UpdateRoleData, 
  DatabaseRole,
  DatabaseRolePermission,
  Permission
} from '../rbac/types';

export class RoleService {
  private static transformDbRole(dbRole: DatabaseRole): Role {
    return {
      id: dbRole.id,
      name: dbRole.name,
      description: dbRole.description,
      active: dbRole.active,
      permissions: [], // Will be populated separately
      createdAt: new Date(dbRole.created_at),
      updatedAt: new Date(dbRole.updated_at)
    };
  }

  private static transformToDbRole(roleData: CreateRoleData): Omit<DatabaseRole, 'id' | 'created_at' | 'updated_at'> {
    return {
      name: roleData.name,
      description: roleData.description || null,
      active: roleData.active ?? true
    };
  }

  static async getAllRoles(): Promise<Role[]> {
    const kysely = getKysely();
    
    const dbRoles = await kysely
      .selectFrom('roles')
      .selectAll()
      .where('active', '=', true)
      .execute() as DatabaseRole[];

    const roles = await Promise.all(
      dbRoles.map(async (dbRole) => {
        const role = this.transformDbRole(dbRole);
        role.permissions = await this.getRolePermissions(dbRole.id);
        return role;
      })
    );

    return roles;
  }

  static async getRoleById(id: string): Promise<Role | null> {
    // Try cache first
    const cacheKey = CacheUtils.roleKey(id, 'full');
    const cached = await roleCache.get(cacheKey);
    if (cached) {
      const role = this.transformDbRole(cached);
      role.permissions = await this.getRolePermissions(id);
      return role;
    }

    // Fetch from database
    const roleRepo = getRepository('roles');
    const dbRole = await roleRepo.findById(id) as DatabaseRole | null;
    
    if (!dbRole) {
      return null;
    }

    const role = this.transformDbRole(dbRole);
    role.permissions = await this.getRolePermissions(id);

    // Cache the result
    await roleCache.set(cacheKey, dbRole, 3600); // 1 hour TTL

    return role;
  }

  static async getRoleByName(name: string): Promise<Role | null> {
    const kysely = getKysely();
    
    const dbRole = await kysely
      .selectFrom('roles')
      .selectAll()
      .where('name', '=', name)
      .where('active', '=', true)
      .executeTakeFirst() as DatabaseRole | undefined;

    if (!dbRole) {
      return null;
    }

    const role = this.transformDbRole(dbRole);
    role.permissions = await this.getRolePermissions(dbRole.id);

    return role;
  }

  static async createRole(roleData: CreateRoleData): Promise<Role> {
    const kysely = getKysely();
    
    return await kysely.transaction().execute(async (trx) => {
      // Create role
      const now = new Date().toISOString();
      const dbRoleData = {
        ...this.transformToDbRole(roleData),
        id: crypto.randomUUID(),
        created_at: now,
        updated_at: now
      };

      await trx.insertInto('roles').values(dbRoleData).execute();

      // Assign permissions if provided
      if (roleData.permissionIds && roleData.permissionIds.length > 0) {
        const rolePermissions = roleData.permissionIds.map(permissionId => ({
          role_id: dbRoleData.id,
          permission_id: permissionId,
          created_at: now
        }));

        await trx.insertInto('role_permissions').values(rolePermissions).execute();
      }

      const role = this.transformDbRole(dbRoleData);
      role.permissions = await this.getRolePermissions(dbRoleData.id);

      // Invalidate role cache
      await roleCache.invalidateRoleCache(dbRoleData.id);

      return role;
    });
  }

  static async updateRole(id: string, updates: UpdateRoleData): Promise<Role> {
    const kysely = getKysely();
    
    return await kysely.transaction().execute(async (trx) => {
      // Update role
      const updateData: Partial<DatabaseRole> & { id: string } = {
        id,
        updated_at: new Date().toISOString(),
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.active !== undefined && { active: updates.active })
      };

      await trx.updateTable('roles').set(updateData).where('id', '=', id).execute();

      // Update permissions if provided
      if (updates.permissionIds !== undefined) {
        // Remove existing permissions
        await trx.deleteFrom('role_permissions').where('role_id', '=', id).execute();

        // Add new permissions
        if (updates.permissionIds.length > 0) {
          const rolePermissions = updates.permissionIds.map(permissionId => ({
            role_id: id,
            permission_id: permissionId,
            created_at: new Date().toISOString()
          }));

          await trx.insertInto('role_permissions').values(rolePermissions).execute();
        }
      }

      const role = await this.getRoleById(id);
      if (!role) {
        throw new Error('Role not found after update');
      }

      // Invalidate role cache
      await roleCache.invalidateRoleCache(id);

      return role;
    });
  }

  static async deleteRole(id: string): Promise<void> {
    const kysely = getKysely();
    
    await kysely.transaction().execute(async (trx) => {
      // Remove role permissions
      await trx.deleteFrom('role_permissions').where('role_id', '=', id).execute();
      
      // Remove user roles
      await trx.deleteFrom('user_roles').where('role_id', '=', id).execute();
      
      // Delete role
      await trx.deleteFrom('roles').where('id', '=', id).execute();
    });

    // Invalidate role cache
    await roleCache.invalidateRoleCache(id);
  }

  private static async getRolePermissions(roleId: string): Promise<Permission[]> {
    const kysely = getKysely();
    
    const permissions = await kysely
      .selectFrom('role_permissions')
      .innerJoin('permissions', 'permissions.id', 'role_permissions.permission_id')
      .selectAll('permissions')
      .where('role_permissions.role_id', '=', roleId)
      .execute() as DatabasePermission[];

    return permissions.map(permission => ({
      id: permission.id,
      name: permission.name,
      description: permission.description,
      resource: permission.resource,
      action: permission.action,
      createdAt: new Date(permission.created_at),
      updatedAt: new Date(permission.updated_at)
    }));
  }
}
```

### Permission Service
```typescript
// src/lib/services/permission-service.ts
import { getRepository, getKysely } from '../db';
import { permissionCache } from '../cache/typed-cache';
import { CacheUtils } from '../cache/db-cache';
import type { 
  Permission, 
  CreatePermissionData, 
  DatabasePermission 
} from '../rbac/types';

export class PermissionService {
  private static transformDbPermission(dbPermission: DatabasePermission): Permission {
    return {
      id: dbPermission.id,
      name: dbPermission.name,
      description: dbPermission.description,
      resource: dbPermission.resource,
      action: dbPermission.action,
      createdAt: new Date(dbPermission.created_at),
      updatedAt: new Date(dbPermission.updated_at)
    };
  }

  static async getAllPermissions(): Promise<Permission[]> {
    const kysely = getKysely();
    
    const dbPermissions = await kysely
      .selectFrom('permissions')
      .selectAll()
      .execute() as DatabasePermission[];

    return dbPermissions.map(permission => this.transformDbPermission(permission));
  }

  static async getPermissionById(id: string): Promise<Permission | null> {
    // Try cache first
    const cacheKey = CacheUtils.permissionKey(id, 'full');
    const cached = await permissionCache.get(cacheKey);
    if (cached) {
      return this.transformDbPermission(cached);
    }

    // Fetch from database
    const permissionRepo = getRepository('permissions');
    const dbPermission = await permissionRepo.findById(id) as DatabasePermission | null;
    
    if (!dbPermission) {
      return null;
    }

    const permission = this.transformDbPermission(dbPermission);

    // Cache the result
    await permissionCache.set(cacheKey, dbPermission, 3600); // 1 hour TTL

    return permission;
  }

  static async getPermissionByName(name: string): Promise<Permission | null> {
    const kysely = getKysely();
    
    const dbPermission = await kysely
      .selectFrom('permissions')
      .selectAll()
      .where('name', '=', name)
      .executeTakeFirst() as DatabasePermission | undefined;

    return dbPermission ? this.transformDbPermission(dbPermission) : null;
  }

  static async getPermissionsByResource(resource: string): Promise<Permission[]> {
    const kysely = getKysely();
    
    const dbPermissions = await kysely
      .selectFrom('permissions')
      .selectAll()
      .where('resource', '=', resource)
      .execute() as DatabasePermission[];

    return dbPermissions.map(permission => this.transformDbPermission(permission));
  }

  static async createPermission(permissionData: CreatePermissionData): Promise<Permission> {
    const kysely = getKysely();
    
    const now = new Date().toISOString();
    const dbPermissionData: DatabasePermission = {
      id: crypto.randomUUID(),
      name: permissionData.name,
      description: permissionData.description || null,
      resource: permissionData.resource,
      action: permissionData.action,
      created_at: now,
      updated_at: now
    };

    await kysely.insertInto('permissions').values(dbPermissionData).execute();

    const permission = this.transformDbPermission(dbPermissionData);

    // Invalidate permission cache
    await permissionCache.invalidatePermissionCache(permission.id);

    return permission;
  }

  static async deletePermission(id: string): Promise<void> {
    const kysely = getKysely();
    
    await kysely.transaction().execute(async (trx) => {
      // Remove from role permissions
      await trx.deleteFrom('role_permissions').where('permission_id', '=', id).execute();
      
      // Delete permission
      await trx.deleteFrom('permissions').where('id', '=', id).execute();
    });

    // Invalidate permission cache
    await permissionCache.invalidatePermissionCache(id);
  }
}
```

### User Role Service
```typescript
// src/lib/services/user-role-service.ts
import { getKysely } from '../db';
import { userCache, roleCache } from '../cache/typed-cache';
import { CacheUtils } from '../cache/db-cache';
import type { 
  UserRole, 
  AssignRoleData, 
  Role, 
  DatabaseUserRole 
} from '../rbac/types';
import { RoleService } from './role-service';

export class UserRoleService {
  static async getUserRoles(userId: string): Promise<UserRole[]> {
    const kysely = getKysely();
    
    const userRoles = await kysely
      .selectFrom('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .select([
        'user_roles.user_id',
        'user_roles.role_id',
        'user_roles.created_at',
        'roles.id as role.id',
        'roles.name as role.name',
        'roles.description as role.description',
        'roles.active as role.active',
        'roles.created_at as role.created_at',
        'roles.updated_at as role.updated_at'
      ])
      .where('user_roles.user_id', '=', userId)
      .where('roles.active', '=', true)
      .execute();

    return userRoles.map(userRole => ({
      userId: userRole.user_id,
      roleId: userRole.role_id,
      role: {
        id: userRole.role.id,
        name: userRole.role.name,
        description: userRole.role.description,
        active: userRole.role.active,
        permissions: [], // Will be populated if needed
        createdAt: new Date(userRole.role.created_at),
        updatedAt: new Date(userRole.role.updated_at)
      },
      createdAt: new Date(userRole.created_at)
    }));
  }

  static async assignRole(assignment: AssignRoleData): Promise<void> {
    const kysely = getKysely();
    
    const userRoleData: DatabaseUserRole = {
      user_id: assignment.userId,
      role_id: assignment.roleId,
      created_at: new Date().toISOString()
    };

    await kysely.insertInto('user_roles').values(userRoleData).execute();

    // Invalidate user cache
    await userCache.invalidateUserCache(assignment.userId);
  }

  static async removeRole(userId: string, roleId: string): Promise<void> {
    const kysely = getKysely();
    
    await kysely
      .deleteFrom('user_roles')
      .where('user_id', '=', userId)
      .where('role_id', '=', roleId)
      .execute();

    // Invalidate user cache
    await userCache.invalidateUserCache(userId);
  }

  static async removeAllUserRoles(userId: string): Promise<void> {
    const kysely = getKysely();
    
    await kysely
      .deleteFrom('user_roles')
      .where('user_id', '=', userId)
      .execute();

    // Invalidate user cache
    await userCache.invalidateUserCache(userId);
  }

  static async hasRole(userId: string, roleName: string): Promise<boolean> {
    const kysely = getKysely();
    
    const result = await kysely
      .selectFrom('user_roles')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .select('user_roles.user_id')
      .where('user_roles.user_id', '=', userId)
      .where('roles.name', '=', roleName)
      .where('roles.active', '=', true)
      .executeTakeFirst();

    return !!result;
  }

  static async getUsersWithRole(roleId: string): Promise<string[]> {
    const kysely = getKysely();
    
    const userRoles = await kysely
      .selectFrom('user_roles')
      .select('user_id')
      .where('role_id', '=', roleId)
      .execute();

    return userRoles.map(userRole => userRole.user_id);
  }
}
```

## Step 4: Permission Checking Service

### RBAC Permission Checker
```typescript
// src/lib/services/rbac-service.ts
import { getKysely } from '../db';
import { userCache } from '../cache/typed-cache';
import { CacheUtils } from '../cache/db-cache';
import type { CheckPermissionData } from '../rbac/types';
import { UserRoleService } from './user-role-service';

export class RBACService {
  static async checkPermission(data: CheckPermissionData): Promise<boolean> {
    const { userId, resource, action } = data;

    // Try cache first
    const cacheKey = CacheUtils.userKey(userId, `permission:${resource}:${action}`);
    const cached = await userCache.get(cacheKey);
    if (cached !== null) {
      return cached as boolean;
    }

    // Check permission in database
    const kysely = getKysely();
    
    const result = await kysely
      .selectFrom('user_roles')
      .innerJoin('role_permissions', 'role_permissions.role_id', 'user_roles.role_id')
      .innerJoin('permissions', 'permissions.id', 'role_permissions.permission_id')
      .innerJoin('roles', 'roles.id', 'user_roles.role_id')
      .select('user_roles.user_id')
      .where('user_roles.user_id', '=', userId)
      .where('permissions.resource', '=', resource)
      .where('permissions.action', '=', action)
      .where('roles.active', '=', true)
      .executeTakeFirst();

    const hasPermission = !!result;

    // Cache the result
    await userCache.set(cacheKey, hasPermission, 1800); // 30 minutes TTL

    return hasPermission;
  }

  static async getUserPermissions(userId: string): Promise<Array<{ resource: string; action: string }>> {
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

    return permissions.map(permission => ({
      resource: permission.resource,
      action: permission.action
    }));
  }

  static async isAdmin(userId: string): Promise<boolean> {
    return await UserRoleService.hasRole(userId, 'admin');
  }

  static async isModerator(userId: string): Promise<boolean> {
    return await UserRoleService.hasRole(userId, 'moderator');
  }

  static async isUser(userId: string): Promise<boolean> {
    return await UserRoleService.hasRole(userId, 'user');
  }

  static async canManageUsers(userId: string): Promise<boolean> {
    return await this.checkPermission({
      userId,
      resource: 'users',
      action: 'manage'
    });
  }

  static async canViewUsers(userId: string): Promise<boolean> {
    return await this.checkPermission({
      userId,
      resource: 'users',
      action: 'view'
    });
  }

  static async canManageRoles(userId: string): Promise<boolean> {
    return await this.checkPermission({
      userId,
      resource: 'roles',
      action: 'manage'
    });
  }

  static async canViewAnalytics(userId: string): Promise<boolean> {
    return await this.checkPermission({
      userId,
      resource: 'analytics',
      action: 'view'
    });
  }

  static async canManageGeneration(userId: string): Promise<boolean> {
    return await this.checkPermission({
      userId,
      resource: 'generation',
      action: 'manage'
    });
  }

  static async canViewGeneration(userId: string): Promise<boolean> {
    return await this.checkPermission({
      userId,
      resource: 'generation',
      action: 'view'
    });
  }

  // Clear permission cache for a user
  static async clearUserPermissionCache(userId: string): Promise<void> {
    const patterns = [
      CacheUtils.userKey(userId, 'permission:*'),
      `user:${userId}:permission:*`
    ];

    for (const pattern of patterns) {
      await userCache.deletePattern(pattern);
    }
  }
}
```

## Step 5: RBAC Middleware

### Permission Middleware
```typescript
// src/lib/middleware/rbac-middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth';
import { RBACService } from '../services/rbac-service';

export interface RBACOptions {
  resource: string;
  action: string;
  requireAdmin?: boolean;
  customCheck?: (userId: string) => Promise<boolean>;
}

export function withRBAC(options: RBACOptions) {
  return function (handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>) {
    return async function (request: NextRequest, ...args: any[]): Promise<NextResponse> {
      try {
        // Get user session
        const session = await getServerSession(authOptions);
        
        if (!session?.user?.id) {
          return NextResponse.json(
            { success: false, error: 'Authentication required' },
            { status: 401 }
          );
        }

        const userId = session.user.id;

        // Check if user is admin (if required)
        if (options.requireAdmin) {
          const isAdmin = await RBACService.isAdmin(userId);
          if (!isAdmin) {
            return NextResponse.json(
              { success: false, error: 'Admin access required' },
              { status: 403 }
            );
          }
        }

        // Custom permission check
        if (options.customCheck) {
          const hasCustomPermission = await options.customCheck(userId);
          if (!hasCustomPermission) {
            return NextResponse.json(
              { success: false, error: 'Insufficient permissions' },
              { status: 403 }
            );
          }
        } else {
          // Standard permission check
          const hasPermission = await RBACService.checkPermission({
            userId,
            resource: options.resource,
            action: options.action
          });

          if (!hasPermission) {
            return NextResponse.json(
              { success: false, error: 'Insufficient permissions' },
              { status: 403 }
            );
          }
        }

        // Call the original handler
        return await handler(request, ...args);
      } catch (error) {
        console.error('RBAC middleware error:', error);
        return NextResponse.json(
          { success: false, error: 'Authorization error' },
          { status: 500 }
        );
      }
    };
  };
}

// Convenience functions for common checks
export const requireAdmin = withRBAC({ 
  resource: 'admin', 
  action: 'access', 
  requireAdmin: true 
});

export const requireUserManagement = withRBAC({
  resource: 'users',
  action: 'manage'
});

export const requireRoleManagement = withRBAC({
  resource: 'roles',
  action: 'manage'
});

export const requireAnalyticsAccess = withRBAC({
  resource: 'analytics',
  action: 'view'
});

export const requireGenerationManagement = withRBAC({
  resource: 'generation',
  action: 'manage'
});
```

## Step 6: API Routes with RBAC

### Admin Users Route
```typescript
// src/app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserManagement } from '@/lib/middleware/rbac-middleware';
import { UserService } from '@/lib/services/user-service';
import { UserRoleService } from '@/lib/services/user-role-service';

export const GET = requireUserManagement(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const active = searchParams.get('active');
    const role = searchParams.get('role');
    
    let users;
    if (active === 'true') {
      users = await UserService.getActiveUsers();
    } else {
      users = await UserService.getActiveUsers(); // Placeholder for getAllUsers
    }

    // If role filter is specified, filter users by role
    if (role) {
      const userIdsWithRole = await UserRoleService.getUsersWithRole(role);
      users = users.filter(user => userIdsWithRole.includes(user.id));
    }

    return NextResponse.json({ 
      success: true, 
      data: users 
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch users',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
});
```

### Roles Management Route
```typescript
// src/app/api/admin/roles/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireRoleManagement } from '@/lib/middleware/rbac-middleware';
import { RoleService, type CreateRoleData } from '@/lib/services/role-service';
import { z } from 'zod';

const CreateRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  active: z.boolean().optional(),
  permissionIds: z.array(z.string()).optional()
});

export const GET = requireRoleManagement(async (request: NextRequest) => {
  try {
    const roles = await RoleService.getAllRoles();
    
    return NextResponse.json({ 
      success: true, 
      data: roles 
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch roles',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
});

export const POST = requireRoleManagement(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const validatedData = CreateRoleSchema.parse(body);
    
    const role = await RoleService.createRole(validatedData);
    
    return NextResponse.json({ 
      success: true, 
      data: role 
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating role:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation failed',
          details: error.errors 
        }, 
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create role',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
});
```

## Step 7: RBAC Seeding and Initialization

### RBAC Seeder
```typescript
// src/lib/seed/rbac-seeder.ts
import { PermissionService, RoleService, UserRoleService } from '../services';
import { getKysely } from '../db';

export class RBACSeeder {
  static async seedPermissions(): Promise<void> {
    const permissions = [
      // User management
      { name: 'users.view', description: 'View users', resource: 'users', action: 'view' },
      { name: 'users.create', description: 'Create users', resource: 'users', action: 'create' },
      { name: 'users.update', description: 'Update users', resource: 'users', action: 'update' },
      { name: 'users.delete', description: 'Delete users', resource: 'users', action: 'delete' },
      { name: 'users.manage', description: 'Manage users', resource: 'users', action: 'manage' },
      
      // Role management
      { name: 'roles.view', description: 'View roles', resource: 'roles', action: 'view' },
      { name: 'roles.create', description: 'Create roles', resource: 'roles', action: 'create' },
      { name: 'roles.update', description: 'Update roles', resource: 'roles', action: 'update' },
      { name: 'roles.delete', description: 'Delete roles', resource: 'roles', action: 'delete' },
      { name: 'roles.manage', description: 'Manage roles', resource: 'roles', action: 'manage' },
      
      // Analytics
      { name: 'analytics.view', description: 'View analytics', resource: 'analytics', action: 'view' },
      
      // Generation
      { name: 'generation.view', description: 'View generation history', resource: 'generation', action: 'view' },
      { name: 'generation.create', description: 'Create generations', resource: 'generation', action: 'create' },
      { name: 'generation.manage', description: 'Manage generation', resource: 'generation', action: 'manage' },
      
      // Admin
      { name: 'admin.access', description: 'Admin access', resource: 'admin', action: 'access' }
    ];

    for (const permissionData of permissions) {
      const existing = await PermissionService.getPermissionByName(permissionData.name);
      if (!existing) {
        await PermissionService.createPermission(permissionData);
      }
    }
  }

  static async seedRoles(): Promise<void> {
    const adminPermissions = await Promise.all([
      PermissionService.getPermissionByName('users.manage'),
      PermissionService.getPermissionByName('roles.manage'),
      PermissionService.getPermissionByName('analytics.view'),
      PermissionService.getPermissionByName('generation.manage'),
      PermissionService.getPermissionByName('admin.access')
    ]);

    const moderatorPermissions = await Promise.all([
      PermissionService.getPermissionByName('users.view'),
      PermissionService.getPermissionByName('generation.view'),
      PermissionService.getPermissionByName('generation.create')
    ]);

    const userPermissions = await Promise.all([
      PermissionService.getPermissionByName('generation.view'),
      PermissionService.getPermissionByName('generation.create')
    ]);

    const roles = [
      {
        name: 'admin',
        description: 'Administrator with full access',
        permissionIds: adminPermissions.filter(p => p).map(p => p!.id)
      },
      {
        name: 'moderator',
        description: 'Moderator with limited admin access',
        permissionIds: moderatorPermissions.filter(p => p).map(p => p!.id)
      },
      {
        name: 'user',
        description: 'Regular user with basic access',
        permissionIds: userPermissions.filter(p => p).map(p => p!.id)
      }
    ];

    for (const roleData of roles) {
      const existing = await RoleService.getRoleByName(roleData.name);
      if (!existing) {
        await RoleService.createRole(roleData);
      }
    }
  }

  static async assignDefaultRoles(): Promise<void> {
    const adminRole = await RoleService.getRoleByName('admin');
    const userRole = await RoleService.getRoleByName('user');

    if (!adminRole || !userRole) {
      throw new Error('Required roles not found');
    }

    // Assign admin role to first user (if exists)
    const kysely = getKysely();
    const firstUser = await kysely
      .selectFrom('users')
      .select('id')
      .orderBy('created_at', 'asc')
      .executeTakeFirst();

    if (firstUser) {
      const hasAdminRole = await UserRoleService.hasRole(firstUser.id, 'admin');
      if (!hasAdminRole) {
        await UserRoleService.assignRole({
          userId: firstUser.id,
          roleId: adminRole.id
        });
      }
    }
  }

  static async seed(): Promise<void> {
    console.log('🌱 Seeding RBAC system...');
    
    await this.seedPermissions();
    console.log('✅ Permissions seeded');
    
    await this.seedRoles();
    console.log('✅ Roles seeded');
    
    await this.assignDefaultRoles();
    console.log('✅ Default roles assigned');
    
    console.log('🎉 RBAC seeding completed');
  }
}
```

## Step 8: Testing RBAC System

### RBAC Test Suite
```typescript
// src/lib/__tests__/rbac-system.test.ts
import { 
  RoleService, 
  PermissionService, 
  UserRoleService, 
  RBACService 
} from '../services';
import { RBACSeeder } from '../seed/rbac-seeder';
import { initializeDatabase } from '../db';

describe('RBAC System Tests', () => {
  beforeAll(async () => {
    await initializeDatabase();
    await RBACSeeder.seed();
  });

  describe('Permission Management', () => {
    test('should create permission', async () => {
      const permission = await PermissionService.createPermission({
        name: 'test.permission',
        description: 'Test permission',
        resource: 'test',
        action: 'access'
      });

      expect(permission.name).toBe('test.permission');
      expect(permission.resource).toBe('test');
      expect(permission.action).toBe('access');

      // Cleanup
      await PermissionService.deletePermission(permission.id);
    });

    test('should get permission by name', async () => {
      const permission = await PermissionService.getPermissionByName('users.view');
      expect(permission).toBeDefined();
      expect(permission!.resource).toBe('users');
    });
  });

  describe('Role Management', () => {
    test('should create role with permissions', async () => {
      const userViewPermission = await PermissionService.getPermissionByName('users.view');
      const userCreatePermission = await PermissionService.getPermissionByName('users.create');

      const role = await RoleService.createRole({
        name: 'test-role',
        description: 'Test role',
        permissionIds: [userViewPermission!.id, userCreatePermission!.id]
      });

      expect(role.name).toBe('test-role');
      expect(role.permissions).toHaveLength(2);

      // Cleanup
      await RoleService.deleteRole(role.id);
    });

    test('should get role by name', async () => {
      const role = await RoleService.getRoleByName('admin');
      expect(role).toBeDefined();
      expect(role!.name).toBe('admin');
    });
  });

  describe('User Role Assignment', () => {
    test('should assign role to user', async () => {
      // Create test user
      const kysely = getKysely();
      const user = await kysely
        .insertInto('users')
        .values({
          id: 'test-user-rbac',
          name: 'Test User',
          email: 'test-rbac@example.com',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .returningAll()
        .executeTakeFirst();

      const userRole = await RoleService.getRoleByName('user');
      
      await UserRoleService.assignRole({
        userId: user!.id,
        roleId: userRole!.id
      });

      const hasRole = await UserRoleService.hasRole(user!.id, 'user');
      expect(hasRole).toBe(true);

      // Cleanup
      await UserRoleService.removeAllUserRoles(user!.id);
      await kysely.deleteFrom('users').where('id', '=', user!.id).execute();
    });
  });

  describe('Permission Checking', () => {
    test('should check user permissions', async () => {
      // Get first user (should have admin role)
      const kysely = getKysely();
      const user = await kysely
        .selectFrom('users')
        .select('id')
        .orderBy('created_at', 'asc')
        .executeTakeFirst();

      if (user) {
        const canManageUsers = await RBACService.canManageUsers(user.id);
        expect(canManageUsers).toBe(true);

        const isAdmin = await RBACService.isAdmin(user.id);
        expect(isAdmin).toBe(true);
      }
    });
  });
});
```

## Common Issues and Solutions

### Issue: Permission Cache Invalidation
- **Problem**: Permission changes not reflected immediately
- **Solution**: Clear relevant caches when permissions change

### Issue: Role Hierarchy
- **Problem**: Complex role relationships
- **Solution**: Use permission-based approach instead of role hierarchy

### Issue: Performance with Many Roles
- **Problem**: Slow permission checks with many roles
- **Solution**: Use caching and optimize queries

## Next Steps

Once RBAC system is migrated, proceed to [08-caching-layer.md](./08-caching-layer.md) to update the caching layer for Noormme.
