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
        console.log('[EvolutionaryPilot] Initiating self-improvement cycle with dynamic baselining...')

        // 1. Observe: Get recent performance metrics
        const metricsCount = 20
        const recentMetrics = await this.cortex.metrics.getRecentMetrics(metricsCount)
        const latencies = recentMetrics
            .filter(m => m.metricName === 'query_latency')
            .map(m => Number(m.metricValue))

        if (latencies.length < 5) {
            console.log('[EvolutionaryPilot] Insufficient samples for baselining. Skipping cycle.')
            return { evolved: false, changes: [] }
        }

        // 2. Calculate Z-score
        const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length
        const variance = latencies.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / latencies.length
        const stdDev = Math.sqrt(variance)
        const currentLatency = latencies[0] // Assume most recent is current
        const zScore = stdDev === 0 ? 0 : (currentLatency - mean) / stdDev

        console.log(`[EvolutionaryPilot] Baselining: Mean=${mean.toFixed(2)}ms, StdDev=${stdDev.toFixed(2)}ms, Current=${currentLatency}ms, Z-Score=${zScore.toFixed(2)}`)

        const changes: string[] = []
        let evolved = false

        // 3. Evolve: Optimize if latency is high or spike detected
        if (zScore > 1.5 || mean > 500) {
            console.log(`[EvolutionaryPilot] Performance threshold reached (Z-Score: ${zScore.toFixed(2)}, Mean: ${mean.toFixed(2)}ms). Triggering dynamic evolution...`)
            
            // A. Trigger PRAGMA optimize for SQLite
            const dialect = (this.db.getExecutor() as any).dialect
            const isSqlite = this.db.getExecutor().adapter.constructor.name.toLowerCase().includes('sqlite') || 
                             (dialect && dialect.constructor.name.toLowerCase().includes('sqlite'))

            if (isSqlite) {
                console.log('[EvolutionaryPilot] Running PRAGMA optimize...')
                await sql`PRAGMA optimize`.execute(this.db)
                changes.push('Applied PRAGMA optimize')
                evolved = true
            }

            // B. Apply top index recommendation if available
            // Note: We use the introspection features of the core library
            try {
                const tables = await this.db.introspection.getTables()
                for (const table of tables) {
                    // Check for tables without primary keys as a basic evolution
                    if (!table.columns.some(c => c.isPrimaryKey)) {
                        console.warn(`[EvolutionaryPilot] Table ${table.name} has no primary key. Evolution required.`)
                        // In a real app, we'd cautiously add an ID or log a critical reflection
                    }
                }

                // If we had a more integrated auto-indexer, we'd pull from it here.
                // For now, we perform a specific optimization for agentic tables if they seem slow.
                if (mean > 200) {
                    const messagesTable = this.config.messagesTable || 'agent_messages'
                    await this.cortex.evolution.evolve(`CREATE INDEX IF NOT EXISTS idx_agent_msg_session_time ON ${messagesTable}(session_id, created_at)`)
                    changes.push(`Applied composite index to ${messagesTable} due to high average latency`)
                    evolved = true
                }
            } catch (e) {
                console.error('[EvolutionaryPilot] Dynamic evolution failed:', e)
            }
        }

        // 4. Verify: Perform an audit
        const audit = await this.cortex.governor.performAudit()
        if (!audit.healthy) {
            console.warn('[EvolutionaryPilot] Evolution resulted in unhealthy state. Reverting may be required.')
            changes.push('WARNING: Unhealthy state detected after evolution')
        }

        return { evolved, changes }
    }
}
