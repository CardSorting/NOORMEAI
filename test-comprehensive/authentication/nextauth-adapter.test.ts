import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { promises as fs } from 'fs'
import * as path from 'path'
import { sql } from '../../src/raw-builder/sql.js'

// Mock NextAuth types for testing
interface AdapterUser {
  id: string
  name?: string | null
  email?: string | null
  emailVerified?: Date | null
  image?: string | null
}

interface AdapterAccount {
  id: string
  userId: string
  type: string
  provider: string
  providerAccountId: string
  refresh_token?: string | null
  access_token?: string | null
  expires_at?: number | null
  token_type?: string | null
  scope?: string | null
  id_token?: string | null
  session_state?: string | null
}

interface AdapterSession {
  id: string
  sessionToken: string
  userId: string
  expires: Date
}

interface VerificationToken {
  identifier: string
  token: string
  expires: Date
}

// NextAuth Adapter implementation for testing
class TestNoormmeAdapter {
  private db: NOORMME

  constructor(db: NOORMME) {
    this.db = db
  }

  async createUser(user: Omit<AdapterUser, 'id'>): Promise<AdapterUser> {
    const userRepo = this.db.getRepository('users')
    
    const userData = {
      id: crypto.randomUUID(),
      name: user.name,
      email: user.email || '',
      email_verified: user.emailVerified ? user.emailVerified.toISOString() : null,
      image: user.image,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const createdUser = await userRepo.create(userData) as Record<string, unknown>

    return {
      id: createdUser.id as string,
      name: createdUser.name as string | null,
      email: createdUser.email as string,
      emailVerified: createdUser.email_verified ? new Date(createdUser.email_verified as string) : null,
      image: createdUser.image as string | null,
    }
  }

  async getUser(id: string): Promise<AdapterUser | null> {
    const userRepo = this.db.getRepository('users')
    const user = await userRepo.findById(id) as Record<string, unknown> | null
    
    if (!user) return null

    return {
      id: user.id as string,
      name: user.name as string | null,
      email: user.email as string,
      emailVerified: user.email_verified ? new Date(user.email_verified as string) : null,
      image: user.image as string | null,
    }
  }

  async getUserByEmail(email: string): Promise<AdapterUser | null> {
    const kysely = this.db.getKysely()
    
    const result = await kysely
      .selectFrom('users')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirst()

    if (!result) return null

    return {
      id: result.id as string,
      name: result.name as string | null,
      email: result.email as string,
      emailVerified: result.email_verified ? new Date(result.email_verified as string) : null,
      image: result.image as string | null,
    }
  }

  async getUserByAccount({ providerAccountId, provider }: { providerAccountId: string; provider: string }): Promise<AdapterUser | null> {
    const kysely = this.db.getKysely()
    
    const result = await kysely
      .selectFrom('accounts')
      .innerJoin('users', 'users.id', 'accounts.user_id')
      .selectAll('users')
      .where('accounts.provider', '=', provider)
      .where('accounts.provider_account_id', '=', providerAccountId)
      .executeTakeFirst()

    if (!result) return null

    return {
      id: result.id as string,
      name: result.name as string | null,
      email: result.email as string,
      emailVerified: result.email_verified ? new Date(result.email_verified as string) : null,
      image: result.image as string | null,
    }
  }

  async updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, 'id'>): Promise<AdapterUser> {
    const kysely = this.db.getKysely()
    
    const updateData: any = {}
    if (user.name !== undefined) updateData.name = user.name
    if (user.email !== undefined) updateData.email = user.email
    if (user.emailVerified !== undefined) updateData.email_verified = user.emailVerified?.toISOString() || null
    if (user.image !== undefined) updateData.image = user.image
    updateData.updated_at = new Date().toISOString()

    const updatedUser = await kysely
      .updateTable('users')
      .set(updateData)
      .where('id', '=', user.id)
      .returningAll()
      .executeTakeFirst()

    if (!updatedUser) throw new Error('User not found')

    return {
      id: updatedUser.id as string,
      name: updatedUser.name as string | null,
      email: updatedUser.email as string,
      emailVerified: updatedUser.email_verified ? new Date(updatedUser.email_verified as string) : null,
      image: updatedUser.image as string | null,
    }
  }

