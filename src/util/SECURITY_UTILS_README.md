# NOORMME Security Utilities

This directory contains comprehensive security utilities to prevent SQL injection, path traversal, and other vulnerabilities in NOORMME applications.

## 📦 Modules

### 1. `security-validator.ts`
Core validation functions for identifiers and paths.

### 2. `safe-sql-helpers.ts`
Safe alternatives to dangerous `sql.raw()` and `sql.lit()` methods.

### 3. `security.ts`
Unified exports and security patterns.

## 🚀 Quick Start

```typescript
// Import all security utilities
import {
  validateColumnReference,
  safeOrderDirection,
  safeLimit,
  SecurityPatterns
} from 'noormme/util/security'

// Validate dynamic column reference
const userColumn = req.query.column
validateColumnReference(userColumn)  // Throws if invalid

// Use safe SQL helpers
const direction = safeOrderDirection(req.query.dir)  // Only allows ASC/DESC
const limit = safeLimit(req.query.limit)  // Validates 1-10000
```

## 🛡️ Security Functions

### Input Validation

#### `validateIdentifier(identifier: string, context?: string)`
Validates SQL identifiers (generic).

```typescript
validateIdentifier('user_id')  // ✅ Valid
validateIdentifier('id; DROP TABLE')  // ❌ Throws error
```

#### `validateColumnReference(columnRef: string)`
Validates column references (column, table.column, schema.table.column).

```typescript
validateColumnReference('users.email')  // ✅ Valid
validateColumnReference('users.id; --')  // ❌ Throws error
```

#### `validateTableReference(tableRef: string)`
Validates table references (table or schema.table).

```typescript
validateTableReference('users')  // ✅ Valid
validateTableReference('public.users')  // ✅ Valid
validateTableReference('users; DROP')  // ❌ Throws error
```

#### `validateFilePath(filePath: string, allowedExtensions?: string[])`
Validates file paths to prevent path traversal.

```typescript
validateFilePath('./data/db.sqlite', ['.sqlite'])  // ✅ Valid
validateFilePath('../../../etc/passwd')  // ❌ Throws error
```

### Safe SQL Helpers

#### `safeOrderDirection(direction: string)`
Safely validates ORDER BY direction (ASC/DESC only).

```typescript
const dir = safeOrderDirection(req.query.dir)
sql`SELECT * FROM users ORDER BY name ${dir}`
```

#### `safeLimit(limit: number | string)`
Validates LIMIT clause (1-10000).

```typescript
const limit = safeLimit(req.query.limit)
sql`SELECT * FROM users LIMIT ${limit}`
```

#### `safeOffset(offset: number | string)`
Validates OFFSET clause (0-1000000).

```typescript
const offset = safeOffset(req.query.offset)
sql`SELECT * FROM users OFFSET ${offset}`
```

#### `safeOrderBy(orderBy: SafeOrderBy[], allowedColumns: string[])`
Validates complete ORDER BY clause with whitelist.

```typescript
const allowedColumns = ['name', 'email', 'created_at']
const orderBy = [
  { column: 'name', direction: 'ASC' },
  { column: 'email', direction: 'DESC' }
]

sql`SELECT * FROM users ORDER BY ${safeOrderBy(orderBy, allowedColumns)}`
```

#### `safeKeyword(keyword: string, allowedKeywords: string[])`
Validates keywords against whitelist.

```typescript
const lockMode = safeKeyword(userInput, ['FOR UPDATE', 'FOR SHARE'])
sql`SELECT * FROM users ${lockMode}`
```

### Rate Limiting

#### `RateLimiter`
Prevents brute-force and DoS attacks.

```typescript
import { RateLimiter } from 'noormme/util/security'

const limiter = new RateLimiter(10, 60000)  // 10 attempts per minute

try {
  limiter.checkLimit('login_' + userId)
  // Perform operation
} catch (error) {
  // Rate limit exceeded
}
```

## 🎯 Common Patterns

### Pattern 1: Safe Dynamic Column Selection

```typescript
import { validateColumnReference } from 'noormme/util/security'

async function getUsersSorted(sortColumn: string, sortDir: string) {
  // Whitelist approach
  const allowedColumns = ['name', 'email', 'created_at']
  if (!allowedColumns.includes(sortColumn)) {
    throw new Error('Invalid sort column')
  }

  // Additional validation
  validateColumnReference(sortColumn)

  return await db
    .selectFrom('users')
    .selectAll()
    .orderBy(db.dynamic.ref(sortColumn), sortDir as 'asc' | 'desc')
    .execute()
}
```

