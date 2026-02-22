"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HiveLink = void 0;
/**
 * HiveLink facilitates "Collective Intelligence" by synchronizing
 * knowledge and lessons learned across different agent personas.
 */
class HiveLink {
    db;
    cortex;
    config;
    knowledgeTable;
    constructor(db, cortex, config = {}) {
        this.db = db;
        this.cortex = cortex;
        this.config = config;
        this.knowledgeTable = config.knowledgeTable || 'agent_knowledge_base';
    }
    get typedDb() {
        return this.db;
    }
    /**
     * Promote high-confidence local knowledge to global "Hive" knowledge.
     * This creates a new, session-agnostic entry or updates an existing global one.
     */
    async broadcastKnowledge(minConfidence = 0.9) {
        console.log(`[HiveLink] Broadcasting knowledge with confidence >= ${minConfidence}`);
        // Find high-confidence items that are "local" (have a source_session_id)
        const items = await this.typedDb
            .selectFrom(this.knowledgeTable)
            .selectAll()
            .where('confidence', '>=', minConfidence)
            .where('source_session_id', 'is not', null) // Only local items
            .execute();
        let promotedCount = 0;
        for (const item of items) {
            // Check if a global version already exists
            const existingGlobal = await this.typedDb
                .selectFrom(this.knowledgeTable)
                .selectAll()
                .where('entity', '=', item.entity)
                .where('fact', '=', item.fact)
                .where('source_session_id', 'is', null)
                .executeTakeFirst();
            if (existingGlobal) {
                // Reinforce existing global knowledge
                // Calculate new confidence: average of existing and new, heavily weighted towards max
                const newConfidence = Math.min(0.99, Math.max(existingGlobal.confidence, item.confidence) + 0.01);
                await this.db
                    .updateTable(this.knowledgeTable)
                    .set({
                    confidence: newConfidence,
                    updated_at: new Date()
                })
                    .where('id', '=', existingGlobal.id)
                    .execute();
            }
            else {
                // Create new global knowledge
                const tags = item.tags ? [...item.tags] : [];
                if (!tags.includes('hive_mind'))
                    tags.push('hive_mind');
                await this.db
                    .insertInto(this.knowledgeTable)
                    .values({
                    entity: item.entity,
                    fact: item.fact,
                    confidence: item.confidence, // Carry over confidence
                    source_session_id: null, // Global
                    tags: JSON.stringify(tags),
                    metadata: JSON.stringify({
                        ...item.metadata,
                        promoted_from: item.id,
                        promoted_at: new Date()
                    }),
                    created_at: new Date(),
                    updated_at: new Date()
                })
                    .execute();
                promotedCount++;
            }
        }
        return promotedCount;
    }
    /**
     * Strengthen knowledge related to a specific domain (tag).
     * Increases confidence of all items with this tag, representing "domain mastery".
     */
    async syncDomain(domainTag, boostFactor = 0.05) {
        console.log(`[HiveLink] Syncing/Boosting domain '${domainTag}'`);
        // Find items with this tag
        // Note: simplified tag matching using LIKE for JSON array
        const items = await this.typedDb
            .selectFrom(this.knowledgeTable)
            .selectAll()
            .where('tags', 'like', `%"${domainTag}"%`)
            .execute();
        let updatedCount = 0;
        for (const item of items) {
            if (item.confidence >= 1.0)
                continue;
            const newConfidence = Math.min(1.0, item.confidence + boostFactor);
            await this.db
                .updateTable(this.knowledgeTable)
                .set({
                confidence: newConfidence,
                updated_at: new Date()
            })
                .where('id', '=', item.id)
                .execute();
            updatedCount++;
        }
        return updatedCount;
    }
    /**
     * Propagate high-performing capabilities globally and block known-bad ones.
     */
    async broadcastSkills() {
        if (!this.config.evolution?.enableHiveLink && this.config.evolution !== undefined) {
            console.log('[HiveLink] Skill broadcasting disabled by config.');
            return 0;
        }
        console.log(`[HiveLink] Broadcasting emergent skills across the Hive...`);
        let broadcastCount = 0;
        // Broadcast Verified Skills
        const verifiedSkills = await this.cortex.capabilities.getCapabilities('verified');
        for (const skill of verifiedSkills) {
            const meta = typeof skill.metadata === 'string' ? JSON.parse(skill.metadata) : (skill.metadata || {});
            if (!meta.broadcasted) {
                // In a real multi-agent deployment, this would push to a centralized external registry
                // For the local DB simulating a hive, we flag it as universally available/broadcasted
                await this.db.updateTable(this.config.capabilitiesTable || 'agent_capabilities')
                    .set({
                    metadata: JSON.stringify({ ...meta, broadcasted: true, hive_verified: true })
                })
                    .where('id', '=', skill.id)
                    .execute();
                broadcastCount++;
            }
        }
        // Broadcast Blacklisted Skills (Immune system response)
        const blacklistedSkills = await this.cortex.capabilities.getCapabilities('blacklisted');
        for (const skill of blacklistedSkills) {
            const meta = typeof skill.metadata === 'string' ? JSON.parse(skill.metadata) : (skill.metadata || {});
            if (!meta.broadcasted) {
                await this.db.updateTable(this.config.capabilitiesTable || 'agent_capabilities')
                    .set({
                    metadata: JSON.stringify({ ...meta, broadcasted: true, hive_blacklisted: true })
                })
                    .where('id', '=', skill.id)
                    .execute();
                broadcastCount++;
            }
        }
        return broadcastCount;
    }
}
exports.HiveLink = HiveLink;
