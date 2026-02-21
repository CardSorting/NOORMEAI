# API Reference

This document provides comprehensive API documentation for the schema discovery system.

## Core Classes

### SchemaDiscovery

The main entry point for schema discovery operations.

```typescript
class SchemaDiscovery {
  constructor(db: Kysely<any>, config?: IntrospectionConfig, dialect?: Dialect)
  
  async discoverSchema(): Promise<SchemaInfo>
  getCoordinator(): SchemaDiscoveryCoordinator
}
```

#### Methods

##### `discoverSchema(): Promise<SchemaInfo>`
Discovers the complete database schema including tables, relationships, and views.

**Returns:** Promise resolving to SchemaInfo object
**Throws:** Error if discovery fails or dialect is unsupported

**Example:**
```typescript
const schema = await schemaDiscovery.discoverSchema()
console.log(`Found ${schema.tables.length} tables`)
```

##### `getCoordinator(): SchemaDiscoveryCoordinator`
Returns the underlying coordinator instance for advanced operations.

**Returns:** SchemaDiscoveryCoordinator instance

### SchemaDiscoveryCoordinator

Central coordinator that manages the discovery process.

```typescript
class SchemaDiscoveryCoordinator {
  static getInstance(): SchemaDiscoveryCoordinator
  
  async discoverSchema(db: Kysely<any>, config?: IntrospectionConfig, dialect?: Dialect): Promise<SchemaInfo>
  getFactory(): DiscoveryFactory
  getCurrentDialect(): string
  getDialectCapabilities(): DatabaseCapabilities
}
```

#### Methods

##### `discoverSchema(db, config?, dialect?): Promise<SchemaInfo>`
Orchestrates schema discovery using dialect-specific coordinators.

**Parameters:**
- `db: Kysely<any>` - Database connection
- `config?: IntrospectionConfig` - Discovery configuration
- `dialect?: Dialect` - Database dialect

**Returns:** Promise resolving to complete schema information

### DiscoveryFactory

Factory for creating dialect-specific discovery services.

```typescript
class DiscoveryFactory {
  static getInstance(): DiscoveryFactory
  
  createTableDiscovery(): TableMetadataDiscovery
  createRelationshipDiscovery(): RelationshipDiscovery
  createViewDiscovery(): ViewDiscovery
  createIndexDiscovery(dialect: string): IndexDiscovery
  createConstraintDiscovery(dialect: string): ConstraintDiscovery
  createDiscoveryCoordinator(dialect: string): DialectCoordinator
  
  getSupportedDialects(): string[]
  isDialectSupported(dialect: string): boolean
  getDialectCapabilities(dialect: string): DatabaseCapabilities
}
```

#### Methods

##### `createDiscoveryCoordinator(dialect: string): DialectCoordinator`
Creates a dialect-specific discovery coordinator.

**Parameters:**
- `dialect: string` - Database dialect name

**Returns:** Dialect-specific coordinator instance
**Throws:** Error if dialect is not supported

**Example:**
```typescript
const factory = DiscoveryFactory.getInstance()
const coordinator = factory.createDiscoveryCoordinator('postgresql')
```

##### `getSupportedDialects(): string[]`
Returns list of supported database dialects.

**Returns:** Array of supported dialect names

##### `isDialectSupported(dialect: string): boolean`
Checks if a dialect is supported.

**Parameters:**
- `dialect: string` - Dialect name to check

**Returns:** True if dialect is supported

## Dialect-Specific Coordinators

### PostgreSQLDiscoveryCoordinator

PostgreSQL-specific schema discovery coordinator.

```typescript
class PostgreSQLDiscoveryCoordinator {
  static getInstance(): PostgreSQLDiscoveryCoordinator
  
  async discoverSchema(db: Kysely<any>, config?: IntrospectionConfig): Promise<SchemaInfo>
  getCapabilities(): PostgreSQLCapabilities
  async getRecommendations(db: Kysely<any>, tables: TableInfo[]): Promise<string[]>
}
```

#### Methods

##### `discoverSchema(db, config?): Promise<SchemaInfo>`
Discovers PostgreSQL schema with enhanced metadata.

**Features:**
- Uses `pg_tables`, `pg_index`, `pg_constraint` system tables
- Includes performance statistics from `pg_stat_*` views
- Supports deferred constraints and partial indexes
- JSONB and array type support

