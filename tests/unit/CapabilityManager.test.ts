import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { CapabilityManager } from '../../src/agentic/CapabilityManager.js'

describe('CapabilityManager', () => {
    let db: NOORMME
    let manager: CapabilityManager

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        // Create capabilities table
        await kysely.schema
            .createTable('agent_capabilities')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('name', 'varchar(255)', col => col.notNull())
            .addColumn('version', 'varchar(50)', col => col.notNull())
            .addColumn('description', 'text')
            .addColumn('status', 'varchar(50)', col => col.notNull().defaultTo('experimental'))
            .addColumn('reliability', 'real', col => col.notNull().defaultTo(1.0))
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        manager = new CapabilityManager(kysely, { llm: null } as any)
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    it('should register and update capabilities', async () => {
        const cap = await manager.registerCapability('search', '1.0.0', 'Web search')
        expect(cap.name).toBe('search')
        expect(cap.reliability).toBe(1.0)

        const updated = await manager.registerCapability('search', '1.0.0', 'Better web search')
        expect(updated.description).toBe('Better web search')
    })

    it('should track reliability using moving average', async () => {
        await manager.registerCapability('coding', '1.0.0')

        // Initial reliability 1.0
        // Report failure: 1.0 * 0.8 = 0.8
        await manager.reportOutcome('coding', false)
        let r1 = await manager.getReliability('coding')
        expect(r1).toBeCloseTo(0.8)

        // Report success: 0.8 * 0.8 + 0.2 = 0.64 + 0.2 = 0.84
        await manager.reportOutcome('coding', true)
        let r2 = await manager.getReliability('coding')
        expect(r2).toBeCloseTo(0.84)

        // Report success again: 0.84 * 0.8 + 0.2 = 0.672 + 0.2 = 0.872
        await manager.reportOutcome('coding', true)
        let r3 = await manager.getReliability('coding')
        expect(r3).toBeCloseTo(0.872)
    })

    it('should fast-track promotion after 5 consecutive successes', async () => {
        await manager.registerCapability('fast_tool', '1.0.0')

        // 4 successes - still experimental
        for (let i = 0; i < 4; i++) {
            await manager.reportOutcome('fast_tool', true)
        }
        const cap4 = (await manager.getCapabilities()).find(c => c.name === 'fast_tool')
        expect(cap4?.status).toBe('experimental')

        // 5th success - promoted to verified
        await manager.reportOutcome('fast_tool', true)
        const cap5 = (await manager.getCapabilities()).find(c => c.name === 'fast_tool')
        expect(cap5?.status).toBe('verified')
    })

    it('should trigger early-exit rollback after 3 consecutive failures at the start', async () => {
        await manager.registerCapability('bad_tool', '1.0.0')

        // 2 failures - still experimental
        await manager.reportOutcome('bad_tool', false)
        await manager.reportOutcome('bad_tool', false)
        const cap2 = (await manager.getCapabilities()).find(c => c.name === 'bad_tool')
        expect(cap2?.status).toBe('experimental')

        // 3rd consecutive failure - blacklisted
        await manager.reportOutcome('bad_tool', false)
        const cap3 = (await manager.getCapabilities()).find(c => c.name === 'bad_tool')
        expect(cap3?.status).toBe('blacklisted')
    })

    it('should demote a verified skill on performance collapse (Z-score)', async () => {
        await manager.registerCapability('unstable_tool', '1.0.0', 'Test', { initialStatus: 'verified' })

        // 1. Establish a solid baseline (10 successes)
        for (let i = 0; i < 10; i++) {
            await manager.reportOutcome('unstable_tool', true)
        }

        const capStable = (await manager.getCapabilities()).find(c => c.name === 'unstable_tool')
        expect(capStable?.status).toBe('verified')
        expect(capStable?.reliability).toBeGreaterThan(0.9)

        // 2. Trigger performance collapse (several consecutive failures)
        // This should drive winRate down and Z-score below -2.0
        for (let i = 0; i < 5; i++) {
            await manager.reportOutcome('unstable_tool', false)
        }

        const capDemoted = (await manager.getCapabilities()).find(c => c.name === 'unstable_tool')
        expect(capDemoted?.status).toBe('experimental')
        console.log(`[Test] Skill demoted. Z-score check passed.`)
    })
})
