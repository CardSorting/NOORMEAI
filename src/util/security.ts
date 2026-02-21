/**
 * Security utilities for NOORMME
 * Export all security-related functions for easy import
 */

// Input validation and sanitization
export {
  validateIdentifier,
  validateTableReference,
  validateColumnReference,
  validateFilePath,
  sanitizeDatabasePath,
  validateOutputDirectory,
  validateMigrationName,
  RateLimiter,
} from './security-validator.js'

// Safe SQL helpers
export {
  safeOrderDirection,
  safeLimit,
  safeOffset,
  safeKeyword,
  safeLockMode,
  safeOrderBy,
  safeBoolean,
  safeCaseStatement,
  SafeSQLKeywords,
  SafeSQLExamples,
  validateEnum,
  validateNumericRange,
  type SafeOrderBy,
  type SafeCaseWhen,
} from './safe-sql-helpers.js'

/**
 * Security best practices and guidelines
 */
export const SecurityGuidelines = {
  /**
   * NEVER use sql.raw() or sql.lit() with user input
   */
  NEVER_USE_RAW_WITH_USER_INPUT: 'Use safe alternatives or parameterized queries',

  /**
   * ALWAYS validate dynamic identifiers
   */
  ALWAYS_VALIDATE_IDENTIFIERS: 'Use validateColumnReference() or validateTableReference()',

  /**
   * ALWAYS use whitelists for user-controlled values
   */
  ALWAYS_USE_WHITELISTS: 'Define allowed values and validate against them',

  /**
   * ALWAYS sanitize file paths
   */
  ALWAYS_SANITIZE_PATHS: 'Use validateFilePath() or sanitizeDatabasePath()',

  /**
   * PREFER parameterized queries
   */
  PREFER_PARAMETERIZED_QUERIES: 'Use sql`${value}` instead of sql.raw()',

  /**
   * PREFER safe helpers over raw SQL
   */
  PREFER_SAFE_HELPERS: 'Use safeOrderDirection(), safeLimit(), etc.',
} as const

/**
 * Quick security checklist for developers
 */
export function securityChecklist() {
  return `
NOORMME Security Checklist:

✅ Input Validation
  □ All user inputs validated with whitelists
  □ Dynamic columns/tables use validateColumnReference()/validateTableReference()
  □ File paths use validateFilePath() or sanitizeDatabasePath()

✅ SQL Injection Prevention
  □ No sql.raw() with user input
  □ No sql.lit() with user input
  □ Use safe alternatives: safeOrderDirection(), safeLimit(), etc.
  □ Parameterized queries used for all values

✅ Path Traversal Prevention
  □ All file operations validated
  □ No parent directory references (..) allowed
  □ No absolute paths accepted

✅ Production Readiness
  □ Environment variables for sensitive config
  □ Error messages don't leak sensitive info
  □ Rate limiting enabled for auth endpoints
  □ Database file permissions set (600/640)
  □ Dependencies updated regularly
  □ Backups encrypted and secure

Use this checklist before deploying to production!
`
}

/**
 * Common security patterns
 */
export const SecurityPatterns = {
  /**
   * Safe column selection from user input
   */
  safeColumnSelection: (userColumn: string, allowedColumns: string[]) => {
    if (!allowedColumns.includes(userColumn)) {
      throw new Error(`Invalid column: ${userColumn}`)
    }
    return userColumn
  },

  /**
   * Safe table selection from user input
   */
  safeTableSelection: (userTable: string, allowedTables: string[]) => {
    if (!allowedTables.includes(userTable)) {
      throw new Error(`Invalid table: ${userTable}`)
    }
    return userTable
  },

  /**
   * Safe enum validation
   */
  safeEnumValue: <T extends string>(
    value: string,
    allowedValues: readonly T[]
  ): T => {
    if (!allowedValues.includes(value as T)) {
      throw new Error(
        `Invalid value: ${value}. Allowed: ${allowedValues.join(', ')}`
      )
    }
    return value as T
  },

  /**
   * Safe numeric range validation
   */
  safeNumericValue: (
    value: number | string,
    min: number,
    max: number
  ): number => {
    const num = typeof value === 'string' ? parseFloat(value) : value
    if (isNaN(num) || num < min || num > max) {
      throw new Error(`Invalid number: ${value}. Must be between ${min} and ${max}`)
    }
    return num
  },
}
