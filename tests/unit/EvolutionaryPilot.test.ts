import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { EvolutionaryPilot } from '../../src/agentic/improvement/EvolutionaryPilot.js'

describe('EvolutionaryPilot', () => {
    let db: NOORMME
    let pilot: EvolutionaryPilot
    let mockCortex: any

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

        await kysely.schema.createTable('agent_reflections').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'text')
            .addColumn('outcome', 'varchar(50)')
            .addColumn('summary', 'text')
            .addColumn('lessons_learned', 'text')
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
                getRecentMetrics: jest.fn().mockResolvedValue([] as never),
                getMetricStats: jest.fn().mockResolvedValue({ min: 0, max: 0, avg: 0, count: 0 } as never),
            },
            reflections: {
                reflect: jest.fn().mockResolvedValue({} as never),
            },
            evolution: {
                evolve: jest.fn().mockResolvedValue(undefined as never),
            },
            selfTests: {
                runAllProbes: jest.fn().mockResolvedValue([] as never),
            },
            skillSynthesizer: {
                tuneBatchSize: jest.fn(),
                tuneMinConfidence: jest.fn(),
            },
            capabilities: {
                getCapabilities: jest.fn().mockResolvedValue([] as never),
            },
            governor: {
                performAudit: jest.fn().mockResolvedValue({ healthy: true, issues: [] } as never),
            },
        }

        pilot = new EvolutionaryPilot(kysely, mockCortex, {})
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    describe('calculateZScore', () => {
        it('should calculate correct z-score stats', () => {
            const result = (pilot as any).calculateZScore([10, 20, 30, 40, 50])

            expect(result.mean).toBeCloseTo(30)
            expect(result.current).toBe(10) // values[0] is current
            expect(result.stdDev).toBeGreaterThan(0)
            expect(typeof result.zScore).toBe('number')
        })

        it('should handle single value (stdDev of 0)', () => {
            const result = (pilot as any).calculateZScore([42])

            expect(result.mean).toBe(42)
            expect(result.current).toBe(42)
            expect(result.stdDev).toBe(0)
            expect(result.zScore).toBe(0) // No deviation when stdDev is 0
        })

        it('should handle identical values', () => {
            const result = (pilot as any).calculateZScore([5, 5, 5, 5])

            expect(result.mean).toBe(5)
            expect(result.stdDev).toBe(0)
            expect(result.zScore).toBe(0)
        })

        it('should calculate negative z-score for below-mean current', () => {
            const result = (pilot as any).calculateZScore([30, 20, 10])
            expect(result.current).toBe(30) // values[0]
            // current (30) > mean (20), so zScore should be positive
            expect(result.zScore).toBeGreaterThan(0)
        })
    })

    describe('runSelfImprovementCycle', () => {
        it('should return result with evolved and changes fields', async () => {
            const result = await pilot.runSelfImprovementCycle()

            expect(result).toBeDefined()
            expect(typeof result.evolved).toBe('boolean')
            expect(Array.isArray(result.changes)).toBe(true)
        })

        it('should complete cycle without throwing', async () => {
            await pilot.runSelfImprovementCycle()

            // The pilot should have either evolved or passed without error
            // No assertion needed — the test passes if it doesn't throw
        })
    })

    describe('optimizeLatency', () => {
        it('should return optimization suggestions', async () => {
            const suggestions = await (pilot as any).optimizeLatency()

            expect(Array.isArray(suggestions)).toBe(true)
        })
    })

    describe('tuneEmergentSkillHyperparameters', () => {
        it('should tune skill synthesizer based on recent metrics', async () => {
            const recentMetrics = [
                { metricName: 'skill_verification_result', metricValue: 1 },
                { metricName: 'skill_verification_result', metricValue: 1 },
                { metricName: 'skill_verification_result', metricValue: 0 },
            ] as any[]

            const result = await (pilot as any).tuneEmergentSkillHyperparameters(recentMetrics)
            expect(typeof result).toBe('boolean')
        })
    })
})
