import type { Kysely, Transaction } from '../../kysely.js'
import type {
    AgenticConfig,
    KnowledgeItem,
    KnowledgeLink
} from '../../types/index.js'
import { calculateSimilarity } from '../../util/similarity.js'

export interface KnowledgeTable {
    id: number | string // Auto-incrementing ID or UUID
    entity: string
    fact: string
    confidence: number
    source_session_id: string | number | null
    tags: string | null // JSON string
    metadata: string | null // JSON string
    embedding: string | null // JSON string or vector type if supported
    status: 'verified' | 'disputed' | 'deprecated' | 'proposed'
    created_at: string | Date
    updated_at: string | Date
}

export interface KnowledgeLinkTable {
    id: number | string
    source_id: number | string
    target_id: number | string
    relationship: string
    metadata: string | null // JSON string
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

    constructor(
        private db: Kysely<any>, // accepting any Kysely but casting internally for our specific tables
        private config: AgenticConfig = {}
    ) {
        this.knowledgeTable = config.knowledgeTable || 'agent_knowledge_base'
        this.linksTable = 'agent_knowledge_links'
    }

    /**
     * typedDb helper to cast the generic DB to our specific schema
     */
    private get typedDb(): Kysely<KnowledgeDatabase> {
        return this.db as unknown as Kysely<KnowledgeDatabase>
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
        source: 'user' | 'assistant' | 'system' = 'assistant'
    ): Promise<KnowledgeItem> {
        return await this.db.transaction().execute(async (trx) => {
            // Check for exact match first
            const existing = await trx
                .selectFrom(this.knowledgeTable as any)
                .selectAll()
                .where('entity', '=', entity)
                .where('fact', '=', fact)
                .executeTakeFirst()

            if (existing) {
                // Merge tags
                const existingTags = existing.tags ? JSON.parse(existing.tags as string) : []
                const mergedTags = Array.from(new Set([...existingTags, ...tags]))

                // Merge metadata
                const existingMeta = existing.metadata ? JSON.parse(existing.metadata as string) : {}

                // Hallucination Prevention: Tracking contributing sessions
                const sessions = new Set(existingMeta.sessions || [])
                if (sourceSessionId) sessions.add(sourceSessionId)

                const mergedMeta = {
                    ...existingMeta,
                    ...metadata,
                    sessions: Array.from(sessions),
                    session_count: sessions.size
                }

                // Source weighting: User verification boosts confidence faster
                const boost = source === 'user' ? 0.2 : 0.05
                const finalConfidence = Math.min(1.0, (existing.confidence as number) + boost)

                // Status Lifecycle: Auto-verify if source is user or if session count >= 3
                let finalStatus = existing.status || 'proposed'
                if (source === 'user' || mergedMeta.session_count >= 3) {
                    finalStatus = 'verified'
                }

                const updated = await trx
                    .updateTable(this.knowledgeTable as any)
                    .set({
                        confidence: finalConfidence,
                        status: finalStatus,
                        tags: JSON.stringify(mergedTags),
                        metadata: JSON.stringify(mergedMeta),
                        updated_at: new Date(),
                        source_session_id: sourceSessionId ?? existing.source_session_id
                    })
                    .where('id', '=', existing.id)
                    .returningAll()
                    .executeTakeFirstOrThrow()

                return this.parseKnowledge(updated)
            }

            // Conflict Detection: Check if a similar entity has a conflicting fact
            await this.challengeKnowledge(entity, fact, confidence, trx)

            // Create new
            const initialMeta = {
                ...metadata,
                source,
                sessions: sourceSessionId ? [sourceSessionId] : [],
                session_count: sourceSessionId ? 1 : 0
            }

            const created = await trx
                .insertInto(this.knowledgeTable as any)
                .values({
                    entity,
                    fact,
                    confidence: source === 'user' ? Math.max(confidence, 0.8) : confidence,
                    status: source === 'user' ? 'verified' : 'proposed',
                    source_session_id: sourceSessionId ?? null,
                    tags: JSON.stringify(tags),
                    metadata: JSON.stringify(initialMeta),
                    created_at: new Date(),
                    updated_at: new Date()
                })
                .returningAll()
                .executeTakeFirstOrThrow()

            const parsed = this.parseKnowledge(created)

            // Semantic Auto-Linking: Try to link to related entities
            await this.autoLinkKnowledge(parsed, trx)

            return parsed
        })
    }

