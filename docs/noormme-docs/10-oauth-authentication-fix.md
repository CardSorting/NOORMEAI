# OAuth Authentication Fix with Noormme

## Overview

This document details how we resolved OAuth authentication issues in the DreamBeesArt application by properly configuring Noormme as the NextAuth.js database adapter.

## Problem Statement

The OAuth authentication was failing with the error:
```
http://localhost:3000/api/auth/signin?error=Callback
```

The root cause was identified as:
```
NOORMME must be initialized before getting repositories. Call await db.initialize() first.
```

## Root Cause Analysis

### Issue 1: Missing Database Tables
- The SQLite database was missing required NextAuth.js tables
- Tables needed: `users`, `accounts`, `sessions`, `verification_tokens`
- Error: `no such table: accounts`

### Issue 2: Noormme Initialization
- The Noormme adapter wasn't being initialized before NextAuth tried to use it
- OAuth callbacks failed because database repositories weren't available
- Error: `NOORMME must be initialized before getting repositories`

### Issue 3: Environment Configuration
- OAuth credentials were hardcoded in startup scripts
- Database URL was pointing to PostgreSQL instead of SQLite
- Missing proper environment variable management

## Solution Implementation

### Step 1: Database Schema Creation

Created all required NextAuth.js tables using the existing schema migration:

```sql
-- Users table (NextAuth.js compatible)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  email_verified TIMESTAMP,
  image TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Accounts table (NextAuth.js compatible)
CREATE TABLE IF NOT EXISTS accounts (
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

-- Sessions table (NextAuth.js compatible)
CREATE TABLE IF NOT EXISTS sessions (
  session_token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Verification tokens table (NextAuth.js compatible)
CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TIMESTAMP NOT NULL,
  PRIMARY KEY (identifier, token)
);
```

Applied the schema:
```bash
sqlite3 data/dreambeesart.db < src/lib/migrations/files/001_initial_schema.sql
```

### Step 2: Noormme Adapter Initialization Fix

Modified `/src/lib/auth/noormme-adapter.ts` to ensure database initialization:

```typescript
import type { Adapter, AdapterAccount, AdapterSession, AdapterUser, VerificationToken } from 'next-auth/adapters';
import { db, initializeDatabase } from '../db/noormme';

// Ensure database is initialized before creating adapter
let adapterInitialized = false;

async function ensureDatabaseInitialized() {
  if (!adapterInitialized) {
    await initializeDatabase();
    adapterInitialized = true;
  }
}

export function NoormmeAdapter(): Adapter {
  return {
    async createUser(user: Omit<AdapterUser, 'id'>) {
      await ensureDatabaseInitialized(); // ← Added this
      const userRepo = db.getRepository('users');
      // ... rest of implementation
    },

    async getUser(id: string) {
      await ensureDatabaseInitialized(); // ← Added this
      const userRepo = db.getRepository('users');
      // ... rest of implementation
    },

    async getUserByEmail(email: string) {
      await ensureDatabaseInitialized(); // ← Added this
      const userRepo = db.getRepository('users');
      // ... rest of implementation
    },

    async getUserByAccount({ providerAccountId, provider }: { providerAccountId: string; provider: string }) {
      await ensureDatabaseInitialized(); // ← Added this (Critical for OAuth)
      const kysely = db.getKysely();
      // ... rest of implementation
    },

    async updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, 'id'>) {
      await ensureDatabaseInitialized(); // ← Added this
      const kysely = db.getKysely();
      // ... rest of implementation
    },

    async linkAccount(account: AdapterAccount) {
      await ensureDatabaseInitialized(); // ← Added this
      const kysely = db.getKysely();
      // ... rest of implementation
    },

    async createSession(session: AdapterSession) {
      await ensureDatabaseInitialized(); // ← Added this
      const kysely = db.getKysely();
      // ... rest of implementation
    }
    // ... other methods also updated
  };
}
```

### Step 3: Environment Configuration

Updated `env.example` with proper configuration:

```bash
# Database Configuration (SQLite)
DATABASE_URL=file:./data/dreambeesart.db

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dreambeesart-secret-key-2024-local-dev

# OAuth Providers
# Google OAuth - Get from https://console.cloud.google.com/
# Uncomment and configure these if you want to use Google login
# GOOGLE_CLIENT_ID=your-google-client-id
# GOOGLE_CLIENT_SECRET=your-google-client-secret

# GitHub OAuth - Get from https://github.com/settings/developers
# These are example values - replace with your own GitHub OAuth app credentials
GITHUB_ID=your-github-client-id
GITHUB_SECRET=your-github-client-secret

# ML Backend URL
NEXT_PUBLIC_ML_BACKEND_URL=http://localhost:8000

# Redis Configuration
REDIS_URL=redis://default:aasdhao9s8y98@108.175.14.173:6380/0

# Debug Configuration (optional)
# DEBUG_AUTH=true
```

