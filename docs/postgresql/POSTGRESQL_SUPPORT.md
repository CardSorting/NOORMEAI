# Neural Storage Layer (PostgreSQL Enterprise)

## Overview

NOORMME deploys PostgreSQL as the **Enterprise Neural Storage Layer** for sovereign agents. While SQLite (Local Cortex) is excellent for edge processing and individual agent deployment, PostgreSQL is required for global hive-mind synchronization, `pgvector` semantic memory, and heavy cognitive workloads.

## 🏛️ Strategic Capabilities

### 1. 🧠 Vector Search (Neural Memory)
First-class support for `pgvector`, enabling blazing-fast semantic search for your agent's long-term memory.
- **Efficiency**: Direct usage of `<->` and `<=>` operators for L2 and Cosine distance.
- **Scale**: Automated recommendation and management of **HNSW** and **IVFFlat** indexes.

### 2. 📊 High-Order Telemetry (JSONB)
Leverages PostgreSQL's `JSONB` efficiency to persist high-fidelity behavioral data across three layers:
- **Event Stream**: Bulk-inserted context of every interaction.
- **Strategic Summaries**: Serialized "Evolution Paths" for historical analysis.
- **Research Metrics**: Transactional persistence of **Autonomy Gradients** and **Discovery Indices**.

### 3. 🧬 Sovereign Evolution
PostgreSQL's advanced DDL capabilities are fully harnessed by the **DNA Inverter** for safe, concurrent schema growth.

## The Enterprise Upgrade

### 1. Neural Routing Architecture

We provide a complete, non-blocking deployment profile for PostgreSQL:

- **`postgresql-dialect-config.ts`**: High-availability tuning and semantic defaults
- **`postgresql-driver.ts`**: Global connection pooling for agent swarms
- **`postgresql-query-compiler.ts`**: Advanced vector search compilation
- **`postgresql-adapter.ts`**: Neural scaling features
- **`postgresql-introspector.ts`**: Deep DNA introspection
- **`postgresql-dialect.ts`**: The central orchestrator

### 2. High-Capacity Neural Pooling

PostgreSQL manages massive concurrency for thousands of simultaneous worker agents via the `pg` layer:

```typescript
const db = new NOORMME({
  dialect: 'postgresql',
  connection: {
    host: 'localhost',
    port: 5432,
    database: 'myapp',
    username: 'postgres',
    password: 'secret',
    ssl: true,
    pool: {
      max: 20,
      min: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }
  }
})
```

---

## ⚡ Practical Vector Search (pgvector)

When using PostgreSQL, you can unlock semantic memory via the `VectorIndexer`.

### 1. Configuration
Enable vector indexing in your `AgenticConfig`.

```typescript
const db = new NOORMME({
  dialect: 'postgresql',
  agentic: {
    vectorConfig: {
      dimensions: 1536, // Standard for OpenAI Ada-002
      tableName: 'neural_memories'
    }
  }
});
```

### 2. Indexing a Thought
Manually index a string with its embedding vector.

```typescript
await db.agent.vectors.addMemory(
  'The autonomous agent discovered a new optimization path for WAL mode.',
  [0.012, -0.045, ...], // Embedding vector
  sessionId
);
```

### 3. Semantic Retrieval
Retrieve the top N semantically similar memories.

```typescript
const results = await db.agent.vectors.searchMemories(
  [0.011, -0.040, ...], // Query vector
  { limit: 5 }
);
```

---

### 3. Connection String Support

Both URL formats are supported:

```typescript
// PostgreSQL URLs
new NOORMME('postgresql://user:pass@localhost:5432/mydb')
new NOORMME('postgres://user:pass@localhost:5432/mydb')

// SQLite URLs
new NOORMME('sqlite:./database.sqlite')

// Environment variable
process.env.DATABASE_URL = 'postgresql://...'
new NOORMME() // Automatically reads from DATABASE_URL
```

### 4. PostgreSQL Helper Module

Created `src/helpers/postgresql.ts` with utility functions:

