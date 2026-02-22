import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { SkillSynthesizer } from '../../src/agentic/improvement/SkillSynthesizer.js'
import { RecursiveReasoner } from '../../src/agentic/improvement/RecursiveReasoner.js'
import { KnowledgeDistiller } from '../../src/agentic/improvement/KnowledgeDistiller.js'
import { Cortex } from '../../src/agentic/Cortex.js'
import { LLMProvider } from '../../src/types/index.js'

describe('Skill Evolution Pass 6: Ultra-Scale', () => {
    let db: NOORMME
    let cortex: Cortex
    let mockFastLLM: jest.Mocked<LLMProvider>
    let mockPremiumLLM: jest.Mocked<LLMProvider>

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        // Setup tables
        await kysely.schema.createTable('agent_capabilities').addColumn('id', 'integer', col => col.primaryKey().autoIncrement()).addColumn('name', 'varchar(255)').addColumn('version', 'varchar(50)').addColumn('description', 'text').addColumn('status', 'varchar(50)').addColumn('reliability', 'real').addColumn('metadata', 'text').addColumn('created_at', 'timestamp', col => col.defaultTo('now()')).addColumn('updated_at', 'timestamp', col => col.defaultTo('now()')).execute()
        await kysely.schema.createTable('agent_personas').addColumn('id', 'varchar(255)', col => col.primaryKey()).addColumn('name', 'varchar(255)').addColumn('metadata', 'text').addColumn('created_at', 'timestamp', col => col.defaultTo('now()')).addColumn('updated_at', 'timestamp', col => col.defaultTo('now()')).execute()
        await kysely.schema.createTable('agent_goals').addColumn('id', 'integer', col => col.primaryKey().autoIncrement()).addColumn('session_id', 'integer').addColumn('description', 'text').addColumn('status', 'varchar(50)').addColumn('priority', 'integer').addColumn('metadata', 'text').addColumn('created_at', 'timestamp', col => col.defaultTo('now()')).addColumn('updated_at', 'timestamp', col => col.defaultTo('now()')).execute()
        await kysely.schema.createTable('agent_knowledge_base').addColumn('id', 'integer', col => col.primaryKey().autoIncrement()).addColumn('entity', 'varchar(255)').addColumn('fact', 'text').addColumn('confidence', 'real').addColumn('source_session_id', 'integer').addColumn('status', 'varchar(50)').addColumn('tags', 'text').addColumn('metadata', 'text').addColumn('created_at', 'timestamp', col => col.defaultTo('now()')).addColumn('updated_at', 'timestamp', col => col.defaultTo('now()')).execute()
        await kysely.schema.createTable('agent_actions').addColumn('id', 'integer', col => col.primaryKey().autoIncrement()).addColumn('tool_name', 'varchar(255)').addColumn('status', 'varchar(50)').addColumn('arguments', 'text').addColumn('outcome', 'text').addColumn('created_at', 'timestamp', col => col.defaultTo('now()')).execute()

        mockFastLLM = { complete: jest.fn<any>().mockResolvedValue({ content: JSON.stringify([{ tool: 't1', description: 'fast', metadata: {} }]), usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 } }) } as any
        mockPremiumLLM = { complete: jest.fn<any>().mockResolvedValue({ content: JSON.stringify({ description: 'premium', metadata: {} }), usage: { promptTokens: 50, completionTokens: 50, totalTokens: 100 } }) } as any

        cortex = new Cortex(kysely, {
            dialect: 'sqlite',
            connection: { database: ':memory:' },
            agentic: {
                llmFast: mockFastLLM,
                llmPremium: mockPremiumLLM,
                capabilitiesTable: 'agent_capabilities',
                personasTable: 'agent_personas',
                goalsTable: 'agent_goals',
                knowledgeTable: 'agent_knowledge_base'
            }
        })
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    it('should route to Fast model for batching and Premium for individual mutations', async () => {
        const synthesizer = cortex.skillSynthesizer
        const kysely = db.getKysely()

        // Batch test
        const mutations = await synthesizer.strategy.synthesizeBatch([{ targetTool: 't1', failures: [], evolutionConfig: {} as any }])
        expect(mockFastLLM.complete).toHaveBeenCalled()

        // Premium test
        await synthesizer.strategy.synthesize({ targetTool: 't2', failures: [], existingDescription: '', evolutionConfig: {} as any })
        expect(mockPremiumLLM.complete).toHaveBeenCalled()
    })

    it('should pre-warm high-potential skills nearing promotion', async () => {
        const kysely = db.getKysely()
        await kysely.insertInto('agent_capabilities' as any).values({
            name: 'hot_skill', version: '1.0', status: 'experimental', reliability: 0.9,
            description: 'old desc',
            metadata: JSON.stringify({ totalCount: 16, successCount: 13, successStreak: 3 })
        } as any).execute()

        // Manually trigger pre-warming to bypass async reportOutcome flakiness in tests
        await cortex.skillSynthesizer.preWarmSkill('hot_skill')

        // Check if pre-warmed metadata exists
        const cap = await kysely.selectFrom('agent_capabilities' as any).selectAll().where('name', '=', 'hot_skill').executeTakeFirst()
        expect(cap).toBeDefined()
        const meta = JSON.parse(((cap as any)).metadata)
        expect(meta.pre_warmed).toBe(true)
        expect((cap as any).description).toBe('premium') // From mockPremiumLLM
    })

    it('should cross-pollinate successful persona mutations as global goals', async () => {
        const kysely = db.getKysely()
        await kysely.insertInto('agent_personas' as any).values({
            id: 'pers_god', name: 'Champion',
            metadata: JSON.stringify({ evolution_status: 'stable', mutation_reasoning: 'Use efficient indexing' })
        } as any).execute()

        await cortex.reasoner.crossPollinateGoals()

        const goals = await kysely.selectFrom('agent_goals' as any).selectAll().execute()
        expect(goals.length).toBe(1)
        expect(goals[0].description).toContain('Use efficient indexing')
    })

    it('should skip duplicate knowledge distillation using Bloom filter', async () => {
        const distiller = cortex.knowledge
        const kysely = db.getKysely()

        // Initial distillation
        await distiller.distill('User', 'Location: Mars', 0.9, 1, [], {}, 'assistant')

        const initialCount = (await kysely.selectFrom('agent_knowledge_base' as any).selectAll().execute()).length

        // Redundant distillation (should hit Bloom filter and skip if verified)
        // Let's verify it first
        const item = (await kysely.selectFrom('agent_knowledge_base' as any).selectAll().execute())[0]
        await distiller.verifyKnowledge(item.id, 0.2) // Promotes to verified

        await distiller.distill('User', 'Location: Mars', 0.9, 1, [], {}, 'assistant')

        const finalCount = (await kysely.selectFrom('agent_knowledge_base' as any).selectAll().execute()).length
        expect(finalCount).toBe(initialCount) // No new row created due to Bloom filter skip
    })
})
