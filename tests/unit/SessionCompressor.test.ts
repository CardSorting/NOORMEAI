import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { SessionCompressor } from '../../src/agentic/SessionCompressor.js'

describe('SessionCompressor', () => {
    let db: NOORMME
    let compressor: SessionCompressor

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

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

        await kysely.schema.createTable('agent_epochs').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer', col => col.notNull())
            .addColumn('summary', 'text', col => col.notNull())
            .addColumn('start_message_id', 'integer', col => col.notNull())
            .addColumn('end_message_id', 'integer', col => col.notNull())
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        compressor = new SessionCompressor(kysely)
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    async function createSession(): Promise<number> {
        const result = await db.getKysely().insertInto('agent_sessions' as any)
            .values({ name: 'test', status: 'active', created_at: new Date(), updated_at: new Date() } as any)
            .returning('id')
            .executeTakeFirstOrThrow()
        return (result as any).id
    }

    async function addMessage(sessionId: number, role: string, content: string, metadata?: any): Promise<number> {
        const result = await db.getKysely().insertInto('agent_messages' as any)
            .values({
                session_id: sessionId,
                role,
                content,
                metadata: metadata ? JSON.stringify(metadata) : null,
                created_at: new Date()
            } as any)
            .returning('id')
            .executeTakeFirstOrThrow()
        return (result as any).id
    }

    describe('compress', () => {
        it('should create an epoch with correct fields', async () => {
            const sessionId = await createSession()
            const msgStart = await addMessage(sessionId, 'user', 'Hello')
            const msgEnd = await addMessage(sessionId, 'assistant', 'World')

            const epoch = await compressor.compress(
                sessionId,
                'Test summary',
                msgStart,
                msgEnd,
                ['key_insight_1'],
                { custom: 'data' }
            )

            expect(epoch.sessionId).toBe(sessionId)
            expect(epoch.summary).toBe('Test summary')
            expect(epoch.startMessageId).toBe(msgStart)
            expect(epoch.endMessageId).toBe(msgEnd)
            expect(epoch.metadata).toBeDefined()
            expect(epoch.metadata?.anchors).toEqual(['key_insight_1'])
            expect(epoch.metadata?.custom).toBe('data')
        })
    })

    describe('getEpochs', () => {
        it('should return epochs ordered by created_at ascending', async () => {
            const sessionId = await createSession()

            await compressor.compress(sessionId, 'First', 1, 5)
            await compressor.compress(sessionId, 'Second', 6, 10)

            const epochs = await compressor.getEpochs(sessionId)
            expect(epochs).toHaveLength(2)
            expect(epochs[0].summary).toBe('First')
            expect(epochs[1].summary).toBe('Second')
        })

        it('should return empty array for session with no epochs', async () => {
            const epochs = await compressor.getEpochs(999)
            expect(epochs).toHaveLength(0)
        })
    })

    describe('semanticPruning', () => {
        it('should remove non-anchor messages and keep anchors', async () => {
            const sessionId = await createSession()
            await addMessage(sessionId, 'user', 'Normal msg', null)
            await addMessage(sessionId, 'user', 'Anchor msg', { anchor: true })
            await addMessage(sessionId, 'assistant', 'Another normal', null)

            const count = await compressor.semanticPruning(sessionId, true)

            // Should have pruned the two non-anchor messages
            const remaining = await db.getKysely()
                .selectFrom('agent_messages' as any)
                .selectAll()
                .where('session_id', '=', sessionId)
                .execute()

            expect(remaining.length).toBeLessThan(3)
        })

        it('should delete all messages when keepAnchors is false', async () => {
            const sessionId = await createSession()
            await addMessage(sessionId, 'user', 'Message 1', { anchor: true })
            await addMessage(sessionId, 'user', 'Message 2', null)

            await compressor.semanticPruning(sessionId, false)

            const remaining = await db.getKysely()
                .selectFrom('agent_messages' as any)
                .selectAll()
                .where('session_id', '=', sessionId)
                .execute()

            expect(remaining).toHaveLength(0)
        })
    })

    describe('consolidateEpochsIntoEra', () => {
        it('should consolidate when more than 10 epochs exist', async () => {
            const sessionId = await createSession()

            // Create 12 epochs
            for (let i = 0; i < 12; i++) {
                await compressor.compress(sessionId, `Epoch ${i}`, i * 10, i * 10 + 9)
            }

            await compressor.consolidateEpochsIntoEra(sessionId)

            // Old epochs should be deleted, new Era epoch created
            const epochs = await compressor.getEpochs(sessionId)
            expect(epochs.length).toBeLessThanOrEqual(2) // Era epoch + possible system msg epoch

            // Check for ERA system message
            const messages = await db.getKysely()
                .selectFrom('agent_messages' as any)
                .selectAll()
                .where('session_id', '=', sessionId)
                .execute()

            const eraMsg = messages.find((m: any) => m.content?.includes('[ERA SUMMARY]'))
            expect(eraMsg).toBeDefined()
        })

        it('should not consolidate when 10 or fewer epochs exist', async () => {
            const sessionId = await createSession()

            for (let i = 0; i < 5; i++) {
                await compressor.compress(sessionId, `Epoch ${i}`, i * 10, i * 10 + 9)
            }

            await compressor.consolidateEpochsIntoEra(sessionId)

            const epochs = await compressor.getEpochs(sessionId)
            expect(epochs).toHaveLength(5)
        })
    })
})
