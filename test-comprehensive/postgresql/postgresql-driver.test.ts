import { describe, it, before, after, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import { Pool } from 'pg'
import { PostgresDialect } from '../../src/dialect/postgresql/postgresql-dialect.js'
import { PostgresDriver } from '../../src/dialect/postgresql/postgresql-driver.js'
import { Kysely } from '../../src/kysely.js'
import { sql } from '../../src/raw-builder/sql.js'
import { CompiledQuery } from '../../src/query-compiler/compiled-query.js'

/**
 * PostgreSQL Driver Tests
 *
 * Tests connection management, transactions, query execution, and streaming.
 */
describe('PostgreSQL Driver Tests', () => {
  let pool: Pool
  let db: Kysely<any>
  let driver: PostgresDriver

  before(() => {
    pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'test',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      max: 10,
    })

    const dialect = new PostgresDialect({ pool })
    db = new Kysely({ dialect })
    driver = dialect.createDriver()
  })

  after(async () => {
    await driver.destroy()
    await db.destroy()
    await pool.end()
  })

  describe('Driver Initialization', () => {
    it('should initialize driver with pool', async () => {
      const testDriver = new PostgresDriver({ pool })
      await testDriver.init()

      expect(testDriver).to.be.instanceOf(PostgresDriver)

      await testDriver.destroy()
    })

    it('should initialize driver with poolConfig', async () => {
      const testDriver = new PostgresDriver({
        poolConfig: {
          host: 'localhost',
          port: 5432,
          database: 'test',
          user: 'postgres',
          password: 'postgres',
        }
      })
      await testDriver.init()

      expect(testDriver).to.be.instanceOf(PostgresDriver)

      await testDriver.destroy()
    })

    it('should initialize driver with lazy pool function', async () => {
      const testDriver = new PostgresDriver({
        pool: async () => new Pool({
          host: 'localhost',
          database: 'test',
          user: 'postgres',
          password: 'postgres',
        })
      })
      await testDriver.init()

      expect(testDriver).to.be.instanceOf(PostgresDriver)

      await testDriver.destroy()
    })

    it('should throw error if no pool or poolConfig provided', async () => {
      const testDriver = new PostgresDriver({})

      try {
        await testDriver.init()
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.message).to.include('PostgreSQL pool not configured')
      }
    })
  })

  describe('Connection Management', () => {
    beforeEach(async () => {
      await driver.init()
    })

    it('should acquire and release connection', async () => {
      const connection = await driver.acquireConnection()
      expect(connection).to.exist

      await driver.releaseConnection(connection as any)
    })

    it('should execute query on connection', async () => {
      const connection = await driver.acquireConnection()

      const query = CompiledQuery.raw('SELECT 1 as value')
      const result = await connection.executeQuery(query)

      expect(result.rows).to.be.an('array')
      expect(result.rows[0]).to.deep.equal({ value: 1 })

      await driver.releaseConnection(connection as any)
    })

    it('should handle multiple concurrent connections', async () => {
      const connections = await Promise.all([
        driver.acquireConnection(),
        driver.acquireConnection(),
        driver.acquireConnection(),
      ])

      expect(connections).to.have.length(3)

      await Promise.all(connections.map(c => driver.releaseConnection(c as any)))
    })

    it('should call onCreateConnection callback', async () => {
      let callbackCalled = false

      const testDriver = new PostgresDriver({
        pool,
        onCreateConnection: async (connection) => {
          callbackCalled = true
          expect(connection).to.exist
        }
      })

      await testDriver.init()
      const connection = await testDriver.acquireConnection()

      expect(callbackCalled).to.be.true

      await testDriver.releaseConnection(connection as any)
      await testDriver.destroy()
    })
  })

  describe('Transaction Management', () => {
    beforeEach(async () => {
      await driver.init()

      // Create test table
      await sql`
        CREATE TABLE IF NOT EXISTS transaction_test (
          id SERIAL PRIMARY KEY,
          value TEXT
        )
      `.execute(db)
    })

    afterEach(async () => {
      // Clean up
      await sql`DROP TABLE IF EXISTS transaction_test`.execute(db)
    })

    it('should begin and commit transaction', async () => {
      const connection = await driver.acquireConnection()

      await driver.beginTransaction(connection, {})
      await connection.executeQuery(
        CompiledQuery.raw("INSERT INTO transaction_test (value) VALUES ('test')")
      )
      await driver.commitTransaction(connection)

      await driver.releaseConnection(connection as any)

      // Verify data was committed
      const result = await sql<{ count: number }>`
        SELECT COUNT(*) as count FROM transaction_test
      `.execute(db)

      expect(result.rows[0].count).to.equal(1)
    })

    it('should begin and rollback transaction', async () => {
      const connection = await driver.acquireConnection()

      await driver.beginTransaction(connection, {})
      await connection.executeQuery(
        CompiledQuery.raw("INSERT INTO transaction_test (value) VALUES ('test')")
      )
      await driver.rollbackTransaction(connection)

      await driver.releaseConnection(connection as any)

      // Verify data was not committed
      const result = await sql<{ count: number }>`
        SELECT COUNT(*) as count FROM transaction_test
      `.execute(db)

      expect(result.rows[0].count).to.equal(0)
    })

    it('should support transaction isolation levels', async () => {
      const connection = await driver.acquireConnection()

      await driver.beginTransaction(connection, {
        isolationLevel: 'serializable'
      })

      // Transaction should be started
      await connection.executeQuery(
        CompiledQuery.raw("INSERT INTO transaction_test (value) VALUES ('test')")
      )

      await driver.commitTransaction(connection)
      await driver.releaseConnection(connection as any)

      // Verify data was committed
      const result = await sql<{ count: number }>`
        SELECT COUNT(*) as count FROM transaction_test
      `.execute(db)

      expect(result.rows[0].count).to.equal(1)
    })

    it('should handle nested transactions', async () => {
      await db.transaction().execute(async (trx) => {
        await trx
          .insertInto('transaction_test' as any)
          .values({ value: 'outer' } as any)
          .execute()

        await trx.transaction().execute(async (innerTrx) => {
          await innerTrx
            .insertInto('transaction_test' as any)
            .values({ value: 'inner' } as any)
            .execute()
        })
      })

      const result = await sql<{ count: number }>`
        SELECT COUNT(*) as count FROM transaction_test
      `.execute(db)

      expect(result.rows[0].count).to.equal(2)
    })
  })

  describe('Query Execution', () => {
    beforeEach(async () => {
      await driver.init()

      // Create test table
      await sql`
        CREATE TABLE IF NOT EXISTS query_test (
          id SERIAL PRIMARY KEY,
          name TEXT,
          age INTEGER
        )
      `.execute(db)
    })

    afterEach(async () => {
      // Clean up
      await sql`DROP TABLE IF EXISTS query_test`.execute(db)
    })

    it('should execute INSERT query', async () => {
      const connection = await driver.acquireConnection()

      const query = CompiledQuery.raw(
        "INSERT INTO query_test (name, age) VALUES ('John', 30)"
      )
      const result = await connection.executeQuery(query)

      expect(result.numAffectedRows).to.equal(1n)
      expect(result.insertId).to.exist

      await driver.releaseConnection(connection as any)
    })

    it('should execute UPDATE query', async () => {
      // Insert test data
      await sql`INSERT INTO query_test (name, age) VALUES ('John', 30)`.execute(db)

      const connection = await driver.acquireConnection()

      const query = CompiledQuery.raw(
        "UPDATE query_test SET age = 31 WHERE name = 'John'"
      )
      const result = await connection.executeQuery(query)

      expect(result.numAffectedRows).to.equal(1n)

      await driver.releaseConnection(connection as any)
    })

    it('should execute DELETE query', async () => {
      // Insert test data
      await sql`INSERT INTO query_test (name, age) VALUES ('John', 30)`.execute(db)

      const connection = await driver.acquireConnection()

      const query = CompiledQuery.raw("DELETE FROM query_test WHERE name = 'John'")
      const result = await connection.executeQuery(query)

      expect(result.numAffectedRows).to.equal(1n)

      await driver.releaseConnection(connection as any)
    })

    it('should execute SELECT query', async () => {
      // Insert test data
      await sql`
        INSERT INTO query_test (name, age) VALUES ('John', 30), ('Jane', 25)
      `.execute(db)

      const connection = await driver.acquireConnection()

      const query = CompiledQuery.raw('SELECT * FROM query_test ORDER BY name')
      const result = await connection.executeQuery(query)

      expect(result.rows).to.be.an('array')
      expect(result.rows).to.have.length(2)
      expect(result.rows[0]).to.include({ name: 'Jane', age: 25 })
      expect(result.rows[1]).to.include({ name: 'John', age: 30 })

      await driver.releaseConnection(connection as any)
    })

    it('should handle parameterized queries', async () => {
      const connection = await driver.acquireConnection()

      const query = new CompiledQuery({
        sql: 'INSERT INTO query_test (name, age) VALUES ($1, $2)',
        parameters: ['Alice', 28],
        query: {} as any,
      })
      const result = await connection.executeQuery(query)

      expect(result.numAffectedRows).to.equal(1n)

      await driver.releaseConnection(connection as any)

      // Verify data
      const verifyResult = await sql`SELECT * FROM query_test WHERE name = 'Alice'`.execute(db)
      expect(verifyResult.rows[0]).to.include({ name: 'Alice', age: 28 })
    })
  })

  describe('Streaming Queries', () => {
    beforeEach(async () => {
      await driver.init()

      // Create test table with many rows
      await sql`
        CREATE TABLE IF NOT EXISTS stream_test (
          id SERIAL PRIMARY KEY,
          value INTEGER
        )
      `.execute(db)

      // Insert 100 rows
      const values = Array.from({ length: 100 }, (_, i) => `(${i + 1})`).join(',')
      await sql.raw(`INSERT INTO stream_test (value) VALUES ${values}`).execute(db)
    })

    afterEach(async () => {
      // Clean up
      await sql`DROP TABLE IF EXISTS stream_test`.execute(db)
    })

    it('should stream query results in chunks', async function() {
      // Try to import cursor, skip test if not available
      let Cursor: any
      try {
        Cursor = (await import('pg-cursor')).default
      } catch {
        this.skip()
        return
      }

      const testDriver = new PostgresDriver({ pool, cursor: Cursor })
      await testDriver.init()

      const connection = await testDriver.acquireConnection()

      const query = CompiledQuery.raw('SELECT * FROM stream_test ORDER BY id')
      const stream = connection.streamQuery(query, 10)

      let totalRows = 0
      let chunkCount = 0

      for await (const result of stream) {
        totalRows += result.rows.length
        chunkCount++
        expect(result.rows.length).to.be.lessThanOrEqual(10)
      }

      expect(totalRows).to.equal(100)
      expect(chunkCount).to.equal(10)

      await testDriver.releaseConnection(connection as any)
      await testDriver.destroy()
    })

    it('should throw error if cursor not configured', async () => {
      const connection = await driver.acquireConnection()

      const query = CompiledQuery.raw('SELECT * FROM stream_test')

      try {
        const stream = connection.streamQuery(query, 10)
        await stream.next()
        expect.fail('Should have thrown error')
      } catch (error: any) {
        expect(error.message).to.include('Cursor is not configured')
      }

      await driver.releaseConnection(connection as any)
    })
  })

  describe('Driver Lifecycle', () => {
    it('should destroy driver and close connections', async () => {
      const testPool = new Pool({
        host: 'localhost',
        database: 'test',
        user: 'postgres',
        password: 'postgres',
      })

      const testDriver = new PostgresDriver({ pool: testPool })
      await testDriver.init()

      const connection = await testDriver.acquireConnection()
      await testDriver.releaseConnection(connection as any)

      await testDriver.destroy()

      // Pool should be ended
      expect(testPool.totalCount).to.equal(0)
    })

    it('should handle multiple destroy calls', async () => {
      const testDriver = new PostgresDriver({ pool })
      await testDriver.init()

      await testDriver.destroy()
      await testDriver.destroy() // Should not throw

      expect(true).to.be.true
    })
  })
})
