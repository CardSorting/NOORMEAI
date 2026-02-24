import type { AuditContext, AuditResult } from './AuditContext.js'

export class SkillAuditor {
    async audit(ctx: AuditContext): Promise<AuditResult> {
        const issues: string[] = []

        // Fetch integrity policies for reliability floor
        const policies = (await ctx.trx
            .selectFrom(ctx.policiesTable as any)
            .selectAll()
            .where('is_enabled', '=', true)
            .where((eb: any) => eb.or([
                eb('name', '=', 'reliability_floor'),
                eb('type', '=', 'integrity')
            ]))
            .execute()) as any[]

        const getLimit = (name: string) => {
            const p = policies.find(p => p.name === name)
            if (!p) return 0.7 // Default reliability floor
            const def = typeof p.definition === 'string' ? JSON.parse(p.definition) : p.definition
            return def.threshold ?? def.limit ?? 0.7
        }

        const reliabilityLimit = getLimit('reliability_floor')

        const failingVerified = await ctx.trx
            .selectFrom(ctx.skillsTable as any)
            .select(['name', 'reliability'])
            .where('status', '=', 'verified')
            .where('reliability', '<', reliabilityLimit)
            .execute()

        for (const cap of failingVerified) {
            issues.push(`Integrity Failure: Verified skill '${cap.name}' reliability (${cap.reliability.toFixed(2)}) dropped below floor (${reliabilityLimit})`)
        }

        return {
            issues,
            metadata: { reliabilityLimit, failingVerifiedCount: failingVerified.length }
        }
    }

    async quarantineSkill(ctx: AuditContext, name: string, reason: string): Promise<void> {
        console.warn(`[SkillAuditor] BLACKLISTING Skill ${name}: ${reason}`)

        const runner = async (trx: any) => {
            await trx
                .updateTable(ctx.skillsTable as any)
                .set({
                    status: 'blacklisted',
                    metadata: JSON.stringify({ blacklist_reason: reason, blacklisted_at: new Date() }),
                    updated_at: new Date()
                } as any)
                .where('name', '=', name)
                .execute()
        }

        if (ctx.trx && ctx.trx !== ctx.db) {
            await runner(ctx.trx)
        } else {
            await ctx.db.transaction().execute((trx) => runner(trx))
        }
    }
}
