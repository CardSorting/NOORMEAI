import type { Kysely } from '../../kysely.js'
import type {
    AgenticConfig,
    EmergentSkillConfig,
    AgentCapability,
    SkillSynthesisStrategy,
    SynthesisContext
} from '../../types/index.js'
import type { Cortex } from '../Cortex.js'

/**
 * Production-grade AI Synthesis Strategy.
 * Designed to wrap an LLM provider with retries, validation, and token tracking.
 */
class AISynthesisStrategy implements SkillSynthesisStrategy {
    name = 'AISynthesisEngine'

    constructor(private cortex: Cortex, private synthesizer: SkillSynthesizer) { }

    async synthesize(context: SynthesisContext) {
        let attempts = 0
        const maxRetries = 3

        while (attempts < maxRetries) {
            try {
                // Perform real synthesis using the LLM Provider
                const prompt = this.buildMutationPrompt(context)

                if (!this.cortex.llm) {
                    console.warn(`[SkillSynthesizer] No LLMProvider available in Cortex. Falling back to passive evolution.`)
                    return {
                        mutatedDescription: context.existingDescription || 'Unmodified skill (Synthesis skipped: No LLM)',
                        mutatedMetadata: { synthesis_status: 'skipped_no_llm' },
                        version: `1.0.${Date.now()}`
                    }
                }

                const response = await this.cortex.llm.complete({
                    prompt,
                    responseFormat: 'json',
                    temperature: 0.3
                })

                // Track usage
                if (response.usage) {
                    this.synthesizer.totalTokensConsumed += response.usage.totalTokens
                }

                try {
                    const parsed = JSON.parse(response.content)
                    return {
                        mutatedDescription: parsed.description || context.existingDescription,
                        mutatedMetadata: {
                            ...parsed.metadata,
                            synthesis_engine: 'Production-LLM',
                            failure_context_size: context.failures.length
                        },
                        version: `1.0.${Date.now()}`
                    }
                } catch (err) {
                    console.error(`[SkillSynthesizer] LLM returned invalid JSON for mutation:`, response.content)
                    throw new Error('Synthesis parse failure')
                }
            } catch (error) {
                attempts++
                console.warn(`[AISynthesisStrategy] Attempt ${attempts} failed: ${error}. Retrying...`)
                if (attempts >= maxRetries) throw error
                await new Promise(resolve => setTimeout(resolve, 1000 * attempts))
            }
        }
        throw new Error('Synthesis failed after maximum retries')
    }

    private buildMutationPrompt(context: SynthesisContext): string {
        const failureList = context.failures.map((f, i) =>
            `${i + 1}. Args: ${JSON.stringify(f.arguments)}, Error: ${f.error || 'None'}, Outcome: ${f.outcome || 'None'}`
        ).join('\n')

        return `
            You are a Meta-Evolutionary AI Engine optimizing a tool: "${context.targetTool}".
            
            EXISTING DESCRIPTION:
            "${context.existingDescription || 'None'}"

            RECENT FAILURES:
            ${failureList}

            TASK:
            Analyze the failure patterns and rewrite the tool description/metadata to better handle these edge cases. 
            Provide the response as a valid JSON object:
            {
              "description": "Updated tool description that prevents these specific failures",
              "metadata": {
                "fixed_edge_cases": ["description of fix 1", "..."],
                "reasoning": "brief explanation of mutation"
              }
            }
        `
    }
}

/**
 * SkillSynthesizer continuously analyzes session history to detect
 * inefficiencies, repeat failures, and latent opportunities.
 * It synthesizes novel "sandbox" capabilities when it finds gaps.
 */
export class SkillSynthesizer {
    private evolutionConfig: EmergentSkillConfig
    private actionsTable: string
    private strategy: AISynthesisStrategy
    public totalTokensConsumed: number = 0

    constructor(
        private db: Kysely<any>,
        private cortex: Cortex,
        private config: AgenticConfig = {}
    ) {
        this.evolutionConfig = config.evolution || {
            verificationWindow: 20,
            rollbackThresholdZ: 2.5,
            enableHiveLink: true,
            mutationAggressiveness: 0.5,
            maxSandboxSkills: 5
        }

        this.actionsTable = config.actionsTable || 'agent_actions'
        this.strategy = new AISynthesisStrategy(this.cortex, this)
    }

    /**
     * Scan recent histories for repeating failures across specific tools.
     * Generates a new "mutated" skill and places it in the sandbox.
     */
    async discoverAndSynthesize(): Promise<AgentCapability[]> {
        console.log('[SkillSynthesizer] Analyzing telemetry for parallel capability gaps...')

        // 1. Detect multiple Failure Clusters (One-pass grouping)
        const recentFailures = await this.db
            .selectFrom(this.actionsTable as any)
            .select(['tool_name', 'arguments', 'outcome', 'metadata', 'created_at'])
            .where('status', '=', 'failure')
            .orderBy('created_at', 'desc')
            .limit(100)
            .execute()

        if (recentFailures.length < 3) return []

        const failureClusters = new Map<string, any[]>()
        for (const f of recentFailures) {
            const name = (f as any).tool_name
            if (!failureClusters.has(name)) failureClusters.set(name, [])
            failureClusters.get(name)!.push(f)
        }

        const targets: { tool: string, failures: any[] }[] = []
        for (const [name, list] of failureClusters.entries()) {
            if (list.length >= 3) {
                targets.push({ tool: name, failures: list })
            }
        }

        if (targets.length === 0) return []

        // 2. Check capacity
        const experimentalCount = await this.getExperimentalSkillCount()
        const maxNew = Math.max(0, (this.evolutionConfig.maxSandboxSkills || 5) - experimentalCount)
        const toProcess = targets.slice(0, maxNew)

        if (toProcess.length === 0) {
            console.log('[SkillSynthesizer] Capacity reached. Skipping parallel synthesis.')
            return []
        }

        console.log(`[SkillSynthesizer] Parallel Synthesis: Generating ${toProcess.length} novel mutations...`)

        // 3. Parallel Execution
        const results = await Promise.all(toProcess.map(async ({ tool, failures }) => {
            const context: SynthesisContext = {
                targetTool: tool,
                failures: failures.map(f => ({
                    arguments: typeof f.arguments === 'string' ? JSON.parse(f.arguments) : f.arguments,
                    error: f.outcome,
                    timestamp: new Date(f.created_at)
                })),
                evolutionConfig: this.evolutionConfig
            }

            try {
                const synthesis = await this.strategy.synthesize(context)

                // Fetch the existing capability to get its current description if not in context
                const existing = await this.db
                    .selectFrom(this.cortex.agenticConfig.capabilitiesTable || 'agent_capabilities' as any)
                    .selectAll()
                    .where('name', '=', tool)
                    .orderBy('created_at', 'desc')
                    .executeTakeFirst() as any

                return await this.cortex.capabilities.registerCapability(
                    tool,
                    synthesis.version,
                    synthesis.mutatedDescription,
                    {
                        initialStatus: 'experimental',
                        mutatedFrom: tool,
                        synthesis_engine: 'Production-LLM',
                        ...synthesis.mutatedMetadata
                    }
                )
            } catch (err) {
                console.error(`[SkillSynthesizer] Synthesis failed for ${tool}:`, err)
                return null
            }
        }))

        return results.filter((r): r is AgentCapability => r !== null)
    }

    private async getExperimentalSkillCount(): Promise<number> {
        const skills = await this.cortex.capabilities.getCapabilities('experimental')
        return skills.length
    }
}