```typescript
import { createPostgresNoormme, PostgresPresets } from 'noormme/helpers/postgresql'

const db = createPostgresNoormme({
  host: 'localhost',
  database: 'myapp',
  user: 'postgres',
  password: 'secret',
  ...PostgresPresets.production
})
```

### 5. Updated Package Dependencies

- Added `pg` (node-postgres) for PostgreSQL connectivity
- Added `@types/pg` for TypeScript type definitions
- Updated package description and keywords to include PostgreSQL

## Key Features

### Unified API

The same repository pattern works for both SQLite and PostgreSQL:

```typescript
// Works with both SQLite and PostgreSQL
const userRepo = db.getRepository('users')
const users = await userRepo.findAll()
const user = await userRepo.findByEmail('john@example.com')
const activeUsers = await userRepo.findManyByStatus('active')
```

### Schema Introspection

PostgreSQL introspector queries `information_schema` and `pg_catalog` to discover:
- Tables and views
- Columns with data types
- Indexes (including unique and primary keys)
- Foreign key constraints
- Schema metadata

### Transaction Support

PostgreSQL supports full ACID transactions with isolation levels:

```typescript
await db.transaction(async (trx) => {
  await trx.getRepository('users').create({ name: 'John' })
  await trx.getRepository('orders').create({ userId: 1, amount: 100 })
}, { isolationLevel: 'serializable' })
```

### Connection Pooling

Automatic connection pooling with configurable settings:
- Min/max pool size
- Idle timeout
- Connection timeout
- SSL support

## Query Compiler Differences

### PostgreSQL-Specific Features

