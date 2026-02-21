# NOORM Comprehensive Testing Suite

This directory contains a comprehensive testing suite for NOORM's new features, including:

## Test Structure

```
test-comprehensive/
├── README.md                          # This file
├── setup/                             # Test setup and utilities
│   ├── test-config.ts                 # Test configuration
│   ├── test-database.ts               # Database setup utilities
│   ├── test-fixtures.ts               # Test data fixtures
│   └── test-helpers.ts                # Common test helpers
├── unit/                              # Unit tests for individual components
│   ├── noormme.test.ts                # NOORMME core tests
│   ├── schema-discovery.test.ts       # Schema discovery tests
│   ├── type-generator.test.ts         # Type generation tests
│   ├── repository-factory.test.ts     # Repository factory tests
│   ├── relationship-engine.test.ts    # Relationship engine tests
│   ├── cache-manager.test.ts          # Cache manager tests
│   └── migration-system.test.ts       # Migration system tests
├── integration/                       # Integration tests
│   ├── database-operations.test.ts    # Database CRUD operations
│   ├── relationship-loading.test.ts   # Relationship loading tests
│   ├── transaction-handling.test.ts   # Transaction tests
│   └── multi-database.test.ts         # Multi-database support tests
├── performance/                       # Performance and stress tests
│   ├── batch-loading.test.ts          # Batch loading performance
│   ├── cache-performance.test.ts      # Cache performance tests
│   ├── migration-performance.test.ts  # Migration performance tests
│   └── stress-tests.test.ts           # Stress and load tests
├── sqlite/                            # SQLite-specific tests
│   ├── README.md                      # SQLite tests documentation
│   ├── sqlite-minimal.test.ts         # Basic SQLite functionality
│   ├── sqlite-compatibility.test.ts   # SQLite compatibility tests
│   ├── sqlite-introspection.test.ts   # Schema introspection tests
│   ├── sqlite-syntax.test.ts          # SQLite syntax tests
│   ├── sqlite-constraints.test.ts     # Constraint handling tests
│   └── sqlite-parameter-binding.test.ts # Parameter binding tests
├── authentication/                    # Authentication and OAuth tests
│   ├── README.md                      # Authentication tests documentation
│   ├── nextauth-adapter.test.ts       # NextAuth.js adapter tests
│   ├── oauth-flow.test.ts             # OAuth callback flow tests
│   ├── database-strategy.test.ts      # Database session strategy tests
│   └── error-scenarios.test.ts        # Authentication error scenarios
└── e2e/                              # End-to-end tests
    ├── full-workflow.test.ts          # Complete workflow tests
    ├── real-world-scenarios.test.ts   # Real-world usage scenarios
    └── error-handling.test.ts         # Error handling and recovery

```

## Features Tested

### Core NOORMME Features
- ✅ Schema discovery and introspection
- ✅ Type generation from database schema
- ✅ Dynamic repository creation
- ✅ Relationship loading (one-to-many, many-to-one, many-to-many)
- ✅ Cache management with TTL and LRU eviction
- ✅ Performance monitoring and metrics

### Migration System
- ✅ Migration file management
- ✅ Migration execution and rollback
- ✅ Resource management and concurrency control
- ✅ Node.js integration
- ✅ Performance optimization

### Database Support
- ✅ SQLite (comprehensive SQLite-specific tests in `/sqlite` directory)
  - Basic functionality and initialization
  - Compatibility and feature support
  - Schema introspection and discovery
  - Syntax and query compilation
  - Constraint handling and validation
  - Parameter binding and prepared statements

### Advanced Features
- ✅ Batch loading for performance
- ✅ Transaction support
- ✅ Custom type mappings
- ✅ Schema change detection
- ✅ Error handling and recovery

## Running Tests

### Prerequisites
```bash
# Install dependencies
pnpm install

# Build the project
pnpm build
```

### Run All Tests
```bash
# Run comprehensive test suite
pnpm test:comprehensive

# Run specific test categories
pnpm test:unit
pnpm test:integration
pnpm test:performance
pnpm test:e2e
pnpm test:sqlite
pnpm test:authentication
```

### Run SQLite-Specific Tests
```bash
# Run all SQLite tests
npm test -- --testPathPattern=sqlite

# Run specific SQLite test files
npm test -- test-comprehensive/sqlite/sqlite-minimal.test.ts
npm test -- test-comprehensive/sqlite/sqlite-compatibility.test.ts
npm test -- test-comprehensive/sqlite/sqlite-introspection.test.ts
npm test -- test-comprehensive/sqlite/sqlite-syntax.test.ts
npm test -- test-comprehensive/sqlite/sqlite-constraints.test.ts
npm test -- test-comprehensive/sqlite/sqlite-parameter-binding.test.ts
```

### Run Authentication Tests
```bash
# Run all authentication tests
npm test -- --testPathPattern=authentication

# Run specific authentication test files
npm test -- test-comprehensive/authentication/nextauth-adapter.test.ts
npm test -- test-comprehensive/authentication/oauth-flow.test.ts
npm test -- test-comprehensive/authentication/database-strategy.test.ts
npm test -- test-comprehensive/authentication/error-scenarios.test.ts
```

### Test Configuration
Tests can be configured via environment variables:
- `TEST_DATABASE_URL` - Database connection string
- `TEST_LOG_LEVEL` - Logging level (debug, info, warn, error)
- `TEST_PARALLEL` - Number of parallel test workers
- `TEST_TIMEOUT` - Test timeout in milliseconds

## Test Database Setup

The test suite automatically sets up test databases for each supported dialect:

### SQLite (Default)
- Uses in-memory database
- No setup required
- Fastest for unit tests


### MySQL
```bash
# Start MySQL (Docker)
docker run --name mysql-test -e MYSQL_ROOT_PASSWORD=test -p 3306:3306 -d mysql

# Set environment variable
export TEST_DATABASE_URL="mysql://root:test@localhost:3306/test"
```

## Coverage Goals

- **Unit Tests**: 95%+ code coverage
- **Integration Tests**: All major workflows covered
- **Performance Tests**: Benchmarks for all performance-critical features
- **E2E Tests**: Complete user scenarios

## Contributing

When adding new tests:

1. Follow the existing test structure
2. Use descriptive test names
3. Include both positive and negative test cases
4. Add performance benchmarks for new features
5. Update this README if adding new test categories

## Troubleshooting

### Common Issues

**Database Connection Errors**
- Ensure test databases are running
- Check connection strings and credentials
- Verify network connectivity

**Test Timeouts**
- Increase timeout for slow operations
- Check for resource constraints
- Optimize test data size

**Memory Issues**
- Reduce test data size
- Clean up resources properly
- Use streaming for large datasets

For more help, see the main project documentation.
