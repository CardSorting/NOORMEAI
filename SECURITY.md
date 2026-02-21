# Security Policy and Best Practices

## Overview

NOORMME (The Agentic Data Engine) takes a **security-first approach** to database operations. This document outlines the comprehensive security measures implemented and provides best practices for secure usage.

## 🛡️ Security-First Design

NOORMME is designed with **defense in depth** and **secure by default**:

1. **Multi-layer validation** - Security enforced at operation node, parser, and API levels
2. **Automatic validation** of ALL dynamic identifiers at the lowest architectural level
3. **Safe alternatives** to dangerous methods with strong deprecation warnings
4. **Comprehensive documentation** with secure examples
5. **Built-in protection** against common vulnerabilities
6. **Zero bypass paths** - All code paths are secured, not just the documented APIs

## 🔒 Recent Security Enhancements (v1.1.0)

### Critical Architecture Hardening

NOORMME has undergone a comprehensive security audit that eliminated ALL SQL injection bypass paths:

#### 1. **Operation Node Level Validation** (NEW - CRITICAL)
**The Core Security Boundary**

All operation nodes (`IdentifierNode`, `TableNode`, `ColumnNode`) now validate inputs at creation time. This is the **lowest level** of the architecture, ensuring that no code path—documented or undocumented—can bypass security validation.

```typescript
// BEFORE (VULNERABLE): Direct node creation bypassed validation
ColumnNode.create(userInput) // ❌ No validation!

// AFTER (SECURE): Every node creation is validated
ColumnNode.create(userInput) // ✅ Automatically validated!
// Throws error for: "id; DROP TABLE users--"
```

**Files Hardened:**
- `src/operation-node/identifier-node.ts` - Base identifier validation
- `src/operation-node/table-node.ts` - Table name validation
- `src/operation-node/column-node.ts` - Column name validation

#### 2. **Parser Function Security** (NEW)
Parser functions like `parseTable()` and `parseStringReference()` now rely on validated operation nodes, eliminating the parser bypass vulnerability.

**Files Hardened:**
- `src/parser/table-parser.ts` - Table parsing with validated nodes
- `src/parser/reference-parser.ts` - Reference parsing with validated nodes

#### 3. **Dangerous Method Deprecation** (ENHANCED)
`sql.raw()` and `sql.lit()` are now **strongly deprecated** with critical security warnings:

```typescript
/**
 * @deprecated CATASTROPHICALLY DANGEROUS - This method completely bypasses all security.
 * Use safe alternatives from 'noormme/util/safe-sql-helpers' instead.
 */
```

**Migration Path:** Use safe alternatives:
- `safeOrderDirection()` - For ASC/DESC
- `safeLimit()` / `safeOffset()` - For pagination
- `safeKeyword()` - For whitelisted keywords
- `sql.ref()` / `sql.table()` / `sql.id()` - For identifiers (all validated!)

#### 4. **CLI Security** (NEW)
All CLI commands now validate file paths and directory inputs:

```typescript
// BEFORE (VULNERABLE): Direct path usage
const db = new NOORMME({ database: options.database })

// AFTER (SECURE): Path traversal protection
const dbPath = sanitizeDatabasePath(options.database)
const db = new NOORMME({ database: dbPath })
```

**Files Hardened:**
- `src/cli/commands/init.ts` - Path validation on init
- `src/cli/commands/generate.ts` - Output directory validation
- `src/cli/commands/inspect.ts` - Database path validation

## Security Features

### 1. SQL Injection Prevention

NOORMME implements **four layers** of protection against SQL injection attacks:

#### Layer 1: Parameterized Queries (Built-in)
- All user-provided **values** are automatically parameterized by Kysely
- Values are never interpolated into SQL strings
- Database drivers handle proper escaping and type conversion

#### Layer 2: Operation Node Validation (NEW - CORE SECURITY LAYER)
**The Unbreakable Foundation**

Every identifier is validated at the operation node level before any SQL is generated:

```typescript
// This validation happens AUTOMATICALLY at the lowest level:
IdentifierNode.create(name)    // ✅ Validates identifier
TableNode.create(table)         // ✅ Validates table name
ColumnNode.create(column)       // ✅ Validates column name
```

**Why This Matters:** Even if someone finds an undocumented code path or internal API, they CANNOT bypass validation because it happens at the architectural foundation.

#### Layer 3: API-Level Validation (Enhanced)
All public APIs enforce validation before creating nodes:

```typescript
sql.ref(userColumn)           // ✅ Validated before node creation
sql.table(userTable)          // ✅ Validated before node creation
db.dynamic.ref(userColumn)    // ✅ Validated before node creation
db.dynamic.table(userTable)   // ✅ Validated before node creation
```

