import type { Kysely } from '../../kysely.js'
import type {
    AgenticConfig,
    AgentMetric
} from '../../types/index.js'
import type { Cortex } from '../Cortex.js'

/**
 * GovernanceManager monitors agent performance and enforces high-level "sanity"
 * across the entire agentic infrastructure.
 */
export class GovernanceManager {
    private metricsTable: string
    private policiesTable: string
    private personasTable: string

    constructor(
        private db: Kysely<any>,
        private cortex: Cortex,
        private config: AgenticConfig = {}
    ) {
        this.metricsTable = config.metricsTable || 'agent_metrics'
        this.policiesTable = config.policiesTable || 'agent_policies'
        this.personasTable = config.personasTable || 'agent_personas'
    }

    /**
     * Perform a "Panic Check" - looking for critical failures or cost overruns
     */
    async performAudit(): Promise<{ healthy: boolean, issues: string[] }> {
        const issues: string[] = []

        // Fetch active policies
        const policies = await this.db
            .selectFrom(this.policiesTable as any)
            .selectAll()
            .where('is_enabled', '=', true)
            .execute() as any[]

        const getPolicyValue = (name: string, type: string, fallback: number) => {
            const p = policies.find(p => p.name === name || p.type === type)
            if (!p) return fallback
            const def = typeof p.definition === 'string' ? JSON.parse(p.definition) : p.definition
            return def.threshold ?? fallback
        }

        // 1. Check for cost spikes in the last hour
        const budgetThreshold = getPolicyValue('hourly_budget', 'budget', 1.0)
        const recentCost = await this.db
            .selectFrom(this.metricsTable as any)
            .select((eb: any) => eb.fn.sum('metric_value').as('total'))
            .where('metric_name' as any, '=', 'total_cost')
            .where('created_at' as any, '>', new Date(Date.now() - 3600000))
            .executeTakeFirst()

        const cost = Number((recentCost as any)?.total || 0)
        if (cost > budgetThreshold) {
            issues.push(`Critical: High cost detected ($${cost.toFixed(2)} vs limit $${budgetThreshold})`)
        }

        // 2. Check for success rate drop
        const successThreshold = getPolicyValue('min_success_rate', 'safety', 0.5)
        const avgSuccess = await this.db
            .selectFrom(this.metricsTable as any)
            .select((eb: any) => eb.fn.avg('metric_value').as('avg'))
            .where('metric_name' as any, '=', 'success_rate')
            .executeTakeFirst()

        const success = Number((avgSuccess as any)?.avg || 1)
        if (success < successThreshold) {
            issues.push(`Critical: Success rate dropped to ${Math.round(success * 100)}% (limit ${successThreshold * 100}%)`)
        }

        if (issues.length > 0) {
            console.warn(`[GovernanceManager] Audit failed: ${issues.join(', ')}`)

            // Critical Self-Healing: If success rate is catastrophically low, trigger strategic rollback
            if (success < 0.3) {
                const activePersonaId = await this.getActivePersonaId()
                if (activePersonaId) {
                    console.error(`[GovernanceManager] Catastrophic failure detected. Triggering emergency rollback for persona ${activePersonaId}`)
                    await this.cortex.strategy.rollbackPersona(activePersonaId)
                    issues.push(`Self-Healed: Triggered emergency rollback for persona ${activePersonaId}`)
                }
            }

            // Automatically record a "Panic" reflection
            await this.cortex.reflections.reflect(
                null as any,
                'failure',
                'Infrastructure Audit Failure',
                [`Issues found: ${issues.join('; ')}`]
            )

            // Trigger remediation rituals (compression, pruning)
            await this.triggerRemediation(issues)
        }

        return {
            healthy: issues.length === 0,
            issues
        }
    }

    /**
     * Retrieves the ID of the currently active persona.
     * Assumes there's a 'personas' table with an 'is_active' flag.
     */
    private async getActivePersonaId(): Promise<string | null> {
        const activePersona = await this.db
            .selectFrom(this.personasTable as any)
            .select('id')
            .where('is_active', '=', true)
            .executeTakeFirst()

        return (activePersona as any)?.id || null
    }

    /**
     * Trigger autonomous remediation steps
     */
    private async triggerRemediation(issues: string[]): Promise<void> {
        console.log(`[GovernanceManager] Triggering automated remediation for ${issues.length} issues...`)

        for (const issue of issues) {
            if (issue.includes('High cost')) {
                // Immediate remediation: schedule emergency compression ritual
                await this.cortex.rituals.scheduleRitual(
                    'Emergency Compression',
                    'compression',
                    'hourly',
                    'Governance triggered emergency compression due to high cost.',
                    { priority: 'high', reason: issue }
                )
            }
            if (issue.includes('Success rate')) {
                // Immediate remediation: prune zombies and zombies
                await this.cortex.rituals.scheduleRitual(
                    'Emergency Pruning',
                    'pruning',
                    'hourly',
                    'Governance triggered emergency pruning due to low success rate.',
                    { priority: 'high', reason: issue }
                )
            }
        }
    }

    /**
     * Suggest architectural repairs if performance is degrading
     */
    async suggestRepairs(): Promise<string[]> {
        const repairs: string[] = []

        // 1. Check for chronic high latency
        const latencyStats = await this.cortex.metrics.getMetricStats('query_latency')
        if (latencyStats.avg > 500 && latencyStats.count > 10) {
            repairs.push(`Average latency is high (${latencyStats.avg.toFixed(2)}ms). Suggesting index audit across hit tables.`)
        }

        // 2. Detect specific slow tables from recent metrics
        const recentSlowQueries = await this.db
            .selectFrom(this.metricsTable as any)
            .select('metadata')
            .where('metric_name' as any, '=', 'query_latency')
            .where('metric_value' as any, '>', 1000)
            .limit(20)
            .execute()

        const slowTables = new Set<string>()
        for (const q of recentSlowQueries) {
            try {
                const meta = typeof (q as any).metadata === 'string' ? JSON.parse((q as any).metadata) : ((q as any).metadata || {})
                if (meta.table) slowTables.add(meta.table)
            } catch (e) { /* ignore parse errors */ }
        }

        for (const table of slowTables) {
            repairs.push(`Table '${table}' is experiencing periodic latency spikes. Suggesting 'CREATE INDEX' for common filters.`)
        }

        // 3. Check for high cost accumulation
        const totalCost = await this.cortex.metrics.getAverageMetric('total_cost')
        if (totalCost > 0.5) {
            repairs.push('Average query cost is high. Suggesting prompt compression or model switching (e.g., to a smaller model).')
        }

        // 3. Check for cold storage candidates
        const sessionsTable = this.config.sessionsTable || 'agent_sessions'
        const oldThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days
        const oldSessions = await this.db
            .selectFrom(sessionsTable as any)
            .select((eb: any) => eb.fn.count('id').as('count'))
            .where('created_at', '<', oldThreshold)
            .executeTakeFirst() as any

        if (Number(oldSessions?.count || 0) > 100) {
            repairs.push(`[STORAGE OPTIMIZATION] Found ${oldSessions.count} sessions older than 30 days. Consider moving to cold storage to reduce primary database size and improve backup speed.`)
        }

        return repairs
    }
}
