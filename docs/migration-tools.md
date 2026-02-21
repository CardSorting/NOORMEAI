# Self-Evolution & DNA Infrastructure

NOORMME provides a sovereign infrastructure for **Self-Evolution**, allowing agents to autonomously mutate their database schema and manage complex structural migrations with **DNA Inversion** (automated rollbacks).

## Features

### 1. Autonomous Structural Growth
Agents can propose and apply DDL mutations (Tables, Columns, Indexes) that are instantly verified and reflected in the system's TypeScript definition layer.

### 2. DNA Inversion (Safe Rollbacks)
The engine automatically generates "Inverse SQL" for any DDL operation, ensuring that autonomous structural changes can be safely reverted if performance drift or logic violations are detected.

### 3. Cross-Dialect Migration (SQLite ↔ PostgreSQL)
Efficiently transmute persistence layers between edge (SQLite) and enterprise (PostgreSQL) environments:
- Schema conversion with type mapping
- Data migration with value transformation
- Index and constraint preservation

## Quick Start

### Basic SQLite to PostgreSQL Migration

```typescript
import { NOORMME, createMigrationManager } from 'noormme'

// Source database (SQLite)
const sourceDb = new NOORMME('sqlite:./source.sqlite')

// Target database (PostgreSQL)
const targetDb = new NOORMME('postgresql://user:pass@localhost:5432/target')

await sourceDb.initialize()
await targetDb.initialize()

// Create migration manager
const migrationManager = createMigrationManager(
  sourceDb.getKysely(),
  targetDb.getKysely(),
  {
    source: {
      dialect: 'sqlite',
      database: './source.sqlite',
    },
    target: {
      dialect: 'postgresql',
      database: 'target',
      host: 'localhost',
      port: 5432,
      username: 'user',
      password: 'pass',
    },
  }
)

// Perform migration
const result = await migrationManager.migrate()

console.log(`Migrated ${result.tablesProcessed} tables with ${result.rowsMigrated} rows`)
```

## Configuration

### Migration Config

```typescript
interface MigrationConfig {
  source: {
    dialect: 'sqlite' | 'postgresql'
    database: string
    host?: string
    port?: number
    username?: string
    password?: string
    ssl?: boolean | object
  }
  target: {
    dialect: 'sqlite' | 'postgresql'
    database: string
    host?: string
    port?: number
    username?: string
    password?: string
    ssl?: boolean | object
  }
  options?: {
    schemaOnly?: boolean
    dataOnly?: boolean
    batchSize?: number
    parallel?: boolean
    parallelWorkers?: number
    dropTables?: boolean
    continueOnError?: boolean
    dryRun?: boolean
    typeMappings?: Record<string, string>
    excludeTables?: string[]
    includeTables?: string[]
    verbose?: boolean
  }
}
```

### Options Explained

- **schemaOnly**: Only migrate schema structure, skip data
- **dataOnly**: Only migrate data, skip schema creation
- **batchSize**: Number of rows to migrate per batch (default: 1000)
- **parallel**: Enable parallel table migration
- **parallelWorkers**: Number of parallel workers (default: 1)
- **dropTables**: Drop existing tables before migration
- **continueOnError**: Continue migration even if errors occur
- **dryRun**: Generate migration plan without executing
- **typeMappings**: Custom type mappings
- **excludeTables**: Tables to exclude from migration
- **includeTables**: Only migrate these tables
- **verbose**: Enable detailed logging

## Usage Examples

### Example 1: Compare Schemas

```typescript
import { compareSchemas, introspectSQLiteSchema, introspectPostgreSQLSchema } from 'noormme/helpers/postgresql'

const sourceSchema = await introspectSQLiteSchema(sourceDb.getKysely())
const targetSchema = await introspectPostgreSQLSchema(targetDb.getKysely())

const comparison = compareSchemas(sourceSchema, targetSchema, 'sqlite', 'postgresql')

console.log(`Compatible: ${comparison.compatible}`)
console.log(`Differences: ${comparison.differences.length}`)
```

### Example 2: Generate Sync SQL

```typescript
const syncResult = await migrationManager.syncSchema({
  generateSQL: true,
  apply: false,  // Don't apply, just generate SQL
})

console.log('SQL to sync schemas:')
syncResult.sqlStatements.forEach(sql => console.log(sql))
```

### Example 3: Schema-Only Migration

```typescript
const result = await migrationManager.migrate()

// Only migrate schema
const config = {
  // ... config
  options: {
    schemaOnly: true,
  },
}
```

### Example 4: Selective Table Migration

```typescript
const config = {
  // ... config
  options: {
    includeTables: ['users', 'posts', 'comments'],
    batchSize: 500,
  },
}
```

### Example 5: Progress Tracking

