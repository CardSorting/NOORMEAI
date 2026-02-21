import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { promises as fs } from 'fs'
import * as path from 'path'
import { sql } from '../../src/raw-builder/sql.js'

// Mock NextAuth database strategy implementation
class DatabaseStrategyManager {
  private db: NOORMME

  constructor(db: NOORMME) {
    this.db = db
  }

  // Simulate NextAuth database strategy session management
  async createSession(sessionData: {
    sessionToken: string
    userId: string
    expires: Date
  }) {
    const kysely = this.db.getKysely()
    
    const session = {
      id: crypto.randomUUID(),
      session_token: sessionData.sessionToken,
      user_id: sessionData.userId,
      expires: sessionData.expires.toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    await kysely.insertInto('sessions').values(session).execute()
    return session
  }

  async getSession(sessionToken: string) {
    const kysely = this.db.getKysely()
    
    const result = await kysely
      .selectFrom('sessions')
      .innerJoin('users', 'users.id', 'sessions.user_id')
      .selectAll('sessions')
      .selectAll('users')
      .where('sessions.session_token', '=', sessionToken)
      .where('sessions.expires', '>', new Date().toISOString())
      .executeTakeFirst()

    return result ? {
      session: {
        id: result.id as string,
        sessionToken: result.session_token as string,
        userId: result.user_id as string,
        expires: new Date(result.expires as string),
      },
      user: {
        id: result.id as string,
        name: result.name as string | null,
        email: result.email as string | null,
        emailVerified: result.email_verified ? new Date(result.email_verified as string) : null,
        image: result.image as string | null,
      }
    } : null
  }

  async updateSession(sessionToken: string, updateData: {
    expires?: Date
  }) {
    const kysely = this.db.getKysely()
    
    const update: any = {
      updated_at: new Date().toISOString()
    }
    
    if (updateData.expires) {
      update.expires = updateData.expires.toISOString()
    }

    const updated = await kysely
      .updateTable('sessions')
      .set(update)
      .where('session_token', '=', sessionToken)
      .returningAll()
      .executeTakeFirst()

    return updated
  }

  async deleteSession(sessionToken: string) {
    const kysely = this.db.getKysely()
    await kysely.deleteFrom('sessions').where('session_token', '=', sessionToken).execute()
  }

  async createUser(userData: {
    name?: string
    email?: string
    emailVerified?: Date
    image?: string
  }) {
    const userRepo = this.db.getRepository('users')
    
    const user = {
      id: crypto.randomUUID(),
      name: userData.name || null,
      email: userData.email || null,
      email_verified: userData.emailVerified?.toISOString() || null,
      image: userData.image || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const created = await userRepo.create(user) as Record<string, unknown>
    return {
      id: created.id as string,
      name: created.name as string | null,
      email: created.email as string | null,
      emailVerified: created.email_verified ? new Date(created.email_verified as string) : null,
      image: created.image as string | null,
    }
  }

  async getUser(id: string) {
    const userRepo = this.db.getRepository('users')
    const user = await userRepo.findById(id) as Record<string, unknown> | null
    
    return user ? {
      id: user.id as string,
      name: user.name as string | null,
      email: user.email as string | null,
      emailVerified: user.email_verified ? new Date(user.email_verified as string) : null,
      image: user.image as string | null,
    } : null
  }

  async getUserByEmail(email: string) {
    const kysely = this.db.getKysely()
    
    const user = await kysely
      .selectFrom('users')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirst()

    return user ? {
      id: user.id as string,
      name: user.name as string | null,
      email: user.email as string | null,
      emailVerified: user.email_verified ? new Date(user.email_verified as string) : null,
      image: user.image as string | null,
    } : null
  }

  // Simulate JWT strategy (for comparison)
  async simulateJWTStrategy(userData: {
    name?: string
    email?: string
    emailVerified?: Date
    image?: string
  }) {
    // JWT strategy would not interact with database for user creation
    // This simulates what happens when JWT strategy is used with a database adapter
    return {
      id: crypto.randomUUID(),
      name: userData.name || null,
      email: userData.email || null,
      emailVerified: userData.emailVerified || null,
      image: userData.image || null,
      // JWT strategy doesn't persist to database
      persisted: false
    }
  }

  // Test the difference between database and JWT strategies
  async compareStrategies(userData: {
    name?: string
    email?: string
    emailVerified?: Date
    image?: string
  }) {
    const dbUser = await this.createUser(userData)
    const jwtUser = await this.simulateJWTStrategy(userData)

    return {
      database: {
        user: dbUser,
        persisted: true,
        retrievable: await this.getUser(dbUser.id) !== null
      },
      jwt: {
        user: jwtUser,
        persisted: false,
        retrievable: await this.getUser(jwtUser.id) === null
      }
    }
  }
}

describe('Database Strategy vs JWT Strategy Tests', () => {
  let db: NOORMME
  let strategyManager: DatabaseStrategyManager
  let dbPath: string

  beforeEach(async () => {
    // Create a unique database file for each test
    dbPath = path.join(process.cwd(), `test-strategy-${Date.now()}.db`)
    
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

    strategyManager = new DatabaseStrategyManager(db)
  })

  afterEach(async () => {
    try {
      await fs.unlink(dbPath)
    } catch (e) {
      // File might not exist
    }
  })

  describe('Database Strategy Benefits', () => {
    it('should persist user data to database', async () => {
      const userData = {
        name: 'Database User',
        email: 'database@example.com',
        emailVerified: new Date(),
        image: 'https://example.com/avatar.jpg'
      }

      const user = await strategyManager.createUser(userData)

      expect(user.id).toBeDefined()
      expect(user.name).toBe(userData.name)
      expect(user.email).toBe(userData.email)

      // Verify user is persisted in database
      const retrievedUser = await strategyManager.getUser(user.id)
      expect(retrievedUser).toEqual(user)
    })

    it('should manage sessions in database', async () => {
      const userData = {
        name: 'Session User',
        email: 'session@example.com'
      }

      const user = await strategyManager.createUser(userData)

      const sessionData = {
        sessionToken: 'db-session-token-123',
        userId: user.id,
        expires: new Date(Date.now() + 3600000)
      }

      await strategyManager.createSession(sessionData)
      const session = await strategyManager.getSession(sessionData.sessionToken)

      expect(session).toBeDefined()
      expect(session!.session.sessionToken).toBe(sessionData.sessionToken)
      expect(session!.user.id).toBe(user.id)
    })

    it('should handle session expiration', async () => {
      const userData = {
        name: 'Expired Session User',
        email: 'expired@example.com'
      }

      const user = await strategyManager.createUser(userData)

      // Create expired session
      const expiredSessionData = {
        sessionToken: 'expired-session-token',
        userId: user.id,
        expires: new Date(Date.now() - 3600000) // Expired 1 hour ago
      }

      await strategyManager.createSession(expiredSessionData)
      const session = await strategyManager.getSession(expiredSessionData.sessionToken)

      // Should return null for expired sessions
      expect(session).toBeNull()
    })

    it('should update sessions', async () => {
      const userData = {
        name: 'Update Session User',
        email: 'update@example.com'
      }

      const user = await strategyManager.createUser(userData)

      const sessionData = {
        sessionToken: 'update-session-token',
        userId: user.id,
        expires: new Date(Date.now() + 3600000)
      }

      await strategyManager.createSession(sessionData)

      // Update session expiration
      const newExpires = new Date(Date.now() + 7200000)
      await strategyManager.updateSession(sessionData.sessionToken, {
        expires: newExpires
      })

      const updatedSession = await strategyManager.getSession(sessionData.sessionToken)
      expect(updatedSession).toBeDefined()
      expect(updatedSession!.session.expires).toEqual(newExpires)
    })

    it('should delete sessions', async () => {
      const userData = {
        name: 'Delete Session User',
        email: 'delete@example.com'
      }

      const user = await strategyManager.createUser(userData)

      const sessionData = {
        sessionToken: 'delete-session-token',
        userId: user.id,
        expires: new Date(Date.now() + 3600000)
      }

      await strategyManager.createSession(sessionData)
      await strategyManager.deleteSession(sessionData.sessionToken)

      const session = await strategyManager.getSession(sessionData.sessionToken)
      expect(session).toBeNull()
    })
  })

  describe('Strategy Comparison', () => {
    it('should demonstrate difference between database and JWT strategies', async () => {
      const userData = {
        name: 'Comparison User',
        email: 'comparison@example.com',
        emailVerified: new Date()
      }

      const comparison = await strategyManager.compareStrategies(userData)

      // Database strategy
      expect(comparison.database.persisted).toBe(true)
      expect(comparison.database.retrievable).toBe(true)
      expect(comparison.database.user.id).toBeDefined()

      // JWT strategy
      expect(comparison.jwt.persisted).toBe(false)
      expect(comparison.jwt.retrievable).toBe(false)
      expect(comparison.jwt.user.id).toBeDefined()
    })

    it('should show why JWT strategy causes OAuth callback issues', async () => {
      // This test demonstrates the exact issue described in the debugging document
      
      // Simulate JWT strategy (problematic configuration)
      const jwtUser = await strategyManager.simulateJWTStrategy({
        name: 'JWT User',
        email: 'jwt@example.com'
      })

      // JWT strategy doesn't persist user to database
      expect(jwtUser.persisted).toBe(false)

      // Try to retrieve user from database (this would fail in real scenario)
      const retrievedUser = await strategyManager.getUser(jwtUser.id)
      expect(retrievedUser).toBeNull()

      // This is why OAuth callbacks fail with JWT strategy + database adapter
      // The user is never persisted, so linkAccount fails with foreign key constraint
    })

    it('should show why database strategy fixes OAuth callbacks', async () => {
      // This test demonstrates the solution described in the debugging document
      
      // Simulate database strategy (correct configuration)
      const dbUser = await strategyManager.createUser({
        name: 'Database User',
        email: 'database@example.com'
      })

      // Database strategy persists user to database
      expect(dbUser.id).toBeDefined()

      // User can be retrieved from database
      const retrievedUser = await strategyManager.getUser(dbUser.id)
      expect(retrievedUser).not.toBeNull()
      expect(retrievedUser!.email).toBe('database@example.com')

      // This is why OAuth callbacks work with database strategy
      // The user is persisted, so linkAccount succeeds
    })
  })

  describe('OAuth Callback Flow with Database Strategy', () => {
    it('should handle complete OAuth flow with database strategy', async () => {
      // Step 1: OAuth callback creates user (database strategy)
      const user = await strategyManager.createUser({
        name: 'OAuth Database User',
        email: 'oauthdb@example.com',
        emailVerified: new Date()
      })

      // Step 2: Create session (database strategy)
      const sessionData = {
        sessionToken: 'oauth-db-session',
        userId: user.id,
        expires: new Date(Date.now() + 3600000)
      }

      await strategyManager.createSession(sessionData)

      // Step 3: Verify complete flow works
      const session = await strategyManager.getSession(sessionData.sessionToken)
      expect(session).toBeDefined()
      expect(session!.user.email).toBe('oauthdb@example.com')

      // Step 4: User can be retrieved independently
      const retrievedUser = await strategyManager.getUser(user.id)
      expect(retrievedUser).not.toBeNull()

      // Step 5: User can be found by email
      const userByEmail = await strategyManager.getUserByEmail('oauthdb@example.com')
      expect(userByEmail).not.toBeNull()
      expect(userByEmail!.id).toBe(user.id)
    })

    it('should handle multiple OAuth providers with database strategy', async () => {
      const user = await strategyManager.createUser({
        name: 'Multi Provider User',
        email: 'multiprovider@example.com'
      })

      // Create sessions for different OAuth providers
      const githubSession = {
        sessionToken: 'github-session-token',
        userId: user.id,
        expires: new Date(Date.now() + 3600000)
      }

      const googleSession = {
        sessionToken: 'google-session-token',
        userId: user.id,
        expires: new Date(Date.now() + 3600000)
      }

      await Promise.all([
        strategyManager.createSession(githubSession),
        strategyManager.createSession(googleSession)
      ])

      // Both sessions should be valid
      const [githubResult, googleResult] = await Promise.all([
        strategyManager.getSession(githubSession.sessionToken),
        strategyManager.getSession(googleSession.sessionToken)
      ])

      expect(githubResult).toBeDefined()
      expect(googleResult).toBeDefined()
      expect(githubResult!.user.id).toBe(user.id)
      expect(googleResult!.user.id).toBe(user.id)
    })
  })

  describe('Session Management Edge Cases', () => {
    it('should handle concurrent session creation', async () => {
      const user = await strategyManager.createUser({
        name: 'Concurrent User',
        email: 'concurrent@example.com'
      })

      // Create multiple sessions concurrently
      const sessionPromises = Array.from({ length: 5 }, (_, i) => {
        return strategyManager.createSession({
          sessionToken: `concurrent-session-${i}`,
          userId: user.id,
          expires: new Date(Date.now() + 3600000)
        })
      })

      const sessions = await Promise.all(sessionPromises)
      expect(sessions).toHaveLength(5)

      // All sessions should be retrievable
      const sessionVerifications = await Promise.all(
        sessions.map(session => strategyManager.getSession(session.session_token))
      )

      sessionVerifications.forEach(verification => {
        expect(verification).toBeDefined()
        expect(verification!.user.id).toBe(user.id)
      })
    })

    it('should handle session cleanup', async () => {
      const user = await strategyManager.createUser({
        name: 'Cleanup User',
        email: 'cleanup@example.com'
      })

      // Create multiple sessions
      const sessions = []
      for (let i = 0; i < 3; i++) {
        const session = await strategyManager.createSession({
          sessionToken: `cleanup-session-${i}`,
          userId: user.id,
          expires: new Date(Date.now() + 3600000)
        })
        sessions.push(session)
      }

      // Delete one session
      await strategyManager.deleteSession(sessions[1].session_token)

      // Verify only 2 sessions remain
      const remainingSessions = await Promise.all(
        sessions.map(session => strategyManager.getSession(session.session_token))
      )

      expect(remainingSessions[0]).toBeDefined()
      expect(remainingSessions[1]).toBeNull()
      expect(remainingSessions[2]).toBeDefined()
    })

    it('should handle user deletion with cascade', async () => {
      const user = await strategyManager.createUser({
        name: 'Cascade User',
        email: 'cascade@example.com'
      })

      // Create session for user
      await strategyManager.createSession({
        sessionToken: 'cascade-session',
        userId: user.id,
        expires: new Date(Date.now() + 3600000)
      })

      // Delete user (should cascade to sessions)
      const kysely = db.getKysely()
      await kysely.deleteFrom('users').where('id', '=', user.id).execute()

      // Session should be automatically deleted due to foreign key cascade
      const session = await strategyManager.getSession('cascade-session')
      expect(session).toBeNull()
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle large number of sessions efficiently', async () => {
      const user = await strategyManager.createUser({
        name: 'Performance User',
        email: 'performance@example.com'
      })

      const startTime = Date.now()

      // Create 100 sessions
      const sessionPromises = Array.from({ length: 100 }, (_, i) => {
        return strategyManager.createSession({
          sessionToken: `perf-session-${i}`,
          userId: user.id,
          expires: new Date(Date.now() + 3600000)
        })
      })

      await Promise.all(sessionPromises)

      const creationTime = Date.now() - startTime

      // Verify sessions were created
      const sampleSessions = await Promise.all([
        strategyManager.getSession('perf-session-0'),
        strategyManager.getSession('perf-session-50'),
        strategyManager.getSession('perf-session-99')
      ])

      expect(sampleSessions.every(session => session !== null)).toBe(true)
      expect(creationTime).toBeLessThan(5000) // Should complete in under 5 seconds
    })

    it('should handle session expiration cleanup efficiently', async () => {
      const user = await strategyManager.createUser({
        name: 'Expiration User',
        email: 'expiration@example.com'
      })

      // Create mix of expired and valid sessions
      const expiredSessions = []
      const validSessions = []

      for (let i = 0; i < 50; i++) {
        const expired = await strategyManager.createSession({
          sessionToken: `expired-session-${i}`,
          userId: user.id,
          expires: new Date(Date.now() - 3600000) // Expired
        })
        expiredSessions.push(expired)

        const valid = await strategyManager.createSession({
          sessionToken: `valid-session-${i}`,
          userId: user.id,
          expires: new Date(Date.now() + 3600000) // Valid
        })
        validSessions.push(valid)
      }

      // Check expired sessions
      const expiredChecks = await Promise.all(
        expiredSessions.map(session => strategyManager.getSession(session.session_token))
      )

      // Check valid sessions
      const validChecks = await Promise.all(
        validSessions.map(session => strategyManager.getSession(session.session_token))
      )

      expect(expiredChecks.every(session => session === null)).toBe(true)
      expect(validChecks.every(session => session !== null)).toBe(true)
    })
  })
})
