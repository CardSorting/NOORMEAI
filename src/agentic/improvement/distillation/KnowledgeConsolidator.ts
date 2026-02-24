import type { Kysely } from '../../../kysely.js'
import type { KnowledgeItem } from '../../../types/index.js'
import { calculateSimilarity } from '../../../util/similarity.js'

export class KnowledgeConsolidator {
    async consolidate(
        db: Kysely<any>,
        knowledgeTable: string,
        getKnowledgeByEntityFn: (entity: string) => Promise<KnowledgeItem[]>
    ): Promise<number> {
        let totalMerged = 0
        const candidates = await db
            .selectFrom(knowledgeTable as any)
            .select('entity')
            .groupBy('entity')
            .having((eb: any) => eb.fn.count('id'), '>', 1 as any)
            .limit(500)
            .execute()

        for (const cand of candidates) {
            const entity = (cand as any).entity
            const items = await getKnowledgeByEntityFn(entity)
            const mergedIds = new Set<string | number>()
            const iterLimit = Math.min(items.length, 100)

            for (let i = 0; i < iterLimit; i++) {
                if (mergedIds.has(items[i].id)) continue
                for (let j = i + 1; j < iterLimit; j++) {
                    if (mergedIds.has(items[j].id)) continue
                    const sim = calculateSimilarity(items[i].fact, items[j].fact)
                    if (sim > 0.85) {
                        await this.mergeItems(db, knowledgeTable, items[i], items[j])
                        mergedIds.add(items[j].id)
                        totalMerged++
                    }
                }
            }
        }
        return totalMerged
    }

    private async mergeItems(
        db: Kysely<any>,
        knowledgeTable: string,
        primary: KnowledgeItem,
        secondary: KnowledgeItem,
    ): Promise<void> {
        const mergedMeta = {
            ...secondary.metadata,
            ...primary.metadata,
            consolidated_from: secondary.id,
            consolidated_at: new Date().toISOString(),
        }

        const mergedTags = Array.from(new Set([...(primary.tags || []), ...(secondary.tags || [])]))

        await db.transaction().execute(async (trx) => {
            await trx
                .updateTable(knowledgeTable as any)
                .set({
                    confidence: Math.max(primary.confidence, secondary.confidence),
                    metadata: JSON.stringify(mergedMeta),
                    tags: JSON.stringify(mergedTags),
                    updated_at: new Date(),
                })
                .where('id', '=', primary.id)
                .execute()

            await trx
                .deleteFrom(knowledgeTable as any)
                .where('id', '=', secondary.id)
                .execute()
        })
    }
}
