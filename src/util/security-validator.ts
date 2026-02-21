/**
 * Security validation utilities for NOORMME
 * Provides input validation and sanitization to prevent injection attacks
 */

/**
 * Validates identifier names (table names, column names, schema names)
 * to prevent SQL injection through dynamic identifiers
 */
export function validateIdentifier(identifier: string, context = 'identifier'): void {
  if (typeof identifier !== 'string') {
    throw new Error(`${context} must be a string`)
  }

  if (identifier.length === 0) {
    throw new Error(`${context} cannot be empty`)
  }

  if (identifier.length > 255) {
    throw new Error(`${context} exceeds maximum length of 255 characters`)
  }

  // Check for SQL injection patterns
  const dangerousPatterns = [
    /;/,                    // SQL statement separator
    /--/,                   // SQL comment
    /\/\*/,                 // Multi-line comment start
    /\*\//,                 // Multi-line comment end
    /\bUNION\b/i,           // UNION injection
    /\bSELECT\b.*\bFROM\b/i, // SELECT injection
    /\bINSERT\b.*\bINTO\b/i, // INSERT injection
    /\bUPDATE\b.*\bSET\b/i,  // UPDATE injection
    /\bDELETE\b.*\bFROM\b/i, // DELETE injection
    /\bDROP\b/i,            // DROP injection
    /\bEXEC\b/i,            // EXEC injection
    /\bEXECUTE\b/i,         // EXECUTE injection
    /\bCREATE\b/i,          // CREATE injection
    /\bALTER\b/i,           // ALTER injection
    /\bTRUNCATE\b/i,        // TRUNCATE injection
    /['"`]/,                // Quote characters
    /\\/,                   // Backslash escape
    /\x00/,                 // Null byte
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(identifier)) {
      throw new Error(
        `Invalid ${context}: "${identifier}" contains potentially dangerous characters or SQL keywords. ` +
        `Identifiers must contain only alphanumeric characters, underscores, and dots (for schema.table references).`
      )
    }
  }

  // Validate format: alphanumeric, underscore, and dots for schema.table.column
  const validIdentifierPattern = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/
  if (!validIdentifierPattern.test(identifier)) {
    throw new Error(
      `Invalid ${context}: "${identifier}". ` +
      `Identifiers must start with a letter or underscore, followed by alphanumeric characters or underscores. ` +
      `Schema/table references can use dots (e.g., "schema.table" or "table.column").`
    )
  }

  // Additional check: prevent reserved SQLite keywords that could be dangerous
  const reservedKeywords = [
    'PRAGMA', 'ATTACH', 'DETACH', 'VACUUM', 'ANALYZE', 'REINDEX'
  ]

  for (const keyword of reservedKeywords) {
    if (identifier.toUpperCase() === keyword) {
      throw new Error(
        `Invalid ${context}: "${identifier}" is a reserved SQLite keyword and cannot be used as an identifier`
      )
    }
  }
}

/**
 * Validates table reference for dynamic table operations
 */
export function validateTableReference(tableRef: string): void {
  validateIdentifier(tableRef, 'table reference')

  // Additional validation for table references
  const parts = tableRef.split('.')
  if (parts.length > 2) {
    throw new Error(
      `Invalid table reference: "${tableRef}". ` +
      `Table references can have at most 2 parts (schema.table).`
    )
  }

  // Validate each part
  parts.forEach((part, index) => {
    const context = index === 0 ? (parts.length === 2 ? 'schema name' : 'table name') : 'table name'
    validateIdentifier(part, context)
  })
}

/**
 * Validates column reference for dynamic column operations
 */
export function validateColumnReference(columnRef: string): void {
  validateIdentifier(columnRef, 'column reference')

  // Column references can have: column, table.column, or schema.table.column
  const parts = columnRef.split('.')
  if (parts.length > 3) {
    throw new Error(
      `Invalid column reference: "${columnRef}". ` +
      `Column references can have at most 3 parts (schema.table.column).`
    )
  }

  // Validate each part
  parts.forEach((part, index) => {
    let context: string
    if (parts.length === 1) {
      context = 'column name'
    } else if (parts.length === 2) {
      context = index === 0 ? 'table name' : 'column name'
    } else {
      context = index === 0 ? 'schema name' : (index === 1 ? 'table name' : 'column name')
    }
    validateIdentifier(part, context)
  })
}

/**
 * Validates file paths to prevent path traversal attacks
 */
