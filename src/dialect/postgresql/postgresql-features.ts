/**
 * PostgreSQL-specific features and type definitions
 * 
 * This module provides PostgreSQL-specific functionality including:
 * - Array column types
 * - JSON/JSONB support
 * - Full-text search
 * - Materialized views
 */

import { sql } from '../../raw-builder/sql.js'
import { RawBuilder } from '../../raw-builder/raw-builder.js'
import { Kysely } from '../../kysely.js'

/**
 * PostgreSQL array column types
 */
export type PostgresArrayType =
  | 'text[]'
  | 'varchar[]'
  | 'integer[]'
  | 'bigint[]'
  | 'smallint[]'
  | 'numeric[]'
  | 'decimal[]'
  | 'real[]'
  | 'double precision[]'
  | 'boolean[]'
  | 'date[]'
  | 'timestamp[]'
  | 'timestamptz[]'
  | 'uuid[]'
  | 'json[]'
  | 'jsonb[]'

/**
 * PostgreSQL full-text search types
 */
export type PostgresFullTextType = 'tsvector' | 'tsquery'

/**
 * Extended PostgreSQL column types
 */
export type PostgresColumnType = PostgresArrayType | PostgresFullTextType

/**
 * Helper functions for PostgreSQL array operations
 */
export const PostgresArrayHelpers = {
  /**
   * Create an array literal
   * 
   * @example
   * ```typescript
   * // Creates ARRAY['foo', 'bar', 'baz']
   * PostgresArrayHelpers.array(['foo', 'bar', 'baz'])
   * ```
   */
  array<T>(values: T[]): RawBuilder<T[]> {
    const literalValues = values.map(v => 
      typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : String(v)
    ).join(', ')
    return sql<T[]>`ARRAY[${sql.raw(literalValues)}]`
  },

  /**
   * Check if array contains value
   * 
   * @example
   * ```typescript
   * // WHERE tags @> ARRAY['typescript']
   * .where(PostgresArrayHelpers.contains('tags', ['typescript']))
   * ```
   */
  contains(column: string, values: unknown[]): RawBuilder<boolean> {
    return sql<boolean>`${sql.ref(column)} @> ${this.array(values)}`
  },

  /**
   * Check if array is contained by another
   * 
   * @example
   * ```typescript
   * // WHERE tags <@ ARRAY['typescript', 'javascript']
   * .where(PostgresArrayHelpers.containedBy('tags', ['typescript', 'javascript']))
   * ```
   */
  containedBy(column: string, values: unknown[]): RawBuilder<boolean> {
    return sql<boolean>`${sql.ref(column)} <@ ${this.array(values)}`
  },

  /**
   * Check if arrays overlap
   * 
   * @example
   * ```typescript
   * // WHERE tags && ARRAY['typescript', 'rust']
   * .where(PostgresArrayHelpers.overlap('tags', ['typescript', 'rust']))
   * ```
   */
  overlap(column: string, values: unknown[]): RawBuilder<boolean> {
    return sql<boolean>`${sql.ref(column)} && ${this.array(values)}`
  },

  /**
   * Get array length
   * 
   * @example
   * ```typescript
   * // SELECT array_length(tags, 1) as tag_count
   * .select(PostgresArrayHelpers.length('tags').as('tag_count'))
   * ```
   */
  length(column: string, dimension: number = 1): RawBuilder<number> {
    return sql<number>`array_length(${sql.ref(column)}, ${dimension})`
  },

  /**
   * Append element to array
   * 
   * @example
   * ```typescript
   * // UPDATE users SET tags = array_append(tags, 'new-tag')
   * .set({ tags: PostgresArrayHelpers.append('tags', 'new-tag') })
   * ```
   */
  append(column: string, value: unknown): RawBuilder<unknown[]> {
    const literal = typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : String(value)
    return sql<unknown[]>`array_append(${sql.ref(column)}, ${sql.raw(literal)})`
  },

  /**
   * Remove element from array
   * 
   * @example
   * ```typescript
   * // UPDATE users SET tags = array_remove(tags, 'old-tag')
   * .set({ tags: PostgresArrayHelpers.remove('tags', 'old-tag') })
   * ```
   */
  remove(column: string, value: unknown): RawBuilder<unknown[]> {
    const literal = typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : String(value)
    return sql<unknown[]>`array_remove(${sql.ref(column)}, ${sql.raw(literal)})`
  },

  /**
   * Unnest array to rows
   * 
   * @example
   * ```typescript
   * // SELECT unnest(tags) as tag FROM users
   * .select(PostgresArrayHelpers.unnest('tags').as('tag'))
   * ```
   */
  unnest(column: string): RawBuilder<unknown> {
    return sql<unknown>`unnest(${sql.ref(column)})`
  },
}

