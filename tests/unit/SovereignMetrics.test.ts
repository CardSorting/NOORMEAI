import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { SovereignMetrics } from '../../src/agentic/improvement/SovereignMetrics.js'

describe('SovereignMetrics', () => {
    let db: NOORMME
    let metrics: SovereignMetrics

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

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

        metrics = new SovereignMetrics(kysely)
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    describe('recordMetric', () => {
        it('should persist a metric with all fields', async () => {
            const metric = await metrics.recordMetric('query_latency', 42.5, {
                sessionId: 1,
                agentId: 'agent_001',
                unit: 'ms',
                metadata: { table: 'users' }
            })

            expect(metric.metricName).toBe('query_latency')
            expect(metric.metricValue).toBe(42.5)
            expect(metric.sessionId).toBe(1)
            expect(metric.agentId).toBe('agent_001')
            expect(metric.unit).toBe('ms')
            expect(metric.metadata).toEqual({ table: 'users' })
            expect(metric.createdAt).toBeInstanceOf(Date)
        })

        it('should persist a metric with minimal options', async () => {
            const metric = await metrics.recordMetric('simple_count', 10)

            expect(metric.metricName).toBe('simple_count')
            expect(metric.metricValue).toBe(10)
            expect(metric.sessionId).toBeNull()
            expect(metric.agentId).toBeNull()
        })
    })

    describe('getAverageMetric', () => {
        it('should return correct average', async () => {
            await metrics.recordMetric('latency', 10)
            await metrics.recordMetric('latency', 20)
            await metrics.recordMetric('latency', 30)

            const avg = await metrics.getAverageMetric('latency')
            expect(avg).toBe(20)
        })

        it('should return 0 when no data exists', async () => {
            const avg = await metrics.getAverageMetric('nonexistent')
            expect(avg).toBe(0)
        })
    })

    describe('getMetricStats', () => {
        it('should return min, max, avg, count', async () => {
            await metrics.recordMetric('perf', 5)
            await metrics.recordMetric('perf', 15)
            await metrics.recordMetric('perf', 10)

            const stats = await metrics.getMetricStats('perf')
            expect(stats.min).toBe(5)
            expect(stats.max).toBe(15)
            expect(stats.avg).toBe(10)
            expect(stats.count).toBe(3)
        })

        it('should filter by agentId', async () => {
            await metrics.recordMetric('perf', 100, { agentId: 'a' })
            await metrics.recordMetric('perf', 200, { agentId: 'b' })

            const stats = await metrics.getMetricStats('perf', { agentId: 'a' })
            expect(stats.count).toBe(1)
            expect(stats.avg).toBe(100)
        })

        it('should filter by sessionId', async () => {
            await metrics.recordMetric('perf', 50, { sessionId: 1 })
            await metrics.recordMetric('perf', 150, { sessionId: 2 })

            const stats = await metrics.getMetricStats('perf', { sessionId: 1 })
            expect(stats.count).toBe(1)
            expect(stats.avg).toBe(50)
        })
    })

    describe('getRecentMetrics', () => {
        it('should return all recent metrics', async () => {
            await metrics.recordMetric('a', 1)
            await metrics.recordMetric('b', 2)
            await metrics.recordMetric('c', 3)

            const recent = await metrics.getRecentMetrics(10)
            expect(recent).toHaveLength(3)
            // All values should be present
            const values = recent.map(m => m.metricValue).sort()
            expect(values).toEqual([1, 2, 3])
        })

        it('should respect the limit parameter', async () => {
            for (let i = 0; i < 10; i++) {
                await metrics.recordMetric('bulk', i)
            }

            const recent = await metrics.getRecentMetrics(3)
            expect(recent).toHaveLength(3)
        })
    })

    describe('getMetricsByAgent', () => {
        it('should filter metrics by agent ID', async () => {
            await metrics.recordMetric('x', 1, { agentId: 'alpha' })
            await metrics.recordMetric('y', 2, { agentId: 'beta' })
            await metrics.recordMetric('z', 3, { agentId: 'alpha' })

            const result = await metrics.getMetricsByAgent('alpha')
            expect(result).toHaveLength(2)
            result.forEach(m => expect(m.agentId).toBe('alpha'))
        })
    })

    describe('getMetricsBySession', () => {
        it('should filter metrics by session ID', async () => {
            await metrics.recordMetric('x', 1, { sessionId: 10 })
            await metrics.recordMetric('y', 2, { sessionId: 20 })
            await metrics.recordMetric('z', 3, { sessionId: 10 })

            const result = await metrics.getMetricsBySession(10)
            expect(result).toHaveLength(2)
            result.forEach(m => expect(m.sessionId).toBe(10))
        })
    })
})
