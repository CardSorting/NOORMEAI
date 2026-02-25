import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { Cortex } from '../../src/agentic/Cortex.js'

describe('Integration Test: Cortex Lifecycle', () => {
    let db: NOORMME
    let cortex: Cortex

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        // Setup the full schema required by Cortex subsystems
        await kysely.schema.createTable('agent_sessions').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('name', 'varchar(255)')
            .addColumn('status', 'varchar(50)', col => col.notNull())
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        await kysely.schema.createTable('agent_messages').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer', col => col.notNull())
            .addColumn('role', 'varchar(50)', col => col.notNull())
            .addColumn('content', 'text', col => col.notNull())
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        await kysely.schema.createTable('agent_goals').ifNotExists()
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

        await kysely.schema.createTable('agent_memories').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer')
            .addColumn('content', 'text', col => col.notNull())
            .addColumn('embedding', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        await kysely.schema.createTable('agent_epochs').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer', col => col.notNull())
            .addColumn('summary', 'text', col => col.notNull())
            .addColumn('start_message_id', 'integer', col => col.notNull())
            .addColumn('end_message_id', 'integer', col => col.notNull())
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        await kysely.schema.createTable('agent_metrics').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer')
            .addColumn('agent_id', 'varchar(255)')
            .addColumn('metric_name', 'varchar(255)')
            .addColumn('metric_value', 'real')
            .addColumn('unit', 'varchar(50)')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        await kysely.schema.createTable('agent_knowledge_base').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('entity', 'varchar(255)')
            .addColumn('fact', 'text')
            .addColumn('confidence', 'real')
            .addColumn('status', 'varchar(50)')
            .addColumn('tags', 'text')
            .addColumn('metadata', 'text')
            .addColumn('source_session_id', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()'))
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()'))
            .execute()

        await kysely.schema.createTable('agent_capabilities').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('name', 'varchar(255)')
            .addColumn('status', 'varchar(50)')
            .addColumn('reliability', 'real')
            .addColumn('metadata', 'text')
            .addColumn('description', 'text')
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()'))
            .execute()

        await kysely.schema.createTable('agent_personas').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('name', 'varchar(255)')
            .addColumn('role', 'text')
            .addColumn('capabilities', 'text')
            .addColumn('policies', 'text')
            .addColumn('metadata', 'text')
            .addColumn('status', 'varchar(50)')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()'))
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()'))
            .execute()

        await kysely.schema.createTable('agent_actions').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'text')
            .addColumn('tool_name', 'text')
            .addColumn('status', 'text')
            .addColumn('result', 'text')
            .addColumn('outcome', 'text')
            .addColumn('arguments', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()'))
            .execute()

        await kysely.schema.createTable('agent_reflections').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'text')
            .addColumn('outcome', 'varchar(50)')
            .addColumn('summary', 'text')
            .addColumn('lessons_learned', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()'))
            .execute()

        await kysely.schema.createTable('agent_snapshots').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('name', 'varchar(255)')
            .addColumn('dna', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()'))
            .execute()

        cortex = new Cortex(kysely, { agentic: { dialect: 'sqlite', evolutionLookbackHours: 100 } } as any)
    }, 30000)

    afterEach(async () => {
        await cleanupTestDatabase(db)
    }, 30000)

    describe('Cortex Initialization', () => {
        it('should create Cortex with core subsystems accessible', () => {
            expect(cortex.sessions).toBeDefined()
            expect(cortex.buffer).toBeDefined()
            expect(cortex.knowledge).toBeDefined()
            expect(cortex.metrics).toBeDefined()
        })
    })

    describe('Session → Message flow', () => {
        it('should create a session, add messages, and retrieve history', async () => {
            // 1. Create session
            const session = await cortex.sessions.createSession('Lifecycle Test')
            expect(session.id).toBeDefined()
            expect(session.status).toBe('active')

            // 2. Add messages
            for (let i = 0; i < 5; i++) {
                const role = i % 2 === 0 ? 'user' : 'assistant'
                await cortex.sessions.addMessage(session.id, role as any, `Message ${i}`)
            }

            // 3. Verify history
            const history = await cortex.sessions.getHistory(session.id)
            expect(history).toHaveLength(5)
        })
    })

    describe('Session → Epoch compression', () => {
        it('should compress messages into an epoch', async () => {
            const session = await cortex.sessions.createSession('Epoch Test')

            for (let i = 0; i < 5; i++) {
                await cortex.sessions.addMessage(session.id, 'user' as any, `Epoch msg ${i}`)
            }

            const history = await cortex.sessions.getHistory(session.id)

            const epoch = await cortex.compressor.compress(
                session.id,
                'Summary of conversation',
                history[0].id,
                history[history.length - 1].id,
                ['key_message'],
            )

            expect(epoch.sessionId).toBe(session.id)
            expect(epoch.summary).toContain('Summary')

            const epochs = await cortex.compressor.getEpochs(session.id)
            expect(epochs).toHaveLength(1)
        })
    })

    describe('recordInteraction', () => {
        it('should store a user message in the session', async () => {
            const session = await cortex.sessions.createSession('Interaction Test')

            await cortex.recordInteraction(session.id, 'user', 'Hello Cortex!')

            const history = await cortex.sessions.getHistory(session.id)
            expect(history).toHaveLength(1)
            expect(history[0].role).toBe('user')
            expect(history[0].content).toBe('Hello Cortex!')
        })
    })

    describe('resumeSession', () => {
        it('should load history into the context buffer', async () => {
            const session = await cortex.sessions.createSession('Resume Test')

            for (let i = 0; i < 3; i++) {
                await cortex.sessions.addMessage(session.id, 'user', `Msg ${i}`)
            }

            const messages = await cortex.resumeSession(session.id)
            expect(messages).toHaveLength(3)
        })
    })
})