/**
 * Helper functions for PostgreSQL JSON/JSONB operations
 */
export const PostgresJSONHelpers = {
  /**
   * Extract JSON field as text
   * 
   * @example
   * ```typescript
   * // SELECT data->>'name' as name
   * .select(PostgresJSONHelpers.extract('data', 'name').as('name'))
   * ```
   */
  extract(column: string, path: string): RawBuilder<string | null> {
    return sql<string | null>`${sql.ref(column)}->>${path}`
  },

  /**
   * Extract JSON field as JSON
   * 
   * @example
   * ```typescript
   * // SELECT data->'address' as address
   * .select(PostgresJSONHelpers.extractJSON('data', 'address').as('address'))
   * ```
   */
  extractJSON(column: string, path: string): RawBuilder<unknown> {
    return sql<unknown>`${sql.ref(column)}->${path}`
  },

  /**
   * Extract nested JSON field using path
   * 
   * @example
   * ```typescript
   * // SELECT data#>>'{address,city}' as city
   * .select(PostgresJSONHelpers.extractPath('data', ['address', 'city']).as('city'))
   * ```
   */
  extractPath(column: string, path: string[]): RawBuilder<string | null> {
    const pathStr = `{${path.join(',')}}`
    return sql<string | null>`${sql.ref(column)}#>>${pathStr}`
  },

  /**
   * Check if JSON contains key
   * 
   * @example
   * ```typescript
   * // WHERE data ? 'email'
   * .where(PostgresJSONHelpers.hasKey('data', 'email'))
   * ```
   */
  hasKey(column: string, key: string): RawBuilder<boolean> {
    return sql<boolean>`${sql.ref(column)} ? ${key}`
  },

  /**
   * Check if JSON contains any of the keys
   * 
   * @example
   * ```typescript
   * // WHERE data ?| ARRAY['email', 'phone']
   * .where(PostgresJSONHelpers.hasAnyKey('data', ['email', 'phone']))
   * ```
   */
  hasAnyKey(column: string, keys: string[]): RawBuilder<boolean> {
    return sql<boolean>`${sql.ref(column)} ?| ARRAY[${keys.map(k => `'${k}'`).join(', ')}]`
  },

  /**
   * Check if JSON contains all keys
   * 
   * @example
   * ```typescript
   * // WHERE data ?& ARRAY['email', 'phone']
   * .where(PostgresJSONHelpers.hasAllKeys('data', ['email', 'phone']))
   * ```
   */
  hasAllKeys(column: string, keys: string[]): RawBuilder<boolean> {
    return sql<boolean>`${sql.ref(column)} ?& ARRAY[${keys.map(k => `'${k}'`).join(', ')}]`
  },

  /**
   * Check if JSONB contains value
   * 
   * @example
   * ```typescript
   * // WHERE data @> '{"status": "active"}'::jsonb
   * .where(PostgresJSONHelpers.contains('data', { status: 'active' }))
   * ```
   */
  contains(column: string, value: unknown): RawBuilder<boolean> {
    return sql<boolean>`${sql.ref(column)} @> ${JSON.stringify(value)}::jsonb`
  },

  /**
   * Check if JSONB is contained by value
   * 
   * @example
   * ```typescript
   * // WHERE data <@ '{"status": "active", "role": "admin"}'::jsonb
   * .where(PostgresJSONHelpers.containedBy('data', { status: 'active', role: 'admin' }))
   * ```
   */
  containedBy(column: string, value: unknown): RawBuilder<boolean> {
    return sql<boolean>`${sql.ref(column)} <@ ${JSON.stringify(value)}::jsonb`
  },

  /**
   * Set JSON field value
   * 
   * @example
   * ```typescript
   * // UPDATE users SET data = jsonb_set(data, '{address,city}', '"New York"')
   * .set({ data: PostgresJSONHelpers.set('data', ['address', 'city'], 'New York') })
   * ```
   */
  set(column: string, path: string[], value: unknown): RawBuilder<unknown> {
    const pathStr = `{${path.join(',')}}`
    return sql<unknown>`jsonb_set(${sql.ref(column)}, ${pathStr}, ${JSON.stringify(value)}::jsonb)`
  },

  /**
   * Delete JSON field
   * 
   * @example
   * ```typescript
   * // UPDATE users SET data = data - 'temporary_field'
   * .set({ data: PostgresJSONHelpers.delete('data', 'temporary_field') })
   * ```
   */
  delete(column: string, key: string): RawBuilder<unknown> {
    return sql<unknown>`${sql.ref(column)} - ${key}`
  },
}

