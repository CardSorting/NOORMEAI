import type { Kysely } from '../kysely.js'
import type {
  AgenticConfig,
  AgentSession,
  AgentMessage,
  AgentGoal,
  AgentMemory,
  AgentAction,
  AgentEpisode,
  ResourceUsage
} from '../types/index.js'
import { sql } from '../raw-builder/sql.js'
import { withLock } from './util/db-utils.js'

interface SessionTable {
  id: number | string
  name: string | null
  status: 'active' | 'archived' | 'deleted'
  metadata: string | null // JSON string
  created_at: string | Date
  updated_at: string | Date
}

interface MessageTable {
  id: number | string
  session_id: number | string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  metadata: string | null // JSON string
  created_at: string | Date
}

interface GoalTable {
  id: number | string
  session_id: number | string
  parent_id: number | string | null
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked'
  priority: number
  metadata: string | null // JSON string
  created_at: string | Date
  updated_at: string | Date
}

interface ActionTable {
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

interface EpisodeTable {
  id: number | string
  session_id: number | string
  name: string
  summary: string | null
  status: 'active' | 'completed'
  start_time: string | Date
  end_time: string | Date | null
  metadata: string | null // JSON string
}

interface ResourceTable {
  id: number | string
  session_id: number | string | null
  agent_id: string | null
  model_name: string
  input_tokens: number
  output_tokens: number
  cost: number
  currency: string
  metadata: string | null // JSON string
  created_at: string | Date
}

interface SessionDatabase {
  agent_sessions: SessionTable
  agent_messages: MessageTable
  agent_goals: GoalTable
  agent_memories: {
    id: number | string
    session_id: number | string | null
    content: string
    metadata: string | null
    created_at: string | Date
  }
  agent_actions: ActionTable
  agent_episodes: EpisodeTable
  agent_resource_usage: ResourceTable
}

/**
 * SessionManager handles the lifecycle of agentic sessions, including
 * message history, goal tracking, and memory persistence.
 */
export class SessionManager {
  private sessionsTable: string
  private messagesTable: string
  private memoriesTable: string
  private goalsTable: string
  private actionsTable: string
  private episodesTable: string
  private resourcesTable: string

  constructor(
    private db: Kysely<any>,
    private config: AgenticConfig = {},
  ) {
    this.sessionsTable = config.sessionsTable || 'agent_sessions'
    this.messagesTable = config.messagesTable || 'agent_messages'
    this.memoriesTable = config.memoriesTable || 'agent_memories'
    this.goalsTable = config.goalsTable || 'agent_goals'
    this.actionsTable = config.actionsTable || 'agent_actions'
    this.episodesTable = config.episodesTable || 'agent_episodes'
    this.resourcesTable = config.resourcesTable || 'agent_resource_usage'
  }

  private get typedDb(): Kysely<SessionDatabase> {
    return this.db as unknown as Kysely<SessionDatabase>
  }

