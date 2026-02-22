# Installation

## Quick Start

Initialize **The Agentic Data Engine** in your project in under 5 minutes.

### 1. Install NOORMME

```bash
npm install noormme
```

### 2. Create Database

```bash
# Create SQLite database
sqlite3 app.db "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT);"
```

### 3. Basic Setup

```typescript
// lib/db.ts
import { NOORMME } from 'noormme'

let db: NOORMME | null = null

export async function getDB(): Promise<NOORMME> {
  if (!db) {
    db = new NOORMME({
      dialect: 'sqlite',
      connection: { database: './app.db' }
    })
    await db.initialize()
  }
  return db
}
```

### 4. Use in Your App

```typescript
// app/users/page.tsx
import { getDB } from '@/lib/db'

export default async function UsersPage() {
  const db = await getDB()
  const users = await db.getRepository('users').findAll()
  
  return (
    <div>
      <h1>Users</h1>
      {users.map(user => (
        <div key={user.id}>
          {user.name} - {user.email}
        </div>
      ))}
    </div>
  )
}
```

That's it! Your agent is ready to explore its cognitive schema via High-Fidelity Sovereign Query Primitives.

## Detailed Installation

### Prerequisites

- Node.js 18+ 
- Next.js 13+ (App Router)
- SQLite database

### Step 1: Install NOORMME

```bash
# Using npm
npm install noormme

# Using yarn
yarn add noormme

# Using pnpm
pnpm add noormme
```

### Step 2: Database Setup

#### Option A: Create Database Manually

```bash
# Create SQLite database
sqlite3 app.db

# Create tables
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT,
  author_id INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

.quit
```

#### Option B: Autonomous DNA Mutation (Sovereign Rollbacks)

```typescript
// mutations/001_genesis.ts
export async function mutate(db: NOORMME) {
  await db.execute(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

export async function invert(db: NOORMME) {
  await db.execute(`DROP TABLE users`)
}
```

```typescript
// Execute Sovereign Evolution
import { createEvolutionEngine } from 'noormme'

const evolutionEngine = await createEvolutionEngine(db, {
  directory: './mutations'
})

await evolutionEngine.evolve()
```

### Step 3: Configure NOORMME

#### Basic Configuration

```typescript
// lib/db.ts
import { NOORMME } from 'noormme'

const db = new NOORMME({
  dialect: 'sqlite',
  connection: {
    database: './app.db'
  }
})

await db.initialize()

### what happens during initialization
When you call `initialize()`, NOORMME performs **Sovereign Provisioning**:
- **Agentic Infrastructure**: Automatically creates 20+ tables (Memories, Goals, Sessions, Cortex Knowledge).
- **Autonomous Discovery**: Scans and maps existing application tables.
- **DNA Synthesis**: Generates real-time TypeScript definitions.
```

#### Production Configuration

```typescript
// lib/db.ts
import { NOORMME } from 'noormme'

let db: NOORMME | null = null

export async function getDB(): Promise<NOORMME> {
  if (!db) {
    db = new NOORMME({
      dialect: 'sqlite',
      connection: {
        database: process.env.DATABASE_URL || './app.db'
      },
      optimization: {
        enableWALMode: true,
        enableForeignKeys: true,
        cacheSize: -64000, // 64MB cache
        synchronous: 'NORMAL'
      },
      logging: {
        level: process.env.NODE_ENV === 'development' ? 'info' : 'error',
        enabled: true
      }
    })
    await db.initialize()
  }
  return db
}
```

### Step 4: Environment Variables

Create `.env.local`:

```bash
# Database
DATABASE_URL=./app.db

# Optional: Custom database path
# DATABASE_URL=/path/to/your/database.db
```

### Step 5: TypeScript Configuration

Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "es5",
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
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

## Next.js Integration Patterns

### Server Components

```typescript
// app/users/page.tsx
import { getDB } from '@/lib/db'

export default async function UsersPage() {
  const db = await getDB()
  const users = await db.getRepository('users').findAll()
  
  return (
    <div>
      <h1>Users</h1>
      {users.map(user => (
        <div key={user.id}>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
        </div>
      ))}
    </div>
  )
}
```

### Server Actions

