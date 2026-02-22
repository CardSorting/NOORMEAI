import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { HiveLink } from '../../src/agentic/improvement/HiveLink.js'
import { Cortex } from '../../src/agentic/Cortex.js'

describe('HiveLink', () => {
    let db: NOORMME
    let hive: HiveLink
    let cortex: Cortex

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        // Create knowledge table
        await kysely.schema
            .createTable('agent_knowledge_base')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('entity', 'varchar(255)', col => col.notNull())
            .addColumn('fact', 'text', col => col.notNull())
            .addColumn('confidence', 'real', col => col.notNull())
            .addColumn('status', 'varchar(50)', col => col.notNull().defaultTo('verified'))
            .addColumn('source_session_id', 'varchar(255)')
            .addColumn('tags', 'text') // JSON
            .addColumn('metadata', 'text') // JSON
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        cortex = {} as any
        hive = new HiveLink(kysely, cortex)
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    const createKnowledge = async (entity: string, fact: string, confidence: number, sessionId: string | null = null, tags: string[] = [], status: string = 'verified') => {
        return await db.getKysely()
            .insertInto('agent_knowledge_base')
            .values({
                entity,
                fact,
                confidence,
                status,
                source_session_id: sessionId,
                tags: JSON.stringify(tags),
                metadata: '{}',
                created_at: new Date(),
                updated_at: new Date()
            } as any)
            .returningAll()
            .executeTakeFirst() as any
    }

    describe('broadcastKnowledge', () => {
        it('should promote local high-confidence knowledge to global', async () => {
            // Local knowledge
            await createKnowledge('Sky', 'Blue', 0.95, 'session_1')

            // Global knowledge shouldn't exist yet
            const globalsBefore = await db.getKysely().selectFrom('agent_knowledge_base').selectAll().where('source_session_id', 'is', null).execute()
            expect(globalsBefore).toHaveLength(0)

            const promoted = await hive.broadcastKnowledge(0.9)
            expect(promoted).toBe(1)

            // Verify promotion
            const globalsAfter = await db.getKysely().selectFrom('agent_knowledge_base').selectAll().where('source_session_id', 'is', null).execute() as any[]
            expect(globalsAfter).toHaveLength(1)
            expect(globalsAfter[0].entity).toBe('Sky')
            expect(globalsAfter[0].confidence).toBe(0.95)
            const tags = JSON.parse(globalsAfter[0].tags)
            expect(tags).toContain('hive_mind')
        })

        it('should reinforce existing global knowledge', async () => {
            // Existing global
            await createKnowledge('Sky', 'Blue', 0.8, null, ['hive_mind'])
            // New local high confidence
            await createKnowledge('Sky', 'Blue', 0.95, 'session_2')

            const count = await hive.broadcastKnowledge(0.9)
            expect(count).toBe(0) // 0 new promotions

            const globals = await db.getKysely().selectFrom('agent_knowledge_base').selectAll().where('source_session_id', 'is', null).executeTakeFirst() as any
            // Should be boosted: max(0.8, 0.95) + 0.01 = 0.96
            expect(globals.confidence).toBeCloseTo(0.96)
        })
    })

    describe('syncDomain', () => {
        it('should boost confidence of items with matching tag', async () => {
            await createKnowledge('React', 'Library', 0.5, 's1', ['frontend'])
            await createKnowledge('Node', 'Runtime', 0.6, 's1', ['backend'])

            const updated = await hive.syncDomain('frontend', 0.1)
            expect(updated).toBe(1)

            const react = await db.getKysely().selectFrom('agent_knowledge_base').selectAll().where('entity', '=', 'React').executeTakeFirst() as any
            expect(react.confidence).toBeCloseTo(0.6)

            const node = await db.getKysely().selectFrom('agent_knowledge_base').selectAll().where('entity', '=', 'Node').executeTakeFirst() as any
            expect(node.confidence).toBe(0.6) // Unchanged
        })
    })

    describe('broadcastSkills', () => {
        beforeEach(async () => {
            const kysely = db.getKysely()
            await kysely.schema
                .createTable('agent_capabilities')
                .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
                .addColumn('name', 'varchar(255)', col => col.notNull())
                .addColumn('version', 'varchar(50)', col => col.notNull())
                .addColumn('reliability', 'real', col => col.notNull())
                .addColumn('status', 'varchar(50)', col => col.notNull())
                .addColumn('metadata', 'text')
                .execute()
        })

        it('should resolve conflicts using Survival of the Fittest (reliability)', async () => {
            const kysely = db.getKysely()

            // 1. Existing global "fit" skill
            await kysely.insertInto('agent_capabilities' as any).values({
                name: 'search_mutated_v1',
                version: '1.0.0',
                reliability: 0.95,
                status: 'verified',
                metadata: JSON.stringify({ broadcasted: true, hive_verified: true })
            } as any).execute()

            // 2. Local "weak" skill (already in DB for update)
            await kysely.insertInto('agent_capabilities' as any).values({
                id: 10,
                name: 'search_mutated_v2',
                version: '1.1.0',
                reliability: 0.8,
                status: 'verified',
                metadata: JSON.stringify({ mutatedFrom: 'search' })
            } as any).execute()

            // 3. Local "strong" skill (already in DB for update)
            await kysely.insertInto('agent_capabilities' as any).values({
                id: 11,
                name: 'coding_mutated_v2',
                version: '1.1.0',
                reliability: 0.99,
                status: 'verified',
                metadata: JSON.stringify({ mutatedFrom: 'coding' })
            } as any).execute()

            const weakSkill = { id: 10, name: 'search_mutated_v2', reliability: 0.8, status: 'verified', metadata: { mutatedFrom: 'search' }, version: '1.1.0' };
            const strongSkill = { id: 11, name: 'coding_mutated_v2', reliability: 0.99, status: 'verified', metadata: { mutatedFrom: 'coding' }, version: '1.1.0' };

            // Mock Cortex behavior
            (cortex as any).capabilities = {
                getCapabilities: async (status: string) => status === 'verified' ? [weakSkill as any, strongSkill as any] : []
            };

            const broadcasted = await hive.broadcastSkills();
            expect(broadcasted).toBe(1); // Only strongSkill should broadcast

            const results = await kysely.selectFrom('agent_capabilities' as any).selectAll().execute() as any[];
            const strongBroadcast = results.find(r => r.id === 11);
            const weakBroadcast = results.find(r => r.id === 10);

            expect(JSON.parse(strongBroadcast.metadata).broadcasted).toBe(true)
            expect(JSON.parse(weakBroadcast.metadata).broadcasted).toBeUndefined();
        })
    })
})
