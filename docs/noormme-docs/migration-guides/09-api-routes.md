# 09 - API Routes Migration

This guide covers migrating API routes from PostgreSQL direct access to Noormme-compatible patterns.

## Overview

We'll migrate:
- User management API routes
- Admin API routes
- Authentication API routes
- RBAC-protected routes
- Error handling and validation
- Response formatting

## Step 1: User Management API Routes

### Users Route
```typescript
// src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserService, type CreateUserData, type UpdateUserData } from '@/lib/services/user-service';
import { RBACService } from '@/lib/services/rbac-service';
import { handleError } from '@/lib/utils/error-handler';
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email(),
  emailVerified: z.string().datetime().optional(),
  image: z.string().url().optional(),
  active: z.boolean().optional()
});

const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  emailVerified: z.string().datetime().optional(),
  image: z.string().url().optional(),
  active: z.boolean().optional()
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const active = searchParams.get('active');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Check permissions
    const canViewUsers = await RBACService.canViewUsers(session.user.id);
    if (!canViewUsers) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    let users;
    if (active === 'true') {
      users = await UserService.getActiveUsers();
    } else {
      // Implement getAllUsers with pagination
      users = await UserService.getActiveUsers(); // Placeholder
    }

    // Apply pagination
    const paginatedUsers = users.slice(offset, offset + limit);
    const total = users.length;

    return NextResponse.json({
      success: true,
      data: paginatedUsers,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check permissions
    const canManageUsers = await RBACService.canManageUsers(session.user.id);
    if (!canManageUsers) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = CreateUserSchema.parse(body);
    
    // Transform emailVerified string to Date if provided
    const userData: CreateUserData = {
      ...validatedData,
      emailVerified: validatedData.emailVerified ? new Date(validatedData.emailVerified) : undefined
    };

    const user = await UserService.createUser(userData);

    return NextResponse.json({
      success: true,
      data: user
    }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
```

### Individual User Route
```typescript
// src/app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { UserService, type UpdateUserData } from '@/lib/services/user-service';
import { RBACService } from '@/lib/services/rbac-service';
import { handleError } from '@/lib/utils/error-handler';
import { z } from 'zod';

const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  emailVerified: z.string().datetime().optional(),
  image: z.string().url().optional(),
  active: z.boolean().optional()
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = params.id;

    // Users can view their own profile, admins can view any profile
    const isOwnProfile = session.user.id === userId;
    const canViewUsers = await RBACService.canViewUsers(session.user.id);

    if (!isOwnProfile && !canViewUsers) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const user = await UserService.getUserById(userId);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: user
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = params.id;

    // Users can update their own profile, admins can update any profile
    const isOwnProfile = session.user.id === userId;
    const canManageUsers = await RBACService.canManageUsers(session.user.id);

    if (!isOwnProfile && !canManageUsers) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = UpdateUserSchema.parse(body);
    
    // Transform emailVerified string to Date if provided
    const updateData: UpdateUserData = {
      ...validatedData,
      emailVerified: validatedData.emailVerified ? new Date(validatedData.emailVerified) : undefined
    };

    const user = await UserService.updateUser(userId, updateData);

    return NextResponse.json({
      success: true,
      data: user
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = params.id;

    // Only admins can delete users
    const canManageUsers = await RBACService.canManageUsers(session.user.id);
    if (!canManageUsers) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Prevent self-deletion
    if (session.user.id === userId) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    await UserService.deleteUser(userId);

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    return handleError(error);
  }
}
```

## Step 2: Admin API Routes

### Admin Users Route
```typescript
// src/app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserManagement } from '@/lib/middleware/rbac-middleware';
import { UserService, type CreateUserData } from '@/lib/services/user-service';
import { UserRoleService } from '@/lib/services/user-role-service';
import { handleError } from '@/lib/utils/error-handler';
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email(),
  emailVerified: z.string().datetime().optional(),
  image: z.string().url().optional(),
  active: z.boolean().optional(),
  roleIds: z.array(z.string()).optional()
});

export const GET = requireUserManagement(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const active = searchParams.get('active');
    const role = searchParams.get('role');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    
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

    // Apply pagination
    const paginatedUsers = users.slice(offset, offset + limit);
    const total = users.length;

    return NextResponse.json({
      success: true,
      data: paginatedUsers,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    return handleError(error);
  }
});

export const POST = requireUserManagement(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const validatedData = CreateUserSchema.parse(body);
    
    // Transform emailVerified string to Date if provided
    const userData: CreateUserData = {
      name: validatedData.name,
      email: validatedData.email,
      emailVerified: validatedData.emailVerified ? new Date(validatedData.emailVerified) : undefined,
      image: validatedData.image,
      active: validatedData.active
    };

    const user = await UserService.createUser(userData);

    // Assign roles if provided
    if (validatedData.roleIds && validatedData.roleIds.length > 0) {
      for (const roleId of validatedData.roleIds) {
        await UserRoleService.assignRole({
          userId: user.id,
          roleId
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: user
    }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
});
```