/**
 * Helper functions for PostgreSQL full-text search
 */
export const PostgresFullTextHelpers = {
  /**
   * Convert text to tsvector
   * 
   * @example
   * ```typescript
   * // SELECT to_tsvector('english', content) as search_vector
   * .select(PostgresFullTextHelpers.toTSVector('content', 'english').as('search_vector'))
   * ```
   */
  toTSVector(column: string, config: string = 'english'): RawBuilder<unknown> {
    return sql<unknown>`to_tsvector(${config}, ${sql.ref(column)})`
  },

  /**
   * Convert text to tsquery
   * 
   * @example
   * ```typescript
   * // SELECT to_tsquery('english', 'typescript & programming')
   * PostgresFullTextHelpers.toTSQuery('typescript & programming', 'english')
   * ```
   */
  toTSQuery(query: string, config: string = 'english'): RawBuilder<unknown> {
    return sql<unknown>`to_tsquery(${config}, ${query})`
  },

  /**
   * Convert plain text to tsquery
   * 
   * @example
   * ```typescript
   * // to_plainto_tsquery('english', 'typescript programming')
   * PostgresFullTextHelpers.plainToTSQuery('typescript programming', 'english')
   * ```
   */
  plainToTSQuery(query: string, config: string = 'english'): RawBuilder<unknown> {
    return sql<unknown>`plainto_tsquery(${config}, ${query})`
  },

  /**
   * Full-text search match
   * 
   * @example
   * ```typescript
   * // WHERE search_vector @@ to_tsquery('english', 'typescript')
   * .where(PostgresFullTextHelpers.match('search_vector', 'typescript'))
   * ```
   */
  match(column: string, query: string, config: string = 'english'): RawBuilder<boolean> {
    return sql<boolean>`${sql.ref(column)} @@ to_tsquery(${config}, ${query})`
  },

  /**
   * Full-text search with ranking
   * 
   * @example
   * ```typescript
   * // SELECT ts_rank(search_vector, to_tsquery('typescript')) as rank
   * .select(PostgresFullTextHelpers.rank('search_vector', 'typescript').as('rank'))
   * ```
   */
  rank(column: string, query: string, config: string = 'english'): RawBuilder<number> {
    return sql<number>`ts_rank(${sql.ref(column)}, to_tsquery(${config}, ${query}))`
  },

  /**
   * Full-text search with headline (highlighting)
   * 
   * @example
   * ```typescript
   * // SELECT ts_headline('english', content, to_tsquery('typescript'))
   * .select(PostgresFullTextHelpers.headline('content', 'typescript').as('excerpt'))
   * ```
   */
  headline(column: string, query: string, config: string = 'english', options?: string): RawBuilder<string> {
    if (options) {
      return sql<string>`ts_headline(${config}, ${sql.ref(column)}, to_tsquery(${config}, ${query}), ${options})`
    }
    return sql<string>`ts_headline(${config}, ${sql.ref(column)}, to_tsquery(${config}, ${query}))`
  },

  /**
   * Create GIN index for full-text search
   * 
   * @example
   * ```typescript
   * await PostgresFullTextHelpers.createGINIndex(db, 'posts', 'search_vector')
   * ```
   */
  async createGINIndex(
    db: Kysely<any>,
    table: string,
    column: string,
    indexName?: string
  ): Promise<void> {
    const name = indexName || `${table}_${column}_gin_idx`
    await sql`CREATE INDEX IF NOT EXISTS ${sql.ref(name)} ON ${sql.table(table)} USING GIN(${sql.ref(column)})`.execute(db)
  },

  /**
   * Add generated tsvector column
   * 
   * @example
   * ```typescript
   * await PostgresFullTextHelpers.addGeneratedTSVectorColumn(
   *   db, 
   *   'posts', 
   *   'search_vector', 
   *   ['title', 'content']
   * )
   * ```
   */
  async addGeneratedTSVectorColumn(
    db: Kysely<any>,
    table: string,
    columnName: string,
    sourceColumns: string[],
    config: string = 'english'
  ): Promise<void> {
    const concatenated = sourceColumns.map(col => `coalesce(${col}, '')`).join(` || ' ' || `)
    await sql`
      ALTER TABLE ${sql.table(table)}
      ADD COLUMN IF NOT EXISTS ${sql.ref(columnName)} tsvector
      GENERATED ALWAYS AS (to_tsvector(${config}, ${sql.raw(concatenated)})) STORED
    `.execute(db)
  },
}

