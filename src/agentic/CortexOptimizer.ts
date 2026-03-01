import type { Kysely } from '../kysely.js'
import type { AgenticConfig } from '../types/index.js'
import type { Cortex } from './Cortex.js'

/**
 * CortexOptimizer represents the consolidated background execution path.
 * It replaces 20+ legacy abstraction engines with safe, deterministic passes.
 */
export class CortexOptimizer {
    private knowledgeTable: string
    private memoriesTable: string

    constructor(
        private db: Kysely<any>,
        private cortex: Cortex,
        private config: AgenticConfig = {},
    ) {
        this.knowledgeTable = config.knowledgeTable || 'agent_knowledge_base'
        this.memoriesTable = config.memoriesTable || 'agent_memories'
    }

    /**
     * Run a lightweight optimization and ablation pass.
     */
    async runMaintenance(trxOrDb: any = this.db): Promise<void> {
        try {
            await this.db.transaction().execute(async (trx) => {
                await this.pruneZombies(30, trx)
            })
        } catch (e) {
            console.error('[CortexOptimizer] Maintenance pass failed:', e)
        }
    }

    private async pruneZombies(thresholdDays: number = 30, trx: any): Promise<number> {
        const cutoff = new Date(Date.now() - thresholdDays * 24 * 3600000)
        let totalPruned = 0

        // Prune Memories
        const memoriesResult = await trx
            .deleteFrom(this.memoriesTable as any)
            .where('created_at', '<', cutoff)
            .where((eb: any) =>
                eb.or([
                    eb('metadata', 'not like', '%"anchor":true%'),
                    eb('metadata', 'is', null),
                ]),
            )
            .executeTakeFirst()

        totalPruned += Number(memoriesResult.numDeletedRows || 0)

        if (totalPruned > 0) {
            console.log(
                `[CortexOptimizer] Pruned ${totalPruned} historical zombie items.`,
            )
        }

        return totalPruned
    }
}
