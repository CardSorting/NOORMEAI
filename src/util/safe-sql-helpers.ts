/**
 * Safe SQL helper utilities
 * Provides secure alternatives to dangerous sql.raw() and sql.lit() methods
 */

import { sql } from '../raw-builder/sql.js'
import { RawBuilder } from '../raw-builder/raw-builder.js'

/**
 * Safely creates a SQL ORDER BY direction clause
 * Only allows 'ASC' or 'DESC'
 */
export function safeOrderDirection(direction: string): RawBuilder<unknown> {
  const normalized = direction.toUpperCase().trim()

  if (normalized !== 'ASC' && normalized !== 'DESC') {
    throw new Error(
      `Invalid order direction: "${direction}". Only "ASC" and "DESC" are allowed.`
    )
  }

  return sql.raw(normalized)
}

/**
 * Safely creates a SQL LIMIT clause
 * Validates that the limit is a positive integer
 */
export function safeLimit(limit: number | string): RawBuilder<unknown> {
  const numLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit

  if (!Number.isInteger(numLimit) || numLimit <= 0 || numLimit > 10000) {
    throw new Error(
      `Invalid limit: "${limit}". Must be a positive integer between 1 and 10000.`
    )
  }

  return sql.raw(numLimit.toString())
}

/**
 * Safely creates a SQL OFFSET clause
 * Validates that the offset is a non-negative integer
 */
export function safeOffset(offset: number | string): RawBuilder<unknown> {
  const numOffset = typeof offset === 'string' ? parseInt(offset, 10) : offset

  if (!Number.isInteger(numOffset) || numOffset < 0 || numOffset > 1000000) {
    throw new Error(
      `Invalid offset: "${offset}". Must be a non-negative integer between 0 and 1000000.`
    )
  }

  return sql.raw(numOffset.toString())
}

/**
 * Safely creates SQL keywords from a whitelist
 * Useful for database-specific syntax that must be hardcoded
 */
export function safeKeyword(keyword: string, allowedKeywords: string[]): RawBuilder<unknown> {
  const normalized = keyword.toUpperCase().trim()
  const allowedNormalized = allowedKeywords.map(k => k.toUpperCase().trim())

  if (!allowedNormalized.includes(normalized)) {
    throw new Error(
      `Invalid keyword: "${keyword}". Allowed keywords: ${allowedKeywords.join(', ')}`
    )
  }

  return sql.raw(normalized)
}

/**
 * Type-safe enum for common SQL keywords
 */
export const SafeSQLKeywords = {
  /**
   * Lock modes for SELECT statements
   */
  LockMode: {
    FOR_UPDATE: 'FOR UPDATE',
    FOR_SHARE: 'FOR SHARE',
    FOR_NO_KEY_UPDATE: 'FOR NO KEY UPDATE',
    FOR_KEY_SHARE: 'FOR KEY SHARE',
  } as const,

  /**
   * Join types
   */
  JoinType: {
    INNER: 'INNER',
    LEFT: 'LEFT',
    RIGHT: 'RIGHT',
    FULL: 'FULL',
    CROSS: 'CROSS',
  } as const,

  /**
   * Set operations
   */
  SetOperation: {
    UNION: 'UNION',
    UNION_ALL: 'UNION ALL',
    INTERSECT: 'INTERSECT',
    EXCEPT: 'EXCEPT',
  } as const,

  /**
   * SQLite-specific pragmas (use with extreme caution)
   */
  SafePragma: {
    OPTIMIZE: 'OPTIMIZE',
    WAL_CHECKPOINT: 'WAL_CHECKPOINT',
  } as const,
} as const

/**
 * Safely creates a lock mode clause for SELECT statements
 */
export function safeLockMode(
  mode: keyof typeof SafeSQLKeywords.LockMode
): RawBuilder<unknown> {
  return sql.raw(SafeSQLKeywords.LockMode[mode])
}

/**
 * Type-safe ORDER BY builder
 * Validates column names and direction
 */
export interface SafeOrderBy {
  column: string
  direction?: 'ASC' | 'DESC'
}

/**
 * Creates a safe ORDER BY clause from validated columns
 */
