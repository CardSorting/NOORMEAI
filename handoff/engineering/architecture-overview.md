# NOORMME Architecture Overview

## System Architecture

NOORMME is built as a layered architecture that combines SQLite automation with Next.js organizational patterns.

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
├─────────────────────────────────────────────────────────────┤
│  Next.js App Router  │  Admin Panel  │  API Routes         │
├─────────────────────────────────────────────────────────────┤
│                    Service Layer                            │
├─────────────────────────────────────────────────────────────┤
│  Auth Service  │  User Service  │  Admin Service           │
├─────────────────────────────────────────────────────────────┤
│                    Repository Layer                         │
├─────────────────────────────────────────────────────────────┤
│  User Repository  │  Post Repository  │  Auto-generated    │
├─────────────────────────────────────────────────────────────┤
│                    NOORMME Core                             │
├─────────────────────────────────────────────────────────────┤
│  Schema Discovery  │  Type Generation  │  Query Builder    │
├─────────────────────────────────────────────────────────────┤
│                    Database Layer                           │
├─────────────────────────────────────────────────────────────┤
│  SQLite (WAL Mode)  │  Kysely  │  better-sqlite3          │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. NOORMME Class (`src/noormme.ts`)

**Purpose**: Main entry point that orchestrates all functionality

**Key Responsibilities**:
- Database connection management
- Schema discovery and type generation
- Repository factory management
- Performance optimization
- Health monitoring

**Key Methods**:
```typescript
class NOORMME {
  async initialize(): Promise<void>
  getRepository<T>(tableName: string): Repository<T>
  getKysely(): Kysely<Database>
  getSchema(): DatabaseSchema
  getMetrics(): PerformanceMetrics
  optimize(): Promise<OptimizationResult>
}
```

### 2. Schema Discovery (`src/schema/`)

**Purpose**: Automatically introspect SQLite database and generate TypeScript types

**Key Components**:
- `SchemaDiscovery`: Discovers tables, columns, relationships
- `TypeGenerator`: Generates TypeScript interfaces
- `RelationshipEngine`: Handles foreign key relationships
- `SchemaWatcher`: Monitors schema changes

**Key Features**:
- Auto-discovery of existing databases
- Type-safe interface generation
- Relationship mapping
- Real-time schema monitoring

### 3. Repository Pattern (`src/repository/`)

**Purpose**: Provide type-safe CRUD operations with dynamic finders

**Key Components**:
- `RepositoryFactory`: Creates repository instances
- `BaseRepository`: Common CRUD operations
- `DynamicFinders`: Auto-generated finder methods
- `QueryBuilder`: Kysely integration

**Key Features**:
- Type-safe CRUD operations
- Dynamic finder methods (`findByEmail`, `findManyByStatus`)
- Pagination and filtering
- Performance optimization

### 4. CLI Tools (`src/cli/`)

**Purpose**: Command-line interface for database management and project scaffolding

**Key Commands**:
- `init`: Initialize NOORMME in existing project
- `inspect`: Analyze database schema
- `generate`: Generate TypeScript types and repositories
- `optimize`: Optimize SQLite performance
- `analyze`: Analyze query patterns
- `migrate`: Manage database migrations
- `watch`: Monitor schema changes
- `status`: Show system status

### 5. Performance Optimization (`src/performance/`)

**Purpose**: Automatically optimize SQLite performance and monitor metrics

**Key Components**:
- `SQLiteAutoOptimizer`: WAL mode, cache sizing, PRAGMA settings
- `SQLiteAutoIndexer`: Index recommendations and creation
- `MetricsCollector`: Performance monitoring
- `CacheManager`: Intelligent caching

**Key Features**:
- WAL mode for concurrent access
- Automatic cache optimization
- Index recommendations
- Performance monitoring

## Database Layer

### SQLite Configuration

**WAL Mode**: Enables concurrent read/write operations
```sql
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA cache_size=-64000;
PRAGMA temp_store=MEMORY;
PRAGMA foreign_keys=ON;
```

**Performance Optimizations**:
- WAL mode for better concurrency
- Optimized cache size
- Memory-based temporary storage
- Foreign key constraints enabled

### Kysely Integration

**Purpose**: Type-safe SQL query builder

**Key Features**:
- Full TypeScript support
- IntelliSense autocomplete
- Complex query building
- Transaction support

**Usage**:
```typescript
const kysely = db.getKysely()
const result = await kysely
  .selectFrom('users')
  .innerJoin('posts', 'posts.user_id', 'users.id')
  .select(['users.name', 'posts.title'])
  .where('users.status', '=', 'active')
  .execute()
```

## Next.js Integration

