import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { GoalArchitect } from '../../src/agentic/improvement/GoalArchitect.js'

describe('GoalArchitect', () => {
    let db: NOORMME
    let architect: GoalArchitect

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        // Create goals table
        await kysely.schema
            .createTable('agent_goals')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer', col => col.notNull())
            .addColumn('parent_id', 'integer')
            .addColumn('description', 'text', col => col.notNull())
            .addColumn('status', 'varchar(50)', col => col.notNull())
            .addColumn('priority', 'integer', col => col.notNull())
            .addColumn('metadata', 'text') // JSON
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        architect = new GoalArchitect(kysely)
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    const createGoal = async (description: string, status = 'pending', parentId?: number) => {
        return await db.getKysely()
            .insertInto('agent_goals')
            .values({
                session_id: 1,
                parent_id: parentId,
                description,
                status,
                priority: 0,
                created_at: new Date(),
                updated_at: new Date()
            } as any)
            .returningAll()
            .executeTakeFirst() as any
    }

    describe('deconstructGoal', () => {
        it('should break a goal into subgoals and update parent status', async () => {
            const parent = await createGoal('Build App', 'pending')
            
            const subGoals = await architect.deconstructGoal(parent.id, ['Design DB', 'Write API'])

            expect(subGoals).toHaveLength(2)
            expect(subGoals[0].parentId).toBe(parent.id)
            expect(subGoals[0].priority).toBeGreaterThan(0) // Higher than parent
            expect(subGoals[1].description).toBe('Write API')

            // Check parent status update
            const updatedParent = await db.getKysely().selectFrom('agent_goals').selectAll().where('id', '=', parent.id).executeTakeFirst() as any
            expect(updatedParent.status).toBe('in_progress')
        })
    })

    describe('checkGoalDependencies', () => {
        it('should return false if subgoals are pending', async () => {
            const parent = await createGoal('Parent')
            await createGoal('Child 1', 'pending', parent.id)
            await createGoal('Child 2', 'completed', parent.id)

            const check = await architect.checkGoalDependencies(parent.id)
            expect(check.canComplete).toBe(false)
            expect(check.pendingSubGoals).toBe(1)
        })

        it('should return true if all subgoals are done', async () => {
            const parent = await createGoal('Parent')
            await createGoal('Child 1', 'completed', parent.id)
            await createGoal('Child 2', 'completed', parent.id)

            const check = await architect.checkGoalDependencies(parent.id)
            expect(check.canComplete).toBe(true)
            expect(check.pendingSubGoals).toBe(0)
        })
    })

    describe('markGoalAs', () => {
        it('should update status and metadata', async () => {
            const goal = await createGoal('Task')
            const updated = await architect.markGoalAs(goal.id, 'failed', 'Network Error')

            expect(updated.status).toBe('failed')
            expect(updated.metadata?.outcome).toBe('Network Error')
            expect(updated.metadata?.lastStatusChange).toBeDefined()
        })
    })

    describe('trackStalledGoals', () => {
        it('should identify goals not updated recently', async () => {
            // Create old goal manually to control timestamp
            await db.getKysely()
                .insertInto('agent_goals')
                .values({
                    session_id: 1,
                    description: 'Old Goal',
                    status: 'in_progress',
                    priority: 0,
                    created_at: new Date(Date.now() - 1000000000),
                    updated_at: new Date(Date.now() - 8 * 24 * 3600000) // 8 days ago
                } as any)
                .execute()

            const recentGoal = await createGoal('Recent Goal', 'in_progress')

            const stalled = await architect.trackStalledGoals(7)
            
            expect(stalled).toHaveLength(1)
            expect(stalled[0].description).toBe('Old Goal')
        })
    })
})
