import type { Kysely } from '../../kysely.js'
import type { AgenticConfig, ResearchMetric } from '../../types/index.js'

export class ResearchAlchemist {
    private metricsTable: string

    constructor(
        private db: Kysely<any>,
        private config: AgenticConfig = {}
    ) {
        this.metricsTable = config.researchMetricsTable || 'agent_research_metrics'
    }

    /**
     * Transmute raw events into research metrics
     */
    async transmute(
        sessionId: string | number,
        metricName: ResearchMetric['metricName'],
        value: number,
        metadata?: Record<string, any>
    ): Promise<void> {
        try {
            await this.db
                .insertInto(this.metricsTable as any)
                .values({
                    session_id: sessionId,
                    metric_name: metricName,
                    value: value,
                    metadata: metadata ? JSON.stringify(metadata) : null,
                    created_at: new Date()
                } as any)
                .execute()
        } catch (e) {
            console.warn(`[ResearchAlchemist] Failed to transmute metric ${metricName}: ${e}`)
        }
    }

    /**
     * Calculate novelty or Discovery Index
     */
    async trackDiscovery(sessionId: string | number, taskType: string): Promise<void> {
        // Mock logic: higher value if taskType is unseen
        const discoveryValue = Math.random() > 0.8 ? 0.9 : 0.2
        await this.transmute(sessionId, 'discovery_index', discoveryValue, { taskType })
    }

    /**
     * Record a "Magic" moment
     */
    async recordMagic(sessionId: string | number, surpriseScore: number): Promise<void> {
        await this.transmute(sessionId, 'time_to_magic', surpriseScore)
    }
}
