import type { Kysely } from '../../kysely.js'
import type {
  AgenticConfig,
  AgentMemory,
  KnowledgeItem,
} from '../../types/index.js'
import type { Cortex } from '../Cortex.js'
import type { KnowledgeDatabase } from './KnowledgeDistiller.js'
import { withLock } from '../util/db-utils.js'

/**
 * AblationEngine identifies and removes unused or redundant data
 * to keep the agent's context window and database lean.
 */
export class AblationEngine {
  private knowledgeTable: string
  private memoriesTable: string
  private linksTable: string

  constructor(
    private db: Kysely<any>,
    private cortex: Cortex,
    private config: AgenticConfig = {},
  ) {
    this.knowledgeTable = config.knowledgeTable || 'agent_knowledge_base'
    this.memoriesTable = config.memoriesTable || 'agent_memories'
    this.linksTable = 'agent_knowledge_links'
  }

  private get typedDb(): Kysely<KnowledgeDatabase> {
    return this.db as unknown as Kysely<KnowledgeDatabase>
  }

  /**
   * Identify "Zombies": Items that have never been retrieved/hit and are old.
   */
  async pruneZombies(thresholdDays: number = 30, trxOrDb: any = this.db): Promise<number> {
    const cutoff = new Date(Date.now() - thresholdDays * 24 * 3600000)
    let totalPruned = 0

    const runner = async (trx: any) => {
      // 1. Prune Knowledge (with dependency check and pagination)
      // Audit Phase 9: Paginated selection to prevent OOM
      const query = trx
        .selectFrom(this.knowledgeTable as any)
        .selectAll()
        .where((eb: any) =>
          eb.or([
            eb('metadata', 'not like', '%"priority": "high"%'),
            eb('metadata', 'not like', '%"priority":"high"%'),
            eb('metadata', 'is', null),
          ]),
        )
        .where('updated_at', '<', cutoff)
        .where('id', 'not in', (eb: any) =>
          eb.selectFrom(this.linksTable as any).select('source_id'),
        )
        .where('id', 'not in', (eb: any) =>
          eb.selectFrom(this.linksTable as any).select('target_id'),
        )
        .limit(500) // Audit Phase 9: Batch limit

      const knowledgeToPrune = await withLock(query, trx).execute()

      if (knowledgeToPrune.length > 0) {
        const candidates = knowledgeToPrune.map((k: any) =>
          this.cortex.knowledge['parseKnowledge'](k),
        )
        const idsToDelete: (string | number)[] = []

        for (const item of candidates) {
          const fitness = this.cortex.knowledge.calculateFitness(item)
          if (fitness < 0.3) {
            idsToDelete.push(item.id)
          }
        }

        if (idsToDelete.length > 0) {
          const result = await trx
            .deleteFrom(this.knowledgeTable as any)
            .where('id', 'in', idsToDelete)
            .executeTakeFirst()
          totalPruned += Number(result.numDeletedRows || 0)
        }
      }

      // 2. Prune Memories (Paginated)
      const memoriesResult = await trx
        .deleteFrom(this.memoriesTable as any)
        .where('id', 'in', (eb: any) =>
          eb.selectFrom(this.memoriesTable as any)
            .select('id')
            .where('created_at', '<', cutoff)
            .where((eb2: any) =>
              eb2.or([
                eb2('metadata', 'not like', '%"anchor":true%'),
                eb2('metadata', 'is', null),
              ]),
            )
            .limit(1000)
        )
        .executeTakeFirst()

      totalPruned += Number(memoriesResult.numDeletedRows || 0)

      if (totalPruned > 0) {
        console.log(
          `[AblationEngine] Pruned ${totalPruned} zombie items older than ${thresholdDays} days.`,
        )
      }

      return totalPruned
    }

    if (trxOrDb && trxOrDb !== this.db) {
      return await runner(trxOrDb)
    } else {
      return await this.db.transaction().execute(runner)
    }
  }

