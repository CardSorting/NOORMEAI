"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CuriosityEngine = void 0;
const similarity_js_1 = require("../../util/similarity.js");
/**
 * CuriosityEngine identifies information gaps and suggests
 * active research tasks to improve the agent's world model.
 */
class CuriosityEngine {
    db;
    config;
    knowledgeTable;
    constructor(db, config = {}) {
        this.db = db;
        this.config = config;
        this.knowledgeTable = config.knowledgeTable || 'agent_knowledge_base';
    }
    get typedDb() {
        return this.db;
    }
    /**
     * Analyze current knowledge to identify "Gaps" or contradictions.
     * Detects entities with low confidence or competing high-confidence facts.
     */
    async identifyKnowledgeGaps() {
        console.log('[CuriosityEngine] Analyzing knowledge base for gaps and contradictions...');
        const gaps = [];
        // 1. Find entities with low confidence or unverified facts
        const weakKnowledge = await this.typedDb
            .selectFrom(this.knowledgeTable)
            .selectAll()
            .where((eb) => eb.or([
            eb('confidence', '<', 0.5),
            eb('tags', 'is', null),
            eb.and([
                eb('tags', 'not like', '%"verified"%'),
                eb('confidence', '<', 0.8)
            ])
        ]))
            .execute();
        for (const item of weakKnowledge) {
            const type = item.confidence < 0.5 ? 'low_confidence' : 'unverified';
            gaps.push({
                entity: item.entity,
                type,
                details: `Fact "${item.fact}" is ${type}. (Confidence: ${item.confidence})`
            });
        }
        // 2. Detect Contradictions: Same entity, multiple high-confidence facts that are different
        const entities = await this.typedDb
            .selectFrom(this.knowledgeTable)
            .select('entity')
            .groupBy('entity')
            .having((eb) => eb.fn.count('id'), '>', 1)
            .execute();
        for (const row of entities) {
            const items = await this.typedDb
                .selectFrom(this.knowledgeTable)
                .selectAll()
                .where('entity', '=', row.entity)
                .where('confidence', '>', 0.6)
                .execute();
            if (items.length > 1) {
                // Semantic check: if they have high similarity but slightly different facts, it's a conflict
                for (let i = 0; i < items.length; i++) {
                    for (let j = i + 1; j < items.length; j++) {
                        const similarity = (0, similarity_js_1.calculateSimilarity)(items[i].fact, items[j].fact);
                        // If they are somewhat similar but not identical (0.4 to 0.9 range)
                        // it might be a subtle contradiction or partial update
                        if (similarity > 0.4 && similarity < 0.95) {
                            gaps.push({
                                entity: row.entity,
                                type: 'contradiction',
                                details: `Entity "${row.entity}" has potentially competing facts: "${items[i].fact}" vs "${items[j].fact}" (Similarity: ${(similarity * 100).toFixed(1)}%)`
                            });
                        }
                    }
                }
            }
        }
        return gaps;
    }
    /**
     * Identify "Hotspots": Entities that are frequently referenced in memory
     * but have low factual density.
     * Production Hardening: Uses aggregated entity hits from metrics instead of scanning all memories.
     */
    async identifyKnowledgeHotspots() {
        const metricsTable = this.config.metricsTable || 'agent_metrics';
        // 1. Find entities with high hit counts in recent metrics
        const topEntities = await this.db
            .selectFrom(metricsTable)
            .select(['metric_name as entity', (eb) => eb.fn.sum('metric_value').as('references')])
            .where('metric_name', 'like', 'entity_hit_%')
            .groupBy('metric_name')
            .orderBy((eb) => eb.fn.sum('metric_value'), 'desc')
            .limit(10)
            .execute();
        const hotspots = [];
        for (const row of topEntities) {
            const entityName = row.entity.replace('entity_hit_', '');
            // 2. Check factual density for this specific hotspot candidate
            const knowledgeCountResult = await this.typedDb
                .selectFrom(this.knowledgeTable)
                .select((eb) => eb.fn.count('id').as('count'))
                .where('entity', '=', entityName)
                .executeTakeFirst();
            const factCount = Number(knowledgeCountResult?.count || 0);
            const refs = Number(row.references || 0);
            if (factCount < 3 && refs > 5) {
                hotspots.push({
                    entity: entityName,
                    references: refs,
                    density: factCount,
                    gap: `High-use entity "${entityName}" has only ${factCount} facts but was referenced ${refs} times in metrics.`
                });
            }
        }
        return hotspots;
    }
    /**
     * Generate specific research questions based on a gap or hotspot.
     */
    async suggestQuestions(entity) {
        const knowledge = await this.typedDb
            .selectFrom(this.knowledgeTable)
            .select(['fact', 'confidence', 'metadata', 'tags'])
            .where('entity', '=', entity)
            .execute();
        if (knowledge.length === 0) {
            return [
                `What are the core attributes and defining characteristics of ${entity}?`,
                `How does ${entity} relate to the broader system architecture?`,
                `What are the primary use cases for ${entity} in the current context?`
            ];
        }
        const questions = [];
        const facts = knowledge.map(k => k.fact);
        // Context-aware questions
        questions.push(`Can we find more supporting evidence for: "${facts[0]}"?`);
        const lowConfidenceItems = knowledge.filter(k => k.confidence < 0.6);
        if (lowConfidenceItems.length > 0) {
            questions.push(`Verify the accuracy of recent claims about ${entity}, specifically regarding "${lowConfidenceItems[0].fact}".`);
        }
        // Use tags to generate specific questions
        const allTags = new Set();
        knowledge.forEach(k => {
            const tags = typeof k.tags === 'string' ? JSON.parse(k.tags) : (k.tags || []);
            tags.forEach((t) => allTags.add(t));
        });
        if (allTags.has('database')) {
            questions.push(`What is the schema and indexing strategy for ${entity}?`);
        }
        if (allTags.has('performance')) {
            questions.push(`Are there any known latency bottlenecks or resource constraints for ${entity}?`);
        }
        if (allTags.has('security')) {
            questions.push(`What are the authentication and authorization protocols protecting ${entity}?`);
        }
        // Contradiction resolution
        if (knowledge.length > 1) {
            questions.push(`Resolve the discrepancy between competing facts about ${entity} to establish a single source of truth.`);
        }
        return questions;
    }
    /**
     * Generate "Relationship Hypotheses" between high-confidence entities.
     * Suggests that entities with similar tags might be related.
     */
    async generateHypotheses() {
        console.log('[CuriosityEngine] Generating relationship hypotheses...');
        // 1. Get high-confidence entities
        const entities = await this.typedDb
            .selectFrom(this.knowledgeTable)
            .select(['entity', 'tags'])
            .where('confidence', '>', 0.8)
            .where('tags', 'is not', null)
            .execute();
        const hypotheses = [];
        const tagMap = new Map();
        for (const row of entities) {
            const tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []);
            for (const tag of tags) {
                if (!tagMap.has(tag))
                    tagMap.set(tag, []);
                tagMap.get(tag).push(row.entity);
            }
        }
        // 2. Identify entities sharing multiple matching tags
        for (const [tag, relatedEntities] of tagMap.entries()) {
            if (relatedEntities.length > 1) {
                const uniqueEntities = [...new Set(relatedEntities)];
                for (let i = 0; i < uniqueEntities.length; i++) {
                    for (let j = i + 1; j < uniqueEntities.length; j++) {
                        hypotheses.push(`[HYPOTHESIS] "${uniqueEntities[i]}" and "${uniqueEntities[j]}" are both tagged as "${tag}". Is there a direct dependency or shared lifecycle?`);
                    }
                }
            }
        }
        return hypotheses.slice(0, 5); // Limit to top 5
    }
    /**
     * Propose a research ritual based on identified gaps, hotspots, and hypotheses.
     */
    async proposeResearch() {
        const gaps = await this.identifyKnowledgeGaps();
        const hotspots = await this.identifyKnowledgeHotspots();
        const hypotheses = await this.generateHypotheses();
        const proposals = [];
        for (const g of gaps) {
            proposals.push(`[RESEARCH NEEDED] ${g.entity}: ${g.details}`);
        }
        for (const h of hotspots) {
            proposals.push(`[HOTSPOT ALERT] ${h.entity}: ${h.gap}`);
        }
        for (const hypo of hypotheses) {
            proposals.push(hypo);
        }
        // Production Hardening: Check for evolutionary density to suggest publication
        const evolutionCountResult = await this.db
            .selectFrom(this.config.metricsTable || 'agent_metrics')
            .select((eb) => eb.fn.count('id').as('count'))
            .where('metric_name', '=', 'evolution_applied')
            .where('created_at', '>', new Date(Date.now() - 7 * 24 * 3600000)) // Last 7 days
            .executeTakeFirst();
        const evolutions = Number(evolutionCountResult?.count || 0);
        if (evolutions > 5) {
            proposals.push(`[SOVEREIGN RITUAL] The engine has undergone ${evolutions} structural evolutions this week. Consider a 'Sovereign Publication Ritual' to update the registry.`);
        }
        return proposals;
    }
}
exports.CuriosityEngine = CuriosityEngine;
