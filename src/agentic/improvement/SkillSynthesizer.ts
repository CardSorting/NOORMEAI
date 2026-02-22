import type { Kysely } from '../../kysely.js'
import type {
  AgenticConfig,
  EmergentSkillConfig,
  AgentCapability,
  SkillSynthesisStrategy,
  SynthesisContext,
} from '../../types/index.js'
import type { Cortex } from '../Cortex.js'

/**
 * High-Throughput Tiered AI Synthesis Strategy.
 * Orchestrates multiple model tiers for cost-effective ultra-scale evolution.
 */
class AISynthesisStrategy implements SkillSynthesisStrategy {
  name = 'AISynthesisEngine'

  constructor(
    private cortex: Cortex,
    private synthesizer: SkillSynthesizer,
  ) {}

  async synthesize(context: SynthesisContext) {
    let attempts = 0
    const maxRetries = 3

    // Pass 6: Ultra-Scale Tiered Routing
    // Use premium model for individual mutations if available
    const model = this.cortex.llmPremium || this.cortex.llm

    while (attempts < maxRetries) {
      try {
        const prompt = this.buildMutationPrompt(context)

        if (!model) {
          console.warn(
            `[SkillSynthesizer] No LLMProvider available. Skipping synthesis.`,
          )
          return {
            mutatedDescription:
              context.existingDescription ||
              'Unmodified skill (Synthesis skipped: No LLM)',
            mutatedMetadata: { synthesis_status: 'skipped_no_llm' },
            version: `1.0.${Date.now()}`,
          }
        }

        const response = await model.complete({
          prompt,
          responseFormat: 'json',
          temperature: 0.3,
        })

        if (response.usage) {
          this.synthesizer.totalTokensConsumed += response.usage.totalTokens
        }

        try {
          const parsed = JSON.parse(response.content)
          return {
            mutatedDescription:
              parsed.description || context.existingDescription,
            mutatedMetadata: {
              ...parsed.metadata,
              synthesis_engine: this.cortex.llmPremium
                ? 'Tiered-Premium'
                : 'Production-LLM',
              failure_context_size: context.failures.length,
            },
            version: `1.0.${Date.now()}`,
          }
        } catch (err) {
          throw new Error('Synthesis parse failure')
        }
      } catch (error) {
        attempts++
        if (attempts >= maxRetries) throw error
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempts))
      }
    }
    throw new Error('Synthesis failed after maximum retries')
  }

  /**
   * Batch Synthesis using FAST model (Pass 6)
   */
  async synthesizeBatch(
    contexts: SynthesisContext[],
  ): Promise<{ tool: string; mutation: any }[]> {
    const model = this.cortex.llmFast || this.cortex.llm
    if (!model) return []

    const batchPrompt = `
            You are a Meta-Evolutionary AI Engine optimizing multiple tools in parallel.
            
            TOOLS TO MUTATE:
            ${contexts
              .map(
                (ctx, i) => `
                [Tool ${i + 1}: ${ctx.targetTool}]
                Current Description: ${ctx.existingDescription || 'None'}
                Failure Patterns:
                ${ctx.failures.map((f) => `- Args: ${JSON.stringify(f.arguments)}, Error: ${f.error}`).join('\n')}
            `,
              )
              .join('\n')}

            TASK:
            For each tool, provide a mutation as a JSON array of objects:
            [
              {
                "tool": "tool_name",
                "description": "Updated tool description",
                "metadata": { "fixed_edge_cases": [...], "reasoning": "..." }
              },
              ...
            ]
        `

    const response = await model.complete({
      prompt: batchPrompt,
      responseFormat: 'json',
      temperature: 0.2,
    })

    if (response.usage) {
      this.synthesizer.totalTokensConsumed += response.usage.totalTokens
    }

    try {
      const parsed = JSON.parse(response.content) as any[]
      return parsed.map((item) => ({
        tool: item.tool,
        mutation: {
          mutatedDescription: item.description,
          mutatedMetadata: item.metadata,
          version: `1.0.${Date.now()}`,
        },
      }))
    } catch (err) {
      return []
    }
  }

  private buildMutationPrompt(context: SynthesisContext): string {
    const failureList = context.failures
      .map(
        (f, i) =>
          `${i + 1}. Args: ${JSON.stringify(f.arguments)}, Error: ${f.error || 'None'}`,
      )
      .join('\n')

    return `
            You are a Meta-Evolutionary AI Engine optimizing a tool: "${context.targetTool}".
            Analyze FAILURES and rewrite the description to prevent them.
            
            EXISTING: "${context.existingDescription || 'None'}"
            FAILURES:
            ${failureList}

            RETURN JSON: { "description": "...", "metadata": { "fixed": [...], "reason": "..." } }
        `
  }
}

/**
 * SkillSynthesizer implements Pass 6 Ultra-Scale Orchestration.
 */
export class SkillSynthesizer {
  private evolutionConfig: EmergentSkillConfig
  private actionsTable: string
  public strategy: AISynthesisStrategy
  public totalTokensConsumed: number = 0