### Admin Roles Route
```typescript
// src/app/api/admin/roles/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireRoleManagement } from '@/lib/middleware/rbac-middleware';
import { RoleService, type CreateRoleData, type UpdateRoleData } from '@/lib/services/role-service';
import { handleError } from '@/lib/utils/error-handler';
import { z } from 'zod';

const CreateRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  active: z.boolean().optional(),
  permissionIds: z.array(z.string()).optional()
});

const UpdateRoleSchema = z.object({
  name: z.string().min(1).optional(),
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
    return handleError(error);
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
    return handleError(error);
  }
});
```

### Individual Role Route
```typescript
// src/app/api/admin/roles/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireRoleManagement } from '@/lib/middleware/rbac-middleware';
import { RoleService, type UpdateRoleData } from '@/lib/services/role-service';
import { handleError } from '@/lib/utils/error-handler';
import { z } from 'zod';

const UpdateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
  permissionIds: z.array(z.string()).optional()
});

export const GET = requireRoleManagement(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  try {
    const roleId = params.id;
    const role = await RoleService.getRoleById(roleId);
    
    if (!role) {
      return NextResponse.json(
        { success: false, error: 'Role not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: role
    });
  } catch (error) {
    return handleError(error);
  }
});

export const PUT = requireRoleManagement(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  try {
    const roleId = params.id;
    const body = await request.json();
    const validatedData = UpdateRoleSchema.parse(body);
    
    const role = await RoleService.updateRole(roleId, validatedData);

    return NextResponse.json({
      success: true,
      data: role
    });
  } catch (error) {
    return handleError(error);
  }
});

export const DELETE = requireRoleManagement(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  try {
    const roleId = params.id;
    await RoleService.deleteRole(roleId);

    return NextResponse.json({
      success: true,
      message: 'Role deleted successfully'
    });
  } catch (error) {
    return handleError(error);
  }
});
```

## Step 3: Analytics API Routes

