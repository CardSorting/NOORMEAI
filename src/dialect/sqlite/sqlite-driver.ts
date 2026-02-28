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

// Global WriteMutex registry.
// This serializes all writes to a specific SQLite file across multiple connections
// in the SAME Node.js process, preventing synchronous C-level event loop blocking.
const globalWriteMutexRegistry = new Map<string, { mutex: ConnectionMutex; refCount: number }>()

export class SqliteDriver implements Driver {
  readonly #config: SqliteDialectConfig
  #writeMutex!: ConnectionMutex
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
    
    // Retrieve database name/path (fallback to memory if not accessible)
    // We instantiate the first DB to get the path before building the pool
    const firstDb = isFunction(this.#config.database)
        ? await this.#config.database()
        : this.#config.database
        
    this.#dbPath = (firstDb as any).name || ':memory:'
    
    // Assign global write mutex keyed by path, with reference counting
    const entry = globalWriteMutexRegistry.get(this.#dbPath)
    if (entry) {
      entry.refCount++
      this.#writeMutex = entry.mutex
    } else {
      const mutex = new ConnectionMutex()
      globalWriteMutexRegistry.set(this.#dbPath, { mutex, refCount: 1 })
      this.#writeMutex = mutex
    }

    // Build the connection pool
    const conn1 = new SqliteConnection(firstDb, this.#writeMutex)
    this.#connections.push(conn1)
    this.#freeConnections.push(conn1)
    await this.#setupConnection(conn1)

    // If using a factory function, we can create a real pool.
    if (poolSize > 1 && isFunction(this.#config.database)) {
      for (let i = 1; i < poolSize; i++) {
        const db = await this.#config.database()
        const conn = new SqliteConnection(db, this.#writeMutex)
        this.#connections.push(conn)
        this.#freeConnections.push(conn)
        await this.#setupConnection(conn)
      }
    }

    this.#initialized = true
  }

  async #setupConnection(conn: SqliteConnection) {
    // Set baseline PRAGMAs for concurrency and performance
    await conn.executeQuery(CompiledQuery.raw('pragma busy_timeout = 5000'))
    await conn.executeQuery(CompiledQuery.raw('pragma journal_mode = WAL'))
    await conn.executeQuery(CompiledQuery.raw('pragma synchronous = NORMAL'))
    await conn.executeQuery(CompiledQuery.raw('pragma journal_size_limit = 67108864'))
    await conn.executeQuery(CompiledQuery.raw('pragma temp_store = MEMORY'))

    if (this.#config.onCreateConnection) {
      await this.#config.onCreateConnection(conn)
    }
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
    const sqliteConn = connection as SqliteConnection
    // Acquire the JS-level WriteMutex before executing BEGIN IMMEDIATE.
    // This serializes all explicit transactions at the JS level.
    await this.#writeMutex.lock()
    sqliteConn.hasWriteMutex = true
    
    await connection.executeQuery(CompiledQuery.raw('begin immediate'))
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('commit'))
    const sqliteConn = connection as SqliteConnection
    if (sqliteConn.hasWriteMutex) {
      sqliteConn.hasWriteMutex = false
      this.#writeMutex.unlock()
    }
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery(CompiledQuery.raw('rollback'))
    const sqliteConn = connection as SqliteConnection
    if (sqliteConn.hasWriteMutex) {
      sqliteConn.hasWriteMutex = false
      this.#writeMutex.unlock()
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
    if (sqliteConn.hasWriteMutex) {
      sqliteConn.hasWriteMutex = false
      this.#writeMutex.unlock()
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
    const entry = globalWriteMutexRegistry.get(this.#dbPath)
    if (entry) {
      entry.refCount--
      if (entry.refCount <= 0) {
        globalWriteMutexRegistry.delete(this.#dbPath)
      }
    }
  }
}

class SqliteConnection implements DatabaseConnection {
  readonly db: SqliteDatabase
  readonly writeMutex: ConnectionMutex
  hasWriteMutex: boolean = false

  constructor(db: SqliteDatabase, writeMutex: ConnectionMutex) {
    this.db = db
    this.writeMutex = writeMutex
  }

  close() {
    this.db.close()
  }

  async executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
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

    // If it's a read query, execute immediately concurrently
    if (stmt.reader) {
      return {
        rows: stmt.all(sqliteParameters) as O[],
      }
    }

    // It's a write query!
    if (!this.hasWriteMutex) {
      // Not in an explicit transaction, so we must acquire the WriteMutex temporarily
      await this.writeMutex.lock()
      try {
        const { changes, lastInsertRowid } = stmt.run(sqliteParameters)
        return {
          numAffectedRows:
            changes !== undefined && changes !== null ? BigInt(changes) : undefined,
          insertId:
            lastInsertRowid !== undefined && lastInsertRowid !== null
              ? BigInt(lastInsertRowid) : undefined,
          rows: [],
        }
      } finally {
        this.writeMutex.unlock()
      }
    } else {
      // Already holding the WriteMutex via explicit transaction
      const { changes, lastInsertRowid } = stmt.run(sqliteParameters)
      return {
        numAffectedRows:
          changes !== undefined && changes !== null ? BigInt(changes) : undefined,
        insertId:
          lastInsertRowid !== undefined && lastInsertRowid !== null
            ? BigInt(lastInsertRowid) : undefined,
        rows: [],
      }
    }
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
