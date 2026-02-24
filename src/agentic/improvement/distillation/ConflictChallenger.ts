import type { Kysely } from '../../../kysely.js'

export class ConflictChallenger {
    async challenge(
        trxOrDb: any,
        knowledgeTable: string,
        entity: string,
        competingFact: string,
        confidence: number,
        parseKnowledgeFn: (item: any) => any
    ): Promise<void> {
        // Semantic sanitization
        const safeFact = competingFact.slice(0, 500).replace(/[\u0000-\u001F\u007F-\u009F]/g, '').replace(/<\|.*?\|>/g, '')

        const existingItems = await trxOrDb
            .selectFrom(knowledgeTable as any)
            .selectAll()
            .where('entity', '=', entity)
            .orderBy('confidence', 'desc')
            .execute()

        for (const item of existingItems) {
            const parsedItem = parseKnowledgeFn(item)
            if (parsedItem.fact === competingFact) continue

            // Deep Hardening: Conflict detection
            if (confidence > 0.8) {
                let newMeta = { ...parsedItem.metadata }
                let penalty = 0.2
                let newStatus = parsedItem.status

                if (parsedItem.confidence > 0.7) {
                    newStatus = 'disputed'
                    newMeta = {
                        ...newMeta,
                        status_reason: `Contradicted by: ${safeFact}`,
                    }
                    penalty = 0.1
                } else {
                    newStatus = 'deprecated'
                    newMeta = {
                        ...newMeta,
                        status_reason: `Superseded by: ${safeFact}`,
                    }
                    penalty = 0.4
                }

                const newConfidence = Math.max(0, parsedItem.confidence - penalty)

                await trxOrDb
                    .updateTable(knowledgeTable as any)
                    .set({
                        confidence: newConfidence,
                        status: newStatus,
                        metadata: JSON.stringify(newMeta),
                        updated_at: new Date(),
                    } as any)
                    .where('id', '=', parsedItem.id)
                    .execute()
            }
        }
    }
}
