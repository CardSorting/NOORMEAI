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

        // Create tables manually for testing
        const db = noorm.getKysely()
        await sql`CREATE TABLE IF NOT EXISTS agent_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            status TEXT,
            metadata TEXT,
            created_at DATETIME,
            updated_at DATETIME
        )`.execute(db)

        await sql`CREATE TABLE IF NOT EXISTS agent_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            role TEXT,
            content TEXT,
            metadata TEXT,
            created_at DATETIME
        )`.execute(db)

        await sql`CREATE TABLE IF NOT EXISTS agent_memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            content TEXT,
            embedding TEXT,
            metadata TEXT,
            created_at DATETIME
        )`.execute(db)

        await sql`CREATE TABLE IF NOT EXISTS agent_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            metric_id TEXT,
            session_id TEXT,
            agent_id TEXT,
            metric_name TEXT,
            metric_value REAL,
            unit TEXT,
            metadata TEXT,
            created_at DATETIME
        )`.execute(db)

        await sql`CREATE TABLE IF NOT EXISTS agent_knowledge_base (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity TEXT,
            fact TEXT,
            confidence REAL,
            source_session_id TEXT,
            metadata TEXT,
            tags TEXT,
            created_at DATETIME,
            updated_at DATETIME
        )`.execute(db)

        await sql`CREATE TABLE IF NOT EXISTS agent_actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tool_name TEXT,
            status TEXT,
            error TEXT,
            created_at DATETIME
        )`.execute(db)

        await sql`CREATE TABLE IF NOT EXISTS agent_reflections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            outcome TEXT,
            lessons_learned TEXT,
            suggested_actions TEXT,
            metadata TEXT,
            created_at DATETIME
        )`.execute(db)

        await sql`CREATE TABLE IF NOT EXISTS agent_logic_probes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE,
            script TEXT,
            expected_outcome TEXT,
            last_run DATETIME,
            last_status TEXT,
            created_at DATETIME
        )`.execute(db)
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
            { tool_name: 'secret_vault', status: 'failure', error: 'permission denied: level 5 required', created_at: new Date() },
            { tool_name: 'secret_vault', status: 'failure', error: 'permission denied: level 5 required', created_at: new Date() }
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
            status: 'success',
            created_at: new Date()
        }).execute()

        const results = await noorm.agent.cortex.tests.runAllProbes()
        const integrityResult = results.find((r: any) => r.name === 'Data Integrity')
        expect(integrityResult?.success).toBe(false)
    })

    it('CuriosityEngine should generate relationship hypotheses', async () => {
        await noorm.agent.cortex.knowledge.distill('UserAPI', 'Handles user authentication.', 0.9, undefined, ['api', 'security'])
        await noorm.agent.cortex.knowledge.distill('AuthService', 'Core security module.', 0.9, undefined, ['security', 'core'])

        const hypotheses = await noorm.agent.cortex.curiosity.generateHypotheses()
        expect(hypotheses.some((h: any) => h.includes('UserAPI') && h.includes('AuthService') && h.includes('security'))).toBe(true)
    })
})