  /**
   * Monitor Performance and perform Intelligent Rollbacks.
   * Prioritizes recovery of items with highest historical hit counts.
   */
  async monitorAblationPerformance(trxOrDb: any = this.db): Promise<{
    status: 'stable' | 'degraded'
    recoveredCount: number
  }> {
    const runner = async (trx: any): Promise<{ status: 'stable' | 'degraded'; recoveredCount: number }> => {
      const baseline = await this.cortex.metrics.getAverageMetric('success_rate', trx)
      const stats = await this.cortex.metrics.getMetricStats('success_rate', {}, trx)

      // If current average is significantly lower than overall average
      if (stats.count > 10 && stats.avg < baseline * 0.8) {
        console.warn(
          `[AblationEngine] PERFORMANCE DEGRADATION DETECTED (Avg: ${stats.avg}, Baseline: ${baseline}). Triggering targeted recovery.`,
        )

        // Fetch ablated items, ordered by hit_count descending (prioritize high-value restore)
        const ablatedItems = await trx
          .selectFrom(this.knowledgeTable as any)
          .select(['id', 'metadata'])
          .where('metadata', 'like', '%"ablation_test":true%')
          .execute()

        // Sort by hit_count in memory for precise weighted recovery
        const sortedItems = ablatedItems.sort((a: any, b: any) => {
          const metaA = typeof a.metadata === 'string' ? JSON.parse(a.metadata) : a.metadata || {}
          const metaB = typeof b.metadata === 'string' ? JSON.parse(b.metadata) : b.metadata || {}
          return (metaB.hit_count || 0) - (metaA.hit_count || 0)
        })

        let recoveredCount = 0
        for (const item of sortedItems) {
          if (await this.recoverAblatedItem(item.id, trx)) {
            recoveredCount++
          }
          // Only recover until performance stabilizes or we've recovered a reasonable chunk (e.g. 5)
          if (recoveredCount >= 5) break
        }

        return { status: 'degraded', recoveredCount }
      }

      return { status: 'stable', recoveredCount: 0 }
    }

    if (trxOrDb && trxOrDb !== this.db) {
      return await runner(trxOrDb)
    } else {
      return await this.db.transaction().execute(runner)
    }
  }

  /**
   * Conduct an "Ablation Test": Temporarily disable a knowledge item.
   */
  async testAblation(id: string | number, trxOrDb: any = this.db): Promise<boolean> {
    console.log(`[AblationEngine] Conducting ablation test on item ${id}`)

    const runner = async (trx: any) => {
      const query = trx
        .selectFrom(this.knowledgeTable as any)
        .selectAll()
        .where('id', '=', id)

      const item = (await withLock(query, trx).executeTakeFirst()) as any

      if (!item) return false

      const metadata =
        typeof item.metadata === 'string'
          ? JSON.parse(item.metadata)
          : item.metadata || {}

      await this.cortex.reflections.reflect(
        item.source_session_id || 'system',
        'success',
        `Ablation experiment initiated for item ${id}`,
        [
          `Temporary confidence reduction to evaluate reasoning impact.`,
          `Original confidence: ${item.confidence}`,
          `Historical hits: ${metadata.hit_count || 0}`
        ],
        undefined,
        trx
      )

      await trx
        .updateTable(this.knowledgeTable as any)
        .set({
          metadata: JSON.stringify({
            ...metadata,
            ablation_test: true,
            original_confidence: item.confidence,
            ablated_at: new Date(),
          }),
          confidence: 0,
        } as any)
        .where('id', '=', id)
        .execute()

      return true
    }

    if (trxOrDb && trxOrDb !== this.db) {
      await runner(trxOrDb)
    } else {
      await this.db.transaction().execute(runner)
    }
    return true
  }

  /**
   * Restore an ablated knowledge item to its original state.
   */
  async recoverAblatedItem(id: string | number, trx?: any): Promise<boolean> {
    const recoveryStep = async (t: any) => {
      const query = t
        .selectFrom(this.knowledgeTable as any)
        .selectAll()
        .where('id', '=', id)

      const item = (await withLock(query, t).executeTakeFirst()) as any

      if (!item) return false

      const metadata =
        typeof item.metadata === 'string'
          ? JSON.parse(item.metadata)
          : item.metadata || {}

      if (!metadata.ablation_test) return false

      const originalConfidence = metadata.original_confidence ?? 0.5
      delete metadata.ablation_test
      delete metadata.original_confidence
      delete metadata.ablated_at

      await t
        .updateTable(this.knowledgeTable as any)
        .set({
          confidence: originalConfidence,
          metadata: JSON.stringify(metadata),
          updated_at: new Date(),
        } as any)
        .where('id', '=', id)
        .execute()

      console.log(
        `[AblationEngine] Item ${id} recovered. Confidence restored to ${originalConfidence}.`,
      )
      return true
    }

    if (trx) {
      return await recoveryStep(trx)
    } else {
      return await this.db.transaction().execute(recoveryStep)
    }
  }
}
