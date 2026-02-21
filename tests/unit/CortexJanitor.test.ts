import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { CortexJanitor } from '../../src/agentic/improvement/CortexJanitor.js'

describe('CortexJanitor', () => {
    let db: NOORMME
    let janitor: CortexJanitor

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        // Create sessions table
        await kysely.schema
            .createTable('agent_sessions')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('status', 'varchar(50)', col => col.notNull())
            .addColumn('updated_at', 'timestamp', col => col.notNull())
            .execute()

        // Create messages table
        await kysely.schema
            .createTable('agent_messages')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer')
            .execute()

        // Create rituals table
        await kysely.schema
            .createTable('agent_rituals')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('name', 'varchar(255)')
            .addColumn('type', 'varchar(50)')
            .addColumn('status', 'varchar(50)')
            .addColumn('last_run', 'timestamp')
            .addColumn('metadata', 'text')
            .execute()

        janitor = new CortexJanitor(kysely)
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    it('should clean orphan messages', async () => {
        const kysely = db.getKysely()
        // Create a session
        const session = await kysely.insertInto('agent_sessions').values({ status: 'active', updated_at: new Date() } as any).returningAll().executeTakeFirst() as any
        
        // Valid message
        await kysely.insertInto('agent_messages').values({ session_id: session.id } as any).execute()
        // Orphan message
        await kysely.insertInto('agent_messages').values({ session_id: 999 } as any).execute()

        const cleaned = await janitor.cleanOrphans()
        expect(cleaned).toBe(1)

        const remaining = await kysely.selectFrom('agent_messages').selectAll().execute()
        expect(remaining).toHaveLength(1)
    })

    it('should archive inactive sessions', async () => {
        const kysely = db.getKysely()
        const oldDate = new Date(Date.now() - 40 * 24 * 3600000) // 40 days ago
        
        await kysely.insertInto('agent_sessions').values({ status: 'active', updated_at: oldDate } as any).execute()
        await kysely.insertInto('agent_sessions').values({ status: 'active', updated_at: new Date() } as any).execute()

        const archived = await janitor.archiveInactiveSessions(30)
        expect(archived).toBe(1)

        const statuses = await kysely.selectFrom('agent_sessions').select('status').execute()
        expect(statuses.map(s => s.status)).toContain('archived')
        expect(statuses.map(s => s.status)).toContain('active')
    })
})