1. **Parameter Placeholders**: Uses `$1`, `$2`, etc. (vs SQLite's `?`)
2. **Auto-increment**: `GENERATED BY DEFAULT AS IDENTITY` (vs SQLite's `AUTOINCREMENT`)
3. **Boolean Values**: Native `true`/`false` (vs SQLite's 0/1)
4. **Identifier Wrapping**: Double quotes `"table"` (same as SQLite)

## Migration Path

### From SQLite to PostgreSQL

1. Export your SQLite schema
2. Create equivalent PostgreSQL tables
3. Update connection config:

```typescript
// Before (SQLite)
const db = new NOORMME({
  dialect: 'sqlite',
  connection: { database: './app.sqlite' }
})

// After (PostgreSQL)
const db = new NOORMME({
  dialect: 'postgresql',
  connection: {
    host: 'localhost',
    port: 5432,
    database: 'app',
    username: 'postgres',
    password: 'secret'
  }
})
```

**Your application code stays the same!** The repository methods and queries work identically.

## Testing PostgreSQL Support

To test PostgreSQL functionality:

1. Install dependencies:
```bash
pnpm install
```

2. Set up a PostgreSQL database:
```bash
createdb test_noormme
```

3. Run tests:
```bash
pnpm test
```

## Examples

### Basic Usage

```typescript
import { NOORMME } from 'noormme'

const db = new NOORMME({
  dialect: 'postgresql',
  connection: {
    host: 'localhost',
    port: 5432,
    database: 'myapp',
    username: 'postgres',
    password: 'secret'
  }
})

await db.initialize()

const users = db.getRepository('users')
const allUsers = await users.findAll()
```

### Production Configuration

```typescript
import { NOORMME } from 'noormme'

const db = new NOORMME({
  dialect: 'postgresql',
  connection: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.NODE_ENV === 'production',
    pool: {
      max: 20,
      min: 5,
      idleTimeoutMillis: 30000,
    }
  },
  automation: {
    enableAutoOptimization: true,
    enableIndexRecommendations: true,
  },
  performance: {
    enableCaching: true,
    maxCacheSize: 1000
  }
})

await db.initialize()
```

### Advanced Queries

```typescript
// Complex queries with joins and aggregations
const analytics = await db.getKysely()
  .selectFrom('orders')
  .innerJoin('users', 'users.id', 'orders.user_id')
  .select(({ fn }) => [
    'users.email',
    fn.count('orders.id').as('order_count'),
    fn.sum('orders.amount').as('total_spent'),
    fn.avg('orders.amount').as('avg_order'),
  ])
  .where('orders.created_at', '>=', new Date('2024-01-01'))
  .groupBy('users.id')
  .having(({ fn }) => fn.count('orders.id'), '>', 5)
  .execute()
```

## Architecture

### Dialect Structure

```
src/dialect/postgresql/
├── postgresql-adapter.ts          # Dialect-specific features
├── postgresql-dialect-config.ts   # Configuration types
├── postgresql-dialect.ts          # Main dialect class
├── postgresql-driver.ts           # Connection & pooling
├── postgresql-introspector.ts     # Schema introspection
└── postgresql-query-compiler.ts   # Query compilation
```

### Integration Points

1. **NOORMME Core** (`src/noormme.ts`):
   - `createDialect()`: Factory method for creating PostgreSQL dialect
   - `parseConnectionString()`: Parses PostgreSQL URLs
   - `getDefaultPort()`: Returns 5432 for PostgreSQL

2. **Index** (`src/index.ts`):
   - Exports all PostgreSQL classes and types

3. **Package Exports** (`package.json`):
   - Exports `noormme/helpers/postgresql` module

## Best Practices

### Development

- Use SQLite for local development (faster, simpler)
- Use PostgreSQL for staging/production
- Keep connection configs in environment variables

### Production

- Enable SSL in production environments
- Configure appropriate pool sizes based on load
- Monitor connection usage and adjust pool settings
- Use connection strings for easier configuration management

### Security

- Never commit passwords in code
- Use environment variables or secret management
- Enable SSL for remote connections
- Use read-only users for reporting queries

## Advanced Cognitive Features (PostgreSQL Only)

NOORMME unlocks exclusive enterprise intelligence functions when paired with PostgreSQL:

### 1. Vector Embeddings (`pgvector`)

```typescript
import { PostgresVectorHelpers } from 'noormme/helpers/postgresql'

// Retrieve semantically similar memories for logical routing
const semanticMatch = await db.kysely
  .selectFrom('memories')
  .selectAll()
  .orderBy(PostgresVectorHelpers.cosineDistance('embedding', currentThoughtVector))
  .limit(5)
  .execute()
```

### 2. Cognitive JSONB Payloads

Full support for manipulating infinite structured thought logic natively within the database engine:

```typescript
import { PostgresJSONHelpers } from 'noormme/helpers/postgresql'

// Update an agent's internal goal structure mid-thought
await db.kysely
  .updateTable('personas')
  .set({
    heuristics: PostgresJSONHelpers.set('heuristics', ['tactics', 'primary'], 'Observed hostile actor')
  })
  .execute()
```

### 3. Hive-Mind Materialized Views

Pre-compute massive analytics across the swarm:

```typescript
import { PostgresMaterializedViewHelpers } from 'noormme/helpers/postgresql'

// Compile a global assessment of successful inferences
await PostgresMaterializedViewHelpers.create(
  db.kysely,
  'global_hive_metrics',
  sql`SELECT origin_node, COUNT(*) as verified_inferences FROM telemetry_inferences GROUP BY origin_node`
)
```

## Migration: The Evolution Sequence ✅

NOORMME's Sovereign Migration Engine allows you to graduate a Local Cortex (SQLite) seamlessly into a Neural Storage Cluster (PostgreSQL):

```typescript
import { createMigrationManager } from 'noormme/helpers/postgresql'

const localCortex = new NOORMME('sqlite:./agent_mind.sqlite')
const hiveCluster = new NOORMME('postgresql://sovereign:auth@neural-net/hive')

await localCortex.initialize()
await hiveCluster.initialize()

// 100% Autonomous DNA transfer
const sovereignMigration = createMigrationManager(
  localCortex.getKysely(),
  hiveCluster.getKysely(),
  {
    options: {
      batchSize: 5000, // Handle massive memory streaming
      parallel: true,  // Concurrent cognitive mapping
    },
  }
)

const result = await sovereignMigration.migrate()
```

## Future Directives

1. **Self-Healing Partitions**: Automatic data segregation for obsolete memories.
2. **Distributed Foreign Cognition**: Queries across Federated Agent Clusters.
3. **Advanced Vector Pre-Caching**: Next-gen retrieval architecture.

Welcome to the Neural Storage Layer.

