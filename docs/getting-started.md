# Getting Started with NOORMME (The Agentic Data Engine)

Welcome to the future of high-fidelity persistence. NOORMME is designed to be the backbone of your autonomous agent's memory, reasoning loops, and strategic operations.

## 🚀 Installation

### Prerequisites
- Node.js 16+ 
- TypeScript (recommended)
- SQLite database

### Install NOORMME
```bash
npm install noormme
```

### TypeScript Setup (Optional but Recommended)
```bash
npm install -D typescript @types/node tsx
```

## 📝 Quick Start

### 1. Basic Setup
Create a new file `app.ts`:

```typescript
import { NOORMME } from 'noormme'

const db = new NOORMME({
  dialect: 'sqlite',
  connection: {
    database: './app.sqlite'
  }
})

async function main() {
  // Initialize NOORMME
  await db.initialize()
  
  // Get a repository for your table
  const userRepo = db.getRepository('users')
  
  // Use the repository
  const users = await userRepo.findAll()
  console.log('Users:', users)
}

main().catch(console.error)
```

### 2. Run Your App
```bash
npx tsx app.ts
```

- ✅ **Autonomous Schema Discovery** - No manual schema boilerplate.
- ✅ **Dynamic Type Generation** - Real-time alignment with DB state.
- ✅ **Agentic Optimization** - Automatic WAL mode and index monitoring.
- ✅ **Cognitive Initialization** - Memories, Sessions, and the Cortex Mind bridge.

## 🎯 Understanding the Magic

### 1. Initializing the Mind
When you call `db.initialize()`, NOORMME orchestrates a sophisticated structural setup:

1.  **Connects** to your persistence layer (SQLite/PostgreSQL).
2.  **Sovereign Provisioning**: Automatically creates **20+ core agentic tables** (Memories, Sessions, Goals, Knowledge, Logic Probes, and Telemetry).
3.  **Autonomous Discovery**: Scans and maps your existing application schema without manual boilerplate.
4.  **DNA Synthesis**: Generates real-time TypeScript definitions matching your database state.
5.  **Performance Hardening**: Automatically enables WAL mode, optimizes cache sizes, and registers performance drift probes.

### Auto-Generated Features

NOORMME automatically creates:

- **Repository classes** with CRUD operations
- **TypeScript interfaces** for type safety
- **Custom finder methods** based on your columns
- **Relationship handling** for foreign keys
- **Performance optimizations** for SQLite

## 📚 Basic Usage Examples

### CRUD Operations
```typescript
const userRepo = db.getRepository('users')

// Create a new user
const newUser = await userRepo.create({
  name: 'John Doe',
  email: 'john@example.com',
  status: 'active'
})

// Find a user by ID
const user = await userRepo.findById(1)

// Update a user
const updatedUser = await userRepo.update({
  ...user,
  name: 'Jane Doe'
})

// Delete a user
await userRepo.delete(1)

// Get all users
const allUsers = await userRepo.findAll()
```

### Auto-Generated Finder Methods
```typescript
// These methods are automatically generated based on your table columns
const userByEmail = await userRepo.findByEmail('john@example.com')
const activeUsers = await userRepo.findManyByStatus('active')
const usersByRole = await userRepo.findManyByRole('admin')
```

### Pagination
```typescript
const result = await userRepo.paginate({
  page: 1,
  limit: 20,
  where: { status: 'active' },
  orderBy: { column: 'createdAt', direction: 'desc' }
})

console.log('Users:', result.data)
console.log('Total:', result.pagination.total)
console.log('Pages:', result.pagination.totalPages)
```

### Relationships
```typescript
// Load related data
const userWithPosts = await userRepo.findWithRelations(1, ['posts'])

// Count related records
const userWithCounts = await userRepo.withCount(1, ['posts', 'comments'])
```

## ⚙️ Configuration Options

### Basic Configuration
```typescript
const db = new NOORMME({
  dialect: 'sqlite',
  connection: {
    database: './app.sqlite'
  }
})
```

### Advanced Configuration
```typescript
const db = new NOORMME({
  dialect: 'sqlite',
  connection: {
    database: './app.sqlite'
  },
  performance: {
    enableAutoOptimization: true,    // Enable automatic optimizations
    enableQueryOptimization: true,   // Enable query analysis
    enableBatchLoading: true,        // Enable batch loading for relationships
    maxBatchSize: 100                // Maximum batch size
  },
  introspection: {
    excludeTables: ['migrations'],   // Tables to exclude from discovery
    includeViews: false,             // Whether to include database views
    customTypeMappings: {            // Custom type mappings
      'jsonb': 'Record<string, any>'
    }
  },
  cache: {
    ttl: 300000,                     // Cache TTL in milliseconds
    maxSize: 1000                    // Maximum cache size
  },
  logging: {
    level: 'info',                   // Logging level
    enabled: true                    // Enable logging
  }
})
```

## 🔧 Environment Variables

You can also configure NOORMME using environment variables:

```bash
# .env
DATABASE_URL=sqlite:./app.sqlite
NOORM_LOG_LEVEL=info
NOORM_ENABLE_AUTO_OPTIMIZATION=true
```

Then initialize with:
```typescript
const db = new NOORMME() // Automatically reads from .env
await db.initialize()
```

## 🎯 Next Steps

Now that you have NOORMME running, explore these features:

1. **[Schema Discovery](schema-discovery.md)** - Learn how NOORMME discovers your database
2. **[Auto-Optimization](auto-optimization.md)** - Understand performance optimizations
3. **[Repository Pattern](repository-pattern.md)** - Master the repository API
4. **[SQLite Features](sqlite-features.md)** - Explore SQLite-specific features
5. **[Examples](../examples/)** - See real-world usage examples

## 🆘 Getting Help

If you run into issues:

1. Check the [Troubleshooting Guide](troubleshooting.md)
2. Review the [Examples](../examples/)
3. Open an issue on GitHub

## 🎉 Congratulations!

You've successfully set up NOORMME! Your SQLite database is now automatically optimized and ready for production use.

**Happy coding! 🚀**
