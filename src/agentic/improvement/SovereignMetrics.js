"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SovereignMetrics = void 0;
/**
 * SovereignMetrics allows an agent to record and analyze its own performance
 * indicators, effectively monitoring its own "life satisfaction" and efficiency.
 */
class SovereignMetrics {
    db;
    config;
    metricsTable;
    constructor(db, config = {}) {
        this.db = db;
        this.config = config;
        this.metricsTable = config.metricsTable || 'agent_metrics';
    }
    get typedDb() {
        return this.db;
    }
    /**
     * Record a metric point
     */
    async recordMetric(metricName, metricValue, options = {}) {
        const metric = await this.db
            .insertInto(this.metricsTable)
            .values({
            session_id: options.sessionId ?? null,
            agent_id: options.agentId ?? null,
            metric_name: metricName,
            metric_value: metricValue,
            unit: options.unit ?? null,
            metadata: options.metadata ? JSON.stringify(options.metadata) : null,
            created_at: new Date()
        })
            .returningAll()
            .executeTakeFirstOrThrow();
        return this.parseMetric(metric);
    }
    /**
     * Get average value of a metric over time
     */
    async getAverageMetric(metricName) {
        const result = await this.typedDb
            .selectFrom(this.metricsTable)
            .select((eb) => eb.fn.avg('metric_value').as('avgValue'))
            .where('metric_name', '=', metricName)
            .executeTakeFirst();
        return Number(result?.avgValue || 0);
    }
    /**
     * Get comprehensive stats for a metric (min, max, avg, count).
     */
    async getMetricStats(metricName, options = {}) {
        let query = this.typedDb
            .selectFrom(this.metricsTable)
            .select((eb) => [
            eb.fn.min('metric_value').as('min'),
            eb.fn.max('metric_value').as('max'),
            eb.fn.avg('metric_value').as('avg'),
            eb.fn.count('id').as('count')
        ])
            .where('metric_name', '=', metricName);
        if (options.agentId) {
            query = query.where('agent_id', '=', options.agentId);
        }
        if (options.sessionId) {
            query = query.where('session_id', '=', options.sessionId);
        }
        const result = await query.executeTakeFirst();
        return {
            min: Number(result?.min || 0),
            max: Number(result?.max || 0),
            avg: Number(result?.avg || 0),
            count: Number(result?.count || 0)
        };
    }
    /**
     * Get recent metrics for analysis
     */
    async getRecentMetrics(limit = 50) {
        const list = await this.typedDb
            .selectFrom(this.metricsTable)
            .selectAll()
            .orderBy('created_at', 'desc')
            .limit(limit)
            .execute();
        return list.map(m => this.parseMetric(m));
    }
    /**
     * Get metrics filtered by agent ID.
     */
    async getMetricsByAgent(agentId, limit = 50) {
        const list = await this.typedDb
            .selectFrom(this.metricsTable)
            .selectAll()
            .where('agent_id', '=', agentId)
            .orderBy('created_at', 'desc')
            .limit(limit)
            .execute();
        return list.map(m => this.parseMetric(m));
    }
    /**
     * Get metrics filtered by session ID.
     */
    async getMetricsBySession(sessionId, limit = 50) {
        const list = await this.typedDb
            .selectFrom(this.metricsTable)
            .selectAll()
            .where('session_id', '=', sessionId)
            .orderBy('created_at', 'desc')
            .limit(limit)
            .execute();
        return list.map(m => this.parseMetric(m));
    }
    parseMetric(m) {
        return {
            id: m.id,
            sessionId: m.session_id,
            agentId: m.agent_id,
            metricName: m.metric_name,
            metricValue: m.metric_value,
            unit: m.unit,
            metadata: typeof m.metadata === 'string' ? JSON.parse(m.metadata) : (m.metadata || {}),
            createdAt: new Date(m.created_at)
        };
    }
}
exports.SovereignMetrics = SovereignMetrics;
