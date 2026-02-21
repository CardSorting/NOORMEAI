# PostgreSQL Dialect Tests

Comprehensive test suite for the NOORMME PostgreSQL dialect implementation.

## Test Coverage

This test suite covers all PostgreSQL dialect components:

### 1. **postgresql-dialect.test.ts**
- Dialect configuration (pool, poolConfig, lazy initialization)
- Factory methods (driver, compiler, adapter, introspector)
- Integration with Kysely
- Connection callbacks

### 2. **postgresql-adapter.test.ts**
- Feature support (transactional DDL, RETURNING clause)
- Migration lock acquisition and release
- Concurrent lock handling
- Transaction-based locking
- Hash function for lock IDs

### 3. **postgresql-driver.test.ts**
- Driver initialization (pool, poolConfig, lazy loading)
- Connection management (acquire, release, pooling)
- Transaction management (begin, commit, rollback, isolation levels)
- Query execution (INSERT, UPDATE, DELETE, SELECT)
- Parameterized queries
- Streaming queries with cursors
- Driver lifecycle and cleanup

### 4. **postgresql-query-compiler.test.ts**
- PostgreSQL parameter placeholders ($1, $2, $3, ...)
- Identifier wrapping with double quotes
- Identifier sanitization (escaping quotes)
- Auto-increment syntax (GENERATED AS IDENTITY)
- Boolean value handling (true/false)
- Null and undefined handling
- Edge cases (Unicode, special characters, long identifiers)

### 5. **postgresql-features.test.ts**
- **Array Operations:**
  - Array creation and insertion
  - Contains, containedBy, overlap operators
  - Array length, append, remove operations
  - Unnest functionality

- **JSON/JSONB Operations:**
  - Field extraction (text and JSON)
  - Nested path extraction
  - Key existence checks (hasKey, hasAnyKey, hasAllKeys)
  - Value containment (contains, containedBy)
  - Field updates (set, delete)

- **Full-Text Search:**
  - tsvector and tsquery conversion
  - Search matching and ranking
  - Headline generation (highlighting)
  - GIN index creation
  - Generated tsvector columns

- **Materialized Views:**
  - View creation (with/without data)
  - View refresh (standard and concurrent)
  - View deletion (with cascade)
  - Unique index creation
  - View metadata retrieval

### 6. **postgresql-introspector.test.ts**
- Schema discovery (excluding system schemas)
- Table metadata (including views)
- Column information:
  - Data types (standard and PostgreSQL-specific)
  - Nullability and default values
  - Auto-increment detection
  - Array types (TEXT[], INTEGER[], etc.)
  - JSON/JSONB types
  - Full-text search types (TSVECTOR)
- Index metadata (primary keys, unique, multi-column)
- Foreign key relationships (actions: CASCADE, RESTRICT, etc.)
- Complex data type handling
- Edge cases (long identifiers, empty databases)

## Prerequisites

### PostgreSQL Database
You need a running PostgreSQL instance for these tests. You can:

1. **Use Docker:**
   ```bash
   docker run -d \
     --name postgres-test \
     -e POSTGRES_PASSWORD=postgres \
     -e POSTGRES_DB=test \
     -p 5432:5432 \
     postgres:latest
   ```

2. **Use local PostgreSQL installation:**
   Ensure PostgreSQL is running and you have a test database.

### Environment Variables
Configure database connection using environment variables:

```bash
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_DB=test
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=postgres
```

Or use a `.env` file in the project root:

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=test
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```

## Running the Tests

### Run all PostgreSQL tests:
```bash
npm test -- test-comprehensive/postgresql
```

### Run specific test file:
```bash
npm test -- test-comprehensive/postgresql/postgresql-dialect.test.ts
npm test -- test-comprehensive/postgresql/postgresql-adapter.test.ts
npm test -- test-comprehensive/postgresql/postgresql-driver.test.ts
npm test -- test-comprehensive/postgresql/postgresql-query-compiler.test.ts
npm test -- test-comprehensive/postgresql/postgresql-features.test.ts
npm test -- test-comprehensive/postgresql/postgresql-introspector.test.ts
```

### Run with coverage:
```bash
npm run test:coverage -- test-comprehensive/postgresql
```

### Run with watch mode:
```bash
npm run test:watch -- test-comprehensive/postgresql
```

## Test Structure

Each test file follows this structure:

```typescript
describe('Test Suite Name', () => {
  let pool: Pool
  let db: Kysely<any>

  before(() => {
    // Setup database connection
  })

  after(async () => {
    // Cleanup database connection
  })

  describe('Feature Group', () => {
    beforeEach(async () => {
      // Setup test data
    })

    afterEach(async () => {
      // Cleanup test data
    })

    it('should test specific behavior', async () => {
      // Test implementation
    })
  })
})
```

## Notes

### Streaming Tests
Some tests require the `pg-cursor` package for streaming functionality. These tests will be skipped if the package is not available.

To run streaming tests, install:
```bash
npm install pg-cursor
```

### Test Isolation
- Each test suite cleans up after itself
- Tables created during tests are dropped in `afterEach` hooks
- Test tables use unique names to avoid conflicts

### Performance
- Tests use connection pooling for efficiency
- Multiple tests can run in parallel (when using appropriate test runner configuration)
- Each test file can run independently

## Troubleshooting

### Connection Issues
If tests fail with connection errors:
1. Verify PostgreSQL is running: `pg_isready -h localhost -p 5432`
2. Check credentials: `psql -h localhost -U postgres -d test`
3. Verify environment variables are set correctly

### Permission Issues
Ensure the test user has sufficient permissions:
```sql
GRANT ALL PRIVILEGES ON DATABASE test TO postgres;
GRANT ALL ON SCHEMA public TO postgres;
```

### Port Conflicts
If port 5432 is in use, change `POSTGRES_PORT` and update the PostgreSQL container/instance port.

## CI/CD Integration

### GitHub Actions Example:
```yaml
services:
  postgres:
    image: postgres:latest
    env:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: test
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5

steps:
  - name: Run PostgreSQL Tests
    run: npm test -- test-comprehensive/postgresql
    env:
      POSTGRES_HOST: localhost
      POSTGRES_PORT: 5432
      POSTGRES_DB: test
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
```

## Contributing

When adding new tests:
1. Follow the existing test structure
2. Clean up all created resources in `afterEach`/`after` hooks
3. Use descriptive test names
4. Add comments for complex test logic
5. Update this README with new test coverage

## License

MIT
