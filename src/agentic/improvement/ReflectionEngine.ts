import type { Kysely } from '../../kysely.js'
import type { AgentReflection, AgenticConfig } from '../../types/index.js'

/**
 * ReflectionEngine enables agents to perform "post-mortems" on sessions,
 * storing lessons learned and evaluating outcomes to improve future performance.
 */
export class ReflectionEngine {
  private reflectionsTable: string

  constructor(
    private db: Kysely<any>,
    private config: AgenticConfig = {},
  ) {
    this.reflectionsTable = config.reflectionsTable || 'agent_reflections'
  }

  /**
   * Record a reflection for a session
   */
  async reflect(
    sessionId: string | number,
    outcome: AgentReflection['outcome'],
    lessonsLearned: string,
    suggestedActions?: string[],
    metadata?: Record<string, any>,
    trxOrDb: any = this.db, // Allow passing transaction
  ): Promise<AgentReflection> {
    const reflection = (await trxOrDb
      .insertInto(this.reflectionsTable as any)
      .values({
        session_id: sessionId,
        outcome,
        lessons_learned: lessonsLearned,
        suggested_actions: suggestedActions
          ? JSON.stringify(suggestedActions)
          : null,
        metadata: metadata ? JSON.stringify(metadata) : null,
        created_at: new Date(),
      } as any)
      .returningAll()
      .executeTakeFirstOrThrow()) as unknown as AgentReflection

    return this.parseReflection(reflection)
  }

  /**
   * Get reflections for a specific session
   */
  async getSessionReflections(
    sessionId: string | number,
    options: { limit?: number; offset?: number } = {},
  ): Promise<AgentReflection[]> {
    const reflections = (await this.db
      .selectFrom(this.reflectionsTable as any)
      .selectAll()
      .where('session_id' as any, '=', sessionId)
      .orderBy('created_at' as any, 'desc')
      .limit(options.limit ?? 500) // Audit Phase 18: Hard memory safety limit
      .offset(options.offset ?? 0)
      .execute()) as unknown as AgentReflection[]

    return reflections.map((r) => this.parseReflection(r))
  }

  /**
   * Get recent lessons learned across all sessions
   */
  async getRecentLessons(limit: number = 10): Promise<string[]> {
    const reflections = await this.db
      .selectFrom(this.reflectionsTable as any)
      .select('lessons_learned' as any)
      .orderBy('created_at' as any, 'desc')
      .limit(limit)
      .execute()

    return reflections.map((r: any) => r.lessons_learned)
  }

  private parseReflection(reflection: any): AgentReflection {
    return {
      ...reflection,
      sessionId: reflection.session_id,
      lessonsLearned: reflection.lessons_learned,
      suggestedActions:
        typeof reflection.suggested_actions === 'string'
          ? JSON.parse(reflection.suggested_actions)
          : reflection.suggested_actions,
      metadata:
        typeof reflection.metadata === 'string'
          ? JSON.parse(reflection.metadata)
          : reflection.metadata,
      createdAt: new Date(reflection.created_at),
    }
  }
}
