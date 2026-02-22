import {
  DatabaseConnection,
  QueryResult,
} from '../../driver/database-connection.js'
import { Driver, TransactionSettings } from '../../driver/driver.js'
import { CompiledQuery } from '../../query-compiler/compiled-query.js'
import { freeze, isFunction } from '../../util/object-utils.js'
import {
  PostgresDialectConfig,
  PostgresPool,
  PostgresPoolClient,
  PostgresCursor,
} from './postgresql-dialect-config.js'

const PRIVATE_RELEASE_METHOD = Symbol()

export class PostgresDriver implements Driver {
  readonly #config: PostgresDialectConfig
  #connections = new WeakMap<PostgresPoolClient, PostgresConnection>()
  #pool?: PostgresPool

  constructor(config: PostgresDialectConfig) {
    this.#config = freeze({ ...config })
  }

  async init(): Promise<void> {
    this.#pool = isFunction(this.#config.pool)
      ? await this.#config.pool()
      : this.#config.pool

    if (!this.#pool && this.#config.poolConfig) {
      // Create pool from config if not provided
      const { Pool } = await import('pg')
      this.#pool = new Pool(this.#config.poolConfig)
    }

    if (!this.#pool) {
      throw new Error(
        'PostgreSQL pool not configured. Please provide either a pool instance or poolConfig.',
      )
    }
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    const client = await this.#pool!.connect()
    let connection = this.#connections.get(client)

    if (!connection) {
      connection = new PostgresConnection(client, {
        cursor: this.#config.cursor,
      })
      this.#connections.set(client, connection)

      // The connection needs to be released by calling `releaseConnection`
      await this.#config.onCreateConnection?.(connection)
    }

    return connection
  }

  async beginTransaction(
    connection: DatabaseConnection,
    settings: TransactionSettings,
  ): Promise<void> {
    if (settings.isolationLevel) {
      await connection.executeQuery(
        CompiledQuery.raw(
          `begin transaction isolation level ${settings.isolationLevel}`,
        ),
      )
    } else {
      await connection.executeQuery(CompiledQuery.raw('begin'))
    }
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('commit'))
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('rollback'))
  }

  async releaseConnection(connection: PostgresConnection): Promise<void> {
    connection[PRIVATE_RELEASE_METHOD]()
  }

  async destroy(): Promise<void> {
    if (this.#pool) {
      const pool = this.#pool
      this.#pool = undefined
      await pool.end()
    }
  }
}

interface PostgresConnectionOptions {
  cursor: PostgresDialectConfig['cursor']
}

class PostgresConnection implements DatabaseConnection {
  #client: PostgresPoolClient
  #options: PostgresConnectionOptions

  constructor(client: PostgresPoolClient, options: PostgresConnectionOptions) {
    this.#client = client
    this.#options = freeze({ ...options })
  }

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const result = await this.#client.query<R>(
      compiledQuery.sql,
      compiledQuery.parameters as any[],
    )

    if (
      result.command === 'INSERT' ||
      result.command === 'UPDATE' ||
      result.command === 'DELETE'
    ) {
      const numAffectedRows = BigInt(result.rowCount ?? 0)

      // Attempt to extract insertId from rows if RETURNING was used
      let insertId: bigint | undefined
      if (result.command === 'INSERT' && result.rows.length > 0) {
        const firstRow = result.rows[0] as any
        const idValue = firstRow.id ?? firstRow.ID ?? Object.values(firstRow)[0]
        if (
          typeof idValue === 'number' ||
          typeof idValue === 'bigint' ||
          typeof idValue === 'string'
        ) {
          try {
            insertId = BigInt(idValue)
          } catch {
            // Not a valid bigint representation, ignore
          }
        }
      }

      return {
        insertId,
        rows: result.rows ?? [],
        numAffectedRows,
      }
    }

    return {
      rows: result.rows ?? [],
    }
  }

  async *streamQuery<R>(
    compiledQuery: CompiledQuery,
    chunkSize: number,
  ): AsyncIterableIterator<QueryResult<R>> {
    if (!this.#options.cursor) {
      throw new Error(
        'Cursor is not configured. To use streaming queries, please provide a cursor constructor in the dialect config.',
      )
    }

    const cursor: PostgresCursor = new this.#options.cursor(
      compiledQuery.sql,
      compiledQuery.parameters as any[],
    )

    try {
      while (true) {
        const rows = await cursor.read(chunkSize)

        if (rows.length === 0) {
          break
        }

        yield {
          rows,
        }
      }
    } finally {
      await cursor.close()
    }
  }

  [PRIVATE_RELEASE_METHOD](): void {
    this.#client.release()
  }
}
