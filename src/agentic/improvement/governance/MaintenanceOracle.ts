import type { AuditContext } from './AuditContext.js'

export class MaintenanceOracle {
    async suggestRepairs(ctx: AuditContext): Promise<string[]> {
        const repairs: string[] = []

        // Fetch maintenance policies
        const policies = (await ctx.db
            .selectFrom(ctx.policiesTable as any)
            .selectAll()
            .where('is_enabled', '=', true)
            .execute()) as any[]

        const getPolicyValue = (name: string, fallback: number) => {
            const p = policies.find(p => p.name === name)
            if (!p) return fallback
            const def = typeof p.definition === 'string' ? JSON.parse(p.definition) : p.definition
            return def.threshold ?? def.limit ?? def.days ?? fallback
        }

        const latencyPolicy = getPolicyValue('latency_repair_threshold', 500)
        const costPolicy = getPolicyValue('high_cost_threshold', 0.5)
        const storagePolicy = getPolicyValue('cold_storage_threshold', 30)

        // 1. Check for chronic high latency
        const latencyStats = await ctx.cortex.metrics.getMetricStats('query_latency')
        if (latencyStats.avg > latencyPolicy && latencyStats.count > 10) {
            repairs.push(`Average latency is high (${latencyStats.avg.toFixed(2)}ms). Suggesting index audit across hit tables.`)
        }

        // 2. Detect specific slow tables
        const recentSlowQueries = await ctx.db
            .selectFrom(ctx.metricsTable as any)
            .select('metadata')
            .where('metric_name' as any, '=', 'query_latency')
            .where('metric_value' as any, '>', latencyPolicy * 2)
            .limit(20)
            .execute()

        const slowTables = new Set<string>()
        for (const q of recentSlowQueries) {
            try {
                const meta = typeof (q as any).metadata === 'string' ? JSON.parse((q as any).metadata) : (q as any).metadata || {}
                if (meta.table) slowTables.add(meta.table)
            } catch (e) { }
        }

        for (const table of slowTables) {
            repairs.push(`Table '${table}' is experiencing periodic latency spikes. Suggesting 'CREATE INDEX' for common filters.`)
        }

        // 3. Check for high cost
        const totalCost = await ctx.cortex.metrics.getAverageMetric('total_cost')
        if (totalCost > costPolicy) {
            repairs.push('Average query cost is high. Suggesting prompt compression or model switching (e.g., to a smaller model).')
        }

        // 4. Cold storage candidates
        const oldThreshold = new Date(Date.now() - storagePolicy * 24 * 60 * 60 * 1000)
        const sessionsTable = ctx.config.sessionsTable || 'agent_sessions'
        const oldSessions = (await ctx.db
            .selectFrom(sessionsTable as any)
            .select((eb: any) => eb.fn.count('id').as('count'))
            .where('created_at', '<', oldThreshold)
            .executeTakeFirst()) as any

        if (Number(oldSessions?.count || 0) > 100) {
            repairs.push(`[STORAGE OPTIMIZATION] Found ${oldSessions.count} sessions older than ${storagePolicy} days. Consider moving to cold storage.`)
        }

        return repairs
    }
}
