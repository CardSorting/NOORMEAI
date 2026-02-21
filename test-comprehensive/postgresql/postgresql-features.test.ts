import { describe, it, before, after, beforeEach, afterEach } from 'mocha'
import { expect } from 'chai'
import { Pool } from 'pg'
import { PostgresDialect } from '../../src/dialect/postgresql/postgresql-dialect.js'
import { Kysely } from '../../src/kysely.js'
import { sql } from '../../src/raw-builder/sql.js'
import {
  PostgresArrayHelpers,
  PostgresJSONHelpers,
  PostgresFullTextHelpers,
  PostgresMaterializedViewHelpers,
} from '../../src/dialect/postgresql/postgresql-features.js'

/**
 * PostgreSQL Features Tests
 *
 * Tests PostgreSQL-specific features including:
 * - Array operations and helpers
 * - JSON/JSONB operations
 * - Full-text search
 * - Materialized views
 */
describe('PostgreSQL Features Tests', () => {
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

  describe('PostgreSQL Array Helpers', () => {
    beforeEach(async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS array_test (
          id SERIAL PRIMARY KEY,
          tags TEXT[],
          numbers INTEGER[]
        )
      `.execute(db)
    })

    afterEach(async () => {
      await sql`DROP TABLE IF EXISTS array_test`.execute(db)
    })

    it('should create array literal', () => {
      const arr = PostgresArrayHelpers.array(['foo', 'bar', 'baz'])
      expect(arr).to.exist
    })

    it('should insert array values', async () => {
      await sql`
        INSERT INTO array_test (tags, numbers)
        VALUES (${PostgresArrayHelpers.array(['typescript', 'javascript'])}, ${PostgresArrayHelpers.array([1, 2, 3])})
      `.execute(db)

      const result = await sql`SELECT * FROM array_test`.execute(db)
      expect(result.rows[0].tags).to.deep.equal(['typescript', 'javascript'])
      expect(result.rows[0].numbers).to.deep.equal([1, 2, 3])
    })

    it('should check if array contains value', async () => {
      await sql`
        INSERT INTO array_test (tags) VALUES (${PostgresArrayHelpers.array(['typescript', 'javascript', 'python'])})
      `.execute(db)

      const result = await sql`
        SELECT * FROM array_test
        WHERE ${PostgresArrayHelpers.contains('tags', ['typescript'])}
      `.execute(db)

      expect(result.rows).to.have.length(1)
    })

    it('should check if array is contained by another', async () => {
      await sql`
        INSERT INTO array_test (tags) VALUES (${PostgresArrayHelpers.array(['typescript'])})
      `.execute(db)

      const result = await sql`
        SELECT * FROM array_test
        WHERE ${PostgresArrayHelpers.containedBy('tags', ['typescript', 'javascript', 'python'])}
      `.execute(db)

      expect(result.rows).to.have.length(1)
    })

    it('should check if arrays overlap', async () => {
      await sql`
        INSERT INTO array_test (tags) VALUES (${PostgresArrayHelpers.array(['typescript', 'rust'])})
      `.execute(db)

      const result = await sql`
        SELECT * FROM array_test
        WHERE ${PostgresArrayHelpers.overlap('tags', ['typescript', 'go'])}
      `.execute(db)

      expect(result.rows).to.have.length(1)
    })

    it('should get array length', async () => {
      await sql`
        INSERT INTO array_test (tags) VALUES (${PostgresArrayHelpers.array(['a', 'b', 'c', 'd'])})
      `.execute(db)

      const result = await sql`
        SELECT ${PostgresArrayHelpers.length('tags')} as tag_count FROM array_test
      `.execute(db)

      expect(result.rows[0].tag_count).to.equal(4)
    })

    it('should append element to array', async () => {
      await sql`
        INSERT INTO array_test (tags) VALUES (${PostgresArrayHelpers.array(['tag1', 'tag2'])})
      `.execute(db)

      await sql`
        UPDATE array_test SET tags = ${PostgresArrayHelpers.append('tags', 'tag3')}
      `.execute(db)

      const result = await sql`SELECT tags FROM array_test`.execute(db)
      expect(result.rows[0].tags).to.deep.equal(['tag1', 'tag2', 'tag3'])
    })

    it('should remove element from array', async () => {
      await sql`
        INSERT INTO array_test (tags) VALUES (${PostgresArrayHelpers.array(['tag1', 'tag2', 'tag3'])})
      `.execute(db)

      await sql`
        UPDATE array_test SET tags = ${PostgresArrayHelpers.remove('tags', 'tag2')}
      `.execute(db)

      const result = await sql`SELECT tags FROM array_test`.execute(db)
      expect(result.rows[0].tags).to.deep.equal(['tag1', 'tag3'])
    })

    it('should unnest array to rows', async () => {
      await sql`
        INSERT INTO array_test (tags) VALUES (${PostgresArrayHelpers.array(['a', 'b', 'c'])})
      `.execute(db)

      const result = await sql`
        SELECT ${PostgresArrayHelpers.unnest('tags')} as tag FROM array_test
      `.execute(db)

      expect(result.rows).to.have.length(3)
      expect(result.rows.map((r: any) => r.tag)).to.deep.equal(['a', 'b', 'c'])
    })

    it('should handle empty arrays', async () => {
      await sql`
        INSERT INTO array_test (tags) VALUES (${PostgresArrayHelpers.array([])})
      `.execute(db)

      const result = await sql`SELECT tags FROM array_test`.execute(db)
      expect(result.rows[0].tags).to.deep.equal([])
    })

    it('should handle arrays with special characters', async () => {
      await sql`
        INSERT INTO array_test (tags) VALUES (${PostgresArrayHelpers.array(["tag's", 'tag"2', 'tag\\3'])})
      `.execute(db)

      const result = await sql`SELECT tags FROM array_test`.execute(db)
      expect(result.rows[0].tags).to.be.an('array')
    })
  })

  describe('PostgreSQL JSON Helpers', () => {
    beforeEach(async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS json_test (
          id SERIAL PRIMARY KEY,
          data JSONB
        )
      `.execute(db)
    })

    afterEach(async () => {
      await sql`DROP TABLE IF EXISTS json_test`.execute(db)
    })

    it('should extract JSON field as text', async () => {
      await sql`
        INSERT INTO json_test (data)
        VALUES ('{"name": "John", "age": 30}'::jsonb)
      `.execute(db)

      const result = await sql`
        SELECT ${PostgresJSONHelpers.extract('data', 'name')} as name FROM json_test
      `.execute(db)

      expect(result.rows[0].name).to.equal('John')
    })

    it('should extract JSON field as JSON', async () => {
      await sql`
        INSERT INTO json_test (data)
        VALUES ('{"address": {"city": "NYC", "zip": "10001"}}'::jsonb)
      `.execute(db)

      const result = await sql`
        SELECT ${PostgresJSONHelpers.extractJSON('data', 'address')} as address FROM json_test
      `.execute(db)

      expect(result.rows[0].address).to.be.an('object')
      expect(result.rows[0].address.city).to.equal('NYC')
    })

    it('should extract nested JSON field using path', async () => {
      await sql`
        INSERT INTO json_test (data)
        VALUES ('{"address": {"city": "NYC", "zip": "10001"}}'::jsonb)
      `.execute(db)

      const result = await sql`
        SELECT ${PostgresJSONHelpers.extractPath('data', ['address', 'city'])} as city FROM json_test
      `.execute(db)

      expect(result.rows[0].city).to.equal('NYC')
    })

    it('should check if JSON contains key', async () => {
      await sql`
        INSERT INTO json_test (data)
        VALUES ('{"email": "test@example.com", "phone": "123"}'::jsonb)
      `.execute(db)

      const result = await sql`
        SELECT * FROM json_test
        WHERE ${PostgresJSONHelpers.hasKey('data', 'email')}
      `.execute(db)

      expect(result.rows).to.have.length(1)
    })

    it('should check if JSON contains any of the keys', async () => {
      await sql`
        INSERT INTO json_test (data)
        VALUES ('{"email": "test@example.com"}'::jsonb)
      `.execute(db)

      const result = await sql`
        SELECT * FROM json_test
        WHERE ${PostgresJSONHelpers.hasAnyKey('data', ['email', 'phone'])}
      `.execute(db)

      expect(result.rows).to.have.length(1)
    })

    it('should check if JSON contains all keys', async () => {
      await sql`
        INSERT INTO json_test (data)
        VALUES ('{"email": "test@example.com", "phone": "123"}'::jsonb)
      `.execute(db)

      const result = await sql`
        SELECT * FROM json_test
        WHERE ${PostgresJSONHelpers.hasAllKeys('data', ['email', 'phone'])}
      `.execute(db)

      expect(result.rows).to.have.length(1)
    })

    it('should check if JSONB contains value', async () => {
      await sql`
        INSERT INTO json_test (data)
        VALUES ('{"status": "active", "role": "admin"}'::jsonb)
      `.execute(db)

      const result = await sql`
        SELECT * FROM json_test
        WHERE ${PostgresJSONHelpers.contains('data', { status: 'active' })}
      `.execute(db)

      expect(result.rows).to.have.length(1)
    })

    it('should check if JSONB is contained by value', async () => {
      await sql`
        INSERT INTO json_test (data)
        VALUES ('{"status": "active"}'::jsonb)
      `.execute(db)

      const result = await sql`
        SELECT * FROM json_test
        WHERE ${PostgresJSONHelpers.containedBy('data', { status: 'active', role: 'admin' })}
      `.execute(db)

      expect(result.rows).to.have.length(1)
    })

    it('should set JSON field value', async () => {
      await sql`
        INSERT INTO json_test (data)
        VALUES ('{"address": {"city": "LA"}}'::jsonb)
      `.execute(db)

      await sql`
        UPDATE json_test SET data = ${PostgresJSONHelpers.set('data', ['address', 'city'], 'NYC')}
      `.execute(db)

      const result = await sql`SELECT data FROM json_test`.execute(db)
      expect(result.rows[0].data.address.city).to.equal('NYC')
    })

    it('should delete JSON field', async () => {
      await sql`
        INSERT INTO json_test (data)
        VALUES ('{"name": "John", "temp": "delete_me"}'::jsonb)
      `.execute(db)

      await sql`
        UPDATE json_test SET data = ${PostgresJSONHelpers.delete('data', 'temp')}
      `.execute(db)

      const result = await sql`SELECT data FROM json_test`.execute(db)
      expect(result.rows[0].data).to.not.have.property('temp')
      expect(result.rows[0].data).to.have.property('name')
    })
  })

  describe('PostgreSQL Full-Text Search Helpers', () => {
    beforeEach(async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS fts_test (
          id SERIAL PRIMARY KEY,
          title TEXT,
          content TEXT,
          search_vector TSVECTOR
        )
      `.execute(db)
    })

    afterEach(async () => {
      await sql`DROP TABLE IF EXISTS fts_test`.execute(db)
    })

    it('should convert text to tsvector', async () => {
      await sql`
        INSERT INTO fts_test (title, content, search_vector)
        VALUES (
          'TypeScript Programming',
          'Learn TypeScript basics',
          ${PostgresFullTextHelpers.toTSVector('title', 'english')}
        )
      `.execute(db)

      const result = await sql`SELECT search_vector FROM fts_test`.execute(db)
      expect(result.rows[0].search_vector).to.exist
    })

    it('should perform full-text search match', async () => {
      await sql`
        INSERT INTO fts_test (title, search_vector)
        VALUES ('TypeScript Programming', to_tsvector('english', 'TypeScript Programming'))
      `.execute(db)

      const result = await sql`
        SELECT * FROM fts_test
        WHERE ${PostgresFullTextHelpers.match('search_vector', 'typescript', 'english')}
      `.execute(db)

      expect(result.rows).to.have.length(1)
    })

    it('should rank search results', async () => {
      await sql`
        INSERT INTO fts_test (title, search_vector)
        VALUES
          ('TypeScript Advanced', to_tsvector('english', 'TypeScript Advanced')),
          ('TypeScript Basics', to_tsvector('english', 'TypeScript Basics'))
      `.execute(db)

      const result = await sql`
        SELECT title, ${PostgresFullTextHelpers.rank('search_vector', 'typescript', 'english')} as rank
        FROM fts_test
        ORDER BY rank DESC
      `.execute(db)

      expect(result.rows).to.have.length(2)
      expect(result.rows[0].rank).to.be.a('number')
    })

    it('should generate headline (highlighting)', async () => {
      await sql`
        INSERT INTO fts_test (content)
        VALUES ('This is a test document about TypeScript programming language.')
      `.execute(db)

      const result = await sql`
        SELECT ${PostgresFullTextHelpers.headline('content', 'typescript', 'english')} as excerpt
        FROM fts_test
      `.execute(db)

      expect(result.rows[0].excerpt).to.be.a('string')
      expect(result.rows[0].excerpt.toLowerCase()).to.include('typescript')
    })

    it('should create GIN index for full-text search', async () => {
      await PostgresFullTextHelpers.createGINIndex(db, 'fts_test', 'search_vector')

      // Verify index was created
      const result = await sql`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'fts_test' AND indexname LIKE '%gin%'
      `.execute(db)

      expect(result.rows.length).to.be.greaterThan(0)
    })

    it('should add generated tsvector column', async () => {
      await PostgresFullTextHelpers.addGeneratedTSVectorColumn(
        db,
        'fts_test',
        'auto_search_vector',
        ['title', 'content'],
        'english'
      )

      // Verify column was created
      const result = await sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'fts_test' AND column_name = 'auto_search_vector'
      `.execute(db)

      expect(result.rows).to.have.length(1)
    })
  })

  describe('PostgreSQL Materialized View Helpers', () => {
    beforeEach(async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS view_source (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          value INTEGER
        )
      `.execute(db)

      await sql`
        INSERT INTO view_source (user_id, value)
        VALUES (1, 10), (1, 20), (2, 30), (2, 40)
      `.execute(db)
    })

    afterEach(async () => {
      await sql`DROP TABLE IF EXISTS view_source`.execute(db)
      await PostgresMaterializedViewHelpers.drop(db, 'test_matview', { ifExists: true })
        .catch(() => {})
    })

    it('should create materialized view', async () => {
      await PostgresMaterializedViewHelpers.create(
        db,
        'test_matview',
        sql`SELECT user_id, SUM(value) as total FROM view_source GROUP BY user_id`
      )

      const result = await sql`SELECT * FROM test_matview ORDER BY user_id`.execute(db)
      expect(result.rows).to.have.length(2)
      expect(result.rows[0]).to.include({ user_id: 1, total: 30 })
      expect(result.rows[1]).to.include({ user_id: 2, total: 70 })
    })

    it('should create materialized view with no data', async () => {
      await PostgresMaterializedViewHelpers.create(
        db,
        'test_matview',
        sql`SELECT user_id, SUM(value) as total FROM view_source GROUP BY user_id`,
        { withData: false }
      )

      const result = await sql`SELECT * FROM test_matview`.execute(db)
      expect(result.rows).to.have.length(0)
    })

    it('should refresh materialized view', async () => {
      await PostgresMaterializedViewHelpers.create(
        db,
        'test_matview',
        sql`SELECT user_id, SUM(value) as total FROM view_source GROUP BY user_id`
      )

      // Add more data
      await sql`INSERT INTO view_source (user_id, value) VALUES (1, 15)`.execute(db)

      // Refresh view
      await PostgresMaterializedViewHelpers.refresh(db, 'test_matview')

      const result = await sql`SELECT * FROM test_matview WHERE user_id = 1`.execute(db)
      expect(result.rows[0].total).to.equal(45)
    })

    it('should drop materialized view', async () => {
      await PostgresMaterializedViewHelpers.create(
        db,
        'test_matview',
        sql`SELECT user_id, SUM(value) as total FROM view_source GROUP BY user_id`
      )

      await PostgresMaterializedViewHelpers.drop(db, 'test_matview')

      // Verify view was dropped
      try {
        await sql`SELECT * FROM test_matview`.execute(db)
        expect.fail('View should have been dropped')
      } catch (error: any) {
        expect(error.message).to.include('does not exist')
      }
    })

    it('should create unique index on materialized view', async () => {
      await PostgresMaterializedViewHelpers.create(
        db,
        'test_matview',
        sql`SELECT user_id, SUM(value) as total FROM view_source GROUP BY user_id`
      )

      await PostgresMaterializedViewHelpers.createUniqueIndex(
        db,
        'test_matview',
        ['user_id']
      )

      // Verify index was created
      const result = await sql`
        SELECT indexname FROM pg_indexes WHERE tablename = 'test_matview'
      `.execute(db)

      expect(result.rows.length).to.be.greaterThan(0)
    })

    it('should get materialized view info', async () => {
      await PostgresMaterializedViewHelpers.create(
        db,
        'test_matview',
        sql`SELECT user_id, SUM(value) as total FROM view_source GROUP BY user_id`
      )

      const info = await PostgresMaterializedViewHelpers.getInfo(db, 'test_matview')

      expect(info).to.exist
      expect(info?.matviewname).to.equal('test_matview')
      expect(info?.ispopulated).to.be.true
    })

    it('should handle cascade drop', async () => {
      await PostgresMaterializedViewHelpers.create(
        db,
        'test_matview',
        sql`SELECT user_id, SUM(value) as total FROM view_source GROUP BY user_id`
      )

      await PostgresMaterializedViewHelpers.drop(db, 'test_matview', { cascade: true })

      const info = await PostgresMaterializedViewHelpers.getInfo(db, 'test_matview')
      expect(info).to.be.null
    })
  })
})