/**
 * Helper functions for PostgreSQL materialized views
 */
export const PostgresMaterializedViewHelpers = {
  /**
   * Create a materialized view
   * 
   * @example
   * ```typescript
   * await PostgresMaterializedViewHelpers.create(
   *   db,
   *   'user_stats',
   *   sql`SELECT user_id, COUNT(*) as post_count FROM posts GROUP BY user_id`
   * )
   * ```
   */
  async create(
    db: Kysely<any>,
    viewName: string,
    query: RawBuilder<any>,
    options?: {
      withData?: boolean
      tablespace?: string
    }
  ): Promise<void> {
    const withData = options?.withData !== false ? 'WITH DATA' : 'WITH NO DATA'
    const tablespace = options?.tablespace ? `TABLESPACE ${options.tablespace}` : ''
    
    await sql`
      CREATE MATERIALIZED VIEW IF NOT EXISTS ${sql.ref(viewName)}
      ${sql.raw(tablespace)}
      AS ${query}
      ${sql.raw(withData)}
    `.execute(db)
  },

  /**
   * Refresh a materialized view
   * 
   * @example
   * ```typescript
   * await PostgresMaterializedViewHelpers.refresh(db, 'user_stats')
   * ```
   */
  async refresh(
    db: Kysely<any>,
    viewName: string,
    options?: {
      concurrently?: boolean
      withData?: boolean
    }
  ): Promise<void> {
    const concurrently = options?.concurrently ? 'CONCURRENTLY' : ''
    const withData = options?.withData === false ? 'WITH NO DATA' : 'WITH DATA'
    
    await sql`
      REFRESH MATERIALIZED VIEW ${sql.raw(concurrently)} ${sql.ref(viewName)}
      ${sql.raw(withData)}
    `.execute(db)
  },

  /**
   * Drop a materialized view
   * 
   * @example
   * ```typescript
   * await PostgresMaterializedViewHelpers.drop(db, 'user_stats')
   * ```
   */
  async drop(
    db: Kysely<any>,
    viewName: string,
    options?: {
      ifExists?: boolean
      cascade?: boolean
    }
  ): Promise<void> {
    const ifExists = options?.ifExists !== false ? 'IF EXISTS' : ''
    const cascade = options?.cascade ? 'CASCADE' : ''
    
    await sql`
      DROP MATERIALIZED VIEW ${sql.raw(ifExists)} ${sql.ref(viewName)} ${sql.raw(cascade)}
    `.execute(db)
  },

  /**
   * Create unique index on materialized view (enables concurrent refresh)
   * 
   * @example
   * ```typescript
   * await PostgresMaterializedViewHelpers.createUniqueIndex(
   *   db,
   *   'user_stats',
   *   ['user_id']
   * )
   * ```
   */
  async createUniqueIndex(
    db: Kysely<any>,
    viewName: string,
    columns: string[],
    indexName?: string
  ): Promise<void> {
    const name = indexName || `${viewName}_${columns.join('_')}_idx`
    const columnList = columns.map(c => sql.ref(c)).join(', ')
    
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS ${sql.ref(name)}
      ON ${sql.ref(viewName)} (${sql.raw(columnList)})
    `.execute(db)
  },

  /**
   * Get materialized view info
   * 
   * @example
   * ```typescript
   * const info = await PostgresMaterializedViewHelpers.getInfo(db, 'user_stats')
   * console.log(info.ispopulated) // true if view has data
   * ```
   */
  async getInfo(
    db: Kysely<any>,
    viewName: string
  ): Promise<{
    schemaname: string
    matviewname: string
    matviewowner: string
    tablespace: string | null
    hasindexes: boolean
    ispopulated: boolean
    definition: string
  } | null> {
    const result = await sql<{
      schemaname: string
      matviewname: string
      matviewowner: string
      tablespace: string | null
      hasindexes: boolean
      ispopulated: boolean
      definition: string
    }>`
      SELECT
        schemaname,
        matviewname,
        matviewowner,
        tablespace,
        hasindexes,
        ispopulated,
        definition
      FROM pg_matviews
      WHERE matviewname = ${viewName}
    `.execute(db)

    return result.rows[0] || null
  },
}

