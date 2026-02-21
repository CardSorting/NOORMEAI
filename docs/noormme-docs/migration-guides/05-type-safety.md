# 05 - Type Safety and TypeScript Issues

This guide covers fixing TypeScript issues and ensuring type safety throughout the Noormme migration.

## Overview

We'll address:
- TypeScript compilation errors
- Type assertions and safety
- Generic type handling
- Interface definitions
- Error handling with proper types

## Step 1: Common TypeScript Issues

### Issue: Repository Returns `unknown` Types
**Problem:** Noormme's repository methods return generic `unknown` types

```typescript
// This causes TypeScript errors
const user = await userRepo.findById(userId); // Returns unknown
user.email; // Error: Property 'email' does not exist on type 'unknown'
```

**Solution:** Use proper type assertions
```typescript
// Proper type assertion
const user = await userRepo.findById(userId) as Record<string, unknown> | null;

if (user) {
  return {
    id: user.id as string,
    name: user.name as string | null,
    email: user.email as string,
    emailVerified: user.email_verified ? new Date(user.email_verified as string) : null,
    image: user.image as string | null,
  };
}
```

### Issue: NextAuth Adapter Type Errors
**Problem:** NextAuth adapter methods have strict type requirements

```typescript
// This causes type errors
async createUser(user: any) { // Error: Unexpected any
  // ...
}
```

**Solution:** Use proper NextAuth types
```typescript
import type { Adapter, AdapterUser, AdapterAccount, AdapterSession, VerificationToken } from 'next-auth/adapters';

export function NoormmeAdapter(): Adapter {
  return {
    async createUser(user: Omit<AdapterUser, 'id'>) {
      // Proper typing
    },
    
    async getUser(id: string) {
      // Returns AdapterUser | null
    },
    
    // ... other methods with proper types
  };
}
```

## Step 2: Creating Type-Safe Database Interfaces

### Database Entity Types
```typescript
// src/lib/db/types.ts
export interface DatabaseUser {
  id: string;
  name: string | null;
  email: string;
  email_verified: string | null; // ISO date string
  image: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DatabaseSession {
  session_token: string;
  user_id: string;
  expires: string; // ISO date string
  created_at: string;
  updated_at: string;
}

export interface DatabaseAccount {
  id: string;
  user_id: string;
  type: string;
  provider: string;
  provider_account_id: string;
  refresh_token: string | null;
  access_token: string | null;
  expires_at: number | null;
  token_type: string | null;
  scope: string | null;
  id_token: string | null;
  session_state: string | null;
}

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

export interface DatabaseGenerationHistory {
  id: number;
  user_id: string;
  prompt: string;
  negative_prompt: string | null;
  width: number;
  height: number;
  steps: number;
  cfg_scale: number;
  seed: number | null;
  sampler_name: string;
  scheduler: string | null;
  model: string | null;
  additional_lora_scale: number | null;
  image_url: string | null;
  processing_time: number | null;
  tokens_used: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// Union type for all database entities
export type DatabaseEntity = 
  | DatabaseUser 
  | DatabaseSession 
  | DatabaseAccount 
  | DatabaseRole 
  | DatabasePermission 
  | DatabaseGenerationHistory;
```

