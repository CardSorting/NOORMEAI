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
    if (metricName === 'time_to_magic' && (value < 0 || value > 100)) {
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
    const windowMs = 10 * 60 * 1000
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
   * Calculate novelty or Discovery Index
   */
  async trackDiscovery(
    sessionId: string | number,
    taskType: string,
  ): Promise<void> {
    // Production Hardening: Real database-backed novelty check with regex safety
    const existing = await this.db
      .selectFrom(this.metricsTable as any)
      .select('id')
      .where('metric_name' as any, '=', 'discovery_index')
      .where('metadata', 'like', `%${taskType.replace(/[%_]/g, '')}%`)
      .executeTakeFirst()

    const discoveryValue = existing ? 0.1 : 1.0 // 1.0 for first-time discovery, 0.1 for repeat
    await this.transmute(sessionId, 'discovery_index', discoveryValue, {
      taskType,
      firstDiscovery: !existing,
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
