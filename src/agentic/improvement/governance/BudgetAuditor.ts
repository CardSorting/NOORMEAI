import type { AuditContext, AuditResult } from './AuditContext.js'

export class BudgetAuditor {
    async audit(ctx: AuditContext): Promise<AuditResult> {
        const issues: string[] = []

        // Fetch budget policies
        const policies = (await ctx.trx
            .selectFrom(ctx.policiesTable as any)
            .selectAll()
            .where('is_enabled', '=', true)
            .where((eb: any) => eb.or([
                eb('name', '=', 'hourly_budget'),
                eb('name', '=', 'daily_budget'),
                eb('type', '=', 'budget')
            ]))
            .execute()) as any[]

        const getLimit = (name: string) => {
            const p = policies.find(p => p.name === name)
            if (!p) return 0
            const def = typeof p.definition === 'string' ? JSON.parse(p.definition) : p.definition
            return def.threshold ?? def.limit ?? 0
        }

        const hourlyLimit = getLimit('hourly_budget')
        const dailyLimit = getLimit('daily_budget')

        const getCostInWindow = async (ms: number) => {
            const result = await ctx.trx
                .selectFrom(ctx.metricsTable as any)
                .select((eb: any) => eb.fn.sum('metric_value').as('total'))
                .where('metric_name' as any, '=', 'total_cost')
                .where('created_at' as any, '>', new Date(Date.now() - ms))
                .executeTakeFirst()
            return Number((result as any)?.total || 0)
        }

        const hCost = await getCostInWindow(3600000)
        if (hCost > hourlyLimit && hourlyLimit > 0) {
            issues.push(`Budget Violations: Hourly cost ($${hCost.toFixed(2)}) exceeded policy ($${hourlyLimit.toFixed(2)})`)
        }

        const dCost = await getCostInWindow(86400000)
        if (dCost > dailyLimit && dailyLimit > 0) {
            issues.push(`Budget Violations: Daily cumulative cost ($${dCost.toFixed(2)}) exceeded safety ceiling ($${dailyLimit.toFixed(2)})`)
        }

        return {
            issues,
            metadata: { hCost, hourlyLimit, dCost, dailyLimit }
        }
    }
}
