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
            .addColumn('tags', 'text') // JSON
            .execute()

        // Create memories table
        await kysely.schema
            .createTable('agent_memories')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('entity', 'varchar(255)')
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
                { entity: 'Mars', fact: 'Red', confidence: 0.9 },
                { entity: 'Mars', fact: 'Blue', confidence: 0.85 }
            ] as any).execute()

            const gaps = await engine.identifyKnowledgeGaps()
            const contradiction = gaps.find(g => g.type === 'contradiction')
            
            expect(contradiction).toBeDefined()
            expect(contradiction?.entity).toBe('Mars')
        })

        it('should detect low confidence facts', async () => {
            const kysely = db.getKysely()
            await kysely.insertInto('agent_knowledge_base').values({
                entity: 'Venus', fact: 'Hot', confidence: 0.2
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
                entity: 'Jupiter', fact: 'Large', confidence: 1.0
            } as any).execute()

            const hotspots = await engine.identifyKnowledgeHotspots()
            expect(hotspots).toHaveLength(1)
            expect(hotspots[0].entity).toBe('Jupiter')
            expect(hotspots[0].references).toBe(10)
        })
    })
})
