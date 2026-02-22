"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionJournal = void 0;
/**
 * ActionJournal records tool usage and outcomes to help agents learn
 * from their past actions.
 */
class ActionJournal {
    db;
    config;
    telemetry;
    actionsTable;
    constructor(db, config = {}, telemetry) {
        this.db = db;
        this.config = config;
        this.telemetry = telemetry;
        this.actionsTable = config.actionsTable || 'agent_actions';
    }
    get typedDb() {
        return this.db;
    }
    /**
     * Log an action (tool call)
     */
    async logAction(sessionId, toolName, args, messageId) {
        const action = await this.typedDb
            .insertInto(this.actionsTable)
            .values({
            session_id: sessionId,
            message_id: messageId || null,
            tool_name: toolName,
            arguments: JSON.stringify(args),
            status: 'pending',
            created_at: new Date()
        })
            .returningAll()
            .executeTakeFirstOrThrow();
        const parsed = this.parseAction(action);
        // Telemetry: Track action start
        if (this.telemetry) {
            await this.telemetry.track(sessionId, 'action', `Tool call: ${toolName}`, { actionId: action.id, arguments: args });
        }
        return parsed;
    }
    /**
     * Update action with outcome
     */
    async recordOutcome(actionId, status, outcome, durationMs, metadata) {
        const action = await this.typedDb
            .updateTable(this.actionsTable)
            .set({
            status,
            outcome,
            duration_ms: durationMs || null,
            metadata: metadata ? JSON.stringify(metadata) : null
        })
            .where('id', '=', actionId)
            .returningAll()
            .executeTakeFirstOrThrow();
        const parsed = this.parseAction(action);
        // Telemetry: Track outcome and failures
        if (this.telemetry) {
            if (status === 'failure') {
                await this.telemetry.track(parsed.sessionId, 'error', `Action failed: ${outcome}`, { actionId, status });
            }
        }
        return parsed;
    }
    /**
     * Get actions for a session
     */
    async getSessionActions(sessionId) {
        const actions = await this.typedDb
            .selectFrom(this.actionsTable)
            .selectAll()
            .where('session_id', '=', sessionId)
            .orderBy('created_at', 'asc')
            .execute();
        return actions.map(a => this.parseAction(a));
    }
    /**
     * Get actions by tool name across all sessions.
     */
    async getActionsByTool(toolName, limit = 50) {
        const actions = await this.typedDb
            .selectFrom(this.actionsTable)
            .selectAll()
            .where('tool_name', '=', toolName)
            .orderBy('created_at', 'desc')
            .limit(limit)
            .execute();
        return actions.map(a => this.parseAction(a));
    }
    /**
     * Generate a report of tool failures.
     */
    async getFailureReport() {
        const results = await this.typedDb
            .selectFrom(this.actionsTable)
            .select([
            'tool_name',
            (eb) => eb.fn.count('id').as('failureCount'),
            (eb) => eb.fn.max('created_at').as('lastFailure')
        ])
            .where('status', '=', 'failure')
            .groupBy('tool_name')
            .orderBy((eb) => eb.fn.count('id'), 'desc')
            .execute();
        return results.map((r) => ({
            toolName: r.tool_name,
            failureCount: Number(r.failureCount),
            lastFailure: r.lastFailure
        }));
    }
    parseAction(action) {
        return {
            id: action.id,
            sessionId: action.session_id,
            messageId: action.message_id,
            toolName: action.tool_name,
            arguments: typeof action.arguments === 'string' ? JSON.parse(action.arguments) : (action.arguments || {}),
            status: action.status,
            outcome: action.outcome,
            durationMs: action.duration_ms,
            metadata: typeof action.metadata === 'string' ? JSON.parse(action.metadata) : (action.metadata || {}),
            createdAt: new Date(action.created_at)
        };
    }
}
exports.ActionJournal = ActionJournal;
