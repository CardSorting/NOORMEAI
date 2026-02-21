import { DatabaseConnection } from '../../driver/database-connection.js'
import type { Pool, PoolConfig, QueryResult } from 'pg'

/**
 * Config for the PostgreSQL dialect.
 */
export interface PostgresDialectConfig {
  /**
   * A postgres Pool instance or a function that returns one.
   *
   * If a function is provided, it's called once when the first query is executed.
   *
   * https://node-postgres.com/apis/pool
   */
  pool?: PostgresPool | (() => Promise<PostgresPool>)

  /**
   * Pool configuration for PostgreSQL
   * 
   * https://node-postgres.com/apis/pool
   */
  poolConfig?: PoolConfig

  /**
   * Called once for each created connection.
   *
   * This is a NOORMME specific feature and does not come from the `pg` module.
   */
  onCreateConnection?: (connection: DatabaseConnection) => Promise<void>

  /**
   * Cursor constructor for streaming queries.
   */
  cursor?: PostgresCursorConstructor
}

/**
 * This interface is the subset of pg Pool that NOORMME needs.
 *
 * We don't use the type from `pg` here to not have a dependency to it.
 *
 * https://node-postgres.com/apis/pool
 */
export interface PostgresPool {
  connect(): Promise<PostgresPoolClient>
  end(): Promise<void>
  query<R = any>(sql: string, parameters?: ReadonlyArray<unknown>): Promise<PostgresQueryResult<R>>
}

export interface PostgresPoolClient {
  query<R = any>(sql: string, parameters?: ReadonlyArray<unknown>): Promise<PostgresQueryResult<R>>
  release(): void
}

export interface PostgresQueryResult<R = any> {
  command: string
  rowCount: number | null
  rows: R[]
}

/**
 * https://github.com/brianc/node-pg-cursor
 */
export interface PostgresCursorConstructor {
  new (text: string, values: unknown[], config?: unknown): PostgresCursor
}

/**
 * https://github.com/brianc/node-pg-cursor
 */
export interface PostgresCursor extends AsyncIterableIterator<any> {
  read(rowCount: number): Promise<any[]>
  close(): Promise<void>
}

