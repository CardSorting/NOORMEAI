import type { Kysely } from '../../kysely.js'
import type {
    AgenticConfig,
    KnowledgeItem
} from '../../types/index.js'
import type { Cortex } from '../Cortex.js'
import type { KnowledgeDatabase } from './KnowledgeDistiller.js'

/**
 * HiveLink facilitates "Collective Intelligence" by synchronizing
 * knowledge and lessons learned across different agent personas.
 */
export class HiveLink {
    private knowledgeTable: string

    constructor(
        private db: Kysely<any>,
        private cortex: Cortex,
        private config: AgenticConfig = {}
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
        console.log(`[HiveLink] Broadcasting knowledge with confidence >= ${minConfidence}`)

        // Find high-confidence items that are "local" (have a source_session_id)
        const items = await this.typedDb
            .selectFrom(this.knowledgeTable as any)
            .selectAll()
            .where('confidence', '>=', minConfidence)
            .where('source_session_id', 'is not', null) // Only local items
            .execute() as unknown as KnowledgeItem[]

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
                const newConfidence = Math.min(0.99, Math.max(existingGlobal.confidence, item.confidence) + 0.01)
                
                await this.db
                    .updateTable(this.knowledgeTable as any)
                    .set({ 
                        confidence: newConfidence,
                        updated_at: new Date()
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
                            promoted_at: new Date()
                        }),
                        created_at: new Date(),
                        updated_at: new Date()
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
    async syncDomain(domainTag: string, boostFactor: number = 0.05): Promise<number> {
        console.log(`[HiveLink] Syncing/Boosting domain '${domainTag}'`)
        
        // Find items with this tag
        // Note: simplified tag matching using LIKE for JSON array
        const items = await this.typedDb
            .selectFrom(this.knowledgeTable as any)
            .selectAll()
            .where('tags', 'like', `%"${domainTag}"%`)
            .execute() as unknown as KnowledgeItem[]

        let updatedCount = 0

        for (const item of items) {
            if (item.confidence >= 1.0) continue

            const newConfidence = Math.min(1.0, item.confidence + boostFactor)
            
            await this.db
                .updateTable(this.knowledgeTable as any)
                .set({
                    confidence: newConfidence,
                    updated_at: new Date()
                } as any)
                .where('id', '=', item.id)
                .execute()
            
            updatedCount++
        }

        return updatedCount
    }
}
