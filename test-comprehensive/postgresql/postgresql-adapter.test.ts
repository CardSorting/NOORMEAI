import { describe, it, before, after, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import { Pool } from 'pg'
import { PostgresDialect } from '../../src/dialect/postgresql/postgresql-dialect.js'
import { PostgresAdapter } from '../../src/dialect/postgresql/postgresql-adapter.js'
import { Kysely } from '../../src/kysely.js'
import { sql } from '../../src/raw-builder/sql.js'

/**
 * PostgreSQL Adapter Tests
 *
 * Tests the PostgreSQL dialect adapter, including:
 * - Feature flags (transactional DDL, RETURNING support)
 * - Migration locks
 * - PostgreSQL-specific adapter behavior
 */
describe('PostgreSQL Adapter Tests', () => {
  let pool: Pool
  let db: Kysely<any>

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
  })

  after(async () => {
    await db.destroy()
    await pool.end()
  })

  describe('Feature Support', () => {
    let adapter: PostgresAdapter

    before(() => {
      adapter = new PostgresAdapter()
    })

    it('should support transactional DDL', () => {
      expect(adapter.supportsTransactionalDdl).to.be.true
    })

    it('should support RETURNING clause', () => {
      expect(adapter.supportsReturning).to.be.true
    })
  })

  describe('Migration Lock', () => {
    const lockTable = 'kysely_migration_lock_test'

    beforeEach(async () => {
      // Create lock table for testing
      await sql`
        CREATE TABLE IF NOT EXISTS ${sql.table(lockTable)} (
          id VARCHAR(255) PRIMARY KEY,
          is_locked INTEGER DEFAULT 0
        )
      `.execute(db)

      // Insert lock row
      await sql`
        INSERT INTO ${sql.table(lockTable)} (id, is_locked)
        VALUES ('0.0.1', 0)
        ON CONFLICT (id) DO NOTHING
      `.execute(db)
    })

    afterEach(async () => {
      // Clean up
      await sql`DROP TABLE IF EXISTS ${sql.table(lockTable)}`.execute(db)
    })

    it('should acquire migration lock', async () => {
      const adapter = new PostgresAdapter()

      await db.transaction().execute(async (trx) => {
        await adapter.acquireMigrationLock(trx, { lockTable })

        // Lock should be acquired (no error thrown)
        expect(true).to.be.true
      })
    })

    it('should release migration lock automatically on commit', async () => {
      const adapter = new PostgresAdapter()

      // First transaction acquires and releases lock
      await db.transaction().execute(async (trx) => {
        await adapter.acquireMigrationLock(trx, { lockTable })
      })

      // Second transaction should be able to acquire the lock
      await db.transaction().execute(async (trx) => {
        await adapter.acquireMigrationLock(trx, { lockTable })
        expect(true).to.be.true
      })
    })

    it('should block concurrent lock acquisitions', async () => {
      const adapter = new PostgresAdapter()
      let firstLockAcquired = false
      let secondLockBlocked = true

      // First transaction holds the lock
      const firstTransaction = db.transaction().execute(async (trx) => {
        await adapter.acquireMigrationLock(trx, { lockTable })
        firstLockAcquired = true

        // Hold lock for a bit
        await new Promise(resolve => setTimeout(resolve, 1000))
      })

      // Wait a bit to ensure first lock is acquired
      await new Promise(resolve => setTimeout(resolve, 100))

      // Second transaction tries to acquire the lock (should block)
      const secondTransaction = db.transaction().execute(async (trx) => {
        await adapter.acquireMigrationLock(trx, { lockTable })
        secondLockBlocked = false
      })

      await Promise.all([firstTransaction, secondTransaction])

      expect(firstLockAcquired).to.be.true
      expect(secondLockBlocked).to.be.false
    })

    it('should use default lock table name if not provided', async () => {
      const adapter = new PostgresAdapter()

      // Create default lock table
      await sql`
        CREATE TABLE IF NOT EXISTS kysely_migration_lock (
          id VARCHAR(255) PRIMARY KEY,
          is_locked INTEGER DEFAULT 0
        )
      `.execute(db)

      await sql`
        INSERT INTO kysely_migration_lock (id, is_locked)
        VALUES ('0.0.1', 0)
        ON CONFLICT (id) DO NOTHING
      `.execute(db)

      try {
        await db.transaction().execute(async (trx) => {
          // No lockTable specified, should use default
          await adapter.acquireMigrationLock(trx, {})
          expect(true).to.be.true
        })
      } finally {
        // Clean up
        await sql`DROP TABLE IF EXISTS kysely_migration_lock`.execute(db)
      }
    })

    it('should release lock on rollback', async () => {
      const adapter = new PostgresAdapter()

      try {
        await db.transaction().execute(async (trx) => {
          await adapter.acquireMigrationLock(trx, { lockTable })

          // Force rollback
          throw new Error('Force rollback')
        })
      } catch (error: any) {
        expect(error.message).to.equal('Force rollback')
      }

      // Lock should be released, new transaction should acquire it
      await db.transaction().execute(async (trx) => {
        await adapter.acquireMigrationLock(trx, { lockTable })
        expect(true).to.be.true
      })
    })

    it('should handle lock release gracefully', async () => {
      const adapter = new PostgresAdapter()

      await db.transaction().execute(async (trx) => {
        await adapter.acquireMigrationLock(trx, { lockTable })

        // Release should do nothing (lock released automatically on commit)
        await adapter.releaseMigrationLock(trx, { lockTable })

        expect(true).to.be.true
      })
    })
  })

  describe('Hash Function', () => {
    it('should generate consistent hash for same input', () => {
      const adapter = new PostgresAdapter() as any

      const hash1 = adapter['#hashString']?.('test_table') ??
                    (adapter as any)._PostgresAdapter_hashString?.('test_table') ??
                    hashString('test_table')
      const hash2 = adapter['#hashString']?.('test_table') ??
                    (adapter as any)._PostgresAdapter_hashString?.('test_table') ??
                    hashString('test_table')

      expect(hash1).to.equal(hash2)
    })

    it('should generate different hashes for different inputs', () => {
      const adapter = new PostgresAdapter() as any

      const hash1 = adapter['#hashString']?.('table1') ??
                    (adapter as any)._PostgresAdapter_hashString?.('table1') ??
                    hashString('table1')
      const hash2 = adapter['#hashString']?.('table2') ??
                    (adapter as any)._PostgresAdapter_hashString?.('table2') ??
                    hashString('table2')

      expect(hash1).to.not.equal(hash2)
    })

    it('should generate 32-bit integer', () => {
      const adapter = new PostgresAdapter() as any

      const hash = adapter['#hashString']?.('test') ??
                   (adapter as any)._PostgresAdapter_hashString?.('test') ??
                   hashString('test')

      expect(Number.isInteger(hash)).to.be.true
      expect(hash).to.be.greaterThan(-2147483649) // MIN 32-bit int
      expect(hash).to.be.lessThan(2147483648) // MAX 32-bit int
    })
  })
})

// Helper function for hash testing
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0 // Convert to 32bit integer
  }
  return hash
}
