import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { SkillSynthesizer } from '../../src/agentic/improvement/SkillSynthesizer.js'
import { Cortex } from '../../src/agentic/Cortex.js'
import { LLMProvider } from '../../src/types/index.js'

describe('SkillSynthesizer Pass 5: High-Throughput', () => {
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
                content: JSON.stringify([
                    { tool: 'domainA_tool1', description: 'Mutation 1', metadata: { reasoning: 'fix 1' } },
                    { tool: 'domainA_tool2', description: 'Mutation 2', metadata: { reasoning: 'fix 2' } }
                ]),
                usage: { promptTokens: 500, completionTokens: 500, totalTokens: 1000 }
            })
        } as any

        cortex = new Cortex(kysely, {
            dialect: 'sqlite',
            connection: { database: ':memory:' },
            agentic: {
                llm: mockLLM,
                capabilitiesTable: 'agent_capabilities'
            }
        })

        synthesizer = new SkillSynthesizer(kysely, cortex, {
            evolution: { maxSandboxSkills: 3 } // Low limit for pruning test
        })
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    it('should use Semantic Batching for tools in the same domain', async () => {
        const kysely = db.getKysely()

        // Seed failures for tools in same domain
        await kysely.insertInto('agent_actions' as any).values([
            { tool_name: 'domainA_tool1', status: 'failure', outcome: 'Err1', arguments: '{}' },
            { tool_name: 'domainA_tool1', status: 'failure', outcome: 'Err1', arguments: '{}' },
            { tool_name: 'domainA_tool1', status: 'failure', outcome: 'Err1', arguments: '{}' },
            { tool_name: 'domainA_tool2', status: 'failure', outcome: 'Err2', arguments: '{}' },
            { tool_name: 'domainA_tool2', status: 'failure', outcome: 'Err2', arguments: '{}' },
            { tool_name: 'domainA_tool2', status: 'failure', outcome: 'Err2', arguments: '{}' }
        ] as any).execute()

        const results = await synthesizer.discoverAndSynthesize()

        expect(results.length).toBe(2)
        expect(mockLLM.complete).toHaveBeenCalledTimes(1) // Single batch call
        expect(synthesizer.totalTokensConsumed).toBe(1000)
    })

    it('should prune the sandbox when capacity is reached', async () => {
        const kysely = db.getKysely()

        // Seed 3 existing experimental skills (max capacity)
        await kysely.insertInto('agent_capabilities' as any).values([
            { name: 'exp1', version: '1.0', status: 'experimental', reliability: 0.1 },
            { name: 'exp2', version: '1.0', status: 'experimental', reliability: 0.9 },
            { name: 'exp3', version: '1.0', status: 'experimental', reliability: 0.5 }
        ] as any).execute()

        // Seed 3 failures for a new tool to trigger synthesis
        await kysely.insertInto('agent_actions' as any).values([
            { tool_name: 'domainB_new', status: 'failure', outcome: 'Err', arguments: '{}' },
            { tool_name: 'domainB_new', status: 'failure', outcome: 'Err', arguments: '{}' },
            { tool_name: 'domainB_new', status: 'failure', outcome: 'Err', arguments: '{}' }
        ] as any).execute()

        // Mock individual synthesis for this tool
        mockLLM.complete.mockResolvedValueOnce({
            content: JSON.stringify({ description: 'New mutation', metadata: {} }),
            usage: { promptTokens: 50, completionTokens: 50, totalTokens: 100 }
        })

        await synthesizer.discoverAndSynthesize()

        const remaining = await kysely.selectFrom('agent_capabilities' as any).selectAll().execute()
        const exp1 = remaining.find(r => r.name === 'exp1')

        expect(exp1).toBeUndefined() // exp1 should have been pruned (lowest reliability)
        expect(remaining.length).toBe(3) // 3 existing - 1 pruned + 1 new = 3
    })
})
