import { jest } from '@jest/globals'
import { VectorIndexer } from '../../src/agentic/VectorIndexer'
import { KnowledgeDistiller } from '../../src/agentic/improvement/KnowledgeDistiller'
import { SessionCompressor } from '../../src/agentic/SessionCompressor'
import { AblationEngine } from '../../src/agentic/improvement/AblationEngine'
import { Cortex } from '../../src/agentic/Cortex'

describe('AI Memory Deep Hardening Pass 2', () => {
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
            groupBy: (jest.fn() as any).mockReturnThis(),
            having: (jest.fn() as any).mockReturnThis(),
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
            knowledge: new KnowledgeDistiller(mockDb as any),
            metrics: {
                getAverageMetric: (jest.fn() as any).mockResolvedValue(0.9),
                getMetricStats: (jest.fn() as any).mockResolvedValue({ count: 20, avg: 0.85 })
            },
            reflections: { reflect: jest.fn() },
            telemetry: { track: jest.fn() }
        }
    })

    describe('Retrieval Hardening (RRF & FTS)', () => {
        it('should correctly merge vector and keyword results using RRF', async () => {
            const indexer = new VectorIndexer(mockDb as any, { provider: 'manual' })
            const vectorMems = [
                { id: 1, content: 'vec1', embedding: [1, 0], metadata: {}, created_at: new Date() },
                { id: 2, content: 'both', embedding: [0, 1], metadata: {}, created_at: new Date() }
            ]
            const keywordMems = [
                { id: 3, content: 'key1', embedding: [1, 1], metadata: {}, created_at: new Date() },
                { id: 2, content: 'both', embedding: [0, 1], metadata: {}, created_at: new Date() }
            ]

            // @ts-ignore
            const fused = indexer['mergeWithRRF'](
                vectorMems.map(m => indexer['parseMemory'](m)),
                keywordMems.map(m => indexer['parseMemory'](m)),
                5
            )

            expect(fused[0].id).toBe(2) // Should be first because it's in both
            expect(fused.length).toBe(3)
        })
    })

    describe('Cognitive Lifecycles (Status & Conflicts)', () => {
        it('should verify status transitions after user verification', async () => {
            const distiller = new KnowledgeDistiller(mockDb as any)

            // Mock transaction and return for distill
            mockDb.executeTakeFirst.mockResolvedValue(null)
            mockDb.executeTakeFirstOrThrow.mockResolvedValue({
                id: 1, entity: 'E', fact: 'F', confidence: 0.9, status: 'verified', metadata: '{}'
            })

            const result = await distiller.distill('E', 'F', 0.9, 's1', [], {}, 'user')
            expect(result.status).toBe('verified')
        })

        it('should mark existing items as disputed if a high-confidence conflicting fact is added', async () => {
            const distiller = new KnowledgeDistiller(mockDb as any)

            const existing = { id: 10, entity: 'Sky', fact: 'Blue', confidence: 0.9, status: 'verified', metadata: '{}' }
            mockDb.execute.mockResolvedValue([existing])

            await distiller.challengeKnowledge('Sky', 'Red', 0.95)

            expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({
                status: 'disputed'
            }))
        })
    })

    describe('Self-Healing (Metric-Aware Ablation)', () => {
        it('should recover ablated items if performance metrics degrade', async () => {
            const ablation = new AblationEngine(mockDb as any, cortex as any)

            // Mock metric drop
            cortex.metrics.getAverageMetric.mockResolvedValue(0.9)
            cortex.metrics.getMetricStats.mockResolvedValue({ count: 20, avg: 0.5 }) // 0.5 < 0.9 * 0.8

            mockDb.execute.mockResolvedValue([{ id: 55 }]) // Active ablation
            mockDb.executeTakeFirst.mockResolvedValue({ id: 55, metadata: '{"ablation_test":true, "original_confidence":0.8}' })

            const result = await ablation.monitorAblationPerformance()
            expect(result.status).toBe('degraded')
            expect(result.recoveredCount).toBe(1)
            expect(mockDb.updateTable).toHaveBeenCalledWith('agent_knowledge_base')
        })
    })

    describe('Hierarchical Context (Era Reification)', () => {
        it('should inject a system summary message when consolidating eras', async () => {
            const compressor = new SessionCompressor(mockDb as any)

            const oldEpochs = Array.from({ length: 11 }, (_, i) => ({
                id: i, summary: `S${i}`, start_message_id: 1, end_message_id: 2, created_at: new Date()
            }))
            mockDb.execute.mockResolvedValue(oldEpochs) // Return > 10 epochs

            mockDb.executeTakeFirstOrThrow.mockResolvedValue({ id: 99, session_id: 's1', summary: 'Era Summary' })

            await compressor.consolidateEpochsIntoEra('s1')

            // Should insert into agent_messages (for reification)
            expect(mockDb.insertInto).toHaveBeenCalledWith('agent_messages')
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                role: 'system',
                content: expect.stringContaining('[ERA SUMMARY]')
            }))
        })
    })
})
