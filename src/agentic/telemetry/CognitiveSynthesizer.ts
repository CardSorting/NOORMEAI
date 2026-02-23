import type { Kysely } from '../../kysely.js'
import type { AgenticConfig, SessionEvolution } from '../../types/index.js'
import { sql } from '../../raw-builder/sql.js'

/**
 * CognitiveSynthesizer provides advanced behavioral analysis.
 * It tracks how the agent's understanding of its goals evolves over time,
 * measuring the autonomy gradient and strategic shifts.
 */
export class CognitiveSynthesizer {
  private evolutionTable: string

  constructor(
    private db: Kysely<any>,
    private config: AgenticConfig = {},
  ) {
    this.evolutionTable =
      config.sessionEvolutionTable || 'agent_session_evolution'
  }

  /**
   * Infer goals and update session evolution with production-grade persistence.
   * Uses robust transaction logic and behavioral pathing.
   */
  async synthesize(
    sessionId: string | number,
    input: string,
    pattern?: string,
  ): Promise<void> {
    // PRODUCTION HARDENING: Reasoning-Driven Synthesis
    // Instead of regex heuristics, we leverage the RecursiveReasoner for high-fidelity goal extraction
    const cortex = (this.config as any).cortex
    let goalInferred = this.inferGoalFromContent(input)

    if (cortex?.reasoner) {
      const reasoning = await cortex.reasoner.analyzeIntent(input)
      if (reasoning.goal) goalInferred = reasoning.goal
    }

    const strategy = pattern || this.detectStrategy(input)

    try {
      await this.db.transaction().execute(async (trx) => {
        const existing = await trx
          .selectFrom(this.evolutionTable as any)
          .selectAll()
          .where('session_id', '=', sessionId)
          .executeTakeFirst()

        if (existing) {
          const currentPath = this.parsePath(existing.evolution_path)

          // Only append to path if goal, strategy, or sentiment shifted significantly
          const sentiment = this.detectSentimentDrift(input)
          if (
            existing.inferred_goal !== goalInferred ||
            existing.strategy !== strategy ||
            (existing.metadata && JSON.parse(existing.metadata).lastSentiment !== sentiment)
          ) {
            currentPath.push({
              timestamp: new Date().toISOString(),
              previousGoal: existing.inferred_goal,
              newGoal: goalInferred,
              strategyShift: strategy,
              sentiment,
            })
          }

          await trx
            .updateTable(this.evolutionTable as any)
            .set({
              inferred_goal: goalInferred,
              strategy,
              evolution_path: JSON.stringify(currentPath),
              status: 'active',
              metadata: JSON.stringify({
                ...JSON.parse(existing.metadata || '{}'),
                lastSentiment: sentiment,
                pivots: currentPath.length,
              }),
              autonomy_level: this.calculateAutonomy(
                currentPath.length,
                existing.autonomy_level || 1,
              ),
              updated_at: new Date(),
            } as any)
            .where('session_id', '=', sessionId)
            .execute()
        } else {
          await trx
            .insertInto(this.evolutionTable as any)
            .values({
              session_id: sessionId,
              inferred_goal: goalInferred,
              strategy,
              evolution_path: JSON.stringify([
                {
                  timestamp: new Date().toISOString(),
                  event: 'session_start',
                  initialGoal: goalInferred,
                },
              ]),
              status: 'active',
              autonomy_level: 1,
              updated_at: new Date(),
            } as any)
            .execute()
        }
      })
    } catch (e) {
      console.error(
        `[CognitiveSynthesizer] Fatal synthesis failure for session ${sessionId}:`,
        e,
      )
      throw new Error(
        `Behavioral synthesis failed: ${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }

  /**
   * Mark session as pivoted or abandoned with path documentation.
   */
  async trackShift(
    sessionId: string | number,
    shiftType: 'pivot' | 'abandonment',
  ): Promise<void> {
    try {
      await this.db.transaction().execute(async (trx) => {
        const existing = await trx
          .selectFrom(this.evolutionTable as any)
          .selectAll()
          .where('session_id', '=', sessionId)
          .executeTakeFirst()

        if (!existing) return

        const currentPath = this.parsePath(existing.evolution_path)
        currentPath.push({
          timestamp: new Date().toISOString(),
          type: 'shift',
          shift: shiftType,
          reason:
            shiftType === 'abandonment'
              ? 'User manual termination or lack of progress'
              : 'Strategic goal shift',
        })

        await trx
          .updateTable(this.evolutionTable as any)
          .set({
            status: shiftType === 'pivot' ? 'pivoted' : 'abandoned',
            strategy: shiftType === 'pivot' ? 'Strategic Pivot' : 'Terminated',
            evolution_path: JSON.stringify(currentPath),
            updated_at: new Date(),
          } as any)
          .where('session_id', '=', sessionId)
          .execute()
      })
    } catch (e) {
      console.error(
        `[CognitiveSynthesizer] Failed to track shift for session ${sessionId}:`,
        e,
      )
    }
  }

  private inferGoalFromContent(content: string): string {
    // Real-world simulation: extract the first imperative sentence or key noun phrases
    const clean = content.trim().replace(/\n/g, ' ')

    // Hardened heuristic: prioritize imperative verbs and specific NOORMME intents
    const imperativeMatch = clean.match(
      /(?:please |can you |let's )?(implement|fix|refactor|add|search|analyze|delete|evolve) .+/i,
    )
    if (imperativeMatch) {
      return imperativeMatch[0].substring(0, 100) + (imperativeMatch[0].length > 100 ? '...' : '')
    }

    if (clean.length < 100) return clean

    const keywords = [
      'need',
      'want',
      'please',
      'can you',
      'implement',
      'fix',
      'add',
    ]
    for (const kw of keywords) {
      const index = clean.toLowerCase().indexOf(kw)
      if (index !== -1) {
        return clean.substring(index, index + 80) + '...'
      }
    }

    return clean.substring(0, 80) + '...'
  }

  private detectStrategy(content: string): string {
    const c = content.toLowerCase()

    // Hardened strategy detection
    if (c.includes('debug') || c.includes('fix') || c.includes('error') || c.includes('broken'))
      return 'Diagnostic Repair'
    if (c.includes('create') || c.includes('build') || c.includes('implement') || c.includes('new file'))
      return 'Generative Construction'
    if (c.includes('research') || c.includes('explain') || c.includes('how') || c.includes('investigate'))
      return 'Knowledge Acquisition'
    if (c.includes('evolve') || c.includes('mutate') || c.includes('dna'))
      return 'Self-Evolutionary'

    return 'Adaptive Exploration'
  }

  private calculateAutonomy(pivots: number, currentLevel: number): number {
    // Enhanced Autonomy: Lower weight on raw pivots, more on ratio
    // If pivots are moderate but yield successful sub-goals, autonomy holds.
    if (pivots > 10) return Math.max(1, currentLevel - 1)
    if (pivots > 5 && currentLevel > 2) return currentLevel
    if (pivots === 0) return Math.min(5, currentLevel + 1)

    return currentLevel
  }

  /**
   * Detect "Sentiment Drift" or Cognitive Friction in the input stream.
   * Mirrors the agent's internal "frustration" or "flow" state.
   */
  private detectSentimentDrift(content: string): 'frustration' | 'flow' | 'neutral' {
    const c = content.toLowerCase()
    const negativeTerms = ['slow', 'wrong', 'bad', 'error', 'failed', 'cannot', 'stuck']
    const postiveTerms = ['great', 'correct', 'good', 'success', 'works', 'yes']

    const negCount = negativeTerms.filter(t => c.includes(t)).length
    const posCount = postiveTerms.filter(t => c.includes(t)).length

    if (negCount > posCount + 1) return 'frustration'
    if (posCount > negCount) return 'flow'
    return 'neutral'
  }

  private parsePath(pathData: any): any[] {
    if (!pathData) return []
    if (typeof pathData === 'string') {
      try {
        return JSON.parse(pathData)
      } catch {
        return []
      }
    }
    return Array.isArray(pathData) ? pathData : []
  }
}
