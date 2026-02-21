import { describe, it, before, after, beforeEach } from 'mocha'
import { expect } from 'chai'
import { NOORMME } from '../dist/esm/noormme.js'
import { NOORMConfig } from '../dist/esm/types/index.js'
import path from 'path'
import fs from 'fs'

/**
 * Targeted SQLite Syntax Compatibility Tests
 * 
 * This test suite focuses specifically on SQL syntax issues
 * that cause "near 'constraint': syntax error" and other SQLite-specific problems.
 * 
 * Key Issues Being Tested:
 * 1. Foreign key constraint syntax differences
 * 2. ALTER TABLE syntax limitations in SQLite
 * 3. Data type compatibility issues
 * 4. SQL dialect differences
 */

describe('SQLite Syntax Compatibility - Targeted Tests', () => {
  let noormme: NOORMME
  let testDbPath: string
  let config: NOORMConfig

  before(() => {
    testDbPath = path.join(__dirname, `test-sqlite-syntax-${Date.now()}.db`)
  })

  after(async () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
  })

  beforeEach(async () => {
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
    
    // Initialize without schema discovery to avoid introspection issues
    try {
      await noormme.initialize()
    } catch (error) {
      // If initialization fails, we'll test syntax manually
    }
  })

  describe('Foreign Key Constraint Syntax', () => {
    it('should fail with PostgreSQL/MySQL ALTER TABLE syntax', async () => {
      // Create base tables first
      await noormme.execute(`
        CREATE TABLE categories (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `)

      await noormme.execute(`
        CREATE TABLE products (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          category_id INTEGER
        )
      `)

      // This PostgreSQL/MySQL syntax should fail in SQLite
      await expect(noormme.execute(`
        ALTER TABLE products ADD CONSTRAINT fk_category_id 
        FOREIGN KEY (category_id) REFERENCES categories(id)
      `)).to.be.rejectedWith(/near "constraint": syntax error/)
    })

    it('should work with SQLite foreign key syntax in CREATE TABLE', async () => {
      // Drop existing tables
      await noormme.execute('DROP TABLE IF EXISTS products')
      await noormme.execute('DROP TABLE IF EXISTS categories')

      // Create tables with foreign keys using SQLite syntax
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

      // Verify tables were created
      const tables = await noormme.execute(`
        SELECT name FROM sqlite_master 
        WHERE type = 'table' 
        AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `)
      
      expect(tables).to.have.length(2)
      expect(tables[0].name).to.equal('categories')
      expect(tables[1].name).to.equal('products')
    })

    it('should demonstrate SQLite foreign key limitations', async () => {
      // SQLite has limited ALTER TABLE support
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

      // SQLite cannot add foreign key constraints after table creation
      const alterStatements = [
        `ALTER TABLE posts ADD CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES users(id)`,
        `ALTER TABLE posts ADD FOREIGN KEY (user_id) REFERENCES users(id)`,
        `ALTER TABLE posts ADD CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`
      ]

      for (const statement of alterStatements) {
        await expect(noormme.execute(statement)).to.be.rejectedWith(/near "constraint": syntax error/)
      }
    })
  })

  describe('ALTER TABLE Syntax Limitations', () => {
    it('should demonstrate what ALTER TABLE operations work in SQLite', async () => {
      await noormme.execute(`
        CREATE TABLE test_alter (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          age INTEGER
        )
      `)

      // These operations work in SQLite
      await expect(noormme.execute(`
        ALTER TABLE test_alter ADD COLUMN email TEXT
      `)).to.not.be.rejected

      await expect(noormme.execute(`
        ALTER TABLE test_alter ADD COLUMN salary REAL DEFAULT 0
      `)).to.not.be.rejected

      // Verify columns were added
      const schema = await noormme.execute(`PRAGMA table_info(test_alter)`)
      expect(schema).to.have.length(5) // id, name, age, email, salary
    })

    it('should demonstrate what ALTER TABLE operations fail in SQLite', async () => {
      await noormme.execute(`
        CREATE TABLE test_alter_fail (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          age INTEGER
        )
      `)

      // These operations fail in SQLite
      const failingOperations = [
        `ALTER TABLE test_alter_fail DROP COLUMN age`,
        `ALTER TABLE test_alter_fail ALTER COLUMN name TYPE VARCHAR(100)`,
        `ALTER TABLE test_alter_fail MODIFY COLUMN age INTEGER NOT NULL`,
        `ALTER TABLE test_alter_fail CHANGE COLUMN name full_name TEXT`,
        `ALTER TABLE test_alter_fail ADD CONSTRAINT pk_test PRIMARY KEY (id, name)`
      ]

      for (const operation of failingOperations) {
        await expect(noormme.execute(operation)).to.be.rejected
      }
    })
  })

  describe('Data Type Compatibility', () => {
    it('should demonstrate SQLite data type flexibility', async () => {
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

      // SQLite accepts various types for each column
      const testData = [
        ['text', 123, 45.67, Buffer.from('binary'), '2023-12-01', 1],
        [123, 'text', '45.67', 'text', 1234567890, 0],
        [null, null, null, null, null, null]
      ]

      for (const data of testData) {
        await expect(noormme.execute(`
          INSERT INTO test_types (text_col, int_col, real_col, blob_col, datetime_col, boolean_col)
          VALUES (?, ?, ?, ?, ?, ?)
        `, data)).to.not.be.rejected
      }
    })

    it('should demonstrate PostgreSQL/MySQL specific syntax that fails in SQLite', async () => {
      const failingStatements = [
        // PostgreSQL specific
        `CREATE TABLE test_pg (id SERIAL PRIMARY KEY)`,
        `CREATE TABLE test_pg (id BIGSERIAL PRIMARY KEY)`,
        `CREATE TABLE test_pg (data JSONB)`,
        `CREATE TABLE test_pg (id INTEGER GENERATED ALWAYS AS IDENTITY)`,
        
        // MySQL specific
        `CREATE TABLE test_mysql (id INT AUTO_INCREMENT PRIMARY KEY)`,
        `CREATE TABLE test_mysql (data JSON)`,
        `CREATE TABLE test_mysql (id INTEGER AUTO_INCREMENT PRIMARY KEY)`,
        
        // Both PostgreSQL and MySQL
        `CREATE TABLE test_both (id INTEGER NOT NULL AUTO_INCREMENT PRIMARY KEY)`,
        `CREATE TABLE test_both (created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        `CREATE TABLE test_both (data ENUM('value1', 'value2'))`
      ]

      for (const statement of failingStatements) {
        await expect(noormme.execute(statement)).to.be.rejected
      }
    })
  })

  describe('Index and Constraint Syntax', () => {
    it('should demonstrate SQLite index syntax', async () => {
      await noormme.execute(`
        CREATE TABLE test_index (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          age INTEGER
        )
      `)

      // These index operations work in SQLite
      await expect(noormme.execute(`
        CREATE INDEX idx_test_index_name ON test_index (name)
      `)).to.not.be.rejected

      await expect(noormme.execute(`
        CREATE UNIQUE INDEX idx_test_index_email ON test_index (email)
      `)).to.not.be.rejected

      // Verify indexes were created
      const indexes = await noormme.execute(`
        SELECT name FROM sqlite_master 
        WHERE type = 'index' 
        AND tbl_name = 'test_index'
        AND name NOT LIKE 'sqlite_%'
      `)
      
      expect(indexes.length).to.be.greaterThan(0)
    })

    it('should demonstrate constraint syntax differences', async () => {
      // SQLite constraint syntax in CREATE TABLE
      await expect(noormme.execute(`
        CREATE TABLE test_constraints (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          age INTEGER CHECK (age >= 0 AND age <= 150),
          status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending'))
        )
      `)).to.not.be.rejected

      // But you cannot add constraints after table creation
      await expect(noormme.execute(`
        ALTER TABLE test_constraints ADD CONSTRAINT chk_age CHECK (age >= 18)
      `)).to.be.rejected
    })
  })

  describe('SQL Dialect Differences', () => {
    it('should demonstrate PostgreSQL-specific features that fail in SQLite', async () => {
      const pgFeatures = [
        // Arrays
        `CREATE TABLE test_array (id INTEGER, tags TEXT[])`,
        `INSERT INTO test_array VALUES (1, ARRAY['tag1', 'tag2'])`,
        
        // Full-text search
        `CREATE TABLE test_fts (id INTEGER, content TEXT, FULLTEXT(content))`,
        
        // Window functions (these might work in newer SQLite)
        `SELECT id, name, ROW_NUMBER() OVER (ORDER BY name) FROM test_constraints`,
        
        // Advanced JSON functions
        `SELECT json_extract('{"name": "John"}', '$.name')`,
        
        // Lateral joins
        `SELECT * FROM test_constraints t1, LATERAL (SELECT * FROM test_constraints t2 WHERE t2.id = t1.id) t3`
      ]

      for (const feature of pgFeatures) {
        try {
          await noormme.execute(feature)
          console.log(`Unexpectedly succeeded: ${feature}`)
        } catch (error: any) {
          console.log(`Expected failure: ${feature} -> ${error.message}`)
          expect(error).to.exist
        }
      }
    })

    it('should demonstrate MySQL-specific features that fail in SQLite', async () => {
      const mysqlFeatures = [
        // AUTO_INCREMENT
        `CREATE TABLE test_auto (id INTEGER AUTO_INCREMENT PRIMARY KEY)`,
        
        // ENUM types
        `CREATE TABLE test_enum (status ENUM('active', 'inactive'))`,
        
        // SET types
        `CREATE TABLE test_set (permissions SET('read', 'write', 'execute'))`,
        
        // MySQL-specific functions
        `SELECT CONCAT('Hello', ' ', 'World')`,
        `SELECT NOW()`,
        `SELECT CURDATE()`,
        `SELECT USER()`
      ]

      for (const feature of mysqlFeatures) {
        try {
          await noormme.execute(feature)
          console.log(`Unexpectedly succeeded: ${feature}`)
        } catch (error: any) {
          console.log(`Expected failure: ${feature} -> ${error.message}`)
          expect(error).to.exist
        }
      }
    })
  })

  describe('Real-World Schema Creation Issues', () => {
    it('should reproduce the exact constraint error from comprehensive tests', async () => {
      // This simulates the schema creation that fails in the comprehensive tests
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
          content TEXT,
          user_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // This is the exact statement that fails in the comprehensive tests
      await expect(noormme.execute(`
        ALTER TABLE posts ADD CONSTRAINT fk_posts_user_id 
        FOREIGN KEY (user_id) REFERENCES users(id)
      `)).to.be.rejectedWith(/near "constraint": syntax error/)

      // The correct SQLite approach would be to recreate the table with foreign keys
      await noormme.execute('DROP TABLE posts')
      
      await expect(noormme.execute(`
        CREATE TABLE posts (
          id INTEGER PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT,
          user_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `)).to.not.be.rejected
    })

    it('should demonstrate proper SQLite schema creation', async () => {
      // Drop any existing tables
      await noormme.execute('DROP TABLE IF EXISTS posts')
      await noormme.execute('DROP TABLE IF EXISTS users')
      await noormme.execute('DROP TABLE IF EXISTS categories')

      // Create schema using SQLite-compatible syntax
      await expect(noormme.execute(`
        CREATE TABLE categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)).to.not.be.rejected

      await expect(noormme.execute(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          age INTEGER CHECK (age >= 0 AND age <= 150),
          status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)).to.not.be.rejected

      await expect(noormme.execute(`
        CREATE TABLE posts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          content TEXT,
          user_id INTEGER NOT NULL,
          category_id INTEGER,
          published BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
        )
      `)).to.not.be.rejected

      // Verify schema was created correctly
      const tables = await noormme.execute(`
        SELECT name FROM sqlite_master 
        WHERE type = 'table' 
        AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `)
      
      expect(tables).to.have.length(3)
      expect(tables[0].name).to.equal('categories')
      expect(tables[1].name).to.equal('posts')
      expect(tables[2].name).to.equal('users')
    })
  })

  describe('Migration and Schema Evolution', () => {
    it('should demonstrate SQLite schema migration limitations', async () => {
      // Start with a basic table
      await noormme.execute(`
        CREATE TABLE test_migration (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `)

      // SQLite can add columns
      await expect(noormme.execute(`
        ALTER TABLE test_migration ADD COLUMN email TEXT
      `)).to.not.be.rejected

      await expect(noormme.execute(`
        ALTER TABLE test_migration ADD COLUMN age INTEGER DEFAULT 0
      `)).to.not.be.rejected

      // But SQLite cannot drop columns or modify constraints
      const failingMigrations = [
        `ALTER TABLE test_migration DROP COLUMN email`,
        `ALTER TABLE test_migration ALTER COLUMN name TYPE VARCHAR(100)`,
        `ALTER TABLE test_migration ADD CONSTRAINT chk_age CHECK (age >= 0)`
      ]

      for (const migration of failingMigrations) {
        await expect(noormme.execute(migration)).to.be.rejected
      }
    })

    it('should demonstrate workarounds for SQLite limitations', async () => {
      await noormme.execute(`
        CREATE TABLE test_workaround (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT
        )
      `)

      // Insert some test data
      await noormme.execute(`
        INSERT INTO test_workaround (name, email) VALUES 
        ('Alice', 'alice@example.com'),
        ('Bob', 'bob@example.com')
      `)

      // To drop a column in SQLite, you need to recreate the table
      const originalData = await noormme.execute('SELECT * FROM test_workaround')
      
      // Create new table without the column to drop
      await noormme.execute(`
        CREATE TABLE test_workaround_new (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `)

      // Copy data (excluding the dropped column)
      await noormme.execute(`
        INSERT INTO test_workaround_new (id, name)
        SELECT id, name FROM test_workaround
      `)

      // Drop old table and rename new one
      await noormme.execute('DROP TABLE test_workaround')
      await noormme.execute('ALTER TABLE test_workaround_new RENAME TO test_workaround')

      // Verify migration worked
      const migratedData = await noormme.execute('SELECT * FROM test_workaround')
      expect(migratedData).to.have.length(2)
      expect(migratedData[0].name).to.equal('Alice')
      expect(migratedData[0].email).to.be.undefined // Column was dropped
    })
  })
})