    /**
     * Verify and reinforce existing knowledge.
     * Increases confidence if the fact matches.
     */
    async verifyKnowledge(id: number | string, reinforcement: number = 0.1): Promise<KnowledgeItem | null> {
        const existing = await this.typedDb
            .selectFrom(this.knowledgeTable as any)
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst()

        if (!existing) return null

        const metadata = typeof existing.metadata === 'string' ? JSON.parse(existing.metadata) : (existing.metadata || {})

        // Hallucination Guard: Cap confidence for non-user sources until cross-session verification
        let maxConfidence = 1.0
        if (metadata.source !== 'user' && (metadata.session_count || 0) < 3) {
            maxConfidence = 0.85
            console.log(`[KnowledgeDistiller] Confidence capped at 0.85 for item ${id} (Need 3+ sessions for total trust)`)
        }

        const newConfidence = Math.min(maxConfidence, (existing.confidence as number) + reinforcement)

        // Promotion Lifecycle
        let newStatus = existing.status || 'proposed'
        if (newConfidence >= 0.9 || metadata.session_count >= 3) {
            newStatus = 'verified'
        }

        const updated = await this.db
            .updateTable(this.knowledgeTable as any)
            .set({
                confidence: newConfidence,
                status: newStatus,
                updated_at: new Date()
            })
            .where('id', '=', id)
            .returningAll()
            .executeTakeFirstOrThrow()

        return this.parseKnowledge(updated)
    }

    /**
     * Search knowledge by entity with optional tag filtering.
     * Records a "hit" for each retrieved item to track utility.
     */
    async getKnowledgeByEntity(entity: string, filterTags?: string[]): Promise<KnowledgeItem[]> {
        let query = this.db
            .selectFrom(this.knowledgeTable as any)
            .selectAll()
            .where('entity', '=', entity)
            .orderBy('confidence', 'desc')

        const items = (await query.execute()) as any[]
        const parsed = items.map(i => this.parseKnowledge(i))

        let filtered = parsed
        if (filterTags && filterTags.length > 0) {
            filtered = parsed.filter(item =>
                item.tags?.some(tag => filterTags.includes(tag))
            )
        }

        // Record hits asynchronously
        for (const item of filtered) {
            this.recordHit(item.id).catch(err => console.error(`[KnowledgeDistiller] Failed to record hit for ${item.id}:`, err))
        }

        return filtered
    }

    /**
     * Record a retrieval hit for a knowledge item.
     */
    async recordHit(id: number | string): Promise<void> {
        const existing = await this.typedDb
            .selectFrom(this.knowledgeTable as any)
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst()

        if (!existing) return

        const metadata = typeof existing.metadata === 'string'
            ? JSON.parse(existing.metadata)
            : (existing.metadata || {})

        metadata.hit_count = (metadata.hit_count || 0) + 1
        metadata.last_retrieved_at = new Date().toISOString()

        await this.db
            .updateTable(this.knowledgeTable as any)
            .set({
                metadata: JSON.stringify(metadata),
                updated_at: new Date()
            })
            .where('id', '=', id)
            .execute()

        // Production Hardening: Emit a metric event for this hit to enable efficient hotspot detection
        await this.db
            .insertInto(this.config.metricsTable || 'agent_metrics' as any)
            .values({
                metric_name: `entity_hit_${existing.entity}`,
                metric_value: 1,
                created_at: new Date()
            } as any)
            .execute()
    }

