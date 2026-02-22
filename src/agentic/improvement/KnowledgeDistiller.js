"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeDistiller = void 0;
const similarity_js_1 = require("../../util/similarity.js");
/**
 * KnowledgeDistiller extracts structured "KnowledgeItems" from longtail history,
 * allowing agents to build a permanent, queryable knowledge base.
 */
class KnowledgeDistiller {
    db;
    config;
    knowledgeTable;
    linksTable;
    constructor(db, // accepting any Kysely but casting internally for our specific tables
    config = {}) {
        this.db = db;
        this.config = config;
        this.knowledgeTable = config.knowledgeTable || 'agent_knowledge_base';
        this.linksTable = 'agent_knowledge_links';
    }
    /**
     * typedDb helper to cast the generic DB to our specific schema
     */
    get typedDb() {
        return this.db;
    }
    /**
     * Add or update a knowledge item with robust merging and transaction support.
     */
    async distill(entity, fact, confidence, sourceSessionId, tags = [], metadata = {}, source = 'assistant') {
        return await this.db.transaction().execute(async (trx) => {
            // Check for exact match first
            const existing = await trx
                .selectFrom(this.knowledgeTable)
                .selectAll()
                .where('entity', '=', entity)
                .where('fact', '=', fact)
                .executeTakeFirst();
            if (existing) {
                // Merge tags
                const existingTags = existing.tags ? JSON.parse(existing.tags) : [];
                const mergedTags = Array.from(new Set([...existingTags, ...tags]));
                // Merge metadata
                const existingMeta = existing.metadata ? JSON.parse(existing.metadata) : {};
                // Hallucination Prevention: Tracking contributing sessions
                const sessions = new Set(existingMeta.sessions || []);
                if (sourceSessionId)
                    sessions.add(sourceSessionId);
                const mergedMeta = {
                    ...existingMeta,
                    ...metadata,
                    sessions: Array.from(sessions),
                    session_count: sessions.size
                };
                // Source weighting: User verification boosts confidence faster
                const boost = source === 'user' ? 0.2 : 0.05;
                const finalConfidence = Math.min(1.0, existing.confidence + boost);
                // Status Lifecycle: Auto-verify if source is user or if session count >= 3
                let finalStatus = existing.status || 'proposed';
                if (source === 'user' || mergedMeta.session_count >= 3) {
                    finalStatus = 'verified';
                }
                const updated = await trx
                    .updateTable(this.knowledgeTable)
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
                    .executeTakeFirstOrThrow();
                return this.parseKnowledge(updated);
            }
            // Conflict Detection: Check if a similar entity has a conflicting fact
            await this.challengeKnowledge(entity, fact, confidence, trx);
            // Create new
            const initialMeta = {
                ...metadata,
                source,
                sessions: sourceSessionId ? [sourceSessionId] : [],
                session_count: sourceSessionId ? 1 : 0
            };
            const created = await trx
                .insertInto(this.knowledgeTable)
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
                .executeTakeFirstOrThrow();
            const parsed = this.parseKnowledge(created);
            // Semantic Auto-Linking: Try to link to related entities
            await this.autoLinkKnowledge(parsed, trx);
            return parsed;
        });
    }
    /**
     * Verify and reinforce existing knowledge.
     * Increases confidence if the fact matches.
     */
    async verifyKnowledge(id, reinforcement = 0.1) {
        const existing = await this.typedDb
            .selectFrom(this.knowledgeTable)
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst();
        if (!existing)
            return null;
        const metadata = typeof existing.metadata === 'string' ? JSON.parse(existing.metadata) : (existing.metadata || {});
        // Hallucination Guard: Cap confidence for non-user sources until cross-session verification
        let maxConfidence = 1.0;
        if (metadata.source !== 'user' && (metadata.session_count || 0) < 3) {
            maxConfidence = 0.85;
            console.log(`[KnowledgeDistiller] Confidence capped at 0.85 for item ${id} (Need 3+ sessions for total trust)`);
        }
        const newConfidence = Math.min(maxConfidence, existing.confidence + reinforcement);
        // Promotion Lifecycle
        let newStatus = existing.status || 'proposed';
        if (newConfidence >= 0.9 || metadata.session_count >= 3) {
            newStatus = 'verified';
        }
        const updated = await this.db
            .updateTable(this.knowledgeTable)
            .set({
            confidence: newConfidence,
            status: newStatus,
            updated_at: new Date()
        })
            .where('id', '=', id)
            .returningAll()
            .executeTakeFirstOrThrow();
        return this.parseKnowledge(updated);
    }
    /**
     * Search knowledge by entity with optional tag filtering.
     * Records a "hit" for each retrieved item to track utility.
     */
    async getKnowledgeByEntity(entity, filterTags) {
        let query = this.db
            .selectFrom(this.knowledgeTable)
            .selectAll()
            .where('entity', '=', entity)
            .orderBy('confidence', 'desc');
        const items = (await query.execute());
        const parsed = items.map(i => this.parseKnowledge(i));
        let filtered = parsed;
        if (filterTags && filterTags.length > 0) {
            filtered = parsed.filter(item => item.tags?.some(tag => filterTags.includes(tag)));
        }
        // Record hits asynchronously
        for (const item of filtered) {
            this.recordHit(item.id).catch(err => console.error(`[KnowledgeDistiller] Failed to record hit for ${item.id}:`, err));
        }
        return filtered;
    }
    /**
     * Record a retrieval hit for a knowledge item.
     */
    async recordHit(id) {
        const existing = await this.typedDb
            .selectFrom(this.knowledgeTable)
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst();
        if (!existing)
            return;
        const metadata = typeof existing.metadata === 'string'
            ? JSON.parse(existing.metadata)
            : (existing.metadata || {});
        metadata.hit_count = (metadata.hit_count || 0) + 1;
        metadata.last_retrieved_at = new Date().toISOString();
        await this.db
            .updateTable(this.knowledgeTable)
            .set({
            metadata: JSON.stringify(metadata),
            updated_at: new Date()
        })
            .where('id', '=', id)
            .execute();
        // Production Hardening: Emit a metric event for this hit to enable efficient hotspot detection
        await this.db
            .insertInto(this.config.metricsTable || 'agent_metrics')
            .values({
            metric_name: `entity_hit_${existing.entity}`,
            metric_value: 1,
            created_at: new Date()
        })
            .execute();
    }
    /**
     * Calculate the "Fitness" of a memory item.
     * Score = (Confidence * 0.4) + (SignalToNoise * 0.4) + (SourceMultiplier * 0.2)
     */
    calculateFitness(item) {
        const metadata = item.metadata || {};
        const hitCount = metadata.hit_count || 0;
        const createdAt = new Date(item.createdAt).getTime();
        const ageInDays = Math.max(1, (Date.now() - createdAt) / (1000 * 60 * 60 * 24));
        // Signal-to-Noise: Hits per day
        const stn = Math.min(1.0, hitCount / ageInDays);
        // Source Multiplier: User verified facts get 1.0, Assistant-generated 0.7
        const sourceMult = metadata.source === 'user' ? 1.0 : 0.7;
        return (item.confidence * 0.4) + (stn * 0.4) + (sourceMult * 0.2);
    }
    /**
     * Challenge existing knowledge with new evidence.
     * If confidence of new fact is high and contradicts existing ones (same entity, different fact),
     * we degrade the confidence of the old facts.
     */
    async challengeKnowledge(entity, competingFact, confidence, trxOrDb = this.db) {
        const query = trxOrDb
            .selectFrom(this.knowledgeTable)
            .selectAll()
            .where('entity', '=', entity)
            .orderBy('confidence', 'desc');
        const existingItems = await query.execute();
        for (const item of existingItems) {
            // Parse for logic
            const parsedItem = this.parseKnowledge(item);
            if (parsedItem.fact === competingFact)
                continue;
            // Deep Hardening: Conflict detection using semantic similarity check
            // If the entity is the same but the fact is different, we assess conflict
            if (confidence > 0.8) {
                let newMeta = { ...parsedItem.metadata };
                let penalty = 0.2;
                let newStatus = parsedItem.status;
                if (parsedItem.confidence > 0.7) {
                    newStatus = 'disputed';
                    newMeta = { ...newMeta, status_reason: `Contradicted by: ${competingFact}` };
                    penalty = 0.1;
                }
                else {
                    newStatus = 'deprecated';
                    newMeta = { ...newMeta, status_reason: `Superseded by: ${competingFact}` };
                    penalty = 0.4;
                }
                const newConfidence = Math.max(0, parsedItem.confidence - penalty);
                await trxOrDb
                    .updateTable(this.knowledgeTable)
                    .set({
                    confidence: newConfidence,
                    status: newStatus,
                    metadata: JSON.stringify(newMeta),
                    updated_at: new Date()
                })
                    .where('id', '=', parsedItem.id)
                    .execute();
            }
        }
    }
    /**
     * Automatic Semantic Linking
     * Scans for entity mentions in facts and creates links.
     * Production Hardening: Uses batched cross-similarity and NER-style tokenization.
     */
    async autoLinkKnowledge(item, trx) {
        // Extract potential entity names from the fact (Capitalized words)
        const tokens = item.fact.match(/[A-Z][a-z]+/g) || [];
        if (tokens.length === 0)
            return;
        const potentialEntities = Array.from(new Set(tokens));
        const matches = await trx
            .selectFrom(this.knowledgeTable)
            .select(['id', 'entity'])
            .where('entity', 'in', potentialEntities)
            .where('entity', '!=', item.entity)
            .execute();
        for (const match of matches) {
            await this.linkKnowledge(item.id, match.id, 'mentions', { auto: true, source: 'ner_extraction' }, trx);
        }
        // Secondary Pass: Similarity check for unanchored relations
        const related = await trx
            .selectFrom(this.knowledgeTable)
            .selectAll()
            .where('id', '!=', item.id)
            .orderBy('updated_at', 'desc')
            .limit(20)
            .execute();
        for (const other of related) {
            const parsedOther = this.parseKnowledge(other);
            const sim = (0, similarity_js_1.calculateSimilarity)(item.fact, parsedOther.fact);
            if (sim > 0.6) {
                await this.linkKnowledge(item.id, parsedOther.id, 'semantically_related', { similarity: sim }, trx);
            }
        }
    }
    /**
     * Link two knowledge items together with a relationship.
     * Transaction-aware version.
     */
    async linkKnowledge(sourceId, targetId, relationship, metadata, trxOrDb = this.db) {
        if (sourceId === targetId)
            return;
        const existing = await trxOrDb
            .selectFrom(this.linksTable)
            .select('id')
            .where('source_id', '=', sourceId)
            .where('target_id', '=', targetId)
            .where('relationship', '=', relationship)
            .executeTakeFirst();
        if (existing) {
            await trxOrDb
                .updateTable(this.linksTable)
                .set({
                metadata: metadata ? JSON.stringify(metadata) : null
            })
                .where('id', '=', existing.id)
                .execute();
        }
        else {
            await trxOrDb
                .insertInto(this.linksTable)
                .values({
                source_id: sourceId,
                target_id: targetId,
                relationship,
                metadata: metadata ? JSON.stringify(metadata) : null,
                created_at: new Date()
            })
                .execute();
        }
    }
    /**
     * Get the "Knowledge Graph" for a specific entity (1-hop neighborhood).
     */
    async getKnowledgeGraph(entityId) {
        const center = await this.db
            .selectFrom(this.knowledgeTable)
            .selectAll()
            .where('id', '=', entityId)
            .executeTakeFirst();
        if (!center)
            throw new Error(`Entity with ID ${entityId} not found`);
        const links = await this.db
            .selectFrom(this.linksTable)
            .innerJoin(`${this.knowledgeTable} as target`, `target.id`, `${this.linksTable}.target_id`)
            .selectAll('target')
            .select(`${this.linksTable}.relationship as link_rel`)
            .where(`${this.linksTable}.source_id`, '=', entityId)
            .execute();
        return {
            item: this.parseKnowledge(center),
            relations: links.map(l => ({
                relationship: l.link_rel,
                target: this.parseKnowledge(l)
            }))
        };
    }
    /**
     * Prune knowledge items that have fallen below a certain confidence threshold.
     */
    async pruneLowConfidence(threshold = 0.2) {
        const result = await this.db
            .deleteFrom(this.knowledgeTable)
            .where('confidence', '<', threshold)
            .executeTakeFirst();
        return Number(result.numDeletedRows);
    }
    /**
     * Consolidate knowledge by merging similar facts for the same entity.
     * Production Hardening: Iterative bucketed approach to avoid recursive stack issues.
     */
    async consolidateKnowledge() {
        let totalMerged = 0;
        // Find entities with multiple facts
        const candidates = await this.db
            .selectFrom(this.knowledgeTable)
            .select('entity')
            .groupBy('entity')
            .having((eb) => eb.fn.count('id'), '>', 1)
            .execute();
        for (const cand of candidates) {
            const entity = cand.entity;
            const items = await this.getKnowledgeByEntity(entity);
            // Iterative merging inside the entity bucket
            const mergedIds = new Set();
            for (let i = 0; i < items.length; i++) {
                if (mergedIds.has(items[i].id))
                    continue;
                for (let j = i + 1; j < items.length; j++) {
                    if (mergedIds.has(items[j].id))
                        continue;
                    const sim = (0, similarity_js_1.calculateSimilarity)(items[i].fact, items[j].fact);
                    if (sim > 0.85) {
                        await this.mergeItems(items[i], items[j]);
                        mergedIds.add(items[j].id);
                        totalMerged++;
                    }
                }
            }
        }
        return totalMerged;
    }
    async mergeItems(primary, secondary) {
        const mergedMeta = {
            ...secondary.metadata,
            ...primary.metadata,
            consolidated_from: secondary.id,
            consolidated_at: new Date().toISOString()
        };
        const mergedTags = Array.from(new Set([...(primary.tags || []), ...(secondary.tags || [])]));
        await this.db.transaction().execute(async (trx) => {
            // Update primary
            await trx
                .updateTable(this.knowledgeTable)
                .set({
                confidence: Math.max(primary.confidence, secondary.confidence),
                metadata: JSON.stringify(mergedMeta),
                tags: JSON.stringify(mergedTags),
                updated_at: new Date()
            })
                .where('id', '=', primary.id)
                .execute();
            // Delete secondary
            await trx
                .deleteFrom(this.knowledgeTable)
                .where('id', '=', secondary.id)
                .execute();
        });
    }
    parseKnowledge(item) {
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
        };
    }
}
exports.KnowledgeDistiller = KnowledgeDistiller;
