import type { Kysely } from '../../kysely.js'
import type {
  AgenticConfig,
  AgentMemory,
  KnowledgeItem,
} from '../../types/index.js'
import type { Cortex } from '../Cortex.js'
import type { KnowledgeDatabase } from './KnowledgeDistiller.js'

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
   * Checks for linked dependencies before deletion.
   */
  async pruneZombies(thresholdDays: number = 30): Promise<number> {
    const cutoff = new Date(Date.now() - thresholdDays * 24 * 3600000)
    let totalPruned = 0

    return await this.db.transaction().execute(async (trx) => {
      // 1. Prune Knowledge (with dependency check)
      const knowledgeToPrune = await trx
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
        // Exclude items that are linked
        .where('id', 'not in', (eb: any) =>
          eb.selectFrom(this.linksTable as any).select('source_id'),
        )
        .where('id', 'not in', (eb: any) =>
          eb.selectFrom(this.linksTable as any).select('target_id'),
        )
        .execute()

      if (knowledgeToPrune.length > 0) {
        const candidates = knowledgeToPrune.map((k) =>
          this.cortex.knowledge['parseKnowledge'](k),
        )
        const idsToDelete: (string | number)[] = []

        for (const item of candidates) {
          const fitness = this.cortex.knowledge.calculateFitness(item)
          // Prune if fitness is below threshold (e.g., 0.3)
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

      // 2. Prune Memories
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
          `[AblationEngine] Pruned ${totalPruned} zombie items older than ${thresholdDays} days.`,
        )
      }

      return totalPruned
    })
  }

  /**
   * Monitor Performance: Check if recent success rates satisfy the safety baseline.
   * If performance has dropped > 20% since ablation tests started, trigger auto-recovery.
   */
  async monitorAblationPerformance(): Promise<{
    status: 'stable' | 'degraded'
    recoveredCount: number
  }> {
    console.log(
      `[AblationEngine] Running performance monitoring for active ablation tests...`,
    )

    const baseline = await this.cortex.metrics.getAverageMetric('success_rate')
    const stats = await this.cortex.metrics.getMetricStats('success_rate')

    // If current average is significantly lower than overall average
    if (stats.count > 10 && stats.avg < baseline * 0.8) {
      console.warn(
        `[AblationEngine] PERFORMANCE DEGRADATION DETECTED (Avg: ${stats.avg}, Baseline: ${baseline}). Triggering mass recovery.`,
      )

      const ablatedItems = await this.typedDb
        .selectFrom(this.knowledgeTable as any)
        .select('id')
        .where('metadata', 'like', '%"ablation_test":true%')
        .execute()

      let recoveredCount = 0
      for (const item of ablatedItems) {
        if (await this.recoverAblatedItem(item.id)) {
          recoveredCount++
        }
      }

      return { status: 'degraded', recoveredCount }
    }

    return { status: 'stable', recoveredCount: 0 }
  }

  /**
   * Conduct an "Ablation Test": Temporarily disable a knowledge item
   * to see if it impacts reasoning.
   */
  async testAblation(id: string | number): Promise<boolean> {
    console.log(`[AblationEngine] Conducting ablation test on item ${id}`)

    return await this.db.transaction().execute(async (trx) => {
      const item = (await trx
        .selectFrom(this.knowledgeTable as any)
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst()) as any

      if (!item) return false

      const metadata =
        typeof item.metadata === 'string'
          ? JSON.parse(item.metadata)
          : item.metadata || {}

      // 1. Record the experiment in reflections
      await this.cortex.reflections.reflect(
        item.source_session_id || 'system',
        'success',
        `Ablation experiment initiated for item ${id}`,
        [
          `Temporary confidence reduction to evaluate reasoning impact.`,
          `Original confidence: ${item.confidence}`,
        ],
      )

      // 2. Perform the ablation
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
    })
  }

  /**
   * Restore an ablated knowledge item to its original state.
   */
  async recoverAblatedItem(id: string | number): Promise<boolean> {
    return await this.db.transaction().execute(async (trx) => {
      const item = (await trx
        .selectFrom(this.knowledgeTable as any)
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirst()) as any

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

      await trx
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
    })
  }
}
