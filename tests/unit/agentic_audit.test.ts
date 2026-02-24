import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { sql } from '../../src/raw-builder/sql.js'

describe('Agentic Rituals Verification', () => {
    let noorm: NOORMME

    beforeAll(async () => {
        noorm = new NOORMME({
            dialect: 'sqlite',
            connection: {
                host: '',
                port: 0,
                database: ':memory:',
                username: '',
                password: ''
            },
            agentic: {
                metricsTable: 'agent_metrics',
                knowledgeTable: 'agent_knowledge_base',
                actionsTable: 'agent_actions'
            }
        })
        await noorm.initialize()

        // Initialize agentic schema
        await noorm.agent.schema.initializeSchema()
    })

    afterAll(async () => {
        await noorm.close()
    })

    it('GovernanceManager should suggest repairs based on latency', async () => {
        // Record high latency metric
        await noorm.agent.cortex.metrics.recordMetric('query_latency', 1200, { metadata: { table: 'users' } })
        await noorm.agent.cortex.metrics.recordMetric('query_latency', 1500, { metadata: { table: 'users' } })

        const repairs = await noorm.agent.cortex.governor.suggestRepairs()
        expect(Array.isArray(repairs)).toBe(true)
        expect(repairs.some((r: any) => r.includes("Table 'users'"))).toBe(true)
    })

    it('KnowledgeDistiller should consolidate similar facts', async () => {
        await noorm.agent.cortex.knowledge.distill('Kysely', 'Kysely is a type-safe SQL query builder for TypeScript.', 0.9)
        await noorm.agent.cortex.knowledge.distill('Kysely', 'Kysely is a SQL query builder that is type-safe for TypeScript.', 0.8)

        const beforeConsolidation = await noorm.agent.cortex.knowledge.getKnowledgeByEntity('Kysely')
        expect(beforeConsolidation.length).toBe(2)

        await noorm.agent.cortex.knowledge.consolidateKnowledge()

        const afterConsolidation = await noorm.agent.cortex.knowledge.getKnowledgeByEntity('Kysely')
        expect(afterConsolidation.length).toBe(1)
        expect(afterConsolidation[0].fact).toContain('Kysely is a type-safe SQL query builder')
    })

    it('ActionRefiner should detect missing capabilities', async () => {
        const db = noorm.getKysely()
        await (db as any).insertInto('agent_actions').values([
            { tool_name: 'secret_vault', arguments: '{}', status: 'failure', error: 'permission denied: level 5 required', created_at: new Date() },
            { tool_name: 'secret_vault', arguments: '{}', status: 'failure', error: 'permission denied: level 5 required', created_at: new Date() }
        ]).execute()

        const recs = await noorm.agent.cortex.refiner.refineActions()
        expect(recs.some((r: any) => r.includes('secret_vault') && r.includes('capability expansion'))).toBe(true)
    })

    it('SelfTestRegistry should verify schema consistency', async () => {
        await noorm.agent.cortex.tests.registerProbe('Schema Health', 'audit:check_schema_consistency')
        const results = await noorm.agent.cortex.tests.runAllProbes()

        const schemaResult = results.find((r: any) => r.name === 'Schema Health')
        expect(schemaResult?.success).toBe(true)
    })

    it('SelfTestRegistry should detect orphaned records', async () => {
        await noorm.agent.cortex.tests.registerProbe('Data Integrity', 'audit:check_data_integrity')

        const db = noorm.getKysely()
        // Inject orphaned action (no session)
        await (db as any).insertInto('agent_actions').values({
            tool_name: 'test_tool',
            arguments: '{}',
            status: 'success',
            created_at: new Date()
        }).execute()

        const results = await noorm.agent.cortex.tests.runAllProbes()
        const integrityResult = results.find((r: any) => r.name === 'Data Integrity')
        expect(integrityResult?.success).toBe(false)
    })

    it('CuriosityEngine should generate relationship hypotheses', async () => {
        await noorm.agent.cortex.knowledge.distill('UserAPI', 'Handles user authentication.', 0.9, undefined, ['api', 'security', 'identity'])
        await noorm.agent.cortex.knowledge.distill('AuthService', 'Core security module.', 0.9, undefined, ['security', 'core', 'identity'])

        const hypotheses = await noorm.agent.cortex.curiosity.generateHypotheses()
        expect(hypotheses.some((h: any) => h.includes('UserAPI') && h.includes('AuthService') && h.includes('security'))).toBe(true)
    })
})
