import type { Kysely } from '../../kysely.js'
import type {
    AgenticConfig,
    AgentMetric,
    AgentReflection
} from '../../types/index.js'
import type { Cortex } from '../Cortex.js'
import { sql } from '../../raw-builder/sql.js'

/**
 * EvolutionaryPilot orchestrates the continuous self-improvement loop:
 * Observe (Metrics) -> Reflect -> Evolve -> Verify.
 */
export class EvolutionaryPilot {
    constructor(
        private db: Kysely<any>,
        private cortex: Cortex,
        private config: AgenticConfig = {}
    ) { }

    /**
     * Run a self-improvement cycle based on dynamic baselining
     */
    async runSelfImprovementCycle(): Promise<{ evolved: boolean; changes: string[] }> {
        console.log('[EvolutionaryPilot] Initiating self-improvement cycle with full-spectrum baselining...')

        const changes: string[] = []
        let evolved = false

        // 1. Full-Spectrum Observation
        const metrics = ['query_latency', 'success_rate', 'total_cost', 'trust_signal']
        const recentMetrics = await this.cortex.metrics.getRecentMetrics(100)

        for (const metricName of metrics) {
            const values = recentMetrics
                .filter(m => m.metricName === metricName)
                .map(m => Number(m.metricValue))

            if (values.length < 5) continue

            const stats = this.calculateZScore(values)
            console.log(`[EvolutionaryPilot] Baselining ${metricName}: Mean=${stats.mean.toFixed(2)}, StdDev=${stats.stdDev.toFixed(2)}, Current=${stats.current.toFixed(2)}, Z-Score=${stats.zScore.toFixed(2)}`)

            // 2. Trigger Evolution based on metric-specific thresholds
            if (metricName === 'query_latency' && (stats.zScore > 2.0 || stats.mean > 1000)) {
                const result = await this.optimizeLatency()
                if (result) {
                    changes.push(...result)
                    evolved = true
                }
            }

            if (metricName === 'success_rate' && (stats.zScore < -1.5 || stats.mean < 0.7)) {
                console.warn(`[EvolutionaryPilot] Success rate collapse detected (${stats.mean.toFixed(2)}). Triggering strategic mutation.`)
                const strategies = await this.cortex.strategy.mutateStrategy()
                changes.push(...strategies)
                evolved = true
            }

            if (metricName === 'total_cost' && stats.zScore > 2.5) {
                console.warn(`[EvolutionaryPilot] Cost spike detected. Triggering emergency compression.`)
                await this.cortex.rituals.scheduleRitual('Emergency Compression', 'compression', 'hourly', 'High cost spike detected via Z-score analysis.')
                changes.push('Scheduled emergency compression due to cost spike')
                evolved = true
            }
        }

        // 3. Verify: Perform an audit
        const audit = await this.cortex.governor.performAudit()
        if (!audit.healthy) {
            console.warn('[EvolutionaryPilot] Evolution resulted in unhealthy state. Reverting may be required.')
            changes.push('WARNING: Unhealthy state detected after evolution')
        }

        return { evolved, changes }
    }

    private calculateZScore(values: number[]): { mean: number, stdDev: number, current: number, zScore: number } {
        const mean = values.reduce((a, b) => a + b, 0) / values.length
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
        const stdDev = Math.sqrt(variance)
        const current = values[0]
        const zScore = stdDev === 0 ? 0 : (current - mean) / stdDev
        return { mean, stdDev, current, zScore }
    }

    private async optimizeLatency(): Promise<string[]> {
        const changes: string[] = []
        console.log(`[EvolutionaryPilot] Triggering latency optimization...`)

        const dialect = (this.db.getExecutor() as any).dialect
        const isSqlite = this.db.getExecutor().adapter.constructor.name.toLowerCase().includes('sqlite') ||
            (dialect && dialect.constructor.name.toLowerCase().includes('sqlite'))

        if (isSqlite) {
            await sql`PRAGMA optimize`.execute(this.db)
            changes.push('Applied PRAGMA optimize')
        }

        const messagesTable = this.config.messagesTable || 'agent_messages'
        await this.cortex.evolution.evolve(`CREATE INDEX IF NOT EXISTS idx_agent_msg_session_time ON ${messagesTable}(session_id, created_at)`)
        changes.push(`Applied composite index to ${messagesTable}`)

        return changes
    }
}
