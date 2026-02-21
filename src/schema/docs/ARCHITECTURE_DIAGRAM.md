# Schema Discovery Architecture Diagram

## High-Level Architecture

```mermaid
graph TB
    subgraph "Public API Layer"
        A[SchemaDiscovery]
        B[NOORMME]
    end
    
    subgraph "Core Layer"
        C[SchemaDiscoveryCoordinator]
        D[DiscoveryFactory]
    end
    
    subgraph "Dialect Layer"
        E[PostgreSQLDiscoveryCoordinator]
        F[SQLiteDiscoveryCoordinator]
        G[MySQLDiscoveryCoordinator]
        H[MSSQLDiscoveryCoordinator]
    end
    
    subgraph "Service Layer"
        I[TableMetadataDiscovery]
        J[RelationshipDiscovery]
        K[ViewDiscovery]
    end
    
    subgraph "Specialized Services"
        L[PostgreSQLIndexDiscovery]
        M[PostgreSQLConstraintDiscovery]
        N[SQLiteIndexDiscovery]
        O[SQLiteConstraintDiscovery]
    end
    
    A --> C
    B --> A
    C --> D
    D --> E
    D --> F
    D --> G
    D --> H
    
    E --> I
    E --> J
    E --> K
    E --> L
    E --> M
    
    F --> I
    F --> J
    F --> K
    F --> N
    F --> O
    
    G --> I
    G --> J
    G --> K
```

## Data Flow Diagram

```mermaid
sequenceDiagram
    participant Client
    participant SchemaDiscovery
    participant Coordinator
    participant Factory
    participant DialectCoordinator
    participant Services
    
    Client->>SchemaDiscovery: discoverSchema()
    SchemaDiscovery->>Coordinator: discoverSchema(db, config, dialect)
    Coordinator->>Factory: createDiscoveryCoordinator(dialect)
    Factory->>DialectCoordinator: new PostgreSQLDiscoveryCoordinator()
    DialectCoordinator->>Services: discoverTables(introspector, config)
    Services->>Services: Parallel processing
    Services-->>DialectCoordinator: Enhanced table metadata
    DialectCoordinator->>Services: discoverRelationships(tables)
    Services-->>DialectCoordinator: Relationship info
    DialectCoordinator->>Services: discoverViews(introspector)
    Services-->>DialectCoordinator: View metadata
    DialectCoordinator-->>Coordinator: Complete SchemaInfo
    Coordinator-->>SchemaDiscovery: SchemaInfo
    SchemaDiscovery-->>Client: SchemaInfo
```

## Component Relationships

```mermaid
classDiagram
    class SchemaDiscovery {
        -coordinator: SchemaDiscoveryCoordinator
        +discoverSchema() SchemaInfo
        +getCoordinator() SchemaDiscoveryCoordinator
    }
    
    class SchemaDiscoveryCoordinator {
        -factory: DiscoveryFactory
        -currentDialect: string
        +discoverSchema() SchemaInfo
        +getFactory() DiscoveryFactory
        +getCurrentDialect() string
    }
    
    class DiscoveryFactory {
        +createDiscoveryCoordinator(dialect) DialectCoordinator
        +createTableDiscovery() TableMetadataDiscovery
        +createIndexDiscovery(dialect) IndexDiscovery
        +getSupportedDialects() string[]
        +isDialectSupported(dialect) boolean
    }
    
    class PostgreSQLDiscoveryCoordinator {
        -tableDiscovery: TableMetadataDiscovery
        -indexDiscovery: PostgreSQLIndexDiscovery
        -constraintDiscovery: PostgreSQLConstraintDiscovery
        +discoverSchema() SchemaInfo
        +getCapabilities() PostgreSQLCapabilities
        +getRecommendations() string[]
    }
    
    class SQLiteDiscoveryCoordinator {
        -tableDiscovery: TableMetadataDiscovery
        -indexDiscovery: SQLiteIndexDiscovery
        -constraintDiscovery: SQLiteConstraintDiscovery
        +discoverSchema() SchemaInfo
        +getCapabilities() SQLiteCapabilities
        +getRecommendations() string[]
    }
    
    class TableMetadataDiscovery {
        +discoverTables() TableInfo[]
        +getTableStatistics() any
        +validateTableStructure() ValidationResult
    }
    
    class PostgreSQLIndexDiscovery {
        +discoverTableIndexes() PostgreSQLIndexInfo[]
        +getIndexUsageStats() IndexUsageStats[]
        +analyzeIndexEfficiency() IndexAnalysis
    }
    
    class SQLiteIndexDiscovery {
        +discoverTableIndexes() SQLiteIndexInfo[]
        +getIndexInfo() any[]
        +analyzeIndexEfficiency() IndexAnalysis
        +getTableSize() TableSizeInfo
    }
    
    SchemaDiscovery --> SchemaDiscoveryCoordinator
    SchemaDiscoveryCoordinator --> DiscoveryFactory
    DiscoveryFactory --> PostgreSQLDiscoveryCoordinator
    DiscoveryFactory --> SQLiteDiscoveryCoordinator
    PostgreSQLDiscoveryCoordinator --> TableMetadataDiscovery
    PostgreSQLDiscoveryCoordinator --> PostgreSQLIndexDiscovery
    SQLiteDiscoveryCoordinator --> TableMetadataDiscovery
    SQLiteDiscoveryCoordinator --> SQLiteIndexDiscovery
```

