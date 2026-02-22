"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResearchAlchemist = void 0;
class ResearchAlchemist {
    db;
    config;
    metricsTable;
    constructor(db, config = {}) {
        this.db = db;
        this.config = config;
        this.metricsTable = config.researchMetricsTable || 'agent_research_metrics';
    }
    /**
     * Transmute raw events into research metrics
     */
    async transmute(sessionId, metricName, value, metadata) {
        try {
            await this.db
                .insertInto(this.metricsTable)
                .values({
                session_id: sessionId,
                metric_name: metricName,
                value: value,
                metadata: metadata ? JSON.stringify(metadata) : null,
                created_at: new Date()
            })
                .execute();
        }
        catch (e) {
            console.warn(`[ResearchAlchemist] Failed to transmute metric ${metricName}: ${e}`);
        }
    }
    /**
     * Calculate novelty or Discovery Index
     */
    async trackDiscovery(sessionId, taskType) {
        // Mock logic: higher value if taskType is unseen
        const discoveryValue = Math.random() > 0.8 ? 0.9 : 0.2;
        await this.transmute(sessionId, 'discovery_index', discoveryValue, { taskType });
    }
    /**
     * Record a "Magic" moment
     */
    async recordMagic(sessionId, surpriseScore) {
        await this.transmute(sessionId, 'time_to_magic', surpriseScore);
    }
}
exports.ResearchAlchemist = ResearchAlchemist;
