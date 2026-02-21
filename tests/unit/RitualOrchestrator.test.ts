import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { RitualOrchestrator } from '../../src/agentic/improvement/RitualOrchestrator.js'
import { Cortex } from '../../src/agentic/Cortex.js'

describe('RitualOrchestrator', () => {
    let db: NOORMME
    let orchestrator: RitualOrchestrator
    let cortex: Cortex

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        // Create rituals table
        await kysely.schema
            .createTable('agent_rituals')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('name', 'varchar(255)')
            .addColumn('type', 'varchar(50)')
            .addColumn('frequency', 'varchar(50)')
            .addColumn('status', 'varchar(50)')
            .addColumn('next_run', 'timestamp')
            .addColumn('last_run', 'timestamp')
            .addColumn('definition', 'text')
            .addColumn('metadata', 'text')
            .execute()

        cortex = {
            pilot: { runSelfImprovementCycle: async () => ({ changes: [] }) },
            janitor: { 
                optimizeDatabase: async () => {},
                runPruningRitual: async () => 0,
                cleanOrphans: async () => 0
            },
            ablation: { pruneZombies: async () => 0 },
            compressor: { semanticPruning: async () => 0 }
        } as any
        
        orchestrator = new RitualOrchestrator(kysely, cortex)
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    it('should schedule a ritual', async () => {
        const ritual = await orchestrator.scheduleRitual('Pruning', 'pruning', 'daily')
        expect(ritual.name).toBe('Pruning')
        expect(ritual.status).toBe('pending')
        expect(ritual.nextRun).toBeDefined()
    })

    it('should run pending rituals', async () => {
        const kysely = db.getKysely()
        // Past ritual
        await kysely.insertInto('agent_rituals').values({
            name: 'Test', type: 'pruning', frequency: 'daily', status: 'pending', next_run: new Date(Date.now() - 1000)
        } as any).execute()

        const spy = jest.spyOn(cortex.janitor, 'runPruningRitual')
        
        const count = await orchestrator.runPendingRituals()
        expect(count).toBe(1)
        expect(spy).toHaveBeenCalled()

        const updated = await kysely.selectFrom('agent_rituals').selectAll().executeTakeFirst() as any
        expect(updated.status).toBe('success')
        expect(updated.last_run).toBeDefined()
    })
})