  async linkAccount(account: AdapterAccount): Promise<void> {
    const kysely = this.db.getKysely()
    
    // Verify that the user exists before linking account
    const userExists = await kysely
      .selectFrom('users')
      .select('id')
      .where('id', '=', account.userId)
      .executeTakeFirst()
    
    if (!userExists) {
      throw new Error(`User with ID ${account.userId} does not exist. NextAuth should create the user before linking account.`)
    }
    
    const accountData = {
      id: crypto.randomUUID(),
      user_id: account.userId,
      type: account.type,
      provider: account.provider,
      provider_account_id: account.providerAccountId,
      refresh_token: account.refresh_token,
      access_token: account.access_token,
      expires_at: account.expires_at,
      token_type: account.token_type,
      scope: account.scope,
      id_token: account.id_token,
      session_state: account.session_state,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    await kysely.insertInto('accounts').values(accountData).execute()
  }

  async createSession(session: Omit<AdapterSession, 'id'>): Promise<AdapterSession> {
    const kysely = this.db.getKysely()
    
    const sessionData = {
      id: crypto.randomUUID(),
      session_token: session.sessionToken,
      user_id: session.userId,
      expires: session.expires.toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    await kysely.insertInto('sessions').values(sessionData).execute()

    return {
      id: sessionData.id,
      sessionToken: sessionData.session_token,
      userId: sessionData.user_id,
      expires: session.expires,
    }
  }

  async getSessionAndUser(sessionToken: string): Promise<{ session: AdapterSession; user: AdapterUser } | null> {
    const kysely = this.db.getKysely()
    
    const result = await kysely
      .selectFrom('sessions')
      .innerJoin('users', 'users.id', 'sessions.user_id')
      .selectAll('sessions')
      .selectAll('users')
      .where('sessions.session_token', '=', sessionToken)
      .where('sessions.expires', '>', new Date().toISOString())
      .executeTakeFirst()

    if (!result) return null

    return {
      session: {
        id: result.id as string,
        sessionToken: result.session_token as string,
        userId: result.user_id as string,
        expires: new Date(result.expires as string),
      },
      user: {
        id: result.id as string,
        name: result.name as string | null,
        email: result.email as string,
        emailVerified: result.email_verified ? new Date(result.email_verified as string) : null,
        image: result.image as string | null,
      },
    }
  }

  async updateSession(session: Partial<AdapterSession> & Pick<AdapterSession, 'sessionToken'>): Promise<AdapterSession | null> {
    const kysely = this.db.getKysely()
    
    const updateData: any = {}
    if (session.expires) updateData.expires = session.expires.toISOString()
    if (session.userId) updateData.user_id = session.userId
    updateData.updated_at = new Date().toISOString()

    const updatedSession = await kysely
      .updateTable('sessions')
      .set(updateData)
      .where('session_token', '=', session.sessionToken)
      .returningAll()
      .executeTakeFirst()

    if (!updatedSession) return null

    return {
      id: updatedSession.id as string,
      sessionToken: updatedSession.session_token as string,
      userId: updatedSession.user_id as string,
      expires: new Date(updatedSession.expires as string),
    }
  }

  async deleteSession(sessionToken: string): Promise<void> {
    const kysely = this.db.getKysely()
    await kysely.deleteFrom('sessions').where('session_token', '=', sessionToken).execute()
  }

  async createVerificationToken(verificationToken: VerificationToken): Promise<VerificationToken> {
    const kysely = this.db.getKysely()
    
    const tokenData = {
      identifier: verificationToken.identifier,
      token: verificationToken.token,
      expires: verificationToken.expires.toISOString(),
      created_at: new Date().toISOString(),
    }

    await kysely.insertInto('verification_tokens').values(tokenData).execute()

    return verificationToken
  }

  async useVerificationToken({ identifier, token }: { identifier: string; token: string }): Promise<VerificationToken | null> {
    const kysely = this.db.getKysely()
    
    const result = await kysely
      .selectFrom('verification_tokens')
      .selectAll()
      .where('identifier', '=', identifier)
      .where('token', '=', token)
      .where('expires', '>', new Date().toISOString())
      .executeTakeFirst()

    if (!result) return null

    // Delete the token after use
    await kysely
      .deleteFrom('verification_tokens')
      .where('identifier', '=', identifier)
      .where('token', '=', token)
      .execute()

    return {
      identifier: result.identifier as string,
      token: result.token as string,
      expires: new Date(result.expires as string),
    }
  }
}

describe('NextAuth NOORMME Adapter', () => {
  let db: NOORMME
  let adapter: TestNoormmeAdapter
  let dbPath: string

  beforeEach(async () => {
    // Create a unique database file for each test
    dbPath = path.join(process.cwd(), `test-nextauth-${Date.now()}.db`)
    
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

    // Create required NextAuth tables
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
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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

    await sql`
      CREATE TABLE verification_tokens (
        identifier TEXT NOT NULL,
        token TEXT NOT NULL,
        expires TEXT NOT NULL,
        created_at TEXT,
        PRIMARY KEY (identifier, token)
      )
    `.execute(kysely)

    adapter = new TestNoormmeAdapter(db)
  })

  afterEach(async () => {
    try {
      await fs.unlink(dbPath)
    } catch (e) {
      // File might not exist
    }
  })

  describe('User Management', () => {
    it('should create a user successfully', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        emailVerified: new Date(),
        image: 'https://example.com/avatar.jpg'
      }

      const user = await adapter.createUser(userData)

      expect(user.id).toBeDefined()
      expect(user.name).toBe(userData.name)
      expect(user.email).toBe(userData.email)
      expect(user.emailVerified).toEqual(userData.emailVerified)
      expect(user.image).toBe(userData.image)
    })

    it('should get a user by ID', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com'
      }

      const createdUser = await adapter.createUser(userData)
      const retrievedUser = await adapter.getUser(createdUser.id)

      expect(retrievedUser).toEqual(createdUser)
    })

    it('should return null for non-existent user', async () => {
      const user = await adapter.getUser('non-existent-id')
      expect(user).toBeNull()
    })

    it('should get a user by email', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com'
      }

      await adapter.createUser(userData)
      const retrievedUser = await adapter.getUserByEmail(userData.email!)

      expect(retrievedUser).toBeDefined()
      expect(retrievedUser!.email).toBe(userData.email)
    })

    it('should update a user', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com'
      }

      const createdUser = await adapter.createUser(userData)
      const updatedUser = await adapter.updateUser({
        id: createdUser.id,
        name: 'Updated User',
        email: 'updated@example.com'
      })

      expect(updatedUser.name).toBe('Updated User')
      expect(updatedUser.email).toBe('updated@example.com')
    })
  })

  describe('Account Management', () => {
    it('should link an account to a user', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com'
      }

      const user = await adapter.createUser(userData)

      const accountData = {
        id: 'account-id',
        userId: user.id,
        type: 'oauth',
        provider: 'github',
        providerAccountId: 'github-123',
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_at: Date.now() + 3600000,
        token_type: 'Bearer',
        scope: 'user:email',
        id_token: null,
        session_state: null
      }

      await expect(adapter.linkAccount(accountData)).resolves.not.toThrow()

      // Verify the account was linked
      const retrievedUser = await adapter.getUserByAccount({
        providerAccountId: accountData.providerAccountId,
        provider: accountData.provider
      })

      expect(retrievedUser).toBeDefined()
      expect(retrievedUser!.id).toBe(user.id)
    })

    it('should throw error when linking account to non-existent user', async () => {
      const accountData = {
        id: 'account-id',
        userId: 'non-existent-user-id',
        type: 'oauth',
        provider: 'github',
        providerAccountId: 'github-123'
      }

      await expect(adapter.linkAccount(accountData)).rejects.toThrow(
        'User with ID non-existent-user-id does not exist'
      )
    })
  })

  describe('Session Management', () => {
    it('should create a session', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com'
      }

      const user = await adapter.createUser(userData)

      const sessionData = {
        sessionToken: 'session-token-123',
        userId: user.id,
        expires: new Date(Date.now() + 3600000)
      }

      const session = await adapter.createSession(sessionData)

      expect(session.id).toBeDefined()
      expect(session.sessionToken).toBe(sessionData.sessionToken)
      expect(session.userId).toBe(user.id)
      expect(session.expires).toEqual(sessionData.expires)
    })

    it('should get session and user', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com'
      }

      const user = await adapter.createUser(userData)

      const sessionData = {
        sessionToken: 'session-token-123',
        userId: user.id,
        expires: new Date(Date.now() + 3600000)
      }

      await adapter.createSession(sessionData)
      const result = await adapter.getSessionAndUser(sessionData.sessionToken)

      expect(result).toBeDefined()
      expect(result!.session.sessionToken).toBe(sessionData.sessionToken)
      expect(result!.user.id).toBe(user.id)
    })

    it('should update a session', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com'
      }

      const user = await adapter.createUser(userData)

      const sessionData = {
        sessionToken: 'session-token-123',
        userId: user.id,
        expires: new Date(Date.now() + 3600000)
      }

      await adapter.createSession(sessionData)

      const newExpires = new Date(Date.now() + 7200000)
      const updatedSession = await adapter.updateSession({
        sessionToken: sessionData.sessionToken,
        expires: newExpires
      })

      expect(updatedSession).toBeDefined()
      expect(updatedSession!.expires).toEqual(newExpires)
    })

    it('should delete a session', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com'
      }

      const user = await adapter.createUser(userData)

      const sessionData = {
        sessionToken: 'session-token-123',
        userId: user.id,
        expires: new Date(Date.now() + 3600000)
      }

      await adapter.createSession(sessionData)
      await adapter.deleteSession(sessionData.sessionToken)

      const result = await adapter.getSessionAndUser(sessionData.sessionToken)
      expect(result).toBeNull()
    })
  })

  describe('Verification Token Management', () => {
    it('should create a verification token', async () => {
      const tokenData = {
        identifier: 'test@example.com',
        token: 'verification-token-123',
        expires: new Date(Date.now() + 3600000)
      }

      await adapter.createVerificationToken(tokenData)

      // Verify the token was created by trying to use it
      const usedToken = await adapter.useVerificationToken({
        identifier: tokenData.identifier,
        token: tokenData.token
      })

      expect(usedToken).toEqual(tokenData)
    })

    it('should return null for non-existent verification token', async () => {
      const result = await adapter.useVerificationToken({
        identifier: 'non-existent@example.com',
        token: 'non-existent-token'
      })

      expect(result).toBeNull()
    })

    it('should return null for expired verification token', async () => {
      const tokenData = {
        identifier: 'test@example.com',
        token: 'expired-token-123',
        expires: new Date(Date.now() - 3600000) // Expired
      }

      await adapter.createVerificationToken(tokenData)

      const result = await adapter.useVerificationToken({
        identifier: tokenData.identifier,
        token: tokenData.token
      })

      expect(result).toBeNull()
    })
  })

  describe('OAuth Flow Integration', () => {
    it('should handle complete OAuth flow', async () => {
      // Step 1: Create user (this happens after OAuth callback)
      const userData = {
        name: 'OAuth User',
        email: 'oauth@example.com',
        emailVerified: new Date()
      }

      const user = await adapter.createUser(userData)

      // Step 2: Link OAuth account
      const accountData = {
        id: 'oauth-account-id',
        userId: user.id,
        type: 'oauth',
        provider: 'github',
        providerAccountId: 'github-oauth-123',
        access_token: 'github-access-token',
        expires_at: Date.now() + 3600000,
        token_type: 'Bearer',
        scope: 'user:email'
      }

      await adapter.linkAccount(accountData)

      // Step 3: Create session
      const sessionData = {
        sessionToken: 'oauth-session-token',
        userId: user.id,
        expires: new Date(Date.now() + 3600000)
      }

      const session = await adapter.createSession(sessionData)

      // Step 4: Verify complete flow
      const retrievedUser = await adapter.getUserByAccount({
        providerAccountId: accountData.providerAccountId,
        provider: accountData.provider
      })

      const sessionAndUser = await adapter.getSessionAndUser(sessionData.sessionToken)

      expect(retrievedUser).toBeDefined()
      expect(retrievedUser!.id).toBe(user.id)
      expect(sessionAndUser).toBeDefined()
      expect(sessionAndUser!.user.id).toBe(user.id)
      expect(sessionAndUser!.session.sessionToken).toBe(sessionData.sessionToken)
    })
  })

  describe('Error Handling', () => {
    it('should handle database initialization errors gracefully', async () => {
      // Test with corrupted database path
      const corruptedDb = new NOORMME({
        dialect: 'sqlite',
        connection: {
          host: '',
          port: 0,
          username: '',
          password: '',
          database: '/invalid/path/to/database.db'
        }
      })

      // Should not throw during initialization due to our fixes
      await expect(corruptedDb.initialize()).resolves.not.toThrow()
    })

    it('should handle missing tables gracefully', async () => {
      // Create database without required tables
      const emptyDb = new NOORMME({
        dialect: 'sqlite',
        connection: {
          host: '',
          port: 0,
          username: '',
          password: '',
          database: path.join(process.cwd(), `test-empty-${Date.now()}.db`)
        }
      })

      await emptyDb.initialize()

      const emptyAdapter = new TestNoormmeAdapter(emptyDb)

      // Should handle missing tables gracefully
      await expect(emptyAdapter.getUser('test-id')).resolves.toBeNull()
    })
  })
})
