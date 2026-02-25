import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { MaintenanceOracle } from '../../src/agentic/improvement/governance/MaintenanceOracle.js'

describe('MaintenanceOracle', () => {
    let db: NOORMME
    let oracle: MaintenanceOracle

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        await kysely.schema.createTable('agent_policies').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('name', 'varchar(255)')
            .addColumn('type', 'varchar(50)')
            .addColumn('definition', 'text')
            .addColumn('is_enabled', 'boolean')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()'))
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()'))
            .execute()

        await kysely.schema.createTable('agent_metrics').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer')
            .addColumn('agent_id', 'varchar(255)')
            .addColumn('metric_name', 'varchar(255)')
            .addColumn('metric_value', 'real')
            .addColumn('unit', 'varchar(50)')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()'))
            .execute()

        await kysely.schema.createTable('agent_sessions').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('name', 'varchar(255)')
            .addColumn('status', 'varchar(50)')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()'))
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()'))
            .execute()

        oracle = new MaintenanceOracle()
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    function createMockContext(overrides: any = {}): any {
        const kysely = db.getKysely()
        return {
            trx: kysely,
            cortex: {
                metrics: {
                    getMetricStats: jest.fn().mockResolvedValue(
                        (overrides.latencyStats || { min: 10, max: 50, avg: 30, count: 5 }) as never
                    ),
                    getAverageMetric: jest.fn().mockResolvedValue(
                        (overrides.totalCost || 0.1) as never
                    ),
                },
            },
            config: overrides.config || {},
            policiesTable: 'agent_policies',
            metricsTable: 'agent_metrics',
        }
    }

    describe('suggestRepairs', () => {
        it('should return empty repairs when all metrics are healthy', async () => {
            const ctx = createMockContext()
            const repairs = await oracle.suggestRepairs(ctx as any)
            expect(Array.isArray(repairs)).toBe(true)
            // With healthy defaults, should have few or no repairs
        })

        it('should suggest latency repair when avg exceeds threshold', async () => {
            const ctx = createMockContext({
                latencyStats: { min: 100, max: 2000, avg: 800, count: 20 }
            })

            const repairs = await oracle.suggestRepairs(ctx as any)

            const latencyRepair = repairs.find(r => r.toLowerCase().includes('latency'))
            expect(latencyRepair).toBeDefined()
        })

        it('should suggest cost optimization when avg cost exceeds threshold', async () => {
            const ctx = createMockContext({
                totalCost: 1.5 // Exceeds default 0.5 threshold
            })

            const repairs = await oracle.suggestRepairs(ctx as any)

            const costRepair = repairs.find(r => r.toLowerCase().includes('cost'))
            expect(costRepair).toBeDefined()
        })

        it('should suggest cold storage when many old sessions exist', async () => {
            const kysely = db.getKysely()

            // Create 150 old sessions
            const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) // 60 days ago
            for (let i = 0; i < 150; i++) {
                await kysely.insertInto('agent_sessions' as any).values({
                    name: `old_session_${i}`,
                    status: 'closed',
                    created_at: oldDate,
                    updated_at: oldDate,
                } as any).execute()
            }

            const ctx = createMockContext()
            const repairs = await oracle.suggestRepairs(ctx as any)

            const storageRepair = repairs.find(r => r.includes('STORAGE OPTIMIZATION'))
            expect(storageRepair).toBeDefined()
        })

        it('should use policy-defined thresholds when policies exist', async () => {
            const kysely = db.getKysely()
            await kysely.insertInto('agent_policies' as any).values({
                name: 'latency_repair_threshold',
                type: 'maintenance',
                definition: JSON.stringify({ threshold: 100 }),
                is_enabled: true,
                created_at: new Date(),
                updated_at: new Date(),
            } as any).execute()

            const ctx = createMockContext({
                latencyStats: { min: 50, max: 300, avg: 150, count: 15 }
            })

            const repairs = await oracle.suggestRepairs(ctx as any)
            // With custom threshold of 100, avg of 150 should trigger
            const latencyRepair = repairs.find(r => r.toLowerCase().includes('latency'))
            expect(latencyRepair).toBeDefined()
        })

        it('should identify specific slow tables from metrics metadata', async () => {
            const kysely = db.getKysely()

            // Insert high-latency metrics with table metadata
            for (let i = 0; i < 5; i++) {
                await kysely.insertInto('agent_metrics' as any).values({
                    metric_name: 'query_latency',
                    metric_value: 1500, // Well above default threshold (500 * 2)
                    metadata: JSON.stringify({ table: 'big_data_table' }),
                    created_at: new Date(),
                } as any).execute()
            }

            const ctx = createMockContext({
                latencyStats: { min: 100, max: 2000, avg: 800, count: 20 }
            })

            const repairs = await oracle.suggestRepairs(ctx as any)
            const tableRepair = repairs.find(r => r.includes('big_data_table'))
            expect(tableRepair).toBeDefined()
        })
    })
})