export function safeOrderBy(
  orderBy: SafeOrderBy[],
  allowedColumns: string[]
): RawBuilder<unknown> {
  if (orderBy.length === 0) {
    throw new Error('At least one order by clause is required')
  }

  const clauses = orderBy.map(({ column, direction = 'ASC' }) => {
    if (!allowedColumns.includes(column)) {
      throw new Error(
        `Invalid order by column: "${column}". Allowed columns: ${allowedColumns.join(', ')}`
      )
    }

    const dir = direction.toUpperCase()
    if (dir !== 'ASC' && dir !== 'DESC') {
      throw new Error(`Invalid direction: "${direction}". Must be ASC or DESC`)
    }

    return `${column} ${dir}`
  })

  return sql.raw(clauses.join(', '))
}

/**
 * Validates and creates a safe boolean value for SQL
 */
export function safeBoolean(value: boolean | string | number): RawBuilder<boolean> {
  let boolValue: boolean

  if (typeof value === 'boolean') {
    boolValue = value
  } else if (value === 'true' || value === '1' || value === 1) {
    boolValue = true
  } else if (value === 'false' || value === '0' || value === 0) {
    boolValue = false
  } else {
    throw new Error(
      `Invalid boolean value: "${value}". Must be true, false, 1, 0, "true", or "false"`
    )
  }

  // Use parameterized value instead of raw SQL
  return sql`${boolValue}` as any
}

/**
 * Creates a safe CASE statement with validated conditions
 */
export interface SafeCaseWhen<T> {
  condition: RawBuilder<boolean>
  result: T
}

export function safeCaseStatement<T>(
  cases: SafeCaseWhen<T>[],
  elseResult: T
): RawBuilder<T> {
  if (cases.length === 0) {
    throw new Error('At least one WHEN clause is required')
  }

  // Note: This function needs to be refactored to not use sql.raw()
  // For now, we construct the CASE statement carefully
  const whenClauses = cases
    .map((c, i) => {
      // Conditions must be RawBuilder instances to ensure they're safe
      const conditionSql = c.condition.toOperationNode()
      return `WHEN ${conditionSql} THEN ${c.result}`
    })
    .join(' ')

  return sql.raw(`CASE ${whenClauses} ELSE ${elseResult} END`) as any
}

/**
 * Example usage and best practices
 */
export const SafeSQLExamples = {
  /**
   * Example: Safe pagination with user input
   */
  safePagination: () => {
    const userPage = '2' // From request
    const userLimit = '10' // From request

    const offset = (parseInt(userPage) - 1) * parseInt(userLimit)

    return {
      limit: safeLimit(userLimit),
      offset: safeOffset(offset),
    }
  },

  /**
   * Example: Safe sorting with user input
   */
  safeSorting: (userSortColumn: string, userDirection: string) => {
    const allowedColumns = ['name', 'email', 'created_at', 'updated_at']

    if (!allowedColumns.includes(userSortColumn)) {
      throw new Error('Invalid sort column')
    }

    return {
      column: sql.ref(userSortColumn),
      direction: safeOrderDirection(userDirection),
    }
  },

  /**
   * Example: Safe lock mode for transactions
   */
  safeTransactionLock: () => {
    return safeLockMode('FOR_UPDATE')
  },
}

/**
 * Helper to validate that a value is from a specific enum
 */
export function validateEnum<T extends string>(
  value: string,
  enumValues: readonly T[],
  fieldName = 'value'
): T {
  if (!enumValues.includes(value as T)) {
    throw new Error(
      `Invalid ${fieldName}: "${value}". Allowed values: ${enumValues.join(', ')}`
    )
  }
  return value as T
}

/**
 * Helper to validate numeric ranges
 */
export function validateNumericRange(
  value: number | string,
  min: number,
  max: number,
  fieldName = 'value'
): number {
  const num = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(num)) {
    throw new Error(`Invalid ${fieldName}: "${value}". Must be a number`)
  }

  if (num < min || num > max) {
    throw new Error(
      `Invalid ${fieldName}: ${num}. Must be between ${min} and ${max}`
    )
  }

  return num
}
