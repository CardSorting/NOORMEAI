import type { Kysely } from '../kysely.js'
import {
  AgenticConfig,
  AgentCapability,
  EmergentSkillConfig,
} from '../types/index.js'
import type { Cortex } from './Cortex.js'

export interface CapabilityTable {
  id: number | string
  name: string
  version: string
  description: string | null
  status: 'experimental' | 'verified' | 'blacklisted'
  reliability: number
  metadata: string | null // JSON string
  created_at: string | Date
  updated_at: string | Date
}

export interface CapabilityDatabase {
  agent_capabilities: CapabilityTable
}

/**
 * CapabilityManager tracks the skills (tools) available to an agent
 * and their historical reliability.
 */
export class CapabilityManager {
  private capabilitiesTable: string
  private evolutionConfig: EmergentSkillConfig

  constructor(
    private db: Kysely<any>,
    private cortex: Cortex,
    private config: AgenticConfig = {},
  ) {
    this.capabilitiesTable = config.capabilitiesTable || 'agent_capabilities'
    this.evolutionConfig = {
      verificationWindow: config.evolution?.verificationWindow ?? 20,
      rollbackThresholdZ: config.evolution?.rollbackThresholdZ ?? 2.5,
      enableHiveLink: config.evolution?.enableHiveLink ?? true,
      mutationAggressiveness: config.evolution?.mutationAggressiveness ?? 0.5,
      maxSandboxSkills: config.evolution?.maxSandboxSkills ?? 5,
    }
  }

  private get typedDb(): Kysely<CapabilityDatabase> {
    return this.db as unknown as Kysely<CapabilityDatabase>
  }

  /**
   * Register or update a capability (skill)
   */
  async registerCapability(
    name: string,
    version: string,
    description?: string,
    metadata: Record<string, any> = {},
    trxOrDb: any = this.db, // Allow passing transaction
  ): Promise<AgentCapability> {
    const runner = async (trx: any) => {
      const existing = await trx
        .selectFrom(this.capabilitiesTable as any)
        .selectAll()
        .where('name', '=', name)
        .where('version', '=', version)
        .executeTakeFirst()

      if (existing) {
        const updated = await trx
          .updateTable(this.capabilitiesTable as any)
          .set({
            description: description || (existing as any).description,
            status: (existing as any).status || 'experimental',
            metadata: JSON.stringify({
              ...JSON.parse((existing as any).metadata || '{}'),
              ...metadata,
            }),
            updated_at: new Date(),
          })
          .where('id', '=', (existing as any).id)
          .returningAll()
          .executeTakeFirstOrThrow()

        return this.parseCapability(updated)
      }

      const created = await trx
        .insertInto(this.capabilitiesTable as any)
        .values({
          name,
          version,
          description: description || null,
          status: metadata.initialStatus || 'experimental',
          reliability: 1.0,
          metadata: JSON.stringify({
            ...metadata,
            successCount: 0,
            totalCount: 0,
          }),
          created_at: new Date(),
          updated_at: new Date(),
        } as any)
        .returningAll()
        .executeTakeFirstOrThrow()

      return this.parseCapability(created)
    }

    if (trxOrDb && trxOrDb !== this.db) {
      return await runner(trxOrDb)
    } else {
      return await this.db.transaction().execute(runner)
    }
  }