  constructor(
    private db: Kysely<any>,
    private cortex: Cortex,
    private config: AgenticConfig = {},
  ) {
    this.evolutionConfig = config.evolution || {
      verificationWindow: 20,
      rollbackThresholdZ: 2.5,
      enableHiveLink: true,
      mutationAggressiveness: 0.5,
      maxSandboxSkills: 5,
    }

    this.actionsTable = config.actionsTable || 'agent_actions'
    this.strategy = new AISynthesisStrategy(this.cortex, this)
  }

  /**
   * Pass 6: Predictive Pre-warming Hook
   * Called by CapabilityManager when an experimental skill nears promotion.
   */
  async preWarmSkill(name: string): Promise<void> {
    const capability =
      await this.cortex.capabilities.getCapabilities('experimental')
    const target = capability.find((c) => c.name === name)

    if (!target) return

    // Synthesis pre-run to ensure 'Verified' description is optimized before status change
    const mutation = await this.strategy.synthesize({
      targetTool: target.name,
      failures: [], // No recent failures, just optimizing for permanence
      existingDescription: target.description,
      evolutionConfig: this.evolutionConfig,
    })

    await this.db
      .updateTable(
        this.cortex.agenticConfig.capabilitiesTable ||
          ('agent_capabilities' as any),
      )
      .set({
        description: mutation.mutatedDescription,
        metadata: JSON.stringify({
          ...target.metadata,
          pre_warmed: true,
          pre_warmed_at: new Date(),
        }),
        updated_at: new Date(),
      } as any)
      .where('name', '=', name)
      .execute()
  }

  async discoverAndSynthesize(): Promise<AgentCapability[]> {
    console.log(
      '[SkillSynthesizer] Analyzing telemetry for parallel gaps (Ultra-Scale Batch)...',
    )

    const recentFailures = await this.db
      .selectFrom(this.actionsTable as any)
      .select(['tool_name', 'arguments', 'outcome', 'metadata', 'created_at'])
      .where('status', '=', 'failure')
      .orderBy('created_at', 'desc')
      .limit(200)
      .execute()

    if (recentFailures.length < 3) return []

    const failureClusters = new Map<string, any[]>()
    for (const f of recentFailures) {
      const name = (f as any).tool_name
      if (!failureClusters.has(name)) failureClusters.set(name, [])
      failureClusters.get(name)!.push(f)
    }

    const targets: { tool: string; failures: any[] }[] = []
    for (const [name, list] of failureClusters.entries()) {
      if (list.length >= 3) targets.push({ tool: name, failures: list })
    }

    if (targets.length === 0) return []

    const domainBatches = new Map<string, typeof targets>()
    for (const target of targets) {
      const domain = target.tool.split('_')[0] || 'general'
      if (!domainBatches.has(domain)) domainBatches.set(domain, [])
      domainBatches.get(domain)!.push(target)
    }

    await this.pruneSandboxIfNeeded()

    const results: AgentCapability[] = []

    for (const [domain, items] of domainBatches.entries()) {
      const contexts: SynthesisContext[] = await Promise.all(
        items.map(async (item) => {
          return {
            targetTool: item.tool,
            failures: item.failures.map((f) => ({
              arguments:
                typeof f.arguments === 'string'
                  ? JSON.parse(f.arguments)
                  : f.arguments,
              error: f.outcome,
              timestamp: new Date(f.created_at),
            })),
            evolutionConfig: this.evolutionConfig,
          }
        }),
      )

      if (items.length > 1 && (this.cortex.llmFast || this.cortex.llm)) {
        const batchMutations = await this.strategy.synthesizeBatch(contexts)
        for (const bm of batchMutations) {
          const reg = await this.registerMutation(bm.tool, bm.mutation)
          if (reg) results.push(reg)
        }
      } else {
        for (const ctx of contexts) {
          const mutation = await this.strategy.synthesize(ctx)
          const reg = await this.registerMutation(ctx.targetTool, mutation)
          if (reg) results.push(reg)
        }
      }
    }

    return results
  }

  private async registerMutation(
    tool: string,
    mutation: any,
  ): Promise<AgentCapability | null> {
    return await this.cortex.capabilities.registerCapability(
      tool,
      mutation.version,
      mutation.mutatedDescription,
      {
        initialStatus: 'experimental',
        mutatedFrom: tool,
        synthesis_engine: 'Ultra-Scale-Tiered',
        ...mutation.mutatedMetadata,
        synthesized_at: new Date(),
      },
    )
  }

  private async pruneSandboxIfNeeded(): Promise<void> {
    const experimental =
      await this.cortex.capabilities.getCapabilities('experimental')
    const maxSkills = this.evolutionConfig.maxSandboxSkills || 5
    if (experimental.length >= maxSkills) {
      const toPrune = experimental
        .sort((a, b) => a.reliability - b.reliability)
        .slice(0, Math.ceil(experimental.length * 0.2))
      for (const skill of toPrune) {
        await this.db
          .deleteFrom(
            this.cortex.agenticConfig.capabilitiesTable ||
              ('agent_capabilities' as any),
          )
          .where('id', '=', (skill as any).id)
          .execute()
      }
    }
  }
}