Created `.env.local` with working credentials:
```bash
cp env.example .env.local
# Then updated with actual GitHub OAuth credentials
```

### Step 4: Startup Script Improvements

Modified startup script to:
- Load environment variables from `.env.local`
- Warn users if `.env.local` is missing
- Remove hardcoded environment variables

```bash
# Load environment variables from .env.local if it exists
if [ -f ".env.local" ]; then
    echo -e "${BLUE}📄 Loading environment variables from .env.local...${NC}"
    export $(grep -v '^#' .env.local | xargs)
fi

# Check if .env.local exists and warn if it doesn't
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}⚠️  Warning: .env.local not found${NC}"
    echo -e "${YELLOW}   Please copy env.example to .env.local and configure your OAuth credentials${NC}"
    echo -e "${YELLOW}   cp env.example .env.local${NC}"
    echo -e "${YELLOW}   Then edit .env.local with your actual OAuth app credentials${NC}"
    echo ""
fi
```

## Noormme Usage Patterns

### 1. Database Initialization

Noormme requires explicit initialization before use:

```typescript
import { db, initializeDatabase } from '../db/noormme';

// Always initialize before using repositories
await initializeDatabase();
const userRepo = db.getRepository('users');
```

### 2. Repository Pattern

Noormme provides a clean repository pattern for database operations:

```typescript
// Get repository for a table
const userRepo = db.getRepository('users');

// Create user
const user = await userRepo.create({
  id: crypto.randomUUID(),
  name: 'John Doe',
  email: 'john@example.com'
});

// Find by ID
const user = await userRepo.findById(userId);

// Find by email
const users = await userRepo.findManyByEmail(email);
```

### 3. Kysely Integration

For complex queries, Noormme provides Kysely integration:

```typescript
// Get Kysely instance for complex queries
const kysely = db.getKysely();

// Complex join query
const result = await kysely
  .selectFrom('accounts')
  .innerJoin('users', 'users.id', 'accounts.user_id')
  .selectAll('users')
  .where('accounts.provider', '=', provider)
  .where('accounts.provider_account_id', '=', providerAccountId)
  .executeTakeFirst();
```

### 4. Connection Management

Noormme handles connection management automatically:

```typescript
// Health check
export async function healthCheck() {
  try {
    const usersRepo = db.getRepository('users');
    await usersRepo.findAll();
    return { healthy: true };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}
```

## Configuration Details

### Noormme Configuration

```typescript
const db = new NOORMME({
  dialect: 'sqlite',
  connection: {
    host: '',
    port: 0,
    username: '',
    password: '',
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
    enableWALMode: true,
    enableForeignKeys: true,
    cacheSize: -64000,
    synchronous: 'NORMAL',
    tempStore: 'MEMORY'
  }
});
```

### NextAuth.js Configuration

```typescript
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
  // ... callbacks and other configuration
};
```

## Testing Results

### Before Fix
- ❌ OAuth callback errors
- ❌ Missing database tables
- ❌ Noormme initialization errors
- ❌ Hardcoded environment variables

### After Fix
- ✅ OAuth providers working (`/api/auth/providers`)
- ✅ Sign-in page functional (`/api/auth/signin`)
- ✅ Database tables created and accessible
- ✅ Noormme properly initialized
- ✅ Environment variables properly configured
- ✅ GitHub OAuth ready for use

## Key Learnings

1. **Always Initialize Noormme**: The database must be initialized before using any repositories
2. **Adapter Pattern**: NextAuth adapters need proper database initialization checks
3. **Environment Management**: Use `.env.local` for local development, not hardcoded values
4. **Schema Requirements**: NextAuth.js requires specific table structures for OAuth to work
5. **Error Handling**: Proper error handling in adapters prevents OAuth callback failures

## Troubleshooting

### Common Issues

1. **"NOORMME must be initialized"**
   - Solution: Add `await ensureDatabaseInitialized()` to adapter methods

2. **"no such table: accounts"**
   - Solution: Run the schema migration to create required tables

3. **OAuth callback errors**
   - Solution: Ensure environment variables are properly set in `.env.local`

4. **Missing OAuth providers**
   - Solution: Check that OAuth credentials are configured and valid

## Future Improvements

1. **Database Connection Pooling**: Implement connection pooling for better performance
2. **Error Logging**: Add comprehensive error logging for OAuth flows
3. **Health Monitoring**: Implement database health monitoring
4. **Migration Management**: Set up automated database migrations
5. **Security**: Implement proper secret management for production

## Conclusion

By properly configuring Noormme as the NextAuth.js database adapter and ensuring proper initialization, we successfully resolved the OAuth authentication issues. The key was understanding that Noormme requires explicit initialization before use, and NextAuth.js requires specific database table structures for OAuth functionality to work correctly.