##### `getCapabilities(): PostgreSQLCapabilities`
Returns PostgreSQL-specific capabilities.

**Returns:**
```typescript
{
  supportsViews: true
  supportsIndexes: true
  supportsConstraints: true
  supportsForeignKeys: true
  supportsCheckConstraints: true
  supportsDeferredConstraints: true
  supportsPartialIndexes: true
  supportsExpressionIndexes: true
  supportsConcurrentIndexCreation: true
  supportsMaterializedViews: true
  supportsCustomTypes: true
  supportsExtensions: true
}
```

### SQLiteDiscoveryCoordinator

SQLite-specific schema discovery coordinator.

```typescript
class SQLiteDiscoveryCoordinator {
  static getInstance(): SQLiteDiscoveryCoordinator
  
  async discoverSchema(db: Kysely<any>, config?: IntrospectionConfig): Promise<SchemaInfo>
  getCapabilities(): SQLiteCapabilities
  async getRecommendations(db: Kysely<any>, tables: TableInfo[]): Promise<string[]>
  getConfigurationRecommendations(): string[]
}
```

#### Methods

##### `discoverSchema(db, config?): Promise<SchemaInfo>`
Discovers SQLite schema using native features.

**Features:**
- Uses `sqlite_master` and `PRAGMA` commands
- Checks foreign key support status
- Provides integrity verification
- Includes optimization recommendations

##### `getConfigurationRecommendations(): string[]`
Returns SQLite configuration recommendations.

**Returns:** Array of configuration suggestions

## Discovery Services

### TableMetadataDiscovery

Generic table metadata discovery service.

```typescript
class TableMetadataDiscovery {
  static getInstance(): TableMetadataDiscovery
  
  async discoverTables(introspector: DatabaseIntrospector, config?: SchemaDiscoveryConfig): Promise<TableInfo[]>
  async getTableStatistics(introspector: DatabaseIntrospector, tableName: string): Promise<any>
  validateTableStructure(table: TableInfo): ValidationResult
}
```

### RelationshipDiscovery

Foreign key relationship discovery service.

```typescript
class RelationshipDiscovery {
  static getInstance(): RelationshipDiscovery
  
  async discoverRelationships(tables: TableInfo[]): Promise<RelationshipInfo[]>
  analyzeRelationshipPatterns(tables: TableInfo[]): RelationshipPatterns
  validateRelationships(tables: TableInfo[]): ValidationResult
}
```

### ViewDiscovery

Database view discovery service.

```typescript
class ViewDiscovery {
  static getInstance(): ViewDiscovery
  
  async discoverViews(introspector: DatabaseIntrospector): Promise<ViewMetadata[]>
  async getViewDefinition(introspector: DatabaseIntrospector, viewName: string): Promise<string | null>
  validateView(view: ViewMetadata): ValidationResult
}
```

## Specialized Discovery Services

### PostgreSQLIndexDiscovery

PostgreSQL-specific index discovery.

```typescript
class PostgreSQLIndexDiscovery {
  static getInstance(): PostgreSQLIndexDiscovery
  
  async discoverTableIndexes(db: Kysely<any>, tableName: string): Promise<PostgreSQLIndexInfo[]>
  async getIndexUsageStats(db: Kysely<any>, tableName: string): Promise<IndexUsageStats[]>
  analyzeIndexEfficiency(indexes: any[], usageStats: any[]): IndexAnalysis
}
```

#### Methods

##### `discoverTableIndexes(db, tableName): Promise<PostgreSQLIndexInfo[]>`
Discovers indexes for a specific table using PostgreSQL system tables.

**Returns:**
```typescript
interface PostgreSQLIndexInfo {
  name: string
  columns: string[]
  unique: boolean
  isPrimary: boolean
  valid: boolean
  definition: string
  comment?: string
}
```

##### `getIndexUsageStats(db, tableName): Promise<IndexUsageStats[]>`
Retrieves index usage statistics from `pg_stat_user_indexes`.

**Returns:**
```typescript
interface IndexUsageStats {
  indexName: string
  scans: number
  tuplesRead: number
  tuplesFetched: number
  unused: boolean
}
```

### SQLiteIndexDiscovery

SQLite-specific index discovery.

