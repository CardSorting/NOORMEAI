import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { EvolutionRitual } from '../../src/agentic/improvement/EvolutionRitual.js'
import { Cortex } from '../../src/agentic/Cortex.js'

describe('EvolutionRitual', () => {
    let db: NOORMME
    let ritual: EvolutionRitual
    let cortex: Cortex

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
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        cortex = {
            skillSynthesizer: { discoverAndSynthesize: async () => [] },
            hive: { broadcastSkills: async () => 0, syncDomain: async () => 0 }
        } as any

        ritual = new EvolutionRitual(kysely, cortex)
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    it('should identify active domains based on confidence density (Entropy)', async () => {
        const kysely = db.getKysely()

        // Domain A: 2 items, high confidence total
        await kysely.insertInto('agent_knowledge_base' as any).values([
            { entity: 'A1', fact: 'f', confidence: 0.9, tags: JSON.stringify(['DomainA']), updated_at: new Date() },
            { entity: 'A2', fact: 'f', confidence: 0.8, tags: JSON.stringify(['DomainA']), updated_at: new Date() }
        ] as any).execute()

        // Domain B: 1 item, lower confidence
        await kysely.insertInto('agent_knowledge_base' as any).values([
            { entity: 'B1', fact: 'f', confidence: 0.5, tags: JSON.stringify(['DomainB']), updated_at: new Date() }
        ] as any).execute()

        const results = await ritual.execute()
        // DomainA should be boosted because it has higher cumulative confidence (entropy proxy)
        expect(results.domainsSynced).toContain('DomainA')
        expect(results.domainsSynced).not.toContain('DomainB') // Since we limit to top active (scaled by density)
    })
})
