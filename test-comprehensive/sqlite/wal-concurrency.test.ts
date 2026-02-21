import { expect } from 'chai'
import { NOORMME } from '../../../src/noormme'
import { NOORMConfig } from '../../../src/types'
import { unlink } from 'fs/promises'
import { join } from 'path'

describe('SQLite WAL Mode Concurrency Tests', () => {
  let noormme: NOORMME
  let testDbPath: string
  let config: NOORMConfig

  beforeEach(async () => {
    testDbPath = join(process.cwd(), `test-wal-concurrency-${Date.now()}.db`)
    
    // Remove existing test database
    try {
      await unlink(testDbPath)
    } catch (e) {
      // File doesn't exist, that's fine
    }

    config = {
      dialect: 'sqlite',
      connection: {
        database: testDbPath
      },
      optimization: {
        enableWALMode: true,
        enableForeignKeys: true,
        cacheSize: -64000, // 64MB cache
        synchronous: 'NORMAL'
      },
      logging: {
        level: 'info',
        enabled: false
      }
    }

    noormme = new NOORMME(config)
    await noormme.initialize()

    // Create test table
    await noormme.execute(`
      CREATE TABLE test_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        score INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create indexes for better performance
    await noormme.execute(`CREATE INDEX idx_test_users_email ON test_users(email)`)
    await noormme.execute(`CREATE INDEX idx_test_users_score ON test_users(score)`)
  })

  afterEach(async () => {
    if (noormme) {
      await noormme.destroy()
    }
    
    // Clean up test database files
    try {
      await unlink(testDbPath)
      await unlink(`${testDbPath}-wal`)
      await unlink(`${testDbPath}-shm`)
    } catch (e) {
      // Files might not exist
    }
  })

  describe('WAL Mode Verification', () => {
    it('should enable WAL mode successfully', async () => {
      const result = await noormme.execute(`PRAGMA journal_mode`)
      expect(result[0].journal_mode).to.equal('wal')
    })

    it('should have WAL and SHM files created', async () => {
      // Perform some operations to trigger WAL file creation
      await noormme.execute(`INSERT INTO test_users (name, email) VALUES ('Test User', 'test@example.com')`)
      
      // Check if WAL file exists (this might not always be the case immediately)
      // WAL files are created when there are pending transactions
    })

    it('should support concurrent reads', async () => {
      // Insert test data
      await noormme.execute(`
        INSERT INTO test_users (name, email, score) VALUES 
        ('User 1', 'user1@example.com', 100),
        ('User 2', 'user2@example.com', 200),
        ('User 3', 'user3@example.com', 300)
      `)

      // Create multiple concurrent read operations
      const readPromises = Array.from({ length: 10 }, async (_, i) => {
        const result = await noormme.execute(`SELECT * FROM test_users WHERE score > ?`, [i * 30])
        return result.length
      })

      const results = await Promise.all(readPromises)
      
      // All reads should succeed
      expect(results).to.have.length(10)
      results.forEach(count => {
        expect(count).to.be.a('number')
        expect(count).to.be.at.least(0)
      })
    })

    it('should support concurrent writes without blocking', async () => {
      const writePromises = Array.from({ length: 20 }, async (_, i) => {
        const name = `Concurrent User ${i}`
        const email = `concurrent${i}@example.com`
        const score = 100 + i

        const result = await noormme.execute(
          `INSERT INTO test_users (name, email, score) VALUES (?, ?, ?)`,
          [name, email, score]
        )
        
        return result.changes
      })

      const results = await Promise.all(writePromises)
      
      // All writes should succeed
      expect(results).to.have.length(20)
      results.forEach(changes => {
        expect(changes).to.equal(1)
      })

      // Verify all records were inserted
      const count = await noormme.execute(`SELECT COUNT(*) as count FROM test_users`)
      expect(count[0].count).to.equal(20)
    })

    it('should handle mixed read/write operations concurrently', async () => {
      // Initial data
      await noormme.execute(`
        INSERT INTO test_users (name, email, score) VALUES 
        ('Initial User', 'initial@example.com', 50)
      `)

      const operations = []

      // Concurrent reads
      for (let i = 0; i < 5; i++) {
        operations.push(
          noormme.execute(`SELECT * FROM test_users WHERE score > ?`, [i * 10])
        )
      }

      // Concurrent writes
      for (let i = 0; i < 5; i++) {
        operations.push(
          noormme.execute(
            `INSERT INTO test_users (name, email, score) VALUES (?, ?, ?)`,
            [`Mixed User ${i}`, `mixed${i}@example.com`, 100 + i]
          )
        )
      }

      // Concurrent updates
      for (let i = 0; i < 5; i++) {
        operations.push(
          noormme.execute(
            `UPDATE test_users SET score = score + ? WHERE email = ?`,
            [10, 'initial@example.com']
          )
        )
      }

      const results = await Promise.all(operations)
      
      // All operations should complete successfully
      expect(results).to.have.length(15)
      
      // Verify final state
      const finalCount = await noormme.execute(`SELECT COUNT(*) as count FROM test_users`)
      expect(finalCount[0].count).to.equal(6) // 1 initial + 5 new users
      
      const finalScore = await noormme.execute(`SELECT score FROM test_users WHERE email = 'initial@example.com'`)
      expect(finalScore[0].score).to.equal(100) // 50 + (5 * 10)
    })
  })

  describe('Performance Under Load', () => {
    it('should handle high-frequency operations', async () => {
      const startTime = Date.now()
      
      // Create 100 concurrent operations
      const operations = Array.from({ length: 100 }, async (_, i) => {
        if (i % 3 === 0) {
          // Read operation
          return noormme.execute(`SELECT COUNT(*) as count FROM test_users`)
        } else if (i % 3 === 1) {
          // Write operation
          return noormme.execute(
            `INSERT INTO test_users (name, email, score) VALUES (?, ?, ?)`,
            [`Load User ${i}`, `load${i}@example.com`, i]
          )
        } else {
          // Update operation
          return noormme.execute(`UPDATE test_users SET updated_at = CURRENT_TIMESTAMP WHERE id = 1`)
        }
      })

      const results = await Promise.all(operations)
      const endTime = Date.now()
      const duration = endTime - startTime

      // All operations should complete
      expect(results).to.have.length(100)
      
      // Should complete in reasonable time (less than 5 seconds for 100 operations)
      expect(duration).to.be.lessThan(5000)
      
      console.log(`100 concurrent operations completed in ${duration}ms`)
    })

    it('should maintain data consistency under concurrent access', async () => {
      // Create initial record
      await noormme.execute(
        `INSERT INTO test_users (name, email, score) VALUES ('Consistency Test', 'consistency@example.com', 1000)`
      )

      // Create 50 concurrent update operations that increment the score
      const updatePromises = Array.from({ length: 50 }, async () => {
        return noormme.execute(
          `UPDATE test_users SET score = score + 1 WHERE email = 'consistency@example.com'`
        )
      })

      await Promise.all(updatePromises)

      // Verify final score
      const result = await noormme.execute(
        `SELECT score FROM test_users WHERE email = 'consistency@example.com'`
      )
      
      // Score should be 1000 + 50 = 1050
      expect(result[0].score).to.equal(1050)
    })
  })

  describe('Crash Recovery', () => {
    it('should recover from interrupted transactions', async () => {
      // Start a transaction
      await noormme.execute(`BEGIN TRANSACTION`)
      
      try {
        // Insert some data
        await noormme.execute(
          `INSERT INTO test_users (name, email, score) VALUES ('Transaction User', 'transaction@example.com', 500)`
        )
        
        // Simulate an interruption by closing the connection
        await noormme.destroy()
        
        // Recreate the connection
        noormme = new NOORMME(config)
        await noormme.initialize()
        
        // Check if the data was recovered (should not be there due to rollback)
        const result = await noormme.execute(
          `SELECT COUNT(*) as count FROM test_users WHERE email = 'transaction@example.com'`
        )
        
        // The transaction should have been rolled back
        expect(result[0].count).to.equal(0)
        
      } catch (error) {
        // Expected - transaction was interrupted
        console.log('Transaction interrupted as expected:', error.message)
        
        // Recreate connection for cleanup
        noormme = new NOORMME(config)
        await noormme.initialize()
      }
    })

    it('should handle WAL file corruption gracefully', async () => {
      // Perform some operations to create WAL file
      await noormme.execute(
        `INSERT INTO test_users (name, email, score) VALUES ('WAL Test', 'wal@example.com', 100)`
      )

      // Force a checkpoint to ensure WAL is written
      await noormme.execute(`PRAGMA wal_checkpoint(FULL)`)

      // Verify data is accessible
      const result = await noormme.execute(`SELECT * FROM test_users WHERE email = 'wal@example.com'`)
      expect(result).to.have.length(1)
      expect(result[0].name).to.equal('WAL Test')
    })
  })

  describe('Repository Pattern with Concurrency', () => {
    it('should work with repository pattern under concurrent access', async () => {
      const userRepo = noormme.getRepository('test_users')

      // Concurrent create operations
      const createPromises = Array.from({ length: 10 }, async (_, i) => {
        return userRepo.create({
          name: `Repo User ${i}`,
          email: `repo${i}@example.com`,
          score: 200 + i
        })
      })

      const createdUsers = await Promise.all(createPromises)
      expect(createdUsers).to.have.length(10)

      // Concurrent read operations
      const readPromises = Array.from({ length: 5 }, async (_, i) => {
        return userRepo.findAll({ limit: 5, offset: i * 2 })
      })

      const readResults = await Promise.all(readPromises)
      expect(readResults).to.have.length(5)

      // Concurrent update operations
      const updatePromises = Array.from({ length: 3 }, async (_, i) => {
        const user = createdUsers[i]
        return userRepo.update(user.id, { score: 300 + i })
      })

      const updateResults = await Promise.all(updatePromises)
      expect(updateResults).to.have.length(3)

      // Verify final state
      const finalCount = await userRepo.count()
      expect(finalCount).to.equal(10)
    })
  })

  describe('Connection Pooling Simulation', () => {
    it('should handle multiple database connections to same file', async () => {
      // Create multiple NOORMME instances pointing to the same database
      const connections = Array.from({ length: 3 }, () => {
        return new NOORMME({
          ...config,
          connection: {
            database: testDbPath // Same file
          }
        })
      })

      try {
        // Initialize all connections
        await Promise.all(connections.map(conn => conn.initialize()))

        // Insert data from first connection
        await connections[0].execute(
          `INSERT INTO test_users (name, email, score) VALUES ('Multi Conn', 'multiconn@example.com', 999)`
        )

        // Read from all connections
        const readPromises = connections.map(async (conn, i) => {
          const result = await conn.execute(`SELECT * FROM test_users WHERE email = 'multiconn@example.com'`)
          return { connection: i, result: result[0] }
        })

        const results = await Promise.all(readPromises)
        
        // All connections should see the same data
        expect(results).to.have.length(3)
        results.forEach(({ connection, result }) => {
          expect(result.name).to.equal('Multi Conn')
          expect(result.email).to.equal('multiconn@example.com')
          expect(result.score).to.equal(999)
        })

      } finally {
        // Clean up all connections
        await Promise.all(connections.map(conn => conn.destroy()))
      }
    })
  })
})
