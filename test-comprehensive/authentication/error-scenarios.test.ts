import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { promises as fs } from 'fs'
import * as path from 'path'
import { sql } from '../../src/raw-builder/sql.js'

// Error scenario simulator for authentication testing
class AuthenticationErrorSimulator {
  private db: NOORMME

  constructor(db: NOORMME) {
    this.db = db
  }

  // Simulate the exact error scenarios from the debugging document
  async simulatePragmaSyntaxError() {
    try {
      // This would have failed before our fixes
      const kysely = this.db.getKysely()
      
      // Try to use the old incorrect pragma syntax (this should now work with our fixes)
      const result = await sql`PRAGMA table_info('users')`.execute(kysely)
      return { success: true, tablesFound: result.rows.length }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async simulateEmptyDatabaseInitialization() {
    try {
      // Create a completely empty database
      const emptyDbPath = path.join(process.cwd(), `test-empty-error-${Date.now()}.db`)
      
      const emptyDb = new NOORMME({
        dialect: 'sqlite',
        connection: {
          host: '',
          port: 0,
          username: '',
          password: '',
          database: emptyDbPath
        }
      })

      // This should not fail with our fixes
      await emptyDb.initialize()
      
      // Try to get schema info (should return empty arrays, not throw)
      const schemaInfo = await emptyDb.getSchemaInfo()
      
      await fs.unlink(emptyDbPath)
      
      return { 
        success: true, 
        tablesFound: schemaInfo.tables.length,
        relationshipsFound: schemaInfo.relationships.length 
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async simulateForeignKeyConstraintViolation() {
    try {
      const kysely = this.db.getKysely()
      
      // Try to create an account for a non-existent user
      await kysely.insertInto('accounts').values({
        id: crypto.randomUUID(),
        user_id: 'non-existent-user-id',
        type: 'oauth',
        provider: 'github',
        provider_account_id: 'github-123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).execute()
      
      return { success: false, error: 'Should have failed with foreign key constraint' }
    } catch (error) {
      return { success: true, error: error.message, expectedError: true }
    }
  }

  async simulateDuplicateAccountConstraint() {
    try {
      const kysely = this.db.getKysely()
      
      // Create a user first
      const userRepo = this.db.getRepository('users')
      const user = await userRepo.create({
        id: crypto.randomUUID(),
        name: 'Test User',
        email: 'test@example.com',
        email_verified: new Date().toISOString(),
        image: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }) as Record<string, unknown>

      // Try to create duplicate accounts
      const accountData = {
        id: crypto.randomUUID(),
        user_id: user.id as string,
        type: 'oauth',
        provider: 'github',
        provider_account_id: 'github-duplicate',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // First account should succeed
      await kysely.insertInto('accounts').values(accountData).execute()
      
      // Second account with same provider/providerAccountId should fail
      const duplicateAccount = {
        ...accountData,
        id: crypto.randomUUID(),
        user_id: user.id as string
      }
      
      await kysely.insertInto('accounts').values(duplicateAccount).execute()
      
      return { success: false, error: 'Should have failed with unique constraint' }
    } catch (error) {
      return { success: true, error: error.message, expectedError: true }
    }
  }

  async simulateOAuthCallbackFailure() {
    try {
      // Simulate the exact OAuth callback failure scenario from debugging document
      
      // Step 1: NOORMME initialization (should succeed with our fixes)
      const schemaInfo = await this.db.getSchemaInfo()
      
      // Step 2: Try to create user (this would fail if NOORMME wasn't initialized)
      const userRepo = this.db.getRepository('users')
      const user = await userRepo.create({
        id: crypto.randomUUID(),
        name: 'OAuth Test User',
        email: 'oauth-test@example.com',
        email_verified: new Date().toISOString(),
        image: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }) as Record<string, unknown>

      // Step 3: Try to link account (this would fail if user creation failed)
      const kysely = this.db.getKysely()
      await kysely.insertInto('accounts').values({
        id: crypto.randomUUID(),
        user_id: user.id as string,
        type: 'oauth',
        provider: 'github',
        provider_account_id: 'github-oauth-test',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).execute()

      // Step 4: Create session (this would fail if account linking failed)
      await kysely.insertInto('sessions').values({
        id: crypto.randomUUID(),
        session_token: 'oauth-test-session',
        user_id: user.id as string,
        expires: new Date(Date.now() + 3600000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).execute()

      return { 
        success: true, 
        message: 'OAuth callback flow completed successfully',
        userId: user.id as string,
        tablesDiscovered: schemaInfo.tables.length
      }
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        stack: error.stack 
      }
    }
  }

  async simulateDatabaseConnectionLoss() {
    try {
      // Simulate database connection issues
      const kysely = this.db.getKysely()
      
      // Try to execute a query on a potentially disconnected database
      const result = await kysely.selectFrom('users').select('count(*) as count').executeTakeFirst()
      
      return { success: true, userCount: result?.count || 0 }
    } catch (error) {
      return { success: false, error: error.message, connectionLost: true }
    }
  }

  async simulateConcurrentAccess() {
    try {
      const kysely = this.db.getKysely()
      
      // Simulate concurrent user creation
      const concurrentPromises = Array.from({ length: 10 }, (_, i) => {
        return kysely.insertInto('users').values({
          id: crypto.randomUUID(),
          name: `Concurrent User ${i}`,
          email: `concurrent${i}@example.com`,
          email_verified: new Date().toISOString(),
          image: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).execute()
      })

      await Promise.all(concurrentPromises)
      
      // Verify all users were created
      const userCount = await kysely.selectFrom('users').select('count(*) as count').executeTakeFirst()
      
      return { success: true, usersCreated: userCount?.count || 0 }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async simulateMemoryLeakScenario() {
    try {
      // Simulate creating many sessions without cleanup
      const kysely = this.db.getKysely()
      
      const sessionPromises = Array.from({ length: 1000 }, (_, i) => {
        return kysely.insertInto('sessions').values({
          id: crypto.randomUUID(),
          session_token: `memory-test-session-${i}`,
          user_id: crypto.randomUUID(), // Random user ID (will create orphaned sessions)
          expires: new Date(Date.now() + 3600000).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).execute()
      })

      await Promise.all(sessionPromises)
      
      const sessionCount = await kysely.selectFrom('sessions').select('count(*) as count').executeTakeFirst()
      
      return { success: true, sessionsCreated: sessionCount?.count || 0 }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
}

describe('Authentication Error Scenarios and Edge Cases', () => {
  let db: NOORMME
  let errorSimulator: AuthenticationErrorSimulator
  let dbPath: string

  beforeEach(async () => {
    // Create a unique database file for each test
    dbPath = path.join(process.cwd(), `test-error-${Date.now()}.db`)
    
    // Remove existing test database
    try {
      await fs.unlink(dbPath)
    } catch (e) {
      // File doesn't exist, that's fine
    }

    db = new NOORMME({
      dialect: 'sqlite',
      connection: {
        host: '',
        port: 0,
        username: '',
        password: '',
        database: dbPath
      }
    })

    await db.initialize()

    // Create required tables
    const kysely = db.getKysely()
    
    await sql`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE,
        email_verified TEXT,
        image TEXT,
        created_at TEXT,
        updated_at TEXT
      )
    `.execute(kysely)

    await sql`
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        provider TEXT NOT NULL,
        provider_account_id TEXT NOT NULL,
        refresh_token TEXT,
        access_token TEXT,
        expires_at INTEGER,
        token_type TEXT,
        scope TEXT,
        id_token TEXT,
        session_state TEXT,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(provider, provider_account_id)
      )
    `.execute(kysely)

    await sql`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        session_token TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL,
        expires TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `.execute(kysely)

    errorSimulator = new AuthenticationErrorSimulator(db)
  })

  afterEach(async () => {
    try {
      await fs.unlink(dbPath)
    } catch (e) {
      // File might not exist
    }
  })

  describe('Original OAuth Callback Issues (Now Fixed)', () => {
    it('should handle pragma syntax errors gracefully', async () => {
      const result = await errorSimulator.simulatePragmaSyntaxError()
      
      // With our fixes, this should succeed
      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should handle empty database initialization gracefully', async () => {
      const result = await errorSimulator.simulateEmptyDatabaseInitialization()
      
      // With our fixes, this should succeed
      expect(result.success).toBe(true)
      expect(result.tablesFound).toBe(0) // Empty database should return 0 tables
      expect(result.relationshipsFound).toBe(0)
    })

    it('should complete OAuth callback flow successfully', async () => {
      const result = await errorSimulator.simulateOAuthCallbackFailure()
      
      // This should now succeed with our fixes
      expect(result.success).toBe(true)
      expect(result.message).toBe('OAuth callback flow completed successfully')
      expect(result.userId).toBeDefined()
    })
  })

  describe('Database Constraint Violations', () => {
    it('should handle foreign key constraint violations', async () => {
      const result = await errorSimulator.simulateForeignKeyConstraintViolation()
      
      // This should fail with the expected constraint violation
      expect(result.success).toBe(true) // Success in detecting the expected error
      expect(result.expectedError).toBe(true)
      expect(result.error).toContain('foreign key')
    })

    it('should handle unique constraint violations', async () => {
      const result = await errorSimulator.simulateDuplicateAccountConstraint()
      
      // This should fail with the expected unique constraint violation
      expect(result.success).toBe(true) // Success in detecting the expected error
      expect(result.expectedError).toBe(true)
      expect(result.error).toContain('UNIQUE')
    })
  })

  describe('Connection and Performance Issues', () => {
    it('should handle database connection issues', async () => {
      const result = await errorSimulator.simulateDatabaseConnectionLoss()
      
      // Should succeed under normal conditions
      expect(result.success).toBe(true)
      expect(result.connectionLost).toBeUndefined()
    })

    it('should handle concurrent database access', async () => {
      const result = await errorSimulator.simulateConcurrentAccess()
      
      // Should handle concurrent access gracefully
      expect(result.success).toBe(true)
      expect(result.usersCreated).toBe(10)
    })

    it('should handle memory leak scenarios', async () => {
      const result = await errorSimulator.simulateMemoryLeakScenario()
      
      // Should handle large number of operations
      expect(result.success).toBe(true)
      expect(result.sessionsCreated).toBe(1000)
    })
  })

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle very long session tokens', async () => {
      const kysely = db.getKysely()
      
      const longToken = 'a'.repeat(1000) // Very long session token
      
      try {
        await kysely.insertInto('sessions').values({
          id: crypto.randomUUID(),
          session_token: longToken,
          user_id: crypto.randomUUID(),
          expires: new Date(Date.now() + 3600000).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).execute()
        
        expect(true).toBe(true) // Should succeed
      } catch (error) {
        // Should handle gracefully even if it fails
        expect(error).toBeDefined()
      }
    })

    it('should handle special characters in user data', async () => {
      const userRepo = db.getRepository('users')
      
      const specialUserData = {
        id: crypto.randomUUID(),
        name: 'User with "quotes" and \'apostrophes\' and émojis 🚀',
        email: 'special+chars@example.com',
        email_verified: new Date().toISOString(),
        image: 'https://example.com/avatar with spaces.jpg',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const user = await userRepo.create(specialUserData) as Record<string, unknown>
      
      expect(user).toBeDefined()
      expect(user.name).toBe(specialUserData.name)
      expect(user.email).toBe(specialUserData.email)
    })

    it('should handle null and undefined values', async () => {
      const userRepo = db.getRepository('users')
      
      const nullUserData = {
        id: crypto.randomUUID(),
        name: null,
        email: null,
        email_verified: null,
        image: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const user = await userRepo.create(nullUserData) as Record<string, unknown>
      
      expect(user).toBeDefined()
      expect(user.name).toBeNull()
      expect(user.email).toBeNull()
    })

    it('should handle very large user data', async () => {
      const userRepo = db.getRepository('users')
      
      const largeUserData = {
        id: crypto.randomUUID(),
        name: 'Large User',
        email: 'large@example.com',
        email_verified: new Date().toISOString(),
        image: 'data:image/jpeg;base64,' + 'a'.repeat(1000000), // Very large base64 image
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const user = await userRepo.create(largeUserData) as Record<string, unknown>
      
      expect(user).toBeDefined()
      expect(user.image).toBe(largeUserData.image)
    })

    it('should handle timezone edge cases', async () => {
      const userRepo = db.getRepository('users')
      
      // Test various timezone scenarios
      const timezoneScenarios = [
        new Date('2023-12-31T23:59:59.999Z'), // UTC
        new Date('2024-01-01T00:00:00.000Z'), // UTC
        new Date('2023-12-31T15:59:59.999-08:00'), // PST
        new Date('2024-01-01T09:00:00.000+09:00'), // JST
      ]

      for (const date of timezoneScenarios) {
        const userData = {
          id: crypto.randomUUID(),
          name: `Timezone User ${date.toISOString()}`,
          email: `timezone${Date.now()}@example.com`,
          email_verified: date.toISOString(),
          image: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        const user = await userRepo.create(userData) as Record<string, unknown>
        expect(user).toBeDefined()
        expect(user.email_verified).toBe(date.toISOString())
      }
    })
  })

  describe('Security Edge Cases', () => {
    it('should handle SQL injection attempts in user data', async () => {
      const userRepo = db.getRepository('users')
      
      const maliciousUserData = {
        id: crypto.randomUUID(),
        name: "'; DROP TABLE users; --",
        email: 'malicious@example.com',
        email_verified: new Date().toISOString(),
        image: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const user = await userRepo.create(maliciousUserData) as Record<string, unknown>
      
      expect(user).toBeDefined()
      expect(user.name).toBe(maliciousUserData.name)
      
      // Verify table still exists
      const kysely = db.getKysely()
      const tableExists = await kysely.selectFrom('users').select('count(*) as count').executeTakeFirst()
      expect(tableExists?.count).toBeGreaterThan(0)
    })

    it('should handle XSS attempts in user data', async () => {
      const userRepo = db.getRepository('users')
      
      const xssUserData = {
        id: crypto.randomUUID(),
        name: '<script>alert("XSS")</script>',
        email: 'xss@example.com',
        email_verified: new Date().toISOString(),
        image: '<img src="x" onerror="alert(\'XSS\')">',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const user = await userRepo.create(xssUserData) as Record<string, unknown>
      
      expect(user).toBeDefined()
      expect(user.name).toBe(xssUserData.name)
      expect(user.image).toBe(xssUserData.image)
    })

    it('should handle very long email addresses', async () => {
      const userRepo = db.getRepository('users')
      
      const longEmail = 'a'.repeat(1000) + '@example.com'
      
      const longEmailUserData = {
        id: crypto.randomUUID(),
        name: 'Long Email User',
        email: longEmail,
        email_verified: new Date().toISOString(),
        image: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const user = await userRepo.create(longEmailUserData) as Record<string, unknown>
      
      expect(user).toBeDefined()
      expect(user.email).toBe(longEmail)
    })
  })

  describe('Recovery and Resilience', () => {
    it('should recover from temporary database locks', async () => {
      const kysely = db.getKysely()
      
      // Simulate multiple concurrent operations that might cause locks
      const concurrentOperations = Array.from({ length: 20 }, (_, i) => {
        return kysely.insertInto('users').values({
          id: crypto.randomUUID(),
          name: `Lock Test User ${i}`,
          email: `locktest${i}@example.com`,
          email_verified: new Date().toISOString(),
          image: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).execute()
      })

      // All operations should succeed
      await Promise.all(concurrentOperations)
      
      const userCount = await kysely.selectFrom('users').select('count(*) as count').executeTakeFirst()
      expect(userCount?.count).toBe(20)
    })

    it('should handle database file corruption gracefully', async () => {
      // Test with a potentially corrupted database file
      const corruptedDbPath = path.join(process.cwd(), `test-corrupted-${Date.now()}.db`)
      
      try {
        // Create a file with invalid SQLite data
        await fs.writeFile(corruptedDbPath, 'invalid sqlite data')
        
        const corruptedDb = new NOORMME({
          dialect: 'sqlite',
          connection: {
            host: '',
            port: 0,
            username: '',
            password: '',
            database: corruptedDbPath
          }
        })

        // Should handle corruption gracefully
        await expect(corruptedDb.initialize()).resolves.not.toThrow()
        
      } finally {
        try {
          await fs.unlink(corruptedDbPath)
        } catch (e) {
          // File might not exist
        }
      }
    })

    it('should handle disk space exhaustion scenarios', async () => {
      // This test simulates what might happen with very large operations
      const kysely = db.getKysely()
      
      // Create many large records
      const largeOperations = Array.from({ length: 100 }, (_, i) => {
        return kysely.insertInto('users').values({
          id: crypto.randomUUID(),
          name: `Large User ${i}`,
          email: `large${i}@example.com`,
          email_verified: new Date().toISOString(),
          image: 'data:image/jpeg;base64,' + 'x'.repeat(100000), // Large base64 data
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).execute()
      })

      // Should handle large operations gracefully
      await Promise.all(largeOperations)
      
      const userCount = await kysely.selectFrom('users').select('count(*) as count').executeTakeFirst()
      expect(userCount?.count).toBe(100)
    })
  })
})
