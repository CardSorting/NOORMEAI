import type { Kysely } from '../../kysely.js'
import type { AgenticConfig, AgentRitual } from '../../types/index.js'
import type { Cortex } from '../Cortex.js'

/**
 * RitualOrchestrator handles the periodic execution of background tasks
 * such as memory optimization, session compression, and knowledge distillation.
 */
export class RitualOrchestrator {
  private ritualsTable: string

  constructor(
    private db: Kysely<any>,
    private cortex: Cortex,
    private config: AgenticConfig = {},
  ) {
    this.ritualsTable = config.ritualsTable || 'agent_rituals'
  }

  /**
   * Schedule a new ritual
   */
  async scheduleRitual(
    name: string,
    type: AgentRitual['type'],
    frequency: AgentRitual['frequency'],
    definition?: string,
    metadata?: Record<string, any>,
  ): Promise<AgentRitual> {
    const nextRun = this.calculateNextRun(frequency)

    const ritual = (await this.db
      .insertInto(this.ritualsTable as any)
      .values({
        name,
        type,
        frequency,
        definition,
        next_run: nextRun,
        status: 'pending',
        metadata: metadata ? JSON.stringify(metadata) : null,
      } as any)
      .returningAll()
      .executeTakeFirstOrThrow()) as unknown as AgentRitual

    return this.parseRitual(ritual)
  }

  /**
   * Run all pending rituals that are due
   */
  async runPendingRituals(): Promise<number> {
    const now = new Date()
    const lockTimeout = new Date(now.getTime() + 600000) // 10 min lock by default

    return await this.db.transaction().execute(async (trx) => {
      const pending = (await trx
        .selectFrom(this.ritualsTable as any)
        .selectAll()
        .where('next_run', '<=', now)
        .where('status', 'in', ['pending', 'success', 'failure'])
        .where((eb: any) =>
          eb.or([
            eb('locked_until', '<=', now),
            eb('locked_until', 'is', null),
          ]),
        )
        .execute()) as unknown as AgentRitual[]

      if (pending.length === 0) return 0

      console.log(
        `[RitualOrchestrator] Found ${pending.length} pending rituals due. Locking for execution...`,
      )

      for (const ritual of pending) {
        // Production Hardening: Distributed Lock
        await trx
          .updateTable(this.ritualsTable as any)
          .set({ locked_until: lockTimeout } as any)
          .where('id', '=', ritual.id)
          .execute()

        // Execute out-of-transaction to avoid long-held locks if sub-tasks are slow
        // but we await it here for the summary count.
        // In a highly parallel system, this might be sent to a worker queue.
        await this.executeRitual(ritual)
      }

      return pending.length
    })
  }

  /**
   * Execute a specific ritual
   */
  async executeRitual(ritual: AgentRitual): Promise<void> {
    console.log(
      `[RitualOrchestrator] Executing ritual: ${ritual.name} (${ritual.type})`,
    )
    const ritualMetadata: Record<string, any> = {
      ...ritual.metadata,
      startedAt: new Date(),
    }
    let success = false

    try {
      switch (ritual.type) {
        case 'compression':
          const sessionsTable = this.config.sessionsTable || 'agent_sessions'
          const activeSessions = await this.db
            .selectFrom(sessionsTable as any)
            .select('id')
            .where('status', '=', 'active')
            .execute()

          const compressionThreshold = this.config.contextWindowSize || 20
          let compressedCount = 0

          for (const session of activeSessions) {
            const messagesTable = this.config.messagesTable || 'agent_messages'
            const countResult = (await this.db
              .selectFrom(messagesTable as any)
              .select((eb: any) => eb.fn.countAll().as('count'))
              .where('session_id', '=', session.id)
              .executeTakeFirst()) as any

            const count = Number(countResult?.count || 0)
            if (count > compressionThreshold) {
              await this.cortex.compressor.semanticPruning(session.id)
              compressedCount++
            }
          }
          ritualMetadata.sessionsCompressed = compressedCount
          break

        case 'optimization':
          const evolution = await this.cortex.pilot.runSelfImprovementCycle()
          await this.cortex.janitor.optimizeDatabase()
          ritualMetadata.evolutionChanges = evolution.changes
          break

        case 'pruning':
          const prunedKnowledge = await this.cortex.janitor.runPruningRitual()
          const prunedZombies = await this.cortex.ablation.pruneZombies()
          const orphans = await this.cortex.janitor.cleanOrphans()
          ritualMetadata.prunedKnowledge = prunedKnowledge
          ritualMetadata.prunedZombies = prunedZombies
          ritualMetadata.orphansCleaned = orphans
          break

        case 'evolution':
          const evolutionResults = await this.cortex.evolutionRitual.execute()
          ritualMetadata.synthesized = evolutionResults.synthesized
          ritualMetadata.broadcasted = evolutionResults.broadcasted
          ritualMetadata.domainsBoosted = evolutionResults.domainsSynced
          break
      }
      success = true
    } catch (error) {
      console.error(`[RitualOrchestrator] Ritual ${ritual.name} failed:`, error)
      ritualMetadata.error = String(error)
      ritualMetadata.failureCount = (ritualMetadata.failureCount || 0) + 1
    } finally {
      // Update ritual status, unlock, and schedule next run
      const frequency = ritual.frequency || 'daily'
      const nextRun = this.calculateNextRun(
        frequency,
        success ? 0 : ritualMetadata.failureCount,
      )

      await this.db
        .updateTable(this.ritualsTable as any)
        .set({
          status: success ? 'success' : 'failure',
          last_run: new Date(),
          next_run: nextRun,
          locked_until: null, // Unlock
          metadata: JSON.stringify(ritualMetadata),
        } as any)
        .where('id', '=', ritual.id)
        .execute()
    }
  }

  /**
   * Calculate next run with Adaptive Backoff for failures
   */
  private calculateNextRun(
    frequency: AgentRitual['frequency'],
    failureCount: number = 0,
  ): Date {
    let baseMs = 86400000 // default daily
    switch (frequency) {
      case 'hourly':
        baseMs = 3600000
        break
      case 'daily':
        baseMs = 86400000
        break
      case 'weekly':
        baseMs = 604800000
        break
    }

    // Exponential backoff for failures: 2^n * 10 mins
    const backoffMs =
      failureCount > 0
        ? Math.min(baseMs, Math.pow(2, failureCount - 1) * 600000)
        : 0

    return new Date(Date.now() + baseMs + backoffMs)
  }

  private parseRitual(r: any): AgentRitual {
    return {
      ...r,
      lastRun: r.last_run ? new Date(r.last_run) : undefined,
      nextRun: r.next_run ? new Date(r.next_run) : undefined,
      lockedUntil: r.locked_until ? new Date(r.locked_until) : undefined,
      metadata:
        typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
    }
  }
}
