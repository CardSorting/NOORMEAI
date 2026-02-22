import {
  DatabaseConnection,
  QueryResult,
} from '../../driver/database-connection.js'
import { Driver } from '../../driver/driver.js'
import { SelectQueryNode } from '../../operation-node/select-query-node.js'
import { parseSavepointCommand } from '../../parser/savepoint-parser.js'
import { CompiledQuery } from '../../query-compiler/compiled-query.js'
import { QueryCompiler } from '../../query-compiler/query-compiler.js'
import { freeze, isFunction } from '../../util/object-utils.js'
import { createQueryId } from '../../util/query-id.js'
import { SqliteDatabase, SqliteDialectConfig } from './sqlite-dialect-config.js'

export class SqliteDriver implements Driver {
  readonly #config: SqliteDialectConfig
  readonly #connectionMutex = new ConnectionMutex()

  #db?: SqliteDatabase
  #connection?: DatabaseConnection

  constructor(config: SqliteDialectConfig) {
    this.#config = freeze({ ...config })
  }

  async init(): Promise<void> {
    this.#db = isFunction(this.#config.database)
      ? await this.#config.database()
      : this.#config.database

    this.#connection = new SqliteConnection(this.#db)

    if (this.#config.onCreateConnection) {
      await this.#config.onCreateConnection(this.#connection)
    }
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    if (!this.#connection) {
      throw new Error('driver has already been destroyed')
    }

    // SQLite only has one single connection. We use a mutex here to wait
    // until the single connection has been released.
    await this.#connectionMutex.lock()
    return this.#connection!
  }

  async beginTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('begin'))
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('commit'))
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('rollback'))
  }

  async savepoint(
    connection: DatabaseConnection,
    savepointName: string,
    compileQuery: QueryCompiler['compileQuery'],
  ): Promise<void> {
    await connection.executeQuery(
      compileQuery(
        parseSavepointCommand('savepoint', savepointName),
        createQueryId(),
      ),
    )
  }

  async rollbackToSavepoint(
    connection: DatabaseConnection,
    savepointName: string,
    compileQuery: QueryCompiler['compileQuery'],
  ): Promise<void> {
    await connection.executeQuery(
      compileQuery(
        parseSavepointCommand('rollback to', savepointName),
        createQueryId(),
      ),
    )
  }

  async releaseSavepoint(
    connection: DatabaseConnection,
    savepointName: string,
    compileQuery: QueryCompiler['compileQuery'],
  ): Promise<void> {
    await connection.executeQuery(
      compileQuery(
        parseSavepointCommand('release', savepointName),
        createQueryId(),
      ),
    )
  }

  async releaseConnection(): Promise<void> {
    this.#connectionMutex.unlock()
  }

  async destroy(): Promise<void> {
    if (this.#db) {
      this.#db.close()
      this.#db = undefined
      this.#connection = undefined
    }
  }
}

class SqliteConnection implements DatabaseConnection {
  readonly #db: SqliteDatabase

  constructor(db: SqliteDatabase) {
    this.#db = db
  }

  executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
    const { sql, parameters } = compiledQuery

    // Convert parameters to SQLite-compatible types
    const sqliteParameters = parameters.map((param) => {
      if (param === undefined) {
        return null
      }
      if (typeof param === 'boolean') {
        return param ? 1 : 0
      }
      if (param instanceof Date) {
        return param.toISOString()
      }
      if (typeof param === 'object' && param !== null) {
        return JSON.stringify(param)
      }
      return param
    })

    const stmt = this.#db.prepare(sql)

    if (stmt.reader) {
      return Promise.resolve({
        rows: stmt.all(sqliteParameters) as O[],
      })
    }

    const { changes, lastInsertRowid } = stmt.run(sqliteParameters)

    return Promise.resolve({
      numAffectedRows:
        changes !== undefined && changes !== null ? BigInt(changes) : undefined,
      insertId:
        lastInsertRowid !== undefined && lastInsertRowid !== null
          ? BigInt(lastInsertRowid)
          : undefined,
      rows: [],
    })
  }

  async *streamQuery<R>(
    compiledQuery: CompiledQuery,
    _chunkSize: number,
  ): AsyncIterableIterator<QueryResult<R>> {
    const { sql, parameters, query } = compiledQuery

    // Convert parameters to SQLite-compatible types
    const sqliteParameters = parameters.map((param) => {
      if (param === undefined) {
        return null
      }
      if (typeof param === 'boolean') {
        return param ? 1 : 0
      }
      if (param instanceof Date) {
        return param.toISOString()
      }
      if (typeof param === 'object' && param !== null) {
        return JSON.stringify(param)
      }
      return param
    })

    const stmt = this.#db.prepare(sql)
    if (stmt.reader) {
      const iter = stmt.iterate(sqliteParameters) as IterableIterator<R>
      for (const row of iter) {
        yield {
          rows: [row],
        }
      }
    } else {
      throw new Error(
        'Sqlite driver only supports streaming of queries that return rows',
      )
    }
  }
}

class ConnectionMutex {
  #promise?: Promise<void>
  #resolve?: () => void

  async lock(): Promise<void> {
    while (this.#promise) {
      await this.#promise
    }

    this.#promise = new Promise((resolve) => {
      this.#resolve = resolve
    })
  }

  unlock(): void {
    const resolve = this.#resolve

    this.#promise = undefined
    this.#resolve = undefined

    resolve?.()
  }
}