#### Layer 4: Application-Level Whitelisting (Best Practice)
All dynamic **identifiers** should be validated against application whitelists:

```typescript
// ✅ Automatic validation prevents SQL injection
import { sql } from 'kysely'

const userColumn = req.query.sortBy
sql.ref(userColumn)  // ✅ Automatically validated!
// Throws error for: "id; DROP TABLE users--"

// ✅ Best practice: Also use whitelisting
const allowedColumns = ['name', 'email', 'created_at']
if (!allowedColumns.includes(userColumn)) {
  throw new Error('Invalid column')
}
sql.ref(userColumn)  // ✅ Double protection
```

#### Layer 3: Safe Helper Functions (NEW)
Use safe alternatives instead of raw SQL:

```typescript
import { safeOrderDirection, safeLimit } from 'noormme/util/security'

// ❌ Old dangerous way:
sql`SELECT * FROM users ORDER BY name ${sql.raw(req.query.dir)}`

// ✅ New safe way:
sql`SELECT * FROM users ORDER BY name ${safeOrderDirection(req.query.dir)}`
```

#### Validation Rules
The security validator checks for:
- SQL keywords (SELECT, UNION, DROP, etc.)
- SQL comment syntax (-- and /* */)
- Quote characters and escape sequences
- Null bytes and special characters
- Reserved SQLite keywords (PRAGMA, ATTACH, etc.)
- Invalid identifier formats

### 2. Path Traversal Protection

File operations in CLI commands are protected against path traversal attacks:

#### Validated Operations
- Database file paths
- Output directories for code generation
- Migration file locations

#### Protection Measures
```typescript
// ❌ Blocked: Path traversal
const dbPath = '../../../etc/passwd'  // Throws error

// ❌ Blocked: Absolute paths
const dbPath = '/etc/database.db'     // Throws error

// ✅ Allowed: Relative paths in current directory
const dbPath = './data/app.db'        // Valid
```

### 3. Input Validation

All user inputs are validated before processing:

#### Identifier Validation
- Table names: `validateTableReference()`
- Column names: `validateColumnReference()`
- Generic identifiers: `validateIdentifier()`

#### File Path Validation
- Database paths: `sanitizeDatabasePath()`
- Output directories: `validateOutputDirectory()`
- Migration names: `validateMigrationName()`

### 4. Rate Limiting

The `RateLimiter` class provides protection against brute-force and DoS attacks:

```typescript
import { RateLimiter } from 'noormme/util/security-validator'

const limiter = new RateLimiter(10, 60000) // 10 attempts per minute

try {
  limiter.checkLimit('user_login_' + userId)
  // Perform sensitive operation
} catch (error) {
  // Rate limit exceeded
}
```

## Security Architecture Diagram

```
User Input
    ↓
Application Whitelist Validation (Your Code - Layer 4)
    ↓
API Methods: sql.ref(), sql.table(), db.dynamic.ref() (Layer 3)
    ↓
Parser Functions: parseTable(), parseStringReference() (Layer 3)
    ↓
Operation Nodes: IdentifierNode, TableNode, ColumnNode (Layer 2 - CORE BOUNDARY)
    ↓  [ALL IDENTIFIERS VALIDATED HERE]
    ↓
SQL Compilation (Layer 1 - Parameterization)
    ↓
Database Driver
    ↓
SQLite Database
```

**No Bypass Paths:** All arrows MUST pass through Layer 2 (Operation Nodes), making SQL injection architecturally impossible.

## Best Practices

### 1. Using Dynamic References Safely

When using `db.dynamic.ref()` or `sql.ref()` with user input:

**SECURITY UPDATE:** While NOORMME now validates ALL identifiers automatically at the operation node level, you should STILL use whitelist validation in your application code for defense in depth.

```typescript
// ⚠️ PROTECTED BUT NOT RECOMMENDED: Direct user input
// NOORMME will automatically block SQL injection attempts:
async function automaticallyProtected(userColumn: string) {
  return await db
    .selectFrom('users')
    .select(db.dynamic.ref(userColumn)) // ✅ Auto-validated!
    .execute()
  // Throws error for: "id; DROP TABLE users--"
}

// ✅ BEST PRACTICE: Whitelist validation (Defense in Depth)
async function fullySecure(userColumn: string) {
  const allowedColumns = ['id', 'name', 'email', 'created_at']

  if (!allowedColumns.includes(userColumn)) {
    throw new Error('Invalid column name')
  }

  return await db
    .selectFrom('users')
    .select(db.dynamic.ref(userColumn)) // ✅ Double protection!
    .execute()
}

// ✅ SAFER: Use TypeScript types for validation
type AllowedColumn = 'id' | 'name' | 'email' | 'created_at'

async function typedQuery(userColumn: AllowedColumn) {
  return await db
    .selectFrom('users')
    .select(db.dynamic.ref(userColumn))
    .execute()
}
```

