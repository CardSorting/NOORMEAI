import type { Kysely } from '../../kysely.js'
import type {
  AgenticConfig,
  AgentAction,
  CognitiveRule,
} from '../../types/index.js'
import type { Cortex } from '../Cortex.js'

/**
 * ActionRefiner analyzes the ActionJournal to find patterns in failures
 * and suggests new CognitiveRules to improve agent performance.
 */
export class ActionRefiner {
  private actionsTable: string

  constructor(
    private db: Kysely<any>,
    private cortex: Cortex,
    private config: AgenticConfig = {},
  ) {
    this.actionsTable = config.actionsTable || 'agent_actions'
  }

  /**
   * Analyze recent actions and propose improvements
   */
  async refineActions(trxOrDb: any = this.db): Promise<string[]> {
    const recommendations: string[] = []

    // 1. Find tools with high failure rates (Last 24h Window)
    // Audit Phase 14: Sliding window to prevent global table scans
    const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const failureStats = (await trxOrDb
      .selectFrom(this.actionsTable as any)
      .select('tool_name')
      .select((eb: any) => eb.fn.count('id').as('total'))
      .select((eb: any) =>
        eb.fn
          .sum(eb.case().when('status', '=', 'failure').then(1).else(0).end())
          .as('failures'),
      )
      .where('created_at', '>', windowStart)
      .groupBy('tool_name')
      .execute()) as any[]

    const failureRateThreshold = (this.config as any).refiner?.failureRateThreshold || 0.3
    const minActionBatch = (this.config as any).refiner?.minActionBatch || 3

    for (const stat of failureStats) {
      const failures = Number(stat.failures || 0)
      const total = Number(stat.total || 1)
      const rate = failures / total

      if (rate > failureRateThreshold && total > minActionBatch) {
        recommendations.push(
          `Tool '${stat.tool_name}' has a ${Math.round(rate * 100)}% failure rate. Suggesting automatic reflection rule.`,
        )

        // Automatically propose a rule to reflect on this tool's usage
        await this.proposeReflectionRule(stat.tool_name as string, trxOrDb)
      }
    }

    // 2. Discover missing capabilities based on error patterns (Last 24h)
    const missingCapabilities = (await trxOrDb
      .selectFrom(this.actionsTable as any)
      .select('tool_name')
      .where('status', '=', 'failure')
      .where('created_at', '>', windowStart)
      .where((eb: any) =>
        eb.or([
          eb('error', 'like', '%permission denied%'),
          eb('error', 'like', '%unknown tool%'),
          eb('error', 'like', '%missing capability%'),
          eb('error', 'like', '%not authorized%'),
        ]),
      )
      .groupBy('tool_name')
      .execute()) as any[]

    for (const row of missingCapabilities) {
      recommendations.push(
        `Detected repeated access/existence failures for tool '${row.tool_name}'. Proposing capability expansion.`,
      )
      await this.proposeCapabilityUpdate(row.tool_name as string, trxOrDb)
    }

    return recommendations
  }

  /**
   * Propose a rule to reflect on a specific tool usage
   */
  private async proposeReflectionRule(toolName: string, trxOrDb: any = this.db): Promise<void> {
    // Audit Phase 19: Atomic rule proposal via transaction + existence check
    const runner = async (trx: any) => {
      const rulesTable = (this.cortex.config as any).rulesTable || 'agent_rules'

      let query = trx
        .selectFrom(rulesTable as any)
        .select('id')
        .where('table_name' as any, '=', 'agent_actions')
        .where('operation' as any, '=', 'insert')
        .where('metadata', 'like', `%\"targetTool\":\"${toolName}\"%`)

      const executor = trx.getExecutor()
      const adapterName = executor?.adapter?.constructor?.name || executor?.dialect?.constructor?.name || ''
      if (!adapterName.toLowerCase().includes('sqlite')) {
        query = query.forUpdate()
      }

      const existing = await query.executeTakeFirst()

      if (!existing) {
        console.log(
          `[ActionRefiner] Proposing reflection rule for tool: ${toolName}`,
        )
        await this.cortex.rules.defineRule('agent_actions', 'insert', 'audit', {
          metadata: {
            targetTool: toolName,
            reason: 'High failure rate detected by ActionRefiner',
          },
        }, trx) // Pass transaction object
      }
    }

    if (trxOrDb && trxOrDb !== this.db) {
      await runner(trxOrDb)
    } else {
      await this.db.transaction().execute((trx) => runner(trx))
    }
  }

  /**
   * Propose an update to capabilities
   */
  private async proposeCapabilityUpdate(toolName: string, trxOrDb: any = this.db): Promise<void> {
    console.log(
      `[ActionRefiner] Proposing capability expansion for tool: ${toolName}`,
    )

    await this.cortex.reflections.reflect(
      'system' as any,
      'failure',
      `Architectural Gap: Missing Capability for '${toolName}'`,
      [
        `Identified repeated failures using tool '${toolName}'.`,
        `Resolution: Inspect permission sets and ensure the tool is correctly registered in the CapabilityManager.`,
      ],
      undefined,
      trxOrDb
    )
  }
}
