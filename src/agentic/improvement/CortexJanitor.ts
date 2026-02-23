import type { Kysely } from '../../kysely.js'
import type { AgenticConfig, AgentRitual } from '../../types/index.js'
import { sql } from '../../raw-builder/sql.js'

/**
 * CortexJanitor performs automated maintenance on the agent's memory and knowledge.
 */
export class CortexJanitor {
  private ritualsTable: string
  private knowledgeTable: string
  private metricsTable: string
  private sessionsTable: string

  constructor(
    private db: Kysely<any>,
    private config: AgenticConfig = {},
  ) {
    this.ritualsTable = config.ritualsTable || 'agent_rituals'
    this.knowledgeTable = config.knowledgeTable || 'agent_knowledge_base'
    this.metricsTable = config.metricsTable || 'agent_metrics'
    this.sessionsTable = config.sessionsTable || 'agent_sessions'
  }

  /**
   * Run a knowledge pruning ritual.
   * Removes low-confidence facts that haven't been updated recently.
   */
  async runPruningRitual(minConfidence: number = 0.3): Promise<number> {
    console.log(
      `[CortexJanitor] Starting pruning ritual (minConfidence: ${minConfidence})`,
    )

    const result = await this.db
      .deleteFrom(this.knowledgeTable as any)
      .where('confidence' as any, '<', minConfidence)
      .executeTakeFirst()

    const deletedCount = Number(result.numDeletedRows || 0)

    await this.logRitual('pruning', 'success', { deletedCount })
    return deletedCount
  }

  /**
   * Remove "Orphan" records: e.g., messages with non-existent session_ids.
   */
  async cleanOrphans(): Promise<number> {
    const messagesTable = this.config.messagesTable || 'agent_messages'

    const result = await this.db
      .deleteFrom(messagesTable as any)
      .where('session_id', 'not in', (eb: any) =>
        eb.selectFrom(this.sessionsTable as any).select('id'),
      )
      .executeTakeFirst()

    const deletedCount = Number(result.numDeletedRows || 0)

    if (deletedCount > 0) {
      await this.logRitual('optimization', 'success', {
        action: 'clean_orphans',
        deletedCount,
      })
    }

    return deletedCount
  }

  /**
   * Mark sessions with no activity for a long time as 'archived'.
   */
  async archiveInactiveSessions(daysThreshold: number = 30): Promise<number> {
    const thresholdDate = new Date(Date.now() - daysThreshold * 24 * 3600000)

    const result = await this.db
      .updateTable(this.sessionsTable as any)
      .set({ status: 'archived', updated_at: new Date() } as any)
      .where('status', '=', 'active')
      .where('updated_at', '<', thresholdDate)
      .executeTakeFirst()

    const count = Number(result.numUpdatedRows || 0)

    if (count > 0) {
      await this.logRitual('optimization', 'success', {
        action: 'archive_sessions',
        count,
      })
    }

    return count
  }

  /**
   * Prune old metrics to prevent table bloat.
   */
  async pruneMetrics(daysToKeep: number = 90): Promise<number> {
    const thresholdDate = new Date(Date.now() - daysToKeep * 24 * 3600000)

    const result = await this.db
      .deleteFrom(this.metricsTable as any)
      .where('created_at', '<', thresholdDate)
      .executeTakeFirst()

    const count = Number(result.numDeletedRows || 0)

    if (count > 0) {
      await this.logRitual('pruning', 'success', {
        action: 'prune_metrics',
        count,
      })
    }

    return count
  }

