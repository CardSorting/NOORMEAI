# 06 - NextAuth Adapter Migration

This guide covers creating a custom NextAuth adapter for Noormme, replacing the PostgreSQL adapter.

## Overview

We'll create a complete NextAuth adapter that:
- Implements all required NextAuth adapter methods
- Uses Noormme's repository pattern and Kysely integration
- Maintains full type safety
- Handles user, session, account, and verification token management

## Step 1: Understanding NextAuth Adapter Requirements

NextAuth requires these methods:
- `createUser`, `getUser`, `getUserByEmail`, `getUserByAccount`
- `updateUser`, `deleteUser`
- `linkAccount`, `unlinkAccount`
- `createSession`, `getSessionAndUser`, `updateSession`, `deleteSession`
- `createVerificationToken`, `useVerificationToken`

## Step 2: Create the Noormme Adapter

Create `src/lib/auth/noormme-adapter.ts`:

```typescript
import type { Adapter, AdapterAccount, AdapterSession, AdapterUser, VerificationToken } from 'next-auth/adapters';
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

    async getUserByAccount({ providerAccountId, provider }: { providerAccountId: string; provider: string }) {
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
        id: result.id as string,
        name: result.name as string | null,
        email: result.email as string,
        emailVerified: result.email_verified ? new Date(result.email_verified as string) : null,
        image: result.image as string | null,
      };
    },

    async updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, 'id'>) {
      const kysely = db.getKysely();
      
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      
      if (user.name !== undefined) updateData.name = user.name;
      if (user.email !== undefined) updateData.email = user.email;
      if (user.emailVerified !== undefined) updateData.email_verified = user.emailVerified?.toISOString() || null;
      if (user.image !== undefined) updateData.image = user.image;

      const updatedUser = await kysely
        .updateTable('users')
        .set(updateData)
        .where('id', '=', user.id)
        .returningAll()
        .executeTakeFirst();

      if (!updatedUser) {
        throw new Error('User not found');
      }

      return {
        id: updatedUser.id as string,
        name: updatedUser.name as string | null,
        email: updatedUser.email as string,
        emailVerified: updatedUser.email_verified ? new Date(updatedUser.email_verified as string) : null,
        image: updatedUser.image as string | null,
      };
    },

    async deleteUser(userId: string) {
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

    async linkAccount(account: AdapterAccount) {
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

      return account as AdapterAccount;
    },

    async unlinkAccount({ providerAccountId, provider }: { providerAccountId: string; provider: string }) {
      const kysely = db.getKysely();
      
      await kysely
        .deleteFrom('accounts')
        .where('provider', '=', provider)
        .where('provider_account_id', '=', providerAccountId)
        .execute();
    },

    async createSession(session: AdapterSession) {
      const kysely = db.getKysely();
      
      const sessionData = {
        session_token: session.sessionToken,
        user_id: session.userId,
        expires: session.expires.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await kysely.insertInto('sessions').values(sessionData).execute();

      return session as AdapterSession;
    },

    async getSessionAndUser(sessionToken: string) {
      const kysely = db.getKysely();
      
      const result = await kysely
        .selectFrom('sessions')
        .innerJoin('users', 'users.id', 'sessions.user_id')
        .selectAll('users')
        .select(['sessions.session_token', 'sessions.expires'])
        .where('sessions.session_token', '=', sessionToken)
        .executeTakeFirst();

      if (!result) return null;

      return {
        session: {
          sessionToken: result.session_token as string,
          userId: result.id as string,
          expires: new Date(result.expires as string),
        },
        user: {
          id: result.id as string,
          name: result.name as string | null,
          email: result.email as string,
          emailVerified: result.email_verified ? new Date(result.email_verified as string) : null,
          image: result.image as string | null,
        },
      };
    },

    async updateSession(session: Partial<AdapterSession> & Pick<AdapterSession, 'sessionToken'>) {
      const kysely = db.getKysely();
      
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      
      if (session.expires !== undefined) updateData.expires = session.expires.toISOString();
      if (session.userId !== undefined) updateData.user_id = session.userId;

      await kysely
        .updateTable('sessions')
        .set(updateData)
        .where('session_token', '=', session.sessionToken)
        .execute();

      return session as AdapterSession;
    },

    async deleteSession(sessionToken: string) {
      const kysely = db.getKysely();
      
      await kysely
        .deleteFrom('sessions')
        .where('session_token', '=', sessionToken)
        .execute();
    },

    async createVerificationToken(token: VerificationToken) {
      const kysely = db.getKysely();
      
      const tokenData = {
        identifier: token.identifier,
        token: token.token,
        expires: token.expires.toISOString(),
      };

      await kysely.insertInto('verification_tokens').values(tokenData).execute();

      return token as VerificationToken;
    },

    async useVerificationToken({ identifier, token }: { identifier: string; token: string }) {
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

## Step 3: Update NextAuth Configuration

Update your NextAuth configuration to use the Noormme adapter:

**Before (PostgreSQL):**
```typescript
// src/lib/auth.ts
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { db } from './db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  // ... rest of config
});
```

**After (Noormme):**
```typescript
// src/lib/auth.ts
import NextAuth from 'next-auth';
import { NoormmeAdapter } from './auth/noormme-adapter';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: NoormmeAdapter(),
  // ... rest of config
});
```

## Step 4: Key Implementation Details

### Repository Pattern Usage
```typescript
// For simple CRUD operations
const userRepo = db.getRepository('users');
const user = await userRepo.findById(id);
```

### Kysely Integration
```typescript
// For complex queries with joins
const kysely = db.getKysely();
const result = await kysely
  .selectFrom('sessions')
  .innerJoin('users', 'users.id', 'sessions.user_id')
  .selectAll('users')
  .where('sessions.session_token', '=', sessionToken)
  .executeTakeFirst();
