import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { QuotaManager } from '../../src/agentic/improvement/QuotaManager.js'

describe('QuotaManager', () => {
    let db: NOORMME
    let quotaManager: QuotaManager
    let mockCortex: any

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        await kysely.schema.createTable('agent_resource_usage').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('agent_id', 'varchar(255)')
            .addColumn('cost', 'real')
            .addColumn('input_tokens', 'integer')
            .addColumn('output_tokens', 'integer')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        await kysely.schema.createTable('agent_metrics').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer')
            .addColumn('agent_id', 'varchar(255)')
            .addColumn('metric_name', 'varchar(255)', col => col.notNull())
            .addColumn('metric_value', 'real', col => col.notNull())
            .addColumn('unit', 'varchar(50)')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        await kysely.schema.createTable('agent_personas').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('name', 'varchar(255)')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()'))
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()'))
            .execute()

        mockCortex = {
            metrics: {
                recordMetric: jest.fn().mockResolvedValue({} as never),
                getAverageMetric: jest.fn().mockResolvedValue(0 as never),
                getMetricStats: jest.fn().mockResolvedValue({ min: 0, max: 0, avg: 0, count: 0 } as never),
            },
            policies: {
                getActivePolicies: jest.fn().mockResolvedValue([] as never),
            },
        }

        quotaManager = new QuotaManager(kysely, mockCortex, {})
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    describe('checkQuota', () => {
        it('should return allowed when no quotas are defined', async () => {
            const result = await quotaManager.checkQuota('global')
            expect(result.allowed).toBe(true)
        })

        it('should return denied when cost usage exceeds limit', async () => {
            const kysely = db.getKysely()

            // Mock a budget policy that limits cost to 1.0 per hour
            mockCortex.policies.getActivePolicies.mockResolvedValue([{
                id: 1,
                type: 'budget',
                definition: {
                    targetType: 'global',
                    metric: 'cost',
                    limit: 1.0,
                    period: 'hourly',
                },
                metadata: {},
                createdAt: new Date(),
                updatedAt: new Date(),
            }] as never)

            // Insert resource usage records exceeding the limit
            for (let i = 0; i < 5; i++) {
                await kysely.insertInto('agent_resource_usage' as any).values({
                    cost: 0.5,
                    input_tokens: 100,
                    output_tokens: 50,
                    created_at: new Date(),
                } as any).execute()
            }

            const result = await quotaManager.checkQuota('global')
            expect(result.allowed).toBe(false)
            expect(result.reason).toBeDefined()
        })
    })

    describe('getPeriodInMs', () => {
        it('should convert hourly to milliseconds', () => {
            const ms = (quotaManager as any).getPeriodInMs('hourly')
            expect(ms).toBe(3600000)
        })

        it('should convert daily to milliseconds', () => {
            const ms = (quotaManager as any).getPeriodInMs('daily')
            expect(ms).toBe(86400000)
        })

        it('should convert monthly to milliseconds (approx 30 days)', () => {
            const ms = (quotaManager as any).getPeriodInMs('monthly')
            expect(ms).toBe(86400000 * 30)
        })

        it('should return default for unknown period', () => {
            const ms = (quotaManager as any).getPeriodInMs('unknown')
            expect(ms).toBe(3600000) // defaults to hourly
        })
    })

    describe('syncExchangeRates', () => {
        it('should persist exchange rates to the metrics table', async () => {
            await quotaManager.syncExchangeRates({
                'USD': 1.0,
                'EUR': 0.85,
                'GPT4_TOKEN': 0.00003,
            })

            const kysely = db.getKysely()
            const storedRates = await kysely.selectFrom('agent_metrics' as any)
                .selectAll()
                .where('metric_name' as any, 'like', 'exchange_rate_%')
                .execute()

            expect(storedRates.length).toBe(3)
        })
    })
})