export function validateFilePath(filePath: string, allowedExtensions?: string[]): void {
  if (typeof filePath !== 'string') {
    throw new Error('File path must be a string')
  }

  if (filePath.length === 0) {
    throw new Error('File path cannot be empty')
  }

  // Check for path traversal patterns
  const pathTraversalPatterns = [
    /\.\./,           // Parent directory reference
    /~\//,            // Home directory reference
    /^\/+/,           // Absolute path (starts with /)
    /^[a-zA-Z]:\\/,   // Windows absolute path (C:\)
    /\\/,             // Backslash (Windows path separator)
    /\x00/,           // Null byte injection
  ]

  for (const pattern of pathTraversalPatterns) {
    if (pattern.test(filePath)) {
      throw new Error(
        `Invalid file path: "${filePath}" contains path traversal or absolute path patterns. ` +
        `Only relative paths within the current directory are allowed.`
      )
    }
  }

  // Validate file extension if specified
  if (allowedExtensions && allowedExtensions.length > 0) {
    const hasValidExtension = allowedExtensions.some(ext =>
      filePath.toLowerCase().endsWith(ext.toLowerCase())
    )

    if (!hasValidExtension) {
      throw new Error(
        `Invalid file extension for "${filePath}". ` +
        `Allowed extensions: ${allowedExtensions.join(', ')}`
      )
    }
  }

  // Check for suspicious file names
  const suspiciousNames = [
    /^\.+$/,          // Only dots
    /^\s*$/,          // Only whitespace
    /[<>:"|?*]/,      // Windows forbidden characters
  ]

  for (const pattern of suspiciousNames) {
    if (pattern.test(filePath)) {
      throw new Error(
        `Invalid file path: "${filePath}" contains forbidden characters or is malformed`
      )
    }
  }
}

/**
 * Sanitizes database path for CLI commands
 */
export function sanitizeDatabasePath(dbPath: string): string {
  validateFilePath(dbPath, ['.db', '.sqlite', '.sqlite3', '.db3'])

  // Ensure the path doesn't escape current directory
  if (dbPath.includes('..') || dbPath.startsWith('/') || /^[a-zA-Z]:/.test(dbPath)) {
    throw new Error(
      `Database path "${dbPath}" must be a relative path within the current directory`
    )
  }

  return dbPath
}

/**
 * Validates output directory for code generation
 */
export function validateOutputDirectory(dirPath: string): void {
  if (typeof dirPath !== 'string') {
    throw new Error('Output directory must be a string')
  }

  if (dirPath.length === 0) {
    throw new Error('Output directory cannot be empty')
  }

  // Prevent path traversal
  if (dirPath.includes('..')) {
    throw new Error(
      `Output directory "${dirPath}" cannot contain parent directory references (..)`
    )
  }

  // Prevent absolute paths
  if (dirPath.startsWith('/') || /^[a-zA-Z]:/.test(dirPath)) {
    throw new Error(
      `Output directory "${dirPath}" must be a relative path`
    )
  }

  // Validate format
  const validDirPattern = /^[a-zA-Z0-9_\-./]+$/
  if (!validDirPattern.test(dirPath)) {
    throw new Error(
      `Invalid output directory: "${dirPath}". ` +
      `Directory paths must contain only alphanumeric characters, underscores, hyphens, dots, and forward slashes.`
    )
  }
}

/**
 * Validates migration name
 */
export function validateMigrationName(name: string): void {
  if (typeof name !== 'string') {
    throw new Error('Migration name must be a string')
  }

  if (name.length === 0) {
    throw new Error('Migration name cannot be empty')
  }

  if (name.length > 100) {
    throw new Error('Migration name exceeds maximum length of 100 characters')
  }

  // Allow only alphanumeric, underscores, and hyphens
  const validNamePattern = /^[a-zA-Z0-9_\-]+$/
  if (!validNamePattern.test(name)) {
    throw new Error(
      `Invalid migration name: "${name}". ` +
      `Migration names must contain only alphanumeric characters, underscores, and hyphens.`
    )
  }
}

/**
 * Rate limiting for security-sensitive operations
 */
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map()

  constructor(
    private maxAttempts: number = 10,
    private windowMs: number = 60000 // 1 minute
  ) {}

  checkLimit(key: string): void {
    const now = Date.now()
    const attempts = this.attempts.get(key) || []

    // Remove old attempts outside the window
    const recentAttempts = attempts.filter(time => now - time < this.windowMs)

    if (recentAttempts.length >= this.maxAttempts) {
      throw new Error(
        `Rate limit exceeded for ${key}. Please wait before trying again.`
      )
    }

    recentAttempts.push(now)
    this.attempts.set(key, recentAttempts)

    // Cleanup old entries periodically
    if (this.attempts.size > 1000) {
      this.cleanup(now)
    }
  }

  private cleanup(now: number): void {
    for (const [key, attempts] of this.attempts.entries()) {
      const recentAttempts = attempts.filter(time => now - time < this.windowMs)
      if (recentAttempts.length === 0) {
        this.attempts.delete(key)
      } else {
        this.attempts.set(key, recentAttempts)
      }
    }
  }
}
