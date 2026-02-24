import type { Kysely } from '../../kysely.js'
import type { AgenticConfig, KnowledgeItem } from '../../types/index.js'
import type { Cortex } from '../Cortex.js'
import type { KnowledgeDatabase } from './KnowledgeDistiller.js'
import { sql } from '../../raw-builder/sql.js'
import { KnowledgePromoter } from './hive/KnowledgePromoter.js'
import { SkillPropagator } from './hive/SkillPropagator.js'
import { DomainMaster } from './hive/DomainMaster.js'

/**
 * HiveLink facilitates "Collective Intelligence" by synchronizing
 * knowledge and lessons learned across different agent personas.
 */
export class HiveLink {
  private knowledgeTable: string
  private promoter: KnowledgePromoter
  private propagator: SkillPropagator
  private domainMaster: DomainMaster

  constructor(
    private db: Kysely<any>,
    private cortex: Cortex,
    private config: AgenticConfig = {},
  ) {
    this.knowledgeTable = config.knowledgeTable || 'agent_knowledge_base'
    this.promoter = new KnowledgePromoter()
    this.propagator = new SkillPropagator()
    this.domainMaster = new DomainMaster()
  }

  private get typedDb(): Kysely<KnowledgeDatabase> {
    return this.db as unknown as Kysely<KnowledgeDatabase>
  }

  /**
   * Promote high-confidence local knowledge to global "Hive" knowledge.
   */
  async broadcastKnowledge(options: { minConfidence?: number; limit?: number; offset?: number } = {}): Promise<number> {
    const minConfidence = options.minConfidence ?? 0.9
    const limit = options.limit ?? 100
    const offset = options.offset ?? 0

    console.log(
      `[HiveLink] Broadcasting knowledge (limit=${limit}, offset=${offset}) with confidence >= ${minConfidence}`,
    )

    const items = (await this.typedDb
      .selectFrom(this.knowledgeTable as any)
      .selectAll()
      .where('confidence', '>=', minConfidence)
      .where('source_session_id', 'is not', null)
      .limit(limit)
      .offset(offset)
      .execute()) as unknown as KnowledgeItem[]

    let promotedCount = 0
    for (const item of items) {
      const promoted = await this.promoter.promote(this.db, this.cortex, this.config, this.knowledgeTable, item)
      if (promoted) promotedCount++
    }

    return promotedCount
  }

  /**
   * Strengthen knowledge related to a specific domain (tag).
   */
  async syncDomain(
    domainTag: string,
    boostFactor: number = 0.05,
  ): Promise<number> {
    return this.domainMaster.boostDomain(this.db, this.knowledgeTable, domainTag, boostFactor)
  }

  /**
   * Propagate high-performing capabilities globally using the "Sovereign Draft" protocol.
   */
  async broadcastSkills(): Promise<number> {
    if (
      !this.config.evolution?.enableHiveLink &&
      this.config.evolution !== undefined
    ) {
      console.log('[HiveLink] Skill broadcasting disabled by config.')
      return 0
    }

    console.log(`[HiveLink] Executing Sovereign Draft for emergent skills...`)

    return this.propagator.propagate(this.db, this.cortex, this.config)
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