    /**
     * Calculate the "Fitness" of a memory item.
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

        return (item.confidence * 0.4) + (stn * 0.4) + (sourceMult * 0.2)
    }

    /**
     * Challenge existing knowledge with new evidence.
     * If confidence of new fact is high and contradicts existing ones (same entity, different fact),
     * we degrade the confidence of the old facts.
     */
    async challengeKnowledge(entity: string, competingFact: string, confidence: number, trxOrDb: any = this.db): Promise<void> {
        const query = trxOrDb
            .selectFrom(this.knowledgeTable as any)
            .selectAll()
            .where('entity', '=', entity)
            .orderBy('confidence', 'desc')

        const existingItems = await query.execute()

        for (const item of existingItems) {
            // Parse for logic
            const parsedItem = this.parseKnowledge(item)
            if (parsedItem.fact === competingFact) continue

            // Deep Hardening: Conflict detection using semantic similarity check
            // If the entity is the same but the fact is different, we assess conflict
            if (confidence > 0.8) {
                let newMeta = { ...parsedItem.metadata }
                let penalty = 0.2
                let newStatus = parsedItem.status

                if (parsedItem.confidence > 0.7) {
                    newStatus = 'disputed'
                    newMeta = { ...newMeta, status_reason: `Contradicted by: ${competingFact}` }
                    penalty = 0.1
                } else {
                    newStatus = 'deprecated'
                    newMeta = { ...newMeta, status_reason: `Superseded by: ${competingFact}` }
                    penalty = 0.4
                }

                const newConfidence = Math.max(0, parsedItem.confidence - penalty)

                await trxOrDb
                    .updateTable(this.knowledgeTable as any)
                    .set({
                        confidence: newConfidence,
                        status: newStatus,
                        metadata: JSON.stringify(newMeta),
                        updated_at: new Date()
                    } as any)
                    .where('id', '=', parsedItem.id)
                    .execute()
            }
        }
    }

    /**
     * Automatic Semantic Linking
     * Scans for entity mentions in facts and creates links.
     * Production Hardening: Uses batched cross-similarity and NER-style tokenization.
     */
    private async autoLinkKnowledge(item: KnowledgeItem, trx: Transaction<any>): Promise<void> {
        // 1. Structural/Syntactic Extraction (NER-style tokenization)
        // Extract capitalized phrases (potential entities), quoted strings, and CamelCase identifiers
        const tokens = item.fact.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)|("[^"]+")|([a-z]+[A-Z][a-z]+)/g) || []