```typescript
class SQLiteIndexDiscovery {
  static getInstance(): SQLiteIndexDiscovery
  
  async discoverTableIndexes(db: Kysely<any>, tableName: string): Promise<SQLiteIndexInfo[]>
  async getIndexInfo(db: Kysely<any>, tableName: string): Promise<any[]>
  analyzeIndexEfficiency(indexes: any[]): IndexAnalysis
  async getTableSize(db: Kysely<any>, tableName: string): Promise<TableSizeInfo>
}
```

## Type Definitions

### Core Types

```typescript
interface SchemaInfo {
  tables: TableInfo[]
  relationships: RelationshipInfo[]
  views: ViewInfo[]
}

interface TableInfo {
  name: string
  schema?: string
  columns: ColumnInfo[]
  primaryKey?: string[]
  indexes: IndexInfo[]
  foreignKeys: ForeignKeyInfo[]
}

interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  defaultValue?: any
  isPrimaryKey: boolean
  isAutoIncrement: boolean
  maxLength?: number
  precision?: number
  scale?: number
}

interface IndexInfo {
  name: string
  columns: string[]
  unique: boolean
}

interface ForeignKeyInfo {
  name: string
  column: string
  referencedTable: string
  referencedColumn: string
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION'
}

interface RelationshipInfo {
  name: string
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many'
  fromTable: string
  fromColumn: string
  toTable: string
  toColumn: string
}
```

### Configuration Types

```typescript
interface IntrospectionConfig {
  excludeTables?: string[]
  includeViews?: boolean
  customTypeMappings?: { [dbType: string]: string }
}

interface SchemaDiscoveryConfig {
  excludeTables?: string[]
  includeViews?: boolean
  customTypeMappings?: { [dbType: string]: string }
}
```

### Capability Types

```typescript
interface DatabaseCapabilities {
  supportsViews: boolean
  supportsIndexes: boolean
  supportsConstraints: boolean
  supportsForeignKeys: boolean
  supportsCheckConstraints: boolean
  supportsDeferredConstraints: boolean
  supportsPartialIndexes?: boolean
  supportsExpressionIndexes?: boolean
  supportsConcurrentIndexCreation?: boolean
  supportsMaterializedViews?: boolean
  supportsCustomTypes?: boolean
  supportsExtensions?: boolean
}
```

## Error Handling

### Error Types

```typescript
class UnsupportedDialectError extends Error {
  constructor(dialect: string)
}

class DiscoveryError extends Error {
  constructor(message: string, cause?: Error)
}

class ValidationError extends Error {
  constructor(message: string, issues: string[])
}
```

### Error Handling Patterns

```typescript
try {
  const schema = await coordinator.discoverSchema(db, config)
} catch (error) {
  if (error instanceof UnsupportedDialectError) {
    console.error(`Dialect not supported: ${error.dialect}`)
  } else if (error instanceof DiscoveryError) {
    console.error(`Discovery failed: ${error.message}`)
    console.error(`Cause: ${error.cause}`)
  } else {
    console.error(`Unexpected error: ${error.message}`)
  }
}
```

## Usage Examples

### Basic Usage

```typescript
import { NOORMME } from 'noormme'

const db = new NOORMME({
  dialect: 'postgresql',
  connection: { /* connection config */ }
})

await db.initialize()
// Schema discovery happens automatically
```

### Advanced Usage

```typescript
import { DiscoveryFactory, PostgreSQLDiscoveryCoordinator } from 'noormme'

const factory = DiscoveryFactory.getInstance()
const coordinator = factory.createDiscoveryCoordinator('postgresql')

const schema = await coordinator.discoverSchema(db, {
  includeViews: true,
  excludeTables: ['temp_*', 'audit_*']
})

// Get PostgreSQL-specific recommendations
const recommendations = await coordinator.getRecommendations(db, schema.tables)
console.log('Recommendations:', recommendations)
```

### Custom Configuration

```typescript
const schema = await coordinator.discoverSchema(db, {
  excludeTables: ['logs', 'sessions'],
  includeViews: true,
  customTypeMappings: {
    'uuid': 'string',
    'jsonb': 'Record<string, any>'
  }
})
```

### Capability Checking

```typescript
const factory = DiscoveryFactory.getInstance()
const capabilities = factory.getDialectCapabilities('postgresql')

if (capabilities.supportsMaterializedViews) {
  // Use materialized view features
}

if (capabilities.supportsDeferredConstraints) {
  // Use deferred constraint features
}
```
