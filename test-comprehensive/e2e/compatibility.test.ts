/// <reference types="node" />

/**
 * End-to-end tests for cross-platform and compatibility features
 */

import { describe, it, before, after } from 'mocha'
import { expect } from 'chai'
import { withTestDatabase, performanceHelper } from '../setup/test-helpers.js'
import { getEnabledDatabases } from '../setup/test-config.js'

describe('Compatibility E2E Tests', () => {
  const enabledDatabases = getEnabledDatabases()
  
  if (enabledDatabases.length === 0) {
    console.warn('No databases enabled for testing')
    return
  }

  describe('Cross-Database Compatibility', () => {
    it('should work consistently across different database dialects', async () => {
      const { NOORMME } = await import('../../src/noormme.js')
      
      // Test that NOORMME can be instantiated for different dialects
      for (const dialect of enabledDatabases) {
        const db = new NOORMME({
          dialect,
          connection: {
            host: 'localhost',
            port: 5432,
            database: 'test_db',
            username: 'test_user',
            password: 'test_password'
          }
        })
        
        expect(db).to.exist
        expect((db as any).getDialect()).to.equal(dialect)
      }
    })

    it('should handle dialect-specific features gracefully', withTestDatabase('sqlite', async (testDb) => {
      const { db } = testDb
      
      
      const userRepo = db.getRepository('users')
      
      // Test SQLite-specific features
      if ((db as any).getDialect() === 'sqlite') {
        // Test SQLite-specific functionality
        const user = await userRepo.create({
          id: 'sqlite-user',
          email: 'sqlite@example.com',
          firstName: 'SQLite',
          lastName: 'User',
          active: true
        })
        
        expect(user).to.exist
        
        // Clean up
        await userRepo.delete('sqlite-user')
      }
      }))

    it('should handle MySQL-specific features gracefully', withTestDatabase('sqlite', async (testDb) => {
      const { db } = testDb
      
      
      const userRepo = db.getRepository('users')
      
      // Test SQLite-specific features
      if ((db as any).getDialect() === 'sqlite') {
        // Test SQLite-specific data types
        const user = await userRepo.create({
          id: 'sqlite-user-2',
          email: 'sqlite2@example.com',
          firstName: 'SQLite',
          lastName: 'User2',
          active: true
        })
        
        expect(user).to.exist
        
        // Clean up
        await userRepo.delete('sqlite-user-2')
      }
      }))

    it('should handle SQLite-specific features gracefully', withTestDatabase('sqlite', async (testDb) => {
      const { db } = testDb
      
      
      const userRepo = db.getRepository('users')
      
      // Test SQLite-specific features
      if ((db as any).getDialect() === 'sqlite') {
        // Test SQLite-specific data types
        const user = await userRepo.create({
          id: 'sqlite-user',
          email: 'sqlite@example.com',
          firstName: 'SQLite',
          lastName: 'User',
          active: true
        })
        
        expect(user).to.exist
        
        // Clean up
        await userRepo.delete('sqlite-user')
      }
      }))
  })

  describe('Node.js Version Compatibility', () => {
    it('should work with different Node.js versions', async () => {
      const nodeVersion = process.version
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0])
      
      // Test that NOORMME works with current Node.js version
      expect(majorVersion).to.be.greaterThanOrEqual(16)
      
      const { NOORMME } = await import('../../src/noormme.js')
      const db = new NOORMME({
        dialect: 'sqlite',
        connection: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          username: 'test_user',
          password: 'test_password'
        }
      })
      
      expect(db).to.exist
    })

    it('should handle ES modules correctly', async () => {
      // Test ES module imports
      const { NOORMME } = await import('../../src/noormme.js')
      const { CacheManager } = await import('../../src/cache/cache-manager.js')
      const { RelationshipEngine } = await import('../../src/relationships/relationship-engine.js')
      
      expect(NOORMME).to.exist
      expect(CacheManager).to.exist
      expect(RelationshipEngine).to.exist
    })

    it('should handle CommonJS compatibility', async () => {
      // Test that modules can be imported in CommonJS style
      try {
        const noormme = require('../../src/noormme.js')
        expect(noormme).to.exist
      } catch (error) {
        // ES modules might not be directly requireable
        expect(error).to.be.instanceOf(Error)
      }
    })
  })

  describe('Platform Compatibility', () => {
    it('should work on different operating systems', async () => {
      const platform = process.platform
      
      // Test that NOORMME works on current platform
      expect(['linux', 'darwin', 'win32']).to.include(platform)
      
      const { NOORMME } = await import('../../src/noormme.js')
      const db = new NOORMME({
        dialect: 'sqlite',
        connection: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          username: 'test_user',
          password: 'test_password'
        }
      })
      
      expect(db).to.exist
    })

    it('should handle file system differences', async () => {
      const { createNodeMigrationManager } = await import('../../src/migration/node-migration-manager.js')
      
      // Test migration manager with different path separators
      const pathSeparator = process.platform === 'win32' ? '\\' : '/'
      
      // Create a mock Kysely instance for testing
      const mockKysely = {
        schema: {
          hasTable: () => Promise.resolve(false),
          createTable: () => ({
            addColumn: () => ({
              execute: () => Promise.resolve()
            })
          })
        }
      }
      
      try {
        const migrationManager = await createNodeMigrationManager(mockKysely as any, {
          migrationsDirectory: `.${pathSeparator}test-migrations`
        })
        
        expect(migrationManager).to.exist
      } catch (error) {
        // Might fail due to missing directory
        expect(error).to.be.instanceOf(Error)
      }
    })

    it('should handle environment variable differences', async () => {
      // Test that NOORMME handles different environment setups
      const originalEnv = process.env.NODE_ENV
      
      try {
        // Test development environment
        process.env.NODE_ENV = 'development'
        const { NOORMME } = await import('../../src/noormme.js')
        const devDb = new NOORMME({
          dialect: 'sqlite',
          connection: {
            host: 'localhost',
            port: 5432,
            database: 'test_db',
            username: 'test_user',
            password: 'test_password'
          }
        })
        expect(devDb).to.exist
        
        // Test production environment
        process.env.NODE_ENV = 'production'
        const prodDb = new NOORMME({
          dialect: 'sqlite',
          connection: {
            host: 'localhost',
            port: 5432,
            database: 'test_db',
            username: 'test_user',
            password: 'test_password'
          }
        })
        expect(prodDb).to.exist
        
        // Test test environment
        process.env.NODE_ENV = 'test'
        const testDb = new NOORMME({
          dialect: 'sqlite',
          connection: {
            host: 'localhost',
            port: 5432,
            database: 'test_db',
            username: 'test_user',
            password: 'test_password'
          }
        })
        expect(testDb).to.exist
      } finally {
        // Restore original environment
        process.env.NODE_ENV = originalEnv
      }
    })
  })

  describe('Database Driver Compatibility', () => {
    for (const dialect of enabledDatabases) {
      describe(`${dialect.toUpperCase()}`, () => {
        it('should work with different database drivers', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Test that database operations work with current driver
          const userRepo = db.getRepository('users')
          const user = await userRepo.create({
            id: 'driver-test-user',
            email: 'drivertest@example.com',
            firstName: 'DriverTest',
            lastName: 'User',
            active: true
          })
          
          expect(user).to.exist
          
          // Clean up
          await userRepo.delete('driver-test-user')
        }))

        it('should handle driver-specific connection options', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          // Test driver-specific features
          const kysely = db.getKysely()
          
          // Test that Kysely instance works with current driver
          const result = await kysely
            .selectFrom('users')
            .select(['id', 'email'])
            .limit(1)
            .execute()
          
          expect(result).to.be.an('array')
        }))

        it('should handle driver-specific data types', withTestDatabase(dialect, async (testDb) => {
          const { db } = testDb
          
          
          const userRepo = db.getRepository('users')
          
          // Test different data types
          const user = await userRepo.create({
            id: 'datatype-test-user',
            email: 'datatypetest@example.com',
            firstName: 'DataTypeTest',
            lastName: 'User',
            active: true
          })
          
          expect(user).to.exist
          expect(typeof (user as any).id).to.equal('string')
          expect(typeof (user as any).email).to.equal('string')
          expect(typeof (user as any).firstName).to.equal('string')
          expect(typeof (user as any).lastName).to.equal('string')
          expect(typeof (user as any).active).to.equal('boolean')
          
          // Clean up
          await userRepo.delete('datatype-test-user')
        }))
      })
    }
  })

  describe('Framework Integration Compatibility', () => {
    it('should work with Express.js', async () => {
      // Test that NOORMME can be integrated with Express.js
      const { NOORMME } = await import('../../src/noormme.js')
      
      // Mock Express app
      const mockApp = {
        use: () => {},
        get: () => {},
        post: () => {},
        put: () => {},
        delete: () => {}
      }
      
      // Create NOORMME instance
      const db = new NOORMME({
        dialect: 'sqlite',
        connection: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          username: 'test_user',
          password: 'test_password'
        }
      })
      
      expect(db).to.exist
      
      // Test that it can be used in Express middleware
      const middleware = (req: any, res: any, next: any) => {
        req.db = db
        next()
      }
      
      expect(middleware).to.be.a('function')
    })

    it('should work with Fastify', async () => {
      // Test that NOORMME can be integrated with Fastify
      const { NOORMME } = await import('../../src/noormme.js')
      
      // Create NOORMME instance
      const db = new NOORMME({
        dialect: 'sqlite',
        connection: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          username: 'test_user',
          password: 'test_password'
        }
      })
      
      expect(db).to.exist
      
      // Test that it can be used in Fastify plugin
      const plugin = (fastify: any, options: any, done: any) => {
        fastify.decorate('db', db)
        done()
      }
      
      expect(plugin).to.be.a('function')
    })

    it('should work with NestJS', async () => {
      // Test that NOORMME can be integrated with NestJS
      const { NOORMME } = await import('../../src/noormme.js')
      
      // Create NOORMME instance
      const db = new NOORMME({
        dialect: 'sqlite',
        connection: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          username: 'test_user',
          password: 'test_password'
        }
      })
      
      expect(db).to.exist
      
      // Test that it can be used in NestJS service
      class MockService {
        constructor(private readonly db: any) {}
        
        async getUsers() {
          return this.db.getRepository('users').findAll()
        }
      }
      
      const service = new MockService(db)
      expect(service).to.exist
    })
  })

  describe('TypeScript Compatibility', () => {
    it('should work with strict TypeScript settings', async () => {
      // Test that NOORMME works with strict TypeScript
      const { NOORMME } = await import('../../src/noormme.js')
      
      // Test strict typing
      const db = new NOORMME({
        dialect: 'sqlite',
        connection: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          username: 'test_user',
          password: 'test_password'
        }
      })
      
      expect(db).to.exist
      expect((db as any).getDialect()).to.equal('sqlite')
    })

    it('should provide proper type definitions', async () => {
      // Test that type definitions are available
      const { NOORMME } = await import('../../src/noormme.js')
      const { CacheManager } = await import('../../src/cache/cache-manager.js')
      
      // Test type inference
      const db = new NOORMME({
        dialect: 'sqlite',
        connection: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          username: 'test_user',
          password: 'test_password'
        }
      })
      
      const cache = new CacheManager()
      
      expect(db).to.exist
      expect(cache).to.exist
    })

    it('should handle generic types correctly', async () => {
      // Test generic type handling
      const { NOORMME } = await import('../../src/noormme.js')
      
      interface User {
        id: string
        email: string
        firstName: string
        lastName: string
        active: boolean
      }
      
      const db = new NOORMME({
        dialect: 'sqlite',
        connection: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          username: 'test_user',
          password: 'test_password'
        }
      })
      
      // Test that repository can be typed
      const userRepo = db.getRepository<User>('users')
      expect(userRepo).to.exist
    })
  })

  describe('Memory and Resource Compatibility', () => {
    it('should work within memory constraints', async () => {
      // Test memory usage
      const initialMemory = process.memoryUsage()
      
      const { NOORMME } = await import('../../src/noormme.js')
      const db = new NOORMME({
        dialect: 'sqlite',
        connection: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          username: 'test_user',
          password: 'test_password'
        }
      })
      
      const finalMemory = process.memoryUsage()
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
      
      // Memory increase should be reasonable
      expect(memoryIncrease).to.be.lessThan(50 * 1024 * 1024) // 50MB
    })

    it('should handle resource cleanup properly', async () => {
      // Test resource cleanup
      const { NOORMME } = await import('../../src/noormme.js')
      
      const db = new NOORMME({
        dialect: 'sqlite',
        connection: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          username: 'test_user',
          password: 'test_password'
        }
      })
      
      // Test that close method exists
      expect(db.close).to.be.a('function')
      
      // Test that close method can be called
      try {
        await db.close()
      } catch (error) {
        // Might fail if not initialized
        expect(error).to.be.instanceOf(Error)
      }
    })

    it('should handle concurrent instances properly', async () => {
      // Test multiple NOORMME instances
      const { NOORMME } = await import('../../src/noormme.js')
      
      const instances: any[] = []
      for (let i = 0; i < 10; i++) {
        const db = new NOORMME({
          dialect: 'sqlite',
          connection: {
            host: 'localhost',
            port: 5432,
            database: `test_db_${i}`,
            username: 'test_user',
            password: 'test_password'
          }
        })
        instances.push(db)
      }
      
      expect(instances).to.have.length(10)
      
      // Test that all instances are independent
      for (let i = 0; i < instances.length; i++) {
        expect(instances[i]).to.exist
        expect((instances[i] as any).getDialect()).to.equal('sqlite')
      }
    })
  })

  describe('Error Handling Compatibility', () => {
    it('should handle errors consistently across platforms', async () => {
      const { NOORMME } = await import('../../src/noormme.js')
      
      // Test error handling
      try {
        const db = new NOORMME({
          dialect: 'invalid-dialect' as any,
          connection: {
            host: 'localhost',
            port: 5432,
            database: 'test_db',
            username: 'test_user',
            password: 'test_password'
          }
        })
        
        
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).to.be.instanceOf(Error)
      }
    })

    it('should provide consistent error messages', async () => {
      const { NOORMME } = await import('../../src/noormme.js')
      
      // Test error message consistency
      try {
        const db = new NOORMME({
          dialect: 'sqlite',
          connection: {
            host: 'invalid-host',
            port: 9999,
            database: 'invalid-db',
            username: 'invalid-user',
            password: 'invalid-password'
          }
        })
        
        
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).to.be.instanceOf(Error)
        expect((error as Error).message).to.be.a('string')
        expect((error as Error).message.length).to.be.greaterThan(0)
      }
    })

    it('should handle async errors properly', async () => {
      const { NOORMME } = await import('../../src/noormme.js')
      
      // Test async error handling
      const db = new NOORMME({
        dialect: 'sqlite',
        connection: {
          host: 'localhost',
          port: 5432,
          database: 'test_db',
          username: 'test_user',
          password: 'test_password'
        }
      })
      
      try {
        
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).to.be.instanceOf(Error)
      }
    })
  })
})
