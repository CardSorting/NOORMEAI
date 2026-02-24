import type { Kysely, Transaction } from '../../../kysely.js'
import type { KnowledgeItem } from '../../../types/index.js'
import { calculateSimilarity } from '../../../util/similarity.js'

export class RelationshipArchitect {
    async autoLink(
        item: KnowledgeItem,
        trx: Transaction<any>,
        knowledgeTable: string,
        linksTable: string
    ): Promise<void> {
        // 1. Structural Extraction (NER-style)
        const tokens = item.fact.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)|("[^"]+")|([a-z]+[A-Z][a-z]+)/g) || []
        const potentialEntities = Array.from(new Set(tokens.map((t) => t.replace(/"/g, '').trim())))
            .filter((t) => t.length > 2 && t !== item.entity)

        if (potentialEntities.length > 0) {
            const matches = await trx
                .selectFrom(knowledgeTable as any)
                .select(['id', 'entity'])
                .where('entity', 'in', potentialEntities)
                .execute()

            for (const match of matches) {
                await this.link(item.id, match.id, 'mentions', { auto: true, source: 'structural_extraction' }, trx, linksTable)
            }
        }

        // 2. Semantic Similarity Pass
        const candidates = await trx
            .selectFrom(knowledgeTable as any)
            .selectAll()
            .where('id', '!=', item.id)
            .where('confidence', '>', 0.4)
            .orderBy('updated_at', 'desc')
            .limit(50)
            .execute()

        const linksToCreate: { targetId: number | string; sim: number }[] = []
        for (const other of candidates) {
            const otherFact = (other as any).fact
            const sim = calculateSimilarity(item.fact, otherFact)
            if (sim > 0.75) {
                linksToCreate.push({ targetId: (other as any).id, sim })
            }
        }

        for (const l of linksToCreate) {
            await this.link(item.id, l.targetId, 'semantically_related', { similarity: l.sim, version: '2.0' }, trx, linksTable)
        }
    }

    async link(
        sourceId: number | string,
        targetId: number | string,
        relationship: string,
        metadata: Record<string, any> | undefined,
        trxOrDb: any,
        linksTable: string
    ): Promise<void> {
        if (sourceId === targetId) return

        const existing = await trxOrDb
            .selectFrom(linksTable as any)
            .select('id')
            .where('source_id', '=', sourceId)
            .where('target_id', '=', targetId)
            .where('relationship', '=', relationship)
            .executeTakeFirst()

        if (existing) {
            await trxOrDb
                .updateTable(linksTable as any)
                .set({ metadata: metadata ? JSON.stringify(metadata) : null })
                .where('id', '=', existing.id)
                .execute()
        } else {
            await trxOrDb
                .insertInto(linksTable as any)
                .values({
                    source_id: sourceId,
                    target_id: targetId,
                    relationship,
                    metadata: metadata ? JSON.stringify(metadata) : null,
                    created_at: new Date(),
                })
                .execute()
        }
    }
}
