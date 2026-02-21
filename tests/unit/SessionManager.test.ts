import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { SessionManager } from '../../src/agentic/SessionManager.js'

describe('SessionManager', () => {
    let db: NOORMME
    let manager: SessionManager

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        // Create sessions table
        await kysely.schema
            .createTable('agent_sessions')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('name', 'varchar(255)')
            .addColumn('status', 'varchar(50)', col => col.notNull())
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        // Create messages table
        await kysely.schema
            .createTable('agent_messages')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer', col => col.notNull())
            .addColumn('role', 'varchar(50)', col => col.notNull())
            .addColumn('content', 'text', col => col.notNull())
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        // Create goals table
        await kysely.schema
            .createTable('agent_goals')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer', col => col.notNull())
            .addColumn('parent_id', 'integer')
            .addColumn('description', 'text', col => col.notNull())
            .addColumn('status', 'varchar(50)', col => col.notNull())
            .addColumn('priority', 'integer', col => col.notNull())
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        // Create memories table (empty for cascade check)
        await kysely.schema
            .createTable('agent_memories')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer')
            .execute()

        manager = new SessionManager(kysely)
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    it('should create and retrieve a session', async () => {
        const session = await manager.createSession('Test Session')
        expect(session.name).toBe('Test Session')
        expect(session.status).toBe('active')

        const retrieved = await manager.getSession(session.id)
        expect(retrieved?.id).toBe(session.id)
    })

    it('should handle message history and session updates', async () => {
        const session = await manager.createSession()
        const initialUpdatedAt = session.updatedAt

        // Small delay to ensure timestamp difference
        await new Promise(r => setTimeout(resolve => r(resolve), 10))

        await manager.addMessage(session.id, 'user', 'Hello')
        await manager.addMessage(session.id, 'assistant', 'Hi')

        const history = await manager.getHistory(session.id)
        expect(history).toHaveLength(2)
        expect(history[0].role).toBe('user')

        const updatedSession = await manager.getSession(session.id)
        expect(updatedSession?.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime())
    })

    it('should upsert goals', async () => {
        const session = await manager.createSession()
        
        await manager.upsertGoal(session.id, 'Initial Goal', { priority: 1 })
        const goals = await manager.getGoals(session.id)
        expect(goals).toHaveLength(1)
        expect(goals[0].description).toBe('Initial Goal')

        await manager.upsertGoal(session.id, 'Initial Goal', { status: 'completed' })
        const updatedGoals = await manager.getGoals(session.id)
        expect(updatedGoals[0].status).toBe('completed')
    })

    it('should delete a session and cascade', async () => {
        const session = await manager.createSession()
        await manager.addMessage(session.id, 'user', 'Delete me')
        await manager.upsertGoal(session.id, 'Goal to delete')

        await manager.deleteSession(session.id)

        expect(await manager.getSession(session.id)).toBeNull()
        const messages = await db.getKysely().selectFrom('agent_messages').selectAll().where('session_id', '=', session.id).execute()
        expect(messages).toHaveLength(0)
    })
})
