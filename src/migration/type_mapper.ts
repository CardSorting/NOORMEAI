/**
 * Type mapping between SQLite and PostgreSQL
 */

import { TypeMapping } from './migration-types.js'

/**
 * Map SQLite types to PostgreSQL types
 */
export const SQLITE_TO_POSTGRES_TYPES: Record<string, string> = {
  // Integer types
  'INTEGER': 'INTEGER',
  'INT': 'INTEGER',
  'TINYINT': 'SMALLINT',
  'SMALLINT': 'SMALLINT',
  'MEDIUMINT': 'INTEGER',
  'BIGINT': 'BIGINT',
  
  // Real/Float types
  'REAL': 'REAL',
  'DOUBLE': 'DOUBLE PRECISION',
  'DOUBLE PRECISION': 'DOUBLE PRECISION',
  'FLOAT': 'REAL',
  
  // Numeric/Decimal
  'NUMERIC': 'NUMERIC',
  'DECIMAL': 'DECIMAL',
  
  // Text types
  'TEXT': 'TEXT',
  'CHARACTER': 'VARCHAR',
  'VARCHAR': 'VARCHAR',
  'VARYING CHARACTER': 'VARCHAR',
  'NCHAR': 'VARCHAR',
  'NATIVE CHARACTER': 'VARCHAR',
  'NVARCHAR': 'VARCHAR',
  'CLOB': 'TEXT',
  
  // Binary types
  'BLOB': 'BYTEA',
  
  // Boolean
  'BOOLEAN': 'BOOLEAN',
  
  // Date/Time types (SQLite stores as text/integer)
  'DATE': 'DATE',
  'DATETIME': 'TIMESTAMP',
  'TIMESTAMP': 'TIMESTAMP',
  'TIME': 'TIME',
}

/**
 * Map PostgreSQL types to SQLite types
 */
export const POSTGRES_TO_SQLITE_TYPES: Record<string, string> = {
  // Integer types
  'INTEGER': 'INTEGER',
  'INT': 'INTEGER',
  'INT4': 'INTEGER',
  'SMALLINT': 'INTEGER',
  'INT2': 'INTEGER',
  'BIGINT': 'INTEGER',
  'INT8': 'INTEGER',
  'SERIAL': 'INTEGER',
  'BIGSERIAL': 'INTEGER',
  'SMALLSERIAL': 'INTEGER',
  
  // Float types
  'REAL': 'REAL',
  'FLOAT4': 'REAL',
  'DOUBLE PRECISION': 'REAL',
  'FLOAT8': 'REAL',
  
  // Numeric
  'NUMERIC': 'NUMERIC',
  'DECIMAL': 'NUMERIC',
  
  // Text types
  'TEXT': 'TEXT',
  'VARCHAR': 'TEXT',
  'CHARACTER VARYING': 'TEXT',
  'CHAR': 'TEXT',
  'CHARACTER': 'TEXT',
  'BPCHAR': 'TEXT',
  
  // Binary
  'BYTEA': 'BLOB',
  
  // Boolean
  'BOOLEAN': 'INTEGER',
  'BOOL': 'INTEGER',
  
  // Date/Time
  'DATE': 'TEXT',
  'TIME': 'TEXT',
  'TIMESTAMP': 'TEXT',
  'TIMESTAMPTZ': 'TEXT',
  'TIMESTAMP WITH TIME ZONE': 'TEXT',
  'TIMESTAMP WITHOUT TIME ZONE': 'TEXT',
  'INTERVAL': 'TEXT',
  
  // JSON
  'JSON': 'TEXT',
  'JSONB': 'TEXT',
  
  // UUID
  'UUID': 'TEXT',
  
  // Network types
  'INET': 'TEXT',
  'CIDR': 'TEXT',
  'MACADDR': 'TEXT',
  
  // Geometric types (simplified)
  'POINT': 'TEXT',
  'LINE': 'TEXT',
  'LSEG': 'TEXT',
  'BOX': 'TEXT',
  'PATH': 'TEXT',
  'POLYGON': 'TEXT',
  'CIRCLE': 'TEXT',
  
  // Array types - convert to TEXT in SQLite
  'TEXT[]': 'TEXT',
  'INTEGER[]': 'TEXT',
  'BIGINT[]': 'TEXT',
  'BOOLEAN[]': 'TEXT',
  'DATE[]': 'TEXT',
  'TIMESTAMP[]': 'TEXT',
  'UUID[]': 'TEXT',
  'JSON[]': 'TEXT',
  'JSONB[]': 'TEXT',
  
  // Full-text search
  'TSVECTOR': 'TEXT',
  'TSQUERY': 'TEXT',
}

/**
 * Map type from source dialect to target dialect
 */
