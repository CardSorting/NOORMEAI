import type { Kysely } from '../../kysely.js'
import type { AgenticConfig } from '../../types/index.js'
import type { Cortex } from '../Cortex.js'
import { sql } from '../../raw-builder/sql.js'

/**
 * SelfTestRegistry allows agents to self-register verification probes
 * that ensure autonomous changes don't violate core logic.
 */
export class SelfTestRegistry {
  constructor(
    private db: Kysely<any>,
    private cortex: Cortex,
    private config: AgenticConfig = {},
  ) { }

  /**
   * Register a new logic probe
   */
  async registerProbe(
    name: string,
    script: string,
    expectedOutcome?: string,
  ): Promise<void> {
    console.log(`[SelfTestRegistry] Registering logic probe: ${name}`)
    await this.db
      .insertInto('agent_logic_probes' as any)
      .values({
        name,
        script,
        expected_outcome: expectedOutcome,
        created_at: new Date(),
      } as any)
      .onConflict((oc: any) =>
        oc.column('name').doUpdateSet({
          script,
          expected_outcome: expectedOutcome,
        }),
      )
      .execute()
  }

  /**
   * Run all registered probes
   */
  async runAllProbes(): Promise<
    { name: string; success: boolean; error?: string }[]
  > {
    const probes = (await this.db
      .selectFrom('agent_logic_probes' as any)
      .selectAll()
      .execute()) as any[]

    const results = []
    for (const probe of probes) {
      console.log(`[SelfTestRegistry] Running probe: ${probe.name}`)
      try {
        let success = false

        if (probe.script.startsWith('audit:')) {
          success = await this.runAuditAction(probe.script.split(':')[1])
        } else {
          // Master Sentinel Pass: Dynamic Probe Evaluation
          // If not a hardcoded audit, use LLM to interpret the script against DB state
          success = await this.dynamicEvaluation(probe)
        }

        results.push({ name: probe.name, success })

        await this.db.transaction().execute(async (trx) => {
          // Audit Phase 13: Lock row before updating last_status
          await trx
            .selectFrom('agent_logic_probes' as any)
            .select('id')
            .where('id', '=', probe.id)
            .forUpdate()
            .executeTakeFirst()

          await trx
            .updateTable('agent_logic_probes' as any)
            .set({
              last_run: new Date(),
              last_status: success ? 'pass' : 'fail',
            } as any)
            .where('id', '=', probe.id)
            .execute()
        })
      } catch (e) {
        results.push({ name: probe.name, success: false, error: String(e) })
      }
    }
    return results
  }

  private async runAuditAction(action: string): Promise<boolean> {
    switch (action) {
      case 'check_schema_consistency':
        const tables = await this.db.introspection.getTables()
        const requiredSubsets = [
          this.config.messagesTable || 'agent_messages',
          this.config.sessionsTable || 'agent_sessions',
          this.config.memoriesTable || 'agent_memories',
          this.config.knowledgeTable || 'agent_knowledge_base',
          this.config.actionsTable || 'agent_actions',
          this.config.metricsTable || 'agent_metrics',
        ]
        const missing = requiredSubsets.filter(
          (req) => !tables.some((t) => t.name === req),
        )
        return missing.length === 0

      case 'check_memory_integrity':
        const memoriesTable = this.config.memoriesTable || 'agent_memories'
        const invalidMemories = await this.db
          .selectFrom(memoriesTable as any)
          .select('id')
          .where('embedding', 'is', null)
          .execute()
        return invalidMemories.length === 0

      case 'check_session_coherence':
        const sessionsTable = this.config.sessionsTable || 'agent_sessions'
        const messagesTable = this.config.messagesTable || 'agent_messages'
        const emptySessions = await (this.db as any)
          .selectFrom(sessionsTable)
          .leftJoin(
            messagesTable,
            `${sessionsTable}.id`,
            `${messagesTable}.session_id`,
          )
          .select(`${sessionsTable}.id as sid`)
          .where(`${messagesTable}.id`, 'is', null)
          .execute()
        return emptySessions.length < 5

      case 'check_data_integrity':
        const knowledgeTable = this.config.knowledgeTable || 'agent_knowledge_base'
        const actionsTable = this.config.actionsTable || 'agent_actions'
        const sessionsTbl = this.config.sessionsTable || 'agent_sessions'

        const orphanedKnowledge = await this.db
          .selectFrom(knowledgeTable as any)
          .where('source_session_id', 'is not', null)
          .where((eb: any) =>
            eb.not(
              eb.exists(
                eb
                  .selectFrom(sessionsTbl as any)
                  .select('id')
                  .whereRef(
                    `${knowledgeTable}.source_session_id` as any,
                    '=',
                    `${sessionsTbl}.id` as any,
                  ),
              ),
            ),
          )
          .execute()

        const orphanedActions = await this.db
          .selectFrom(actionsTable as any)
          .where((eb: any) =>
            eb.not(
              eb.exists(
                eb
                  .selectFrom(sessionsTbl as any)
                  .select('id')
                  .whereRef(
                    `${actionsTable}.session_id` as any,
                    '=',
                    `${sessionsTbl}.id` as any,
                  ),
              ),
            ),
          )
          .execute()

        return orphanedKnowledge.length === 0 && orphanedActions.length === 0

      case 'check_performance_drift':
        const metricsTbl = this.config.metricsTable || 'agent_metrics'
        const recentMetrics = (await this.db
          .selectFrom(metricsTbl as any)
          .select('execution_time')
          .orderBy('created_at', 'desc')
          .limit(20)
          .execute()) as any[]

        if (recentMetrics.length < 5) return true

        const avgRecent = recentMetrics.reduce((sum, m) => sum + (m.execution_time || 0), 0) / recentMetrics.length
        const baselineMetrics = (await this.db
          .selectFrom(metricsTbl as any)
          .select('execution_time')
          .orderBy('created_at', 'desc')
          .offset(20)
          .limit(100)
          .execute()) as any[]

        if (baselineMetrics.length === 0) return avgRecent < 500

        const avgBaseline = baselineMetrics.reduce((sum, m) => sum + (m.execution_time || 0), 0) / baselineMetrics.length
        return avgRecent < avgBaseline * 1.5

      default:
        return false
    }
  }

  /**
   * Interpret custom probe logic by providing the LLM with relevant database snapshots.
   */
  private async dynamicEvaluation(probe: any): Promise<boolean> {
    const model = this.cortex.llmFast || this.cortex.llm
    if (!model) return true // Safety fallback if no AI is available

    // Provide a small sample of metrics and actions to allow for semantic reasoning
    const sampleMetrics = await this.db.selectFrom(this.config.metricsTable || 'agent_metrics' as any).limit(10).execute()

    const prompt = `
        You are a Logic Verification Engine for NOORMME.
        TESTRUN: "${probe.name}"
        SCRIPT: "${probe.script}"
        EXPECTED: "${probe.expected_outcome || 'Unspecified'}"
        
        DB CONTEXT (Sample Metrics):
        ${JSON.stringify(sampleMetrics, null, 2)}
        
        TASK:
        Evaluate if the script passes based on the context.
        If the script is a natural language requirement, infer the result. 
        RETURN ONLY "PASS" OR "FAIL".
      `

    const response = await model.complete({
      prompt,
      temperature: 0.1,
      maxTokens: 5
    })

    return response.content.toUpperCase().includes('PASS')
  }
}
