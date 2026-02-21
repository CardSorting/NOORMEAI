import { describe, it, before, after, beforeEach } from 'mocha'
import { expect } from 'chai'
// @ts-ignore - TypeScript has issues with module resolution but tests run successfully
import { NOORMME } from '../dist/esm/noormme.js'
// @ts-ignore - TypeScript has issues with module resolution but tests run successfully
import { NOORMConfig } from '../dist/esm/types/index.js'
import path from 'path'
import fs from 'fs'

/**
 * SQLite Compatibility Test Suite
 * 
 * This test suite specifically addresses SQLite compatibility issues
 * identified in the comprehensive test suite. It focuses on:
 * 
 * 1. Database introspection compatibility
 * 2. SQLite-specific syntax handling
 * 3. Parameter binding compatibility
 * 4. Foreign key constraint handling
 * 5. Schema creation and migration compatibility
 */

describe('SQLite Compatibility Tests', () => {
  let noormme: NOORMME
  let testDbPath: string
  let config: NOORMConfig

  before(() => {
    // Create a unique test database file
    testDbPath = path.join(__dirname, `test-sqlite-${Date.now()}.db`)
  })

  after(async () => {
    // Clean up test database file
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
  })

  beforeEach(() => {
    // Fresh configuration for each test
    config = {
      dialect: 'sqlite',
      connection: {
        database: testDbPath,
        host: '',
        port: 0,
        username: '',
        password: ''
      },
      logging: {
        level: 'error', // Reduce noise for compatibility tests
        enabled: true
      }
    }

    noormme = new NOORMME(config)
  })

  describe('Database Connection and Introspection', () => {
    it('should connect to SQLite database successfully', async () => {
      await expect(noormme.initialize()).to.not.be.rejected
    })

    it('should handle empty database introspection', async () => {
      await noormme.initialize()
      
      const schemaInfo = await noormme.getSchemaInfo()
      const tables = schemaInfo.tables
      expect(tables).to.be.an('array')
      expect(tables).to.have.length(0)
    })

    it('should introspect SQLite-specific system tables correctly', async () => {
      await noormme.initialize()
      
      // Create a simple table
      await noormme.execute(`
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `)
      
      const schemaInfo = await noormme.getSchemaInfo()
      const tables = schemaInfo.tables
      expect(tables).to.be.an('array')
      expect(tables).to.have.length(1)
      expect(tables[0].name).to.equal('test_table')
    })
  })

  describe('SQLite Syntax Compatibility', () => {
    beforeEach(async () => {
      await noormme.initialize()
    })

    it('should handle SQLite CREATE TABLE syntax', async () => {
      await expect(noormme.execute(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)).to.not.be.rejected

      const schemaInfo = await noormme.getSchemaInfo()
      const tables = schemaInfo.tables
      expect(tables).to.have.length(1)
      expect(tables[0].name).to.equal('users')
    })

    it('should handle SQLite INSERT with proper parameter binding', async () => {
      // Create table first
      await noormme.execute(`
        CREATE TABLE test_insert (
          id INTEGER PRIMARY KEY,
          name TEXT,
          age INTEGER,
          active BOOLEAN
        )
      `)

      // Test different data types
      await expect(noormme.execute(
        'INSERT INTO test_insert (name, age, active) VALUES (?, ?, ?)',
        ['John Doe', 30, 1]
      )).to.not.be.rejected

      await expect(noormme.execute(
        'INSERT INTO test_insert (name, age, active) VALUES (?, ?, ?)',
        ['Jane Smith', 25, 0]
      )).to.not.be.rejected

      // Verify data was inserted
      const result = await noormme.execute('SELECT COUNT(*) as count FROM test_insert')
      expect(result[0].count).to.equal(2)
    })

    it('should handle SQLite SELECT with different data types', async () => {
      // Create and populate table
      await noormme.execute(`
        CREATE TABLE test_select (
          id INTEGER PRIMARY KEY,
          name TEXT,
          age INTEGER,
          salary REAL,
          active BOOLEAN,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)

      await noormme.execute(
        'INSERT INTO test_select (name, age, salary, active) VALUES (?, ?, ?, ?)',
        ['Alice', 28, 75000.50, 1]
      )

      const result = await noormme.execute('SELECT * FROM test_select WHERE name = ?', ['Alice'])
      expect(result).to.have.length(1)
      expect(result[0].name).to.equal('Alice')
      expect(result[0].age).to.equal(28)
      expect(result[0].salary).to.equal(75000.50)
      expect(result[0].active).to.equal(1)
    })

    it('should handle SQLite UPDATE operations', async () => {
      // Create and populate table
      await noormme.execute(`
        CREATE TABLE test_update (
          id INTEGER PRIMARY KEY,
          name TEXT,
          age INTEGER
        )
      `)

      await noormme.execute(
        'INSERT INTO test_update (name, age) VALUES (?, ?)',
        ['Bob', 35]
      )

      // Update record
      await noormme.execute(
        'UPDATE test_update SET age = ? WHERE name = ?',
        [36, 'Bob']
      )

      const result = await noormme.execute('SELECT age FROM test_update WHERE name = ?', ['Bob'])
      expect(result[0].age).to.equal(36)
    })

    it('should handle SQLite DELETE operations', async () => {
      // Create and populate table
      await noormme.execute(`
        CREATE TABLE test_delete (
          id INTEGER PRIMARY KEY,
          name TEXT
        )
      `)

      await noormme.execute('INSERT INTO test_delete (name) VALUES (?)', ['Charlie'])
      await noormme.execute('INSERT INTO test_delete (name) VALUES (?)', ['David'])

      // Delete record
      await noormme.execute('DELETE FROM test_delete WHERE name = ?', ['Charlie'])

      const result = await noormme.execute('SELECT COUNT(*) as count FROM test_delete')
      expect(result[0].count).to.equal(1)
    })
  })

  describe('Foreign Key Constraints', () => {
    beforeEach(async () => {
      await noormme.initialize()
    })

    it('should handle foreign keys in CREATE TABLE statements', async () => {
      // SQLite foreign key syntax in CREATE TABLE
      await expect(noormme.execute(`
        CREATE TABLE categories (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `)).to.not.be.rejected

      await expect(noormme.execute(`
        CREATE TABLE products (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          category_id INTEGER,
          FOREIGN KEY (category_id) REFERENCES categories(id)
        )
      `)).to.not.be.rejected

      const schemaInfo = await noormme.getSchemaInfo()
      const tables = schemaInfo.tables
      expect(tables).to.have.length(2)
    })

    it('should handle foreign key constraints without ALTER TABLE', async () => {
      // Create tables without foreign keys first
      await noormme.execute(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `)

      await noormme.execute(`
        CREATE TABLE posts (
          id INTEGER PRIMARY KEY,
          title TEXT NOT NULL,
          user_id INTEGER
        )
      `)

      // In SQLite, we can't add foreign key constraints with ALTER TABLE
      // This should fail gracefully
      await expect(noormme.execute(`
        ALTER TABLE posts ADD CONSTRAINT fk_user_id 
        FOREIGN KEY (user_id) REFERENCES users(id)
      `)).to.be.rejected

      // But the tables should still exist
      const schemaInfo = await noormme.getSchemaInfo()
      const tables = schemaInfo.tables
      expect(tables).to.have.length(2)
    })
  })

  describe('Parameter Binding Edge Cases', () => {
    beforeEach(async () => {
      await noormme.initialize()
    })

    it('should handle null values correctly', async () => {
      await noormme.execute(`
        CREATE TABLE test_nulls (
          id INTEGER PRIMARY KEY,
          name TEXT,
          age INTEGER
        )
      `)

      await expect(noormme.execute(
        'INSERT INTO test_nulls (name, age) VALUES (?, ?)',
        [null, null]
      )).to.not.be.rejected

      const result = await noormme.execute('SELECT * FROM test_nulls')
      expect(result[0].name).to.be.null
      expect(result[0].age).to.be.null
    })

    it('should handle empty strings correctly', async () => {
      await noormme.execute(`
        CREATE TABLE test_empty (
          id INTEGER PRIMARY KEY,
          name TEXT
        )
      `)

      await expect(noormme.execute(
        'INSERT INTO test_empty (name) VALUES (?)',
        ['']
      )).to.not.be.rejected

      const result = await noormme.execute('SELECT * FROM test_empty')
      expect(result[0].name).to.equal('')
    })

    it('should handle numeric edge cases', async () => {
      await noormme.execute(`
        CREATE TABLE test_numbers (
          id INTEGER PRIMARY KEY,
          small_num INTEGER,
          big_num INTEGER,
          decimal_num REAL
        )
      `)

      await expect(noormme.execute(
        'INSERT INTO test_numbers (small_num, big_num, decimal_num) VALUES (?, ?, ?)',
        [0, 2147483647, 3.14159]
      )).to.not.be.rejected

      const result = await noormme.execute('SELECT * FROM test_numbers')
      expect(result[0].small_num).to.equal(0)
      expect(result[0].big_num).to.equal(2147483647)
      expect(result[0].decimal_num).to.be.closeTo(3.14159, 0.00001)
    })

    it('should reject invalid parameter types', async () => {
      await noormme.execute(`
        CREATE TABLE test_invalid (
          id INTEGER PRIMARY KEY,
          name TEXT
        )
      `)

      // These should fail due to invalid parameter types
      await expect(noormme.execute(
        'INSERT INTO test_invalid (name) VALUES (?)',
        [{ invalid: 'object' }]
      )).to.be.rejected

      await expect(noormme.execute(
        'INSERT INTO test_invalid (name) VALUES (?)',
        [[1, 2, 3]]
      )).to.be.rejected
    })
  })

  describe('Schema Discovery Compatibility', () => {
    beforeEach(async () => {
      await noormme.initialize()
    })

    it('should discover table schema correctly', async () => {
      await noormme.execute(`
        CREATE TABLE test_schema (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          age INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT 1
        )
      `)

      // Re-initialize to trigger schema discovery
      const newNoormme = new NOORMME(config)
      await newNoormme.initialize()

      const schemaInfo = await newNoormme.getSchemaInfo()
      const tables = schemaInfo.tables
      expect(tables).to.have.length(1)
      
      const table = tables[0]
      expect(table.name).to.equal('test_schema')
      expect(table.columns).to.be.an('array')
      expect(table.columns.length).to.be.greaterThan(0)
    })

    it('should handle tables with various column types', async () => {
      await noormme.execute(`
        CREATE TABLE test_types (
          id INTEGER PRIMARY KEY,
          text_col TEXT,
          int_col INTEGER,
          real_col REAL,
          blob_col BLOB,
          datetime_col DATETIME,
          boolean_col BOOLEAN
        )
      `)

      // Re-initialize to trigger schema discovery
      const newNoormme = new NOORMME(config)
      await newNoormme.initialize()

      const schemaInfo = await newNoormme.getSchemaInfo()
      const tables = schemaInfo.tables
      const table = tables[0]
      
      expect(table.columns).to.be.an('array')
      expect(table.columns.length).to.equal(7)
    })
  })

  describe('Error Handling', () => {
    beforeEach(async () => {
      await noormme.initialize()
    })

    it('should handle SQL syntax errors gracefully', async () => {
      await expect(noormme.execute('INVALID SQL SYNTAX')).to.be.rejected
    })

    it('should handle table not found errors', async () => {
      await expect(noormme.execute('SELECT * FROM non_existent_table')).to.be.rejected
    })

    it('should handle constraint violation errors', async () => {
      await noormme.execute(`
        CREATE TABLE test_constraint (
          id INTEGER PRIMARY KEY,
          name TEXT UNIQUE
        )
      `)

      await noormme.execute('INSERT INTO test_constraint (name) VALUES (?)', ['unique_name'])
      
      // This should fail due to unique constraint
      await expect(noormme.execute(
        'INSERT INTO test_constraint (name) VALUES (?)',
        ['unique_name']
      )).to.be.rejected
    })
  })

  describe('Performance with SQLite', () => {
    beforeEach(async () => {
      await noormme.initialize()
    })

    it('should handle bulk inserts efficiently', async () => {
      await noormme.execute(`
        CREATE TABLE test_bulk (
          id INTEGER PRIMARY KEY,
          name TEXT,
          value INTEGER
        )
      `)

      const startTime = Date.now()
      const batchSize = 100

      // Insert in batches
      for (let i = 0; i < batchSize; i++) {
        await noormme.execute(
          'INSERT INTO test_bulk (name, value) VALUES (?, ?)',
          [`item_${i}`, i]
        )
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      // Verify all records were inserted
      const result = await noormme.execute('SELECT COUNT(*) as count FROM test_bulk')
      expect(result[0].count).to.equal(batchSize)
      
      // Performance should be reasonable (less than 5 seconds for 100 inserts)
      expect(duration).to.be.lessThan(5000)
    })

    it('should handle concurrent operations', async () => {
      await noormme.execute(`
        CREATE TABLE test_concurrent (
          id INTEGER PRIMARY KEY,
          name TEXT,
          counter INTEGER DEFAULT 0
        )
      `)

      // Insert initial record
      await noormme.execute('INSERT INTO test_concurrent (name) VALUES (?)', ['test'])

      // Simulate concurrent updates
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(
          noormme.execute('UPDATE test_concurrent SET counter = counter + 1 WHERE name = ?', ['test'])
        )
      }

      await Promise.all(promises)

      const result = await noormme.execute('SELECT counter FROM test_concurrent WHERE name = ?', ['test'])
      expect(result[0].counter).to.be.greaterThan(0)
    })
  })
})
