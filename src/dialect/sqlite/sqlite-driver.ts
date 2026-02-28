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

// Global mutex registry for transactions.
// This prevents multiple transactions in the same Node.js process from
// attempting to BEGIN IMMEDIATE simultaneously, which would cause better-sqlite3 
// to block the event loop and deadlock the process.
const globalTransactionMutexRegistry = new Map<string, { mutex: ConnectionMutex; refCount: number }>()

export class SqliteDriver implements Driver {
  readonly #config: SqliteDialectConfig
  #transactionMutex!: ConnectionMutex
  #dbPath!: string

  #connections: SqliteConnection[] = []
  #freeConnections: SqliteConnection[] = []
  #waiters: ((conn: SqliteConnection) => void)[] = []
  #initialized = false

  constructor(config: SqliteDialectConfig) {
    this.#config = freeze({ ...config })
  }

  async init(): Promise<void> {
    const poolSize = this.#config.poolSize || 1
    
    for (let i = 0; i < poolSize; i++) {
      const db = isFunction(this.#config.database)
        ? await this.#config.database()
        : this.#config.database
        
      const conn = new SqliteConnection(db)
      this.#connections.push(conn)
      this.#freeConnections.push(conn)

      // Set baseline PRAGMAs for concurrency and performance
      await conn.executeQuery(CompiledQuery.raw('pragma busy_timeout = 5000'))
      await conn.executeQuery(CompiledQuery.raw('pragma journal_mode = WAL'))
      await conn.executeQuery(CompiledQuery.raw('pragma synchronous = NORMAL'))
      await conn.executeQuery(CompiledQuery.raw('pragma journal_size_limit = 67108864'))
      await conn.executeQuery(CompiledQuery.raw('pragma temp_store = MEMORY'))

      if (this.#config.onCreateConnection) {
        await this.#config.onCreateConnection(conn)
      }
      
      // If we are not using a factory function, we can't create a real pool.
      if (!isFunction(this.#config.database)) {
        break;
      }
    }

    // Retrieve database name/path (fallback to memory if not accessible)
    // We use the first connection to determine the path.
    const firstDb = this.#connections[0].db
    this.#dbPath = (firstDb as any).name || ':memory:'
    
    // Assign global transaction mutex keyed by path, with reference counting
    const entry = globalTransactionMutexRegistry.get(this.#dbPath)
    if (entry) {
      entry.refCount++
      this.#transactionMutex = entry.mutex
    } else {
      const mutex = new ConnectionMutex()
      globalTransactionMutexRegistry.set(this.#dbPath, { mutex, refCount: 1 })
      this.#transactionMutex = mutex
    }

    this.#initialized = true
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    if (!this.#initialized) {
      throw new Error('driver has not been initialized or has already been destroyed')
    }

    if (this.#freeConnections.length > 0) {
      return this.#freeConnections.pop()!
    }

    // Wait for a connection to become available
    return new Promise((resolve) => {
      this.#waiters.push(resolve)
    })
  }

  async beginTransaction(connection: DatabaseConnection): Promise<void> {
    // Lock the JS-level transaction mutex BEFORE executing BEGIN IMMEDIATE.
    // This ensures only one connection in this Node.js process attempts to start a transaction
    // at a time, preventing synchronous C-level event loop blocking during lock contention.
    await this.#transactionMutex.lock()
    const sqliteConn = connection as SqliteConnection
    sqliteConn.hasTransactionMutex = true
    
    // Acquire the reserved lock in SQLite
    await connection.executeQuery(CompiledQuery.raw('begin immediate'))
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('commit'))
    const sqliteConn = connection as SqliteConnection
    if (sqliteConn.hasTransactionMutex) {
      sqliteConn.hasTransactionMutex = false
      this.#transactionMutex.unlock()
    }
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('rollback'))
    const sqliteConn = connection as SqliteConnection
    if (sqliteConn.hasTransactionMutex) {
      sqliteConn.hasTransactionMutex = false
      this.#transactionMutex.unlock()
    }
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

  async releaseConnection(connection: DatabaseConnection): Promise<void> {
    const sqliteConn = connection as SqliteConnection
    
    // Safety check: ensure mutex is unlocked if connection is released abruptly
    if (sqliteConn.hasTransactionMutex) {
      sqliteConn.hasTransactionMutex = false
      this.#transactionMutex.unlock()
    }

    if (this.#waiters.length > 0) {
      const resolve = this.#waiters.shift()!
      resolve(sqliteConn)
    } else {
      this.#freeConnections.push(sqliteConn)
    }
  }

  async destroy(): Promise<void> {
    this.#initialized = false

    for (const conn of this.#connections) {
      conn.close()
    }
    
    this.#connections = []
    this.#freeConnections = []
    this.#waiters = []

    // Update reference counting and clean up global registry
    const entry = globalTransactionMutexRegistry.get(this.#dbPath)
    if (entry) {
      entry.refCount--
      if (entry.refCount <= 0) {
        globalTransactionMutexRegistry.delete(this.#dbPath)
      }
    }
  }
}

class SqliteConnection implements DatabaseConnection {
  readonly db: SqliteDatabase
  hasTransactionMutex: boolean = false

  constructor(db: SqliteDatabase) {
    this.db = db
  }

  close() {
    this.db.close()
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

    const stmt = this.db.prepare(sql)

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

    const stmt = this.db.prepare(sql)
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
