import { SchemaEvolutionHelper } from '../../helpers/schema-evolution.js'
import { TypeGenerator } from '../../types/type-generator.js'
import type { NOORMConfig, AgentSnapshot } from '../../types/index.js'
import type { Kysely } from '../../kysely.js'
import * as fs from 'fs/promises'
import * as path from 'path'
import { sql } from '../../raw-builder/sql.js'

/**
 * SelfEvolution orchestrates schema growth and automatic type regeneration,
 * allowing the agent to "upgrade" its own structural DNA.
 */
export class SelfEvolution {
  private evolution: SchemaEvolutionHelper
  private typeGenerator?: TypeGenerator
  private snapshotsTable: string

  constructor(
    private db: Kysely<any>,
    private config: NOORMConfig,
  ) {
    this.evolution = new SchemaEvolutionHelper(db)
    this.snapshotsTable =
      config.agentic?.metadata?.snapshotsTable || 'agent_snapshots'
  }

  private getTypeGenerator(): TypeGenerator {
    if (!this.typeGenerator) {
      this.typeGenerator = new TypeGenerator(this.config.introspection)
    }
    return this.typeGenerator
  }

  /**
   * Ensure core agentic tables have telemetry columns like 'accessed_at'
   */
  async ensureTelemetryColumns(): Promise<void> {
    const tableNames = [
      this.config.agentic?.sessionsTable || 'agent_sessions',
      this.config.agentic?.messagesTable || 'agent_messages',
      this.config.agentic?.memoriesTable || 'agent_memories',
      this.config.agentic?.goalsTable || 'agent_goals',
      this.config.agentic?.knowledgeTable || 'agent_knowledge_base',
    ]

    try {
      const introspector = this.db.introspection
      const allTables = await introspector.getTables()

      for (const tableName of tableNames) {
        const tableInfo = allTables.find((t) => t.name === tableName)

        if (
          tableInfo &&
          !tableInfo.columns.some((c) => c.name === 'accessed_at')
        ) {
          console.log(`[SelfEvolution] Adding 'accessed_at' column to ${tableName}`)
          await sql`ALTER TABLE ${sql.table(tableName)} ADD COLUMN accessed_at TIMESTAMP`.execute(
            this.db,
          )
        }
      }
    } catch (e) {
      console.warn(
        `[SelfEvolution] Failed to add telemetry columns:`,
        e,
      )
    }
  }

