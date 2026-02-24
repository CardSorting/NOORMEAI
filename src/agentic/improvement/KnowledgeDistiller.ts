import type { Kysely } from '../../kysely.js'
import type {
  AgenticConfig,
  KnowledgeItem,
} from '../../types/index.js'
import { FactDistiller } from './distillation/FactDistiller.js'
import { ConflictChallenger } from './distillation/ConflictChallenger.js'
import { RelationshipArchitect } from './distillation/RelationshipArchitect.js'
import { KnowledgeConsolidator } from './distillation/KnowledgeConsolidator.js'

export interface KnowledgeTable {
  id: number | string
  entity: string
  fact: string
  confidence: number
  source_session_id: string | number | null
  tags: string | null
  metadata: string | null
  embedding: string | null
  status: 'verified' | 'disputed' | 'deprecated' | 'proposed'
  created_at: string | Date
  updated_at: string | Date
}

export interface KnowledgeLinkTable {
  id: number | string
  source_id: number | string
  target_id: number | string
  relationship: string
  metadata: string | null
  created_at: string | Date
}

export interface KnowledgeDatabase {
  agent_knowledge_base: KnowledgeTable
  agent_knowledge_links: KnowledgeLinkTable
}

/**
 * KnowledgeDistiller extracts structured "KnowledgeItems" from longtail history,
 * allowing agents to build a permanent, queryable knowledge base.
 */
export class KnowledgeDistiller {
  private knowledgeTable: string
  private linksTable: string
  private bloomFilter: Set<number> = new Set()

  private distiller: FactDistiller
  private challenger: ConflictChallenger
  private architect: RelationshipArchitect
  private consolidator: KnowledgeConsolidator

  constructor(
    private db: Kysely<any>,
    private config: AgenticConfig = {},
  ) {
    this.knowledgeTable = config.knowledgeTable || 'agent_knowledge_base'
    this.linksTable = 'agent_knowledge_links'

    this.distiller = new FactDistiller()
    this.challenger = new ConflictChallenger()
    this.architect = new RelationshipArchitect()
    this.consolidator = new KnowledgeConsolidator()
  }

  /**
   * Add or update a knowledge item with robust merging and transaction support.
   */
  async distill(
    entity: string,
    fact: string,
    confidence: number,
    sourceSessionId?: string | number,
    tags: string[] = [],
    metadata: Record<string, any> = {},
    source: 'user' | 'assistant' | 'system' = 'assistant',
  ): Promise<KnowledgeItem> {
    // Production Hardening: 32-bit Rolling Bloom Filter
    const factHash = this.bloomHash(`${entity}:${fact}`)
    if (this.bloomFilter.has(factHash)) {
      const quickMatch = await this.db
        .selectFrom(this.knowledgeTable as any)
        .select(['id', 'status'])
        .where('entity', '=', entity)
        .where('fact', '=', fact)
        .executeTakeFirst()

      if (quickMatch && (quickMatch as any).status === 'verified' && source !== 'user') {
        const results = await this.getKnowledgeByEntity(entity)
        const match = results.find(k => k.fact === fact)
        if (match) return match
      }
    }

    this.bloomFilter.add(factHash)
    if (this.bloomFilter.size > 2000) this.bloomFilter.clear()

    return await this.db.transaction().execute(async (trx) => {
      // 1. Check for Exact Match & Merge
      let result = await this.distiller.distillExact(
        trx, this.knowledgeTable, entity, fact, confidence, sourceSessionId, tags, metadata, source
      )

      if (result) return this.parseKnowledge(result)

      // 2. Conflict Detection (Contradiction Challenge)
      await this.challenger.challenge(
        trx, this.knowledgeTable, entity, fact, confidence, (i) => this.parseKnowledge(i)
      )

      // 3. Create New Item
      const created = await this.distiller.createInitial(
        trx, this.knowledgeTable, entity, fact, confidence, sourceSessionId, tags, metadata, source
      )
      const parsed = this.parseKnowledge(created)

      // 4. Semantic Auto-Linking
      await this.architect.autoLink(parsed, trx, this.knowledgeTable, this.linksTable)

      return parsed
    })
  }

  /**
   * Verify and reinforce existing knowledge.
   */
  async verifyKnowledge(
    id: number | string,
    reinforcement: number = 0.1,
  ): Promise<KnowledgeItem | null> {
    const updated = await this.distiller.verify(this.db, this.knowledgeTable, id, reinforcement)
    return updated ? this.parseKnowledge(updated) : null
  }

