import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { KnowledgeDistiller } from '../../src/agentic/improvement/KnowledgeDistiller.js'

describe('KnowledgeDistiller', () => {
    let db: NOORMME
    let distiller: KnowledgeDistiller

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        // Create knowledge tables manually for testing
        await kysely.schema
            .createTable('agent_knowledge_base')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('entity', 'varchar(255)', col => col.notNull())
            .addColumn('fact', 'text', col => col.notNull())
            .addColumn('confidence', 'real', col => col.notNull())
            .addColumn('source_session_id', 'varchar(255)')
            .addColumn('tags', 'text') // JSON
            .addColumn('metadata', 'text') // JSON
            .addColumn('embedding', 'text') // JSON
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        await kysely.schema
            .createTable('agent_knowledge_links')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('source_id', 'integer', col => col.notNull())
            .addColumn('target_id', 'integer', col => col.notNull())
            .addColumn('relationship', 'varchar(255)', col => col.notNull())
            .addColumn('metadata', 'text') // JSON
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        distiller = new KnowledgeDistiller(kysely)
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    describe('distill', () => {
        it('should create new knowledge', async () => {
            const item = await distiller.distill('Sky', 'Blue', 0.9)
            expect(item.entity).toBe('Sky')
            expect(item.fact).toBe('Blue')
            expect(item.confidence).toBe(0.9)
            expect(item.id).toBeDefined()
        })

        it('should update existing knowledge and merge tags', async () => {
            await distiller.distill('Sky', 'Blue', 0.5, undefined, ['nature'])
            const updated = await distiller.distill('Sky', 'Blue', 0.9, undefined, ['color'])

            expect(updated.confidence).toBe(0.9)
            expect(updated.tags).toContain('nature')
            expect(updated.tags).toContain('color')
        })
    })

    describe('challengeKnowledge', () => {
        it('should degrade confidence of contradicted knowledge', async () => {
            const item = await distiller.distill('Sky', 'Green', 0.6)
            
            // Challenge with high confidence
            await distiller.challengeKnowledge('Sky', 'Blue', 0.9)

            const items = await distiller.getKnowledgeByEntity('Sky')
            const degraded = items.find(i => i.id === item.id)
            
            expect(degraded?.confidence).toBeLessThan(0.6)
            expect(degraded?.metadata?.status).toBe('deprecated')
        })

        it('should mark strong knowledge as disputed', async () => {
            const item = await distiller.distill('Sky', 'Green', 0.8)
            
            await distiller.challengeKnowledge('Sky', 'Blue', 0.9)

            const items = await distiller.getKnowledgeByEntity('Sky')
            const disputed = items.find(i => i.id === item.id)
            
            expect(disputed?.metadata?.status).toBe('disputed')
        })
    })

    describe('verifyKnowledge', () => {
        it('should increase confidence', async () => {
            const item = await distiller.distill('Sky', 'Blue', 0.5)
            const verified = await distiller.verifyKnowledge(item.id, 0.2)

            expect(verified?.confidence).toBeCloseTo(0.7)
        })
    })

    describe('Graph & Links', () => {
        it('should link knowledge items', async () => {
            const sun = await distiller.distill('Sun', 'Star', 1.0)
            const sky = await distiller.distill('Sky', 'Blue', 0.9)

            await distiller.linkKnowledge(sun.id, sky.id, 'illuminates')

            const graph = await distiller.getKnowledgeGraph(sun.id)
            expect(graph.item.entity).toBe('Sun')
            expect(graph.relations).toHaveLength(1)
            expect(graph.relations[0].relationship).toBe('illuminates')
            expect(graph.relations[0].target.entity).toBe('Sky')
        })
    })

    describe('pruneLowConfidence', () => {
        it('should delete low confidence items', async () => {
            await distiller.distill('Ghost', 'Real', 0.1)
            await distiller.distill('Sun', 'Hot', 0.9)

            const deleted = await distiller.pruneLowConfidence(0.2)
            expect(deleted).toBe(1)

            const ghost = await distiller.getKnowledgeByEntity('Ghost')
            expect(ghost).toHaveLength(0)
            
            const sun = await distiller.getKnowledgeByEntity('Sun')
            expect(sun).toHaveLength(1)
        })
    })
})