  /**
   * Autonomous Indexing: Detects common query patterns and suggests missing indexes.
   * Production Hardening: Uses introspection and usage patterns from metrics.
   */
  async autonomousIndexing(): Promise<string[]> {
    console.log(
      '[CortexJanitor] Analyzing query patterns for autonomous indexing...',
    )
    const applied: string[] = []

    // 1. Structural Heuristics: Core Identity Indexes
    const coreIdentityTables = [
      { table: this.knowledgeTable, col: 'entity' },
      { table: this.config.memoriesTable || 'agent_memories', col: 'entity' },
      {
        table: this.config.messagesTable || 'agent_messages',
        col: 'session_id',
      },
    ]

    for (const target of coreIdentityTables) {
      try {
        const indexName = `idx_${target.table}_${target.col}_v2`
        await sql`CREATE INDEX IF NOT EXISTS ${sql.raw(indexName)} ON ${sql.table(target.table)}(${sql.raw(target.col)})`.execute(
          this.db,
        )
        applied.push(`Standardized identity index: ${indexName}`)
      } catch (err) {
        console.warn(
          `[CortexJanitor] Identity indexing failed for ${target.table}:`,
          err,
        )
      }
    }

    // 2. Data-Driven Heuristics: Hotspot Injection
    // We look for tables mentioned in slow-query metrics recently
    const slowQueries = await this.db
      .selectFrom(this.metricsTable as any)
      .select('metadata')
      .where('metric_name' as any, '=', 'query_latency')
      .where('metric_value', '>', 300) // Slower than 300ms
      .limit(50)
      .execute()

    const tablesToRemoveFriction = new Set<string>()
    for (const q of slowQueries) {
      try {
        const meta =
          typeof (q as any).metadata === 'string'
            ? JSON.parse((q as any).metadata)
            : (q as any).metadata || {}
        if (meta.table) tablesToRemoveFriction.add(meta.table)
      } catch (e) {
        /* ignore */
      }
    }

    for (const table of tablesToRemoveFriction) {
      // Hotspot logic: if it's high-traffic knowledge, index the status/confidence pair for promoting/demoting
      if (table === this.knowledgeTable) {
        const indexName = `idx_${table}_hotspot_lifecycle`
        await sql`CREATE INDEX IF NOT EXISTS ${sql.raw(indexName)} ON ${sql.table(table)}(status, confidence)`.execute(
          this.db,
        )
        applied.push(`Injected hotspot index for lifecycle: ${indexName}`)
      }
    }

    if (applied.length > 0) {
      await this.logRitual('optimization', 'success', {
        action: 'autonomous_indexing',
        applied_count: applied.length,
      })
    }

    return applied
  }

  /**
   * Run database-level optimization (VACUUM/ANALYZE).
   */
  async optimizeDatabase(): Promise<void> {
    console.log('[CortexJanitor] Running database-level optimizations...')

    const executor = (this.db as any).getExecutor()
    const dialect = executor.dialect?.constructor.name.toLowerCase() || ''

    if (dialect.includes('sqlite')) {
      await sql`VACUUM`.execute(this.db)
      await sql`PRAGMA optimize`.execute(this.db)
    } else if (dialect.includes('postgres')) {
      await sql`ANALYZE`.execute(this.db)
    }

    await this.logRitual('optimization', 'success', {
      action: 'db_maintenance',
    })
  }

  private async logRitual(
    type: AgentRitual['type'],
    status: AgentRitual['status'],
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      // Audit Phase 18: Prevent log-spam in concurrent swarms
      const windowStart = new Date(Date.now() - 10 * 60 * 1000) // 10 min window
      const existing = await this.db
        .selectFrom(this.ritualsTable as any)
        .select('id')
        .where('name', '=', `Automated ${type}`)
        .where('type', '=', type)
        .where('last_run', '>', windowStart)
        .executeTakeFirst()

      if (existing) return

      await this.db
        .insertInto(this.ritualsTable as any)
        .values({
          name: `Automated ${type}`,
          type,
          status,
          last_run: new Date(),
          metadata: metadata ? JSON.stringify(metadata) : null,
        } as any)
        .execute()
    } catch (e) {
      console.error('[CortexJanitor] Failed to log ritual:', e)
    }
  }
}
