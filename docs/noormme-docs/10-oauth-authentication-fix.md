# OAuth Authentication Fix with Noormme

## Overview

This document details how we resolved OAuth authentication issues in production environments by properly configuring Noormme as the NextAuth.js database adapter.

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
- The database was missing required NextAuth.js tables
- Tables needed: `users`, `accounts`, `sessions`, `verification_tokens`
- Error: `no such table: accounts`

### Issue 2: Engine Initialization
- The Noormme adapter wasn't being initialized before NextAuth tried to use it
- OAuth callbacks failed because the **Agentic Data Engine** hadn't yet synthesized the repository layer.
- Error: `NOORMME must be initialized before getting repositories`

### Issue 3: Environment Configuration
- Database URL was inconsistent across environments.
- Missing proper environment variable management for different dialects (SQLite vs PostgreSQL).

## Solution Implementation

### Step 1: Database Schema Creation

Ensure all required NextAuth.js tables exist. For autonomous environments, NOORMME handles this if `enableSelfEvolution` is true, but manual provisioning is recommended for authentication stability.

### Step 2: Adapter Initialization Fix

Modified the NextAuth adapter to ensure the engine is online before any operation:

```typescript
import type { Adapter } from 'next-auth/adapters';
import { db, initializeDatabase } from '../db/noormme';

let engineOnline = false;

async function ensureEngineOnline() {
  if (!engineOnline) {
    await db.initialize();
    engineOnline = true;
  }
}

export function NoormmeAdapter(): Adapter {
  return {
    async createUser(user) {
      await ensureEngineOnline();
      const userRepo = db.getRepository('users');
      // ... rest of implementation
    },

    async getUserByAccount({ providerAccountId, provider }) {
      await ensureEngineOnline(); // Critical for OAuth flow
      const kysely = db.getKysely();
      // ... rest of implementation
    },
    // ... all other methods must call ensureEngineOnline()
  };
}
```

## Noormme Usage Patterns

### 1. Apostolic Initialization

Noormme requires explicit initialization to discover schema DNA and provision agentic tables:

```typescript
import { db } from '../db/noormme';

// Always initialize before using repositories
await db.initialize();
```

### 2. Dialect Agnostic Repositories

The adapter works identically whether using **Local Cortex (SQLite)** or **Neural Storage (PostgreSQL)**:

```typescript
// Get repository for a table
const userRepo = db.getRepository('users');

// Chainable query logic
const user = await userRepo.objects.get({ email: 'agent@sovereign.net' });
```

## Testing Results

### After Fix
- ✅ OAuth providers working
- ✅ Sign-in page functional
- ✅ Database tables created and accessible
- ✅ Engine properly initialized across all serverless cold starts
- ✅ Environment variables properly configured for both dialects

## Key Learnings

1. **Always Initialize the Engine**: The engine must be online before any data interaction.
2. **Adapter Pattern**: NextAuth adapters are often instantiated in serverless contexts where initialization state is not guaranteed.
3. **Dialect Parity**: Ensure your schema is compatible with both your local development (SQLite) and production (PostgreSQL) environments.

---

## Next Steps

- [**Integration Patterns**](../guides/agentic-integration-patterns.md) - Deep dive into Next.js integration.
- [**API Reference**](./07-api-reference.md) - Technical repository specifications.
