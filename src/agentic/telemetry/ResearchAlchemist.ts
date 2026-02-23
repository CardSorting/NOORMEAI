import type { Kysely } from '../../kysely.js'
import type { AgenticConfig, ResearchMetric } from '../../types/index.js'

export class ResearchAlchemist {
  private metricsTable: string

  constructor(
    private db: Kysely<any>,
    private config: AgenticConfig = {},
  ) {
    this.metricsTable = config.researchMetricsTable || 'agent_research_metrics'
  }

  /**
   * Transmute raw events into research metrics with statistical noise filtering.
   */
  async transmute(
    sessionId: string | number,
    metricName: ResearchMetric['metricName'],
    value: number,
    metadata?: Record<string, any>,
  ): Promise<void> {
    // Hardening: Prevent extreme outliers from skewing discovery data
    const magicCeiling = (this.config as any).research?.magicCeiling || 100
    if (metricName === 'time_to_magic' && (value < 0 || value > magicCeiling)) {
      console.warn(`[ResearchAlchemist] Filtering outlier magic score: ${value}`)
      return
    }

    try {
      await this.db
        .insertInto(this.metricsTable as any)
        .values({
          session_id: sessionId,
          metric_name: metricName,
          value: value,
          metadata: metadata ? JSON.stringify(metadata) : null,
          created_at: new Date(),
        } as any)
        .execute()

      // Secondary Transmutation: Calculate discovery velocity
      if (metricName === 'discovery_index') {
        await this.calculateDiscoveryVelocity(sessionId)
      }
    } catch (e) {
      console.warn(
        `[ResearchAlchemist] Failed to transmute metric ${metricName}: ${e}`,
      )
    }
  }

  /**
   * Calculate discovery velocity: rate of novelty acquisition in the last 10 minutes.
   */
  private async calculateDiscoveryVelocity(sessionId: string | number): Promise<void> {
    const windowMs = (this.config as any).research?.velocityWindowMinutes * 60 * 1000 || 10 * 60 * 1000
    const recent = await this.db
      .selectFrom(this.metricsTable as any)
      .select((eb: any) => eb.fn.count('id').as('count'))
      .where('session_id', '=', sessionId)
      .where('metric_name', '=', 'discovery_index')
      .where('created_at', '>', new Date(Date.now() - windowMs))
      .executeTakeFirst()

    const count = Number((recent as any)?.count || 0)
    const velocity = count / 10 // novelty per minute

    // Persist velocity as its own research metric
    await this.db
      .insertInto(this.metricsTable as any)
      .values({
        session_id: sessionId,
        metric_name: 'discovery_velocity' as any,
        value: velocity,
        created_at: new Date(),
      } as any)
      .execute()
  }

  /**
   * Calculate novelty or Discovery Index.
   * Uses cross-session frequency analysis to determine actual novelty.
   */
  async trackDiscovery(
    sessionId: string | number,
    taskType: string,
  ): Promise<void> {
    // 1. Check frequency across all recent sessions (Last 500 metrics)
    const frequency = await this.db
      .selectFrom(this.metricsTable as any)
      .select((eb: any) => eb.fn.count('id').as('count'))
      .where('metric_name' as any, '=', 'discovery_index')
      .where('metadata', 'like', `%${taskType.replace(/[%_]/g, '')}%`)
      .executeTakeFirst()

    const count = Number((frequency as any)?.count || 0)

    // Discovery Value: Inverse frequency (Inverted Logarithmic Scale)
    // 1.0 = Brand new, 0.0 = Commonplace
    const discoveryValue = Math.max(0, 1.0 - Math.log10(count + 1))

    await this.transmute(sessionId, 'discovery_index', discoveryValue, {
      taskType,
      occurrenceCount: count,
      isInitialDiscovery: count === 0,
      timestamp: Date.now()
    })
  }

  /**
   * Record a "Magic" moment
   */
  async recordMagic(
    sessionId: string | number,
    surpriseScore: number,
  ): Promise<void> {
    await this.transmute(sessionId, 'time_to_magic', surpriseScore)
  }
}
