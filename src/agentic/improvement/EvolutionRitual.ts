import type { Kysely } from '../../kysely.js'
import type { AgenticConfig } from '../../types/index.js'
import type { Cortex } from '../Cortex.js'

/**
 * EvolutionRitual orchestrates the "Skill Growth" background task.
 * It combines synthesis, domain synching, and global broadcasting
 * into a single high-throughput maintenance cycle.
 */
export class EvolutionRitual {
  constructor(
    private db: Kysely<any>,
    private cortex: Cortex,
    private config: AgenticConfig = {},
  ) {}

  /**
   * Execute the full evolution sequence
   */
  async execute(): Promise<{
    synthesized: number
    broadcasted: number
    domainsSynced: string[]
  }> {
    console.log(
      '[EvolutionRitual] Initiating seamless skill growth sequence...',
    )

    const results = {
      synthesized: 0,
      broadcasted: 0,
      domainsSynced: [] as string[],
    }

    // 1. Parallel Synthesis: Identify and bridge capability gaps
    const newSkills = await this.cortex.skillSynthesizer.discoverAndSynthesize()
    results.synthesized = newSkills.length

    // 2. High-Throughput Broadcasting: Propagate verified mutations globally
    const broadcastedCount = await this.cortex.hive.broadcastSkills()
    results.broadcasted = broadcastedCount

    // 3. Domain Synchronization: Identify "mastery" domains and boost global confidence
    const activeDomains = await this.identifyActiveDomains()
    for (const domain of activeDomains) {
      // High Throughput Pass 5: Wholesale Domain Mastery
      const isMature = await this.checkDomainMaturity(domain)
      if (isMature) {
        console.log(
          `[EvolutionRitual] Domain '${domain}' is MATURE. Applying wholesale stability boost.`,
        )
        await this.cortex.hive.syncDomain(domain, 0.15) // Higher boost for mastery
      } else {
        await this.cortex.hive.syncDomain(domain, 0.05) // Standard boost
      }
      results.domainsSynced.push(domain)
    }

    console.log(
      `[EvolutionRitual] Completed: ${results.synthesized} synthesized, ${results.broadcasted} broadcasted, ${results.domainsSynced.length} domains boosted.`,
    )

    return results
  }

  private async checkDomainMaturity(domain: string): Promise<boolean> {
    const skills = (await this.db
      .selectFrom(
        this.config.capabilitiesTable || ('agent_capabilities' as any),
      )
      .select(['reliability'])
      .where('name', 'like', `${domain}%`)
      .execute()) as any[]

    if (skills.length < 3) return false // Need a minimum population for maturity

    const avgReliability =
      skills.reduce((sum, s) => sum + s.reliability, 0) / skills.length
    return avgReliability >= 0.95
  }

  private async identifyActiveDomains(): Promise<string[]> {
    // Production Hardening: Entropy-Based Discovery
    // Find domains that are currently "hot" (high density of recent knowledge)
    // This represents areas where the agent is learning fast and needs stabilization.
    const result = await this.db
      .selectFrom(this.config.knowledgeTable || ('agent_knowledge_base' as any))
      .select(['tags', 'confidence'])
      .where('updated_at', '>', new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24h
      .execute()

    const domainScores = new Map<string, number>()
    for (const row of result) {
      const tags =
        typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags || []
      for (const t of tags) {
        if (t === 'hive_mind') continue
        // Score based on confidence density: a mix of volume and high-quality signals
        const current = domainScores.get(t) || 0
        domainScores.set(t, current + (row.confidence || 0))
      }
    }

    // Sort by total confidence density (Entropy/Activity proxy)
    // Production Hardening: Only boost domains with significant activity (Threshold: 1.0)
    return Array.from(domainScores.entries())
      .filter(([_, score]) => score >= 1.0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag)
  }
}