### Type-Safe Repository Wrapper
```typescript
// src/lib/db/typed-repository.ts
import { getRepository } from './db';

export class TypedRepository<T extends Record<string, unknown>> {
  constructor(private tableName: string) {}

  private getRepo() {
    return getRepository(this.tableName);
  }

  async findById(id: string): Promise<T | null> {
    const result = await this.getRepo().findById(id);
    return result as T | null;
  }

  async findMany(filter?: Record<string, unknown>): Promise<T[]> {
    const result = await this.getRepo().findMany(filter);
    return result as T[];
  }

  async create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T> {
    const now = new Date().toISOString();
    const dataWithTimestamps = {
      ...data,
      created_at: now,
      updated_at: now
    };
    
    const result = await this.getRepo().create(dataWithTimestamps);
    return result as T;
  }

  async update(data: Partial<T> & { id: string }): Promise<T> {
    const updateData = {
      ...data,
      updated_at: new Date().toISOString()
    };
    
    const result = await this.getRepo().update(updateData);
    return result as T;
  }

  async delete(id: string): Promise<void> {
    await this.getRepo().delete(id);
  }
}

// Typed repository instances
export const userRepository = new TypedRepository<DatabaseUser>('users');
export const sessionRepository = new TypedRepository<DatabaseSession>('sessions');
export const accountRepository = new TypedRepository<DatabaseAccount>('accounts');
export const roleRepository = new TypedRepository<DatabaseRole>('roles');
export const permissionRepository = new TypedRepository<DatabasePermission>('permissions');
export const generationHistoryRepository = new TypedRepository<DatabaseGenerationHistory>('generation_history');
```

## Step 3: Type-Safe Service Layer

### User Service with Proper Types
```typescript
// src/lib/services/user-service.ts
import { userRepository, type DatabaseUser } from '../db/typed-repository';
import { getKysely } from '../db';

export interface User {
  id: string;
  name: string | null;
  email: string;
  emailVerified: Date | null;
  image: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  name?: string;
  email: string;
  emailVerified?: Date;
  image?: string;
  active?: boolean;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  emailVerified?: Date;
  image?: string;
  active?: boolean;
}

export class UserService {
  private static transformDbUser(dbUser: DatabaseUser): User {
    return {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      emailVerified: dbUser.email_verified ? new Date(dbUser.email_verified) : null,
      image: dbUser.image,
      active: dbUser.active,
      createdAt: new Date(dbUser.created_at),
      updatedAt: new Date(dbUser.updated_at)
    };
  }

  private static transformToDbUser(userData: CreateUserData): Omit<DatabaseUser, 'id' | 'created_at' | 'updated_at'> {
    return {
      name: userData.name || null,
      email: userData.email,
      email_verified: userData.emailVerified?.toISOString() || null,
      image: userData.image || null,
      active: userData.active ?? true
    };
  }

  static async getUserById(id: string): Promise<User | null> {
    const dbUser = await userRepository.findById(id);
    return dbUser ? this.transformDbUser(dbUser) : null;
  }

  static async getUserByEmail(email: string): Promise<User | null> {
    const kysely = getKysely();
    const dbUser = await kysely
      .selectFrom('users')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirst() as DatabaseUser | undefined;

    return dbUser ? this.transformDbUser(dbUser) : null;
  }

  static async createUser(userData: CreateUserData): Promise<User> {
    const dbUserData = this.transformToDbUser(userData);
    const dbUser = await userRepository.create(dbUserData);
    return this.transformDbUser(dbUser);
  }

  static async updateUser(id: string, updates: UpdateUserData): Promise<User> {
    const updateData: Partial<DatabaseUser> & { id: string } = {
      id,
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.email !== undefined && { email: updates.email }),
      ...(updates.emailVerified !== undefined && { 
        email_verified: updates.emailVerified?.toISOString() || null 
      }),
      ...(updates.image !== undefined && { image: updates.image }),
      ...(updates.active !== undefined && { active: updates.active })
    };

    const dbUser = await userRepository.update(updateData);
    return this.transformDbUser(dbUser);
  }

  static async deleteUser(id: string): Promise<void> {
    await userRepository.delete(id);
  }

  static async getActiveUsers(): Promise<User[]> {
    const dbUsers = await userRepository.findMany({ active: true });
    return dbUsers.map(dbUser => this.transformDbUser(dbUser));
  }
}
```

## Step 4: Type-Safe API Routes