  /**
   * Create the telemetry-specific tables for research and behavioral analysis.
   */
  async setupTelemetryTables(): Promise<void> {
    const eventsTable =
      this.config.agentic?.telemetryEventsTable || 'agent_telemetry_events'
    const evolutionTable =
      this.config.agentic?.sessionEvolutionTable || 'agent_session_evolution'
    const metricsTable =
      this.config.agentic?.researchMetricsTable || 'agent_research_metrics'

    console.log(`[SelfEvolution] Ensuring telemetry tables exist...`)

    // 1. Raw Telemetry Events
    await this.db.schema
      .createTable(eventsTable)
      .ifNotExists()
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('session_id', 'text', (col) => col.notNull())
      .addColumn('type', 'text', (col) => col.notNull()) // prompt, output, action, error, pivot
      .addColumn('content', 'text', (col) => col.notNull())
      .addColumn('metadata', 'text') // JSON
      .addColumn('created_at', 'timestamp', (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`),
      )
      .execute()

    // 2. Session Evolution (Behavioral Summaries)
    await this.db.schema
      .createTable(evolutionTable)
      .ifNotExists()
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('session_id', 'text', (col) => col.notNull().unique())
      .addColumn('inferred_goal', 'text')
      .addColumn('strategy', 'text')
      .addColumn('evolution_path', 'text') // JSON array of pivots
      .addColumn('autonomy_level', 'integer')
      .addColumn('status', 'text') // success, abandoned, pivoted
      .addColumn('metadata', 'text') // JSON - used by CognitiveSynthesizer
      .addColumn('updated_at', 'timestamp', (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`),
      )
      .execute()

    // 3. Research Metrics (The Alchemist's Output)
    await this.db.schema
      .createTable(metricsTable)
      .ifNotExists()
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('session_id', 'text', (col) => col.notNull())
      .addColumn('metric_name', 'text', (col) => col.notNull()) // autonomy_gradient, discovery_index, etc.
      .addColumn('value', 'double precision', (col) => col.notNull())
      .addColumn('metadata', 'text') // JSON context
      .addColumn('created_at', 'timestamp', (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`),
      )
      .execute()
  }

  /**
   * Apply a schema suggestion and instantly regenerate types
   */
  async evolve(
    ddl: string,
    options: { name?: string; metadata?: Record<string, any> } = {},
    trxOrDb: any = this.db, // Allow passing transaction
  ): Promise<void> {
    console.log(`[SelfEvolution] Applying structural change: ${ddl}`)

    const runner = async (trx: any) => {
      // 1. Apply the DDL change
      await sql.raw(ddl).execute(trx)

      // 1b. Log for potential rollback
      await trx
        .insertInto(this.snapshotsTable as any)
        .values({
          name: options.name || `auto_evolution_${Date.now()}`,
          dna: await this.getDNA(trx),
          metadata: JSON.stringify({
            ...options.metadata,
            ddl,
            is_auto: true,
            timestamp: Date.now(),
          }),
          created_at: new Date(),
        } as any)
        .execute()
    }

    if (trxOrDb && trxOrDb !== this.db) {
      await runner(trxOrDb)
    } else {
      await this.db.transaction().execute(runner)
    }

    // 2. Regenerate types
    await this.regenerateTypes()

    console.log(`[SelfEvolution] Schema evolved successfully.`)
  }

  /**
   * Regenerate and write types to file if configured.
   */
  async regenerateTypes(): Promise<void> {
    const introspector = this.db.introspection
    const tables = await introspector.getTables()

    const schemaInfo = {
      tables: tables.map((t) => ({
        name: t.name,
        columns: t.columns || [],
        indexes: t.indexes || [],
        foreignKeys: t.foreignKeys || [],
      })),
      relationships: [],
    }

    const generated = this.getTypeGenerator().generateTypes(schemaInfo)

    if (this.config.agentic?.metadata?.typesOutputPath) {
      const outputPath = this.config.agentic.metadata.typesOutputPath
      console.log(`[SelfEvolution] Writing regenerated types to ${outputPath}`)
      await fs.mkdir(path.dirname(outputPath), { recursive: true })
      await fs.writeFile(
        outputPath,
        generated.interfaces + '\n' + generated.types,
      )
    }
  }

  /**
   * Get the current "DNA" (structural overview) of the agent's database
   */
  async getDNA(db: Kysely<any> = this.db): Promise<string> {
    return new SchemaEvolutionHelper(db).getStructuralOverview()
  }

  /**
   * Proactively suggest and apply optimizations based on usage patterns.
   */
  async proactivelyOptimize(context: string): Promise<boolean> {
    const ctx = context.toLowerCase()

    if (ctx.includes('slow') || ctx.includes('latency')) {
      // Suggest index for metrics if they seem slow
      if (ctx.includes('metrics')) {
        await this.evolve(
          'CREATE INDEX IF NOT EXISTS idx_metrics_fast_lookup ON agent_metrics(metric_name, created_at)',
        )
        return true
      }
      // Suggest index for memories if semantic search is mentioned
      if (ctx.includes('search') || ctx.includes('memory')) {
        await this.evolve(
          'CREATE INDEX IF NOT EXISTS idx_memories_session_time ON agent_memories(session_id, created_at)',
        )
        return true
      }
    }

    return false
  }

  /**
   * Get history of evolutions
   */
  async getEvolutionHistory(limit: number = 10): Promise<AgentSnapshot[]> {
    const list = (await this.db
      .selectFrom(this.snapshotsTable as any)
      .selectAll()
      .orderBy('created_at', 'desc')
      .limit(limit)
      .execute()) as unknown as AgentSnapshot[]

    return list.map((s) => ({
      ...s,
      metadata:
        typeof s.metadata === 'string' ? JSON.parse(s.metadata) : s.metadata,
      createdAt: new Date(s.createdAt),
    }))
  }

  /**
   * Rollback the schema to a previous snapshot by attempting to invert the DDL.
   */
  async rollbackToSnapshot(name: string): Promise<void> {
    console.log(`[SelfEvolution] Initiating structural rollback to: ${name}`)

    const snapshot = (await this.db
      .selectFrom(this.snapshotsTable as any)
      .selectAll()
      .where('name', '=', name)
      .executeTakeFirst()) as any

    if (!snapshot) throw new Error(`Snapshot ${name} not found.`)

    const metadata =
      typeof snapshot.metadata === 'string'
        ? JSON.parse(snapshot.metadata)
        : snapshot.metadata || {}

    if (metadata.ddl) {
      const inverse = this.invertDDL(metadata.ddl)
      if (inverse) {
        console.log(`[SelfEvolution] Applying inverse DDL: ${inverse}`)
        await sql.raw(inverse).execute(this.db)
        await this.regenerateTypes()
        console.log(`[SelfEvolution] Rollback successful.`)
      } else {
        throw new Error(`Could not automatically invert DDL: ${metadata.ddl}`)
      }
    } else {
      throw new Error(
        `Snapshot ${name} has no DDL metadata for automated inversion.`,
      )
    }
  }

  private invertDDL(ddl: string): string | null {
    const d = ddl.trim().replace(/\s+/g, ' ')
    const upper = d.toUpperCase()

    // Match patterns like: CREATE TABLE [IF NOT EXISTS] "table_name"
    const createTableMatch = d.match(
      /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?([^\s\()]+)/i,
    )
    if (createTableMatch) {
      return `DROP TABLE IF EXISTS ${createTableMatch[1]}`
    }

    // Match patterns like: CREATE [UNIQUE] INDEX [IF NOT EXISTS] "index_name" ON "table_name"
    const createIndexMatch = d.match(
      /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF NOT EXISTS\s+)?([^\s\(]+)/i,
    )
    if (createIndexMatch) {
      return `DROP INDEX IF EXISTS ${createIndexMatch[1]}`
    }

    // Match patterns like: ALTER TABLE "table_name" ADD [COLUMN] "column_name"
    const addColumnMatch = d.match(
      /ALTER TABLE\s+([^\s]+)\s+ADD\s+(?:COLUMN\s+)?([^\s\(\)]+)\s+([^\s]+)/i,
    )
    if (addColumnMatch) {
      return `ALTER TABLE ${addColumnMatch[1]} DROP COLUMN ${addColumnMatch[2]}`
    }

    // Match patterns like: ALTER TABLE "table_name" DROP [COLUMN] "column_name"
    const dropColumnMatch = d.match(
      /ALTER TABLE\s+([^\s]+)\s+DROP\s+(?:COLUMN\s+)?([^\s\(\)]+)\s+([^\s]+)/i,
    )
    if (dropColumnMatch) {
      // Note: Data is lost, but we can restore the structure
      return `ALTER TABLE ${dropColumnMatch[1]} ADD COLUMN ${dropColumnMatch[2]} TEXT` // Default to TEXT if unknown
    }

    // Match patterns like: DROP TABLE [IF EXISTS] "table_name"
    const dropTableMatch = d.match(/DROP TABLE\s+(?:IF EXISTS\s+)?([^\s]+)/i)
    if (dropTableMatch) {
      return `CREATE TABLE ${dropTableMatch[1]} (id INTEGER PRIMARY KEY)` // Minimal recreation
    }

    // Match patterns like: DROP INDEX [IF EXISTS] "index_name"
    const dropIndexMatch = d.match(/DROP INDEX\s+(?:IF EXISTS\s+)?([^\s]+)/i)
    if (dropIndexMatch) {
      return `-- Cannot automatically invert DROP INDEX ${dropIndexMatch[1]} without knowing its definition`
    }

    return null
  }

  /**
   * Autonomous NPM Publication: Bumps version and publishes the engine.
   * This is only called when the agent determines it has reached a stable evolutionary milestone.
   */
  async publishToNPM(
    type: 'patch' | 'minor' | 'major' = 'patch',
  ): Promise<void> {
    console.log(
      `[SelfEvolution] Initiating sovereign NPM publication (${type})...`,
    )

    try {
      // 1. Execute version bump (triggers postversion hook in package.json)
      const { execSync } = await import('child_process')
      execSync(`npm version ${type} --no-git-tag-version`, { stdio: 'inherit' })

      // 2. Refresh local types if needed (safety check)
      await this.regenerateTypes()

      console.log(`[SelfEvolution] Sovereign publication sequence completed.`)
    } catch (e) {
      console.error(`[SelfEvolution] Failed to publish to NPM:`, e)
      throw new Error(`NPM Publication Failed: ${String(e)}`)
    }
  }
}
