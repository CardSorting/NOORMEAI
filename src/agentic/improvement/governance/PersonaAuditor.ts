import type { AuditContext, AuditResult } from './AuditContext.js'

export class PersonaAuditor {
    async audit(ctx: AuditContext): Promise<AuditResult> {
        const issues: string[] = []

        const activePersona = await this.getActivePersona(ctx)
        if (activePersona) {
            const quotaCheck = await ctx.cortex.quotas.checkQuota('persona', activePersona.id)
            if (!quotaCheck.allowed) {
                issues.push(`Quota Breach: ${quotaCheck.reason}`)
            }

            // Check for swarm-level quotas if part of a swarm
            const swarmId = activePersona.metadata?.swarm_id
            if (swarmId) {
                const swarmCheck = await ctx.cortex.quotas.checkQuota('swarm', swarmId)
                if (!swarmCheck.allowed) {
                    issues.push(`Swarm Quota Breach [${swarmId}]: ${swarmCheck.reason}`)
                }
            }
        }

        return {
            issues,
            metadata: { activePersona }
        }
    }

    private async getActivePersona(ctx: AuditContext): Promise<any | null> {
        const active = await ctx.trx
            .selectFrom(ctx.personasTable as any)
            .selectAll()
            .where('status', '=', 'active')
            .executeTakeFirst()

        if (!active) return null

        return {
            ...active,
            metadata:
                typeof active.metadata === 'string'
                    ? JSON.parse(active.metadata)
                    : active.metadata || {},
        }
    }

    async quarantinePersona(ctx: AuditContext, id: string | number, reason: string): Promise<void> {
        console.warn(`[PersonaAuditor] QUARANTINING Persona ${id}: ${reason}`)

        let query = ctx.db
            .selectFrom(ctx.personasTable as any)
            .selectAll()
            .where('id', '=', id)

        // SQLite doesn't support SELECT ... FOR UPDATE easily in Kysely without specific dialect support
        // But we are in a transaction usually if passed ctx.trx. 
        // Here we use ctx.db for the quarantine update if it's a standalone call.

        const persona = await query.executeTakeFirst()

        if (persona) {
            const metadata = typeof (persona as any).metadata === 'string'
                ? JSON.parse((persona as any).metadata)
                : (persona as any).metadata || {}

            await ctx.db
                .updateTable(ctx.personasTable as any)
                .set({
                    status: 'quarantined',
                    metadata: JSON.stringify({
                        ...metadata,
                        quarantine_reason: reason,
                        quarantined_at: new Date(),
                    }),
                    updated_at: new Date(),
                } as any)
                .where('id', '=', id)
                .execute()

            // Rollback most recent changes via strategy engine
            await ctx.cortex.strategy.rollbackPersona(id)
        }
    }
}