  /**
   * Search knowledge by entity with optional tag filtering.
   */
  async getKnowledgeByEntity(
    entity: string,
    filterTags?: string[],
  ): Promise<KnowledgeItem[]> {
    const items = await this.db
      .selectFrom(this.knowledgeTable as any)
      .selectAll()
      .where('entity', '=', entity)
      .orderBy('confidence', 'desc')
      .execute()

    const parsed = items.map((i) => this.parseKnowledge(i))
    let filtered = parsed
    if (filterTags && filterTags.length > 0) {
      filtered = parsed.filter((item) =>
        item.tags?.some((tag) => filterTags.includes(tag)),
      )
    }

    // Record hits asynchronously to hotspot optimization layer
    for (const item of filtered) {
      this.recordHit(item.id).catch(() => {/* silence is golden in background maintenance */ })
    }

    return filtered
  }

  /**
   * Record a retrieval hit for a knowledge item and emit hotspot telemetry.
   */
  async recordHit(id: number | string): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const existing = await trx
        .selectFrom(this.knowledgeTable as any)
        .select(['id', 'entity', 'metadata'])
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst()

      if (!existing) return

      const metadata = typeof (existing as any).metadata === 'string'
        ? JSON.parse((existing as any).metadata)
        : (existing as any).metadata || {}

      metadata.hit_count = (metadata.hit_count || 0) + 1
      metadata.last_retrieved_at = new Date().toISOString()

      await trx
        .updateTable(this.knowledgeTable as any)
        .set({
          metadata: JSON.stringify(metadata),
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .execute()

      // Production Hardening: Real-time hotspots in metrics layer
      await trx
        .insertInto(this.config.metricsTable || ('agent_metrics' as any))
        .values({
          metric_name: `entity_hit_${(existing as any).entity}`,
          metric_value: 1,
          created_at: new Date(),
        } as any)
        .execute()
    })
  }

  /**
   * Link two knowledge items together with a relationship.
   */
  async linkKnowledge(
    sourceId: number | string,
    targetId: number | string,
    relationship: string,
    metadata?: Record<string, any>,
    trxOrDb: any = this.db,
  ): Promise<void> {
    return this.architect.link(sourceId, targetId, relationship, metadata, trxOrDb, this.linksTable)
  }

  /**
   * Get the "Knowledge Graph" for a specific entity (1-hop neighborhood).
   */
  async getKnowledgeGraph(
    entityId: number | string,
  ): Promise<{
    item: KnowledgeItem
    relations: { relationship: string; target: KnowledgeItem }[]
  }> {
    const center = await this.db
      .selectFrom(this.knowledgeTable as any)
      .selectAll()
      .where('id', '=', entityId)
      .executeTakeFirst()

    if (!center) throw new Error(`Entity with ID ${entityId} not found`)

    const links = await this.db
      .selectFrom(this.linksTable as any)
      .innerJoin(
        `${this.knowledgeTable} as target`,
        `target.id`,
        `${this.linksTable}.target_id`,
      )
      .selectAll('target')
      .select(`${this.linksTable}.relationship as link_rel`)
      .where(`${this.linksTable}.source_id`, '=', entityId)
      .execute()

    return {
      item: this.parseKnowledge(center),
      relations: links.map((l) => ({
        relationship: (l as any).link_rel,
        target: this.parseKnowledge(l),
      })),
    }
  }

  /**
   * Prune knowledge items that have fallen below a certain confidence threshold.
   */
  async pruneLowConfidence(threshold: number = 0.2): Promise<number> {
    const result = await this.db
      .deleteFrom(this.knowledgeTable as any)
      .where('confidence', '<', threshold)
      .executeTakeFirst()

    return Number((result as any).numDeletedRows || 0)
  }

  /**
   * Consolidate knowledge by merging similar facts for the same entity.
   */
  async consolidateKnowledge(): Promise<number> {
    return this.consolidator.consolidate(this.db, this.knowledgeTable, (e) => this.getKnowledgeByEntity(e))
  }

  /**
   * Calculate the "Fitness" of a knowledge item.
   * Score = (Confidence * 0.4) + (SignalToNoise * 0.4) + (SourceMultiplier * 0.2)
   */
  calculateFitness(item: KnowledgeItem): number {
    const metadata = item.metadata || {}
    const hitCount = metadata.hit_count || 0
    const createdAt = new Date(item.createdAt).getTime()
    const ageInDays = Math.max(1, (Date.now() - createdAt) / (1000 * 60 * 60 * 24))

    // Signal-to-Noise: Hits per day
    const stn = Math.min(1.0, hitCount / ageInDays)

    // Source Multiplier: User verified facts get 1.0, Assistant-generated 0.7
    const sourceMult = metadata.source === 'user' ? 1.0 : 0.7

    return item.confidence * 0.4 + stn * 0.4 + sourceMult * 0.2
  }

  private bloomHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i)
      hash |= 0
    }
    return hash
  }

  private parseKnowledge(item: any): KnowledgeItem {
    return {
      id: item.id,
      entity: item.entity,
      fact: item.fact,
      confidence: item.confidence,
      status: item.status || 'proposed',
      sourceSessionId: item.source_session_id,
      tags: typeof item.tags === 'string' ? JSON.parse(item.tags) : item.tags || [],
      metadata: typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata || {},
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
    }
  }
}

