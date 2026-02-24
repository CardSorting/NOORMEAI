import type { Kysely } from '../../../kysely.js'
import type { AgenticConfig, KnowledgeItem } from '../../../types/index.js'
import type { Cortex } from '../../Cortex.js'

export class KnowledgePromoter {
    async promote(
        db: Kysely<any>,
        cortex: Cortex,
        config: AgenticConfig,
        knowledgeTable: string,
        item: KnowledgeItem
    ): Promise<boolean> {
        return await db.transaction().execute(async (trx) => {
            // Check if a global version already exists
            const existingGlobal = await trx
                .selectFrom(knowledgeTable as any)
                .selectAll()
                .where('entity', '=', item.entity)
                .where('fact', '=', item.fact)
                .where('source_session_id', 'is', null)
                .forUpdate() // Prevent concurrent promotion duplication
                .executeTakeFirst()

            if (existingGlobal) {
                // Reinforce existing global knowledge
                const newConfidence = Math.min(
                    0.99,
                    Math.max((existingGlobal as any).confidence, item.confidence) + 0.01,
                )

                await trx
                    .updateTable(knowledgeTable as any)
                    .set({
                        confidence: newConfidence,
                        updated_at: new Date(),
                    } as any)
                    .where('id', '=', (existingGlobal as any).id)
                    .execute()
                return false
            } else {
                // Create new global knowledge
                const tags = item.tags ? [...item.tags] : []
                if (!tags.includes('hive_mind')) tags.push('hive_mind')

                await trx
                    .insertInto(knowledgeTable as any)
                    .values({
                        entity: item.entity,
                        fact: item.fact,
                        confidence: item.confidence,
                        source_session_id: null,
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
                return true
            }
        })
    }
}
