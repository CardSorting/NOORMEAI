import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { SkillSynthesizer } from '../../src/agentic/improvement/SkillSynthesizer.js'
import { Cortex } from '../../src/agentic/Cortex.js'
import { LLMProvider } from '../../src/types/index.js'

describe('SkillSynthesizer Hardening', () => {
    let db: NOORMME
    let synthesizer: SkillSynthesizer
    let cortex: Cortex
    let mockLLM: jest.Mocked<LLMProvider>

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        // Create capability table
        await kysely.schema
            .createTable('agent_capabilities')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('name', 'varchar(255)', col => col.notNull())
            .addColumn('version', 'varchar(50)', col => col.notNull())
            .addColumn('description', 'text')
            .addColumn('status', 'varchar(50)', col => col.notNull())
            .addColumn('reliability', 'real', col => col.notNull())
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        // Create actions table
        await kysely.schema
            .createTable('agent_actions')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer')
            .addColumn('tool_name', 'varchar(255)')
            .addColumn('arguments', 'text')
            .addColumn('outcome', 'text')
            .addColumn('status', 'varchar(50)')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        mockLLM = {
            complete: jest.fn<any>().mockResolvedValue({
                content: JSON.stringify({
                    description: 'Mutated tool description',
                    metadata: { reasoning: 'Improved error handling' }
                }),
                usage: { totalTokens: 500 }
            })
        } as any

        cortex = new Cortex(kysely, {
            dialect: 'sqlite',
            connection: { database: ':memory:' },
            agentic: { llm: mockLLM }
        })

        synthesizer = new SkillSynthesizer(kysely, cortex, {
            evolution: { maxSandboxSkills: 5 }
        })
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    it('should perform real synthesis using LLMProvider on failure clusters', async () => {
        const kysely = db.getKysely()

        // Seed failures
        await kysely.insertInto('agent_actions' as any).values([
            { tool_name: 'test_tool', status: 'failure', outcome: 'Timeout', arguments: '{}' },
            { tool_name: 'test_tool', status: 'failure', outcome: 'Timeout', arguments: '{}' },
            { tool_name: 'test_tool', status: 'failure', outcome: 'Timeout', arguments: '{}' }
        ] as any).execute()

        const results = await synthesizer.discoverAndSynthesize()

        expect(results.length).toBe(1)
        expect(results[0]?.name).toBe('test_tool')
        expect(results[0]?.description).toBe('Mutated tool description')
        expect(mockLLM.complete).toHaveBeenCalled()
        expect(synthesizer.totalTokensConsumed).toBe(500)
    })

    it('should fallback gracefully if no LLM is provided', async () => {
        const kysely = db.getKysely()
        cortex.llm = null

        await kysely.insertInto('agent_actions' as any).values([
            { tool_name: 'test_tool', status: 'failure', outcome: 'Timeout', arguments: '{}' },
            { tool_name: 'test_tool', status: 'failure', outcome: 'Timeout', arguments: '{}' },
            { tool_name: 'test_tool', status: 'failure', outcome: 'Timeout', arguments: '{}' }
        ] as any).execute()

        const results = await synthesizer.discoverAndSynthesize()
        expect(results[0]?.description).toContain('Synthesis skipped: No LLM')
    })
})
