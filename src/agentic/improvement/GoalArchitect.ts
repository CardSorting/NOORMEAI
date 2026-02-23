import type { Kysely } from '../../kysely.js'
import type { AgenticConfig, AgentGoal } from '../../types/index.js'
import { calculateSimilarity } from '../../util/similarity.js'

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
    private config: AgenticConfig = {},
  ) {
    this.goalsTable = config.goalsTable || 'agent_goals'
  }

  private get typedDb(): Kysely<GoalDatabase> {
    return this.db as unknown as Kysely<GoalDatabase>
  }

  /**
   * Deconstruct a goal into multiple sub-goals transactionally.
   * Includes circular dependency and terminal duplicate protection.
   */
  async deconstructGoal(
    goalId: string | number,
    subGoals: string[],
  ): Promise<AgentGoal[]> {
    // 1. Production Hardening: Circular Dependency Protection
    await this.detectCircularDependency(goalId)

    return await this.db.transaction().execute(async (trx) => {
      const goal = (await trx
        .selectFrom(this.goalsTable as any)
        .selectAll()
        .where('id', '=', goalId)
        .executeTakeFirst()) as unknown as GoalTable | undefined

      if (!goal) throw new Error(`Goal ${goalId} not found`)

      // 2. Production Hardening: Semantic Duplicate Detection
      // Fetch existing siblings to prevent redundant sub-goals
      const existingSubGoals = await trx
        .selectFrom(this.goalsTable as any)
        .select('description')
        .where('parent_id', '=', goalId)
        .execute()

      const created: AgentGoal[] = []
      const basePriority = (goal.priority || 0) + 1

      for (let i = 0; i < subGoals.length; i++) {
        const desc = subGoals[i]

        // Skip if semantically identical to an existing sibling
        const isDuplicate = existingSubGoals.some(ex =>
          calculateSimilarity(ex.description, desc) > 0.9
        )
        if (isDuplicate) {
          console.log(`[GoalArchitect] Skipping duplicate sub-goal: "${desc}"`)
          continue
        }

        const subGoal = (await trx
          .insertInto(this.goalsTable as any)
          .values({
            session_id: goal.session_id,
            parent_id: goalId,
            description: desc,
            status: 'pending',
            priority: basePriority + i,
            created_at: new Date(),
            updated_at: new Date(),
          } as any)
          .returningAll()
          .executeTakeFirstOrThrow()) as unknown as GoalTable

        created.push(this.parseGoal(subGoal))
      }

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
   * Recursive check for circular dependencies in the goal tree.
   * Prevents infinite loops caused by autonomous decomposition.
   */
  private async detectCircularDependency(
    startId: string | number,
    visited: Set<string | number> = new Set()
  ): Promise<void> {
    if (visited.has(startId)) {
      throw new Error(`Circular dependency detected in goal hierarchy at ID: ${startId}`)
    }
    visited.add(startId)

    const goal = await this.db
      .selectFrom(this.goalsTable as any)
      .select('parent_id')
      .where('id', '=', startId)
      .executeTakeFirst()

    if (goal?.parent_id) {
      await this.detectCircularDependency(goal.parent_id, visited)
    }
  }

  /**
   * Reorder goals by updating their priorities in batch.
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
    outcome?: string,
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
      outcome: outcome || currentMeta.outcome,
    }

    const updated = (await this.db
      .updateTable(this.goalsTable as any)
      .set({
        status,
        metadata: JSON.stringify(newMeta),
        updated_at: new Date(),
      } as any)
      .where('id', '=', goalId)
      .returningAll()
      .executeTakeFirstOrThrow()) as unknown as GoalTable

    return this.parseGoal(updated)
  }

  /**
   * Check if a goal is blocked by uncompleted sub-goals.
   */
  async checkGoalDependencies(
    goalId: string | number,
  ): Promise<{ canComplete: boolean; pendingSubGoals: number }> {
    const subGoals = await this.typedDb
      .selectFrom(this.goalsTable as any)
      .select('status')
      .where('parent_id', '=', goalId)
      .execute()

    if (subGoals.length === 0) {
      return { canComplete: true, pendingSubGoals: 0 }
    }

    const pending = subGoals.filter(
      (g) => g.status !== 'completed' && g.status !== 'failed',
    ).length

    return {
      canComplete: pending === 0,
      pendingSubGoals: pending,
    }
  }

  /**
   * Identify goals that have "stalled" (no status changes in > 7 days)
   */
  async trackStalledGoals(daysThreshold: number = 7): Promise<AgentGoal[]> {
    const thresholdDate = new Date(Date.now() - daysThreshold * 24 * 3600000)

    const stalled = (await this.typedDb
      .selectFrom(this.goalsTable as any)
      .selectAll()
      .where('status', 'in', ['pending', 'in_progress'])
      .where('updated_at', '<', thresholdDate)
      .execute()) as unknown as GoalTable[]

    return stalled.map((g) => this.parseGoal(g))
  }

  private parseGoal(g: any): AgentGoal {
    return {
      id: g.id,
      sessionId: g.session_id,
      parentId: g.parent_id,
      description: g.description,
      status: g.status,
      priority: g.priority,
      metadata:
        typeof g.metadata === 'string'
          ? JSON.parse(g.metadata)
          : g.metadata || {},
      createdAt: new Date(g.created_at),
      updatedAt: new Date(g.updated_at),
    }
  }
}