### Pattern 2: Safe Pagination

```typescript
import { safeLimit, safeOffset } from 'noormme/util/security'

async function getPagedUsers(page: string, limit: string) {
  const pageNum = parseInt(page) || 1
  const limitNum = parseInt(limit) || 10

  const validLimit = safeLimit(limitNum)
  const validOffset = safeOffset((pageNum - 1) * limitNum)

  return await sql`
    SELECT * FROM users
    LIMIT ${validLimit}
    OFFSET ${validOffset}
  `.execute(db)
}
```

### Pattern 3: Safe Search with User Input

```typescript
import { validateColumnReference } from 'noormme/util/security'

async function searchUsers(
  searchColumn: string,
  searchValue: string
) {
  // Whitelist validation
  const searchableColumns = ['name', 'email', 'username']
  if (!searchableColumns.includes(searchColumn)) {
    throw new Error('Invalid search column')
  }

  // Additional security validation
  validateColumnReference(searchColumn)

  // Use parameterized query for value (safe by default)
  return await db
    .selectFrom('users')
    .selectAll()
    .where(db.dynamic.ref(searchColumn), 'like', `%${searchValue}%`)
    .execute()
}
```

### Pattern 4: Safe File Operations

```typescript
import { sanitizeDatabasePath } from 'noormme/util/security'

async function openDatabase(userDbPath: string) {
  const safePath = sanitizeDatabasePath(userDbPath)

  return new NOORMME({
    dialect: 'sqlite',
    connection: { database: safePath }
  })
}
```

## ⚠️ What NOT to Do

### ❌ NEVER use sql.raw() with user input

```typescript
// VULNERABLE - DO NOT DO THIS
const userInput = req.query.column
sql`SELECT ${sql.raw(userInput)} FROM users`  // ❌ SQL INJECTION!
```

### ❌ NEVER use sql.lit() with user input

```typescript
// VULNERABLE - DO NOT DO THIS
const userValue = req.query.value
sql`SELECT * FROM users WHERE name = ${sql.lit(userValue)}`  // ❌ SQL INJECTION!
```

### ❌ NEVER skip validation

```typescript
// VULNERABLE - DO NOT DO THIS
const userColumn = req.query.column
db.dynamic.ref(userColumn)  // ❌ No whitelist validation!
```

## ✅ What TO Do Instead

### ✅ Use parameterized queries for values

```typescript
// SAFE
const userValue = req.query.value
sql`SELECT * FROM users WHERE name = ${userValue}`  // ✅ Parameterized
```

### ✅ Use safe helpers for SQL syntax

```typescript
// SAFE
const direction = safeOrderDirection(req.query.dir)
sql`SELECT * FROM users ORDER BY name ${direction}`  // ✅ Validated
```

### ✅ Always use whitelists for identifiers

```typescript
// SAFE
const allowedColumns = ['name', 'email']
const column = req.query.column

if (!allowedColumns.includes(column)) {
  throw new Error('Invalid column')
}

validateColumnReference(column)
db.dynamic.ref(column)  // ✅ Validated against whitelist
```

## 🔒 Security Checklist

Before deploying code that uses dynamic SQL:

- [ ] All user inputs validated against whitelists
- [ ] `validateColumnReference()` used for dynamic columns
- [ ] `validateTableReference()` used for dynamic tables
- [ ] `validateFilePath()` used for file operations
- [ ] No `sql.raw()` with user input
- [ ] No `sql.lit()` with user input
- [ ] Safe alternatives used (safeOrderDirection, safeLimit, etc.)
- [ ] Rate limiting enabled for sensitive operations
- [ ] Error messages don't leak sensitive information

## 📚 Additional Resources

- [OWASP SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [NOORMME Security Policy](../../SECURITY.md)
- [NOORMME Security Audit Report](../../SECURITY_AUDIT_REPORT.md)

## 🤝 Contributing

When adding new security utilities:

1. Add comprehensive validation
2. Include clear error messages
3. Document with examples
4. Add to security.ts exports
5. Update this README
6. Add unit tests

## 📝 License

MIT License - See LICENSE file for details