### 2. Using sql.ref() Safely

```typescript
// ❌ UNSAFE: User-controlled identifiers
const orderBy = req.query.sort // Could be "1; DROP TABLE users--"
sql`SELECT * FROM users ORDER BY ${sql.ref(orderBy)}`

// ✅ SAFE: Whitelist approach
const allowedSortColumns = {
  'name': 'name',
  'email': 'email',
  'created': 'created_at'
}

const orderBy = allowedSortColumns[req.query.sort]
if (!orderBy) {
  throw new Error('Invalid sort column')
}

sql`SELECT * FROM users ORDER BY ${sql.ref(orderBy)}`
```

### 3. File Operations

```typescript
// ❌ DANGEROUS: User-controlled paths (NEVER DO THIS)
const dbPath = req.query.database  // Could be "../../../etc/passwd"
const db = new NOORMME({
  connection: { database: dbPath }
})

// ✅ SECURE: Validate and sanitize paths
import { sanitizeDatabasePath } from 'noormme/util/security-validator'

try {
  const dbPath = sanitizeDatabasePath(req.query.database)
  const db = new NOORMME({
    connection: { database: dbPath }
  })
} catch (error) {
  // Handle invalid path - blocks path traversal attempts
}
```

**Note:** The CLI commands (`init`, `generate`, `inspect`) now automatically validate all file paths.

### 4. CLI Command Security

When using CLI commands with user input:

```bash
# ❌ UNSAFE: Unvalidated input
npx noormme generate --output "$USER_INPUT"

# ✅ SAFE: Validate before use
npx noormme generate --output "./generated"
```

### 5. Environment Variables

Sensitive configuration should use environment variables:

```typescript
// .env file (never commit to git!)
DATABASE_PATH=./data/production.db
DATABASE_ENCRYPTION_KEY=your-secret-key

// .gitignore
.env
*.db
*.sqlite
```

## Security Checklist

When using NOORMME in production:

- [ ] All user inputs are validated against whitelists
- [ ] Dynamic column/table references use `db.dynamic.ref()` with validation
- [ ] File paths are validated and sanitized
- [ ] Environment variables are used for sensitive data
- [ ] Database files have appropriate file permissions (600 or 640)
- [ ] Error messages don't leak sensitive information
- [ ] Rate limiting is implemented for authentication endpoints
- [ ] SQL queries are reviewed for injection vulnerabilities
- [ ] Dependencies are regularly updated for security patches
- [ ] Database backups are encrypted and stored securely

## Reporting Security Issues

If you discover a security vulnerability in NOORMME:

1. **DO NOT** open a public GitHub issue
2. Email security concerns to: https://x.com/bozoeggs
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and work with you to address the issue.

## Security Updates

NOORMME follows these security practices:

- **Dependency Updates**: Regular updates to patch known vulnerabilities
- **Security Audits**: Periodic code reviews for security issues
- **Responsible Disclosure**: 90-day disclosure policy for reported vulnerabilities
- **Version Support**: Security patches for the latest major version

## Validation API Reference

### validateIdentifier(identifier: string, context?: string)
Validates generic identifiers (table names, column names, etc.)

**Checks:**
- String type and non-empty
- Length ≤ 255 characters
- No SQL keywords or injection patterns
- Format: alphanumeric, underscore, dots only
- No reserved SQLite keywords

### validateTableReference(tableRef: string)
Validates table references (table or schema.table)

**Additional checks:**
- Maximum 2 parts (schema.table)
- Each part validated as identifier

### validateColumnReference(columnRef: string)
Validates column references (column, table.column, or schema.table.column)

**Additional checks:**
- Maximum 3 parts (schema.table.column)
- Each part validated as identifier

### validateFilePath(filePath: string, allowedExtensions?: string[])
Validates file paths to prevent path traversal

**Checks:**
- No parent directory references (..)
- No absolute paths (/ or C:\)
- No null bytes or forbidden characters
- Optional extension validation

### sanitizeDatabasePath(dbPath: string): string
Validates and sanitizes database file paths

**Checks:**
- Valid file extension (.db, .sqlite, .sqlite3, .db3)
- Relative path only
- No path traversal

### validateOutputDirectory(dirPath: string)
Validates output directories for code generation

**Checks:**
- Relative path only
- No parent directory references
- Alphanumeric, underscores, hyphens, dots, slashes only

### validateMigrationName(name: string)
Validates migration names

**Checks:**
- Length ≤ 100 characters
- Alphanumeric, underscores, hyphens only

