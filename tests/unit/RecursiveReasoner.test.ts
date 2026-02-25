import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { RecursiveReasoner } from '../../src/agentic/improvement/RecursiveReasoner.js'

describe('RecursiveReasoner', () => {
    let db: NOORMME
    let reasoner: RecursiveReasoner

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        await kysely.schema.createTable('agent_goals').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer', col => col.notNull())
            .addColumn('parent_id', 'integer')
            .addColumn('description', 'text', col => col.notNull())
            .addColumn('status', 'varchar(50)', col => col.notNull())
            .addColumn('priority', 'integer')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()').notNull())
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

        await kysely.schema.createTable('agent_personas').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('name', 'varchar(255)')
            .addColumn('role', 'text')
            .addColumn('capabilities', 'text')
            .addColumn('policies', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        reasoner = new RecursiveReasoner(kysely)
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    describe('analyzeGlobalProgress', () => {
        it('should find goals matching a LIKE pattern', async () => {
            const kysely = db.getKysely()
            await kysely.insertInto('agent_goals' as any).values([
                { session_id: 1, description: 'Improve code coverage', status: 'active', priority: 1, created_at: new Date(), updated_at: new Date() },
                { session_id: 2, description: 'Improve test reliability', status: 'active', priority: 2, created_at: new Date(), updated_at: new Date() },
                { session_id: 3, description: 'Fix deployment pipeline', status: 'completed', priority: 1, created_at: new Date(), updated_at: new Date() },
            ] as any).execute()

            const results = await reasoner.analyzeGlobalProgress('Improve%')
            expect(results).toHaveLength(2)
            results.forEach(r => {
                expect(r.description).toContain('Improve')
            })
        })

        it('should return empty array when no goals match', async () => {
            const results = await reasoner.analyzeGlobalProgress('nonexistent%')
            expect(results).toHaveLength(0)
        })
    })

    describe('synthesizeLessons', () => {
        it('should cluster lessons by token overlap', async () => {
            const kysely = db.getKysely()
            await kysely.insertInto('agent_reflections' as any).values([
                { session_id: '1', outcome: 'success', lessons_learned: 'Always validate input before processing', created_at: new Date() },
                { session_id: '2', outcome: 'success', lessons_learned: 'Validate user input to prevent errors', created_at: new Date() },
                { session_id: '3', outcome: 'failure', lessons_learned: 'Cache results for better performance', created_at: new Date() },
            ] as any).execute()

            const lessons = await reasoner.synthesizeLessons()
            expect(Object.keys(lessons).length).toBeGreaterThan(0)
        })

        it('should return empty clusters when no reflections exist', async () => {
            const lessons = await reasoner.synthesizeLessons()
            expect(Object.keys(lessons)).toHaveLength(0)
        })
    })

    describe('detectContradictions', () => {
        it('should detect contradictory goals', async () => {
            const kysely = db.getKysely()
            await kysely.insertInto('agent_goals' as any).values([
                { session_id: 1, description: 'Increase system complexity for more features', status: 'active', priority: 1, created_at: new Date(), updated_at: new Date() },
                { session_id: 2, description: 'Reduce system complexity for maintainability', status: 'active', priority: 1, created_at: new Date(), updated_at: new Date() },
            ] as any).execute()

            // Register the relevant conflict pair
            reasoner.registerConflictPair('increase', 'reduce')

            const contradictions = await reasoner.detectContradictions()
            expect(contradictions.length).toBeGreaterThanOrEqual(1)
        })

        it('should return empty array when no contradictions exist', async () => {
            const contradictions = await reasoner.detectContradictions()
            expect(contradictions).toHaveLength(0)
        })
    })

    describe('registerConflictPair', () => {
        it('should register and use new conflict pairs', async () => {
            reasoner.registerConflictPair('buy', 'sell')

            const kysely = db.getKysely()
            await kysely.insertInto('agent_goals' as any).values([
                { session_id: 1, description: 'Buy more inventory', status: 'active', priority: 1, created_at: new Date(), updated_at: new Date() },
                { session_id: 2, description: 'Sell off excess inventory', status: 'active', priority: 1, created_at: new Date(), updated_at: new Date() },
            ] as any).execute()

            const contradictions = await reasoner.detectContradictions()
            expect(contradictions.length).toBeGreaterThanOrEqual(1)
        })
    })

    describe('utility methods', () => {
        it('tokenize should split text into lowercase tokens', () => {
            const tokens = (reasoner as any).tokenize('Hello World Test')
            expect(tokens).toEqual(['hello', 'world', 'test'])
        })

        it('intersect should return common elements', () => {
            const result = (reasoner as any).intersect(['a', 'b', 'c'], ['b', 'c', 'd'])
            expect(result).toEqual(['b', 'c'])
        })

        it('intersect should return empty for disjoint arrays', () => {
            const result = (reasoner as any).intersect(['a', 'b'], ['c', 'd'])
            expect(result).toEqual([])
        })
    })
})
