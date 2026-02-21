# API Reference

This document provides a comprehensive reference for all Noormme APIs, methods, and interfaces.

## Core Classes

### NOORMME

The main Noormme class for database operations.

```typescript
import { NOORMME } from 'noormme';

const db = new NOORMME(config);
```

#### Constructor

```typescript
constructor(config: NoormmeConfig)
```

**Parameters:**
- `config` (NoormmeConfig): Configuration object

**Example:**
```typescript
const db = new NOORMME({
  dialect: 'sqlite',
  connection: { database: './data/app.db' }
});
```

#### Methods

##### initialize()

Initialize the database connection and apply optimizations.

```typescript
await db.initialize(): Promise<void>
```

**Returns:** Promise that resolves when initialization is complete

**Example:**
```typescript
try {
  await db.initialize();
  console.log('Database initialized successfully');
} catch (error) {
  console.error('Failed to initialize database:', error);
}
```

##### getRepository()

Get a repository for a specific table.

```typescript
db.getRepository(tableName: string): Repository
```

**Parameters:**
- `tableName` (string): Name of the table

**Returns:** Repository instance for the specified table

**Example:**
```typescript
const userRepo = db.getRepository('users');
const roleRepo = db.getRepository('roles');
```

##### getKysely()

Get the Kysely instance for complex queries.

```typescript
db.getKysely(): Kysely
```

**Returns:** Kysely instance for type-safe SQL queries

**Example:**
```typescript
const kysely = db.getKysely();
const result = await kysely
  .selectFrom('users')
  .selectAll()
  .execute();
```

##### getSchemaInfo()

Get database schema information.

```typescript
db.getSchemaInfo(): Promise<SchemaInfo>
```

**Returns:** Promise resolving to schema information

**Example:**
```typescript
const schemaInfo = await db.getSchemaInfo();
console.log('Tables:', schemaInfo.tables);
```

##### getSQLiteOptimizations()

Get SQLite optimization recommendations.

```typescript
db.getSQLiteOptimizations(): Promise<OptimizationRecommendations>
```

**Returns:** Promise resolving to optimization recommendations

**Example:**
```typescript
const optimizations = await db.getSQLiteOptimizations();
console.log('Recommendations:', optimizations.recommendations);
```

## Repository API

### Repository

Repository instances provide CRUD operations for specific tables.

#### Methods

##### findById()

Find a single record by its ID.

```typescript
repository.findById(id: string): Promise<T | null>
```

**Parameters:**
- `id` (string): Record ID

**Returns:** Promise resolving to the record or null if not found

**Example:**
```typescript
const user = await userRepo.findById('123');
if (user) {
  console.log('User found:', user.name);
}
```

##### findAll()

Find multiple records with optional filtering and pagination.

```typescript
repository.findAll(options?: FindOptions): Promise<T[]>
```

**Parameters:**
- `options` (FindOptions, optional): Query options

**FindOptions Interface:**
```typescript
interface FindOptions {
  limit?: number;
  offset?: number;
  where?: Record<string, any>;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}
```

**Returns:** Promise resolving to array of records

**Example:**
```typescript
// Get all users
const users = await userRepo.findAll();

// Get users with pagination
const users = await userRepo.findAll({ 
  limit: 10, 
  offset: 0 
});

// Get users with filtering
const activeUsers = await userRepo.findAll({
  where: { active: true },
  orderBy: 'created_at',
  orderDirection: 'desc'
});
```

##### create()

Create a new record.

```typescript
repository.create(data: Partial<T>): Promise<T>
```

**Parameters:**
- `data` (Partial<T>): Record data

**Returns:** Promise resolving to the created record

**Example:**
```typescript
const newUser = await userRepo.create({
  id: crypto.randomUUID(),
  name: 'John Doe',
  email: 'john@example.com',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});
```

##### update()

Update an existing record.

```typescript
repository.update(id: string, data: Partial<T>): Promise<T>
```

**Parameters:**
- `id` (string): Record ID
- `data` (Partial<T>): Update data

**Returns:** Promise resolving to the updated record

**Example:**
```typescript
const updatedUser = await userRepo.update('123', {
  name: 'Jane Doe',
  updated_at: new Date().toISOString()
});
```

##### delete()

Delete a record.

```typescript
repository.delete(id: string): Promise<void>
```

**Parameters:**
- `id` (string): Record ID

**Returns:** Promise that resolves when deletion is complete

**Example:**
```typescript
await userRepo.delete('123');
```

#### Custom Finder Methods

Repositories automatically generate custom finder methods based on table columns.

##### findManyBy[Column]()

Find multiple records by a specific column value.

```typescript
repository.findManyBy[Column](value: any): Promise<T[]>
```