  /**
   * Update reliability based on action outcome using a damped moving average.
   * Manages the lifecycle of emergent skills (sandbox -> verified / blacklisted).
   */
  async reportOutcome(name: string, success: boolean, trxOrDb: any = this.db): Promise<void> {
    const runner = async (trx: any) => {
      let query = trx
        .selectFrom(this.capabilitiesTable as any)
        .selectAll()
        .where('name', '=', name)
        .orderBy('updated_at', 'desc')

      // PRODUCTION HARDENING: Lock row to prevent RMW race (Skip for SQLite)
      const executor = trx.getExecutor()
      const adapterName = executor?.adapter?.constructor?.name || executor?.dialect?.constructor?.name || ''
      if (!adapterName.toLowerCase().includes('sqlite')) {
        query = query.forUpdate() as any
      }

      const capability = await query.executeTakeFirst()

      if (capability) {
        const cap = capability as any
        const metadata =
          typeof cap.metadata === 'string'
            ? JSON.parse(cap.metadata)
            : cap.metadata || {}

        const totalCount = (metadata.totalCount || 0) + 1
        const successCount = (metadata.successCount || 0) + (success ? 1 : 0)

        // Damped moving average: weight recent outcomes more but keep history
        // formula: new = old * (1 - alpha) + current * alpha
        const currentReliability = cap.reliability
        const alpha = 0.2
        const newReliability = success
          ? Math.min(1.0, currentReliability * (1 - alpha) + alpha)
          : Math.max(0.0, currentReliability * (1 - alpha))

        // Sovereign Draft: Anchored Reliability (weighted by total runs)
        const anchoredReliability =
          ((metadata.anchored_reliability || 1.0) * totalCount + (success ? 1 : 0)) /
          (totalCount + 1)

        let newStatus = cap.status || 'experimental'

        // --- Emergent Skill Evolution Optimization ---
        const successStreak = (metadata.successStreak || 0) + (success ? 1 : 0)
        const failureStreak = success ? 0 : (metadata.failureStreak || 0) + 1
        const streakSuccess = success ? successStreak : 0

        const winRate = successCount / totalCount
        const windowSize = this.evolutionConfig.verificationWindow || 20
        const minSampleSize = Math.ceil(windowSize * 0.75)

        // Fast-Track Promotion: 5 consecutive successes bypasses sample size
        const isPromotable =
          (totalCount >= minSampleSize && winRate >= 0.8) || streakSuccess >= 5

        // Early-Exit Rollback: 3 consecutive failures at the start immediately blacklists
        const isCatastrophic = !success && failureStreak >= 3 && totalCount <= 5

        // Pass 6: Predictive Pre-warming Trigger
        // If a skill is close to promotion, pre-warm its optimized description
        const promoThreshold = Math.ceil(minSampleSize * 0.8)
        const isNearingPromotion =
          (totalCount >= promoThreshold && winRate >= 0.8) ||
          streakSuccess === 4

        if (
          isNearingPromotion &&
          newStatus === 'experimental' &&
          this.cortex.skillSynthesizer
        ) {
          // Trigger async background pre-warming
          this.cortex.skillSynthesizer.preWarmSkill(name).catch(() => { })
        }

        // --- Production Hardening: Dynamic Performance Baselining ---
        const historyAlpha = 0.05 // Slower moving average for baseline
        const baseline = metadata.performanceBaseline ?? winRate
        const newBaseline =
          baseline * (1 - historyAlpha) + winRate * historyAlpha

        // Variance tracking for Z-score calculation
        const variance = metadata.performanceVariance ?? 0.01
        const diff = winRate - baseline
        const newVariance =
          variance * (1 - historyAlpha) + Math.pow(diff, 2) * historyAlpha
        const stdDev = Math.sqrt(newVariance)

        // Z-Score: How many standard deviations is current performance from baseline?
        const zScore = stdDev > 0 ? (winRate - baseline) / stdDev : 0

        // Promotion/Demotion Logic
        if (
          isCatastrophic &&
          (newStatus === 'experimental' || (newStatus as string) === 'sandbox')
        ) {
          console.error(
            `[CapabilityManager] Skill '${name}' FAILED early-exit safety check (Streak: ${failureStreak}). Blacklisting immediately.`,
          )
          newStatus = 'blacklisted'
        } else if (
          isPromotable &&
          (newStatus === 'experimental' || (newStatus as string) === 'sandbox')
        ) {
          console.log(
            `[CapabilityManager] Skill '${name}' PASSED fast-track verification (Streak: ${streakSuccess}, Rate: ${(winRate * 100).toFixed(1)}%). Promoting to Verified.`,
          )
          newStatus = 'verified'
        } else if (totalCount >= minSampleSize) {
          if (winRate < 0.4) {
            console.log(
              `[CapabilityManager] Skill '${name}' FAILED statistical verification (Rate: ${(winRate * 100).toFixed(1)}%). Blacklisting.`,
            )
            newStatus = 'blacklisted'
          } else if (newStatus === 'verified' && zScore < -2.0) {
            // Performance Collapse: Z-score indicates current run is significantly below historical baseline
            console.warn(
              `[CapabilityManager] Verified skill '${name}' PERFORMANCE COLLAPSE (Z: ${zScore.toFixed(2)}, Rate: ${(winRate * 100).toFixed(1)}%). Demoting to Experimental.`,
            )
            newStatus = 'experimental'
          }
        }

        if (newStatus !== cap.status) {
          console.log(
            `[CapabilityManager] EVOLVING STATUS: ${name} (${cap.status} -> ${newStatus})`,
          )
        }

        await trx
          .updateTable(this.capabilitiesTable as any)
          .set({
            reliability: newReliability,
            status: newStatus,
            metadata: JSON.stringify({
              ...metadata,
              totalCount,
              successCount,
              successStreak: streakSuccess,
              failureStreak,
              performanceBaseline: newBaseline,
              performanceVariance: newVariance,
              anchored_reliability: anchoredReliability,
              lastOutcomeType: success ? 'success' : 'failure',
            }),
            updated_at: new Date(),
          })
          .where('id', '=', cap.id)
          .execute()
      }
    }

    if (trxOrDb && trxOrDb !== this.db) {
      await runner(trxOrDb)
    } else {
      await this.db.transaction().execute(runner)
    }
  }

