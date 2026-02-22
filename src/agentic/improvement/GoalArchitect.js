"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoalArchitect = void 0;
/**
 * GoalArchitect enables agents to autonomously deconstruct complex
 * objectives into manageable sub-goals.
 */
class GoalArchitect {
    db;
    config;
    goalsTable;
    constructor(db, config = {}) {
        this.db = db;
        this.config = config;
        this.goalsTable = config.goalsTable || 'agent_goals';
    }
    get typedDb() {
        return this.db;
    }
    /**
     * Deconstruct a goal into multiple sub-goals transactionally.
     */
    async deconstructGoal(goalId, subGoals) {
        return await this.db.transaction().execute(async (trx) => {
            const goal = await trx
                .selectFrom(this.goalsTable)
                .selectAll()
                .where('id', '=', goalId)
                .executeTakeFirst();
            if (!goal)
                throw new Error(`Goal ${goalId} not found`);
            console.log(`[GoalArchitect] Deconstructing goal ${goalId}: "${goal.description}" into ${subGoals.length} steps.`);
            const created = [];
            // Calculate base priority for sub-goals (higher than parent)
            const basePriority = (goal.priority || 0) + 1;
            for (let i = 0; i < subGoals.length; i++) {
                const desc = subGoals[i];
                const subGoal = await trx
                    .insertInto(this.goalsTable)
                    .values({
                    session_id: goal.session_id,
                    parent_id: goalId,
                    description: desc,
                    status: 'pending',
                    priority: basePriority + i, // Sequential priority
                    created_at: new Date(),
                    updated_at: new Date()
                })
                    .returningAll()
                    .executeTakeFirstOrThrow();
                created.push(this.parseGoal(subGoal));
            }
            // Update parent status to in_progress if it was pending
            if (goal.status === 'pending') {
                await trx
                    .updateTable(this.goalsTable)
                    .set({ status: 'in_progress', updated_at: new Date() })
                    .where('id', '=', goalId)
                    .execute();
            }
            return created;
        });
    }
    /**
     * Reorder goals by updating their priorities in batch.
     * Lower number = higher priority.
     */
    async reorderGoals(goalIds) {
        await this.db.transaction().execute(async (trx) => {
            for (let i = 0; i < goalIds.length; i++) {
                await trx
                    .updateTable(this.goalsTable)
                    .set({ priority: i, updated_at: new Date() })
                    .where('id', '=', goalIds[i])
                    .execute();
            }
        });
    }
    /**
     * Update a goal's status and optionally log outcome/reason in metadata.
     */
    async markGoalAs(goalId, status, outcome) {
        const goal = await this.typedDb
            .selectFrom(this.goalsTable)
            .selectAll()
            .where('id', '=', goalId)
            .executeTakeFirst();
        if (!goal)
            throw new Error(`Goal ${goalId} not found`);
        const currentMeta = goal.metadata ? JSON.parse(goal.metadata) : {};
        const newMeta = {
            ...currentMeta,
            lastStatusChange: Date.now(),
            outcome: outcome || currentMeta.outcome
        };
        const updated = await this.db
            .updateTable(this.goalsTable)
            .set({
            status,
            metadata: JSON.stringify(newMeta),
            updated_at: new Date()
        })
            .where('id', '=', goalId)
            .returningAll()
            .executeTakeFirstOrThrow();
        return this.parseGoal(updated);
    }
    /**
     * Check if a goal is blocked by uncompleted sub-goals.
     * Returns true if all sub-goals are completed, false otherwise.
     */
    async checkGoalDependencies(goalId) {
        const subGoals = await this.typedDb
            .selectFrom(this.goalsTable)
            .select('status')
            .where('parent_id', '=', goalId)
            .execute();
        if (subGoals.length === 0) {
            return { canComplete: true, pendingSubGoals: 0 };
        }
        const pending = subGoals.filter(g => g.status !== 'completed' && g.status !== 'failed').length;
        return {
            canComplete: pending === 0,
            pendingSubGoals: pending
        };
    }
    /**
    * Identify goals that have "stalled" (no status changes in > 7 days)
    */
    async trackStalledGoals(daysThreshold = 7) {
        console.log('[GoalArchitect] Identifying stalled objectives...');
        const thresholdDate = new Date(Date.now() - daysThreshold * 24 * 3600000);
        const stalled = await this.typedDb
            .selectFrom(this.goalsTable)
            .selectAll()
            .where('status', 'in', ['pending', 'in_progress'])
            .where('updated_at', '<', thresholdDate)
            .execute();
        if (stalled.length > 0) {
            console.log(`[GoalArchitect] Identified ${stalled.length} stalled goals.`);
        }
        return stalled.map(g => this.parseGoal(g));
    }
    parseGoal(g) {
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
        };
    }
}
exports.GoalArchitect = GoalArchitect;
