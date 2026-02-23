import type { Kysely } from '../../kysely.js'
import type {
  AgenticConfig,
  AgentMetric,
  AgentReflection,
} from '../../types/index.js'
import type { Cortex } from '../Cortex.js'
import { sql } from '../../raw-builder/sql.js'

/**
 * EvolutionaryPilot orchestrates the continuous self-improvement loop:
 * Observe (Metrics) -> Reflect -> Evolve -> Verify.
 */
export class EvolutionaryPilot {
  constructor(
    private db: Kysely<any>,
    private cortex: Cortex,
    private config: AgenticConfig = {},
  ) { }

  /**
   * Run a self-improvement cycle based on dynamic baselining
   */
  async runSelfImprovementCycle(): Promise<{
    evolved: boolean
    changes: string[]
  }> {
    console.log(
      '[EvolutionaryPilot] Initiating self-improvement cycle with full-spectrum baselining...',
    )

    const changes: string[] = []
    let evolved = false

    // 1. Full-Spectrum Observation
    const metrics = [
      'query_latency',
      'success_rate',
      'total_cost',
      'trust_signal',
    ]
    const samplingCount = (this.config as any).evolution?.samplingCount || 100
    const recentMetrics = await this.cortex.metrics.getRecentMetrics(samplingCount)

    for (const metricName of metrics) {
      const values = recentMetrics
        .filter((m) => m.metricName === metricName)
        .map((m) => Number(m.metricValue))

      if (values.length < 5) continue

      const stats = this.calculateZScore(values)
      const minSamples = (this.config as any).evolution?.minSamples || 5

      if (values.length < minSamples) continue

      const policies = await this.cortex.policies.getActivePolicies()
      const latencyZ = policies.find(p => p.name === 'latency_drift_z')?.definition?.threshold || 2.0
      const latencyMean = policies.find(p => p.name === 'latency_mean_ceiling')?.definition?.threshold || 1000

      console.log(
        `[EvolutionaryPilot] Baselining ${metricName}: Mean=${stats.mean.toFixed(2)}, StdDev=${stats.stdDev.toFixed(2)}, Current=${stats.current.toFixed(2)}, Z-Score=${stats.zScore.toFixed(2)}`,
      )

      // 2. Trigger Evolution based on metric-specific thresholds
      if (
        metricName === 'query_latency' &&
        (stats.zScore > latencyZ || stats.mean > latencyMean)
      ) {
        const result = await this.optimizeLatency()
        if (result) {
          changes.push(...result)
          evolved = true
        }
      }

      const successZ = policies.find(p => p.name === 'success_rate_z')?.definition?.threshold || -1.5
      const successMean = policies.find(p => p.name === 'min_success_rate')?.definition?.threshold || 0.7

      if (
        metricName === 'success_rate' &&
        (stats.zScore < successZ || stats.mean < successMean)
      ) {
        console.warn(
          `[EvolutionaryPilot] Success rate collapse detected (${stats.mean.toFixed(2)}). Triggering strategic mutation.`,
        )
        const strategies = await this.cortex.strategy.mutateStrategy()
        changes.push(...strategies)
        evolved = true
      }

      const costZThreshold = policies.find(p => p.name === 'cost_spike_z')?.definition?.threshold || 2.5
      if (metricName === 'total_cost' && stats.zScore > costZThreshold) {
        console.warn(
          `[EvolutionaryPilot] Cost spike detected. Triggering emergency compression.`,
        )
        await this.cortex.rituals.scheduleRitual(
          'Emergency Compression',
          'compression',
          'hourly',
          'High cost spike detected via Z-score analysis.',
        )
        changes.push('Scheduled emergency compression due to cost spike')
        evolved = true
      }
    }

    // 3. Meta-Meta Evolution Tuning
    const tuned = await this.tuneEmergentSkillHyperparameters(recentMetrics)
    if (tuned) {
      changes.push(
        'Self-tuned emergent skill hyperparameters (Meta-Meta Evolution)',
      )
      evolved = true
    }

    // 4. Verify: Perform an audit
    const audit = await this.cortex.governor.performAudit()
    if (!audit.healthy) {
      console.warn(
        '[EvolutionaryPilot] Evolution resulted in unhealthy state. Reverting may be required.',
      )
      changes.push('WARNING: Unhealthy state detected after evolution')
    }

    return { evolved, changes }
  }