  /**
   * Create a new agent session
   */
  async createSession(
    name?: string,
    metadata?: Record<string, any>,
  ): Promise<AgentSession> {
    const session = await this.typedDb
      .insertInto(this.sessionsTable as any)
      .values({
        name: name || null,
        status: 'active',
        metadata: metadata ? JSON.stringify(metadata) : null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return this.parseSession(session)
  }

  /**
   * Retrieve a session by ID
   */
  async getSession(id: string | number): Promise<AgentSession | null> {
    const session = await this.typedDb
      .selectFrom(this.sessionsTable as any)
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()

    return session ? this.parseSession(session) : null
  }

  /**
   * Mark a session as archived.
   */
  async archiveSession(id: string | number): Promise<AgentSession> {
    const session = await this.typedDb
      .updateTable(this.sessionsTable as any)
      .set({ status: 'archived', updated_at: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()

    return this.parseSession(session)
  }

  /**
   * Delete a session and all associated data (messages, goals, memories).
   */
  async deleteSession(id: string | number): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      // Delete associated data first
      await trx
        .deleteFrom(this.messagesTable as any)
        .where('session_id', '=', id)
        .execute()
      await trx
        .deleteFrom(this.goalsTable as any)
        .where('session_id', '=', id)
        .execute()
      await trx
        .deleteFrom(this.memoriesTable as any)
        .where('session_id', '=', id)
        .execute()

      // Delete the session itself
      await trx
        .deleteFrom(this.sessionsTable as any)
        .where('id', '=', id)
        .execute()
    })
  }

  /**
   * Add a message to a session
   */
  async addMessage(
    sessionId: string | number,
    role: AgentMessage['role'],
    content: string,
    metadata?: Record<string, any>,
  ): Promise<AgentMessage> {
    return await this.db.transaction().execute(async (trx) => {
      const message = await trx
        .insertInto(this.messagesTable as any)
        .values({
          session_id: sessionId,
          role,
          content,
          metadata: metadata ? JSON.stringify(metadata) : null,
          created_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      // Update session's updated_at
      await trx
        .updateTable(this.sessionsTable as any)
        .set({ updated_at: new Date() })
        .where('id', '=', sessionId)
        .execute()

      return this.parseMessage(message)
    })
  }

  /**
   * Get message history for a session
   */
  async getHistory(
    sessionId: string | number,
    limit: number = 50,
  ): Promise<AgentMessage[]> {
    const messages = await this.typedDb
      .selectFrom(this.messagesTable as any)
      .selectAll()
      .where('session_id', '=', sessionId)
      .orderBy('created_at', 'asc')
      .limit(limit)
      .execute()

    return messages.map((m) => this.parseMessage(m))
  }

  /**
   * Set or update a goal for a session
   */
  async upsertGoal(
    sessionId: string | number,
    description: string,
    options: {
      status?: AgentGoal['status']
      priority?: number
      parentId?: string | number
      metadata?: Record<string, any>
    } = {},
  ): Promise<AgentGoal> {
    const { status = 'pending', priority = 0, parentId, metadata } = options

    return await this.db.transaction().execute(async (trx) => {
      const query = trx
        .selectFrom(this.goalsTable as any)
        .selectAll()
        .where('session_id', '=', sessionId)
        .where('description', '=', description)

      const existing = await withLock(query, trx) // Audit Phase 13: Atomic goal lock
        .executeTakeFirst()

      if (existing) {
        const updated = await trx
          .updateTable(this.goalsTable as any)
          .set({
            status,
            priority,
            metadata: metadata ? JSON.stringify(metadata) : existing.metadata,
            updated_at: new Date(),
          })
          .where('id', '=', existing.id)
          .returningAll()
          .executeTakeFirstOrThrow()
        return this.parseGoal(updated)
      }

      const created = await trx
        .insertInto(this.goalsTable as any)
        .values({
          session_id: sessionId,
          parent_id: parentId || null,
          description,
          status,
          priority,
          metadata: metadata ? JSON.stringify(metadata) : null,
          created_at: new Date(),
          updated_at: new Date(),
        })
      return this.parseGoal(created)
    })
  }

  /**
   * Get goals for a session.
   */
  async getGoals(
    sessionId: string | number,
    status?: AgentGoal['status'],
  ): Promise<AgentGoal[]> {
    let query = this.typedDb
      .selectFrom(this.goalsTable as any)
      .selectAll()
      .where('session_id', '=', sessionId)
      .orderBy('priority', 'desc')

    if (status) {
      query = query.where('status', '=', status)
    }

    const goals = await query.execute()
    return goals.map((g) => this.parseGoal(g))
  }

  /**
   * Clear message history for a session.
   */
  async clearHistory(sessionId: string | number): Promise<number> {
    const result = await this.typedDb
      .deleteFrom(this.messagesTable as any)
      .where('session_id', '=', sessionId)
      .executeTakeFirst()

    return Number(result.numDeletedRows || 0)
  }

  /**
   * Mark a message as a semantic anchor to prevent it from being pruned
   */
  async markMessageAsAnchor(messageId: string | number): Promise<AgentMessage> {
    // PRODUCTION HARDENING: Atomic Metadata Patching
    // We avoid the Read-Modify-Write race condition by letting the DB handle the merge
    // or by using a strict transaction if the DB doesn't support JSON patching natively.
    const updated = await this.db.transaction().execute(async (trx) => {
      const query = trx
        .selectFrom(this.messagesTable as any)
        .select('metadata')
        .where('id', '=', messageId)

      const message = await withLock(query, trx) // Lock the row for the duration of the transaction
        .executeTakeFirstOrThrow()

      const metadata =
        typeof message.metadata === 'string'
          ? JSON.parse(message.metadata)
          : message.metadata || {}

      const updatedMetadata = { ...metadata, anchor: true }

      return await trx
        .updateTable(this.messagesTable as any)
        .set({
          metadata: JSON.stringify(updatedMetadata),
        })
        .where('id', '=', messageId)
        .returningAll()
        .executeTakeFirstOrThrow()
    })

    return this.parseMessage(updated)
  }

  private parseSession(session: any): AgentSession {
    return {
      id: session.id,
      name: session.name,
      status: session.status,
      metadata:
        typeof session.metadata === 'string'
          ? JSON.parse(session.metadata)
          : session.metadata || {},
      createdAt: new Date(session.created_at),
      updatedAt: new Date(session.updated_at),
    }
  }

  private parseMessage(message: any): AgentMessage {
    return {
      id: message.id,
      sessionId: message.session_id,
      role: message.role,
      content: message.content,
      metadata:
        typeof message.metadata === 'string'
          ? JSON.parse(message.metadata)
          : message.metadata || {},
      createdAt: new Date(message.created_at),
    }
  }

  private parseGoal(goal: any): AgentGoal {
    return {
      id: goal.id,
      sessionId: goal.session_id,
      parentId: goal.parent_id,
      description: goal.description,
      status: goal.status,
      priority: goal.priority,
      metadata:
        typeof goal.metadata === 'string'
          ? JSON.parse(goal.metadata)
          : goal.metadata || {},
      createdAt: new Date(goal.created_at),
      updatedAt: new Date(goal.updated_at),
    }
  }

  // --- ACTIONS ---

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

    return this.parseAction(action)
  }

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

    return this.parseAction(action)
  }

  async getSessionActions(
    sessionId: string | number,
    options: { limit?: number; cursor?: string | number } = {},
  ): Promise<AgentAction[]> {
    const { limit = 100, cursor } = options

    let query = this.typedDb
      .selectFrom(this.actionsTable as any)
      .selectAll()
      .where('session_id', '=', sessionId)
      .orderBy('id', 'asc')
      .limit(limit)

    if (cursor) {
      query = query.where('id', '>', cursor)
    }

    const actions = await query.execute()
    return actions.map((a: any) => this.parseAction(a))
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

  // --- EPISODES ---

  async startEpisode(
    sessionId: string | number,
    name: string,
    metadata?: Record<string, any>,
  ): Promise<AgentEpisode> {
    const episode = await this.typedDb
      .insertInto(this.episodesTable as any)
      .values({
        session_id: sessionId,
        name,
        status: 'active',
        start_time: new Date(),
        metadata: metadata ? JSON.stringify(metadata) : null,
      } as any)
      .returningAll()
      .executeTakeFirstOrThrow()

    return this.parseEpisode(episode)
  }

  async completeEpisode(
    episodeId: string | number,
    summary: string,
    metadata?: Record<string, any>,
  ): Promise<AgentEpisode> {
    return await this.db.transaction().execute(async (trx) => {
      const query = trx
        .selectFrom(this.episodesTable as any)
        .selectAll()
        .where('id', '=', episodeId)

      const existing = await withLock(query, trx)
        .executeTakeFirst()

      if (!existing) throw new Error(`Episode with ID ${episodeId} not found`)

      const oldMeta =
        typeof (existing as any).metadata === 'string'
          ? JSON.parse((existing as any).metadata)
          : (existing as any).metadata || {}

      const newMeta = { ...oldMeta, ...metadata }

      const episode = await trx
        .updateTable(this.episodesTable as any)
        .set({
          status: 'completed',
          summary,
          end_time: new Date(),
          metadata: JSON.stringify(newMeta),
        } as any)
        .where('id', '=', episodeId)
        .returningAll()
        .executeTakeFirstOrThrow()

      return this.parseEpisode(episode)
    })
  }

  async getSessionEpisodes(
    sessionId: string | number,
    options: { limit?: number; offset?: number } = {},
  ): Promise<AgentEpisode[]> {
    const { limit = 100, offset = 0 } = options

    const list = await this.typedDb
      .selectFrom(this.episodesTable as any)
      .selectAll()
      .where('session_id', '=', sessionId)
      .orderBy('start_time', 'desc')
      .limit(limit)
      .offset(offset)
      .execute()

    return list.map((e) => this.parseEpisode(e))
  }

  private parseEpisode(episode: any): AgentEpisode {
    return {
      id: episode.id,
      sessionId: episode.session_id,
      name: episode.name,
      summary: episode.summary || undefined,
      status: episode.status,
      startTime: new Date(episode.start_time),
      endTime: episode.end_time ? new Date(episode.end_time) : undefined,
      metadata:
        typeof episode.metadata === 'string'
          ? JSON.parse(episode.metadata)
          : episode.metadata || {},
    }
  }

  // --- RESOURCES ---

  async recordUsage(
    sessionId: string | number,
    modelName: string,
    inputTokens: number,
    outputTokens: number,
    cost?: number,
    agentId?: string,
    metadata?: Record<string, any>,
  ): Promise<ResourceUsage> {
    const usage = await this.typedDb
      .insertInto(this.resourcesTable as any)
      .values({
        session_id: sessionId,
        agent_id: agentId || null,
        model_name: modelName,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost: cost || 0,
        currency: 'USD',
        metadata: metadata ? JSON.stringify(metadata) : null,
        created_at: new Date(),
      } as any)
      .returningAll()
      .executeTakeFirstOrThrow()

    return this.parseUsage(usage)
  }

  async getSessionTotalCost(sessionId: string | number): Promise<number> {
    const result = await this.typedDb
      .selectFrom(this.resourcesTable as any)
      .select((eb: any) => eb.fn.sum('cost').as('totalCost'))
      .where('session_id', '=', sessionId)
      .executeTakeFirst()

    return Number((result as any)?.totalCost || 0)
  }

  async getGlobalTotalCost(): Promise<number> {
    const result = await this.typedDb
      .selectFrom(this.resourcesTable as any)
      .select((eb: any) => eb.fn.sum('cost').as('totalCost'))
      .executeTakeFirst()

    return Number((result as any)?.totalCost || 0)
  }

  async getModelUsageStats(): Promise<
    { modelName: string; totalTokens: number; totalCost: number }[]
  > {
    const results = await this.typedDb
      .selectFrom(this.resourcesTable as any)
      .select([
        'model_name',
        (eb: any) =>
          eb.fn
            .sum(
              sql`input_tokens + output_tokens`,
            )
            .as('totalTokens'),
        (eb: any) => eb.fn.sum('cost').as('totalCost'),
      ])
      .groupBy('model_name')
      .execute()

    return results.map((r: any) => ({
      modelName: r.model_name,
      totalTokens: Number(r.totalTokens),
      totalCost: Number(r.totalCost),
    }))
  }

  private parseUsage(usage: any): ResourceUsage {
    return {
      id: usage.id,
      sessionId: usage.session_id,
      agentId: usage.agent_id,
      modelName: usage.model_name,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cost: usage.cost,
      currency: usage.currency,
      createdAt: new Date(usage.created_at),
    }
  }
}
