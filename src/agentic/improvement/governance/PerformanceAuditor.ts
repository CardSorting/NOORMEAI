import type { AuditContext, AuditResult } from './AuditContext.js'

export class PerformanceAuditor {
    async audit(ctx: AuditContext): Promise<AuditResult> {
        const issues: string[] = []

        // Fetch safety policies for success rate
        const policies = (await ctx.trx
            .selectFrom(ctx.policiesTable as any)
            .selectAll()
            .where('is_enabled', '=', true)
            .where((eb: any) => eb.or([
                eb('name', '=', 'min_success_rate'),
                eb('type', '=', 'safety')
            ]))
            .execute()) as any[]

        const getLimit = (name: string) => {
            const p = policies.find(p => p.name === name)
            if (!p) return 0.8 // Default success floor
            const def = typeof p.definition === 'string' ? JSON.parse(p.definition) : p.definition
            return def.threshold ?? def.limit ?? 0.8
        }

        const minSuccess = getLimit('min_success_rate')

        // Statistical Success Rate (last 100 events)
        const recentSuccess = await ctx.trx
            .selectFrom(ctx.metricsTable as any)
            .select((eb: any) => eb.fn.avg('metric_value').as('avg'))
            .where('metric_name' as any, '=', 'success_rate')
            .orderBy('created_at', 'desc')
            .limit(100)
            .executeTakeFirst()

        const success = Number((recentSuccess as any)?.avg || 1)
        if (success < minSuccess) {
            issues.push(`Performance Degradation: Rolling success rate (${Math.round(success * 100)}%) is below policy requirement (${minSuccess * 100}%)`)
        }

        return {
            issues,
            metadata: { success, minSuccess }
        }
    }
}