```typescript
import type { DataMigrationProgress } from 'noormme/helpers/postgresql'

const config = {
  // ... config
  options: {
    onProgress: (progress: DataMigrationProgress) => {
      console.log(
        `${progress.table}: ${progress.percentage.toFixed(1)}% ` +
        `(${progress.current}/${progress.total})`
      )
    },
  },
}
```

### Example 6: PostgreSQL to SQLite (Reverse)

```typescript
// Source is PostgreSQL, target is SQLite
const sourceDb = new NOORMME('postgresql://user:pass@localhost:5432/source')
const targetDb = new NOORMME('sqlite:./target.sqlite')

const config = {
  source: {
    dialect: 'postgresql',
    database: 'source',
    host: 'localhost',
    port: 5432,
    username: 'user',
    password: 'pass',
  },
  target: {
    dialect: 'sqlite',
    database: './target.sqlite',
  },
}
```

## Type Mappings

### SQLite to PostgreSQL

| SQLite Type | PostgreSQL Type |
|------------|----------------|
| INTEGER    | INTEGER        |
| REAL       | REAL           |
| TEXT       | TEXT           |
| BLOB       | BYTEA          |
| BOOLEAN    | BOOLEAN        |
| DATETIME   | TIMESTAMP      |

### PostgreSQL to SQLite

| PostgreSQL Type | SQLite Type |
|----------------|-------------|
| INTEGER        | INTEGER     |
| BIGINT         | INTEGER     |
| REAL           | REAL        |
| TEXT           | TEXT        |
| BYTEA          | BLOB        |
| BOOLEAN        | INTEGER     |
| TIMESTAMP      | TEXT        |
| JSON/JSONB     | TEXT        |
| UUID           | TEXT        |
| Arrays         | TEXT (JSON) |

### Custom Type Mappings

```typescript
const config = {
  // ... config
  options: {
    typeMappings: {
      'custom_type': 'text',
      'special_int': 'bigint',
    },
  },
}
```

## Value Transformations

NOORMME automatically transforms values between database types:

### Boolean Values

```typescript
// PostgreSQL to SQLite: true/false -> 1/0
// SQLite to PostgreSQL: 1/0 -> true/false
```

### Arrays (PostgreSQL only)

```typescript
// PostgreSQL to SQLite: [1, 2, 3] -> "[1,2,3]" (JSON string)
// SQLite to PostgreSQL: "[1,2,3]" -> [1, 2, 3]
```

### JSON/JSONB

```typescript
// PostgreSQL to SQLite: {key: "value"} -> '{"key":"value"}'
// SQLite to PostgreSQL: '{"key":"value"}' -> {key: "value"}
```

### Date/Time

```typescript
// PostgreSQL to SQLite: Date object -> ISO string
// SQLite to PostgreSQL: ISO string -> Date object
```

## Migration Results

```typescript
interface MigrationResult {
  success: boolean
  duration: number
  tablesProcessed: number
  rowsMigrated: number
  errors: MigrationError[]
  warnings: string[]
  summary: {
    schemaChanges: number
    dataChanges: number
    indexesCreated: number
    constraintsApplied: number
  }
}
```

## Error Handling

```typescript
const result = await migrationManager.migrate()

if (!result.success) {
  console.error('Migration failed!')
  result.errors.forEach(err => {
    console.error(`Table: ${err.table}`)
    console.error(`Message: ${err.message}`)
    console.error(`Fatal: ${err.fatal}`)
  })
}

if (result.warnings.length > 0) {
  console.log('Warnings:')
  result.warnings.forEach(warning => {
    console.log(`- ${warning}`)
  })
}
```

## Best Practices

### 1. Test First

Always test migrations on a copy of your database first:

```typescript
// Create a backup before migrating
const backup = './backup.sqlite'
// ... copy database

// Test migration
const testResult = await migrationManager.migrate()

// Verify results before proceeding with production
```

### 2. Use Schema-Only First

Migrate schema first, verify, then migrate data:

```typescript
// Step 1: Migrate schema
const schemaResult = await migrationManager.migrate()

// Step 2: Verify schema
const comparison = await migrationManager.compareSchemas()

// Step 3: Migrate data if schema is correct
if (comparison.compatible) {
  const dataResult = await migrationManager.migrate()
}
```

### 3. Batch Size Tuning

Adjust batch size based on row size and memory:

```typescript
// For large rows, use smaller batches
const config = {
  options: {
    batchSize: 100,  // Smaller for large rows
  },
}

// For small rows, use larger batches
const config = {
  options: {
    batchSize: 5000,  // Larger for small rows
  },
}
```

### 4. Parallel Migration

Use parallel migration for large databases:

```typescript
const config = {
  options: {
    parallel: true,
    parallelWorkers: 4,  // Number of tables to migrate in parallel
  },
}
```

### 5. Monitor Progress

Track migration progress for long-running operations:

