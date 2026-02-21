/**
 * Tests for PostgreSQL-specific features
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { Pool } from 'pg'
import { createPostgresNoormme } from '../../src/helpers/postgresql.js'
import {
  PostgresArrayHelpers,
  PostgresJSONHelpers,
  PostgresFullTextHelpers,
  PostgresMaterializedViewHelpers,
} from '../../src/helpers/postgresql.js'
import { NOORMME } from '../../src/noormme.js'
import { sql } from '../../src/raw-builder/sql.js'

// Skip tests if PostgreSQL is not available
const POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://postgres:postgres@localhost:5432/noormme_test'
const shouldRunTests = process.env.RUN_POSTGRES_TESTS === 'true'

describe.skipIf(!shouldRunTests)('PostgreSQL Features', () => {
  let db: NOORMME
  let pool: Pool

  beforeAll(async () => {
    // Create database connection
    db = createPostgresNoormme({
      connectionString: POSTGRES_URL,
    })

    await db.initialize()
  })

  afterAll(async () => {
    await db.destroy()
  })

  describe('Array Types', () => {
    beforeAll(async () => {
      // Create test table with array columns
      await sql`
        CREATE TABLE IF NOT EXISTS array_test (
          id SERIAL PRIMARY KEY,
          tags TEXT[],
          scores INTEGER[],
          metadata JSONB[]
        )
      `.execute(db.kysely)

      // Insert test data
      await sql`
        INSERT INTO array_test (tags, scores, metadata)
        VALUES (
          ARRAY['typescript', 'postgresql', 'noormme'],
          ARRAY[95, 87, 92],
          ARRAY['{"key": "value1"}'::jsonb, '{"key": "value2"}'::jsonb]
        )
      `.execute(db.kysely)
    })

    afterAll(async () => {
      await sql`DROP TABLE IF EXISTS array_test`.execute(db.kysely)
    })

    it('should create array literal', async () => {
      const result = await db.kysely
        .selectFrom('array_test')
        .select(PostgresArrayHelpers.array(['foo', 'bar']).as('test_array'))
        .executeTakeFirst()

      expect(result?.test_array).toEqual(['foo', 'bar'])
    })

    it('should check if array contains value', async () => {
      const result = await db.kysely
        .selectFrom('array_test')
        .selectAll()
        .where(PostgresArrayHelpers.contains('tags', ['typescript']))
        .executeTakeFirst()

      expect(result?.tags).toContain('typescript')
    })

    it('should check if arrays overlap', async () => {
      const result = await db.kysely
        .selectFrom('array_test')
        .selectAll()
        .where(PostgresArrayHelpers.overlap('tags', ['typescript', 'rust']))
        .executeTakeFirst()

      expect(result?.tags).toContain('typescript')
    })

    it('should get array length', async () => {
      const result = await db.kysely
        .selectFrom('array_test')
        .select(PostgresArrayHelpers.length('tags').as('tag_count'))
        .executeTakeFirst()

      expect(result?.tag_count).toBe(3)
    })

    it('should append element to array', async () => {
      await db.kysely
        .updateTable('array_test')
        .set({ tags: PostgresArrayHelpers.append('tags', 'new-tag') })
        .execute()

      const result = await db.kysely
        .selectFrom('array_test')
        .select('tags')
        .executeTakeFirst()

      expect(result?.tags).toContain('new-tag')
    })

    it('should remove element from array', async () => {
      await db.kysely
        .updateTable('array_test')
        .set({ tags: PostgresArrayHelpers.remove('tags', 'new-tag') })
        .execute()

      const result = await db.kysely
        .selectFrom('array_test')
        .select('tags')
        .executeTakeFirst()

      expect(result?.tags).not.toContain('new-tag')
    })

    it('should unnest array', async () => {
      const results = await db.kysely
        .selectFrom('array_test')
        .select(PostgresArrayHelpers.unnest('tags').as('tag'))
        .execute()

      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('JSON/JSONB Operations', () => {
    beforeAll(async () => {
      // Create test table with JSON columns
      await sql`
        CREATE TABLE IF NOT EXISTS json_test (
          id SERIAL PRIMARY KEY,
          data JSONB,
          config JSON
        )
      `.execute(db.kysely)

      // Insert test data
      await sql`
        INSERT INTO json_test (data, config)
        VALUES (
          '{"name": "John", "email": "john@example.com", "address": {"city": "New York", "zip": "10001"}}'::jsonb,
          '{"theme": "dark", "notifications": true}'::json
        )
      `.execute(db.kysely)
    })

    afterAll(async () => {
      await sql`DROP TABLE IF EXISTS json_test`.execute(db.kysely)
    })

    it('should extract JSON field as text', async () => {
      const result = await db.kysely
        .selectFrom('json_test')
        .select(PostgresJSONHelpers.extract('data', 'name').as('name'))
        .executeTakeFirst()

      expect(result?.name).toBe('John')
    })

    it('should extract nested JSON field', async () => {
      const result = await db.kysely
        .selectFrom('json_test')
        .select(PostgresJSONHelpers.extractPath('data', ['address', 'city']).as('city'))
        .executeTakeFirst()

      expect(result?.city).toBe('New York')
    })

    it('should check if JSON has key', async () => {
      const result = await db.kysely
        .selectFrom('json_test')
        .selectAll()
        .where(PostgresJSONHelpers.hasKey('data', 'email'))
        .executeTakeFirst()

      expect(result).toBeDefined()
    })

    it('should check if JSON has any of the keys', async () => {
      const result = await db.kysely
        .selectFrom('json_test')
        .selectAll()
        .where(PostgresJSONHelpers.hasAnyKey('data', ['email', 'phone']))
        .executeTakeFirst()

      expect(result).toBeDefined()
    })

    it('should check if JSON has all keys', async () => {
      const result = await db.kysely
        .selectFrom('json_test')
        .selectAll()
        .where(PostgresJSONHelpers.hasAllKeys('data', ['name', 'email']))
        .executeTakeFirst()

      expect(result).toBeDefined()
    })

    it('should check if JSONB contains value', async () => {
      const result = await db.kysely
        .selectFrom('json_test')
        .selectAll()
        .where(PostgresJSONHelpers.contains('data', { name: 'John' }))
        .executeTakeFirst()

      expect(result).toBeDefined()
    })

    it('should set JSON field value', async () => {
      await db.kysely
        .updateTable('json_test')
        .set({ data: PostgresJSONHelpers.set('data', ['address', 'city'], 'San Francisco') })
        .execute()

      const result = await db.kysely
        .selectFrom('json_test')
        .select(PostgresJSONHelpers.extractPath('data', ['address', 'city']).as('city'))
        .executeTakeFirst()

      expect(result?.city).toBe('San Francisco')
    })

    it('should delete JSON field', async () => {
      await db.kysely
        .updateTable('json_test')
        .set({ data: PostgresJSONHelpers.delete('data', 'email') })
        .execute()

      const result = await db.kysely
        .selectFrom('json_test')
        .selectAll()
        .where(PostgresJSONHelpers.hasKey('data', 'email'))
        .executeTakeFirst()

      expect(result).toBeUndefined()
    })
  })

  describe('Full-Text Search', () => {
    beforeAll(async () => {
      // Create test table with tsvector column
      await sql`
        CREATE TABLE IF NOT EXISTS posts (
          id SERIAL PRIMARY KEY,
          title TEXT,
          content TEXT,
          search_vector TSVECTOR
        )
      `.execute(db.kysely)

      // Insert test data
      await sql`
        INSERT INTO posts (title, content, search_vector)
        VALUES (
          'Introduction to TypeScript',
          'TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.',
          to_tsvector('english', 'Introduction to TypeScript TypeScript is a typed superset of JavaScript')
        ),
        (
          'PostgreSQL Full-Text Search',
          'PostgreSQL provides powerful full-text search capabilities with tsvector and tsquery.',
          to_tsvector('english', 'PostgreSQL Full-Text Search PostgreSQL provides powerful full-text search capabilities')
        )
      `.execute(db.kysely)

      // Create GIN index
      await PostgresFullTextHelpers.createGINIndex(db.kysely, 'posts', 'search_vector')
    })

    afterAll(async () => {
      await sql`DROP TABLE IF EXISTS posts`.execute(db.kysely)
    })

    it('should perform full-text search', async () => {
      const results = await db.kysely
        .selectFrom('posts')
        .selectAll()
        .where(PostgresFullTextHelpers.match('search_vector', 'TypeScript'))
        .execute()

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].title).toContain('TypeScript')
    })

    it('should rank search results', async () => {
      const results = await db.kysely
        .selectFrom('posts')
        .selectAll()
        .select(PostgresFullTextHelpers.rank('search_vector', 'PostgreSQL').as('rank'))
        .where(PostgresFullTextHelpers.match('search_vector', 'PostgreSQL'))
        .orderBy('rank', 'desc')
        .execute()

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].rank).toBeGreaterThan(0)
    })

    it('should generate search headline', async () => {
      const result = await db.kysely
        .selectFrom('posts')
        .select(PostgresFullTextHelpers.headline('content', 'TypeScript').as('excerpt'))
        .where(PostgresFullTextHelpers.match('search_vector', 'TypeScript'))
        .executeTakeFirst()

      expect(result?.excerpt).toContain('TypeScript')
    })

    it('should add generated tsvector column', async () => {
      // Create a new table for this test
      await sql`
        CREATE TABLE IF NOT EXISTS articles (
          id SERIAL PRIMARY KEY,
          title TEXT,
          body TEXT
        )
      `.execute(db.kysely)

      await PostgresFullTextHelpers.addGeneratedTSVectorColumn(
        db.kysely,
        'articles',
        'search_vector',
        ['title', 'body']
      )

      // Insert test data
      await sql`
        INSERT INTO articles (title, body)
        VALUES ('Test Article', 'This is a test article about NOORMME.')
      `.execute(db.kysely)

      const result = await db.kysely
        .selectFrom('articles')
        .selectAll()
        .where(PostgresFullTextHelpers.match('search_vector', 'NOORMME'))
        .executeTakeFirst()

      expect(result).toBeDefined()

      // Clean up
      await sql`DROP TABLE IF EXISTS articles`.execute(db.kysely)
    })
  })

  describe('Materialized Views', () => {
    beforeAll(async () => {
      // Create test table
      await sql`
        CREATE TABLE IF NOT EXISTS user_posts (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          title TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `.execute(db.kysely)

      // Insert test data
      await sql`
        INSERT INTO user_posts (user_id, title)
        VALUES
          (1, 'Post 1'),
          (1, 'Post 2'),
          (2, 'Post 3')
      `.execute(db.kysely)
    })

    afterAll(async () => {
      await PostgresMaterializedViewHelpers.drop(db.kysely, 'user_stats', {
        ifExists: true,
      })
      await sql`DROP TABLE IF EXISTS user_posts`.execute(db.kysely)
    })

    it('should create materialized view', async () => {
      await PostgresMaterializedViewHelpers.create(
        db.kysely,
        'user_stats',
        sql`SELECT user_id, COUNT(*) as post_count FROM user_posts GROUP BY user_id`
      )

      const results = await sql`SELECT * FROM user_stats`.execute(db.kysely)
      expect(results.rows.length).toBeGreaterThan(0)
    })

    it('should refresh materialized view', async () => {
      // Add more data
      await sql`
        INSERT INTO user_posts (user_id, title)
        VALUES (1, 'Post 4')
      `.execute(db.kysely)

      // Refresh the view
      await PostgresMaterializedViewHelpers.refresh(db.kysely, 'user_stats')

      const result = await sql`SELECT post_count FROM user_stats WHERE user_id = 1`.execute(db.kysely)
      expect(result.rows[0].post_count).toBe(3)
    })

    it('should create unique index on materialized view', async () => {
      await PostgresMaterializedViewHelpers.createUniqueIndex(
        db.kysely,
        'user_stats',
        ['user_id']
      )

      // Should be able to refresh concurrently now
      await PostgresMaterializedViewHelpers.refresh(db.kysely, 'user_stats', {
        concurrently: true,
      })
    })

    it('should get materialized view info', async () => {
      const info = await PostgresMaterializedViewHelpers.getInfo(db.kysely, 'user_stats')

      expect(info).toBeDefined()
      expect(info?.matviewname).toBe('user_stats')
      expect(info?.ispopulated).toBe(true)
    })
  })

  describe('Type Introspection', () => {
    beforeAll(async () => {
      // Create test table with various PostgreSQL types
      await sql`
        CREATE TABLE IF NOT EXISTS type_test (
          id SERIAL PRIMARY KEY,
          tags TEXT[],
          scores INTEGER[],
          metadata JSONB,
          config JSON,
          search_vector TSVECTOR,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `.execute(db.kysely)
    })

    afterAll(async () => {
      await sql`DROP TABLE IF EXISTS type_test`.execute(db.kysely)
    })

    it('should introspect array column types', async () => {
      const schema = await db.introspectSchema()
      const table = schema.tables.find(t => t.name === 'type_test')

      expect(table).toBeDefined()
      
      const tagsColumn = table?.columns.find(c => c.name === 'tags')
      expect(tagsColumn?.type).toBe('text[]')

      const scoresColumn = table?.columns.find(c => c.name === 'scores')
      expect(scoresColumn?.type).toBe('integer[]')
    })

    it('should introspect JSON/JSONB column types', async () => {
      const schema = await db.introspectSchema()
      const table = schema.tables.find(t => t.name === 'type_test')

      const metadataColumn = table?.columns.find(c => c.name === 'metadata')
      expect(metadataColumn?.type).toBe('jsonb')

      const configColumn = table?.columns.find(c => c.name === 'config')
      expect(configColumn?.type).toBe('json')
    })

    it('should introspect tsvector column type', async () => {
      const schema = await db.introspectSchema()
      const table = schema.tables.find(t => t.name === 'type_test')

      const searchColumn = table?.columns.find(c => c.name === 'search_vector')
      expect(searchColumn?.type).toBe('tsvector')
    })
  })
})