  /**
   * Meta-Meta Evolution: Adjusts the hyperparameters of the SkillSynthesizer
   * based on the systemic success or failure of recently verified skills.
   */
  private async tuneEmergentSkillHyperparameters(
    recentMetrics: AgentMetric[],
  ): Promise<boolean> {
    console.log(`[EvolutionaryPilot] Running Meta-Meta Evolution tuning...`)

    // Count how many skills are currently blacklisted vs verified
    const blacklisted =
      await this.cortex.capabilities.getCapabilities('blacklisted')
    const verified = await this.cortex.capabilities.getCapabilities('verified')

    let tuned = false
    const config = this.config.evolution

    if (!config) return false

    const totalSynthesized = blacklisted.length + verified.length

    if (totalSynthesized > 5) {
      const successRate = verified.length / totalSynthesized

      // If we are succeeding often, increase mutation aggressiveness and allow more sandbox skills
      if (successRate > 0.7) {
        if ((config.mutationAggressiveness || 0) < 0.9) {
          config.mutationAggressiveness = Math.min(
            1.0,
            (config.mutationAggressiveness || 0.5) + 0.1,
          )
          console.log(
            `[EvolutionaryPilot] High skill synthesis success. Increased mutation aggressiveness to ${config.mutationAggressiveness.toFixed(2)}`,
          )
          tuned = true
        }
        if ((config.maxSandboxSkills || 5) < 15) {
          config.maxSandboxSkills = (config.maxSandboxSkills || 5) + 2
          console.log(
            `[EvolutionaryPilot] High skill synthesis success. Increased sandbox capacity to ${config.maxSandboxSkills}`,
          )
          tuned = true
        }
        // We can afford shorter verification windows
        if ((config.verificationWindow || 20) > 10) {
          config.verificationWindow = Math.max(
            10,
            (config.verificationWindow || 20) - 2,
          )
          console.log(
            `[EvolutionaryPilot] Shortened verification window to ${config.verificationWindow}`,
          )
          tuned = true
        }
      }
      // If we are failing often, become more conservative
      else if (successRate < 0.3) {
        if ((config.mutationAggressiveness || 0) > 0.1) {
          config.mutationAggressiveness = Math.max(
            0.1,
            (config.mutationAggressiveness || 0.5) - 0.1,
          )
          console.log(
            `[EvolutionaryPilot] Low skill synthesis success. Decreased mutation aggressiveness to ${config.mutationAggressiveness.toFixed(2)}`,
          )
          tuned = true
        }
        if ((config.maxSandboxSkills || 5) > 2) {
          config.maxSandboxSkills = Math.max(
            2,
            (config.maxSandboxSkills || 5) - 1,
          )
          console.log(
            `[EvolutionaryPilot] Low skill synthesis success. Decreased sandbox capacity to ${config.maxSandboxSkills}`,
          )
          tuned = true
        }
        // Safety requires longer verification windows
        if ((config.verificationWindow || 20) < 50) {
          config.verificationWindow = Math.min(
            50,
            (config.verificationWindow || 20) + 5,
          )
          console.log(
            `[EvolutionaryPilot] Lengthened verification window to ${config.verificationWindow}`,
          )
          tuned = true
        }
      }
    }

    return tuned
  }

  private calculateZScore(values: number[]): {
    mean: number
    stdDev: number
    current: number
    zScore: number
  } {
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance =
      values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
    const stdDev = Math.sqrt(variance)
    const current = values[0]
    const zScore = stdDev === 0 ? 0 : (current - mean) / stdDev
    return { mean, stdDev, current, zScore }
  }

  private async optimizeLatency(): Promise<string[]> {
    const changes: string[] = []
    console.log(`[EvolutionaryPilot] Triggering latency optimization...`)

    const dialect = (this.db.getExecutor() as any).dialect
    const isSqlite =
      this.db
        .getExecutor()
        .adapter.constructor.name.toLowerCase()
        .includes('sqlite') ||
      (dialect && dialect.constructor.name.toLowerCase().includes('sqlite'))

    if (isSqlite) {
      await sql`PRAGMA optimize`.execute(this.db)
      changes.push('Applied PRAGMA optimize')
    }

    const messagesTable = this.config.messagesTable || 'agent_messages'
    await this.cortex.evolution.evolve(
      `CREATE INDEX IF NOT EXISTS idx_agent_msg_session_time ON ${messagesTable}(session_id, created_at)`,
    )
    changes.push(`Applied composite index to ${messagesTable}`)

    return changes
  }
}