export function mapType(
  sourceType: string,
  sourceDialect: 'sqlite' | 'postgresql',
  targetDialect: 'sqlite' | 'postgresql'
): string {
  // Normalize type name
  const normalizedType = sourceType.toUpperCase().trim()
  
  // If same dialect, return as-is
  if (sourceDialect === targetDialect) {
    return sourceType
  }
  
  // Map between dialects
  if (sourceDialect === 'sqlite' && targetDialect === 'postgresql') {
    // Extract type without length/precision
    const baseType = normalizedType.split('(')[0].trim()
    const mapped = SQLITE_TO_POSTGRES_TYPES[baseType]
    
    if (mapped) {
      // Preserve length/precision if present
      const lengthMatch = sourceType.match(/\(([^)]+)\)/)
      if (lengthMatch && !['TEXT', 'BLOB'].includes(baseType)) {
        return `${mapped}(${lengthMatch[1]})`
      }
      return mapped
    }
    
    // Default to TEXT if no mapping found
    return 'TEXT'
  }
  
  if (sourceDialect === 'postgresql' && targetDialect === 'sqlite') {
    // Extract type without length/precision
    const baseType = normalizedType.split('(')[0].trim()
    const mapped = POSTGRES_TO_SQLITE_TYPES[baseType]
    
    if (mapped) {
      return mapped
    }
    
    // Default to TEXT if no mapping found
    return 'TEXT'
  }
  
  // Fallback
  return sourceType
}

/**
 * Get data transformation for value migration
 */
export function getValueTransformation(
  sourceType: string,
  targetType: string,
  sourceDialect: 'sqlite' | 'postgresql',
  targetDialect: 'sqlite' | 'postgresql'
): ((value: any) => any) | undefined {
  const normalizedSource = sourceType.toUpperCase().trim().split('(')[0]
  const normalizedTarget = targetType.toUpperCase().trim().split('(')[0]
  
  // PostgreSQL to SQLite transformations
  if (sourceDialect === 'postgresql' && targetDialect === 'sqlite') {
    // Boolean: true/false -> 1/0
    if (normalizedSource === 'BOOLEAN' || normalizedSource === 'BOOL') {
      return (value: any) => {
        if (value === null || value === undefined) return null
        return value ? 1 : 0
      }
    }
    
    // Arrays: convert to JSON string
    if (normalizedSource.includes('[]')) {
      return (value: any) => {
        if (value === null || value === undefined) return null
        if (Array.isArray(value)) return JSON.stringify(value)
        return value
      }
    }
    
    // JSON/JSONB: ensure string
    if (normalizedSource === 'JSON' || normalizedSource === 'JSONB') {
      return (value: any) => {
        if (value === null || value === undefined) return null
        if (typeof value === 'string') return value
        return JSON.stringify(value)
      }
    }
    
    // Date/Time: ensure ISO string
    if (['DATE', 'TIME', 'TIMESTAMP', 'TIMESTAMPTZ'].includes(normalizedSource)) {
      return (value: any) => {
        if (value === null || value === undefined) return null
        if (value instanceof Date) return value.toISOString()
        return String(value)
      }
    }
  }
  
  // SQLite to PostgreSQL transformations
  if (sourceDialect === 'sqlite' && targetDialect === 'postgresql') {
    // Integer to Boolean: 0/1 -> false/true
    if (normalizedTarget === 'BOOLEAN') {
      return (value: any) => {
        if (value === null || value === undefined) return null
        return value !== 0
      }
    }
    
    // Text to Array: parse JSON string
    if (normalizedTarget.includes('[]')) {
      return (value: any) => {
        if (value === null || value === undefined) return null
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value)
            return Array.isArray(parsed) ? parsed : [parsed]
          } catch {
            return value
          }
        }
        return value
      }
    }
    
    // Text to JSON/JSONB: parse if needed
    if (normalizedTarget === 'JSON' || normalizedTarget === 'JSONB') {
      return (value: any) => {
        if (value === null || value === undefined) return null
        if (typeof value === 'string') {
          try {
            return JSON.parse(value)
          } catch {
            return value
          }
        }
        return value
      }
    }
  }
  
  return undefined
}

/**
 * Check if types are compatible
 */
export function areTypesCompatible(
  sourceType: string,
  targetType: string,
  sourceDialect: 'sqlite' | 'postgresql',
  targetDialect: 'sqlite' | 'postgresql'
): boolean {
  if (sourceDialect === targetDialect) {
    return sourceType.toUpperCase() === targetType.toUpperCase()
  }
  
  const mapped = mapType(sourceType, sourceDialect, targetDialect)
  return mapped.toUpperCase().split('(')[0] === targetType.toUpperCase().split('(')[0]
}