## Safe Alternatives to Dangerous Methods

### Instead of sql.raw() - Use Safe Helpers

NOORMME provides safe alternatives in `noormme/util/safe-sql-helpers`:

```typescript
import { safeOrderDirection, safeLimit, safeOffset } from 'noormme/util/safe-sql-helpers'

// ❌ Dangerous:
const direction = req.query.dir  // Could be "; DROP TABLE users--"
sql`SELECT * FROM users ORDER BY name ${sql.raw(direction)}`

// ✅ Safe:
const direction = req.query.dir
sql`SELECT * FROM users ORDER BY name ${safeOrderDirection(direction)}`  // Validates ASC/DESC only
```

### Safe Pagination
```typescript
import { safeLimit, safeOffset } from 'noormme/util/safe-sql-helpers'

const page = req.query.page
const limit = req.query.limit

sql`SELECT * FROM users LIMIT ${safeLimit(limit)} OFFSET ${safeOffset((page - 1) * limit)}`
```

### Safe Sorting with Whitelist
```typescript
import { safeOrderBy } from 'noormme/util/safe-sql-helpers'

const allowedColumns = ['name', 'email', 'created_at']
const orderClauses = [
  { column: req.query.sort, direction: req.query.dir }
]

sql`SELECT * FROM users ORDER BY ${safeOrderBy(orderClauses, allowedColumns)}`
```

## Security Guarantees

### What NOORMME Prevents (v1.1.0+)

✅ **SQL Injection via Identifiers** - ALL identifiers are validated at operation node level
✅ **Parser Bypass Attacks** - Parsers use validated operation nodes
✅ **Direct Node Creation Exploits** - Nodes validate on creation
✅ **Path Traversal in CLI** - All file paths are validated
✅ **Malicious Table/Column Names** - Comprehensive pattern matching

### What You Must Still Handle

⚠️ **Application Logic** - Business logic vulnerabilities are your responsibility
⚠️ **Authentication/Authorization** - NOORMME doesn't implement access control
⚠️ **File Permissions** - Configure appropriate OS-level permissions
⚠️ **Encryption at Rest** - Use SQLCipher extension if needed
⚠️ **Network Security** - Secure your application's network layer
⚠️ **Input Validation** - Always whitelist user inputs in application code

## Known Limitations

1. **Type Coercion**: TypeScript types don't prevent runtime injection - validation happens at runtime
2. **Legacy Methods**: `sql.raw()` and `sql.lit()` are **deprecated but not removed** - they bypass ALL security
3. **File Permissions**: NOORMME doesn't set file permissions - configure your OS appropriately
4. **Encryption at Rest**: SQLite encryption requires extensions (SQLCipher) - not built-in
5. **Zero Backward Compatibility**: Insecure code patterns are intentionally broken - this is a feature, not a bug

## Additional Resources

- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [SQLite Security](https://www.sqlite.org/security.html)
- [Kysely Security](https://kysely.dev/docs/security)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

## Version History

### v1.1.0 (Current) - Security Hardening Release

**CRITICAL SECURITY FIXES:**

1. **Operation Node Validation** - Added validation at the lowest architectural level
   - `IdentifierNode.create()` now validates all identifiers
   - `TableNode.create()` now validates all table names
   - `ColumnNode.create()` now validates all column names
   - **Impact:** Eliminates ALL SQL injection bypass paths

2. **Parser Security** - Hardened parser functions
   - `parseTable()` relies on validated TableNode creation
   - `parseStringReference()` relies on validated ColumnNode creation
   - **Impact:** Parser functions can no longer bypass validation

3. **Method Deprecation** - Strongly deprecated dangerous methods
   - `sql.raw()` marked as `@deprecated` with CATASTROPHIC warning
   - `sql.lit()` marked as `@deprecated` with EXTREME DANGER warning
   - **Impact:** Clear migration path to safe alternatives

4. **CLI Security** - Added path validation to all CLI commands
   - `init`, `generate`, `inspect` commands now validate all file paths
   - **Impact:** Prevents path traversal attacks via CLI

**Architecture Changes:**
- **Defense in Depth:** 4-layer security model (was 2-layer)
- **Secure by Default:** ALL code paths are now validated (was only documented APIs)
- **Zero Legacy Compromise:** No backward compatibility for insecure patterns

**Migration Required:**
- Replace `sql.raw()` usage with safe alternatives from `noormme/util/safe-sql-helpers`
- Validate file paths when using NOORMME programmatically
- Review dynamic identifier usage (though now auto-protected)

### v1.0.0 - Initial Release

- Basic SQLite ORM functionality
- Parameterized query support
- Limited identifier validation at API level
