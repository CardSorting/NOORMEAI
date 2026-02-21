# SQLite-Specific Tests

This directory contains comprehensive tests specifically for SQLite database functionality in NOORMME. These tests ensure SQLite compatibility, performance, and feature completeness.

## Test Files

### 1. `sqlite-minimal.test.ts`
**Purpose**: Basic SQLite functionality and initialization
**Coverage**:
- ✅ SQLite database creation and connection
- ✅ Basic table operations (CREATE, INSERT, SELECT, UPDATE, DELETE)
- ✅ Transaction handling
- ✅ Connection management
- ✅ Error handling for basic operations

### 2. `sqlite-compatibility.test.ts`
**Purpose**: SQLite compatibility and feature support
**Coverage**:
- ✅ SQLite version compatibility
- ✅ SQLite-specific data types
- ✅ SQLite extensions and features
- ✅ Cross-platform compatibility
- ✅ File-based database operations
- ✅ Memory database operations

### 3. `sqlite-introspection.test.ts`
**Purpose**: Database schema introspection and discovery
**Coverage**:
- ✅ Table discovery and metadata
- ✅ Column information retrieval
- ✅ Index discovery and analysis
- ✅ Foreign key relationship detection
- ✅ Constraint information
- ✅ View and trigger discovery
- ✅ PRAGMA statement execution

### 4. `sqlite-syntax.test.ts`
**Purpose**: SQLite syntax and query compilation
**Coverage**:
- ✅ SQLite-specific SQL syntax
- ✅ Query compilation and execution
- ✅ Complex query support
- ✅ Subquery handling
- ✅ Window functions
- ✅ Common table expressions (CTEs)
- ✅ SQLite-specific functions

### 5. `sqlite-constraints.test.ts`
**Purpose**: SQLite constraint handling and validation
**Coverage**:
- ✅ Primary key constraints
- ✅ Foreign key constraints
- ✅ Unique constraints
- ✅ Check constraints
- ✅ Not null constraints
- ✅ Constraint violation handling
- ✅ Constraint enforcement

### 6. `sqlite-parameter-binding.test.ts`
**Purpose**: SQLite parameter binding and prepared statements
**Coverage**:
- ✅ Parameter binding for different data types
- ✅ Prepared statement execution
- ✅ Batch operations
- ✅ Parameter validation
- ✅ SQL injection prevention
- ✅ Performance optimization

## Key Features Tested

### Database Operations
- **CRUD Operations**: Create, Read, Update, Delete operations
- **Transactions**: ACID compliance and transaction management
- **Concurrency**: Multiple connection handling
- **Performance**: Query optimization and execution speed

### Schema Management
- **Table Creation**: Various table structures and data types
- **Index Management**: Primary, unique, and regular indexes
- **Constraint Enforcement**: All SQLite constraint types
- **Schema Evolution**: Table modifications and migrations

### SQLite-Specific Features
- **PRAGMA Statements**: Database configuration and introspection
- **SQLite Functions**: Built-in and custom functions
- **File Operations**: Database file handling and backup
- **Memory Databases**: In-memory database operations

### Error Handling
- **Constraint Violations**: Proper error reporting and handling
- **Connection Errors**: Network and file system issues
- **Syntax Errors**: SQL compilation and validation
- **Resource Management**: Memory and file handle management

## Running SQLite Tests

### Run All SQLite Tests
```bash
npm test -- --testPathPattern=sqlite
```

### Run Specific SQLite Tests
```bash
# Basic functionality
npm test -- test-comprehensive/sqlite/sqlite-minimal.test.ts

# Compatibility testing
npm test -- test-comprehensive/sqlite/sqlite-compatibility.test.ts

# Schema introspection
npm test -- test-comprehensive/sqlite/sqlite-introspection.test.ts

# Syntax testing
npm test -- test-comprehensive/sqlite/sqlite-syntax.test.ts

# Constraint testing
npm test -- test-comprehensive/sqlite/sqlite-constraints.test.ts

# Parameter binding
npm test -- test-comprehensive/sqlite/sqlite-parameter-binding.test.ts
```

### Run with Coverage
```bash
npm test -- --coverage --testPathPattern=sqlite
```

### Run with Verbose Output
```bash
npm test -- --verbose --testPathPattern=sqlite
```

## Test Database Setup

Each test creates its own temporary SQLite database file to ensure:
- **Test Isolation**: No interference between tests
- **Clean State**: Each test starts with a fresh database
- **Automatic Cleanup**: Temporary files are removed after tests

### Database Configuration
Tests use the following SQLite configuration:
- **File-based databases**: For persistence testing
- **Memory databases**: For performance testing
- **WAL mode**: For concurrent access testing
- **Foreign keys enabled**: For constraint testing

## Performance Benchmarks

The SQLite tests include performance benchmarks for:
- **Query Execution**: Speed of different query types
- **Batch Operations**: Bulk insert/update performance
- **Connection Management**: Connection pool efficiency
- **Memory Usage**: Database memory consumption
- **File I/O**: Disk-based operation performance

## Integration with Main Test Suite

These SQLite-specific tests complement the main NOORMME test suite by:
- **Focusing on SQLite**: Deep testing of SQLite-specific features
- **Ensuring Compatibility**: Cross-platform and version compatibility
- **Performance Validation**: SQLite-specific performance characteristics
- **Feature Completeness**: Comprehensive SQLite feature coverage

## Continuous Integration

These tests run as part of the CI/CD pipeline to ensure:
- **SQLite Compatibility**: Works across different SQLite versions
- **Platform Support**: Functions on Windows, macOS, and Linux
- **Performance Regression**: No performance degradation over time
- **Feature Stability**: SQLite features remain stable across releases

## Troubleshooting

### Common Issues
1. **File Permissions**: Ensure write permissions for database files
2. **SQLite Version**: Verify compatible SQLite version is installed
3. **Memory Limits**: Check available memory for large test datasets
4. **File Locks**: Ensure no other processes are using test database files

### Debug Mode
Run tests with debug logging:
```bash
DEBUG=noormme:* npm test -- --testPathPattern=sqlite
```

## Contributing

When adding new SQLite tests:
1. **Follow Naming Convention**: Use `sqlite-` prefix for test files
2. **Include Documentation**: Document what the test covers
3. **Add Performance Benchmarks**: Include timing information where relevant
4. **Ensure Cleanup**: Always clean up temporary database files
5. **Test Edge Cases**: Include boundary condition testing