```typescript
const config = {
  options: {
    verbose: true,
    onProgress: (progress) => {
      // Update UI or log progress
      console.log(`${progress.table}: ${progress.percentage.toFixed(1)}%`)
      
      if (progress.estimatedTimeRemaining) {
        console.log(`ETA: ${(progress.estimatedTimeRemaining / 1000).toFixed(0)}s`)
      }
    },
  },
}
```

## Performance Considerations

### Memory Usage

- Use appropriate batch sizes
- Enable parallel processing for independent tables
- Close connections after migration

### Migration Time

Factors affecting migration time:
- Database size
- Network latency (for PostgreSQL)
- Batch size
- Number of indexes
- Foreign key constraints

### Optimization Tips

1. **Drop indexes before data migration, recreate after**
2. **Disable foreign key checks during migration**
3. **Use larger batches for faster migration**
4. **Enable parallel processing when possible**
5. **Migrate during off-peak hours**

## Verification

### Verify Row Counts

```typescript
import { verifyDataMigration } from 'noormme/helpers/postgresql'

for (const table of tables) {
  const verification = await verifyDataMigration(
    sourceDb.getKysely(),
    targetDb.getKysely(),
    table.name
  )
  
  if (!verification.match) {
    console.error(`Mismatch in ${table.name}:`)
    console.error(`  Source: ${verification.sourceCount}`)
    console.error(`  Target: ${verification.targetCount}`)
  }
}
```

### Verify Schema

```typescript
const comparison = await migrationManager.compareSchemas()

if (!comparison.compatible) {
  console.log('Schema differences found:')
  comparison.differences.forEach(diff => {
    console.log(`- ${diff.type}: ${diff.table}`)
  })
}
```

## Troubleshooting

### Common Issues

**Issue**: Type conversion errors

**Solution**: Use custom type mappings

```typescript
const config = {
  options: {
    typeMappings: {
      'problematic_type': 'appropriate_type',
    },
  },
}
```

**Issue**: Foreign key constraint violations

**Solution**: Migrate in correct order or disable constraints temporarily

**Issue**: Out of memory errors

**Solution**: Reduce batch size

```typescript
const config = {
  options: {
    batchSize: 100,  // Smaller batches
  },
}
```

**Issue**: Migration takes too long

**Solution**: Enable parallel processing

```typescript
const config = {
  options: {
    parallel: true,
    parallelWorkers: 4,
  },
}
```

## Advanced Usage

### Custom Value Transformations

For complex transformations, pre-process data:

```typescript
// Example: Transform data before migration
const sourceData = await sourceDb.getKysely()
  .selectFrom('users')
  .selectAll()
  .execute()

const transformedData = sourceData.map(row => ({
  ...row,
  // Custom transformation
  status: mapStatus(row.status),
}))

// Insert into target
await targetDb.getKysely()
  .insertInto('users')
  .values(transformedData)
  .execute()
```

### Incremental Migration

For ongoing synchronization:

```typescript
// Migrate only new/updated records
const lastMigration = await getLastMigrationTimestamp()

const newRecords = await sourceDb.getKysely()
  .selectFrom('users')
  .selectAll()
  .where('updated_at', '>', lastMigration)
  .execute()

// Migrate new records
// ...
```

## API Reference

### createMigrationManager

```typescript
function createMigrationManager(
  sourceDb: Kysely<any>,
  targetDb: Kysely<any>,
  config: MigrationConfig,
  logger?: Logger
): DatabaseMigrationManager
```

### DatabaseMigrationManager

```typescript
class DatabaseMigrationManager {
  migrate(): Promise<MigrationResult>
  compareSchemas(): Promise<SchemaComparisonResult>
  syncSchema(options?: SyncOptions): Promise<SyncResult>
}
```

### Utility Functions

```typescript
// Schema introspection
introspectSQLiteSchema(db: Kysely<any>): Promise<TableSchema[]>
introspectPostgreSQLSchema(db: Kysely<any>): Promise<TableSchema[]>

// Schema comparison
compareSchemas(
  sourceSchema: TableSchema[],
  targetSchema: TableSchema[],
  sourceDialect: 'sqlite' | 'postgresql',
  targetDialect: 'sqlite' | 'postgresql'
): SchemaComparisonResult

// Data migration
migrateTableData(
  sourceDb: Kysely<any>,
  targetDb: Kysely<any>,
  sourceTable: TableSchema,
  targetTable: TableSchema,
  sourceDialect: 'sqlite' | 'postgresql',
  targetDialect: 'sqlite' | 'postgresql',
  options: DataMigrationOptions
): Promise<DataMigrationResult>

// Type mapping
mapType(
  sourceType: string,
  sourceDialect: 'sqlite' | 'postgresql',
  targetDialect: 'sqlite' | 'postgresql'
): string
```

## See Also

- [PostgreSQL Support](../POSTGRESQL_SUPPORT.md)
- [PostgreSQL Features](./postgresql-features.md)
- [SQLite Migration System](../docs/noormme-docs/migration-guides/)
- [Examples](../examples/database-migration-example.ts)

