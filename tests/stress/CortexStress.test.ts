import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { Cortex } from '../../src/agentic/Cortex.js'
import { sql } from '../../src/raw-builder/sql.js'

describe('Cortex Stress Tests: Orchestration & Concurrency', () => {
    let db: NOORMME
    let cortex: Cortex

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        await kysely.schema.createTable('agent_metrics')
            .ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('metric_name', 'varchar(255)')
            .addColumn('metric_value', 'real')
            .addColumn('execution_time', 'real')
            .addColumn('session_id', 'text')
            .addColumn('agent_id', 'text')
            .addColumn('unit', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .execute()

        await kysely.schema.createTable('agent_knowledge_base')
            .ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('entity', 'varchar(255)')
            .addColumn('fact', 'text')
            .addColumn('confidence', 'real')
            .addColumn('status', 'varchar(50)')
            .addColumn('tags', 'text')
            .addColumn('metadata', 'text')
            .addColumn('source_session_id', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .addColumn('updated_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .execute()

        await kysely.schema.createTable('agent_knowledge_links')
            .ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('source_id', 'integer')
            .addColumn('target_id', 'integer')
            .addColumn('relationship', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .execute()

        await kysely.schema.createTable('agent_personas')
            .ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('status', 'varchar(50)')
            .addColumn('metadata', 'text')
            .addColumn('role', 'text')
            .addColumn('name', 'varchar(255)')
            .addColumn('capabilities', 'text')
            .addColumn('policies', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .addColumn('updated_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .execute()

        await kysely.schema.createTable('agent_actions')
            .ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'text')
            .addColumn('tool_name', 'text')
            .addColumn('status', 'text')
            .addColumn('result', 'text')
            .addColumn('outcome', 'text')
            .addColumn('error', 'text')
            .addColumn('arguments', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .execute()

        await kysely.schema.createTable('agent_sessions')
            .ifNotExists()
            .addColumn('id', 'text', col => col.primaryKey())
            .addColumn('name', 'text')
            .addColumn('status', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .addColumn('updated_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .execute()

        await kysely.schema.createTable('agent_messages')
            .ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'text')
            .addColumn('role', 'text')
            .addColumn('content', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .execute()

        await kysely.schema.createTable('agent_memories')
            .ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'text')
            .addColumn('content', 'text')
            .addColumn('embedding', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .execute()

        await kysely.schema.createTable('agent_session_evolution')
            .ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'text', col => col.unique())
            .addColumn('inferred_goal', 'text')
            .addColumn('strategy', 'text')
            .addColumn('evolution_path', 'text')
            .addColumn('status', 'text')
            .addColumn('autonomy_level', 'integer')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .addColumn('updated_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .execute()

        await kysely.schema.createTable('agent_policies')
            .ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('name', 'varchar(255)')
            .addColumn('type', 'varchar(50)')
            .addColumn('definition', 'text')
            .addColumn('is_enabled', 'boolean')
            .addColumn('pattern', 'text')
            .addColumn('description', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .addColumn('updated_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .execute()

        await kysely.schema.createTable('agent_capabilities')
            .ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('name', 'varchar(255)')
            .addColumn('status', 'varchar(50)')
            .addColumn('reliability', 'real')
            .addColumn('metadata', 'text')
            .addColumn('description', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .addColumn('updated_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .execute()

        await kysely.schema.createTable('agent_reflections')
            .ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'text')
            .addColumn('type', 'varchar(50)')
            .addColumn('content', 'text')
            .addColumn('lessons_learned', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .execute()

        await kysely.schema.createTable('agent_goals')
            .ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'text')
            .addColumn('parent_id', 'text')
            .addColumn('description', 'text')
            .addColumn('status', 'varchar(50)')
            .addColumn('priority', 'integer')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .addColumn('updated_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .execute()

        await kysely.schema.createTable('agent_resource_usage')
            .ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'text')
            .addColumn('agent_id', 'text')
            .addColumn('model_name', 'varchar(255)')
            .addColumn('input_tokens', 'integer')
            .addColumn('output_tokens', 'integer')
            .addColumn('cost', 'real')
            .addColumn('currency', 'varchar(10)')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .execute()

        await kysely.schema.createTable('agent_logic_probes')
            .ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('name', 'varchar(255)')
            .addColumn('script', 'text')
            .addColumn('expected_outcome', 'text')
            .addColumn('last_run', 'timestamp')
            .addColumn('last_status', 'varchar(50)')
            .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .execute()

        await kysely.schema.createTable('agent_rituals')
            .ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('name', 'text')
            .addColumn('type', 'text')
            .addColumn('frequency', 'text')
            .addColumn('definition', 'text')
            .addColumn('status', 'text')
            .addColumn('last_run', 'timestamp')
            .addColumn('next_run', 'timestamp')
            .addColumn('locked_until', 'timestamp')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .execute()

        await kysely.schema.createTable('agent_snapshots')
            .ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('name', 'text')
            .addColumn('dna', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .execute()

        await kysely.schema.createTable('agent_telemetry_events')
            .ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'text')
            .addColumn('type', 'text')
            .addColumn('content', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .execute()

        await kysely.schema.createTable('agent_research_metrics')
            .ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'text')
            .addColumn('metric_name', 'text')
            .addColumn('value', 'real')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .execute()

        await kysely.schema.createTable('agent_rules')
            .ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('table_name', 'text')
            .addColumn('operation', 'text')
            .addColumn('condition', 'text')
            .addColumn('action', 'text')
            .addColumn('priority', 'integer')
            .addColumn('is_enabled', 'boolean')
            .addColumn('script', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`))
            .execute()

        cortex = new Cortex(kysely, { agentic: { dialect: 'sqlite' } } as any)
    }, 60000)

    afterEach(async () => {
        await cleanupTestDatabase(db)
    }, 60000)

    it('should handle parallel self-iteration pulses safely', async () => {
        const pulses = 2
        const promises = []

        await db.getKysely().insertInto('agent_sessions').values({ id: 'system', status: 'active', metadata: '{}' }).execute()

        for (let i = 0; i < pulses; i++) {
            promises.push(cortex.selfIterate())
        }

        const results = await Promise.allSettled(promises)
        const fulfilled = results.filter(r => r.status === 'fulfilled')
        expect(fulfilled.length).toBeGreaterThan(0)
    }, 60000)

    it('should sustain high-throughput knowledge distillation under load', async () => {
        const items = 5
        const promises = []

        for (let i = 0; i < items; i++) {
            promises.push(cortex.knowledge.distill(`Entity_${i}`, `Fact_${i}`, 0.9))
        }

        await Promise.all(promises)

        const countResult = await db.getKysely()
            .selectFrom('agent_knowledge_base' as any)
            .select(db.getKysely().fn.count('id').as('cnt'))
            .executeTakeFirst() as any

        expect(Number(countResult.cnt)).toBe(items)
    }, 60000)

    it('should maintain state integrity during simultaneous persona mutations', async () => {
        await db.getKysely().insertInto('agent_personas' as any).values({
            name: 'StressBot',
            status: 'active',
            metadata: JSON.stringify({ mutationHistory: [] }),
            capabilities: '[]',
            policies: '[]',
            created_at: new Date(),
            updated_at: new Date()
        } as any).execute()

        const persona = (await db.getKysely().selectFrom('agent_personas' as any).selectAll().executeTakeFirst()) as any
        const agentPersona = {
            id: persona.id,
            name: persona.name,
            role: persona.role,
            capabilities: [],
            policies: [],
            metadata: JSON.parse(persona.metadata),
            createdAt: new Date(persona.created_at),
            updatedAt: new Date(persona.updated_at)
        }

        const report = {
            personaId: persona.id,
            successRate: 0.5,
            averageLatency: 100,
            sampleSize: 10,
            recommendation: 'optimize_accuracy' as const
        }

        const mutationPromises = []
        for (let i = 0; i < 2; i++) {
            mutationPromises.push(cortex.strategy.evolvePersona(agentPersona, report))
        }

        await Promise.all(mutationPromises)

        const finalPersona = (await db.getKysely().selectFrom('agent_personas' as any).selectAll().executeTakeFirst()) as any
        const finalMetadata = JSON.parse(finalPersona.metadata)

        expect(finalMetadata.mutationHistory.length).toBeGreaterThan(0)
    }, 60000)
})