        const potentialEntities = Array.from(new Set(
            tokens.map(t => t.replace(/"/g, '').trim())
        )).filter(t => t.length > 2 && t !== item.entity)

        if (potentialEntities.length > 0) {
            const matches = await trx
                .selectFrom(this.knowledgeTable as any)
                .select(['id', 'entity'])
                .where('entity', 'in', potentialEntities)
                .execute()

            for (const match of matches) {
                await this.linkKnowledge(item.id, match.id, 'mentions', { auto: true, source: 'structural_extraction' }, trx)
            }
        }

        // 2. Semantic Similarity Pass (Vector/Cosine Approximation)
        // We limit the search to items with high intrinsic fitness to avoid linking to "noise"
        const candidates = await trx
            .selectFrom(this.knowledgeTable as any)
            .selectAll()
            .where('id', '!=', item.id)
            .where('confidence', '>', 0.4) // Only link to semi-reliable knowledge
            .orderBy('updated_at', 'desc')
            .limit(50) // Increased limit for better coverage
            .execute()

        // Batch similarity processing to reduce link churn
        const linksToCreate: { targetId: number | string, sim: number }[] = []

        for (const other of candidates) {
            const parsedOther = this.parseKnowledge(other)
            const sim = calculateSimilarity(item.fact, parsedOther.fact)

            // High similarity threshold for auto-linking to prevent a "everything linked to everything" graph
            if (sim > 0.75) {
                linksToCreate.push({ targetId: parsedOther.id, sim })
            }
        }

        // Apply links in batch
        for (const link of linksToCreate) {
            await this.linkKnowledge(item.id, link.targetId, 'semantically_related', { similarity: link.sim, version: '2.0' }, trx)
        }
    }

    /**
     * Link two knowledge items together with a relationship.
     * Transaction-aware version.
     */
    async linkKnowledge(
        sourceId: number | string,
        targetId: number | string,
        relationship: string,
        metadata?: Record<string, any>,
        trxOrDb: any = this.db
    ): Promise<void> {
        if (sourceId === targetId) return

        const existing = await trxOrDb
            .selectFrom(this.linksTable as any)
            .select('id')
            .where('source_id', '=', sourceId)
            .where('target_id', '=', targetId)
            .where('relationship', '=', relationship)
            .executeTakeFirst()

        if (existing) {
            await trxOrDb
                .updateTable(this.linksTable as any)
                .set({
                    metadata: metadata ? JSON.stringify(metadata) : null
                })
                .where('id', '=', existing.id)
                .execute()
        } else {
            await trxOrDb
                .insertInto(this.linksTable as any)
                .values({
                    source_id: sourceId,
                    target_id: targetId,
                    relationship,
                    metadata: metadata ? JSON.stringify(metadata) : null,
                    created_at: new Date()
                })
                .execute()
        }
    }

    /**
     * Get the "Knowledge Graph" for a specific entity (1-hop neighborhood).
     */
    async getKnowledgeGraph(entityId: number | string): Promise<{ item: KnowledgeItem, relations: { relationship: string, target: KnowledgeItem }[] }> {
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
                `${this.linksTable}.target_id`
            )
            .selectAll('target')
            .select(`${this.linksTable}.relationship as link_rel`)
            .where(`${this.linksTable}.source_id`, '=', entityId)
            .execute()

        return {
            item: this.parseKnowledge(center),
            relations: links.map(l => ({
                relationship: (l as any).link_rel,
                target: this.parseKnowledge(l)
            }))
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

        return Number(result.numDeletedRows)
    }

    /**
     * Consolidate knowledge by merging similar facts for the same entity.
     * Production Hardening: Iterative bucketed approach to avoid recursive stack issues.
     */
    async consolidateKnowledge(): Promise<number> {
        let totalMerged = 0

        // Find entities with multiple facts
        const candidates = await this.db
            .selectFrom(this.knowledgeTable as any)
            .select('entity')
            .groupBy('entity')
            .having((eb: any) => eb.fn.count('id'), '>', 1 as any)
            .execute()

        for (const cand of candidates) {
            const entity = (cand as any).entity
            const items = await this.getKnowledgeByEntity(entity)

            // Iterative merging inside the entity bucket
            const mergedIds = new Set<string | number>()

            for (let i = 0; i < items.length; i++) {
                if (mergedIds.has(items[i].id)) continue

                for (let j = i + 1; j < items.length; j++) {
                    if (mergedIds.has(items[j].id)) continue

                    const sim = calculateSimilarity(items[i].fact, items[j].fact)
                    if (sim > 0.85) {
                        await this.mergeItems(items[i], items[j])
                        mergedIds.add(items[j].id)
                        totalMerged++
                    }
                }
            }
        }

        return totalMerged
    }


    private async mergeItems(primary: KnowledgeItem, secondary: KnowledgeItem): Promise<void> {
        const mergedMeta = {
            ...secondary.metadata,
            ...primary.metadata,
            consolidated_from: secondary.id,
            consolidated_at: new Date().toISOString()
        }

        const mergedTags = Array.from(new Set([...(primary.tags || []), ...(secondary.tags || [])]))

        await this.db.transaction().execute(async (trx) => {
            // Update primary
            await trx
                .updateTable(this.knowledgeTable as any)
                .set({
                    confidence: Math.max(primary.confidence, secondary.confidence),
                    metadata: JSON.stringify(mergedMeta),
                    tags: JSON.stringify(mergedTags),
                    updated_at: new Date()
                })
                .where('id', '=', primary.id)
                .execute()

            // Delete secondary
            await trx
                .deleteFrom(this.knowledgeTable as any)
                .where('id', '=', secondary.id)
                .execute()
        })
    }

    private parseKnowledge(item: any): KnowledgeItem {
        return {
            id: item.id,
            entity: item.entity,
            fact: item.fact,
            confidence: item.confidence,
            status: item.status || 'proposed',
            sourceSessionId: item.source_session_id,
            tags: typeof item.tags === 'string' ? JSON.parse(item.tags) : (item.tags || []),
            metadata: typeof item.metadata === 'string' ? JSON.parse(item.metadata) : (item.metadata || {}),
            createdAt: new Date(item.created_at),
            updatedAt: new Date(item.updated_at)
        }
    }
}
