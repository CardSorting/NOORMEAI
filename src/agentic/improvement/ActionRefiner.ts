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
  async refineActions(): Promise<string[]> {
    const recommendations: string[] = []

    // 1. Find tools with high failure rates
    const failureStats = (await this.db
      .selectFrom(this.actionsTable as any)
      .select('tool_name')
      .select((eb: any) => eb.fn.count('id').as('total'))
      .select((eb: any) =>
        eb.fn
          .sum(eb.case().when('status', '=', 'failure').then(1).else(0).end())
          .as('failures'),
      )
      .groupBy('tool_name')
      .execute()) as any[]

    for (const stat of failureStats) {
      const failures = Number(stat.failures || 0)
      const total = Number(stat.total || 1)
      const rate = failures / total

      if (rate > 0.3 && total > 3) {
        recommendations.push(
          `Tool '${stat.tool_name}' has a ${Math.round(rate * 100)}% failure rate. Suggesting automatic reflection rule.`,
        )

        // Automatically propose a rule to reflect on this tool's usage
        await this.proposeReflectionRule(stat.tool_name as string)
      }
    }

    // 2. Discover missing capabilities based on error patterns
    const missingCapabilities = (await this.db
      .selectFrom(this.actionsTable as any)
      .select('tool_name')
      .where('status', '=', 'failure')
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
      await this.proposeCapabilityUpdate(row.tool_name as string)
    }

    return recommendations
  }

  /**
   * Propose a rule to reflect on a specific tool usage
   */
  private async proposeReflectionRule(toolName: string): Promise<void> {
    const existing = await this.cortex.rules.getActiveRules(
      'agent_actions',
      'insert',
    )
    const hasRule = existing.some((r) => r.metadata?.targetTool === toolName)

    if (!hasRule) {
      console.log(
        `[ActionRefiner] Proposing reflection rule for tool: ${toolName}`,
      )
      await this.cortex.rules.defineRule('agent_actions', 'insert', 'audit', {
        metadata: {
          targetTool: toolName,
          reason: 'High failure rate detected by ActionRefiner',
        },
      })
    }
  }

  /**
   * Propose an update to capabilities
   */
  private async proposeCapabilityUpdate(toolName: string): Promise<void> {
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
    )
  }
}
