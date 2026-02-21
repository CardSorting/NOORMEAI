# PostgreSQL-Specific Features

NOORMME provides comprehensive support for PostgreSQL-specific features, allowing you to leverage the full power of PostgreSQL while maintaining type safety and a clean API.

## Table of Contents

1. [Array Column Types](#array-column-types)
2. [JSON/JSONB Support](#jsonjsonb-support)
3. [Vector Search (PGVector)](#vector-search-pgvector)
4. [Deep Telemetry Persistence](#deep-telemetry-persistence)
5. [Full-Text Search](#full-text-search)
6. [Materialized Views](#materialized-views)

## Array Column Types

PostgreSQL's array types allow you to store multiple values in a single column. NOORMME provides full support for array types with helper functions for common operations.

### Supported Array Types

- `text[]` - Array of text values
- `varchar[]` - Array of varchar values
- `integer[]` - Array of integers
- `bigint[]` - Array of big integers
- `smallint[]` - Array of small integers
- `numeric[]` / `decimal[]` - Array of numeric values
- `real[]` / `double precision[]` - Array of floating-point numbers
- `boolean[]` - Array of boolean values
- `date[]` - Array of dates
- `timestamp[]` / `timestamptz[]` - Array of timestamps
- `uuid[]` - Array of UUIDs
- `json[]` / `jsonb[]` - Array of JSON values

### Creating Tables with Array Columns

```typescript
import { createPostgresNoormme } from 'noormme/helpers/postgresql'

const db = createPostgresNoormme({
  host: 'localhost',
  port: 5432,
  database: 'myapp',
  user: 'postgres',
  password: 'secret',
})

await db.initialize()

// Create table with array columns
await db.kysely.schema
  .createTable('posts')
  .addColumn('id', 'serial', col => col.primaryKey())
  .addColumn('title', 'text', col => col.notNull())
  .addColumn('tags', 'text[]')
  .addColumn('scores', 'integer[]')
  .addColumn('metadata', 'jsonb[]')
  .execute()
```

### Array Operations

```typescript
import { PostgresArrayHelpers } from 'noormme/helpers/postgresql'

// Create an array literal
const result = await db.kysely
  .insertInto('posts')
  .values({
    title: 'My Post',
    tags: PostgresArrayHelpers.array(['typescript', 'postgresql', 'noormme']),
  })
  .returningAll()
  .executeTakeFirst()

// Check if array contains value
const posts = await db.kysely
  .selectFrom('posts')
  .selectAll()
  .where(PostgresArrayHelpers.contains('tags', ['typescript']))
  .execute()

// Check if arrays overlap
const relatedPosts = await db.kysely
  .selectFrom('posts')
  .selectAll()
  .where(PostgresArrayHelpers.overlap('tags', ['typescript', 'javascript']))
  .execute()

// Get array length
const postStats = await db.kysely
  .selectFrom('posts')
  .select('id')
  .select(PostgresArrayHelpers.length('tags').as('tag_count'))
  .execute()

// Append element to array
await db.kysely
  .updateTable('posts')
  .set({ tags: PostgresArrayHelpers.append('tags', 'new-tag') })
  .where('id', '=', 1)
  .execute()

// Remove element from array
await db.kysely
  .updateTable('posts')
  .set({ tags: PostgresArrayHelpers.remove('tags', 'old-tag') })
  .where('id', '=', 1)
  .execute()

// Unnest array to rows
const allTags = await db.kysely
  .selectFrom('posts')
  .select(PostgresArrayHelpers.unnest('tags').as('tag'))
  .execute()
```

## JSON/JSONB Support

PostgreSQL supports JSON and JSONB (binary JSON) data types. JSONB is generally preferred for better performance and indexing capabilities.

### Creating Tables with JSON Columns

```typescript
await db.kysely.schema
  .createTable('users')
  .addColumn('id', 'serial', col => col.primaryKey())
  .addColumn('name', 'text', col => col.notNull())
  .addColumn('metadata', 'jsonb')
  .addColumn('config', 'json')
  .execute()
```

### JSON Operations

```typescript
import { PostgresJSONHelpers } from 'noormme/helpers/postgresql'

// Insert JSON data
await db.kysely
  .insertInto('users')
  .values({
    name: 'John Doe',
    metadata: JSON.stringify({
      email: 'john@example.com',
      address: {
        city: 'New York',
        zip: '10001',
      },
    }),
  })
  .execute()

// Extract JSON field as text
const users = await db.kysely
  .selectFrom('users')
  .select('name')
  .select(PostgresJSONHelpers.extract('metadata', 'email').as('email'))
  .execute()

// Extract nested JSON field
const addresses = await db.kysely
  .selectFrom('users')
  .select('name')
  .select(PostgresJSONHelpers.extractPath('metadata', ['address', 'city']).as('city'))
  .execute()

// Check if JSON has key
const usersWithEmail = await db.kysely
  .selectFrom('users')
  .selectAll()
  .where(PostgresJSONHelpers.hasKey('metadata', 'email'))
  .execute()

// Check if JSON has any of the keys
const contactable = await db.kysely
  .selectFrom('users')
  .selectAll()
  .where(PostgresJSONHelpers.hasAnyKey('metadata', ['email', 'phone']))
  .execute()

// Check if JSON has all keys
const complete = await db.kysely
  .selectFrom('users')
  .selectAll()
  .where(PostgresJSONHelpers.hasAllKeys('metadata', ['email', 'phone', 'address']))
  .execute()

// Check if JSONB contains value
const activeUsers = await db.kysely
  .selectFrom('users')
  .selectAll()
  .where(PostgresJSONHelpers.contains('metadata', { status: 'active' }))
  .execute()

// Set JSON field value
await db.kysely
  .updateTable('users')
  .set({
    metadata: PostgresJSONHelpers.set('metadata', ['address', 'city'], 'San Francisco'),
  })
  .where('id', '=', 1)
  .execute()

// Delete JSON field
await db.kysely
  .updateTable('users')
  .set({
    metadata: PostgresJSONHelpers.delete('metadata', 'temporary_field'),
  })
  .where('id', '=', 1)
  .execute()
```

## Vector Search (PGVector)

NOORMME provides first-class support for `pgvector`, enabling high-performance semantic search for your agent's long-term memory.

### Configuration
```typescript
const db = new NOORMME({
  dialect: 'postgresql',
  // ... connection
  agentic: {
    vectorProvider: 'pgvector'
  }
})
```

### Semantic Querying
- **Native Efficiency**: Uses PostgreSQL's `<->` and `<=>` operators for L2 and Cosine distance.
- **HNSW Indexing**: Automatically recommends and manages HNSW indexes for blazing-fast retrieval at scale.

## Deep Telemetry Persistence

NOORMME leverages PostgreSQL's relational power and `JSONB` efficiency to persist high-fidelity behavioral telemetry across three layers:

1. **Raw Event Stream**: Uses bulk insertion and partition-ready schemas to handle massive throughput of agent interactions.
2. **Behavioral Summaries**: Serializes complex "Evolution Paths" and "Strategic Pivots" into optimized `JSONB` columns for rapid historical analysis.
3. **Research Metrics**: Persists high-order signals (Autonomy Gradient, Discovery Index) with millisecond-precision timestamps.

## Full-Text Search

PostgreSQL provides powerful full-text search capabilities using the `tsvector` and `tsquery` data types.

### Creating Tables with Full-Text Search

```typescript
import { PostgresFullTextHelpers } from 'noormme/helpers/postgresql'

// Create table with tsvector column
await db.kysely.schema
  .createTable('articles')
  .addColumn('id', 'serial', col => col.primaryKey())
  .addColumn('title', 'text', col => col.notNull())
  .addColumn('content', 'text', col => col.notNull())
  .addColumn('search_vector', 'tsvector')
  .execute()

// Create GIN index for fast full-text search
await PostgresFullTextHelpers.createGINIndex(db.kysely, 'articles', 'search_vector')

// Alternative: Add a generated tsvector column
await PostgresFullTextHelpers.addGeneratedTSVectorColumn(
  db.kysely,
  'articles',
  'search_vector',
  ['title', 'content'],
  'english'
)
```

### Full-Text Search Operations

```typescript
// Insert data with tsvector
await db.kysely
  .insertInto('articles')
  .values({
    title: 'Introduction to TypeScript',
    content: 'TypeScript is a typed superset of JavaScript...',
    search_vector: PostgresFullTextHelpers.toTSVector('title || content', 'english'),
  })
  .execute()

// Search for articles
const results = await db.kysely
  .selectFrom('articles')
  .selectAll()
  .where(PostgresFullTextHelpers.match('search_vector', 'TypeScript & programming'))
  .execute()

// Search with ranking
const rankedResults = await db.kysely
  .selectFrom('articles')
  .selectAll()
  .select(PostgresFullTextHelpers.rank('search_vector', 'TypeScript').as('rank'))
  .where(PostgresFullTextHelpers.match('search_vector', 'TypeScript'))
  .orderBy('rank', 'desc')
  .execute()

// Generate search headline (highlighting)
const withExcerpts = await db.kysely
  .selectFrom('articles')
  .select('title')
  .select(PostgresFullTextHelpers.headline('content', 'TypeScript').as('excerpt'))
  .where(PostgresFullTextHelpers.match('search_vector', 'TypeScript'))
  .execute()

// Use plain text query (simpler syntax)
const simpleSearch = await db.kysely
  .selectFrom('articles')
  .selectAll()
  .where(eb => 
    sql`${eb.ref('search_vector')} @@ ${PostgresFullTextHelpers.plainToTSQuery('typescript programming')}`
  )
  .execute()
```

### Full-Text Search Languages

PostgreSQL supports multiple languages for full-text search:

- `english` (default)
- `spanish`
- `french`
- `german`
- `italian`
- `portuguese`
- And many more...

```typescript
// Use Spanish language configuration
await PostgresFullTextHelpers.addGeneratedTSVectorColumn(
  db.kysely,
  'articulos',
  'search_vector',
  ['titulo', 'contenido'],
  'spanish'
)
```

## Materialized Views

Materialized views are pre-computed query results stored as tables. They're useful for expensive queries that don't need real-time data.

### Creating Materialized Views

```typescript
import { PostgresMaterializedViewHelpers } from 'noormme/helpers/postgresql'
import { sql } from 'noormme'

// Create a materialized view
await PostgresMaterializedViewHelpers.create(
  db.kysely,
  'user_statistics',
  sql`
    SELECT 
      user_id,
      COUNT(*) as post_count,
      MAX(created_at) as latest_post,
      AVG(score) as average_score
    FROM posts
    GROUP BY user_id
  `
)

// Create without data (populate later)
await PostgresMaterializedViewHelpers.create(
  db.kysely,
  'user_statistics',
  sql`SELECT ...`,
  { withData: false }
)
```

### Refreshing Materialized Views

```typescript
// Refresh materialized view
await PostgresMaterializedViewHelpers.refresh(db.kysely, 'user_statistics')

// Refresh without data
await PostgresMaterializedViewHelpers.refresh(db.kysely, 'user_statistics', {
  withData: false,
})

// Concurrent refresh (requires unique index)
await PostgresMaterializedViewHelpers.refresh(db.kysely, 'user_statistics', {
  concurrently: true,
})
```

### Managing Materialized Views

```typescript
// Create unique index (enables concurrent refresh)
await PostgresMaterializedViewHelpers.createUniqueIndex(
  db.kysely,
  'user_statistics',
  ['user_id']
)

// Get materialized view information
const info = await PostgresMaterializedViewHelpers.getInfo(db.kysely, 'user_statistics')
console.log('View is populated:', info?.ispopulated)
console.log('Has indexes:', info?.hasindexes)

// Drop materialized view
await PostgresMaterializedViewHelpers.drop(db.kysely, 'user_statistics', {
  ifExists: true,
  cascade: false,
})
```

### Querying Materialized Views

```typescript
// Query materialized view like a regular table
const stats = await db.kysely
  .selectFrom('user_statistics')
  .selectAll()
  .where('post_count', '>', 10)
  .orderBy('average_score', 'desc')
  .execute()
```

### Automatic Refresh Strategies

While NOORMME doesn't provide built-in automatic refresh, you can implement it using various strategies:

#### 1. Time-Based Refresh

```typescript
// Refresh every hour
setInterval(async () => {
  await PostgresMaterializedViewHelpers.refresh(db.kysely, 'user_statistics', {
    concurrently: true,
  })
}, 60 * 60 * 1000)
```

#### 2. Trigger-Based Refresh

```typescript
// Create a trigger function
await sql`
  CREATE OR REPLACE FUNCTION refresh_user_statistics()
  RETURNS TRIGGER AS $$
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_statistics;
    RETURN NULL;
  END;
  $$ LANGUAGE plpgsql
`.execute(db.kysely)

// Create trigger
await sql`
  CREATE TRIGGER refresh_stats_trigger
  AFTER INSERT OR UPDATE OR DELETE ON posts
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_user_statistics()
`.execute(db.kysely)
```

#### 3. On-Demand Refresh

```typescript
// Refresh when data changes
async function createPost(data: PostData) {
  await db.kysely.insertInto('posts').values(data).execute()
  
  // Refresh materialized view
  await PostgresMaterializedViewHelpers.refresh(db.kysely, 'user_statistics', {
    concurrently: true,
  })
}
```

## Type Safety

NOORMME's PostgreSQL features maintain full type safety:

```typescript
import { Generated, ColumnType } from 'noormme'

interface Database {
  posts: {
    id: Generated<number>
    title: string
    tags: Array<string> | null
    metadata: {
      author: string
      category: string
    } | null
    search_vector: string | null
    created_at: ColumnType<Date, string | undefined, never>
  }
}

const db = createPostgresNoormme({ /* ... */ })
await db.initialize()

// Type-safe queries
const posts = await db.kysely
  .selectFrom('posts')
  .selectAll()
  .where(PostgresArrayHelpers.contains('tags', ['typescript']))
  .execute()

// posts is typed as Array<{ id: number, title: string, tags: string[] | null, ... }>
```

## Best Practices

### Array Types

1. **Index Discovery**: Automated identification of B-Tree, Hash, GIN, and GIST indexes through the formalized `IndexTypeNode` system.
2. **Unified Execution**: Uses the hardened `executeQuery` facade for consistent performance monitoring across all drivers.
3. **Consider normalization**: For large collections, use a separate table

```typescript
// Good: Small, fixed-size collection
tags: ['typescript', 'postgresql', 'noormme']

// Consider separate table instead:
// post_tags: { post_id, tag }
```

### JSON/JSONB Types

1. **Prefer JSONB over JSON** - Better performance and indexing
2. **Don't overuse JSON** - Use for truly unstructured data
3. **Index commonly queried fields** - Create indexes on JSON paths

```typescript
// Create index on JSON field
await sql`
  CREATE INDEX user_email_idx 
  ON users ((metadata->>'email'))
`.execute(db.kysely)
```

### Full-Text Search

1. **Use generated columns** - Automatic tsvector updates
2. **Create GIN indexes** - Essential for performance
3. **Choose appropriate language** - Improves search quality
4. **Use ts_rank for relevance** - Sort by relevance score

### Materialized Views

1. **Use for expensive queries** - Pre-compute complex aggregations
2. **Create unique indexes** - Enable concurrent refresh
3. **Refresh strategically** - Balance freshness vs. performance
4. **Monitor view staleness** - Track last refresh time

## Migration Example

Here's a complete example of migrating to use PostgreSQL-specific features:

```typescript
import { Kysely, sql } from 'noormme'
import {
  PostgresArrayHelpers,
  PostgresFullTextHelpers,
  PostgresMaterializedViewHelpers,
} from 'noormme/helpers/postgresql'

export async function up(db: Kysely<any>): Promise<void> {
  // Create posts table with PostgreSQL features
  await db.schema
    .createTable('posts')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('title', 'text', col => col.notNull())
    .addColumn('content', 'text', col => col.notNull())
    .addColumn('tags', 'text[]')
    .addColumn('metadata', 'jsonb')
    .execute()

  // Add generated tsvector column
  await PostgresFullTextHelpers.addGeneratedTSVectorColumn(
    db,
    'posts',
    'search_vector',
    ['title', 'content']
  )

  // Create GIN index for full-text search
  await PostgresFullTextHelpers.createGINIndex(db, 'posts', 'search_vector')

  // Create GIN index for array operations
  await sql`CREATE INDEX posts_tags_idx ON posts USING GIN(tags)`.execute(db)

  // Create materialized view
  await PostgresMaterializedViewHelpers.create(
    db,
    'post_statistics',
    sql`
      SELECT 
        unnest(tags) as tag,
        COUNT(*) as post_count
      FROM posts
      WHERE tags IS NOT NULL
      GROUP BY tag
      ORDER BY post_count DESC
    `
  )

  // Create unique index for concurrent refresh
  await PostgresMaterializedViewHelpers.createUniqueIndex(
    db,
    'post_statistics',
    ['tag']
  )
}

export async function down(db: Kysely<any>): Promise<void> {
  await PostgresMaterializedViewHelpers.drop(db, 'post_statistics')
  await db.schema.dropTable('posts').execute()
}
```

## Performance Tips

1. **Index strategically** - Create indexes on frequently queried array/JSON fields
2. **Use JSONB for queries** - JSON is faster for storage, JSONB for queries
3. **Limit array sizes** - Large arrays hurt performance
4. **Use concurrent refresh** - Materialized views stay available during refresh
5. **Monitor query performance** - Use EXPLAIN ANALYZE to optimize

## Resources

- [PostgreSQL Array Documentation](https://www.postgresql.org/docs/current/arrays.html)
- [PostgreSQL JSON Documentation](https://www.postgresql.org/docs/current/datatype-json.html)
- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [PostgreSQL Materialized Views](https://www.postgresql.org/docs/current/rules-materializedviews.html)

