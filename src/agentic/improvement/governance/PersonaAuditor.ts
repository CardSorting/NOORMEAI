import type { AuditContext, AuditResult } from './AuditContext.js'
import { withLock } from '../../util/db-utils.js'

export class PersonaAuditor {
    async audit(ctx: AuditContext): Promise<AuditResult> {
        const issues: string[] = []

        const activePersona = await this.getActivePersona(ctx)
        if (activePersona) {
            const quotaCheck = await ctx.cortex.quotas.checkQuota('persona', activePersona.id, ctx.trx)
            if (!quotaCheck.allowed) {
                issues.push(`Quota Breach: ${quotaCheck.reason}`)
            }

            // Check for swarm-level quotas if part of a swarm
            const swarmId = activePersona.metadata?.swarm_id
            if (swarmId) {
                const swarmCheck = await ctx.cortex.quotas.checkQuota('swarm', swarmId, ctx.trx)
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
                typeof (active as any).metadata === 'string'
                    ? JSON.parse((active as any).metadata)
                    : (active as any).metadata || {},
        }
    }

    async quarantinePersona(ctx: AuditContext, id: string | number, reason: string): Promise<void> {
        console.warn(`[PersonaAuditor] QUARANTINING Persona ${id}: ${reason}`)

        // Use the provided transaction or start a new one to ensure atomicity
        const runner = async (trx: any) => {
            const query = trx
                .selectFrom(ctx.personasTable as any)
                .selectAll()
                .where('id', '=', id)

            const persona = await withLock(query, trx)
                .executeTakeFirst()

            if (persona) {
                const metadata = typeof (persona as any).metadata === 'string'
                    ? JSON.parse((persona as any).metadata)
                    : (persona as any).metadata || {}

                await trx
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
                await ctx.cortex.strategy.rollbackPersona(id, trx)
            }
        }

        if (ctx.trx && ctx.trx !== ctx.db) {
            await runner(ctx.trx)
        } else {
            await ctx.db.transaction().execute((trx) => runner(trx))
        }
    }
}
