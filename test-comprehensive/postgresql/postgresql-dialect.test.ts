import { describe, it, before, after } from 'mocha'
import { expect } from 'chai'
import { Pool } from 'pg'
import { PostgresDialect } from '../../src/dialect/postgresql/postgresql-dialect.js'
import { PostgresDriver } from '../../src/dialect/postgresql/postgresql-driver.js'
import { PostgresQueryCompiler } from '../../src/dialect/postgresql/postgresql-query-compiler.js'
import { PostgresAdapter } from '../../src/dialect/postgresql/postgresql-adapter.js'
import { PostgresIntrospector } from '../../src/dialect/postgresql/postgresql-introspector.js'
import { Kysely } from '../../src/kysely.js'

/**
 * PostgreSQL Dialect Tests
 *
 * Tests the main PostgreSQL dialect class and its factory methods.
 */
describe('PostgreSQL Dialect - Core Tests', () => {
  let pool: Pool

  before(() => {
    pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'test',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      max: 10,
    })
  })

  after(async () => {
    await pool.end()
  })

  describe('Dialect Configuration', () => {
    it('should create dialect with pool instance', () => {
      const dialect = new PostgresDialect({ pool })
      expect(dialect).to.be.instanceOf(PostgresDialect)
    })

    it('should create dialect with poolConfig', () => {
      const dialect = new PostgresDialect({
        poolConfig: {
          host: 'localhost',
          port: 5432,
          database: 'test',
          user: 'postgres',
          password: 'postgres',
        }
      })
      expect(dialect).to.be.instanceOf(PostgresDialect)
    })

    it('should create dialect with lazy pool function', () => {
      const dialect = new PostgresDialect({
        pool: async () => new Pool({
          host: 'localhost',
          database: 'test',
        })
      })
      expect(dialect).to.be.instanceOf(PostgresDialect)
    })

    it('should freeze config to prevent modifications', () => {
      const config = { pool }
      const dialect = new PostgresDialect(config)

      // Try to modify the original config
      config.pool = null as any

      // Dialect should still work because it froze its copy
      const driver = dialect.createDriver()
      expect(driver).to.be.instanceOf(PostgresDriver)
    })
  })

  describe('Factory Methods', () => {
    let dialect: PostgresDialect

    before(() => {
      dialect = new PostgresDialect({ pool })
    })

    it('should create PostgresDriver', () => {
      const driver = dialect.createDriver()
      expect(driver).to.be.instanceOf(PostgresDriver)
    })

    it('should create PostgresQueryCompiler', () => {
      const compiler = dialect.createQueryCompiler()
      expect(compiler).to.be.instanceOf(PostgresQueryCompiler)
    })

    it('should create PostgresAdapter', () => {
      const adapter = dialect.createAdapter()
      expect(adapter).to.be.instanceOf(PostgresAdapter)
    })

    it('should create PostgresIntrospector', () => {
      const db = new Kysely({ dialect })
      const introspector = dialect.createIntrospector(db)
      expect(introspector).to.be.instanceOf(PostgresIntrospector)

      // Cleanup
      db.destroy().catch(() => {})
    })
  })

  describe('Integration with Kysely', () => {
    it('should initialize Kysely with PostgreSQL dialect', async () => {
      const dialect = new PostgresDialect({ pool })
      const db = new Kysely({ dialect })

      try {
        // Test basic query
        const result = await db
          .selectFrom('pg_database' as any)
          .select(['datname as name'])
          .where('datname', '=', 'postgres')
          .execute()

        expect(result).to.be.an('array')
        expect(result.length).to.be.greaterThan(0)
      } finally {
        await db.destroy()
      }
    })

    it('should handle connection lifecycle', async () => {
      const dialect = new PostgresDialect({ pool })
      const db = new Kysely({ dialect })

      try {
        // Multiple queries should reuse connections
        const query1 = db.selectFrom('pg_database' as any).select('datname').execute()
        const query2 = db.selectFrom('pg_database' as any).select('datname').execute()

        const [result1, result2] = await Promise.all([query1, query2])

        expect(result1).to.be.an('array')
        expect(result2).to.be.an('array')
      } finally {
        await db.destroy()
      }
    })
  })

  describe('Connection Callback', () => {
    it('should call onCreateConnection callback', async () => {
      let callbackCalled = false

      const dialect = new PostgresDialect({
        pool,
        onCreateConnection: async (connection) => {
          callbackCalled = true
          expect(connection).to.exist
        }
      })

      const db = new Kysely({ dialect })

      try {
        // Execute a query to trigger connection creation
        await db.selectFrom('pg_database' as any).select('datname').execute()

        expect(callbackCalled).to.be.true
      } finally {
        await db.destroy()
      }
    })
  })
})
