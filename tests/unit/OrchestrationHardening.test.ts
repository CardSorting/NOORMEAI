import { jest } from '@jest/globals'
import { RitualOrchestrator } from '../../src/agentic/improvement/RitualOrchestrator'
import { GovernanceManager } from '../../src/agentic/improvement/GovernanceManager'
import { StrategicPlanner } from '../../src/agentic/improvement/StrategicPlanner'
import { EvolutionaryPilot } from '../../src/agentic/improvement/EvolutionaryPilot'

describe('AI Orchestration & Evolution Hardening (Pass 3)', () => {
    let mockDb: any
    let cortex: any

    beforeEach(() => {
        mockDb = {
            selectFrom: (jest.fn() as any).mockReturnThis(),
            selectAll: (jest.fn() as any).mockReturnThis(),
            select: (jest.fn() as any).mockReturnThis(),
            where: (jest.fn() as any).mockReturnThis(),
            orderBy: (jest.fn() as any).mockReturnThis(),
            limit: (jest.fn() as any).mockReturnThis(),
            execute: (jest.fn() as any).mockResolvedValue([]),
            executeTakeFirst: (jest.fn() as any).mockResolvedValue(null),
            insertInto: (jest.fn() as any).mockReturnThis(),
            values: (jest.fn() as any).mockReturnThis(),
            returningAll: (jest.fn() as any).mockReturnThis(),
            executeTakeFirstOrThrow: (jest.fn() as any).mockResolvedValue({}),
            updateTable: (jest.fn() as any).mockReturnThis(),
            set: (jest.fn() as any).mockReturnThis(),
            deleteFrom: (jest.fn() as any).mockReturnThis(),
            transaction: (jest.fn() as any).mockReturnValue({
                execute: jest.fn((cb: any) => cb(mockDb))
            }),
            getExecutor: jest.fn().mockReturnValue({
                adapter: { constructor: { name: 'SqliteAdapter' } },
                dialect: { constructor: { name: 'SqliteDialect' } }
            })
        }

        cortex = {
            db: mockDb,
            rituals: { scheduleRitual: jest.fn() },
            metrics: {
                getRecentMetrics: (jest.fn() as any).mockResolvedValue([]),
                getAverageMetric: (jest.fn() as any).mockResolvedValue(0.1),
                getMetricStats: (jest.fn() as any).mockResolvedValue({ avg: 0.1, count: 0 })
            },
            reflections: { reflect: jest.fn() },
            governor: { performAudit: (jest.fn() as any).mockResolvedValue({ healthy: true, issues: [] }) },
            strategy: { mutateStrategy: (jest.fn() as any).mockResolvedValue([]) },
            evolution: { evolve: jest.fn() },
            pilot: { runSelfImprovementCycle: (jest.fn() as any).mockResolvedValue({ evolved: false, changes: [] }) },
            janitor: { optimizeDatabase: jest.fn(), runPruningRitual: jest.fn(), cleanOrphans: jest.fn() },
            ablation: { pruneZombies: jest.fn() },
            compressor: { semanticPruning: jest.fn() },
            tests: { runAllProbes: (jest.fn() as any).mockResolvedValue([]) },
            capabilities: { getCapabilities: (jest.fn() as any).mockResolvedValue([]) },
            reasoner: {
                detectContradictions: (jest.fn() as any).mockResolvedValue([]),
                synthesizeLessons: (jest.fn() as any).mockResolvedValue({})
            }
        }
    })

    describe('Ritual Concurrency & Failure Backoff', () => {
        it('should lock rituals during execution and calculate exponential backoff on failure', async () => {
            const orchestrator = new RitualOrchestrator(mockDb as any, cortex as any)

            const now = new Date()
            const ritual = { id: 1, name: 'Test', type: 'optimization', frequency: 'daily', metadata: '{}' }
            mockDb.execute.mockResolvedValueOnce([ritual]) // runPendingRituals select

            // Trigger failure to test backoff
            cortex.pilot.runSelfImprovementCycle.mockRejectedValue(new Error('Evolution failed'))

            await orchestrator.runPendingRituals()

            // Should have updated twice: one for lock, one for result
            expect(mockDb.updateTable).toHaveBeenCalledWith('agent_rituals')
            const updateSet = mockDb.set.mock.calls

            // Check lock update
            expect(updateSet[0][0]).toHaveProperty('locked_until')

            // Check final result update with failure
            const finalUpdate = updateSet[1][0]
            expect(finalUpdate.status).toBe('failure')
            expect(JSON.parse(finalUpdate.metadata)).toHaveProperty('failureCount', 1)

            // Next run should be > 24h + 10m from now
            const nextRun = new Date(finalUpdate.next_run)
            expect(nextRun.getTime()).toBeGreaterThan(now.getTime() + 86400000 + 500000)
        })
    })

    describe('Policy-Driven Governance', () => {
        it('should use agent_policies table to override hardcoded cost thresholds', async () => {
            const governor = new GovernanceManager(mockDb as any, cortex as any)

            // Mock high budget policy
            mockDb.execute.mockResolvedValueOnce([{
                name: 'hourly_budget', type: 'budget', is_enabled: true, definition: JSON.stringify({ threshold: 5.0 })
            }])

            // Mock recent cost = 2.0 (higher than hardcoded 1.0 but lower than policy 5.0)
            mockDb.executeTakeFirst.mockResolvedValue({ total: 2.0 })

            const audit = await governor.performAudit()
            expect(audit.healthy).toBe(true)
            expect(audit.issues.length).toBe(0)
        })

        it('should trigger automated remediation rituals when audit fails', async () => {
            const governor = new GovernanceManager(mockDb as any, cortex as any)
            mockDb.execute.mockResolvedValueOnce([]) // No policies
            mockDb.executeTakeFirst.mockResolvedValueOnce({ total: 10.0 }) // High cost

            await governor.performAudit()

            expect(cortex.rituals.scheduleRitual).toHaveBeenCalledWith(
                'Budget Remediation', 'compression', expect.any(String), expect.any(String), expect.any(Object)
            )
        })
    })

    describe('A/B Strategy Testing', () => {
        it('should create a challenger persona instead of direct mutation', async () => {
            const planner = new StrategicPlanner(mockDb as any, cortex as any)

            const persona = { id: 1, name: 'Champion', role: 'Chief', metadata: '{}' }
            mockDb.execute.mockResolvedValueOnce([persona]) // mutateStrategy select

            // Mock performance report recommending mutation (0.7 triggers optimize_accuracy since threshold is 0.8)
            mockDb.execute.mockResolvedValueOnce([{ metric_name: 'task_success_rate', metric_value: 0.7 }]) // analyzePersona metrics

            const mutations = await planner.mutateStrategy()

            expect(mutations[0]).toContain('mutated and entering verification window')
            expect(mockDb.updateTable).toHaveBeenCalledWith('agent_personas')
        })
    })

    describe('Full-Spectrum Evolution', () => {
        it('should perform Z-score analysis on multiple metrics and trigger evolution', async () => {
            const pilot = new EvolutionaryPilot(mockDb as any, cortex as any)

            // Mock recent metrics showing a success rate collapse
            const recentMetrics = Array.from({ length: 10 }, (_, i) => ({
                metricName: 'success_rate',
                metricValue: i < 2 ? 0.2 : 0.9 // Recent 2 are 0.2, others 0.9
            }))
            cortex.metrics.getRecentMetrics.mockResolvedValue(recentMetrics)

            await pilot.runSelfImprovementCycle()

            // Should detect success rate drop and trigger mutation
            expect(cortex.strategy.mutateStrategy).toHaveBeenCalled()
        })
    })
})
