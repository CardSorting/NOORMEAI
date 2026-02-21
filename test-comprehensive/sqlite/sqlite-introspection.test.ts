import { describe, it, before, after, beforeEach } from 'mocha'
import { expect } from 'chai'
// Dynamic imports to handle module resolution issues
let NOORMME: any
let NOORMConfig: any
let DatabaseIntrospector: any
import path from 'path'
import fs from 'fs'

/**
 * Targeted SQLite Database Introspection Tests
 * 
 * This test suite focuses specifically on the database introspection issues
 * that prevent NOORMME from working properly with SQLite databases.
 * 
 * Key Issues Being Tested:
 * 1. DatabaseIntrospector.getTables() tries PostgreSQL/MySQL queries first
 * 2. No proper fallback to SQLite-specific queries
 * 3. Schema discovery fails due to introspection errors
 */

describe('SQLite Database Introspection - Targeted Tests', () => {
  let noormme: any
  let testDbPath: string
  let config: any

  before(async () => {
    // Dynamic imports
    // @ts-ignore - TypeScript has issues with module resolution but tests run successfully
    const noormmeModule = await import('../../dist/esm/noormme.js')
    // @ts-ignore - TypeScript has issues with module resolution but tests run successfully
    const typesModule = await import('../../dist/esm/types/index.js')
    // @ts-ignore - TypeScript has issues with module resolution but tests run successfully
    const introspectorModule = await import('../../dist/esm/dialect/database-introspector.js')
    
    const NOORMME = noormmeModule.NOORMME
    const NOORMConfig = typesModule.NOORMConfig
    DatabaseIntrospector = introspectorModule.DatabaseIntrospector
    
    testDbPath = path.join(__dirname, `test-sqlite-introspection-${Date.now()}.db`)
  })

  after(async () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
  })

  beforeEach(() => {
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
        level: 'error',
        enabled: true
      }
    }

    noormme = new NOORMME(config)
  })

  describe('DatabaseIntrospector.getTables() - Direct Testing', () => {
    it('should fail when trying PostgreSQL query on SQLite', async () => {
      await noormme.initialize()
      
      const introspector = new DatabaseIntrospector(noormme['db'])
      
      // This should fail because it tries PostgreSQL queries first
      await expect(introspector.getTables()).to.be.rejectedWith(/no such table: information_schema.tables/)
    })

    it('should demonstrate the introspection fallback mechanism', async () => {
      await noormme.initialize()
      
      const introspector = new DatabaseIntrospector(noormme['db'])
      
      try {
        await introspector.getTables()
        expect.fail('Should have thrown an error')
      } catch (error: any) {
        // Verify it's the expected PostgreSQL query error
        expect(error.message).to.include('no such table: information_schema.tables')
        expect(error.code).to.equal('SQLITE_ERROR')
      }
    })

    it('should work with direct SQLite query', async () => {
      await noormme.initialize()
      
      // Create a test table first
      await noormme.execute(`
        CREATE TABLE test_introspection (
          id INTEGER PRIMARY KEY,
          name TEXT
        )
      `)
      
      // Test direct SQLite introspection query
      const result = await noormme.execute(`
        SELECT name FROM sqlite_master 
        WHERE type = 'table' 
        AND name NOT LIKE 'sqlite_%'
      `)
      
      expect(result).to.be.an('array')
      expect(result).to.have.length(1)
      expect(result[0].name).to.equal('test_introspection')
    })
  })

  describe('NOORMME.initialize() - Introspection Impact', () => {
    it('should fail during initialization due to introspection', async () => {
      // This should fail during the database connection test
      await expect(noormme.initialize()).to.be.rejected
    })

    it('should fail during schema discovery', async () => {
      // Even if we bypass the connection test, schema discovery will fail
      try {
        await noormme.initialize()
        expect.fail('Should have thrown an error during initialization')
      } catch (error: any) {
        // Should fail at the introspection step
        expect(error.message).to.include('no such table: information_schema.tables')
      }
    })
  })

  describe('Manual Schema Discovery - Workaround Testing', () => {
    it('should manually discover tables using SQLite queries', async () => {
      await noormme.initialize().catch(() => {
        // Ignore initialization error, we'll test manually
      })
      
      // Create test tables
      await noormme.execute(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE
        )
      `)
      
      await noormme.execute(`
        CREATE TABLE posts (
          id INTEGER PRIMARY KEY,
          title TEXT NOT NULL,
          user_id INTEGER,
          content TEXT
        )
      `)
      
      // Manual table discovery
      const tables = await noormme.execute(`
        SELECT name FROM sqlite_master 
        WHERE type = 'table' 
        AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `)
      
      expect(tables).to.have.length(2)
      expect(tables[0].name).to.equal('posts')
      expect(tables[1].name).to.equal('users')
    })

    it('should manually discover table schema using SQLite PRAGMA', async () => {
      await noormme.initialize().catch(() => {
        // Ignore initialization error, we'll test manually
      })
      
      // Create test table with various column types
      await noormme.execute(`
        CREATE TABLE test_schema (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          age INTEGER DEFAULT 0,
          salary REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT 1
        )
      `)
      
      // Manual schema discovery using PRAGMA
      const schema = await noormme.execute(`PRAGMA table_info(test_schema)`)
      
      expect(schema).to.be.an('array')
      expect(schema).to.have.length(7)
      
      // Check specific columns
      const idColumn = schema.find((col: any) => col.name === 'id')
      expect(idColumn).to.exist
      expect(idColumn.type).to.equal('INTEGER')
      expect(idColumn.pk).to.equal(1) // Primary key flag
      
      const nameColumn = schema.find((col: any) => col.name === 'name')
      expect(nameColumn).to.exist
      expect(nameColumn.type).to.equal('TEXT')
      expect(nameColumn.notnull).to.equal(1)
      
      const emailColumn = schema.find((col: any) => col.name === 'email')
      expect(emailColumn).to.exist
      expect(emailColumn.type).to.equal('TEXT')
    })
  })

  describe('Database Introspection Error Analysis', () => {
    it('should identify the exact error sequence', async () => {
      await noormme.initialize().catch(() => {
        // Expected to fail
      })
      
      const introspector = new DatabaseIntrospector(noormme['db'])
      
      // Test each step of the introspection process
      try {
        // Step 1: PostgreSQL query (should fail)
        await noormme.execute(`
          SELECT table_name as name, table_schema as schema
          FROM information_schema.tables
          WHERE table_type = 'BASE TABLE'
          AND table_schema NOT IN ('information_schema', 'pg_catalog')
        `)
        expect.fail('PostgreSQL query should fail on SQLite')
      } catch (error: any) {
        expect(error.code).to.equal('SQLITE_ERROR')
        expect(error.message).to.include('no such table: information_schema.tables')
      }
      
      try {
        // Step 2: MySQL query (should also fail)
        await noormme.execute(`
          SELECT table_name as name, table_schema as schema
          FROM information_schema.tables
          WHERE table_type = 'BASE TABLE'
          AND table_schema = 'public'
        `)
        expect.fail('MySQL query should fail on SQLite')
      } catch (error: any) {
        expect(error.code).to.equal('SQLITE_ERROR')
        expect(error.message).to.include('no such table: information_schema.tables')
      }
      
      // Step 3: SQLite query (should work)
      const sqliteResult = await noormme.execute(`
        SELECT name FROM sqlite_master
        WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
      `)
      
      expect(sqliteResult).to.be.an('array')
    })
  })

  describe('Proposed Fix Testing', () => {
    it('should work with corrected introspection order', async () => {
      await noormme.initialize().catch(() => {
        // Ignore initialization error
      })
      
      // Create test table
      await noormme.execute(`
        CREATE TABLE test_fix (
          id INTEGER PRIMARY KEY,
          name TEXT
        )
      `)
      
      // Simulate the corrected introspection logic
      async function getTablesFixed() {
        try {
          // Try SQLite first (correct order)
          const sqliteTables = await noormme.execute(`
            SELECT name FROM sqlite_master
            WHERE type = 'table'
            AND name NOT LIKE 'sqlite_%'
          `)
          
          if (sqliteTables.length > 0) {
            return sqliteTables.map((t: any) => ({ name: t.name }))
          }
        } catch (error) {
          // Fallback to other databases if needed
          console.log('SQLite introspection failed, trying other dialects')
        }
        
        // This would never be reached for SQLite
        return []
      }
      
      const tables = await getTablesFixed()
      expect(tables).to.have.length(1)
      expect(tables[0].name).to.equal('test_fix')
    })

    it('should demonstrate proper error handling in introspection', async () => {
      await noormme.initialize().catch(() => {
        // Ignore initialization error
      })
      
      // Test robust introspection with proper error handling
      async function robustGetTables() {
        const queries = [
          {
            name: 'SQLite',
            query: `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
          },
          {
            name: 'PostgreSQL',
            query: `SELECT table_name as name FROM information_schema.tables WHERE table_type = 'BASE TABLE'`
          },
          {
            name: 'MySQL',
            query: `SELECT table_name as name FROM information_schema.tables WHERE table_type = 'BASE TABLE'`
          }
        ]
        
        for (const { name, query } of queries) {
          try {
            const result = await noormme.execute(query)
            if (result.length > 0) {
              console.log(`Found tables using ${name} introspection`)
              return result.map((t: any) => ({ name: t.name }))
            }
          } catch (error: any) {
            console.log(`${name} introspection failed: ${error.message}`)
            // Continue to next query
          }
        }
        
        return []
      }
      
      // Create test table
      await noormme.execute(`CREATE TABLE test_robust (id INTEGER PRIMARY KEY)`)
      
      const tables = await robustGetTables()
      expect(tables).to.have.length(1)
      expect(tables[0].name).to.equal('test_robust')
    })
  })

  describe('Performance Impact of Introspection Failures', () => {
    it('should measure time spent on failed introspection attempts', async () => {
      const startTime = Date.now()
      
      try {
        await noormme.initialize()
      } catch (error) {
        // Expected to fail
      }
      
      const endTime = Date.now()
      const duration = endTime - startTime
      
      // Should fail quickly (less than 5 seconds) rather than hanging
      expect(duration).to.be.lessThan(5000)
      console.log(`Introspection failure took ${duration}ms`)
    })

    it('should compare performance of failed vs successful introspection', async () => {
      // Test failed introspection
      const failedStart = Date.now()
      try {
        await noormme.initialize()
      } catch (error) {
        // Expected to fail
      }
      const failedDuration = Date.now() - failedStart
      
      // Create a fresh instance and test successful introspection
      const testDbPath2 = path.join(__dirname, `test-sqlite-success-${Date.now()}.db`)
      const config2 = {
        dialect: 'sqlite',
        connection: { database: testDbPath2, host: '', port: 0, username: '', password: '' },
        logging: { level: 'error', enabled: true }
      }
      
      const noormme2 = new NOORMME(config2)
      
      const successStart = Date.now()
      await noormme2.execute(`CREATE TABLE test_perf (id INTEGER PRIMARY KEY)`)
      const directQuery = await noormme2.execute(`SELECT name FROM sqlite_master WHERE type = 'table'`)
      const successDuration = Date.now() - successStart
      
      // Cleanup
      if (fs.existsSync(testDbPath2)) {
        fs.unlinkSync(testDbPath2)
      }
      
      console.log(`Failed introspection: ${failedDuration}ms`)
      console.log(`Direct SQLite query: ${successDuration}ms`)
      
      // Direct query should be much faster
      expect(successDuration).to.be.lessThan(failedDuration)
    })
  })
})
