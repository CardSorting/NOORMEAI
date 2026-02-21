# Implementation Guide

This guide provides step-by-step instructions for implementing new database dialects and extending the schema discovery system.

## Adding a New Database Dialect

### Step 1: Create Dialect Directory Structure

```bash
mkdir -p src/schema/dialects/mysql/{discovery,introspection,builders}
```

### Step 2: Implement Core Discovery Services

#### Index Discovery (`mysql/discovery/mysql-index-discovery.ts`)

```typescript
import type { Kysely } from '../../../../kysely.js'

export class MySQLIndexDiscovery {
  private static instance: MySQLIndexDiscovery

  static getInstance(): MySQLIndexDiscovery {
    if (!MySQLIndexDiscovery.instance) {
      MySQLIndexDiscovery.instance = new MySQLIndexDiscovery()
    }
    return MySQLIndexDiscovery.instance
  }

  async discoverTableIndexes(db: Kysely<any>, tableName: string): Promise<any[]> {
    try {
      const indexes = await db
        .selectFrom('information_schema.statistics as s')
        .select([
          's.index_name as name',
          's.column_name as column',
          sql<boolean>`s.non_unique = 0`.as('unique'),
          sql<boolean>`s.index_name = 'PRIMARY'`.as('isPrimary'),
          sql<string>`s.index_type`.as('type'),
          sql<string>`s.comment`.as('comment')
        ])
        .where('s.table_schema', '=', 'database()')
        .where('s.table_name', '=', tableName)
        .execute()

      // Group by index name and aggregate columns
      const groupedIndexes = this.groupIndexesByName(indexes)
      return groupedIndexes
    } catch (error) {
      console.warn(`Failed to discover indexes for MySQL table ${tableName}:`, error)
      return []
    }
  }

  private groupIndexesByName(indexes: any[]): any[] {
    const grouped = new Map<string, any>()
    
    for (const index of indexes) {
      if (!grouped.has(index.name)) {
        grouped.set(index.name, {
          name: index.name,
          columns: [],
          unique: index.unique,
          isPrimary: index.isPrimary,
          type: index.type,
          comment: index.comment
        })
      }
      grouped.get(index.name)!.columns.push(index.column)
    }

    return Array.from(grouped.values())
  }
}
```

#### Constraint Discovery (`mysql/discovery/mysql-constraint-discovery.ts`)

```typescript
export class MySQLConstraintDiscovery {
  private static instance: MySQLConstraintDiscovery

  static getInstance(): MySQLConstraintDiscovery {
    if (!MySQLConstraintDiscovery.instance) {
      MySQLConstraintDiscovery.instance = new MySQLConstraintDiscovery()
    }
    return MySQLConstraintDiscovery.instance
  }

  async discoverTableConstraints(db: Kysely<any>, tableName: string): Promise<any[]> {
    try {
      const constraints = await db
        .selectFrom('information_schema.table_constraints as tc')
        .leftJoin('information_schema.key_column_usage as kcu', 
          (join) => join.onRef('tc.constraint_name', '=', 'kcu.constraint_name')
                     .onRef('tc.table_schema', '=', 'kcu.table_schema'))
        .leftJoin('information_schema.referential_constraints as rc',
          (join) => join.onRef('tc.constraint_name', '=', 'rc.constraint_name'))
        .select([
          'tc.constraint_name as name',
          'tc.constraint_type as type',
          'kcu.column_name as column',
          'kcu.referenced_table_name as referencedTable',
          'kcu.referenced_column_name as referencedColumn',
          sql<string>`rc.delete_rule`.as('onDelete'),
          sql<string>`rc.update_rule`.as('onUpdate')
        ])
        .where('tc.table_schema', '=', 'database()')
        .where('tc.table_name', '=', tableName)
        .execute()

      return constraints
    } catch (error) {
      console.warn(`Failed to discover constraints for MySQL table ${tableName}:`, error)
      return []
    }
  }
}
```

### Step 3: Create Dialect Coordinator

#### MySQL Discovery Coordinator (`mysql/mysql-discovery.coordinator.ts`)