## Database-Specific Features

```mermaid
graph LR
    subgraph "PostgreSQL Features"
        A1[pg_tables]
        A2[pg_index]
        A3[pg_constraint]
        A4[pg_stat_*]
        A5[JSONB Support]
        A6[Array Types]
        A7[Extensions]
        A8[Deferred Constraints]
    end
    
    subgraph "SQLite Features"
        B1[sqlite_master]
        B2[PRAGMA Commands]
        B3[Foreign Keys]
        B4[WAL Mode]
        B5[Auto Increment]
        B6[WITHOUT ROWID]
        B7[Integrity Checks]
        B8[Optimization]
    end
    
    subgraph "MySQL Features (Future)"
        C1[information_schema]
        C2[Performance Schema]
        C3[Character Sets]
        C4[Collations]
        C5[Storage Engines]
        C6[Partitioning]
    end
    
    subgraph "MSSQL Features (Future)"
        D1[sys.tables]
        D2[sys.indexes]
        D3[sys.foreign_keys]
        D4[DMVs]
        D5[Filegroups]
        D6[Partitioning]
    end
```

## Performance Optimization Flow

```mermaid
flowchart TD
    A[Schema Discovery Request] --> B{Parallel Processing?}
    B -->|Yes| C[Parallel Table Discovery]
    B -->|No| D[Sequential Table Discovery]
    
    C --> E[Table 1 Discovery]
    C --> F[Table 2 Discovery]
    C --> G[Table N Discovery]
    
    D --> H[Table 1 Discovery]
    H --> I[Table 2 Discovery]
    I --> J[Table N Discovery]
    
    E --> K[Index Discovery]
    F --> L[Index Discovery]
    G --> M[Index Discovery]
    
    H --> N[Index Discovery]
    I --> O[Index Discovery]
    J --> P[Index Discovery]
    
    K --> Q[Constraint Discovery]
    L --> R[Constraint Discovery]
    M --> S[Constraint Discovery]
    
    N --> T[Constraint Discovery]
    O --> U[Constraint Discovery]
    P --> V[Constraint Discovery]
    
    Q --> W[Aggregate Results]
    R --> W
    S --> W
    T --> W
    U --> W
    V --> W
    
    W --> X[Relationship Analysis]
    X --> Y[Schema Info]
```

## Error Handling Flow

```mermaid
flowchart TD
    A[Discovery Request] --> B[Try Discovery]
    B --> C{Success?}
    C -->|Yes| D[Return Schema]
    C -->|No| E[Check Error Type]
    
    E --> F{Connection Error?}
    F -->|Yes| G[Retry with Backoff]
    F -->|No| H{Permission Error?}
    
    H -->|Yes| I[Log Warning]
    H -->|No| J{Syntax Error?}
    
    J -->|Yes| K[Fallback to Generic]
    J -->|No| L[Unknown Error]
    
    G --> M{Retry Success?}
    M -->|Yes| D
    M -->|No| N[Throw Connection Error]
    
    I --> O[Continue with Available Data]
    K --> P[Use Generic Discovery]
    L --> Q[Log Error and Continue]
    
    O --> R[Partial Schema]
    P --> R
    Q --> R
    
    R --> S[Return Partial Results]
    N --> T[Throw Error]
```

## Migration Path

```mermaid
flowchart LR
    A[Old Monolithic Architecture] --> B[New Factory/Dialect Architecture]
    
    subgraph "Migration Steps"
        C[1. Keep Existing API]
        D[2. Add Capability Checking]
        E[3. Use Dialect-Specific Features]
        F[4. Full Migration]
    end
    
    A --> C
    C --> D
    D --> E
    E --> F
    F --> B
    
    subgraph "Benefits"
        G[Better Performance]
        H[Enhanced Features]
        I[Improved Maintainability]
        J[Easy Extension]
    end
    
    B --> G
    B --> H
    B --> I
    B --> J
```

## Testing Strategy

```mermaid
graph TB
    subgraph "Unit Tests"
        A[Service Tests]
        B[Factory Tests]
        C[Coordinator Tests]
    end
    
    subgraph "Integration Tests"
        D[PostgreSQL Tests]
        E[SQLite Tests]
        F[MySQL Tests]
    end
    
    subgraph "Performance Tests"
        G[Discovery Speed]
        H[Memory Usage]
        I[Concurrent Access]
    end
    
    subgraph "Error Tests"
        J[Connection Failures]
        K[Permission Errors]
        L[Invalid Queries]
    end
    
    A --> M[Test Results]
    B --> M
    C --> M
    D --> M
    E --> M
    F --> M
    G --> M
    H --> M
    I --> M
    J --> M
    K --> M
    L --> M
```

This architecture diagram shows the complete structure of the new factory/dialect-based schema discovery system, including data flow, component relationships, database-specific features, performance optimizations, error handling, migration path, and testing strategy.