### API Route with Proper Types
```typescript
// src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { UserService, type CreateUserData, type UpdateUserData } from '@/lib/services/user-service';
import { z } from 'zod';

// Request validation schemas
const CreateUserSchema = z.object({
  name: z.string().optional(),
  email: z.string().email(),
  emailVerified: z.string().datetime().optional(),
  image: z.string().url().optional(),
  active: z.boolean().optional()
});

const UpdateUserSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  emailVerified: z.string().datetime().optional(),
  image: z.string().url().optional(),
  active: z.boolean().optional()
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const active = searchParams.get('active');
    
    let users;
    if (active === 'true') {
      users = await UserService.getActiveUsers();
    } else {
      // Implement getAllUsers if needed
      users = await UserService.getActiveUsers(); // Placeholder
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
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
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
    console.error('Error creating user:', error);
    
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
        error: 'Failed to create user',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
```

## Step 5: Type-Safe Error Handling

### Custom Error Types
```typescript
// src/lib/errors/database-errors.ts
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(
    resource: string,
    public readonly id?: string
  ) {
    super(`${resource} not found${id ? ` with id: ${id}` : ''}`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(
    message: string,
    public readonly conflictingField?: string,
    public readonly conflictingValue?: unknown
  ) {
    super(message);
    this.name = 'ConflictError';
  }
}
```

### Type-Safe Error Handler
```typescript
// src/lib/utils/error-handler.ts
import { NextResponse } from 'next/server';
import { DatabaseError, ValidationError, NotFoundError, ConflictError } from '../errors/database-errors';

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

export function handleError(error: unknown): NextResponse<ErrorResponse> {
  console.error('Error occurred:', error);

  if (error instanceof ValidationError) {
    return NextResponse.json({
      success: false,
      error: error.message,
      code: 'VALIDATION_ERROR',
      details: {
        field: error.field,
        value: error.value
      }
    }, { status: 400 });
  }

  if (error instanceof NotFoundError) {
    return NextResponse.json({
      success: false,
      error: error.message,
      code: 'NOT_FOUND'
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
      }
    }, { status: 409 });
  }

  if (error instanceof DatabaseError) {
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code || 'DATABASE_ERROR',
      details: error.details
    }, { status: 500 });
  }

  // Generic error
  return NextResponse.json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    details: {
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }, { status: 500 });
}
```

## Step 6: Type-Safe Caching

### Typed Cache Service
```typescript
// src/lib/cache/typed-cache.ts
import { dbCache, CacheUtils } from './db-cache';

export class TypedCacheService<T> {
  constructor(private namespace: string) {}

  async get(key: string): Promise<T | null> {
    const cached = await dbCache.get<T>(this.namespace, key);
    return cached || null;
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    await dbCache.set(this.namespace, key, value, ttl);
  }

  async delete(key: string): Promise<void> {
    await dbCache.delete(this.namespace, key);
  }

  async deletePattern(pattern: string): Promise<void> {
    await dbCache.deletePattern(this.namespace, pattern);
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
}

// Typed cache instances
export const userCache = new TypedCacheService<DatabaseUser>('users');
export const sessionCache = new TypedCacheService<DatabaseSession>('sessions');
export const roleCache = new TypedCacheService<DatabaseRole>('roles');
```

### Type-Safe Cached Service
```typescript
// src/lib/services/cached-user-service.ts
import { UserService, type User } from './user-service';
import { userCache } from '../cache/typed-cache';
import { CacheUtils } from '../cache/db-cache';

export class CachedUserService {
  static async getUserById(userId: string): Promise<User | null> {
    const cacheKey = CacheUtils.userKey(userId, 'profile');
    
    // Try cache first
    const cached = await userCache.get(cacheKey);
    if (cached) {
      return UserService.transformDbUser(cached);
    }

    // Fetch from database
    const user = await UserService.getUserById(userId);
    if (user) {
      // Cache the database result
      const dbUser: DatabaseUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        email_verified: user.emailVerified?.toISOString() || null,
        image: user.image,
        active: user.active,
        created_at: user.createdAt.toISOString(),
        updated_at: user.updatedAt.toISOString()
      };
      
      await userCache.set(cacheKey, dbUser, 3600); // 1 hour TTL
    }

    return user;
  }

  static async updateUser(id: string, updates: UpdateUserData): Promise<User> {
    // Update in database
    const user = await UserService.updateUser(id, updates);
    
    // Invalidate cache
    await userCache.invalidateUserCache(id);
    
    return user;
  }

  static async deleteUser(id: string): Promise<void> {
    // Delete from database
    await UserService.deleteUser(id);
    
    // Invalidate cache
    await userCache.invalidateUserCache(id);
  }
}
```