### App Router Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth route group
│   ├── admin/             # Admin panel
│   ├── api/               # API routes
│   └── dashboard/         # Protected dashboard
├── lib/
│   ├── db.ts              # NOORMME database instance
│   ├── auth.ts            # NextAuth configuration
│   ├── services/          # Service layer
│   └── repositories/      # Repository layer
└── components/
    ├── ui/                # Reusable UI components
    └── admin/             # Admin panel components
```

### Authentication Integration

**NextAuth Configuration**:
```typescript
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: NoormmeAdapter(db),
  providers: [
    GoogleProvider({ /* ... */ }),
    GitHubProvider({ /* ... */ }),
    CredentialsProvider({ /* ... */ })
  ],
  session: { strategy: 'database' }
})
```

### Service Layer Pattern

**Laravel-style Service Classes**:
```typescript
export class UserService {
  private userRepo = db.getRepository('users')

  async createUser(data: CreateUserData) {
    // Business logic here
    const user = await this.userRepo.create(data)
    return user
  }
}
```

## Performance Architecture

### Caching Strategy

**Multi-level Caching**:
1. **Query Result Caching**: Cache frequently accessed data
2. **Schema Caching**: Cache database schema information
3. **Type Caching**: Cache generated TypeScript types
4. **Repository Caching**: Cache repository instances

### Optimization Pipeline

```
Schema Change → Auto-Discovery → Type Generation → Repository Update → Performance Optimization
```

**Automatic Optimizations**:
- WAL mode enabling
- Cache size optimization
- Index recommendations
- Query performance analysis

## Security Architecture

### Authentication & Authorization

**NextAuth Integration**:
- OAuth providers (Google, GitHub)
- Credentials authentication
- Session management
- Role-based access control

**RBAC System**:
- Role definitions
- Permission checking
- Middleware integration
- Admin panel access control

### Data Protection

**SQLite Security**:
- Foreign key constraints
- Input validation
- SQL injection prevention
- Data encryption options

## Monitoring & Observability

### Health Monitoring

**Database Health**:
- Connection status
- Query performance
- Cache hit rates
- WAL mode status

**Application Health**:
- Repository performance
- Type generation status
- Schema discovery status
- CLI command execution

### Metrics Collection

**Performance Metrics**:
- Query execution times
- Cache hit rates
- Memory usage
- Disk I/O operations

**Business Metrics**:
- Repository usage
- CLI command usage
- Error rates
- User satisfaction

## Deployment Architecture

### Development Environment

**Local Development**:
- SQLite file-based database
- WAL mode enabled
- Auto-optimization
- Schema monitoring

### Production Environment

**Production Considerations**:
- Absolute database paths
- File permissions
- Backup strategies
- Performance monitoring
- Security hardening

## Scalability Considerations

### Horizontal Scaling

**Database Scaling**:
- SQLite file replication
- Read replicas
- Connection pooling
- Cache distribution

### Vertical Scaling

**Performance Scaling**:
- Memory optimization
- CPU optimization
- Disk I/O optimization
- Network optimization

## Technical Debt

### Current Technical Debt

1. **Migration System**: Basic implementation, needs enhancement
2. **Admin Panel**: Basic components, needs full CRUD interface
3. **Testing**: Limited test coverage, needs comprehensive suite
4. **Documentation**: Good coverage, needs consolidation

### Mitigation Strategies

1. **Incremental Improvement**: Add features gradually
2. **Community Contribution**: Open source development
3. **Automated Testing**: CI/CD pipeline with comprehensive tests
4. **Documentation**: Regular updates and improvements

## Future Architecture

### Planned Enhancements

1. **Plugin System**: Extensible architecture
2. **Multi-database Support**: PostgreSQL, MySQL support
3. **Cloud Integration**: Hosted service option
4. **Mobile Support**: React Native integration

### Architecture Evolution

**Phase 1**: SQLite automation (current)
**Phase 2**: Next.js organization (current)
**Phase 3**: Multi-database support (planned)
**Phase 4**: Cloud platform (planned)

## Conclusion

NOORMME's architecture successfully combines:

1. **SQLite Automation**: Production-ready database layer
2. **Next.js Integration**: Framework-agnostic organizational patterns
3. **Performance Optimization**: Automatic optimization and monitoring
4. **Developer Experience**: Type safety and ease of use

The result is a comprehensive system that provides enterprise-grade capabilities with SQLite simplicity and Next.js performance.

---

**Architecture Status**: ✅ Production-ready
**Scalability**: ✅ Designed for growth
**Maintainability**: ✅ Clean, modular design
**Performance**: ✅ Optimized for speed