```typescript
import type { Kysely } from '../../../kysely.js'
import { SchemaInfo, IntrospectionConfig } from '../../../types/index.js'
import { TableMetadataDiscovery } from '../../core/discovery/table-metadata-discovery.js'
import { RelationshipDiscovery } from '../../core/discovery/relationship-discovery.js'
import { ViewDiscovery } from '../../core/discovery/view-discovery.js'
import { MySQLIndexDiscovery } from './discovery/mysql-index-discovery.js'
import { MySQLConstraintDiscovery } from './discovery/mysql-constraint-discovery.js'

export class MySQLDiscoveryCoordinator {
  private static instance: MySQLDiscoveryCoordinator
  private tableDiscovery: TableMetadataDiscovery
  private relationshipDiscovery: RelationshipDiscovery
  private viewDiscovery: ViewDiscovery
  private indexDiscovery: MySQLIndexDiscovery
  private constraintDiscovery: MySQLConstraintDiscovery

  private constructor() {
    this.tableDiscovery = TableMetadataDiscovery.getInstance()
    this.relationshipDiscovery = RelationshipDiscovery.getInstance()
    this.viewDiscovery = ViewDiscovery.getInstance()
    this.indexDiscovery = MySQLIndexDiscovery.getInstance()
    this.constraintDiscovery = MySQLConstraintDiscovery.getInstance()
  }

  static getInstance(): MySQLDiscoveryCoordinator {
    if (!MySQLDiscoveryCoordinator.instance) {
      MySQLDiscoveryCoordinator.instance = new MySQLDiscoveryCoordinator()
    }
    return MySQLDiscoveryCoordinator.instance
  }

  async discoverSchema(
    db: Kysely<any>,
    config: IntrospectionConfig = {}
  ): Promise<SchemaInfo> {
    // Implementation similar to PostgreSQL/SQLite coordinators
    // but using MySQL-specific services
  }

  getCapabilities() {
    return {
      supportsViews: true,
      supportsIndexes: true,
      supportsConstraints: true,
      supportsForeignKeys: true,
      supportsCheckConstraints: false, // MySQL 8.0+
      supportsDeferredConstraints: false,
      supportsPartialIndexes: true,
      supportsExpressionIndexes: true,
      supportsConcurrentIndexCreation: true,
      supportsMaterializedViews: false,
      supportsCustomTypes: false,
      supportsExtensions: false,
      supportsAutoIncrement: true,
      supportsCharacterSets: true,
      supportsCollations: true
    }
  }
}
```

### Step 4: Update Factory

#### Add MySQL Support to DiscoveryFactory

```typescript
// In discovery-factory.ts
import { MySQLDiscoveryCoordinator } from '../../dialects/mysql/mysql-discovery.coordinator.js'
import { MySQLIndexDiscovery } from '../../dialects/mysql/discovery/mysql-index-discovery.js'
import { MySQLConstraintDiscovery } from '../../dialects/mysql/discovery/mysql-constraint-discovery.js'

export class DiscoveryFactory {
  createDiscoveryCoordinator(dialect: string): PostgreSQLDiscoveryCoordinator | SQLiteDiscoveryCoordinator | MySQLDiscoveryCoordinator {
    switch (dialect.toLowerCase()) {
      case 'postgresql':
      case 'postgres':
        return PostgreSQLDiscoveryCoordinator.getInstance()
      case 'sqlite':
        return SQLiteDiscoveryCoordinator.getInstance()
      case 'mysql':
      case 'mariadb':
        return MySQLDiscoveryCoordinator.getInstance()
      default:
        throw new Error(`Unsupported dialect for discovery coordinator: ${dialect}`)
    }
  }

  createIndexDiscovery(dialect: string): PostgreSQLIndexDiscovery | SQLiteIndexDiscovery | MySQLIndexDiscovery {
    switch (dialect.toLowerCase()) {
      case 'postgresql':
      case 'postgres':
        return PostgreSQLIndexDiscovery.getInstance()
      case 'sqlite':
        return SQLiteIndexDiscovery.getInstance()
      case 'mysql':
      case 'mariadb':
        return MySQLIndexDiscovery.getInstance()
      default:
        throw new Error(`Unsupported dialect for index discovery: ${dialect}`)
    }
  }

  createConstraintDiscovery(dialect: string): PostgreSQLConstraintDiscovery | SQLiteConstraintDiscovery | MySQLConstraintDiscovery {
    switch (dialect.toLowerCase()) {
      case 'postgresql':
      case 'postgres':
        return PostgreSQLConstraintDiscovery.getInstance()
      case 'sqlite':
        return SQLiteConstraintDiscovery.getInstance()
      case 'mysql':
      case 'mariadb':
        return MySQLConstraintDiscovery.getInstance()
      default:
        throw new Error(`Unsupported dialect for constraint discovery: ${dialect}`)
    }
  }

  getSupportedDialects(): string[] {
    return ['postgresql', 'postgres', 'sqlite', 'mysql', 'mariadb']
  }

  getDialectCapabilities(dialect: string): DatabaseCapabilities {
    switch (dialect.toLowerCase()) {
      case 'postgresql':
      case 'postgres':
        return {
          supportsViews: true,
          supportsIndexes: true,
          supportsConstraints: true,
          supportsForeignKeys: true,
          supportsCheckConstraints: true,
          supportsDeferredConstraints: true,
          supportsPartialIndexes: true,
          supportsExpressionIndexes: true,
          supportsConcurrentIndexCreation: true,
          supportsMaterializedViews: true,
          supportsCustomTypes: true,
          supportsExtensions: true
        }
      case 'sqlite':
        return {
          supportsViews: true,
          supportsIndexes: true,
          supportsConstraints: true,
          supportsForeignKeys: false,
          supportsCheckConstraints: true,
          supportsDeferredConstraints: false,
          supportsPartialIndexes: true,
          supportsExpressionIndexes: true,
          supportsConcurrentIndexCreation: false,
          supportsMaterializedViews: false,
          supportsCustomTypes: false,
          supportsExtensions: false,
          supportsPRAGMA: true,
          supportsAutoIncrement: true,
          supportsRowId: true
        }
      case 'mysql':
      case 'mariadb':
        return {
          supportsViews: true,
          supportsIndexes: true,
          supportsConstraints: true,
          supportsForeignKeys: true,
          supportsCheckConstraints: false,
          supportsDeferredConstraints: false,
          supportsPartialIndexes: true,
          supportsExpressionIndexes: true,
          supportsConcurrentIndexCreation: true,
          supportsMaterializedViews: false,
          supportsCustomTypes: false,
          supportsExtensions: false,
          supportsAutoIncrement: true,
          supportsCharacterSets: true,
          supportsCollations: true
        }
      default:
        return {
          supportsViews: false,
          supportsIndexes: false,
          supportsConstraints: false,
          supportsForeignKeys: false,
          supportsCheckConstraints: false,
          supportsDeferredConstraints: false
        }
    }
  }
}
```

