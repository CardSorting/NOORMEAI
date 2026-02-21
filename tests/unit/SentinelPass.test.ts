import { jest } from '@jest/globals'
import { KnowledgeDistiller } from '../../src/agentic/improvement/KnowledgeDistiller'
import { CuriosityEngine } from '../../src/agentic/improvement/CuriosityEngine'
import { GovernanceManager } from '../../src/agentic/improvement/GovernanceManager'
import { CortexJanitor } from '../../src/agentic/improvement/CortexJanitor'
import { sql } from '../../src/raw-builder/sql.js'

jest.mock('../../src/raw-builder/sql.js', () => ({
    sql: Object.assign(
        (strings: any, ...values: any[]) => ({
            execute: (jest.fn() as any).mockResolvedValue({ rows: [] })
        }),
        {
            raw: (val: string) => val,
            table: (val: string) => val
        }
    )
}))

describe('Sentinel Pass: Production Hardening (Pass 4)', () => {
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
            innerJoin: (jest.fn() as any).mockReturnThis(),
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
                dialect: { constructor: { name: 'SqliteDialect' } },
                execute: (jest.fn() as any).mockResolvedValue({ rows: [] })
            })
        }

        cortex = {
            db: mockDb,
            strategy: { rollbackPersona: jest.fn() },
            reflections: { reflect: jest.fn() },
            rituals: { scheduleRitual: jest.fn() }
        }
    })

    describe('KnowledgeDistiller: Iterative Consolidation & Metrics', () => {
        it('should perform bucketed iterative merging and emit hit metrics', async () => {
            const distiller = new KnowledgeDistiller(mockDb as any)

            // Mock candidates for consolidation
            mockDb.execute.mockResolvedValueOnce([{ entity: 'AI' }]) // candidates select

            // Mock items for the entity (Similarity > 0.85)
            const items = [
                { id: 1, entity: 'AI', fact: 'Artificial Intelligence is a branch of computer science.', confidence: 0.9, metadata: '{}', tags: '[]', created_at: new Date(), updated_at: new Date() },
                { id: 2, entity: 'AI', fact: 'Artificial Intelligence is a branch of computer science', confidence: 0.8, metadata: '{}', tags: '[]', created_at: new Date(), updated_at: new Date() }
            ]
            // These strings differ only by a period. Similarity should be high.
            // We need to mock getKnowledgeByEntity query
            mockDb.execute.mockResolvedValueOnce(items)

            const merged = await distiller.consolidateKnowledge()

            expect(merged).toBe(1)
            expect(mockDb.updateTable).toHaveBeenCalled()
            expect(mockDb.deleteFrom).toHaveBeenCalled()
        })

        it('should emit a metric event on recordHit', async () => {
            const distiller = new KnowledgeDistiller(mockDb as any)
            mockDb.executeTakeFirst.mockResolvedValue({ id: 1, entity: 'AGI', metadata: '{}' })

            await distiller.recordHit(1)

            expect(mockDb.insertInto).toHaveBeenCalledWith('agent_metrics')
            const metricValues = mockDb.values.mock.calls[0][0]
            expect(metricValues.metric_name).toBe('entity_hit_AGI')
        })
    })

    describe('CuriosityEngine: Incremental Hotspots', () => {
        it('should identify hotspots using metrics instead of scanning memories', async () => {
            const engine = new CuriosityEngine(mockDb as any)

            // Mock top entities from metrics (metric_name starts with entity_hit_)
            mockDb.execute.mockResolvedValueOnce([
                { entity: 'entity_hit_Memory', references: 100 }
            ])

            // Mock knowledge count for the entity (low count = hotspot)
            mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 1 })

            const hotspots = await engine.identifyKnowledgeHotspots()

            expect(hotspots.length).toBe(1)
            expect(hotspots[0].entity).toBe('Memory')
            expect(hotspots[0].references).toBe(100)
        })
    })

    describe('Governance: Self-Healing Rollbacks', () => {
        it('should trigger strategic rollback on catastrophic success rate failure', async () => {
            const governor = new GovernanceManager(mockDb as any, cortex as any)

            // Mock policies (empty)
            mockDb.execute.mockResolvedValueOnce([])

            // Mock recent cost & success (high cost, critically low success)
            mockDb.executeTakeFirst.mockResolvedValueOnce({ total: 10.0 }) // cost
            mockDb.executeTakeFirst.mockResolvedValueOnce({ avg: 0.1 }) // success (critical < 0.3)

            // Mock active persona lookup
            mockDb.executeTakeFirst.mockResolvedValueOnce({ id: 'pers_champion' })

            await governor.performAudit()

            expect(cortex.strategy.rollbackPersona).toHaveBeenCalledWith('pers_champion')
        })
    })

    describe('CortexJanitor: Autonomous Indexing', () => {
        it('should apply usage-based indexes to core tables', async () => {
            // Need to mock sql.raw and sql.table to return strings for our mockDb to handle or just mock sql
            const janitor = new CortexJanitor(mockDb as any)

            const changes = await janitor.autonomousIndexing()

            expect(changes.length).toBeGreaterThan(0)
            expect(changes[0]).toContain('Ensured index idx_')
        })
    })
})
