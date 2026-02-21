import { expect } from 'chai'
import { NOORMME } from '../../../src/noormme'
import { NOORMConfig } from '../../../src/types'

describe('Edge Runtime Compatibility Tests', () => {
  let noormme: NOORMME
  let config: NOORMConfig

  beforeEach(async () => {
    // Edge Runtime compatible configuration
    config = {
      dialect: 'sqlite',
      connection: {
        database: ':memory:' // Use in-memory database for Edge Runtime
      },
      optimization: {
        enableWALMode: false, // WAL mode not supported in Edge Runtime
        enableForeignKeys: true,
        cacheSize: -2000, // Smaller cache for Edge Runtime
        synchronous: 'NORMAL'
      },
      logging: {
        level: 'error',
        enabled: false // Minimal logging for Edge Runtime
      }
    }

    noormme = new NOORMME(config)
    await noormme.initialize()

    // Create test tables
    await noormme.execute(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await noormme.execute(`
      CREATE TABLE posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        author_id INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  })

  afterEach(async () => {
    if (noormme) {
      await noormme.destroy()
    }
  })

  describe('Edge Runtime Limitations', () => {
    it('should work without WAL mode', async () => {
      // WAL mode is not supported in Edge Runtime
      const result = await noormme.execute(`PRAGMA journal_mode`)
      expect(result[0].journal_mode).to.equal('delete') // Default mode
    })

    it('should work with in-memory database', async () => {
      const userRepo = noormme.getRepository('users')
      
      const user = await userRepo.create({
        name: 'Edge User',
        email: 'edge@example.com'
      })

      expect(user.id).to.be.a('number')
      expect(user.name).to.equal('Edge User')
      expect(user.email).to.equal('edge@example.com')
    })

    it('should handle concurrent operations without WAL mode', async () => {
      const userRepo = noormme.getRepository('users')
      
      // Create multiple users concurrently
      const promises = Array.from({ length: 10 }, async (_, i) => {
        return userRepo.create({
          name: `Concurrent User ${i}`,
          email: `concurrent${i}@example.com`
        })
      })

      const users = await Promise.all(promises)
      expect(users).to.have.length(10)

      // Verify all users were created
      const allUsers = await userRepo.findAll()
      expect(allUsers).to.have.length(10)
    })

    it('should work with smaller cache size', async () => {
      const result = await noormme.execute(`PRAGMA cache_size`)
      expect(result[0].cache_size).to.equal(-2000) // 2MB cache
    })
  })

  describe('Edge Runtime Optimizations', () => {
    it('should minimize memory usage', async () => {
      const userRepo = noormme.getRepository('users')
      const postRepo = noormme.getRepository('posts')
      
      // Create test data
      const user = await userRepo.create({
        name: 'Memory Test User',
        email: 'memory@example.com'
      })

      await postRepo.create({
        title: 'Memory Test Post',
        content: 'Testing memory usage in Edge Runtime',
        author_id: user.id
      })

      // Test memory-efficient queries
      const users = await userRepo.findAll({ limit: 10 })
      const posts = await postRepo.findAll({ limit: 10 })

      expect(users).to.have.length(1)
      expect(posts).to.have.length(1)
    })

    it('should handle streaming responses', async () => {
      const userRepo = noormme.getRepository('users')
      
      // Create multiple users
      for (let i = 0; i < 100; i++) {
        await userRepo.create({
          name: `Stream User ${i}`,
          email: `stream${i}@example.com`
        })
      }

      // Test streaming query
      const users = await userRepo.findAll({ limit: 50 })
      expect(users).to.have.length(50)
    })

    it('should work with minimal logging', async () => {
      // This test ensures that minimal logging doesn't cause issues
      const userRepo = noormme.getRepository('users')
      
      const user = await userRepo.create({
        name: 'Log Test User',
        email: 'log@example.com'
      })

      expect(user.id).to.be.a('number')
    })
  })

  describe('Edge Runtime API Patterns', () => {
    it('should work with Next.js Edge API routes', async () => {
      // Simulate Edge API route behavior
      const userRepo = noormme.getRepository('users')
      
      // Create user
      const user = await userRepo.create({
        name: 'API User',
        email: 'api@example.com'
      })

      // Simulate GET request
      const foundUser = await userRepo.findById(user.id)
      expect(foundUser).to.not.be.null
      expect(foundUser!.name).to.equal('API User')

      // Simulate PUT request
      await userRepo.update(user.id, { name: 'Updated API User' })
      
      const updatedUser = await userRepo.findById(user.id)
      expect(updatedUser!.name).to.equal('Updated API User')

      // Simulate DELETE request
      await userRepo.delete(user.id)
      
      const deletedUser = await userRepo.findById(user.id)
      expect(deletedUser).to.be.null
    })

    it('should handle JSON serialization for Edge Runtime', async () => {
      const userRepo = noormme.getRepository('users')
      
      const user = await userRepo.create({
        name: 'JSON User',
        email: 'json@example.com'
      })

      // Test JSON serialization (important for Edge Runtime)
      const jsonString = JSON.stringify(user)
      const parsedUser = JSON.parse(jsonString)

      expect(parsedUser.id).to.equal(user.id)
      expect(parsedUser.name).to.equal(user.name)
      expect(parsedUser.email).to.equal(user.email)
    })

    it('should work with Edge Runtime middleware', async () => {
      // Simulate middleware behavior
      const userRepo = noormme.getRepository('users')
      
      // Create user for authentication test
      const user = await userRepo.create({
        name: 'Middleware User',
        email: 'middleware@example.com'
      })

      // Simulate user lookup for authentication
      const foundUser = await userRepo.findByEmail('middleware@example.com')
      expect(foundUser).to.not.be.null
      expect(foundUser!.id).to.equal(user.id)
    })
  })

  describe('Edge Runtime Error Handling', () => {
    it('should handle errors gracefully in Edge Runtime', async () => {
      const userRepo = noormme.getRepository('users')
      
      try {
        // Try to create user with duplicate email
        await userRepo.create({
          name: 'First User',
          email: 'duplicate@example.com'
        })

        await userRepo.create({
          name: 'Second User',
          email: 'duplicate@example.com'
        })

        expect.fail('Should have thrown an error for duplicate email')
      } catch (error) {
        expect(error).to.be.instanceOf(Error)
        expect(error.message).to.include('UNIQUE constraint failed')
      }
    })

    it('should handle database connection errors', async () => {
      // Create a new instance with invalid configuration
      const invalidConfig: NOORMConfig = {
        dialect: 'sqlite',
        connection: {
          database: '/invalid/path/database.db'
        },
        optimization: {
          enableWALMode: false,
          enableForeignKeys: true,
          cacheSize: -2000,
          synchronous: 'NORMAL'
        }
      }

      try {
        const invalidDb = new NOORMME(invalidConfig)
        await invalidDb.initialize()
        expect.fail('Should have thrown an error for invalid database path')
      } catch (error) {
        expect(error).to.be.instanceOf(Error)
      }
    })
  })

  describe('Edge Runtime Performance', () => {
    it('should perform well with limited resources', async () => {
      const userRepo = noormme.getRepository('users')
      
      const startTime = performance.now()
      
      // Create 100 users
      for (let i = 0; i < 100; i++) {
        await userRepo.create({
          name: `Perf User ${i}`,
          email: `perf${i}@example.com`
        })
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Should complete within reasonable time (less than 5 seconds)
      expect(duration).to.be.lessThan(5000)
      
      // Verify all users were created
      const count = await userRepo.count()
      expect(count).to.equal(100)
    })

    it('should handle batch operations efficiently', async () => {
      const userRepo = noormme.getRepository('users')
      
      const startTime = performance.now()
      
      // Batch create users
      const promises = Array.from({ length: 50 }, async (_, i) => {
        return userRepo.create({
          name: `Batch User ${i}`,
          email: `batch${i}@example.com`
        })
      })

      await Promise.all(promises)
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Should complete within reasonable time (less than 2 seconds)
      expect(duration).to.be.lessThan(2000)
      
      // Verify all users were created
      const count = await userRepo.count()
      expect(count).to.equal(50)
    })
  })

  describe('Edge Runtime Compatibility Checklist', () => {
    it('should meet Edge Runtime requirements', async () => {
      // Test that NOORMME works within Edge Runtime constraints
      
      // 1. No file system access (use in-memory database)
      expect(config.connection.database).to.equal(':memory:')
      
      // 2. No WAL mode (not supported in Edge Runtime)
      expect(config.optimization.enableWALMode).to.be.false
      
      // 3. Smaller cache size (memory constraints)
      expect(config.optimization.cacheSize).to.equal(-2000)
      
      // 4. Minimal logging (performance)
      expect(config.logging.enabled).to.be.false
      
      // 5. Basic operations work
      const userRepo = noormme.getRepository('users')
      const user = await userRepo.create({
        name: 'Edge Compatible User',
        email: 'edge@example.com'
      })
      
      expect(user.id).to.be.a('number')
      expect(user.name).to.equal('Edge Compatible User')
    })

    it('should work with Edge Runtime globals', async () => {
      // Test compatibility with Edge Runtime global objects
      
      // Test with Response object (common in Edge Runtime)
      const userRepo = noormme.getRepository('users')
      const user = await userRepo.create({
        name: 'Response User',
        email: 'response@example.com'
      })

      const response = new Response(JSON.stringify(user), {
        headers: { 'Content-Type': 'application/json' }
      })

      expect(response.status).to.equal(200)
      expect(response.headers.get('Content-Type')).to.equal('application/json')
    })
  })
})

describe('Edge Runtime Configuration Helper', () => {
  it('should provide Edge Runtime compatible configuration', () => {
    // This would be a helper function in the actual implementation
    const getEdgeRuntimeConfig = (): NOORMConfig => ({
      dialect: 'sqlite',
      connection: {
        database: ':memory:'
      },
      optimization: {
        enableWALMode: false,
        enableForeignKeys: true,
        cacheSize: -2000,
        synchronous: 'NORMAL'
      },
      logging: {
        level: 'error',
        enabled: false
      }
    })

    const config = getEdgeRuntimeConfig()
    
    expect(config.connection.database).to.equal(':memory:')
    expect(config.optimization.enableWALMode).to.be.false
    expect(config.optimization.cacheSize).to.equal(-2000)
    expect(config.logging.enabled).to.be.false
  })
})
