import { describe, it, before, after, beforeEach } from 'mocha'
import { expect } from 'chai'
// @ts-ignore - TypeScript has issues with module resolution but tests run successfully
import { NOORMME } from '../dist/esm/noormme.js'
// @ts-ignore - TypeScript has issues with module resolution but tests run successfully
import { NOORMConfig } from '../dist/esm/types/index.js'
import path from 'path'
import fs from 'fs'

/**
 * Targeted SQLite Foreign Key Constraint Tests
 * 
 * This test suite focuses specifically on foreign key constraint issues
 * that cause "near 'constraint': syntax error" in SQLite.
 * 
 * Key Issues Being Tested:
 * 1. ALTER TABLE ADD CONSTRAINT syntax incompatibility
 * 2. Foreign key constraint creation timing
 * 3. SQLite foreign key limitations
 * 4. Proper foreign key syntax for SQLite
 */

describe('SQLite Foreign Key Constraints - Targeted Tests', () => {
  let noormme: NOORMME
  let testDbPath: string
  let config: NOORMConfig

  before(() => {
    testDbPath = path.join(__dirname, `test-sqlite-constraints-${Date.now()}.db`)
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
    
    // Initialize without schema discovery
    try {
      await noormme.initialize()
    } catch (error) {
      // Expected to fail due to introspection issues
    }
  })

  describe('ALTER TABLE ADD CONSTRAINT - The Core Problem', () => {
    it('should fail with the exact error from comprehensive tests', async () => {
      // Create base tables
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

      // This is the exact statement that fails in comprehensive tests
      await expect(noormme.execute(`
        ALTER TABLE posts ADD CONSTRAINT fk_posts_user_id 
        FOREIGN KEY (user_id) REFERENCES users(id)
      `)).to.be.rejectedWith(/near "constraint": syntax error/)
    })

    it('should demonstrate that SQLite does not support ADD CONSTRAINT', async () => {
      await noormme.execute(`
        CREATE TABLE parent (
          id INTEGER PRIMARY KEY,
          name TEXT
        )
      `)

      await noormme.execute(`
        CREATE TABLE child (
          id INTEGER PRIMARY KEY,
          name TEXT,
          parent_id INTEGER
        )
      `)

      // All these variations fail in SQLite
      const failingStatements = [
        `ALTER TABLE child ADD CONSTRAINT fk_parent FOREIGN KEY (parent_id) REFERENCES parent(id)`,
        `ALTER TABLE child ADD CONSTRAINT fk_parent FOREIGN KEY (parent_id) REFERENCES parent(id) ON DELETE CASCADE`,
        `ALTER TABLE child ADD CONSTRAINT fk_parent FOREIGN KEY (parent_id) REFERENCES parent(id) ON DELETE SET NULL`,
        `ALTER TABLE child ADD CONSTRAINT fk_parent FOREIGN KEY (parent_id) REFERENCES parent(id) ON UPDATE CASCADE`,
        `ALTER TABLE child ADD FOREIGN KEY (parent_id) REFERENCES parent(id)`,
        `ALTER TABLE child ADD CONSTRAINT fk_parent FOREIGN KEY (parent_id) REFERENCES parent(id) DEFERRABLE INITIALLY DEFERRED`
      ]

      for (const statement of failingStatements) {
        await expect(noormme.execute(statement)).to.be.rejectedWith(/near "constraint": syntax error/)
      }
    })
  })

  describe('Proper SQLite Foreign Key Syntax', () => {
    it('should work with foreign keys in CREATE TABLE', async () => {
      // Drop existing tables
      await noormme.execute('DROP TABLE IF EXISTS posts')
      await noormme.execute('DROP TABLE IF EXISTS users')

      // Create tables with foreign keys using proper SQLite syntax
      await expect(noormme.execute(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE
        )
      `)).to.not.be.rejected

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

      // Verify tables were created
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

    it('should work with complex foreign key relationships', async () => {
      await noormme.execute('DROP TABLE IF EXISTS comments')
      await noormme.execute('DROP TABLE IF EXISTS posts')
      await noormme.execute('DROP TABLE IF EXISTS users')
      await noormme.execute('DROP TABLE IF EXISTS categories')

      // Create a complex schema with multiple foreign keys
      await expect(noormme.execute(`
        CREATE TABLE categories (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT
        )
      `)).to.not.be.rejected

      await expect(noormme.execute(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL
        )
      `)).to.not.be.rejected

      await expect(noormme.execute(`
        CREATE TABLE posts (
          id INTEGER PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT,
          user_id INTEGER NOT NULL,
          category_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
        )
      `)).to.not.be.rejected

      await expect(noormme.execute(`
        CREATE TABLE comments (
          id INTEGER PRIMARY KEY,
          content TEXT NOT NULL,
          post_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `)).to.not.be.rejected

      // Verify all tables were created
      const tables = await noormme.execute(`
        SELECT name FROM sqlite_master 
        WHERE type = 'table' 
        AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `)
      
      expect(tables).to.have.length(4)
      expect(tables[0].name).to.equal('categories')
      expect(tables[1].name).to.equal('comments')
      expect(tables[2].name).to.equal('posts')
      expect(tables[3].name).to.equal('users')
    })
  })

  describe('Foreign Key Action Testing', () => {
    it('should test CASCADE delete behavior', async () => {
      await noormme.execute('DROP TABLE IF EXISTS posts')
      await noormme.execute('DROP TABLE IF EXISTS users')

      // Create tables with CASCADE delete
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
          user_id INTEGER NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `)

      // Insert test data
      await noormme.execute(`
        INSERT INTO users (name) VALUES ('Alice'), ('Bob')
      `)

      await noormme.execute(`
        INSERT INTO posts (title, user_id) VALUES 
        ('Post 1', 1),
        ('Post 2', 1),
        ('Post 3', 2)
      `)

      // Verify initial data
      let posts = await noormme.execute('SELECT COUNT(*) as count FROM posts')
      expect(posts[0].count).to.equal(3)

      // Delete user (should cascade to posts)
      await noormme.execute('DELETE FROM users WHERE id = 1')

      // Verify cascade delete worked
      posts = await noormme.execute('SELECT COUNT(*) as count FROM posts')
      expect(posts[0].count).to.equal(1) // Only Bob's post should remain

      const remainingPosts = await noormme.execute('SELECT * FROM posts')
      expect(remainingPosts[0].user_id).to.equal(2)
    })

    it('should test SET NULL behavior', async () => {
      await noormme.execute('DROP TABLE IF EXISTS posts')
      await noormme.execute('DROP TABLE IF EXISTS categories')

      // Create tables with SET NULL
      await noormme.execute(`
        CREATE TABLE categories (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `)

      await noormme.execute(`
        CREATE TABLE posts (
          id INTEGER PRIMARY KEY,
          title TEXT NOT NULL,
          category_id INTEGER,
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
        )
      `)

      // Insert test data
      await noormme.execute(`
        INSERT INTO categories (name) VALUES ('Tech'), ('Sports')
      `)

      await noormme.execute(`
        INSERT INTO posts (title, category_id) VALUES 
        ('Tech Post 1', 1),
        ('Tech Post 2', 1),
        ('Sports Post 1', 2)
      `)

      // Delete category (should set category_id to NULL)
      await noormme.execute('DELETE FROM categories WHERE id = 1')

      // Verify SET NULL worked
      const posts = await noormme.execute('SELECT * FROM posts ORDER BY id')
      expect(posts[0].category_id).to.be.null
      expect(posts[1].category_id).to.be.null
      expect(posts[2].category_id).to.equal(2) // Sports category still exists
    })

    it('should test RESTRICT behavior', async () => {
      await noormme.execute('DROP TABLE IF EXISTS posts')
      await noormme.execute('DROP TABLE IF EXISTS users')

      // Create tables with RESTRICT (default behavior)
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
          user_id INTEGER NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
        )
      `)

      // Insert test data
      await noormme.execute(`
        INSERT INTO users (name) VALUES ('Alice')
      `)

      await noormme.execute(`
        INSERT INTO posts (title, user_id) VALUES ('Post 1', 1)
      `)

      // Try to delete user with existing posts (should fail)
      await expect(noormme.execute('DELETE FROM users WHERE id = 1')).to.be.rejected

      // Verify user still exists
      const users = await noormme.execute('SELECT COUNT(*) as count FROM users')
      expect(users[0].count).to.equal(1)
    })
  })

  describe('Foreign Key Constraint Violations', () => {
    it('should prevent invalid foreign key references', async () => {
      await noormme.execute('DROP TABLE IF EXISTS posts')
      await noormme.execute('DROP TABLE IF EXISTS users')

      // Create tables with foreign key
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
          user_id INTEGER,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `)

      // Insert user
      await noormme.execute(`
        INSERT INTO users (name) VALUES ('Alice')
      `)

      // Try to insert post with invalid user_id
      await expect(noormme.execute(`
        INSERT INTO posts (title, user_id) VALUES ('Post 1', 999)
      `)).to.be.rejected

      // Valid insert should work
      await expect(noormme.execute(`
        INSERT INTO posts (title, user_id) VALUES ('Post 1', 1)
      `)).to.not.be.rejected
    })

    it('should handle NULL foreign key values', async () => {
      await noormme.execute('DROP TABLE IF EXISTS posts')
      await noormme.execute('DROP TABLE IF EXISTS users')

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
          user_id INTEGER,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `)

      // NULL foreign key should be allowed
      await expect(noormme.execute(`
        INSERT INTO posts (title, user_id) VALUES ('Post 1', NULL)
      `)).to.not.be.rejected

      // Verify NULL was inserted
      const posts = await noormme.execute('SELECT * FROM posts WHERE user_id IS NULL')
      expect(posts).to.have.length(1)
      expect(posts[0].title).to.equal('Post 1')
    })
  })

  describe('Foreign Key Information Schema', () => {
    it('should query foreign key information', async () => {
      await noormme.execute('DROP TABLE IF EXISTS posts')
      await noormme.execute('DROP TABLE IF EXISTS users')

      // Create tables with foreign key
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
          user_id INTEGER,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `)

      // Query foreign key information using PRAGMA
      const foreignKeys = await noormme.execute('PRAGMA foreign_key_list(posts)')
      
      expect(foreignKeys).to.be.an('array')
      expect(foreignKeys).to.have.length(1)
      expect(foreignKeys[0].table).to.equal('posts')
      expect(foreignKeys[0].from).to.equal('user_id')
      expect(foreignKeys[0].to).to.equal('id')
      expect(foreignKeys[0].table).to.equal('users')
    })

    it('should check foreign key support', async () => {
      // Check if foreign keys are enabled
      const fkEnabled = await noormme.execute('PRAGMA foreign_keys')
      console.log('Foreign keys enabled:', fkEnabled[0].foreign_keys)

      // Enable foreign keys if not already enabled
      await noormme.execute('PRAGMA foreign_keys = ON')

      const fkEnabledAfter = await noormme.execute('PRAGMA foreign_keys')
      expect(fkEnabledAfter[0].foreign_keys).to.equal(1)
    })
  })

  describe('Workarounds for Foreign Key Limitations', () => {
    it('should demonstrate table recreation for adding foreign keys', async () => {
      // Create initial table without foreign key
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

      // Insert some data
      await noormme.execute(`
        INSERT INTO users (name) VALUES ('Alice'), ('Bob')
      `)

      await noormme.execute(`
        INSERT INTO posts (title, user_id) VALUES 
        ('Post 1', 1),
        ('Post 2', 1),
        ('Post 3', 2)
      `)

      // To add foreign key, we need to recreate the table
      const originalData = await noormme.execute('SELECT * FROM posts ORDER BY id')

      // Create new table with foreign key
      await noormme.execute(`
        CREATE TABLE posts_new (
          id INTEGER PRIMARY KEY,
          title TEXT NOT NULL,
          user_id INTEGER,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `)

      // Copy data
      await noormme.execute(`
        INSERT INTO posts_new (id, title, user_id)
        SELECT id, title, user_id FROM posts
      `)

      // Drop old table and rename new one
      await noormme.execute('DROP TABLE posts')
      await noormme.execute('ALTER TABLE posts_new RENAME TO posts')

      // Verify foreign key was added
      const foreignKeys = await noormme.execute('PRAGMA foreign_key_list(posts)')
      expect(foreignKeys).to.have.length(1)

      // Verify data was preserved
      const migratedData = await noormme.execute('SELECT * FROM posts ORDER BY id')
      expect(migratedData).to.deep.equal(originalData)
    })

    it('should demonstrate application-level foreign key enforcement', async () => {
      // Create tables without foreign keys
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

      // Application-level foreign key validation
      async function insertPost(title: string, userId: number) {
        // Check if user exists
        const user = await noormme.execute('SELECT id FROM users WHERE id = ?', [userId])
        if (user.length === 0) {
          throw new Error(`User with id ${userId} does not exist`)
        }

        // Insert post
        await noormme.execute(`
          INSERT INTO posts (title, user_id) VALUES (?, ?)
        `, [title, userId])
      }

      // Insert user
      await noormme.execute(`
        INSERT INTO users (name) VALUES ('Alice')
      `)

      // Valid insert
      await expect(insertPost('Valid Post', 1)).to.not.be.rejected

      // Invalid insert
      await expect(insertPost('Invalid Post', 999)).to.be.rejectedWith('User with id 999 does not exist')

      // Verify only valid post was inserted
      const posts = await noormme.execute('SELECT * FROM posts')
      expect(posts).to.have.length(1)
      expect(posts[0].title).to.equal('Valid Post')
    })
  })

  describe('Performance Impact of Foreign Key Constraints', () => {
    it('should measure performance with and without foreign keys', async () => {
      // Test without foreign keys
      await noormme.execute('DROP TABLE IF EXISTS posts_no_fk')
      await noormme.execute('DROP TABLE IF EXISTS users_no_fk')

      await noormme.execute(`
        CREATE TABLE users_no_fk (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `)

      await noormme.execute(`
        CREATE TABLE posts_no_fk (
          id INTEGER PRIMARY KEY,
          title TEXT NOT NULL,
          user_id INTEGER
        )
      `)

      // Insert test data without foreign keys
      const startTimeNoFK = Date.now()
      
      await noormme.execute(`
        INSERT INTO users_no_fk (name) VALUES 
        ${Array(100).fill(0).map((_, i) => `('User ${i}')`).join(', ')}
      `)

      await noormme.execute(`
        INSERT INTO posts_no_fk (title, user_id) VALUES 
        ${Array(1000).fill(0).map((_, i) => `('Post ${i}', ${(i % 100) + 1})`).join(', ')}
      `)

      const durationNoFK = Date.now() - startTimeNoFK

      // Test with foreign keys
      await noormme.execute('DROP TABLE IF EXISTS posts_with_fk')
      await noormme.execute('DROP TABLE IF EXISTS users_with_fk')

      await noormme.execute(`
        CREATE TABLE users_with_fk (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `)

      await noormme.execute(`
        CREATE TABLE posts_with_fk (
          id INTEGER PRIMARY KEY,
          title TEXT NOT NULL,
          user_id INTEGER,
          FOREIGN KEY (user_id) REFERENCES users_with_fk(id)
        )
      `)

      // Insert test data with foreign keys
      const startTimeWithFK = Date.now()
      
      await noormme.execute(`
        INSERT INTO users_with_fk (name) VALUES 
        ${Array(100).fill(0).map((_, i) => `('User ${i}')`).join(', ')}
      `)

      await noormme.execute(`
        INSERT INTO posts_with_fk (title, user_id) VALUES 
        ${Array(1000).fill(0).map((_, i) => `('Post ${i}', ${(i % 100) + 1})`).join(', ')}
      `)

      const durationWithFK = Date.now() - startTimeWithFK

      console.log(`Performance without foreign keys: ${durationNoFK}ms`)
      console.log(`Performance with foreign keys: ${durationWithFK}ms`)
      
      // Foreign keys should add some overhead but not be dramatically slower
      expect(durationWithFK).to.be.greaterThan(durationNoFK)
      expect(durationWithFK).to.be.lessThan(durationNoFK * 3) // Should not be more than 3x slower
    })
  })
})
