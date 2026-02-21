import type { Kysely } from '../../kysely.js'
import type {
    AgenticConfig,
    AgentGoal
} from '../../types/index.js'

export interface GoalTable {
    id: number | string
    session_id: number | string
    parent_id: number | string | null
    description: string
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked'
    priority: number
    metadata: string | null // JSON string
    created_at: string | Date
    updated_at: string | Date
}

export interface GoalDatabase {
    agent_goals: GoalTable
}

/**
 * GoalArchitect enables agents to autonomously deconstruct complex
 * objectives into manageable sub-goals.
 */
export class GoalArchitect {
    private goalsTable: string

    constructor(
        private db: Kysely<any>,
        private config: AgenticConfig = {}
    ) {
        this.goalsTable = config.goalsTable || 'agent_goals'
    }

    private get typedDb(): Kysely<GoalDatabase> {
        return this.db as unknown as Kysely<GoalDatabase>
    }

    /**
     * Deconstruct a goal into multiple sub-goals transactionally.
     */
    async deconstructGoal(goalId: string | number, subGoals: string[]): Promise<AgentGoal[]> {
        return await this.db.transaction().execute(async (trx) => {
            const goal = await trx
                .selectFrom(this.goalsTable as any)
                .selectAll()
                .where('id', '=', goalId)
                .executeTakeFirst() as unknown as GoalTable | undefined

            if (!goal) throw new Error(`Goal ${goalId} not found`)

            console.log(`[GoalArchitect] Deconstructing goal ${goalId}: "${goal.description}" into ${subGoals.length} steps.`)

            const created: AgentGoal[] = []
            // Calculate base priority for sub-goals (higher than parent)
            const basePriority = (goal.priority || 0) + 1

            for (let i = 0; i < subGoals.length; i++) {
                const desc = subGoals[i]
                const subGoal = await trx
                    .insertInto(this.goalsTable as any)
                    .values({
                        session_id: goal.session_id,
                        parent_id: goalId,
                        description: desc,
                        status: 'pending',
                        priority: basePriority + i, // Sequential priority
                        created_at: new Date(),
                        updated_at: new Date()
                    } as any)
                    .returningAll()
                    .executeTakeFirstOrThrow() as unknown as GoalTable

                created.push(this.parseGoal(subGoal))
            }
            
            // Update parent status to in_progress if it was pending
            if (goal.status === 'pending') {
                 await trx
                    .updateTable(this.goalsTable as any)
                    .set({ status: 'in_progress', updated_at: new Date() } as any)
                    .where('id', '=', goalId)
                    .execute()
            }

            return created
        })
    }

    /**
     * Reorder goals by updating their priorities in batch.
     * Lower number = higher priority.
     */
    async reorderGoals(goalIds: (string | number)[]): Promise<void> {
        await this.db.transaction().execute(async (trx) => {
            for (let i = 0; i < goalIds.length; i++) {
                await trx
                    .updateTable(this.goalsTable as any)
                    .set({ priority: i, updated_at: new Date() } as any)
                    .where('id', '=', goalIds[i])
                    .execute()
            }
        })
    }

    /**
     * Update a goal's status and optionally log outcome/reason in metadata.
     */
    async markGoalAs(
        goalId: string | number, 
        status: AgentGoal['status'], 
        outcome?: string
    ): Promise<AgentGoal> {
        const goal = await this.typedDb
            .selectFrom(this.goalsTable as any)
            .selectAll()
            .where('id', '=', goalId)
            .executeTakeFirst()

        if (!goal) throw new Error(`Goal ${goalId} not found`)

        const currentMeta = goal.metadata ? JSON.parse(goal.metadata as string) : {}
        const newMeta = {
            ...currentMeta,
            lastStatusChange: Date.now(),
            outcome: outcome || currentMeta.outcome
        }

        const updated = await this.db
            .updateTable(this.goalsTable as any)
            .set({
                status,
                metadata: JSON.stringify(newMeta),
                updated_at: new Date()
            } as any)
            .where('id', '=', goalId)
            .returningAll()
            .executeTakeFirstOrThrow() as unknown as GoalTable

        return this.parseGoal(updated)
    }

    /**
     * Check if a goal is blocked by uncompleted sub-goals.
     * Returns true if all sub-goals are completed, false otherwise.
     */
    async checkGoalDependencies(goalId: string | number): Promise<{ canComplete: boolean, pendingSubGoals: number }> {
        const subGoals = await this.typedDb
            .selectFrom(this.goalsTable as any)
            .select('status')
            .where('parent_id', '=', goalId)
            .execute()

        if (subGoals.length === 0) {
            return { canComplete: true, pendingSubGoals: 0 }
        }

        const pending = subGoals.filter(g => g.status !== 'completed' && g.status !== 'failed').length
        
        return {
            canComplete: pending === 0,
            pendingSubGoals: pending
        }
    }

    /**
    * Identify goals that have "stalled" (no status changes in > 7 days)
    */
    async trackStalledGoals(daysThreshold: number = 7): Promise<AgentGoal[]> {
        console.log('[GoalArchitect] Identifying stalled objectives...')

        const thresholdDate = new Date(Date.now() - daysThreshold * 24 * 3600000)

        const stalled = await this.typedDb
            .selectFrom(this.goalsTable as any)
            .selectAll()
            .where('status', 'in', ['pending', 'in_progress'])
            .where('updated_at', '<', thresholdDate)
            .execute() as unknown as GoalTable[]

        if (stalled.length > 0) {
            console.log(`[GoalArchitect] Identified ${stalled.length} stalled goals.`)
        }

        return stalled.map(g => this.parseGoal(g))
    }

    private parseGoal(g: any): AgentGoal {
        return {
            id: g.id,
            sessionId: g.session_id,
            parentId: g.parent_id,
            description: g.description,
            status: g.status,
            priority: g.priority,
            metadata: typeof g.metadata === 'string' ? JSON.parse(g.metadata) : (g.metadata || {}),
            createdAt: new Date(g.created_at),
            updatedAt: new Date(g.updated_at)
        }
    }
}