## Step 7: TypeScript Configuration

### Strict TypeScript Configuration
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "forceConsistentCasingInFileNames": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "scripts"]
}
```

### ESLint Configuration for Type Safety
```json
// .eslintrc.json
{
  "extends": [
    "next/core-web-vitals",
    "@typescript-eslint/recommended",
    "@typescript-eslint/recommended-requiring-type-checking"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json"
  },
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/prefer-nullish-coalescing": "error",
    "@typescript-eslint/prefer-optional-chain": "error",
    "@typescript-eslint/no-non-null-assertion": "error"
  }
}
```

## Step 8: Testing Type Safety

### Type-Safe Test Utilities
```typescript
// src/lib/__tests__/type-safety.test.ts
import { UserService, type User, type CreateUserData } from '../services/user-service';
import { userRepository, type DatabaseUser } from '../db/typed-repository';

describe('Type Safety Tests', () => {
  test('should create user with proper types', async () => {
    const userData: CreateUserData = {
      name: 'Test User',
      email: 'test@example.com',
      active: true
    };

    const user: User = await UserService.createUser(userData);
    
    // TypeScript should enforce these types
    expect(typeof user.id).toBe('string');
    expect(typeof user.name).toBe('string');
    expect(typeof user.email).toBe('string');
    expect(user.emailVerified).toBeInstanceOf(Date);
    expect(typeof user.active).toBe('boolean');
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);

    // Cleanup
    await UserService.deleteUser(user.id);
  });

  test('should handle null values properly', async () => {
    const userData: CreateUserData = {
      email: 'test2@example.com'
      // name is optional and should be null
    };

    const user: User = await UserService.createUser(userData);
    
    expect(user.name).toBeNull();
    expect(user.emailVerified).toBeNull();
    expect(user.image).toBeNull();

    // Cleanup
    await UserService.deleteUser(user.id);
  });

  test('should transform database user correctly', () => {
    const dbUser: DatabaseUser = {
      id: 'test-id',
      name: 'Test User',
      email: 'test@example.com',
      email_verified: '2023-01-01T00:00:00.000Z',
      image: null,
      active: true,
      created_at: '2023-01-01T00:00:00.000Z',
      updated_at: '2023-01-01T00:00:00.000Z'
    };

    const user = UserService.transformDbUser(dbUser);
    
    expect(user.emailVerified).toBeInstanceOf(Date);
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });
});
```

## Common Issues and Solutions

### Issue: Generic Repository Returns
- **Problem**: Repository methods return `unknown`
- **Solution**: Use type assertions with proper error handling

### Issue: Date Handling
- **Problem**: SQLite stores dates as strings
- **Solution**: Transform dates consistently in service layer

### Issue: Optional Fields
- **Problem**: Database allows null, TypeScript expects defined
- **Solution**: Use proper union types (`string | null`)

### Issue: NextAuth Type Compatibility
- **Problem**: Adapter methods have strict type requirements
- **Solution**: Use proper NextAuth adapter types

## Best Practices

1. **Use Type Assertions Sparingly**: Only when you're certain of the type
2. **Create Service Layer**: Transform database types to domain types
3. **Validate Input**: Use schemas for request validation
4. **Handle Errors Properly**: Use custom error types
5. **Cache Types**: Use typed cache services
6. **Test Types**: Write tests that verify type transformations

## Next Steps

Once type safety is established, proceed to [06-nextauth-adapter.md](./06-nextauth-adapter.md) to implement the custom NextAuth adapter for Noormme.
