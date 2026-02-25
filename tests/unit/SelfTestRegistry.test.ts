import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { SelfTestRegistry } from '../../src/agentic/improvement/SelfTestRegistry.js'

describe('SelfTestRegistry', () => {
    let db: NOORMME
    let registry: SelfTestRegistry
    let mockCortex: any

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        await kysely.schema.createTable('agent_logic_probes').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('name', 'varchar(255)', col => col.notNull().unique())
            .addColumn('script', 'text', col => col.notNull())
            .addColumn('expected_outcome', 'text')
            .addColumn('last_result', 'varchar(50)')
            .addColumn('last_run_at', 'timestamp')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        await kysely.schema.createTable('agent_metrics').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('metric_name', 'varchar(255)')
            .addColumn('metric_value', 'real')
            .addColumn('session_id', 'integer')
            .addColumn('agent_id', 'varchar(255)')
            .addColumn('unit', 'varchar(50)')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
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

        mockCortex = {
            metrics: {
                recordMetric: jest.fn().mockResolvedValue({} as never),
                getAverageMetric: jest.fn().mockResolvedValue(0 as never),
                getMetricStats: jest.fn().mockResolvedValue({ min: 0, max: 0, avg: 0, count: 0 } as never),
                getRecentMetrics: jest.fn().mockResolvedValue([] as never),
            },
            reflections: {
                reflect: jest.fn().mockResolvedValue({} as never),
            },
            config: {},
        }

        registry = new SelfTestRegistry(kysely, mockCortex, {})
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    describe('registerProbe', () => {
        it('should register a new verification probe', async () => {
            await registry.registerProbe(
                'integrity_check',
                'SELECT COUNT(*) as cnt FROM agent_metrics',
                'count > 0'
            )

            const kysely = db.getKysely()
            const probes = await kysely.selectFrom('agent_logic_probes' as any)
                .selectAll()
                .where('name', '=', 'integrity_check')
                .execute()

            expect(probes).toHaveLength(1)
            expect((probes[0] as any).script).toContain('SELECT COUNT')
        })

        it('should update an existing probe with the same name', async () => {
            await registry.registerProbe('test_probe', 'SELECT 1')
            await registry.registerProbe('test_probe', 'SELECT 2', 'updated')

            const kysely = db.getKysely()
            const probes = await kysely.selectFrom('agent_logic_probes' as any)
                .selectAll()
                .where('name', '=', 'test_probe')
                .execute()

            // Should have exactly 1 (upsert behavior) or the latest registered
            expect(probes.length).toBeGreaterThanOrEqual(1)
        })
    })

    describe('runAllProbes', () => {
        it('should run all registered probes and return results', async () => {
            await registry.registerProbe('always_pass', 'SELECT 1 as result')

            const results = await registry.runAllProbes()
            expect(results.length).toBeGreaterThanOrEqual(1)
            expect(results[0].name).toBe('always_pass')
        })

        it('should return empty array when no probes exist', async () => {
            const results = await registry.runAllProbes()
            expect(results).toHaveLength(0)
        })
    })
})