### Analytics Route
```typescript
// src/app/api/admin/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAnalyticsAccess } from '@/lib/middleware/rbac-middleware';
import { getKysely } from '@/lib/db';
import { cacheFor1Hour } from '@/lib/middleware/cache-middleware';
import { handleError } from '@/lib/utils/error-handler';

export const GET = requireAnalyticsAccess(cacheFor1Hour(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const kysely = getKysely();
    let analytics;

    switch (type) {
      case 'users':
        analytics = await getUserAnalytics(kysely, dateFrom, dateTo);
        break;
      case 'generations':
        analytics = await getGenerationAnalytics(kysely, dateFrom, dateTo);
        break;
      case 'performance':
        analytics = await getPerformanceAnalytics(kysely, dateFrom, dateTo);
        break;
      default:
        analytics = await getOverviewAnalytics(kysely, dateFrom, dateTo);
    }

    return NextResponse.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    return handleError(error);
  }
}));

async function getUserAnalytics(kysely: any, dateFrom?: string | null, dateTo?: string | null) {
  let query = kysely
    .selectFrom('users')
    .leftJoin('user_roles', 'user_roles.user_id', 'users.id')
    .leftJoin('roles', 'roles.id', 'user_roles.role_id')
    .select([
      'roles.name as role_name',
      kysely.fn.count('users.id').as('user_count')
    ])
    .groupBy('roles.name');

  if (dateFrom) {
    query = query.where('users.created_at', '>=', dateFrom);
  }
  if (dateTo) {
    query = query.where('users.created_at', '<=', dateTo);
  }

  const roleStats = await query.execute();

  const totalUsers = await kysely
    .selectFrom('users')
    .select(kysely.fn.count('id').as('count'))
    .executeTakeFirst();

  const activeUsers = await kysely
    .selectFrom('users')
    .select(kysely.fn.count('id').as('count'))
    .where('active', '=', true)
    .executeTakeFirst();

  return {
    totalUsers: Number(totalUsers?.count || 0),
    activeUsers: Number(activeUsers?.count || 0),
    roleDistribution: roleStats
  };
}

async function getGenerationAnalytics(kysely: any, dateFrom?: string | null, dateTo?: string | null) {
  let query = kysely
    .selectFrom('generation_history')
    .select([
      kysely.fn.count('id').as('total_generations'),
      kysely.fn.sum('tokens_used').as('total_tokens'),
      kysely.fn.avg('processing_time').as('avg_processing_time')
    ]);

  if (dateFrom) {
    query = query.where('created_at', '>=', dateFrom);
  }
  if (dateTo) {
    query = query.where('created_at', '<=', dateTo);
  }

  const stats = await query.executeTakeFirst();

  // Daily trend
  const dailyTrend = await kysely
    .selectFrom('generation_history')
    .select([
      kysely.fn('date', 'created_at').as('date'),
      kysely.fn.count('id').as('count'),
      kysely.fn.sum('tokens_used').as('tokens')
    ])
    .groupBy(kysely.fn('date', 'created_at'))
    .orderBy('date', 'asc')
    .execute();

  return {
    totalGenerations: Number(stats?.total_generations || 0),
    totalTokens: Number(stats?.total_tokens || 0),
    avgProcessingTime: Number(stats?.avg_processing_time || 0),
    dailyTrend
  };
}

async function getPerformanceAnalytics(kysely: any, dateFrom?: string | null, dateTo?: string | null) {
  let query = kysely
    .selectFrom('generation_history')
    .select([
      'status',
      kysely.fn.count('id').as('count'),
      kysely.fn.avg('processing_time').as('avg_time')
    ])
    .groupBy('status');

  if (dateFrom) {
    query = query.where('created_at', '>=', dateFrom);
  }
  if (dateTo) {
    query = query.where('created_at', '<=', dateTo);
  }

  const performanceStats = await query.execute();

  return {
    statusDistribution: performanceStats
  };
}

async function getOverviewAnalytics(kysely: any, dateFrom?: string | null, dateTo?: string | null) {
  const [users, generations, performance] = await Promise.all([
    getUserAnalytics(kysely, dateFrom, dateTo),
    getGenerationAnalytics(kysely, dateFrom, dateTo),
    getPerformanceAnalytics(kysely, dateFrom, dateTo)
  ]);

  return {
    users,
    generations,
    performance
  };
}
```

## Step 4: Generation API Routes

### Generation History Route
```typescript
// src/app/api/generations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getKysely } from '@/lib/db';
import { handleError } from '@/lib/utils/error-handler';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');

    const kysely = getKysely();
    
    let query = kysely
      .selectFrom('generation_history')
      .selectAll()
      .where('user_id', '=', session.user.id);

    if (status) {
      query = query.where('status', '=', status);
    }

    const generations = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();

    const total = await kysely
      .selectFrom('generation_history')
      .select(kysely.fn.count('id').as('count'))
      .where('user_id', '=', session.user.id)
      .executeTakeFirst();

    return NextResponse.json({
      success: true,
      data: generations,
      pagination: {
        total: Number(total?.count || 0),
        limit,
        offset,
        hasMore: offset + limit < Number(total?.count || 0)
      }
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Validate generation request
    const { prompt, negative_prompt, width, height, steps, cfg_scale, seed, sampler_name, scheduler, model } = body;

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const kysely = getKysely();
    
    const generationData = {
      user_id: session.user.id,
      prompt,
      negative_prompt: negative_prompt || null,
      width: width || 512,
      height: height || 512,
      steps: steps || 20,
      cfg_scale: cfg_scale || 7.0,
      seed: seed || null,
      sampler_name: sampler_name || 'DPM++ 2M Karras',
      scheduler: scheduler || null,
      model: model || null,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const generation = await kysely
      .insertInto('generation_history')
      .values(generationData)
      .returningAll()
      .executeTakeFirst();

    return NextResponse.json({
      success: true,
      data: generation
    }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
```

## Step 5: Error Handling and Validation

