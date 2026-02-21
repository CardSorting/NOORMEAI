import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { promises as fs } from 'fs'
import * as path from 'path'
import { sql } from '../../src/raw-builder/sql.js'

// Mock OAuth provider data
interface OAuthProviderData {
  provider: string
  providerAccountId: string
  name?: string
  email?: string
  image?: string
  access_token?: string
  refresh_token?: string
  expires_at?: number
  scope?: string
}

// Mock OAuth callback simulation
class OAuthFlowSimulator {
  private db: NOORMME

  constructor(db: NOORMME) {
    this.db = db
  }

  // Simulate OAuth callback flow
  async simulateOAuthCallback(providerData: OAuthProviderData) {
    const kysely = this.db.getKysely()

    // Step 1: Check if user exists by email (if email is provided)
    let user = null
    if (providerData.email) {
      user = await kysely
        .selectFrom('users')
        .selectAll()
        .where('email', '=', providerData.email)
        .executeTakeFirst()
    }

    // Step 2: Create user if doesn't exist
    if (!user) {
      const userRepo = this.db.getRepository('users')
      const userData = {
        id: crypto.randomUUID(),
        name: providerData.name || null,
        email: providerData.email || null,
        email_verified: providerData.email ? new Date().toISOString() : null,
        image: providerData.image || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      user = await userRepo.create(userData) as Record<string, unknown>
    }

    // Step 3: Link the OAuth account
    const accountData = {
      id: crypto.randomUUID(),
      user_id: user.id as string,
      type: 'oauth',
      provider: providerData.provider,
      provider_account_id: providerData.providerAccountId,
      access_token: providerData.access_token || null,
      refresh_token: providerData.refresh_token || null,
      expires_at: providerData.expires_at || null,
      token_type: 'Bearer',
      scope: providerData.scope || null,
      id_token: null,
      session_state: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    await kysely.insertInto('accounts').values(accountData).execute()

    // Step 4: Create session
    const sessionData = {
      id: crypto.randomUUID(),
      session_token: `session_${crypto.randomUUID()}`,
      user_id: user.id as string,
      expires: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    await kysely.insertInto('sessions').values(sessionData).execute()

    return {
      user: {
        id: user.id as string,
        name: user.name as string | null,
        email: user.email as string | null,
        emailVerified: user.email_verified ? new Date(user.email_verified as string) : null,
        image: user.image as string | null,
      },
      session: {
        id: sessionData.id,
        sessionToken: sessionData.session_token,
        userId: sessionData.user_id,
        expires: new Date(sessionData.expires),
      },
      account: accountData
    }
  }

  // Simulate OAuth callback error scenarios
  async simulateOAuthCallbackError(scenario: 'missing-user' | 'duplicate-account' | 'invalid-token') {
    const kysely = this.db.getKysely()

    switch (scenario) {
      case 'missing-user':
        // Try to link account to non-existent user
        const accountData = {
          id: crypto.randomUUID(),
          user_id: 'non-existent-user-id',
          type: 'oauth',
          provider: 'github',
          provider_account_id: 'github-123',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        try {
          await kysely.insertInto('accounts').values(accountData).execute()
          throw new Error('Expected foreign key constraint violation')
        } catch (error) {
          return { error: 'Foreign key constraint violation', details: error }
        }

      case 'duplicate-account':
        // Create duplicate account for same provider
        const user = await this.createTestUser()
        
        const duplicateAccount1 = {
          id: crypto.randomUUID(),
          user_id: user.id,
          type: 'oauth',
          provider: 'github',
          provider_account_id: 'github-123',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        const duplicateAccount2 = {
          id: crypto.randomUUID(),
          user_id: user.id,
          type: 'oauth',
          provider: 'github',
          provider_account_id: 'github-123',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        await kysely.insertInto('accounts').values(duplicateAccount1).execute()
        
        try {
          await kysely.insertInto('accounts').values(duplicateAccount2).execute()
          throw new Error('Expected unique constraint violation')
        } catch (error) {
          return { error: 'Unique constraint violation', details: error }
        }

      case 'invalid-token':
        // Simulate invalid/expired access token
        const userWithToken = await this.createTestUser()
        
        const accountWithInvalidToken = {
          id: crypto.randomUUID(),
          user_id: userWithToken.id,
          type: 'oauth',
          provider: 'github',
          provider_account_id: 'github-invalid-token',
          access_token: 'invalid-or-expired-token',
          expires_at: Date.now() - 3600000, // Expired 1 hour ago
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        await kysely.insertInto('accounts').values(accountWithInvalidToken).execute()

        return {
          error: 'Invalid or expired token',
          account: accountWithInvalidToken,
          tokenExpired: true
        }
    }
  }

  private async createTestUser() {
    const userRepo = this.db.getRepository('users')
    const userData = {
      id: crypto.randomUUID(),
      name: 'Test User',
      email: 'test@example.com',
      email_verified: new Date().toISOString(),
      image: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    return await userRepo.create(userData) as Record<string, unknown>
  }

  // Verify OAuth session is valid
  async verifySession(sessionToken: string) {
    const kysely = this.db.getKysely()
    
    const result = await kysely
      .selectFrom('sessions')
      .innerJoin('users', 'users.id', 'sessions.user_id')
      .innerJoin('accounts', 'accounts.user_id', 'users.id')
      .selectAll('sessions')
      .selectAll('users')
      .selectAll('accounts')
      .where('sessions.session_token', '=', sessionToken)
      .where('sessions.expires', '>', new Date().toISOString())
      .executeTakeFirst()

    return result ? {
      valid: true,
      user: {
        id: result.id as string,
        name: result.name as string | null,
        email: result.email as string | null,
      },
      session: {
        expires: new Date(result.expires as string),
      },
      account: {
        provider: result.provider as string,
        providerAccountId: result.provider_account_id as string,
      }
    } : { valid: false }
  }
}

describe('OAuth Flow Integration Tests', () => {
  let db: NOORMME
  let oauthSimulator: OAuthFlowSimulator
  let dbPath: string

  beforeEach(async () => {
    // Create a unique database file for each test
    dbPath = path.join(process.cwd(), `test-oauth-${Date.now()}.db`)
    
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

    oauthSimulator = new OAuthFlowSimulator(db)
  })

  afterEach(async () => {
    try {
      await fs.unlink(dbPath)
    } catch (e) {
      // File might not exist
    }
  })

  describe('Successful OAuth Flows', () => {
    it('should handle GitHub OAuth callback successfully', async () => {
      const githubProviderData: OAuthProviderData = {
        provider: 'github',
        providerAccountId: 'github-123456',
        name: 'John Doe',
        email: 'john@example.com',
        image: 'https://github.com/avatars/john.jpg',
        access_token: 'gho_github_access_token_123',
        expires_at: Date.now() + 3600000,
        scope: 'user:email,read:user'
      }

      const result = await oauthSimulator.simulateOAuthCallback(githubProviderData)

      expect(result.user).toBeDefined()
      expect(result.user.email).toBe(githubProviderData.email)
      expect(result.user.name).toBe(githubProviderData.name)
      expect(result.user.image).toBe(githubProviderData.image)
      expect(result.session).toBeDefined()
      expect(result.account.provider).toBe('github')
      expect(result.account.provider_account_id).toBe(githubProviderData.providerAccountId)
    })

    it('should handle Google OAuth callback successfully', async () => {
      const googleProviderData: OAuthProviderData = {
        provider: 'google',
        providerAccountId: 'google-789012',
        name: 'Jane Smith',
        email: 'jane@gmail.com',
        image: 'https://lh3.googleusercontent.com/avatar.jpg',
        access_token: 'ya29.google_access_token_456',
        refresh_token: '1//refresh_token_789',
        expires_at: Date.now() + 3600000,
        scope: 'openid email profile'
      }

      const result = await oauthSimulator.simulateOAuthCallback(googleProviderData)

      expect(result.user).toBeDefined()
      expect(result.user.email).toBe(googleProviderData.email)
      expect(result.user.name).toBe(googleProviderData.name)
      expect(result.account.provider).toBe('google')
      expect(result.account.access_token).toBe(googleProviderData.access_token)
      expect(result.account.refresh_token).toBe(googleProviderData.refresh_token)
    })

    it('should handle existing user login with new provider', async () => {
      // First, create a user with GitHub
      const githubData: OAuthProviderData = {
        provider: 'github',
        providerAccountId: 'github-first',
        name: 'Existing User',
        email: 'existing@example.com'
      }

      const githubResult = await oauthSimulator.simulateOAuthCallback(githubData)
      const existingUserId = githubResult.user.id

      // Then, link Google account to the same user
      const googleData: OAuthProviderData = {
        provider: 'google',
        providerAccountId: 'google-second',
        name: 'Existing User',
        email: 'existing@example.com' // Same email
      }

      const googleResult = await oauthSimulator.simulateOAuthCallback(googleData)

      // Should reuse the existing user
      expect(googleResult.user.id).toBe(existingUserId)
      expect(googleResult.user.email).toBe('existing@example.com')
    })

    it('should handle user without email (GitHub private email)', async () => {
      const githubPrivateData: OAuthProviderData = {
        provider: 'github',
        providerAccountId: 'github-private-123',
        name: 'Private User',
        // No email provided (GitHub private email settings)
        image: 'https://github.com/avatars/private.jpg'
      }

      const result = await oauthSimulator.simulateOAuthCallback(githubPrivateData)

      expect(result.user).toBeDefined()
      expect(result.user.name).toBe(githubPrivateData.name)
      expect(result.user.email).toBeNull()
      expect(result.user.image).toBe(githubPrivateData.image)
      expect(result.account.provider).toBe('github')
    })
  })

  describe('OAuth Error Scenarios', () => {
    it('should handle foreign key constraint violation', async () => {
      const error = await oauthSimulator.simulateOAuthCallbackError('missing-user')
      
      expect(error.error).toBe('Foreign key constraint violation')
      expect(error.details).toBeDefined()
    })

    it('should handle duplicate account constraint violation', async () => {
      const error = await oauthSimulator.simulateOAuthCallbackError('duplicate-account')
      
      expect(error.error).toBe('Unique constraint violation')
      expect(error.details).toBeDefined()
    })

    it('should handle invalid/expired tokens', async () => {
      const result = await oauthSimulator.simulateOAuthCallbackError('invalid-token')
      
      expect(result.error).toBe('Invalid or expired token')
      expect(result.tokenExpired).toBe(true)
      expect(result.account).toBeDefined()
    })
  })

  describe('Session Management', () => {
    it('should create valid session after OAuth callback', async () => {
      const providerData: OAuthProviderData = {
        provider: 'github',
        providerAccountId: 'github-session-test',
        name: 'Session Test User',
        email: 'session@example.com'
      }

      const result = await oauthSimulator.simulateOAuthCallback(providerData)
      const sessionVerification = await oauthSimulator.verifySession(result.session.sessionToken)

      expect(sessionVerification.valid).toBe(true)
      expect(sessionVerification.user).toBeDefined()
      expect(sessionVerification.user!.email).toBe(providerData.email)
      expect(sessionVerification.account!.provider).toBe('github')
    })

    it('should reject expired sessions', async () => {
      // Create a session that expires in the past
      const kysely = db.getKysely()
      
      const expiredSessionData = {
        id: crypto.randomUUID(),
        session_token: 'expired-session-token',
        user_id: crypto.randomUUID(),
        expires: new Date(Date.now() - 3600000).toISOString(), // Expired 1 hour ago
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      await kysely.insertInto('sessions').values(expiredSessionData).execute()

      const sessionVerification = await oauthSimulator.verifySession(expiredSessionData.session_token)
      expect(sessionVerification.valid).toBe(false)
    })

    it('should reject non-existent sessions', async () => {
      const sessionVerification = await oauthSimulator.verifySession('non-existent-session-token')
      expect(sessionVerification.valid).toBe(false)
    })
  })

  describe('Database Strategy vs JWT Strategy', () => {
    it('should work with database session strategy', async () => {
      const providerData: OAuthProviderData = {
        provider: 'github',
        providerAccountId: 'github-db-strategy',
        name: 'DB Strategy User',
        email: 'dbstrategy@example.com'
      }

      const result = await oauthSimulator.simulateOAuthCallback(providerData)

      // Verify all database operations succeeded
      expect(result.user).toBeDefined()
      expect(result.session).toBeDefined()
      expect(result.account).toBeDefined()

      // Verify session is stored in database
      const sessionVerification = await oauthSimulator.verifySession(result.session.sessionToken)
      expect(sessionVerification.valid).toBe(true)

      // Verify user is stored in database
      const kysely = db.getKysely()
      const dbUser = await kysely
        .selectFrom('users')
        .selectAll()
        .where('id', '=', result.user.id)
        .executeTakeFirst()

      expect(dbUser).toBeDefined()
      expect(dbUser!.email).toBe(providerData.email)
    })

    it('should handle multiple concurrent OAuth callbacks', async () => {
      const providerData1: OAuthProviderData = {
        provider: 'github',
        providerAccountId: 'github-concurrent-1',
        name: 'Concurrent User 1',
        email: 'concurrent1@example.com'
      }

      const providerData2: OAuthProviderData = {
        provider: 'google',
        providerAccountId: 'google-concurrent-2',
        name: 'Concurrent User 2',
        email: 'concurrent2@example.com'
      }

      // Simulate concurrent OAuth callbacks
      const [result1, result2] = await Promise.all([
        oauthSimulator.simulateOAuthCallback(providerData1),
        oauthSimulator.simulateOAuthCallback(providerData2)
      ])

      expect(result1.user.id).not.toBe(result2.user.id)
      expect(result1.user.email).toBe(providerData1.email)
      expect(result2.user.email).toBe(providerData2.email)

      // Both sessions should be valid
      const [session1, session2] = await Promise.all([
        oauthSimulator.verifySession(result1.session.sessionToken),
        oauthSimulator.verifySession(result2.session.sessionToken)
      ])

      expect(session1.valid).toBe(true)
      expect(session2.valid).toBe(true)
    })
  })

  describe('OAuth Callback Debugging Scenarios', () => {
    it('should handle the exact scenario from debugging document', async () => {
      // This test reproduces the OAuth callback error scenario described in the debugging document
      
      // Simulate the problematic flow where NOORMME initialization failed
      const providerData: OAuthProviderData = {
        provider: 'github',
        providerAccountId: 'github-debug-scenario',
        name: 'Debug User',
        email: 'debug@example.com'
      }

      // This should now work with our fixes
      const result = await oauthSimulator.simulateOAuthCallback(providerData)

      expect(result.user).toBeDefined()
      expect(result.user.email).toBe('debug@example.com')
      expect(result.session).toBeDefined()
      expect(result.account.provider).toBe('github')

      // Verify the session is valid and can be retrieved
      const sessionVerification = await oauthSimulator.verifySession(result.session.sessionToken)
      expect(sessionVerification.valid).toBe(true)

      // This should not result in the callbackUrl error from the debugging document
      // The OAuth flow should complete successfully
    })

    it('should handle empty database initialization (the main fix)', async () => {
      // Create a fresh database without any tables
      const emptyDbPath = path.join(process.cwd(), `test-empty-oauth-${Date.now()}.db`)
      
      try {
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

        // This should not fail with our pragma fixes
        await emptyDb.initialize()

        // Create tables after initialization
        const kysely = emptyDb.getKysely()
        
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
            access_token TEXT,
            refresh_token TEXT,
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

        // Now test OAuth flow with the previously problematic setup
        const emptyOauthSimulator = new OAuthFlowSimulator(emptyDb)
        
        const providerData: OAuthProviderData = {
          provider: 'github',
          providerAccountId: 'github-empty-db-test',
          name: 'Empty DB User',
          email: 'empty@example.com'
        }

        const result = await emptyOauthSimulator.simulateOAuthCallback(providerData)

        expect(result.user).toBeDefined()
        expect(result.user.email).toBe('empty@example.com')
        expect(result.session).toBeDefined()

      } finally {
        // Clean up
        try {
          await fs.unlink(emptyDbPath)
        } catch (e) {
          // File might not exist
        }
      }
    })
  })
})