```typescript
// app/users/actions.ts
'use server'

import { getDB } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function createUser(formData: FormData) {
  const db = await getDB()
  
  await db.getRepository('users').create({
    name: formData.get('name') as string,
    email: formData.get('email') as string
  })
  
  revalidatePath('/users')
}
```

### API Routes

```typescript
// app/api/users/route.ts
import { getDB } from '@/lib/db'

export async function GET() {
  const db = await getDB()
  const users = await db.getRepository('users').findAll()
  
  return Response.json(users)
}

export async function POST(request: Request) {
  const db = await getDB()
  const data = await request.json()
  
  const user = await db.getRepository('users').create(data)
  
  return Response.json(user, { status: 201 })
}
```

### Middleware Integration

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Your middleware logic here
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*'
}
```

## Configuration Options

### Connection Options

```typescript
const db = new NOORMME({
  dialect: 'sqlite',
  connection: {
    database: './app.db', // Database file path
    // Optional: Custom connection options
    host: '',
    port: 0,
    username: '',
    password: ''
  }
})
```

### Optimization Options

```typescript
const db = new NOORMME({
  dialect: 'sqlite',
  connection: { database: './app.db' },
  optimization: {
    enableWALMode: true,        // Enable WAL mode for concurrency
    enableForeignKeys: true,    // Enable foreign key constraints
    cacheSize: -64000,          // Cache size in KB (64MB)
    synchronous: 'NORMAL',      // Synchronous mode
    tempStore: 'MEMORY'         // Use memory for temp storage
  }
})
```

### Logging Options

```typescript
const db = new NOORMME({
  dialect: 'sqlite',
  connection: { database: './app.db' },
  logging: {
    level: 'info',              // Log level: 'error', 'warn', 'info', 'debug'
    enabled: true,              // Enable logging
    logQueries: false,          // Log SQL queries
    logResults: false           // Log query results
  }
})
```

### Introspection Options

```typescript
const db = new NOORMME({
  dialect: 'sqlite',
  connection: { database: './app.db' },
  introspection: {
    excludeTables: ['migrations', 'sqlite_sequence'], // Exclude tables
    includeViews: false,                              // Include views
    customTypeMappings: {                             // Custom type mappings
      'jsonb': 'Record<string, unknown>',
      'decimal': 'number'
    }
  }
})
```

## Troubleshooting

### Common Issues

#### Database File Not Found

```bash
Error: SQLITE_CANTOPEN: unable to open database file
```

**Solution:**
```typescript
// Ensure database directory exists
import { mkdirSync } from 'fs'
import { dirname } from 'path'

const dbPath = './data/app.db'
mkdirSync(dirname(dbPath), { recursive: true })

const db = new NOORMME({
  dialect: 'sqlite',
  connection: { database: dbPath }
})
```

#### Permission Denied

```bash
Error: SQLITE_READONLY: attempt to write a readonly database
```

**Solution:**
```typescript
// Check file permissions
import { access, chmod } from 'fs/promises'

try {
  await access('./app.db', fs.constants.W_OK)
} catch (error) {
  await chmod('./app.db', 0o664)
}
```

#### Database Locked

```bash
Error: SQLITE_BUSY: database is locked
```

**Solution:**
```typescript
// Enable WAL mode for better concurrency
const db = new NOORMME({
  dialect: 'sqlite',
  connection: { database: './app.db' },
  optimization: {
    enableWALMode: true,
    synchronous: 'NORMAL'
  }
})
```

### Debug Mode

Enable debug logging to troubleshoot issues:

```typescript
const db = new NOORMME({
  dialect: 'sqlite',
  connection: { database: './app.db' },
  logging: {
    level: 'debug',
    enabled: true,
    logQueries: true,
    logResults: true
  }
})
```

## Next Steps

Now that you have NOORMME installed and configured:

1. **Read the [Getting Started Guide](./first-agent.md)** to build your first app
2. **Explore the [Repository Pattern](../noormme-docs/02-repository-pattern.md)** for database operations
3. **Learn about [Migrations](../../docs/migration-tools.md)** for schema management
4. **Check out [Examples](../../examples/)** for real-world usage patterns

Happy coding with NOORMME! 🚀
