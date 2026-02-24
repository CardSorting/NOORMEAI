import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { StrategicPlanner } from '../../src/agentic/improvement/StrategicPlanner.js'
import { Cortex } from '../../src/agentic/Cortex.js'

describe('StrategicPlanner', () => {
    let db: NOORMME
    let planner: StrategicPlanner
    let cortex: Cortex

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        // Create persona table
        await kysely.schema
            .createTable('agent_personas')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('name', 'varchar(255)', col => col.notNull())
            .addColumn('role', 'text')
            .addColumn('capabilities', 'text') // JSON
            .addColumn('policies', 'text') // JSON
            .addColumn('metadata', 'text') // JSON
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        // Create metrics table
        await kysely.schema
            .createTable('agent_metrics')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('metric_name', 'varchar(255)', col => col.notNull())
            .addColumn('metric_value', 'real', col => col.notNull())
            .addColumn('unit', 'varchar(50)')
            .addColumn('metadata', 'text') // JSON
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        // Mock Cortex
        cortex = {
            metrics: {
                getRecentMetrics: (jest.fn() as any).mockResolvedValue([])
            },
            tests: {
                runAllProbes: (jest.fn() as any).mockResolvedValue([])
            },
            reasoner: {
                detectContradictions: (jest.fn() as any).mockResolvedValue([]),
                synthesizeLessons: (jest.fn() as any).mockResolvedValue({})
            }
        } as any

        planner = new StrategicPlanner(kysely, cortex)
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    const createPersona = async (name: string, role: string) => {
        return await db.getKysely()
            .insertInto('agent_personas')
            .values({
                name,
                role,
                metadata: '{}',
                created_at: new Date(),
                updated_at: new Date()
            } as any)
            .returningAll()
            .executeTakeFirst() as any
    }

    const createMetric = async (name: string, value: number, personaId: number) => {
        await db.getKysely()
            .insertInto('agent_metrics')
            .values({
                metric_name: name,
                metric_value: value,
                metadata: JSON.stringify({ persona_id: personaId }),
                created_at: new Date()
            } as any)
            .execute()
    }

    describe('analyzePersona', () => {
        it('should recommend maintaining if no metrics exist', async () => {
            const persona = await createPersona('Bot', 'Helper')
            const report = await planner.analyzePersona(persona.id)

            expect(report.recommendation).toBe('maintain')
            expect(report.successRate).toBe(0.9)
        })

        it('should recommend critical intervention if success rate is low', async () => {
            const persona = await createPersona('Bot', 'Helper')
            await createMetric('task_success_rate', 0.5, persona.id)
            await createMetric('task_success_rate', 0.6, persona.id)

            const report = await planner.analyzePersona(persona.id)

            expect(report.recommendation).toBe('critical_intervention')
            expect(report.successRate).toBeCloseTo(0.55)
        })

        it('should recommend efficiency boost if latency is high', async () => {
            const persona = await createPersona('Bot', 'Helper')
            await createMetric('task_success_rate', 1.0, persona.id)
            await createMetric('query_latency', 1500, persona.id)

            const report = await planner.analyzePersona(persona.id)

            expect(report.recommendation).toBe('optimize_efficiency')
        })
    })

    describe('evolvePersona', () => {
        it('should apply role update for accuracy optimization', async () => {
            const persona = await createPersona('Bot', 'Helper')
            const report = {
                personaId: persona.id,
                successRate: 0.85,
                averageLatency: 100,
                sampleSize: 10,
                recommendation: 'optimize_accuracy' as const
            }

            // Must fetch full persona object first as expected by evolvePersona
            const p = await db.getKysely().selectFrom('agent_personas').selectAll().executeTakeFirst() as any
            const fullPersona = {
                ...p,
                capabilities: [],
                policies: [],
                metadata: JSON.parse(p.metadata),
                createdAt: new Date(p.created_at),
                updatedAt: new Date(p.updated_at)
            }

            const result = await planner.evolvePersona(fullPersona, report)

            expect(result).toContain('mutated and entering verification window.')

            const updated = await db.getKysely().selectFrom('agent_personas').selectAll().executeTakeFirst() as any
            expect(updated.role).toContain('Focus strictly on accuracy')

            const metadata = JSON.parse(updated.metadata)
            expect(metadata.mutationHistory).toHaveLength(1)
        })
    })

    describe('rollbackPersona', () => {
        it('should revert to previous state', async () => {
            const persona = await createPersona('Bot', 'Original Role')

            // First evolution
            const p = await db.getKysely().selectFrom('agent_personas').selectAll().executeTakeFirst() as any
            const fullPersona = {
                ...p,
                capabilities: [],
                policies: [],
                metadata: JSON.parse(p.metadata),
                createdAt: new Date(p.created_at),
                updatedAt: new Date(p.updated_at)
            }

            await planner.evolvePersona(fullPersona, {
                personaId: persona.id,
                successRate: 0.8,
                averageLatency: 100,
                sampleSize: 10,
                recommendation: 'optimize_accuracy'
            })

            const evolved = await db.getKysely().selectFrom('agent_personas').selectAll().executeTakeFirst() as any
            expect(evolved.role).not.toBe('Original Role')

            // Rollback
            await planner.rollbackPersona(persona.id)

            const reverted = await db.getKysely().selectFrom('agent_personas').selectAll().executeTakeFirst() as any
            expect(reverted.role).toBe('Original Role')
        })
    })
})
