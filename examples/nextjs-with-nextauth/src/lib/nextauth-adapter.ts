import type { Adapter, AdapterAccount, AdapterSession, AdapterUser, VerificationToken } from 'next-auth/adapters'
import type { NOORMME } from 'noormme'

export function NoormmeAdapter(db: NOORMME): Adapter {
  return {
    async createUser(user: Omit<AdapterUser, 'id'>) {
      const userRepo = db.getRepository('users')
      
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
    },

    async getUser(id: string) {
      const userRepo = db.getRepository('users')
      const user = await userRepo.findById(id) as Record<string, unknown> | null
      
      if (!user) return null

      return {
        id: user.id as string,
        name: user.name as string | null,
        email: user.email as string,
        emailVerified: user.email_verified ? new Date(user.email_verified as string) : null,
        image: user.image as string | null,
      }
    },

    async getUserByEmail(email: string) {
      const userRepo = db.getRepository('users')
      const user = await userRepo.findByEmail(email) as Record<string, unknown> | null
      
      if (!user) return null

      return {
        id: user.id as string,
        name: user.name as string | null,
        email: user.email as string,
        emailVerified: user.email_verified ? new Date(user.email_verified as string) : null,
        image: user.image as string | null,
      }
    },

    async getUserByAccount({ providerAccountId, provider }) {
      const kysely = db.getKysely()
      
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
    },

    async updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, 'id'>) {
      const kysely = db.getKysely()
      
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString()
      }

      if (user.name) updateData.name = user.name
      if (user.email) updateData.email = user.email
      if (user.emailVerified) updateData.email_verified = user.emailVerified.toISOString()
      if (user.image) updateData.image = user.image

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
    },

    async deleteUser(userId: string) {
      const kysely = db.getKysely()
      
      await kysely
        .deleteFrom('users')
        .where('id', '=', userId)
        .execute()
    },

    async linkAccount(account: AdapterAccount) {
      const kysely = db.getKysely()
      
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

      const createdAccount = await kysely
        .insertInto('accounts')
        .values(accountData)
        .returningAll()
        .executeTakeFirst()

      return {
        userId: createdAccount.user_id as string,
        type: createdAccount.type as string,
        provider: createdAccount.provider as string,
        providerAccountId: createdAccount.provider_account_id as string,
        refresh_token: createdAccount.refresh_token as string | null,
        access_token: createdAccount.access_token as string | null,
        expires_at: createdAccount.expires_at as number | null,
        token_type: createdAccount.token_type as string | null,
        scope: createdAccount.scope as string | null,
        id_token: createdAccount.id_token as string | null,
        session_state: createdAccount.session_state as string | null,
      }
    },

    async unlinkAccount({ providerAccountId, provider }) {
      const kysely = db.getKysely()
      
      const account = await kysely
        .selectFrom('accounts')
        .selectAll()
        .where('provider', '=', provider)
        .where('provider_account_id', '=', providerAccountId)
        .executeTakeFirst()

      if (account) {
        await kysely
          .deleteFrom('accounts')
          .where('provider', '=', provider)
          .where('provider_account_id', '=', providerAccountId)
          .execute()
      }

      return account as AdapterAccount | undefined
    },

    async createSession({ sessionToken, userId, expires }) {
      const kysely = db.getKysely()
      
      const sessionData = {
        id: crypto.randomUUID(),
        session_token: sessionToken,
        user_id: userId,
        expires: expires.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const createdSession = await kysely
        .insertInto('sessions')
        .values(sessionData)
        .returningAll()
        .executeTakeFirst()

      return {
        sessionToken: createdSession.session_token as string,
        userId: createdSession.user_id as string,
        expires: new Date(createdSession.expires as string),
      }
    },

    async getSessionAndUser(sessionToken: string) {
      const kysely = db.getKysely()
      
      const result = await kysely
        .selectFrom('sessions')
        .innerJoin('users', 'users.id', 'sessions.user_id')
        .selectAll('users')
        .select([
          'sessions.session_token',
          'sessions.expires'
        ])
        .where('sessions.session_token', '=', sessionToken)
        .executeTakeFirst()

      if (!result) return null

      return {
        session: {
          sessionToken: result.session_token as string,
          userId: result.id as string,
          expires: new Date(result.expires as string),
        },
        user: {
          id: result.id as string,
          name: result.name as string | null,
          email: result.email as string,
          emailVerified: result.email_verified ? new Date(result.email_verified as string) : null,
          image: result.image as string | null,
        }
      }
    },

    async updateSession({ sessionToken, ...data }) {
      const kysely = db.getKysely()
      
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString()
      }

      if (data.expires) updateData.expires = data.expires.toISOString()

      const updatedSession = await kysely
        .updateTable('sessions')
        .set(updateData)
        .where('session_token', '=', sessionToken)
        .returningAll()
        .executeTakeFirst()

      if (!updatedSession) return null

      return {
        sessionToken: updatedSession.session_token as string,
        userId: updatedSession.user_id as string,
        expires: new Date(updatedSession.expires as string),
      }
    },

    async deleteSession(sessionToken: string) {
      const kysely = db.getKysely()
      
      const session = await kysely
        .selectFrom('sessions')
        .selectAll()
        .where('session_token', '=', sessionToken)
        .executeTakeFirst()

      if (session) {
        await kysely
          .deleteFrom('sessions')
          .where('session_token', '=', sessionToken)
          .execute()
      }

      return session as AdapterSession | undefined
    },

    async createVerificationToken({ identifier, expires, token }) {
      const kysely = db.getKysely()
      
      const verificationData = {
        identifier,
        token,
        expires: expires.toISOString(),
        created_at: new Date().toISOString(),
      }

      const createdToken = await kysely
        .insertInto('verification_tokens')
        .values(verificationData)
        .returningAll()
        .executeTakeFirst()

      return {
        identifier: createdToken.identifier as string,
        token: createdToken.token as string,
        expires: new Date(createdToken.expires as string),
      }
    },

    async useVerificationToken({ identifier, token }) {
      const kysely = db.getKysely()
      
      const verificationToken = await kysely
        .selectFrom('verification_tokens')
        .selectAll()
        .where('identifier', '=', identifier)
        .where('token', '=', token)
        .executeTakeFirst()

      if (verificationToken) {
        await kysely
          .deleteFrom('verification_tokens')
          .where('identifier', '=', identifier)
          .where('token', '=', token)
          .execute()
      }

      return verificationToken as VerificationToken | undefined
    },
  }
}
