import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { AblationEngine } from '../../src/agentic/improvement/AblationEngine.js'
import { Cortex } from '../../src/agentic/Cortex.js'

describe('AblationEngine', () => {
    let db: NOORMME
    let engine: AblationEngine
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
            .addColumn('source_session_id', 'varchar(255)')
            .addColumn('metadata', 'text') // JSON
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        // Create links table
        await kysely.schema
            .createTable('agent_knowledge_links')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('source_id', 'integer', col => col.notNull())
            .addColumn('target_id', 'integer', col => col.notNull())
            .addColumn('relationship', 'varchar(255)')
            .execute()

        // Create memories table
        await kysely.schema
            .createTable('agent_memories')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('content', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        cortex = {
            reflections: {
                reflect: async () => ({})
            },
            knowledge: {
                parseKnowledge: (k: any) => k,
                calculateFitness: (k: any) => k.entity === 'Ghost' ? 0.1 : 1.0
            }
        } as any
        
        engine = new AblationEngine(kysely, cortex)
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    describe('pruneZombies', () => {
        it('should prune old items that are not linked', async () => {
            const kysely = db.getKysely()
            const oldDate = new Date(Date.now() - 40 * 24 * 3600000)

            // Item 1: Old and not linked (ZOMBIE)
            await kysely.insertInto('agent_knowledge_base').values({
                entity: 'Ghost', fact: 'Exists', confidence: 0.1, updated_at: oldDate
            } as any).execute()

            // Item 2: Old but LINKED (NOT ZOMBIE)
            const linked = await kysely.insertInto('agent_knowledge_base').values({
                entity: 'Sun', fact: 'Hot', confidence: 1.0, updated_at: oldDate
            } as any).returningAll().executeTakeFirst() as any
            
            await kysely.insertInto('agent_knowledge_links').values({
                source_id: linked.id, target_id: 999, relationship: 'related'
            } as any).execute()

            const pruned = await engine.pruneZombies(30)
            expect(pruned).toBe(1) // Only Ghost should be pruned

            const remaining = await kysely.selectFrom('agent_knowledge_base').selectAll().execute()
            expect(remaining).toHaveLength(1)
            expect(remaining[0].entity).toBe('Sun')
        })
    })

    describe('testAblation and recovery', () => {
        it('should temporarily ablate and then recover an item', async () => {
            const kysely = db.getKysely()
            const item = await kysely.insertInto('agent_knowledge_base').values({
                entity: 'Sky', fact: 'Blue', confidence: 0.9, updated_at: new Date()
            } as any).returningAll().executeTakeFirst() as any

            await engine.testAblation(item.id)
            
            const ablated = await kysely.selectFrom('agent_knowledge_base').selectAll().where('id', '=', item.id).executeTakeFirst() as any
            expect(ablated.confidence).toBe(0)
            expect(JSON.parse(ablated.metadata).ablation_test).toBe(true)

            await engine.recoverAblatedItem(item.id)
            
            const recovered = await kysely.selectFrom('agent_knowledge_base').selectAll().where('id', '=', item.id).executeTakeFirst() as any
            expect(recovered.confidence).toBe(0.9)
            expect(JSON.parse(recovered.metadata).ablation_test).toBeUndefined()
        })
    })
})