**Example:**
```typescript
// For a users table with email column
const users = await userRepo.findManyByEmail('john@example.com');

// For a roles table with name column
const roles = await roleRepo.findManyByName('admin');
```

##### findOneBy[Column]()

Find a single record by a specific column value.

```typescript
repository.findOneBy[Column](value: any): Promise<T | null>
```

**Example:**
```typescript
// For a users table with email column
const user = await userRepo.findOneByEmail('john@example.com');
```

## Kysely Integration

### Kysely Instance

The Kysely instance provides type-safe SQL query building.

#### Basic Query Methods

##### selectFrom()

Start a SELECT query.

```typescript
kysely.selectFrom(table: string): SelectQueryBuilder
```

**Example:**
```typescript
const query = kysely.selectFrom('users');
```

##### insertInto()

Start an INSERT query.

```typescript
kysely.insertInto(table: string): InsertQueryBuilder
```

**Example:**
```typescript
const query = kysely.insertInto('users');
```

##### updateTable()

Start an UPDATE query.

```typescript
kysely.updateTable(table: string): UpdateQueryBuilder
```

**Example:**
```typescript
const query = kysely.updateTable('users');
```

##### deleteFrom()

Start a DELETE query.

```typescript
kysely.deleteFrom(table: string): DeleteQueryBuilder
```

**Example:**
```typescript
const query = kysely.deleteFrom('users');
```

#### Query Execution

##### execute()

Execute the query and return all results.

```typescript
query.execute(): Promise<T[]>
```

**Example:**
```typescript
const users = await kysely
  .selectFrom('users')
  .selectAll()
  .execute();
```

##### executeTakeFirst()

Execute the query and return the first result.

```typescript
query.executeTakeFirst(): Promise<T | undefined>
```

**Example:**
```typescript
const user = await kysely
  .selectFrom('users')
  .selectAll()
  .where('id', '=', '123')
  .executeTakeFirst();
```

##### executeTakeFirstOrThrow()

Execute the query and return the first result or throw an error.

```typescript
query.executeTakeFirstOrThrow(): Promise<T>
```

**Example:**
```typescript
const user = await kysely
  .selectFrom('users')
  .selectAll()
  .where('id', '=', '123')
  .executeTakeFirstOrThrow();
```

#### Transaction Support

##### transaction()

Execute operations within a transaction.

```typescript
kysely.transaction(): TransactionBuilder
```

**Example:**
```typescript
await kysely.transaction().execute(async (trx) => {
  await trx.insertInto('users').values(userData).execute();
  await trx.insertInto('user_roles').values(roleData).execute();
});
```

#### Raw SQL Support

##### executeQuery()

Execute raw SQL queries.

```typescript
kysely.executeQuery(query: CompiledQuery): Promise<QueryResult>
```

**Example:**
```typescript
import { sql } from 'kysely';

const result = await kysely.executeQuery(
  sql`SELECT * FROM users WHERE created_at > ${new Date()}`
);
```

## Configuration Interfaces

### NoormmeConfig

Main configuration interface for Noormme.

```typescript
interface NoormmeConfig {
  dialect: 'sqlite';
  connection: {
    database: string;
  };
  automation?: {
    enableAutoOptimization?: boolean;
    enableIndexRecommendations?: boolean;
    enableQueryAnalysis?: boolean;
    enableMigrationGeneration?: boolean;
  };
  performance?: {
    enableCaching?: boolean;
    enableBatchOperations?: boolean;
    maxCacheSize?: number;
  };
  optimization?: {
    enableWALMode?: boolean;
    enableForeignKeys?: boolean;
    cacheSize?: number;
    synchronous?: 'OFF' | 'NORMAL' | 'FULL';
    tempStore?: 'FILE' | 'MEMORY';
  };
}
```

### SchemaInfo

Schema information returned by `getSchemaInfo()`.

```typescript
interface SchemaInfo {
  tables: TableInfo[];
}

interface TableInfo {
  name: string;
  columns: ColumnInfo[];
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  primaryKey: boolean;
  foreignKey?: {
    table: string;
    column: string;
  };
}
```

### OptimizationRecommendations

Optimization recommendations returned by `getSQLiteOptimizations()`.

```typescript
interface OptimizationRecommendations {
  recommendations: string[];
  currentSettings: Record<string, any>;
  suggestedSettings: Record<string, any>;
}
```

## Utility Functions

### Database Initialization

```typescript
// Initialize database
export async function initializeDatabase(): Promise<void>

// Get connection statistics
export function getConnectionStats(): ConnectionStats

// Database health check
export async function healthCheck(): Promise<HealthCheckResult>

// Graceful shutdown
export async function closeDatabase(): Promise<void>
```

