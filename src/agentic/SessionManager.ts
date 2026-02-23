import type { Kysely } from '../kysely.js'
import type {
  AgenticConfig,
  AgentSession,
  AgentMessage,
  AgentGoal,
  AgentMemory,
} from '../types/index.js'
import type { TelemetryOrchestrator } from './telemetry/TelemetryOrchestrator.js'

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

  constructor(
    private db: Kysely<any>,
    private config: AgenticConfig = {},
    private telemetry?: TelemetryOrchestrator,
  ) {
    this.sessionsTable = config.sessionsTable || 'agent_sessions'
    this.messagesTable = config.messagesTable || 'agent_messages'
    this.memoriesTable = config.memoriesTable || 'agent_memories'
    this.goalsTable = config.goalsTable || 'agent_goals'
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
      const existing = await trx
        .selectFrom(this.goalsTable as any)
        .selectAll()
        .where('session_id', '=', sessionId)
        .where('description', '=', description)
        .forUpdate() // Audit Phase 13: Atomic goal lock
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
        .returningAll()
        .executeTakeFirstOrThrow()

      const parsed = this.parseGoal(created)

      // Telemetry: Track goal discovery
      if (this.telemetry) {
        await this.telemetry.track(
          sessionId,
          'pivot',
          `New goal: ${description}`,
          { goalId: parsed.id },
        )
      }

      return parsed
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
      const message = await trx
        .selectFrom(this.messagesTable as any)
        .select('metadata')
        .where('id', '=', messageId)
        .forUpdate() // Lock the row for the duration of the transaction
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
}
