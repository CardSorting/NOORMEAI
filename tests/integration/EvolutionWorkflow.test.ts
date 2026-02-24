import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { Cortex } from '../../src/agentic/Cortex.js'

describe('Integration Test: Evolution Workflow', () => {
    let db: NOORMME
    let cortex: Cortex

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        // Setup tables with full required schema
        await kysely.schema.createTable('agent_metrics').ifNotExists().addColumn('id', 'integer', col => col.primaryKey().autoIncrement()).addColumn('metric_name', 'varchar(255)').addColumn('metric_value', 'real').addColumn('created_at', 'timestamp', col => col.defaultTo('now()')).execute()

        await kysely.schema.createTable('agent_knowledge_base').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('entity', 'varchar(255)')
            .addColumn('fact', 'text')
            .addColumn('confidence', 'real')
            .addColumn('status', 'varchar(50)')
            .addColumn('tags', 'text')
            .addColumn('metadata', 'text')
            .addColumn('source_session_id', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()'))
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()'))
            .execute()

        await kysely.schema.createTable('agent_capabilities').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('name', 'varchar(255)')
            .addColumn('status', 'varchar(50)')
            .addColumn('reliability', 'real')
            .addColumn('metadata', 'text')
            .addColumn('description', 'text')
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()'))
            .execute()

        await kysely.schema.createTable('agent_personas').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('status', 'varchar(50)')
            .addColumn('metadata', 'text')
            .addColumn('role', 'text')
            .addColumn('name', 'varchar(255)')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()'))
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()'))
            .execute()

        await kysely.schema.createTable('agent_actions').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'text')
            .addColumn('tool_name', 'text')
            .addColumn('status', 'text')
            .addColumn('result', 'text')
            .addColumn('outcome', 'text')
            .addColumn('arguments', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()'))
            .execute()

        // Pass lookbackHours for stable testing
        cortex = new Cortex(kysely, { agentic: { dialect: 'sqlite', evolutionLookbackHours: 100 } } as any)
        await db.initialize()
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    it('should complete a full evolution cycle from knowledge acquisition to ritual execution', async () => {
        // 1. Acquire knowledge in a specific domain
        await cortex.knowledge.distill('TypeScript', 'It is a typed superset of JavaScript.', 0.9)
        await cortex.knowledge.distill('TypeScript', 'It compiles to plain JavaScript.', 0.8)

        // Force tags for domain identification
        await db.getKysely().updateTable('agent_knowledge_base' as any)
            .set({ tags: JSON.stringify(['typescript']) } as any)
            .execute()

        // 2. Mock skill synthesis
        const synthesisSpy = jest.spyOn(cortex.skillSynthesizer, 'discoverAndSynthesize')
            .mockResolvedValue([{ name: 'typescript_mastery', reliability: 0.1 } as any])

        // 3. Mock hive broadcasting
        const broadcastSpy = jest.spyOn(cortex.hive, 'broadcastSkills').mockResolvedValue(1)

        // 4. Mock domain syncing
        const syncSpy = (jest.spyOn(cortex.hive, 'syncDomain') as any).mockResolvedValue(undefined)

        // 5. Execute Evolution Ritual
        const evolutionResult = await cortex.evolutionRitual.execute()

        expect(evolutionResult.synthesized).toBe(1)
        expect(evolutionResult.broadcasted).toBe(1)
        expect(evolutionResult.domainsSynced).toContain('typescript')

        expect(synthesisSpy).toHaveBeenCalled()
        expect(broadcastSpy).toHaveBeenCalled()
        expect(syncSpy).toHaveBeenCalledWith('typescript', 0.05)
    })

    it('should identify and boost mature domains', async () => {
        // Create mature domain data
        // Skill name must start with the domain tag (e.g. 'mature_domain_')
        await db.getKysely().insertInto('agent_capabilities' as any).values([
            { name: 'mature_domain_1', status: 'verified', reliability: 0.98 },
            { name: 'mature_domain_2', status: 'verified', reliability: 0.97 },
            { name: 'mature_domain_3', status: 'verified', reliability: 0.96 }
        ] as any).execute()

        // Add corresponding active knowledge with the SAME tag
        await db.getKysely().insertInto('agent_knowledge_base' as any).values({
            entity: 'Test',
            fact: 'Test fact',
            confidence: 1.5, // Exceed threshold (1.0)
            tags: JSON.stringify(['mature_domain']),
            updated_at: new Date()
        } as any).execute()

        const syncSpy = (jest.spyOn(cortex.hive, 'syncDomain') as any).mockResolvedValue(undefined)

        await cortex.evolutionRitual.execute()

        expect(syncSpy).toHaveBeenCalledWith('mature_domain', 0.15)
    })
})
