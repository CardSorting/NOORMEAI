import type { Kysely } from '../../kysely.js'
import type { AgenticConfig, KnowledgeItem } from '../../types/index.js'
import type { Cortex } from '../Cortex.js'
import type { KnowledgeDatabase } from './KnowledgeDistiller.js'
import { sql } from '../../raw-builder/sql.js'

/**
 * HiveLink facilitates "Collective Intelligence" by synchronizing
 * knowledge and lessons learned across different agent personas.
 */
export class HiveLink {
  private knowledgeTable: string

  constructor(
    private db: Kysely<any>,
    private cortex: Cortex,
    private config: AgenticConfig = {},
  ) {
    this.knowledgeTable = config.knowledgeTable || 'agent_knowledge_base'
  }

  private get typedDb(): Kysely<KnowledgeDatabase> {
    return this.db as unknown as Kysely<KnowledgeDatabase>
  }

  /**
   * Promote high-confidence local knowledge to global "Hive" knowledge.
   * This creates a new, session-agnostic entry or updates an existing global one.
   */
  async broadcastKnowledge(minConfidence: number = 0.9): Promise<number> {
    console.log(
      `[HiveLink] Broadcasting knowledge with confidence >= ${minConfidence}`,
    )

    // Find high-confidence items that are "local" (have a source_session_id)
    const items = (await this.typedDb
      .selectFrom(this.knowledgeTable as any)
      .selectAll()
      .where('confidence', '>=', minConfidence)
      .where('source_session_id', 'is not', null) // Only local items
      .execute()) as unknown as KnowledgeItem[]

    let promotedCount = 0

    for (const item of items) {
      // Check if a global version already exists
      const existingGlobal = await this.typedDb
        .selectFrom(this.knowledgeTable as any)
        .selectAll()
        .where('entity', '=', item.entity)
        .where('fact', '=', item.fact)
        .where('source_session_id', 'is', null)
        .executeTakeFirst()

      if (existingGlobal) {
        // Reinforce existing global knowledge
        // Calculate new confidence: average of existing and new, heavily weighted towards max
        const newConfidence = Math.min(
          0.99,
          Math.max(existingGlobal.confidence, item.confidence) + 0.01,
        )

        await this.db
          .updateTable(this.knowledgeTable as any)
          .set({
            confidence: newConfidence,
            updated_at: new Date(),
          } as any)
          .where('id', '=', existingGlobal.id)
          .execute()
      } else {
        // Create new global knowledge
        const tags = item.tags ? [...item.tags] : []
        if (!tags.includes('hive_mind')) tags.push('hive_mind')

        await this.db
          .insertInto(this.knowledgeTable as any)
          .values({
            entity: item.entity,
            fact: item.fact,
            confidence: item.confidence, // Carry over confidence
            source_session_id: null, // Global
            tags: JSON.stringify(tags),
            metadata: JSON.stringify({
              ...item.metadata,
              promoted_from: item.id,
              promoted_at: new Date(),
            }),
            created_at: new Date(),
            updated_at: new Date(),
          } as any)
          .execute()

        promotedCount++
      }
    }

    return promotedCount
  }

  /**
   * Strengthen knowledge related to a specific domain (tag).
   * Increases confidence of all items with this tag, representing "domain mastery".
   */
  async syncDomain(
    domainTag: string,
    boostFactor: number = 0.05,
  ): Promise<number> {
    console.log(`[HiveLink] Syncing/Boosting domain '${domainTag}' (Set-Based)`)

    // Use a single SQL update for high throughput
    const result = await this.db
      .updateTable(this.knowledgeTable as any)
      .set({
        confidence: sql`MIN(1.0, confidence + ${boostFactor})`,
        updated_at: new Date(),
      } as any)
      .where('tags', 'like', `%"${domainTag}"%`)
      .where('confidence', '<', 1.0)
      .execute()

    // Kysely update .execute() returns an array of results or similar depending on adapter
    // For simple update, we might just return the count if supported or 1
    return Number((result as any)[0]?.numUpdatedRows ?? 1)
  }

  /**
   * Propagate high-performing capabilities globally and block known-bad ones.
   * High-Throughput Refactor: Batch updates and optimized set-based checks.
   */
  async broadcastSkills(): Promise<number> {
    if (
      !this.config.evolution?.enableHiveLink &&
      this.config.evolution !== undefined
    ) {
      console.log('[HiveLink] Skill broadcasting disabled by config.')
      return 0
    }

    console.log(
      `[HiveLink] Broadcasting emergent skills across the Hive (Performance-Aware)...`,
    )

    let broadcastCount = 0
    const capTable = this.config.capabilitiesTable || 'agent_capabilities'

    await this.db.transaction().execute(async (trx) => {
      // 1. Resolve Verified Skills with "Survival of the Fittest" logic
      const verifiedSkills =
        await this.cortex.capabilities.getCapabilities('verified')

      for (const skill of verifiedSkills) {
        const meta =
          typeof skill.metadata === 'string'
            ? JSON.parse(skill.metadata)
            : skill.metadata || {}
        if (meta.broadcasted) continue

        // Check for competing global versions
        const baseName = meta.mutatedFrom || skill.name
        const competitor = await trx
          .selectFrom(capTable as any)
          .selectAll()
          .where('name', 'like', `%${baseName}%`)
          .where('status', '=', 'verified')
          .where('id', '!=', skill.id)
          .executeTakeFirst()

        let shouldBroadcast = true
        if (competitor) {
          const comp = competitor as any
          const compRel = comp.reliability || 0
          // Performance-Based Conflict Resolution: Only broadcast if reliability is strictly better
          // or if it's a direct version upgrade with equal/better reliability
          const isNewer = this.compareVersions(skill.version, comp.version) > 0
          if (compRel > skill.reliability) {
            shouldBroadcast = false
          } else if (compRel === skill.reliability && !isNewer) {
            shouldBroadcast = false
          }
        }

        if (shouldBroadcast) {
          await trx
            .updateTable(capTable as any)
            .set({
              metadata: JSON.stringify({
                ...meta,
                broadcasted: true,
                hive_verified: true,
                broadcasted_at: new Date(),
                conflict_resolved: !!competitor,
              }),
            } as any)
            .where('id', '=', skill.id)
            .execute()
          broadcastCount++
        }
      }

      // 2. Broadcast Blacklisted Skills (Immediate Immune Propagations)
      const blacklisted =
        await this.cortex.capabilities.getCapabilities('blacklisted')
      for (const skill of blacklisted) {
        const meta =
          typeof skill.metadata === 'string'
            ? JSON.parse(skill.metadata)
            : skill.metadata || {}
        if (!meta.broadcasted) {
          await trx
            .updateTable(capTable as any)
            .set({
              metadata: JSON.stringify({
                ...meta,
                broadcasted: true,
                hive_blacklisted: true,
                blocked_at: new Date(),
              }),
            } as any)
            .where('id', '=', skill.id)
            .execute()
          broadcastCount++
        }
      }
    })

    return broadcastCount
  }

  /**
   * Simple semver-style version comparison.
   */
  private compareVersions(v1: string, v2: string): number {
    const p1 = v1.split('.').map(Number)
    const p2 = v2.split('.').map(Number)
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const num1 = p1[i] || 0
      const num2 = p2[i] || 0
      if (num1 > num2) return 1
      if (num2 > num1) return -1
    }
    return 0
  }
}
