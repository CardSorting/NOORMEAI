import type { Kysely } from '../kysely.js'
import {
  AgenticConfig,
  AgentCapability,
  EmergentSkillConfig,
} from '../types/index.js'
import type { Cortex } from './Cortex.js'
import { withLock } from './util/db-utils.js'

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
      const baseQuery = trx
        .selectFrom(this.capabilitiesTable as any)
        .selectAll()
        .where('name', '=', name)
        .orderBy('updated_at', 'desc')

      const capability = await withLock(baseQuery, trx)
        .executeTakeFirst()

      if (capability) {
        const cap = capability as any
        const metadata =
          typeof cap.metadata === 'string'
            ? JSON.parse(cap.metadata)
            : cap.metadata || {}

        const totalCount = (metadata.totalCount || 0) + 1
        const successCount = (metadata.successCount || 0) + (success ? 1 : 0)

        // Damped moving average: weight recent outcomes more but keep history
        const currentReliability = cap.reliability
        const alpha = 0.2
        const newReliability = success
          ? Math.min(1.0, currentReliability * (1 - alpha) + alpha)
          : Math.max(0.0, currentReliability * (1 - alpha))

        let newStatus = cap.status || 'experimental'

        // Simple Promotion/Demotion
        const winRate = totalCount > 0 ? successCount / totalCount : 0
        const minSampleSize = this.evolutionConfig.verificationWindow || 20

        if (totalCount >= minSampleSize) {
          if (winRate >= 0.8 && newStatus === 'experimental') {
            console.log(`[CapabilityManager] Promoting ${name} to verified (Rate: ${(winRate * 100).toFixed(1)}%)`)
            newStatus = 'verified'
          } else if (winRate < 0.4) {
            console.log(`[CapabilityManager] Blacklisting ${name} (Rate: ${(winRate * 100).toFixed(1)}%)`)
            newStatus = 'blacklisted'
          }
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
    const persona = await trxOrDb
      .selectFrom((this.config as any).personasTable || 'agent_personas')
      .selectAll()
      .where('id', '=', personaId)
      .executeTakeFirst()
      .then((p: any) => {
        if (!p) return null;
        return {
          id: p.id,
          name: p.name,
          metadata: typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata || {},
          capabilities: typeof p.capabilities === 'string' ? JSON.parse(p.capabilities) : p.capabilities || []
        };
      });

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

