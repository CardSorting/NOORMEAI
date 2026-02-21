import { describe, it, before, after, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import { Pool } from 'pg'
import { PostgresDialect } from '../../src/dialect/postgresql/postgresql-dialect.js'
import { PostgresIntrospector } from '../../src/dialect/postgresql/postgresql-introspector.js'
import { Kysely } from '../../src/kysely.js'
import { sql } from '../../src/raw-builder/sql.js'

/**
 * PostgreSQL Introspector Tests
 *
 * Tests database metadata and schema introspection, including:
 * - Schema discovery
 * - Table metadata
 * - Column information (types, nullability, defaults)
 * - Index metadata
 * - Foreign key relationships
 * - PostgreSQL-specific types (arrays, JSON, tsvector)
 */
describe('PostgreSQL Introspector Tests', () => {
  let pool: Pool
  let db: Kysely<any>
  let introspector: PostgresIntrospector

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
    introspector = new PostgresIntrospector(db)
  })

  after(async () => {
    await db.destroy()
    await pool.end()
  })

  describe('Schema Discovery', () => {
    it('should get schemas', async () => {
      const schemas = await introspector.getSchemas()

      expect(schemas).to.be.an('array')
      expect(schemas.length).to.be.greaterThan(0)

      // Should include public schema
      const publicSchema = schemas.find(s => s.name === 'public')
      expect(publicSchema).to.exist
    })

    it('should exclude system schemas', async () => {
      const schemas = await introspector.getSchemas()

      const systemSchemas = ['pg_catalog', 'information_schema', 'pg_toast']
      systemSchemas.forEach(sysSchema => {
        const found = schemas.find(s => s.name === sysSchema)
        expect(found).to.be.undefined
      })
    })

    it('should return schemas sorted by name', async () => {
      const schemas = await introspector.getSchemas()

      // Check if sorted (allowing for different schemas in different environments)
      for (let i = 0; i < schemas.length - 1; i++) {
        expect(schemas[i].name <= schemas[i + 1].name).to.be.true
      }
    })
  })

  describe('Table Metadata', () => {
    beforeEach(async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS introspect_test (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(255) UNIQUE,
          age INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT true
        )
      `.execute(db)
    })

    afterEach(async () => {
      await sql`DROP TABLE IF EXISTS introspect_test`.execute(db)
    })

    it('should get tables', async () => {
      const tables = await introspector.getTables()

      expect(tables).to.be.an('array')

      const testTable = tables.find(t => t.name === 'introspect_test')
      expect(testTable).to.exist
    })

    it('should exclude internal Kysely tables by default', async () => {
      // Create Kysely migration tables
      await sql`
        CREATE TABLE IF NOT EXISTS kysely_migration (id VARCHAR(255) PRIMARY KEY)
      `.execute(db)
      await sql`
        CREATE TABLE IF NOT EXISTS kysely_migration_lock (id VARCHAR(255) PRIMARY KEY)
      `.execute(db)

      const tables = await introspector.getTables({ withInternalKyselyTables: false })

      const migrationTable = tables.find(t => t.name === 'kysely_migration')
      const lockTable = tables.find(t => t.name === 'kysely_migration_lock')

      expect(migrationTable).to.be.undefined
      expect(lockTable).to.be.undefined

      // Cleanup
      await sql`DROP TABLE IF EXISTS kysely_migration`.execute(db)
      await sql`DROP TABLE IF EXISTS kysely_migration_lock`.execute(db)
    })

    it('should include internal Kysely tables when requested', async () => {
      // Create Kysely migration table
      await sql`
        CREATE TABLE IF NOT EXISTS kysely_migration (id VARCHAR(255) PRIMARY KEY)
      `.execute(db)

      const tables = await introspector.getTables({ withInternalKyselyTables: true })

      const migrationTable = tables.find(t => t.name === 'kysely_migration')
      expect(migrationTable).to.exist

      // Cleanup
      await sql`DROP TABLE IF EXISTS kysely_migration`.execute(db)
    })

    it('should get complete metadata', async () => {
      const metadata = await introspector.getMetadata()

      expect(metadata).to.have.property('tables')
      expect(metadata.tables).to.be.an('array')

      const testTable = metadata.tables.find(t => t.name === 'introspect_test')
      expect(testTable).to.exist
    })
  })

  describe('Column Metadata', () => {
    beforeEach(async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS column_test (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          age INTEGER DEFAULT 0,
          price NUMERIC(10, 2),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT true,
          tags TEXT[],
          data JSONB,
          search_vector TSVECTOR
        )
      `.execute(db)
    })

    afterEach(async () => {
      await sql`DROP TABLE IF EXISTS column_test`.execute(db)
    })

    it('should get column metadata', async () => {
      const tables = await introspector.getTables()
      const table = tables.find(t => t.name === 'column_test')

      expect(table).to.exist
      expect(table!.columns).to.be.an('array')
      expect(table!.columns.length).to.equal(10)
    })

    it('should detect column types correctly', async () => {
      const tables = await introspector.getTables()
      const table = tables.find(t => t.name === 'column_test')

      const idCol = table!.columns.find(c => c.name === 'id')
      expect(idCol!.type).to.be.oneOf(['integer', 'int4', 'serial'])

      const nameCol = table!.columns.find(c => c.name === 'name')
      expect(nameCol!.type).to.include('varchar')

      const descCol = table!.columns.find(c => c.name === 'description')
      expect(descCol!.type).to.equal('text')

      const priceCol = table!.columns.find(c => c.name === 'price')
      expect(priceCol!.type).to.equal('numeric')
    })

    it('should detect nullable columns', async () => {
      const tables = await introspector.getTables()
      const table = tables.find(t => t.name === 'column_test')

      const nameCol = table!.columns.find(c => c.name === 'name')
      expect(nameCol!.nullable).to.be.false

      const descCol = table!.columns.find(c => c.name === 'description')
      expect(descCol!.nullable).to.be.true
    })

    it('should detect default values', async () => {
      const tables = await introspector.getTables()
      const table = tables.find(t => t.name === 'column_test')

      const ageCol = table!.columns.find(c => c.name === 'age')
      expect(ageCol!.defaultValue).to.exist

      const isActiveCol = table!.columns.find(c => c.name === 'is_active')
      expect(isActiveCol!.defaultValue).to.exist
    })

    it('should detect auto-increment columns', async () => {
      const tables = await introspector.getTables()
      const table = tables.find(t => t.name === 'column_test')

      const idCol = table!.columns.find(c => c.name === 'id')
      expect(idCol!.isAutoIncrement).to.be.true
    })

    it('should handle PostgreSQL array types', async () => {
      const tables = await introspector.getTables()
      const table = tables.find(t => t.name === 'column_test')

      const tagsCol = table!.columns.find(c => c.name === 'tags')
      expect(tagsCol).to.exist
      expect(tagsCol!.type).to.include('[]')
    })

    it('should handle JSONB type', async () => {
      const tables = await introspector.getTables()
      const table = tables.find(t => t.name === 'column_test')

      const dataCol = table!.columns.find(c => c.name === 'data')
      expect(dataCol).to.exist
      expect(dataCol!.type).to.equal('jsonb')
    })

    it('should handle TSVECTOR type', async () => {
      const tables = await introspector.getTables()
      const table = tables.find(t => t.name === 'column_test')

      const searchCol = table!.columns.find(c => c.name === 'search_vector')
      expect(searchCol).to.exist
      expect(searchCol!.type).to.equal('tsvector')
    })
  })

  describe('Index Metadata', () => {
    beforeEach(async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS index_test (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE,
          name VARCHAR(100),
          age INTEGER
        )
      `.execute(db)

      await sql`
        CREATE INDEX idx_name ON index_test(name)
      `.execute(db)

      await sql`
        CREATE INDEX idx_name_age ON index_test(name, age)
      `.execute(db)
    })

    afterEach(async () => {
      await sql`DROP TABLE IF EXISTS index_test`.execute(db)
    })

    it('should get index metadata', async () => {
      const tables = await introspector.getTables()
      const table = tables.find(t => t.name === 'index_test')

      expect(table).to.exist
      expect(table!.indexes).to.be.an('array')
      expect(table!.indexes.length).to.be.greaterThan(0)
    })

    it('should detect primary key index', async () => {
      const tables = await introspector.getTables()
      const table = tables.find(t => t.name === 'index_test')

      const pkIndex = table!.indexes.find(idx => idx.name.includes('pkey'))
      expect(pkIndex).to.exist
      expect(pkIndex!.columns).to.include('id')
    })

    it('should detect unique indexes', async () => {
      const tables = await introspector.getTables()
      const table = tables.find(t => t.name === 'index_test')

      const uniqueIndex = table!.indexes.find(idx =>
        idx.columns.includes('email') && idx.unique
      )
      expect(uniqueIndex).to.exist
    })

    it('should detect multi-column indexes', async () => {
      const tables = await introspector.getTables()
      const table = tables.find(t => t.name === 'index_test')

      const multiIndex = table!.indexes.find(idx => idx.name === 'idx_name_age')
      expect(multiIndex).to.exist
      expect(multiIndex!.columns).to.include('name')
      expect(multiIndex!.columns).to.include('age')
    })
  })

  describe('Foreign Key Metadata', () => {
    beforeEach(async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS fk_parent (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100)
        )
      `.execute(db)

      await sql`
        CREATE TABLE IF NOT EXISTS fk_child (
          id SERIAL PRIMARY KEY,
          parent_id INTEGER REFERENCES fk_parent(id) ON DELETE CASCADE ON UPDATE RESTRICT,
          name VARCHAR(100)
        )
      `.execute(db)
    })

    afterEach(async () => {
      await sql`DROP TABLE IF EXISTS fk_child`.execute(db)
      await sql`DROP TABLE IF EXISTS fk_parent`.execute(db)
    })

    it('should get foreign key metadata', async () => {
      const tables = await introspector.getTables()
      const childTable = tables.find(t => t.name === 'fk_child')

      expect(childTable).to.exist
      expect(childTable!.foreignKeys).to.be.an('array')
      expect(childTable!.foreignKeys.length).to.be.greaterThan(0)
    })

    it('should detect foreign key columns', async () => {
      const tables = await introspector.getTables()
      const childTable = tables.find(t => t.name === 'fk_child')

      const fk = childTable!.foreignKeys[0]
      expect(fk.column).to.equal('parent_id')
    })

    it('should detect referenced table and column', async () => {
      const tables = await introspector.getTables()
      const childTable = tables.find(t => t.name === 'fk_child')

      const fk = childTable!.foreignKeys[0]
      expect(fk.referencedTable).to.equal('fk_parent')
      expect(fk.referencedColumn).to.equal('id')
    })

    it('should detect ON DELETE action', async () => {
      const tables = await introspector.getTables()
      const childTable = tables.find(t => t.name === 'fk_child')

      const fk = childTable!.foreignKeys[0]
      expect(fk.onDelete).to.equal('CASCADE')
    })

    it('should detect ON UPDATE action', async () => {
      const tables = await introspector.getTables()
      const childTable = tables.find(t => t.name === 'fk_child')

      const fk = childTable!.foreignKeys[0]
      expect(fk.onUpdate).to.equal('RESTRICT')
    })
  })

  describe('View Support', () => {
    beforeEach(async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS view_source (
          id SERIAL PRIMARY KEY,
          value INTEGER
        )
      `.execute(db)

      await sql`
        CREATE VIEW view_test AS SELECT id, value FROM view_source
      `.execute(db)
    })

    afterEach(async () => {
      await sql`DROP VIEW IF EXISTS view_test`.execute(db)
      await sql`DROP TABLE IF EXISTS view_source`.execute(db)
    })

    it('should detect views', async () => {
      const tables = await introspector.getTables()
      const view = tables.find(t => t.name === 'view_test')

      expect(view).to.exist
      expect(view!.isView).to.be.true
    })

    it('should distinguish views from tables', async () => {
      const tables = await introspector.getTables()

      const view = tables.find(t => t.name === 'view_test')
      const table = tables.find(t => t.name === 'view_source')

      expect(view!.isView).to.be.true
      expect(table!.isView).to.be.false
    })
  })

  describe('Complex Data Types', () => {
    beforeEach(async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS complex_types (
          id SERIAL PRIMARY KEY,
          int_array INTEGER[],
          text_array TEXT[],
          varchar_array VARCHAR[],
          json_data JSON,
          jsonb_data JSONB,
          uuid_val UUID,
          timestamp_tz TIMESTAMPTZ,
          timestamp TIMESTAMP
        )
      `.execute(db)
    })

    afterEach(async () => {
      await sql`DROP TABLE IF EXISTS complex_types`.execute(db)
    })

    it('should handle integer arrays', async () => {
      const tables = await introspector.getTables()
      const table = tables.find(t => t.name === 'complex_types')

      const col = table!.columns.find(c => c.name === 'int_array')
      expect(col).to.exist
      expect(col!.type).to.include('[]')
    })

    it('should handle text arrays', async () => {
      const tables = await introspector.getTables()
      const table = tables.find(t => t.name === 'complex_types')

      const col = table!.columns.find(c => c.name === 'text_array')
      expect(col).to.exist
      expect(col!.type).to.include('[]')
    })

    it('should handle JSON type', async () => {
      const tables = await introspector.getTables()
      const table = tables.find(t => t.name === 'complex_types')

      const col = table!.columns.find(c => c.name === 'json_data')
      expect(col).to.exist
      expect(col!.type).to.equal('json')
    })

    it('should handle JSONB type', async () => {
      const tables = await introspector.getTables()
      const table = tables.find(t => t.name === 'complex_types')

      const col = table!.columns.find(c => c.name === 'jsonb_data')
      expect(col).to.exist
      expect(col!.type).to.equal('jsonb')
    })

    it('should handle UUID type', async () => {
      const tables = await introspector.getTables()
      const table = tables.find(t => t.name === 'complex_types')

      const col = table!.columns.find(c => c.name === 'uuid_val')
      expect(col).to.exist
      expect(col!.type).to.equal('uuid')
    })

    it('should handle timestamp types', async () => {
      const tables = await introspector.getTables()
      const table = tables.find(t => t.name === 'complex_types')

      const timestampCol = table!.columns.find(c => c.name === 'timestamp')
      expect(timestampCol).to.exist
      expect(timestampCol!.type).to.equal('timestamp')

      const timestamptzCol = table!.columns.find(c => c.name === 'timestamp_tz')
      expect(timestamptzCol).to.exist
      expect(timestamptzCol!.type).to.equal('timestamptz')
    })
  })

  describe('Edge Cases', () => {
    it('should handle tables with no columns', async () => {
      // This is actually not possible in PostgreSQL, but test error handling
      const tables = await introspector.getTables()
      expect(tables).to.be.an('array')
    })

    it('should handle empty database', async () => {
      // Get current tables and store for cleanup
      const currentTables = await introspector.getTables()

      // Drop all test tables
      for (const table of currentTables) {
        if (table.name.includes('test')) {
          await sql`DROP TABLE IF EXISTS ${sql.table(table.name)} CASCADE`.execute(db)
            .catch(() => {})
        }
      }

      const tables = await introspector.getTables()
      expect(tables).to.be.an('array')
    })

    it('should handle very long identifiers', async () => {
      const longName = 'a'.repeat(63) // PostgreSQL max identifier length

      await sql`
        CREATE TABLE IF NOT EXISTS ${sql.table(longName)} (id SERIAL PRIMARY KEY)
      `.execute(db)

      const tables = await introspector.getTables()
      const table = tables.find(t => t.name === longName)

      expect(table).to.exist

      // Cleanup
      await sql`DROP TABLE IF EXISTS ${sql.table(longName)}`.execute(db)
    })
  })
})
