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
            .addColumn('reliability', 'real', col => col.notNull().defaultTo(1.0))
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        manager = new CapabilityManager(kysely)
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
})
