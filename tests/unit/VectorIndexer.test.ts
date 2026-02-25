import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { VectorIndexer } from '../../src/agentic/VectorIndexer.js'

describe('VectorIndexer', () => {
    let db: NOORMME
    let indexer: VectorIndexer

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        await kysely.schema.createTable('agent_memories').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer')
            .addColumn('content', 'text', col => col.notNull())
            .addColumn('embedding', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        indexer = new VectorIndexer(kysely, { dialect: 'sqlite' } as any)
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    describe('addMemory', () => {
        it('should store a memory and return parsed AgentMemory', async () => {
            const embedding = [0.1, 0.2, 0.3]
            const memory = await indexer.addMemory('Test content', embedding, 1, { tag: 'test' })

            expect(memory.content).toBe('Test content')
            expect(memory.id).toBeDefined()
            expect(memory.createdAt).toBeInstanceOf(Date)
        })

        it('should store memory without session or metadata', async () => {
            const memory = await indexer.addMemory('Bare content', [0.5, 0.5])

            expect(memory.content).toBe('Bare content')
            expect(memory.id).toBeDefined()
        })
    })

    describe('addMemories', () => {
        it('should batch-insert multiple memories', async () => {
            const items = [
                { content: 'Memory A', embedding: [1, 0], sessionId: 1 },
                { content: 'Memory B', embedding: [0, 1], sessionId: 1 },
                { content: 'Memory C', embedding: [0.5, 0.5], sessionId: 2 },
            ]

            const results = await indexer.addMemories(items)
            expect(results).toHaveLength(3)
            expect(results[0].content).toBe('Memory A')
            expect(results[2].content).toBe('Memory C')
        })

        it('should return empty array for empty input', async () => {
            const results = await indexer.addMemories([])
            expect(results).toHaveLength(0)
        })
    })

    describe('cosineSimilarity', () => {
        it('should return 1.0 for identical vectors', () => {
            const sim = (indexer as any).cosineSimilarity([1, 0, 0], [1, 0, 0])
            expect(sim).toBeCloseTo(1.0)
        })

        it('should return 0 for orthogonal vectors', () => {
            const sim = (indexer as any).cosineSimilarity([1, 0], [0, 1])
            expect(sim).toBeCloseTo(0.0)
        })

        it('should return -1 for opposite vectors', () => {
            const sim = (indexer as any).cosineSimilarity([1, 0], [-1, 0])
            expect(sim).toBeCloseTo(-1.0)
        })

        it('should handle normalized and unnormalized vectors', () => {
            const sim = (indexer as any).cosineSimilarity([3, 4], [6, 8])
            expect(sim).toBeCloseTo(1.0) // Same direction, different magnitude
        })
    })

    describe('mergeWithRRF', () => {
        it('should merge two ranked lists using Reciprocal Rank Fusion', () => {
            const vectorResults = [
                { id: 1, content: 'A', sessionId: null, metadata: {}, createdAt: new Date() },
                { id: 2, content: 'B', sessionId: null, metadata: {}, createdAt: new Date() },
            ] as any[]

            const keywordResults = [
                { id: 2, content: 'B', sessionId: null, metadata: {}, createdAt: new Date() },
                { id: 3, content: 'C', sessionId: null, metadata: {}, createdAt: new Date() },
            ] as any[]

            const merged = (indexer as any).mergeWithRRF(vectorResults, keywordResults, 10)

            // id=2 appears in both lists, should be ranked highest
            expect(merged[0].id).toBe(2)
            expect(merged.length).toBe(3)
        })

        it('should return all merged results regardless of limit', () => {
            const vectorResults = [
                { id: 1, content: 'A', sessionId: null, metadata: {}, createdAt: new Date() },
                { id: 2, content: 'B', sessionId: null, metadata: {}, createdAt: new Date() },
            ] as any[]

            const keywordResults = [
                { id: 3, content: 'C', sessionId: null, metadata: {}, createdAt: new Date() },
            ] as any[]

            const merged = (indexer as any).mergeWithRRF(vectorResults, keywordResults, 2)
            // RRF merges all unique results
            expect(merged.length).toBe(3)
        })
    })

    describe('mergeResults', () => {
        it('should deduplicate results by id', () => {
            const vectorResults = [
                { id: 1, content: 'A', sessionId: null, metadata: {}, createdAt: new Date() },
                { id: 2, content: 'B', sessionId: null, metadata: {}, createdAt: new Date() },
            ] as any[]

            const keywordResults = [
                { id: 2, content: 'B', sessionId: null, metadata: {}, createdAt: new Date() },
                { id: 3, content: 'C', sessionId: null, metadata: {}, createdAt: new Date() },
            ] as any[]

            const merged = (indexer as any).mergeResults(vectorResults, keywordResults)
            const ids = merged.map((m: any) => m.id)
            const uniqueIds = new Set(ids)
            expect(ids.length).toBe(uniqueIds.size) // No duplicates
        })
    })

    describe('keywordSearch', () => {
        it('should return memories matching the keyword via LIKE', async () => {
            await indexer.addMemory('TypeScript is strongly typed', [1, 0])
            await indexer.addMemory('Python is dynamically typed', [0, 1])
            await indexer.addMemory('Rust has zero-cost abstractions', [0.5, 0.5])

            const results = await (indexer as any).keywordSearch('typed', { limit: 10 })
            expect(results.length).toBeGreaterThanOrEqual(2)
            results.forEach((r: any) => {
                expect(r.content.toLowerCase()).toContain('typed')
            })
        })

        it('should respect the limit parameter', async () => {
            for (let i = 0; i < 10; i++) {
                await indexer.addMemory(`Memory about testing ${i}`, [i / 10, 1 - i / 10])
            }

            const results = await (indexer as any).keywordSearch('testing', { limit: 3 })
            expect(results.length).toBeLessThanOrEqual(3)
        })
    })

    describe('search (hybrid)', () => {
        it('should perform hybrid search and return results', async () => {
            await indexer.addMemory('Build automation with CI/CD', [0.9, 0.1])
            await indexer.addMemory('Testing strategies for production', [0.1, 0.9])

            const results = await indexer.search([0.9, 0.1], { limit: 5 })
            expect(results.length).toBeGreaterThan(0)
        })

        it('should filter by sessionId when provided', async () => {
            await indexer.addMemory('Session 1 memory', [1, 0], 1)
            await indexer.addMemory('Session 2 memory', [0, 1], 2)

            const results = await indexer.search([1, 0], { limit: 10, sessionId: 1 })
            results.forEach(r => {
                expect(r.sessionId).toBe(1)
            })
        })
    })
})
