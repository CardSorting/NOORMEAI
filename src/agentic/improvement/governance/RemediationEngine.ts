import type { AuditContext } from './AuditContext.js'

export class RemediationEngine {
    async triggerRemediation(ctx: AuditContext, issues: string[]): Promise<void> {
        for (const issue of issues) {
            if (issue.includes('Budget Violations')) {
                await ctx.cortex.rituals.scheduleRitual(
                    'Budget Remediation',
                    'compression',
                    'hourly',
                    `Automated response to: ${issue}`,
                    { priority: 'critical', enforce_limits: true },
                )
            }
            if (issue.includes('Performance Degradation')) {
                await ctx.cortex.rituals.scheduleRitual(
                    'Reliability Sweep',
                    'pruning',
                    'daily',
                    `Sanitizing high-noise memories due to: ${issue}`,
                    { priority: 'medium', target: 'longtail' },
                )
            }
            if (issue.includes('Integrity Failure')) {
                await this.remediateSkillFailure(ctx, issue)
            }
            if (issue.includes('Quota Breach') || issue.includes('Swarm Quota Breach')) {
                await ctx.cortex.rituals.scheduleRitual(
                    'Resource Throttling',
                    'pruning',
                    'hourly',
                    `Critical resource containment: ${issue}`,
                    { priority: 'critical', active_containment: true },
                )
            }
        }
    }

    private async remediateSkillFailure(ctx: AuditContext, issue: string): Promise<void> {
        const skillName = issue.match(/'([^']+)'/)?.[1]
        if (!skillName) return

        console.log(`[RemediationEngine] Demoting tainted skill out of verified pool: ${skillName}`)

        const runner = async (trx: any) => {
            const skill = await trx
                .selectFrom(ctx.skillsTable as any)
                .select('id')
                .where('name', '=', skillName)
                .executeTakeFirst()

            if (skill) {
                await trx
                    .updateTable(ctx.skillsTable as any)
                    .set({ status: 'experimental', updated_at: new Date() } as any)
                    .where('id', '=', (skill as any).id)
                    .execute()
            }
        }

        if (ctx.trx && (ctx.trx as any) !== ctx.db) {
            await runner(ctx.trx)
        } else {
            await ctx.db.transaction().execute((trx) => runner(trx))
        }
    }
}