  /**
   * Get reliability score for a capability.
   */
  async getReliability(name: string, trxOrDb: any = this.db): Promise<number> {
    const cap = await trxOrDb
      .selectFrom(this.capabilitiesTable as any)
      .select('reliability')
      .where('name', '=', name)
      .orderBy('updated_at', 'desc')
      .executeTakeFirst()

    return cap ? (cap as any).reliability : 0.0
  }

  /**
   * Get all registered capabilities, optionally filtered by status
   */
  async getCapabilities(
    status?: AgentCapability['status'],
    trxOrDb: any = this.db,
  ): Promise<AgentCapability[]> {
    let query = trxOrDb
      .selectFrom(this.capabilitiesTable as any)
      .selectAll()

    if (status) {
      query = query.where('status', '=', status) as any
    }

    // Sovereign Draft: Prioritize Alpha versions and higher reliability
    // Audit Phase 19: Hard limit to prevent memory spikes in massive skillsets
    const list = await query
      .orderBy('name', 'asc')
      .orderBy('reliability', 'desc')
      .limit(1000)
      .execute()

    // Filter to latest/best variants if many versions exist
    const unique = new Map<string, any>()
    for (const c of list) {
      const cap = c as any
      const meta = typeof cap.metadata === 'string' ? JSON.parse(cap.metadata) : (cap.metadata || {})
      if (!unique.has(cap.name) || meta.is_alpha) {
        unique.set(cap.name, cap)
      }
    }

    return Array.from(unique.values()).map((c) => this.parseCapability(c))
  }

  /**
   * Validate if a persona has access to a specific capability (Sandbox Enforcement).
   */
  async validateCapabilityAccess(
    personaId: string | number,
    capabilityName: string,
    trxOrDb: any = this.db,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const persona = await this.cortex.personas.getPersona(String(personaId), trxOrDb) || 
                    await trxOrDb.selectFrom(this.config.personasTable || 'agent_personas' as any)
                        .selectAll()
                        .where('id', '=', personaId)
                        .executeTakeFirst()
                        .then((p: any) => p ? (this.cortex.personas as any).parsePersona(p) : null);

    if (!persona) {
      return { allowed: false, reason: `Persona ${personaId} not found.` }
    }

    // Check if persona is quarantined
    if (persona.metadata?.status === 'quarantined') {
      return {
        allowed: false,
        reason: `Persona ${personaId} is currently quarantined due to safety violations.`,
      }
    }

    // Check if capability is blacklisted globally
    const cap = await trxOrDb
      .selectFrom(this.capabilitiesTable as any)
      .select(['status', 'reliability'])
      .where('name', '=', capabilityName)
      .orderBy('reliability', 'desc')
      .executeTakeFirst()

    if (cap && (cap as any).status === 'blacklisted') {
      return {
        allowed: false,
        reason: `Capability '${capabilityName}' is globally blacklisted.`,
      }
    }

    // Enforce persona-specific capability list if defined
    if (persona.capabilities && persona.capabilities.length > 0) {
      const isAllowed = persona.capabilities.includes(capabilityName) || persona.capabilities.includes('*')
      if (!isAllowed) {
        return {
          allowed: false,
          reason: `Persona '${persona.name}' does not have permission to use capability '${capabilityName}'.`,
        }
      }
    }

    // Enforce Sandbox limit for experimental skills
    if (cap && (cap as any).status === 'experimental') {
      const experimentalCount = (persona.capabilities || []).filter((c: string) => c.startsWith('experimental_')).length
      if (experimentalCount >= (this.evolutionConfig.maxSandboxSkills || 5)) {
        return {
          allowed: false,
          reason: `Persona '${persona.name}' has reached the maximum number of experimental sandbox skills.`,
        }
      }
    }

    return { allowed: true }
  }

  private parseCapability(cap: any): AgentCapability {
    return {
      id: cap.id,
      name: cap.name,
      version: cap.version,
      description: cap.description,
      status: cap.status || 'experimental',
      reliability: cap.reliability,
      metadata:
        typeof cap.metadata === 'string'
          ? JSON.parse(cap.metadata)
          : cap.metadata || {},
      createdAt: new Date(cap.created_at),
      updatedAt: new Date(cap.updated_at),
    }
  }
}