### Enhanced Error Handler
```typescript
// src/lib/utils/error-handler.ts
import { NextResponse } from 'next/server';
import { DatabaseError, ValidationError, NotFoundError, ConflictError } from '../errors/database-errors';
import { z } from 'zod';

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export function handleError(error: unknown): NextResponse<ErrorResponse> {
  console.error('API Error:', error);

  const timestamp = new Date().toISOString();

  if (error instanceof z.ZodError) {
    return NextResponse.json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: {
        errors: error.errors,
        fieldErrors: error.flatten().fieldErrors
      },
      timestamp
    }, { status: 400 });
  }

  if (error instanceof ValidationError) {
    return NextResponse.json({
      success: false,
      error: error.message,
      code: 'VALIDATION_ERROR',
      details: {
        field: error.field,
        value: error.value
      },
      timestamp
    }, { status: 400 });
  }

  if (error instanceof NotFoundError) {
    return NextResponse.json({
      success: false,
      error: error.message,
      code: 'NOT_FOUND',
      timestamp
    }, { status: 404 });
  }

  if (error instanceof ConflictError) {
    return NextResponse.json({
      success: false,
      error: error.message,
      code: 'CONFLICT',
      details: {
        conflictingField: error.conflictingField,
        conflictingValue: error.conflictingValue
      },
      timestamp
    }, { status: 409 });
  }

  if (error instanceof DatabaseError) {
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code || 'DATABASE_ERROR',
      details: error.details,
      timestamp
    }, { status: 500 });
  }

  // Generic error
  return NextResponse.json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    details: {
      message: error instanceof Error ? error.message : 'Unknown error'
    },
    timestamp
  }, { status: 500 });
}
```

### Request Validation Utilities
```typescript
// src/lib/utils/validation.ts
import { z } from 'zod';

export const PaginationSchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).default('10'),
  offset: z.string().regex(/^\d+$/).transform(Number).default('0')
});

export const DateRangeSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional()
});

export const UserFiltersSchema = z.object({
  active: z.enum(['true', 'false']).optional(),
  role: z.string().optional(),
  ...PaginationSchema.shape
});

export const GenerationFiltersSchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  ...PaginationSchema.shape
});

export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Request validation failed', undefined, undefined);
    }
    throw error;
  }
}
```

## Step 6: Response Formatting

### Standardized Response Format
```typescript
// src/lib/utils/response-format.ts
import { NextResponse } from 'next/server';

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  meta?: Record<string, unknown>;
}

export function successResponse<T>(
  data: T,
  status: number = 200,
  pagination?: SuccessResponse<T>['pagination'],
  meta?: Record<string, unknown>
): NextResponse<SuccessResponse<T>> {
  const response: SuccessResponse<T> = {
    success: true,
    data
  };

  if (pagination) {
    response.pagination = pagination;
  }

  if (meta) {
    response.meta = meta;
  }

  return NextResponse.json(response, { status });
}

export function createdResponse<T>(data: T): NextResponse<SuccessResponse<T>> {
  return successResponse(data, 201);
}

export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204 });
}
```

## Step 7: API Testing

### API Route Tests
```typescript
// src/lib/__tests__/api-routes.test.ts
import { NextRequest } from 'next/server';
import { GET as getUsers, POST as createUser } from '@/app/api/users/route';
import { initializeDatabase } from '@/lib/db';
import { RBACSeeder } from '@/lib/seed/rbac-seeder';

describe('API Routes Tests', () => {
  beforeAll(async () => {
    await initializeDatabase();
    await RBACSeeder.seed();
  });

  describe('Users API', () => {
    test('should require authentication', async () => {
      const request = new NextRequest('http://localhost:3000/api/users');
      const response = await getUsers(request);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Authentication required');
    });

    test('should validate user creation data', async () => {
      const request = new NextRequest('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          // Missing required email
          name: 'Test User'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await createUser(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.code).toBe('VALIDATION_ERROR');
    });
  });
});
```

## Common Issues and Solutions

### Issue: Authentication Middleware
- **Problem**: Session not available in API routes
- **Solution**: Use `getServerSession` with proper auth options

### Issue: Type Safety
- **Problem**: Request/response types not properly typed
- **Solution**: Use Zod schemas for validation and TypeScript interfaces

### Issue: Error Handling
- **Problem**: Inconsistent error responses
- **Solution**: Centralized error handling with standardized format

### Issue: Performance
- **Problem**: Slow API responses
- **Solution**: Implement caching middleware and database optimization

## Best Practices

1. **Authentication**: Always check authentication in protected routes
2. **Authorization**: Use RBAC middleware for permission checking
3. **Validation**: Validate all input with Zod schemas
4. **Error Handling**: Use centralized error handling
5. **Caching**: Implement appropriate caching for read operations
6. **Pagination**: Always paginate large result sets
7. **Logging**: Log all errors and important operations
8. **Testing**: Write comprehensive tests for all routes

## Next Steps

Once API routes are migrated, proceed to [10-monitoring-health.md](./10-monitoring-health.md) to implement database health checks and monitoring.