### Step 5: Update Exports

#### Add MySQL Exports to index.ts

```typescript
// MySQL Dialect
export { MySQLDiscoveryCoordinator } from './dialects/mysql/mysql-discovery.coordinator.js'
export { MySQLIndexDiscovery } from './dialects/mysql/discovery/mysql-index-discovery.js'
export { MySQLConstraintDiscovery } from './dialects/mysql/discovery/mysql-constraint-discovery.js'
```

## Best Practices

### 1. Error Handling

Always wrap database queries in try-catch blocks:

```typescript
try {
  const result = await db.executeQuery({ sql: query, parameters: [] })
  return result.rows
} catch (error) {
  console.warn(`Failed to execute query: ${error.message}`)
  return []
}
```

### 2. Performance Optimization

Use parallel processing for multiple operations:

```typescript
const [indexes, constraints, foreignKeys] = await Promise.all([
  this.indexDiscovery.discoverTableIndexes(db, tableName),
  this.constraintDiscovery.discoverTableConstraints(db, tableName),
  this.constraintDiscovery.discoverForeignKeyConstraints(db, tableName)
])
```

### 3. Type Safety

Always define proper TypeScript interfaces:

```typescript
interface MySQLIndexInfo {
  name: string
  columns: string[]
  unique: boolean
  isPrimary: boolean
  type: 'BTREE' | 'HASH' | 'FULLTEXT' | 'SPATIAL'
  comment?: string
}
```

### 4. Capability Reporting

Always implement accurate capability reporting:

```typescript
getCapabilities() {
  return {
    supportsViews: true,
    supportsIndexes: true,
    // ... other capabilities
  }
}
```

### 5. Testing

Create comprehensive tests for your dialect:

```typescript
describe('MySQL Discovery', () => {
  it('should discover table indexes', async () => {
    const discovery = MySQLIndexDiscovery.getInstance()
    const indexes = await discovery.discoverTableIndexes(db, 'users')
    expect(indexes).to.have.length.greaterThan(0)
  })
})
```

## Common Patterns

### 1. System Table Queries

Most databases use system tables for metadata:

```typescript
// PostgreSQL
const tables = await db.selectFrom('pg_tables').select('*').execute()

// MySQL
const tables = await db.selectFrom('information_schema.tables').select('*').execute()

// SQLite
const tables = await db.selectFrom('sqlite_master').select('*').execute()
```

### 2. Index Discovery

Group indexes by name and aggregate columns:

```typescript
private groupIndexesByName(indexes: any[]): any[] {
  const grouped = new Map<string, any>()
  
  for (const index of indexes) {
    if (!grouped.has(index.name)) {
      grouped.set(index.name, {
        name: index.name,
        columns: [],
        unique: index.unique
      })
    }
    grouped.get(index.name)!.columns.push(index.column)
  }

  return Array.from(grouped.values())
}
```

### 3. Constraint Discovery

Handle different constraint types:

```typescript
const constraints = constraints.map(constraint => ({
  name: constraint.constraint_name,
  type: constraint.constraint_type,
  column: constraint.column_name,
  referencedTable: constraint.referenced_table_name,
  referencedColumn: constraint.referenced_column_name
}))
```

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure database user has access to system tables
2. **Query Syntax**: Verify SQL syntax for your database version
3. **Type Mappings**: Check column type mappings in TypeMapper
4. **Connection Issues**: Verify database connection and credentials

### Debugging Tips

1. Enable debug logging to see executed queries
2. Test queries directly in database client
3. Check database version compatibility
4. Verify system table/view existence
