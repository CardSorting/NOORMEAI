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
        metadata: Record<string, any> = {}
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
                const mergedMeta = { ...existingMeta, ...metadata }

                const updated = await trx
                    .updateTable(this.knowledgeTable as any)
                    .set({
                        confidence: Math.max(confidence, existing.confidence as number), // Keep highest confidence
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

            // Create new
            const created = await trx
                .insertInto(this.knowledgeTable as any)
                .values({
                    entity,
                    fact,
                    confidence,
                    source_session_id: sourceSessionId ?? null,
                    tags: JSON.stringify(tags),
                    metadata: JSON.stringify(metadata),
                    created_at: new Date(),
                    updated_at: new Date()
                })
                .returningAll()
                .executeTakeFirstOrThrow()

            return this.parseKnowledge(created)
        })
    }

    /**
     * Verify and reinforce existing knowledge.
     * Increases confidence if the fact matches.
     */
    async verifyKnowledge(id: number | string, reinforcement: number = 0.1): Promise<KnowledgeItem | null> {
        const existing = await this.typedDb
            .selectFrom(this.knowledgeTable as any) // Cast for dynamic table name
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst()

        if (!existing) return null

        const newConfidence = Math.min(1.0, (existing.confidence as number) + reinforcement)

        const updated = await this.db
            .updateTable(this.knowledgeTable as any)
            .set({
                confidence: newConfidence,
                updated_at: new Date()
            })
            .where('id', '=', id)
            .returningAll()
            .executeTakeFirstOrThrow()

        return this.parseKnowledge(updated)
    }

    /**
     * Search knowledge by entity with optional tag filtering.
     */
    async getKnowledgeByEntity(entity: string, filterTags?: string[]): Promise<KnowledgeItem[]> {
        let query = this.db
            .selectFrom(this.knowledgeTable as any)
            .selectAll()
            .where('entity', '=', entity)
            .orderBy('confidence', 'desc')

        const items = (await query.execute()) as any[]

        const parsed = items.map(i => this.parseKnowledge(i))

        if (filterTags && filterTags.length > 0) {
            return parsed.filter(item =>
                item.tags?.some(tag => filterTags.includes(tag))
            )
        }

        return parsed
    }

    /**
     * Challenge existing knowledge with new evidence.
     * If confidence of new fact is high and contradicts existing ones (same entity, different fact),
     * we degrade the confidence of the old facts.
     */
    async challengeKnowledge(entity: string, competingFact: string, confidence: number): Promise<void> {
        const existingItems = await this.getKnowledgeByEntity(entity)

        for (const item of existingItems) {
            // Skip if it's the same fact (that's a verification, not a challenge)
            if (item.fact === competingFact) continue

            // If the new fact is highly confident (>0.8) and the old one is weak (<0.5),
            // we might consider the old one obsolete.
            // If both are strong, we mark the old one as "disputed".

            if (confidence > 0.8) {
                let newMeta = { ...item.metadata }
                let penalty = 0.2

                // If existing is also strong, mark as disputed
                if (item.confidence > 0.7) {
                    newMeta = { ...newMeta, status: 'disputed', dispute_reason: `Contradicted by: ${competingFact}` }
                    penalty = 0.1 // Smaller penalty if it was strong
                } else {
                    newMeta = { ...newMeta, status: 'deprecated', deprecation_reason: `Replaced by: ${competingFact}` }
                    penalty = 0.4 // Heavy penalty for weak facts
                }

                const newConfidence = Math.max(0, item.confidence - penalty)

                await this.db
                    .updateTable(this.knowledgeTable as any)
                    .set({
                        confidence: newConfidence,
                        metadata: JSON.stringify(newMeta),
                        updated_at: new Date()
                    })
                    .where('id', '=', item.id)
                    .execute()
            }
        }
    }

    /**
     * Link two knowledge items together with a relationship.
     * Prevents duplicate links.
     */
    async linkKnowledge(
        sourceId: number | string,
        targetId: number | string,
        relationship: string,
        metadata?: Record<string, any>
    ): Promise<void> {
        if (sourceId === targetId) return // explicit self-link check

        const existing = await this.db
            .selectFrom(this.linksTable as any)
            .select('id')
            .where('source_id', '=', sourceId)
            .where('target_id', '=', targetId)
            .where('relationship', '=', relationship)
            .executeTakeFirst()

        if (existing) {
            // Update metadata if exists
            await this.db
                .updateTable(this.linksTable as any)
                .set({
                    metadata: metadata ? JSON.stringify(metadata) : null
                    // We don't update created_at for links usually
                })
                .where('id', '=', existing.id)
                .execute()
        } else {
            await this.db
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
     * Uses Jaccard similarity (token-based) to detect redundancy.
     */
    async consolidateKnowledge(): Promise<number> {
        let mergeCount = 0
        const entities = await this.db
            .selectFrom(this.knowledgeTable as any)
            .select('entity')
            .groupBy('entity')
            .having((eb: any) => eb.fn.count('id'), '>', 1 as any)
            .execute()

        for (const row of entities) {
            const entity = (row as any).entity
            const items = await this.getKnowledgeByEntity(entity)

            for (let i = 0; i < items.length; i++) {
                for (let j = i + 1; j < items.length; j++) {
                    const sim = calculateSimilarity(items[i].fact, items[j].fact)
                    if (sim > 0.7) {
                        await this.mergeItems(items[i], items[j])
                        mergeCount++
                        // Restart inner loop as items list changed
                        return this.consolidateKnowledge().then(c => c + mergeCount)
                    }
                }
            }
        }
        return mergeCount
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
            sourceSessionId: item.source_session_id,
            tags: typeof item.tags === 'string' ? JSON.parse(item.tags) : (item.tags || []),
            metadata: typeof item.metadata === 'string' ? JSON.parse(item.metadata) : (item.metadata || {}),
            createdAt: new Date(item.created_at),
            updatedAt: new Date(item.updated_at)
        }
    }
}