```

### Type Safety
```typescript
// Proper type assertions for Noormme's generic returns
const createdUser = await userRepo.create(userData) as Record<string, unknown>;
return {
  id: createdUser.id as string,
  name: createdUser.name as string | null,
  // ...
};
```

### Update Operations
```typescript
// Using Kysely for updates with returning
const updatedUser = await kysely
  .updateTable('users')
  .set(updateData)
  .where('id', '=', user.id)
  .returningAll()
  .executeTakeFirst();
```

## Step 5: Database Schema Requirements

Ensure your SQLite database has the required tables:

```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  email_verified TEXT, -- ISO date string
  image TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Accounts table
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT
);

-- Sessions table
CREATE TABLE sessions (
  session_token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Verification tokens table
CREATE TABLE verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TEXT NOT NULL,
  PRIMARY KEY (identifier, token)
);
```

## Step 6: Testing the Adapter

Create a test script to verify the adapter works correctly:

```typescript
// scripts/test-nextauth-adapter.ts
import { NoormmeAdapter } from '../src/lib/auth/noormme-adapter';
import { initializeDatabase } from '../src/lib/db';

async function testNextAuthAdapter() {
  try {
    console.log('🧪 Testing NextAuth adapter...');
    
    // Initialize database
    await initializeDatabase();
    
    const adapter = NoormmeAdapter();
    
    // Test user creation
    const testUser = {
      name: 'Test User',
      email: 'test@example.com',
      emailVerified: new Date(),
      image: 'https://example.com/avatar.jpg'
    };
    
    const createdUser = await adapter.createUser(testUser);
    console.log('✅ User created:', createdUser.id);
    
    // Test user retrieval
    const retrievedUser = await adapter.getUser(createdUser.id);
    console.log('✅ User retrieved:', retrievedUser?.email);
    
    // Test session creation
    const session = {
      sessionToken: 'test-session-token',
      userId: createdUser.id,
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    };
    
    const createdSession = await adapter.createSession(session);
    console.log('✅ Session created:', createdSession.sessionToken);
    
    // Test session retrieval
    const sessionAndUser = await adapter.getSessionAndUser(session.sessionToken);
    console.log('✅ Session retrieved:', sessionAndUser?.session.sessionToken);
    
    // Cleanup
    await adapter.deleteSession(session.sessionToken);
    await adapter.deleteUser(createdUser.id);
    console.log('✅ Cleanup completed');
    
    console.log('🎉 NextAuth adapter test successful!');
  } catch (error) {
    console.error('❌ NextAuth adapter test failed:', error);
    process.exit(1);
  }
}

testNextAuthAdapter();
```

## Step 7: Error Handling and Edge Cases

### Handle Missing Users
```typescript
async getUser(id: string) {
  const userRepo = db.getRepository('users');
  const user = await userRepo.findById(id) as Record<string, unknown> | null;
  
  if (!user) return null; // NextAuth expects null for missing users
  
  return {
    // ... transform user data
  };
}
```

### Handle Email Verification
```typescript
// Convert Date objects to ISO strings for storage
email_verified: user.emailVerified ? user.emailVerified.toISOString() : null,

// Convert ISO strings back to Date objects
emailVerified: user.email_verified ? new Date(user.email_verified as string) : null,
```

### Handle Foreign Key Constraints
```typescript
async deleteUser(userId: string) {
  const kysely = db.getKysely();
  
  // Delete related records first to avoid foreign key constraint errors
  await kysely.deleteFrom('sessions').where('user_id', '=', userId).execute();
  await kysely.deleteFrom('accounts').where('user_id', '=', userId).execute();
  // ... other related tables
  
  // Delete user last
  await kysely.deleteFrom('users').where('id', '=', userId).execute();
}
```

## Common Issues and Solutions

### Type Assertion Errors
- **Issue**: TypeScript errors with `Record<string, unknown>`
- **Solution**: Use proper type assertions as shown in the examples

### Missing Repository Methods
- **Issue**: Repository methods not available
- **Solution**: Use Kysely for complex operations, repository for simple CRUD

### Session Token Conflicts
- **Issue**: Duplicate session tokens
- **Solution**: Ensure proper cleanup in `deleteSession` and `deleteUser`

### Date Handling
- **Issue**: Date serialization/deserialization issues
- **Solution**: Convert to ISO strings for storage, back to Date objects for return

## Next Steps

Once the NextAuth adapter is working, proceed to [07-rbac-system.md](./07-rbac-system.md) to migrate your role-based access control system.
