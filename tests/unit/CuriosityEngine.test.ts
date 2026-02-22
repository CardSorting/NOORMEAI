import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { CuriosityEngine } from '../../src/agentic/improvement/CuriosityEngine.js'

describe('CuriosityEngine', () => {
    let db: NOORMME
    let engine: CuriosityEngine

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
            .addColumn('status', 'varchar(50)', col => col.notNull())
            .addColumn('tags', 'text') // JSON
            .execute()

        // Create memories table
        await kysely.schema
            .createTable('agent_memories')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('entity', 'varchar(255)')
            .execute()

        // Create metrics table for hotspot detection
        await kysely.schema
            .createTable('agent_metrics')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('metric_name', 'varchar(100)', col => col.notNull())
            .addColumn('metric_value', 'real', col => col.notNull())
            .addColumn('metadata', 'text')
            .execute()

        engine = new CuriosityEngine(kysely)
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    describe('identifyKnowledgeGaps', () => {
        it('should detect contradictions', async () => {
            const kysely = db.getKysely()

            // Two high-confidence contradictory facts for the same entity
            await kysely.insertInto('agent_knowledge_base').values([
                { entity: 'Mars', fact: 'The surface of Mars is primarily composed of red dust.', confidence: 0.9, status: 'verified' },
                { entity: 'Mars', fact: 'The surface of Mars is primarily composed of blue crystal.', confidence: 0.85, status: 'verified' }
            ] as any).execute()

            const gaps = await engine.identifyKnowledgeGaps()
            const contradiction = gaps.find(g => g.type === 'contradiction')

            expect(contradiction).toBeDefined()
            expect(contradiction?.entity).toBe('Mars')
        })

        it('should detect low confidence facts', async () => {
            const kysely = db.getKysely()
            await kysely.insertInto('agent_knowledge_base').values({
                entity: 'Venus', fact: 'Hot', confidence: 0.2, status: 'proposed'
            } as any).execute()

            const gaps = await engine.identifyKnowledgeGaps()
            expect(gaps.some(g => g.type === 'low_confidence')).toBe(true)
        })
    })

    describe('identifyKnowledgeHotspots', () => {
        it('should detect hotspots with high memory references but low fact count', async () => {
            const kysely = db.getKysely()

            // Reference 'Jupiter' 10 times in memories
            for (let i = 0; i < 10; i++) {
                await kysely.insertInto('agent_memories').values({ entity: 'Jupiter' } as any).execute()
            }

            // Only 1 fact for 'Jupiter'
            await kysely.insertInto('agent_knowledge_base').values({
                entity: 'Jupiter', fact: 'Large', confidence: 1.0, status: 'verified'
            } as any).execute()

            // Record hits in agent_metrics using the hardened naming convention
            for (let i = 0; i < 5; i++) {
                await kysely.insertInto('agent_metrics').values({
                    metric_name: 'entity_hit_Jupiter',
                    metric_value: 1,
                    metadata: JSON.stringify({ entity: 'Jupiter' })
                } as any).execute()
            }

            const hotspots = await engine.identifyKnowledgeHotspots()
            expect(hotspots).toHaveLength(1)
            expect(hotspots[0].entity).toBe('Jupiter')
        })
    })
})
