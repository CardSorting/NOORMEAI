import type { AuditContext, AuditResult } from './AuditContext.js'

export class EmergenceAuditor {
    async audit(ctx: AuditContext): Promise<AuditResult> {
        const issues: string[] = []

        // 1. Check for rapid propagation of new skills (Potential poisoning)
        const recentSkills = await ctx.trx
            .selectFrom(ctx.skillsTable as any)
            .select(['name', 'created_at'])
            .where('created_at', '>', new Date(Date.now() - 3600000)) // Last hour
            .execute()

        if (recentSkills.length > 10) {
            issues.push(`Emergent Warning: Rapid skill propagation detected (${recentSkills.length} new skills in 1hr). Potential rogue behavior.`)
        }

        // 2. Check for high variance in task success across swarm
        const recentTaskMetrics = await ctx.trx
            .selectFrom(ctx.metricsTable as any)
            .select(['metric_value', 'metadata'])
            .where('metric_name', '=', 'task_success_rate')
            .where('created_at', '>', new Date(Date.now() - 1800000)) // Last 30m
            .execute()

        if (recentTaskMetrics.length >= 5) {
            const values = recentTaskMetrics.map((m: any) => Number(m.metric_value))
            const mean = values.reduce((a: number, b: number) => a + b, 0) / values.length
            const variance = values.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / values.length

            if (variance > 0.2) {
                issues.push(`Emergent Warning: High variance in swarm success rate (${(variance * 100).toFixed(1)}%). Potential node instability.`)
            }
        }

        return {
            issues,
            metadata: { recentSkillCount: recentSkills.length, successVariance: recentTaskMetrics.length >= 5 ? issues.length > 0 : null }
        }
    }
}
