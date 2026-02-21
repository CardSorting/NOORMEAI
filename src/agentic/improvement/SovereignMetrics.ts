import type { Kysely } from '../../kysely.js'
import type {
    AgenticConfig,
    AgentMetric
} from '../../types/index.js'

interface MetricTable {
    id: number | string
    session_id: number | string | null
    agent_id: string | null
    metric_name: string
    metric_value: number
    unit: string | null
    metadata: string | null // JSON string
    created_at: string | Date
}

export interface MetricsDatabase {
    agent_metrics: MetricTable
}

export interface MetricStats {
    min: number
    max: number
    avg: number
    count: number
}

/**
 * SovereignMetrics allows an agent to record and analyze its own performance
 * indicators, effectively monitoring its own "life satisfaction" and efficiency.
 */
export class SovereignMetrics {
    private metricsTable: string

    constructor(
        private db: Kysely<any>,
        private config: AgenticConfig = {}
    ) {
        this.metricsTable = config.metricsTable || 'agent_metrics'
    }

    private get typedDb(): Kysely<MetricsDatabase> {
        return this.db as unknown as Kysely<MetricsDatabase>
    }

    /**
     * Record a metric point
     */
    async recordMetric(
        metricName: string,
        metricValue: number,
        options: { sessionId?: string | number, agentId?: string, unit?: string, metadata?: Record<string, any> } = {}
    ): Promise<AgentMetric> {
        const metric = await this.db
            .insertInto(this.metricsTable as any)
            .values({
                session_id: options.sessionId ?? null,
                agent_id: options.agentId ?? null,
                metric_name: metricName,
                metric_value: metricValue,
                unit: options.unit ?? null,
                metadata: options.metadata ? JSON.stringify(options.metadata) : null,
                created_at: new Date()
            } as any)
            .returningAll()
            .executeTakeFirstOrThrow() as unknown as MetricTable

        return this.parseMetric(metric)
    }

    /**
     * Get average value of a metric over time
     */
    async getAverageMetric(metricName: string): Promise<number> {
        const result = await this.typedDb
            .selectFrom(this.metricsTable as any)
            .select((eb: any) => eb.fn.avg('metric_value').as('avgValue'))
            .where('metric_name', '=', metricName)
            .executeTakeFirst()

        return Number((result as any)?.avgValue || 0)
    }

    /**
     * Get comprehensive stats for a metric (min, max, avg, count).
     */
    async getMetricStats(metricName: string, options: { agentId?: string, sessionId?: string | number } = {}): Promise<MetricStats> {
        let query = this.typedDb
            .selectFrom(this.metricsTable as any)
            .select((eb: any) => [
                eb.fn.min('metric_value').as('min'),
                eb.fn.max('metric_value').as('max'),
                eb.fn.avg('metric_value').as('avg'),
                eb.fn.count('id').as('count')
            ])
            .where('metric_name', '=', metricName)

        if (options.agentId) {
            query = query.where('agent_id', '=', options.agentId)
        }
        if (options.sessionId) {
            query = query.where('session_id', '=', options.sessionId)
        }

        const result = await query.executeTakeFirst() as any

        return {
            min: Number(result?.min || 0),
            max: Number(result?.max || 0),
            avg: Number(result?.avg || 0),
            count: Number(result?.count || 0)
        }
    }

    /**
     * Get recent metrics for analysis
     */
    async getRecentMetrics(limit: number = 50): Promise<AgentMetric[]> {
        const list = await this.typedDb
            .selectFrom(this.metricsTable as any)
            .selectAll()
            .orderBy('created_at', 'desc')
            .limit(limit)
            .execute() as unknown as MetricTable[]

        return list.map(m => this.parseMetric(m))
    }

    /**
     * Get metrics filtered by agent ID.
     */
    async getMetricsByAgent(agentId: string, limit: number = 50): Promise<AgentMetric[]> {
        const list = await this.typedDb
            .selectFrom(this.metricsTable as any)
            .selectAll()
            .where('agent_id', '=', agentId)
            .orderBy('created_at', 'desc')
            .limit(limit)
            .execute() as unknown as MetricTable[]

        return list.map(m => this.parseMetric(m))
    }

    /**
     * Get metrics filtered by session ID.
     */
    async getMetricsBySession(sessionId: string | number, limit: number = 50): Promise<AgentMetric[]> {
        const list = await this.typedDb
            .selectFrom(this.metricsTable as any)
            .selectAll()
            .where('session_id', '=', sessionId)
            .orderBy('created_at', 'desc')
            .limit(limit)
            .execute() as unknown as MetricTable[]

        return list.map(m => this.parseMetric(m))
    }

    private parseMetric(m: any): AgentMetric {
        return {
            id: m.id,
            sessionId: m.session_id,
            agentId: m.agent_id,
            metricName: m.metric_name,
            metricValue: m.metric_value,
            unit: m.unit,
            metadata: typeof m.metadata === 'string' ? JSON.parse(m.metadata) : (m.metadata || {}),
            createdAt: new Date(m.created_at)
        }
    }
}
