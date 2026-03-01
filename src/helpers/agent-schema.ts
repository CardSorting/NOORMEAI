import type { Kysely } from '../kysely.js'
import type { AgenticConfig } from '../types/index.js'
import { sql } from '../raw-builder/sql.js'

/**
 * AgentSchemaHelper provides utilities to initialize the database
 * with tables required for AI agent persistence.
 */
export class AgentSchemaHelper {
  constructor(
    private db: Kysely<any>,
    private config: AgenticConfig = {},
  ) { }

  /**
   * Initialize all agentic tables
   */
  async initializeSchema(): Promise<void> {
    const sessionsTable = this.config.sessionsTable || 'agent_sessions'
    const messagesTable = this.config.messagesTable || 'agent_messages'
    const goalsTable = this.config.goalsTable || 'agent_goals'
    const memoriesTable = this.config.memoriesTable || 'agent_memories'
    const reflectionsTable = this.config.reflectionsTable || 'agent_reflections'
    const knowledgeTable = this.config.knowledgeTable || 'agent_knowledge_base'
    const actionsTable = this.config.actionsTable || 'agent_actions'
    const episodesTable = this.config.episodesTable || 'agent_episodes'
    const resourcesTable = this.config.resourcesTable || 'agent_resource_usage'
    const capabilitiesTable =
      this.config.capabilitiesTable || 'agent_capabilities'
    const metricsTable = this.config.metricsTable || 'agent_metrics'

    // 1. Sessions Table
    await this.db.schema
      .createTable(sessionsTable)
      .ifNotExists()
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('name', 'text')
      .addColumn('status', 'text', (col) => col.notNull().defaultTo('active'))
      .addColumn('metadata', 'text')
      .addColumn('created_at', 'timestamp', (col) => col.notNull())
      .addColumn('updated_at', 'timestamp', (col) => col.notNull())
      .execute()

    // 2. Messages Table
    await this.db.schema
      .createTable(messagesTable)
      .ifNotExists()
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('session_id', 'text')
      .addColumn('role', 'text', (col) => col.notNull())
      .addColumn('content', 'text', (col) => col.notNull())
      .addColumn('metadata', 'text')
      .addColumn('created_at', 'timestamp', (col) => col.notNull())
      .execute()

    // 3. Goals Table
    await this.db.schema
      .createTable(goalsTable)
      .ifNotExists()
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('session_id', 'text')
      .addColumn('parent_id', 'integer', (col) =>
        col.references(`${goalsTable}.id`).onDelete('cascade'),
      )
      .addColumn('description', 'text', (col) => col.notNull())
      .addColumn('status', 'text', (col) => col.notNull().defaultTo('pending'))
      .addColumn('priority', 'integer', (col) => col.notNull().defaultTo(0))
      .addColumn('metadata', 'text')
      .addColumn('created_at', 'timestamp', (col) => col.notNull())
      .addColumn('updated_at', 'timestamp', (col) => col.notNull())
      .execute()

    // 4. Memories Table (Basic)
    await this.db.schema
      .createTable(memoriesTable)
      .ifNotExists()
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('session_id', 'text')
      .addColumn('content', 'text', (col) => col.notNull())
      .addColumn('embedding', 'text') // In Postgres with pgvector, this would be 'vector(D)'
      .addColumn('metadata', 'text')
      .addColumn('created_at', 'timestamp', (col) => col.notNull())
      .execute()

    // 5. Reflections Table
    await this.db.schema
      .createTable(reflectionsTable)
      .ifNotExists()
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('session_id', 'text')
      .addColumn('outcome', 'text', (col) => col.notNull())
      .addColumn('lessons_learned', 'text', (col) => col.notNull())
      .addColumn('suggested_actions', 'text')
      .addColumn('metadata', 'text')
      .addColumn('created_at', 'timestamp', (col) => col.notNull())
      .execute()

    // 6. Knowledge Base Table
    await this.db.schema
      .createTable(knowledgeTable)
      .ifNotExists()
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('entity', 'text', (col) => col.notNull())
      .addColumn('fact', 'text', (col) => col.notNull())
      .addColumn('confidence', 'real', (col) => col.notNull().defaultTo(1.0))
      .addColumn('source_session_id', 'text')
      .addColumn('status', 'text', (col) => col.notNull().defaultTo('proposed'))
      .addColumn('tags', 'text')
      .addColumn('metadata', 'text')
      .addColumn('created_at', 'timestamp', (col) => col.notNull())
      .addColumn('updated_at', 'timestamp', (col) => col.notNull())
      .execute()

    // 7. Actions Table
    await this.db.schema
      .createTable(actionsTable)
      .ifNotExists()
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('session_id', 'text')
      .addColumn('message_id', 'integer')
      .addColumn('tool_name', 'text', (col) => col.notNull())
      .addColumn('arguments', 'text', (col) => col.notNull())
      .addColumn('outcome', 'text')
      .addColumn('error', 'text')
      .addColumn('status', 'text', (col) => col.notNull().defaultTo('pending'))
      .addColumn('duration_ms', 'integer')
      .addColumn('metadata', 'text')
      .addColumn('created_at', 'timestamp', (col) => col.notNull())
      .execute()

    // 8. Episodes Table
    await this.db.schema
      .createTable(episodesTable)
      .ifNotExists()
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('session_id', 'text')
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('summary', 'text')
      .addColumn('status', 'text', (col) => col.notNull().defaultTo('active'))
      .addColumn('start_time', 'timestamp', (col) => col.notNull())
      .addColumn('end_time', 'timestamp')
      .addColumn('metadata', 'text')
      .execute()

    // 9. Resource Usage Table
    await this.db.schema
      .createTable(resourcesTable)
      .ifNotExists()
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('session_id', 'text')
      .addColumn('agent_id', 'text')
      .addColumn('model_name', 'text', (col) => col.notNull())
      .addColumn('input_tokens', 'integer', (col) => col.notNull().defaultTo(0))
      .addColumn('output_tokens', 'integer', (col) =>
        col.notNull().defaultTo(0),
      )
      .addColumn('cost', 'real', (col) => col.notNull().defaultTo(0))
      .addColumn('currency', 'text', (col) => col.notNull().defaultTo('USD'))
      .addColumn('created_at', 'timestamp', (col) => col.notNull())
      .execute()

    // 10. Capabilities Table
    await this.db.schema
      .createTable(capabilitiesTable)
      .ifNotExists()
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('version', 'text', (col) => col.notNull())
      .addColumn('description', 'text')
      .addColumn('status', 'text', (col) =>
        col.notNull().defaultTo('experimental'),
      )
      .addColumn('reliability', 'real', (col) => col.notNull().defaultTo(1.0))
      .addColumn('metadata', 'text')
      .addColumn('created_at', 'timestamp', (col) => col.notNull())
      .addColumn('updated_at', 'timestamp', (col) => col.notNull())
      .addColumn('created_at', 'timestamp', (col) => col.notNull())
      .execute()
  }

  /**
   * Enable vector extensions if supported
   */
  async enableVectorSupport(): Promise<void> {
    // This is dialect-specific and usually requires superuser permissions in Postgres
    try {
      await sql`CREATE EXTENSION IF NOT EXISTS vector`.execute(this.db)
    } catch (e) {
      console.warn(
        'Failed to enable pgvector extension. Ensure it is installed on your Postgres server.',
      )
    }
  }
}
