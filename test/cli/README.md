# NOORMME CLI Test Suite

This directory contains comprehensive tests for the NOORMME CLI commands, ensuring all automation features work correctly and reliably.

## Test Structure

### Unit Tests (`unit/`)
Individual command tests that verify specific functionality:

- **`init.test.ts`** - Tests project initialization and configuration
- **`inspect.test.ts`** - Tests database schema inspection and analysis
- **`generate.test.ts`** - Tests TypeScript code generation
- **`optimize.test.ts`** - Tests SQLite performance optimization
- **`analyze.test.ts`** - Tests query analysis and recommendations
- **`migrate.test.ts`** - Tests database migration management
- **`watch.test.ts`** - Tests schema monitoring and auto-optimization
- **`status.test.ts`** - Tests automation status dashboard

### Integration Tests (`integration/`)
End-to-end workflow tests that verify complete user scenarios:

- **`workflows.test.ts`** - Tests complete CLI workflows and command combinations

### Test Utilities (`utils/`)
Helper functions and utilities for testing:

- **`test-helpers.ts`** - Test utilities, mocks, and helper functions

## Test Features

### Comprehensive Coverage
- ✅ All CLI commands tested
- ✅ Error handling scenarios
- ✅ Environment variable support
- ✅ Configuration options
- ✅ File system operations
- ✅ Database interactions
- ✅ Output validation
- ✅ Integration workflows

### Mock System
- Mock NOORMME instances with configurable behavior
- Mock file system operations
- Mock console output capture
- Mock database connections
- Mock inquirer responses

### Test Utilities
- Temporary test environments
- Console output capture and validation
- File system mocking
- CLI command execution
- Database mock creation
- Async operation handling

## Running Tests

### Prerequisites
```bash
cd test/cli
npm install
```

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# CLI tests only
npm run test:cli
```

### Run with Coverage
```bash
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

## Test Configuration

### Jest Configuration
- **Test Environment**: Node.js
- **Test Framework**: Jest with TypeScript support
- **Mocking**: Comprehensive mock system for all dependencies
- **Coverage**: Line, function, and branch coverage
- **Timeout**: 30 seconds for integration tests

### TypeScript Configuration
- **Target**: ES2022
- **Module**: ESNext with Node resolution
- **Strict Mode**: Enabled with all strict checks
- **Types**: Jest and Node.js types included

## Test Scenarios

### Initialization Tests
- Project setup with various configurations
- Database detection and creation
- File generation and overwrite handling
- Package.json integration
- Environment configuration

### Schema Inspection Tests
- Table discovery and analysis
- Relationship detection
- Index analysis
- Optimization recommendations
- Performance metrics
- Error handling for missing tables

### Code Generation Tests
- TypeScript interface generation
- Repository class creation
- Dynamic finder methods
- Automation configuration
- Usage examples
- Multiple output formats

### Optimization Tests
- PRAGMA optimization application
- Index recommendation implementation
- ANALYZE execution
- WAL mode configuration
- Performance metrics display
- Dry run mode

### Analysis Tests
- Query pattern analysis
- Slow query detection
- Index recommendation generation
- Performance reporting
- N+1 query detection
- Comprehensive health scoring

### Migration Tests
- Migration status display
- Migration generation
- Version management
- Rollback operations
- Error handling
- Migration recommendations

### Watch Tests
- Schema change detection
- Auto-optimization triggers
- Auto-indexing triggers
- Notification system
- Graceful shutdown
- Error handling

### Status Tests
- Automation status display
- Performance metrics
- Health score calculation
- Optimization status
- Cache statistics
- File system status

### Integration Tests
- Complete initialization workflows
- Development workflows
- Migration workflows
- Monitoring workflows
- Error handling workflows
- Environment variable workflows
- Package.json scripts workflows
- Configuration workflows
- Performance testing workflows

## Mock Data

### Schema Information
- **Tables**: users, posts with realistic structure
- **Columns**: Various data types and constraints
- **Relationships**: One-to-many relationships
- **Indexes**: Primary keys, unique indexes, regular indexes
- **Foreign Keys**: CASCADE delete relationships

### Performance Data
- **Query Metrics**: Realistic execution times and counts
- **Cache Statistics**: Hit rates and memory usage
- **Optimization Status**: Applied optimizations and warnings
- **Index Recommendations**: Performance-based suggestions

### Migration Data
- **Migration Status**: Current version and applied migrations
- **Pending Migrations**: Available but not applied
- **Migration Generation**: File creation and content

## Error Scenarios

### Database Errors
- Connection failures
- Schema discovery failures
- Query execution errors
- Migration failures

### File System Errors
- Permission denied
- Directory creation failures
- File write errors
- Path resolution issues

### Configuration Errors
- Invalid options
- Missing environment variables
- Conflicting settings
- Malformed configuration

### CLI Errors
- Unknown commands
- Invalid arguments
- Missing required options
- Help display errors

## Best Practices

### Test Organization
- Group related tests in describe blocks
- Use descriptive test names
- Test both success and failure scenarios
- Verify output content and format

### Mock Management
- Reset mocks between tests
- Use realistic mock data
- Test error conditions
- Verify mock interactions

### Async Handling
- Properly handle async operations
- Use appropriate timeouts
- Clean up resources
- Handle race conditions

### Output Validation
- Capture and verify console output
- Check for specific messages
- Validate formatting
- Test error messages

## Contributing

### Adding New Tests
1. Create test file in appropriate directory
2. Follow existing naming conventions
3. Use provided test utilities
4. Add comprehensive scenarios
5. Update this README

### Test Requirements
- All tests must pass
- Coverage should remain high
- Tests should be deterministic
- Error scenarios must be covered
- Integration tests for new workflows

### Code Style
- Use TypeScript strict mode
- Follow existing patterns
- Add proper JSDoc comments
- Use meaningful variable names
- Handle all edge cases
