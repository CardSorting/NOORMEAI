import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { ResourceMonitor } from '../../src/agentic/ResourceMonitor.js'

describe('ResourceMonitor', () => {
    let db: NOORMME
    let monitor: ResourceMonitor

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        await kysely.schema
            .createTable('agent_resource_usage')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer')
            .addColumn('agent_id', 'varchar(255)')
            .addColumn('model_name', 'varchar(255)', col => col.notNull())
            .addColumn('input_tokens', 'integer', col => col.notNull())
            .addColumn('output_tokens', 'integer', col => col.notNull())
            .addColumn('cost', 'real', col => col.notNull())
            .addColumn('currency', 'varchar(10)', col => col.notNull())
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        monitor = new ResourceMonitor(kysely)
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    it('should record usage and calculate costs', async () => {
        await monitor.recordUsage(1, 'gpt-4', 100, 50, 0.01)
        await monitor.recordUsage(1, 'gpt-4', 200, 100, 0.02)

        const sessionCost = await monitor.getSessionTotalCost(1)
        expect(sessionCost).toBeCloseTo(0.03)

        const globalCost = await monitor.getGlobalTotalCost()
        expect(globalCost).toBeCloseTo(0.03)
    })

    it('should generate model usage stats', async () => {
        await monitor.recordUsage(1, 'gpt-4', 100, 50, 0.01)
        await monitor.recordUsage(2, 'claude-3', 200, 100, 0.03)

        const stats = await monitor.getModelUsageStats()
        expect(stats).toHaveLength(2)
        
        const gpt4 = stats.find(s => s.modelName === 'gpt-4')
        expect(gpt4?.totalTokens).toBe(150)
        expect(gpt4?.totalCost).toBe(0.01)
    })
})
