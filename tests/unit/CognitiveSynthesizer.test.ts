import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { CognitiveSynthesizer } from '../../src/agentic/telemetry/CognitiveSynthesizer.js'

describe('CognitiveSynthesizer', () => {
    let db: NOORMME
    let synthesizer: CognitiveSynthesizer

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        // Schema must match what synthesize() actually references:
        // columns: session_id, inferred_goal, strategy, evolution_path, status, autonomy_level, metadata, updated_at
        await kysely.schema.createTable('agent_session_evolution').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer', col => col.notNull())
            .addColumn('inferred_goal', 'text')
            .addColumn('strategy', 'varchar(100)')
            .addColumn('evolution_path', 'text')
            .addColumn('status', 'varchar(50)')
            .addColumn('autonomy_level', 'real', col => col.defaultTo(1))
            .addColumn('metadata', 'text')
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        synthesizer = new CognitiveSynthesizer(kysely, {})
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    describe('inferGoalFromContent', () => {
        it('should infer debugging goal from debug-related content', () => {
            const goal = (synthesizer as any).inferGoalFromContent(
                'I need to debug this error in the authentication module'
            )
            expect(typeof goal).toBe('string')
            expect(goal.length).toBeGreaterThan(0)
        })

        it('should infer build/deploy goal from deployment content', () => {
            const goal = (synthesizer as any).inferGoalFromContent(
                'Deploy the application to production servers'
            )
            expect(typeof goal).toBe('string')
        })

        it('should return a generic goal for unrecognized content', () => {
            const goal = (synthesizer as any).inferGoalFromContent(
                'Hello world this is a random sentence'
            )
            expect(typeof goal).toBe('string')
        })
    })

    describe('detectStrategy', () => {
        it('should detect strategy types from content', () => {
            const strategy = (synthesizer as any).detectStrategy(
                'Let me trace through the code to find the bug'
            )
            expect(typeof strategy).toBe('string')
        })
    })

    describe('calculateAutonomy', () => {
        it('should return an integer autonomy level', () => {
            const level = (synthesizer as any).calculateAutonomy(0, 3)
            expect(typeof level).toBe('number')
            expect(level).toBeGreaterThanOrEqual(1)
            expect(level).toBeLessThanOrEqual(5)
        })

        it('should increase autonomy when pivots are 0', () => {
            const level = (synthesizer as any).calculateAutonomy(0, 3)
            expect(level).toBe(4) // min(5, 3+1)
        })

        it('should decrease autonomy with many pivots (>10)', () => {
            const level = (synthesizer as any).calculateAutonomy(15, 3)
            expect(level).toBeLessThanOrEqual(3)
        })
    })

    describe('detectSentimentDrift', () => {
        it('should detect frustration from negative language', () => {
            const sentiment = (synthesizer as any).detectSentimentDrift(
                'This is wrong and bad, error after error, stuck and cannot proceed, slow and failed'
            )
            expect(sentiment).toBe('frustration')
        })

        it('should detect flow from positive language', () => {
            const sentiment = (synthesizer as any).detectSentimentDrift(
                'Great progress, everything is working perfectly and smoothly'
            )
            expect(sentiment).toBe('flow')
        })

        it('should return neutral for balanced content', () => {
            const sentiment = (synthesizer as any).detectSentimentDrift(
                'The sky is blue and the grass is green'
            )
            expect(sentiment).toBe('neutral')
        })
    })

    describe('synthesize', () => {
        it('should create a new session evolution record', async () => {
            await synthesizer.synthesize(1, 'Building a REST API with authentication')

            const kysely = db.getKysely()
            const records = await kysely.selectFrom('agent_session_evolution' as any)
                .selectAll()
                .where('session_id', '=', 1)
                .execute()

            expect(records).toHaveLength(1)
            expect((records[0] as any).inferred_goal).toBeDefined()
            expect((records[0] as any).strategy).toBeDefined()
        })

        it('should update existing session evolution record', async () => {
            await synthesizer.synthesize(1, 'Initial planning for feature')
            await synthesizer.synthesize(1, 'Implementing the feature now')

            const kysely = db.getKysely()
            const records = await kysely.selectFrom('agent_session_evolution' as any)
                .selectAll()
                .where('session_id', '=', 1)
                .execute()

            // Should update in place (1 record)
            expect(records).toHaveLength(1)
        })
    })

    describe('trackShift', () => {
        it('should record a pivot shift', async () => {
            // First create a base evolution record
            await synthesizer.synthesize(1, 'Working on feature A')

            await synthesizer.trackShift(1, 'pivot')

            const kysely = db.getKysely()
            const records = await kysely.selectFrom('agent_session_evolution' as any)
                .selectAll()
                .where('session_id', '=', 1)
                .execute()

            expect(records.length).toBeGreaterThanOrEqual(1)
        })

        it('should record an abandonment shift', async () => {
            await synthesizer.synthesize(1, 'Working on feature B')

            await synthesizer.trackShift(1, 'abandonment')

            const kysely = db.getKysely()
            const records = await kysely.selectFrom('agent_session_evolution' as any)
                .selectAll()
                .where('session_id', '=', 1)
                .execute()

            expect(records.length).toBeGreaterThanOrEqual(1)
        })
    })
})
