import type { Kysely } from '../kysely.js'
import type { AgenticConfig, AgentAction } from '../types/index.js'
import type { TelemetryOrchestrator } from './telemetry/TelemetryOrchestrator.js'

export interface ActionTable {
  id: number | string
  session_id: number | string
  message_id: number | string | null
  tool_name: string
  arguments: string // JSON string
  outcome: string | null
  status: 'success' | 'failure' | 'pending'
  duration_ms: number | null
  metadata: string | null // JSON string
  created_at: string | Date
}

export interface ActionDatabase {
  agent_actions: ActionTable
}

/**
 * ActionJournal records tool usage and outcomes to help agents learn
 * from their past actions.
 */
export class ActionJournal {
  private actionsTable: string

  constructor(
    private db: Kysely<any>,
    private config: AgenticConfig = {},
    private telemetry?: TelemetryOrchestrator,
  ) {
    this.actionsTable = config.actionsTable || 'agent_actions'
  }

  private get typedDb(): Kysely<ActionDatabase> {
    return this.db as unknown as Kysely<ActionDatabase>
  }

  /**
   * Log an action (tool call)
   */
  async logAction(
    sessionId: string | number,
    toolName: string,
    args: Record<string, any>,
    messageId?: string | number,
  ): Promise<AgentAction> {
    const action = await this.typedDb
      .insertInto(this.actionsTable as any)
      .values({
        session_id: sessionId,
        message_id: messageId || null,
        tool_name: toolName,
        arguments: JSON.stringify(args),
        status: 'pending',
        created_at: new Date(),
      } as any)
      .returningAll()
      .executeTakeFirstOrThrow()

    const parsed = this.parseAction(action)

    // Telemetry: Track action start
    if (this.telemetry) {
      await this.telemetry.track(
        sessionId,
        'action',
        `Tool call: ${toolName}`,
        { actionId: action.id, arguments: args },
      )
    }

    return parsed
  }

  /**
   * Update action with outcome
   */
  async recordOutcome(
    actionId: string | number,
    status: AgentAction['status'],
    outcome: string,
    durationMs?: number,
    metadata?: Record<string, any>,
  ): Promise<AgentAction> {
    const action = await this.typedDb
      .updateTable(this.actionsTable as any)
      .set({
        status,
        outcome,
        duration_ms: durationMs || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      })
      .where('id', '=', actionId)
      .returningAll()
      .executeTakeFirstOrThrow()

    const parsed = this.parseAction(action)

    // Telemetry: Track outcome and failures
    if (this.telemetry) {
      if (status === 'failure') {
        await this.telemetry.track(
          parsed.sessionId,
          'error',
          `Action failed: ${outcome}`,
          { actionId, status },
        )
      }
    }

    return parsed
  }

  /**
   * Get actions for a session with pagination
   */
  async getSessionActions(
    sessionId: string | number,
    options: { limit?: number; cursor?: string | number } = {},
  ): Promise<AgentAction[]> {
    const { limit = 100, cursor } = options

    let query = this.typedDb
      .selectFrom(this.actionsTable as any)
      .selectAll()
      .where('session_id', '=', sessionId)
      .orderBy('id', 'asc') // Audit Phase 9: Stable ordering for cursors
      .limit(limit)

    if (cursor) {
      query = query.where('id', '>', cursor)
    }

    const actions = await query.execute()
    return actions.map((a) => this.parseAction(a))
  }

  /**
   * Get actions by tool name across all sessions.
   */
  async getActionsByTool(
    toolName: string,
    limit: number = 50,
  ): Promise<AgentAction[]> {
    const actions = await this.typedDb
      .selectFrom(this.actionsTable as any)
      .selectAll()
      .where('tool_name', '=', toolName)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .execute()

    return actions.map((a) => this.parseAction(a))
  }

  /**
   * Generate a report of tool failures.
   */
  async getFailureReport(): Promise<
    { toolName: string; failureCount: number; lastFailure: string }[]
  > {
    // Audit Phase 19: Sliding window (default 7 days) to prevent OOM/slow scans
    const windowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const results = await this.typedDb
      .selectFrom(this.actionsTable as any)
      .select([
        'tool_name',
        (eb: any) => eb.fn.count('id').as('failureCount'),
        (eb: any) => eb.fn.max('created_at').as('lastFailure'),
      ])
      .where('status', '=', 'failure')
      .where('created_at', '>', windowStart)
      .groupBy('tool_name')
      .orderBy((eb: any) => eb.fn.count('id'), 'desc')
      .execute()

    return results.map((r: any) => ({
      toolName: r.tool_name,
      failureCount: Number(r.failureCount),
      lastFailure: r.lastFailure,
    }))
  }

  private parseAction(action: any): AgentAction {
    return {
      id: action.id,
      sessionId: action.session_id,
      messageId: action.message_id,
      toolName: action.tool_name,
      arguments:
        typeof action.arguments === 'string'
          ? JSON.parse(action.arguments)
          : action.arguments || {},
      status: action.status,
      outcome: action.outcome,
      durationMs: action.duration_ms,
      metadata:
        typeof action.metadata === 'string'
          ? JSON.parse(action.metadata)
          : action.metadata || {},
      createdAt: new Date(action.created_at),
    }
  }
}
