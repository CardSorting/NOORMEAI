import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { ContextBuffer } from '../../src/agentic/ContextBuffer'
import { KnowledgeDistiller } from '../../src/agentic/improvement/KnowledgeDistiller'
import { VectorIndexer } from '../../src/agentic/VectorIndexer'
import { SessionCompressor } from '../../src/agentic/SessionCompressor'
import type { AgentMessage } from '../../src/types'

describe('AI Memory Safeguards Verification', () => {
    let mockDb: any
    let distiller: KnowledgeDistiller
    let indexer: VectorIndexer
    let compressor: SessionCompressor

    beforeEach(() => {
        mockDb = {
            selectFrom: jest.fn().mockReturnThis(),
            selectAll: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            execute: (jest.fn() as any).mockResolvedValue([]),
            executeTakeFirst: (jest.fn() as any).mockResolvedValue(null),
            insertInto: jest.fn().mockReturnThis(),
            values: jest.fn().mockReturnThis(),
            returningAll: jest.fn().mockReturnThis(),
            executeTakeFirstOrThrow: (jest.fn() as any).mockResolvedValue({}),
            updateTable: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            transaction: jest.fn().mockReturnThis()
        }

        // Fix duplicate execute entry
        mockDb.transaction.mockImplementation(() => ({
            execute: jest.fn().mockImplementation((fn: any) => fn(mockDb))
        }))

        distiller = new KnowledgeDistiller(mockDb as any)
        indexer = new VectorIndexer(mockDb as any, { provider: 'sqlite-vss' })
        compressor = new SessionCompressor(mockDb as any)
    })

    describe('MemoryFitness Logic', () => {
        it('should calculate higher fitness for user-provided facts', () => {
            const userFact = {
                id: 1,
                entity: 'test',
                fact: 'user fact',
                confidence: 0.9,
                metadata: { source: 'user', hit_count: 10 },
                createdAt: new Date(Date.now() - 10 * 24 * 3600000) // 10 days old
            }
            const assistantFact = {
                id: 2,
                entity: 'test',
                fact: 'assistant fact',
                confidence: 0.9,
                metadata: { source: 'assistant', hit_count: 10 },
                createdAt: new Date(Date.now() - 10 * 24 * 3600000)
            }

            const userFitness = distiller.calculateFitness(userFact as any)
            const assistantFitness = distiller.calculateFitness(assistantFact as any)

            expect(userFitness).toBeGreaterThan(assistantFitness)
        })

        it('should cap confidence for assistant facts without cross-session proof', async () => {
            // Mocking existing fact
            mockDb.executeTakeFirst.mockResolvedValueOnce({
                id: 1,
                confidence: 0.8,
                metadata: JSON.stringify({ source: 'assistant', session_count: 1 })
            })

            // Mocking update result
            mockDb.executeTakeFirstOrThrow.mockResolvedValueOnce({
                id: 1,
                confidence: 0.85
            })

            const result = await distiller.verifyKnowledge(1, 0.2)
            expect(result?.confidence).toBeLessThanOrEqual(0.85)
        })
    })

    describe('Hybrid Search & Relevance Thresholding', () => {
        it('should filter out results below minScore', async () => {
            // Mock manual fallback with mixed scores
            mockDb.execute.mockResolvedValueOnce([
                { id: 1, session_id: 's1', content: 'high relevance', embedding: JSON.stringify([1, 0]), created_at: new Date() },
                { id: 2, session_id: 's1', content: 'low relevance', embedding: JSON.stringify([0, 1]), created_at: new Date() }
            ])

            const queryVec = [1, 0]
            const results = await indexer.search(queryVec, { minScore: 0.9 })

            expect(results).toHaveLength(1)
            expect(results[0].content).toBe('high relevance')
        })
    })

    describe('Token Management & Importance Trimming', () => {
        it('should prioritize anchors during trimming', () => {
            const buffer = new ContextBuffer({ maxMessages: 2 })
            const baseMsg = { id: 1, sessionId: 1, createdAt: new Date() }

            buffer.addMessage({ ...baseMsg, role: 'system', content: 'sys' })
            buffer.addMessage({ ...baseMsg, role: 'user', content: 'u1', metadata: { anchor: true } })
            buffer.addMessage({ ...baseMsg, role: 'assistant', content: 'a1' })
            buffer.addMessage({ ...baseMsg, role: 'user', content: 'u2' })

            // Trim should happen since count (4) > max (2 * 1.5 = 3)
            const window = buffer.getWindow()
            expect(window.find(m => (m.metadata as any)?.anchor)).toBeDefined()
        })
    })
})
