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
   * Propagate high-performing capabilities globally using the "Sovereign Draft" protocol.
   * Uses Bayesian Convergence and Shadow Promotion to avoid deadlocks.
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
      `[HiveLink] Executing Sovereign Draft for emergent skills...`,
    )

    let broadcastCount = 0
    const capTable = this.config.capabilitiesTable || 'agent_capabilities'

    // 1. Resolve Verified Skills with Bayesian "Alpha" selection
    const verifiedSkills = await this.cortex.capabilities.getCapabilities('verified')

    // Group verified skills by lineage (base tool name)
    const lineageGroups = new Map<string, any[]>()
    for (const skill of verifiedSkills) {
      const meta = typeof skill.metadata === 'string' ? JSON.parse(skill.metadata) : (skill.metadata || {})
      const lineage = meta.lineage || skill.name
      if (!lineageGroups.has(lineage)) lineageGroups.set(lineage, [])
      lineageGroups.get(lineage)!.push({ skill, meta })
    }

    for (const [lineage, variants] of lineageGroups.entries()) {
      // Bayesian Winner Selection
      // Score = (anchored_reliability * totalCount + K * prior) / (totalCount + K)
      // For simplicity, we use anchored_reliability which already incorporates this weighting
      const alphaCandidate = variants.reduce((prev, curr) => {
        const pAnchored = prev.meta.anchored_reliability || 0
        const cAnchored = curr.meta.anchored_reliability || 0
        return cAnchored > pAnchored ? curr : prev
      })

      // Non-Blocking Set Update: Flag Alpha and Shadow versions
      await this.db.transaction().execute(async (trx) => {
        // Flag the winner as Alpha
        await trx
          .updateTable(capTable as any)
          .set({
            metadata: JSON.stringify({
              ...alphaCandidate.meta,
              is_alpha: true,
              broadcasted: true,
              broadcasted_at: new Date(),
            }),
          } as any)
          .where('id', '=', alphaCandidate.skill.id)
          .execute()

        // Flag others in the same lineage as Shadow
        const others = variants.filter(v => v.skill.id !== alphaCandidate.skill.id)
        if (others.length > 0) {
          await trx
            .updateTable(capTable as any)
            .set({
              metadata: sql`json_set(metadata, '$.is_alpha', false, '$.is_shadow', true)` as any,
              status: 'experimental' // Re-evaluate shadows if needed
            } as any)
            .where('id', 'in', others.map(v => v.skill.id))
            .execute()
        }
      })
      broadcastCount += variants.length
    }

    // 2. Broadcast Blacklisted Skills (Immune Prophet)
    const blacklisted = await this.cortex.capabilities.getCapabilities('blacklisted')
    const blackIDs = blacklisted
      .filter(s => {
        const meta = typeof s.metadata === 'string' ? JSON.parse(s.metadata) : (s.metadata || {})
        return !meta.broadcasted
      })
      .map(s => s.id)

    if (blackIDs.length > 0) {
      await this.db
        .updateTable(capTable as any)
        .set({
          metadata: sql`json_set(metadata, '$.broadcasted', true, '$.hive_blacklisted', true)` as any,
          updated_at: new Date()
        } as any)
        .where('id', 'in', blackIDs)
        .execute()
      broadcastCount += blackIDs.length
    }

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