### Repository Utilities

```typescript
// Get repository for table
export const getRepository = (tableName: string): Repository

// Get Kysely instance
export const getKysely = (): Kysely

// Get schema information
export const getSchemaInfo = (): Promise<SchemaInfo>

// Get optimization recommendations
export const getOptimizationRecommendations = (): Promise<OptimizationRecommendations>
```

## Error Handling

### Common Error Types

#### DatabaseConnectionError

Thrown when database connection fails.

```typescript
class DatabaseConnectionError extends Error {
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'DatabaseConnectionError';
    this.cause = cause;
  }
}
```

#### QueryExecutionError

Thrown when query execution fails.

```typescript
class QueryExecutionError extends Error {
  constructor(message: string, sql?: string, cause?: Error) {
    super(message);
    this.name = 'QueryExecutionError';
    this.sql = sql;
    this.cause = cause;
  }
}
```

#### ValidationError

Thrown when data validation fails.

```typescript
class ValidationError extends Error {
  constructor(message: string, field?: string, value?: any) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}
```

### Error Handling Best Practices

```typescript
// Wrap database operations in try-catch
try {
  const user = await userRepo.findById('123');
  return user;
} catch (error) {
  if (error instanceof DatabaseConnectionError) {
    console.error('Database connection failed:', error.message);
    // Handle connection error
  } else if (error instanceof QueryExecutionError) {
    console.error('Query execution failed:', error.message, error.sql);
    // Handle query error
  } else {
    console.error('Unexpected error:', error);
    // Handle unexpected error
  }
  throw error;
}
```

## Type Definitions

### Generic Types

```typescript
// Generic record type
type Record = Record<string, any>;

// Generic repository type
type Repository<T = Record> = {
  findById(id: string): Promise<T | null>;
  findAll(options?: FindOptions): Promise<T[]>;
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
  // Custom finder methods are dynamically generated
};

// Generic query builder types
type SelectQueryBuilder = {
  select(columns: string[]): SelectQueryBuilder;
  selectAll(): SelectQueryBuilder;
  where(column: string, operator: string, value: any): SelectQueryBuilder;
  orderBy(column: string, direction?: 'asc' | 'desc'): SelectQueryBuilder;
  limit(count: number): SelectQueryBuilder;
  offset(count: number): SelectQueryBuilder;
  execute(): Promise<Record[]>;
  executeTakeFirst(): Promise<Record | undefined>;
  executeTakeFirstOrThrow(): Promise<Record>;
};

type InsertQueryBuilder = {
  values(data: Record | Record[]): InsertQueryBuilder;
  returning(columns: string[]): InsertQueryBuilder;
  execute(): Promise<Record[]>;
  executeTakeFirst(): Promise<Record | undefined>;
};

type UpdateQueryBuilder = {
  set(data: Partial<Record>): UpdateQueryBuilder;
  where(column: string, operator: string, value: any): UpdateQueryBuilder;
  returning(columns: string[]): UpdateQueryBuilder;
  execute(): Promise<Record[]>;
  executeTakeFirst(): Promise<Record | undefined>;
};

type DeleteQueryBuilder = {
  where(column: string, operator: string, value: any): DeleteQueryBuilder;
  execute(): Promise<void>;
};
```

## Performance Considerations

### Query Optimization

```typescript
// Use selectAll() sparingly
const users = await kysely
  .selectFrom('users')
  .select(['id', 'name', 'email']) // Only select needed columns
  .execute();

// Use limit for large datasets
const recentUsers = await kysely
  .selectFrom('users')
  .selectAll()
  .orderBy('created_at', 'desc')
  .limit(100)
  .execute();

// Use indexes effectively
const userByEmail = await kysely
  .selectFrom('users')
  .selectAll()
  .where('email', '=', 'john@example.com') // Ensure email column is indexed
  .execute();
```

### Batch Operations

```typescript
// Batch insert
const users = [
  { id: crypto.randomUUID(), name: 'User 1', email: 'user1@example.com' },
  { id: crypto.randomUUID(), name: 'User 2', email: 'user2@example.com' },
];

await kysely
  .insertInto('users')
  .values(users)
  .execute();

// Batch update
await kysely
  .updateTable('users')
  .set({ updated_at: new Date().toISOString() })
  .where('id', 'in', ['user1', 'user2', 'user3'])
  .execute();
```

## Next Steps

- [Troubleshooting](./08-troubleshooting.md) - Common issues and solutions
- [Real-World Examples](./05-real-world-examples.md) - Authentication, RBAC, caching examples
- [Configuration Reference](./06-configuration-reference.md) - Complete configuration options
