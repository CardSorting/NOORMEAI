"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourceMonitor = void 0;
const sql_js_1 = require("../raw-builder/sql.js");
/**
 * ResourceMonitor tracks token usage and costs across sessions.
 */
class ResourceMonitor {
    db;
    config;
    resourcesTable;
    constructor(db, config = {}) {
        this.db = db;
        this.config = config;
        this.resourcesTable = config.resourcesTable || 'agent_resource_usage';
    }
    get typedDb() {
        return this.db;
    }
    /**
     * Record token usage
     */
    async recordUsage(sessionId, modelName, inputTokens, outputTokens, cost, agentId, metadata) {
        const usage = await this.typedDb
            .insertInto(this.resourcesTable)
            .values({
            session_id: sessionId,
            agent_id: agentId || null,
            model_name: modelName,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cost: cost || 0,
            currency: 'USD',
            metadata: metadata ? JSON.stringify(metadata) : null,
            created_at: new Date()
        })
            .returningAll()
            .executeTakeFirstOrThrow();
        return this.parseUsage(usage);
    }
    /**
     * Get total cost for a session
     */
    async getSessionTotalCost(sessionId) {
        const result = await this.typedDb
            .selectFrom(this.resourcesTable)
            .select((eb) => eb.fn.sum('cost').as('totalCost'))
            .where('session_id', '=', sessionId)
            .executeTakeFirst();
        return Number(result?.totalCost || 0);
    }
    /**
     * Get global total cost across all sessions.
     */
    async getGlobalTotalCost() {
        const result = await this.typedDb
            .selectFrom(this.resourcesTable)
            .select((eb) => eb.fn.sum('cost').as('totalCost'))
            .executeTakeFirst();
        return Number(result?.totalCost || 0);
    }
    /**
     * Get usage stats per model.
     */
    async getModelUsageStats() {
        const results = await this.typedDb
            .selectFrom(this.resourcesTable)
            .select([
            'model_name',
            (eb) => eb.fn.sum((0, sql_js_1.sql) `input_tokens + output_tokens`).as('totalTokens'),
            (eb) => eb.fn.sum('cost').as('totalCost')
        ])
            .groupBy('model_name')
            .execute();
        return results.map((r) => ({
            modelName: r.model_name,
            totalTokens: Number(r.totalTokens),
            totalCost: Number(r.totalCost)
        }));
    }
    parseUsage(usage) {
        return {
            id: usage.id,
            sessionId: usage.session_id,
            agentId: usage.agent_id,
            modelName: usage.model_name,
            inputTokens: usage.input_tokens,
            outputTokens: usage.output_tokens,
            cost: usage.cost,
            currency: usage.currency,
            createdAt: new Date(usage.created_at)
        };
    }
}
exports.ResourceMonitor = ResourceMonitor;
