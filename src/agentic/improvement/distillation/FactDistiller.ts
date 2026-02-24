import type { Kysely } from '../../../kysely.js'
import type { AgenticConfig, KnowledgeItem } from '../../../types/index.js'

export class FactDistiller {
    /**
     * typedDb helper (internal use)
     */
    private getTypedDb(db: Kysely<any>): Kysely<any> {
        return db as any
    }

    async distillExact(
        trx: any,
        knowledgeTable: string,
        entity: string,
        fact: string,
        confidence: number,
        sourceSessionId?: string | number,
        tags: string[] = [],
        metadata: Record<string, any> = {},
        source: 'user' | 'assistant' | 'system' = 'assistant',
    ): Promise<any | null> {
        // Check for exact match
        const existing = await trx
            .selectFrom(knowledgeTable as any)
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
            const sessions = new Set(existingMeta.sessions || [])
            if (sourceSessionId) sessions.add(sourceSessionId)

            const mergedMeta = {
                ...existingMeta,
                ...metadata,
                sessions: Array.from(sessions),
                session_count: sessions.size,
            }

            // Source weighting
            const boost = source === 'user' ? 0.2 : 0.05
            const finalConfidence = Math.min(1.0, (existing.confidence as number) + boost)

            // Status Lifecycle
            let finalStatus = existing.status || 'proposed'
            if (source === 'user' || mergedMeta.session_count >= 3) {
                finalStatus = 'verified'
            }

            return await trx
                .updateTable(knowledgeTable as any)
                .set({
                    confidence: finalConfidence,
                    status: finalStatus,
                    tags: JSON.stringify(mergedTags),
                    metadata: JSON.stringify(mergedMeta),
                    updated_at: new Date(),
                    source_session_id: sourceSessionId ?? existing.source_session_id,
                })
                .where('id', '=', existing.id)
                .returningAll()
                .executeTakeFirstOrThrow()
        }

        return null
    }

    async createInitial(
        trx: any,
        knowledgeTable: string,
        entity: string,
        fact: string,
        confidence: number,
        sourceSessionId?: string | number,
        tags: string[] = [],
        metadata: Record<string, any> = {},
        source: 'user' | 'assistant' | 'system' = 'assistant',
    ): Promise<any> {
        const initialMeta = {
            ...metadata,
            source,
            sessions: sourceSessionId ? [sourceSessionId] : [],
            session_count: sourceSessionId ? 1 : 0,
        }

        return await trx
            .insertInto(knowledgeTable as any)
            .values({
                entity,
                fact,
                confidence: source === 'user' ? Math.max(confidence, 0.8) : confidence,
                status: source === 'user' ? 'verified' : 'proposed',
                source_session_id: sourceSessionId ?? null,
                tags: JSON.stringify(tags),
                metadata: JSON.stringify(initialMeta),
                created_at: new Date(),
                updated_at: new Date(),
            })
            .returningAll()
            .executeTakeFirstOrThrow()
    }

    async verify(
        db: Kysely<any>,
        knowledgeTable: string,
        id: number | string,
        reinforcement: number = 0.1,
    ): Promise<any | null> {
        const existing = await db
            .selectFrom(knowledgeTable as any)
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst()

        if (!existing) return null

        const metadata = typeof (existing as any).metadata === 'string'
            ? JSON.parse((existing as any).metadata)
            : (existing as any).metadata || {}

        // Hallucination Guard
        let maxConfidence = 1.0
        if (metadata.source !== 'user' && (metadata.session_count || 0) < 3) {
            maxConfidence = 0.85
        }

        const newConfidence = Math.min(maxConfidence, ((existing as any).confidence as number) + reinforcement)

        // Promotion Lifecycle
        let newStatus = (existing as any).status || 'proposed'
        if (newConfidence >= 0.9 || metadata.session_count >= 3) {
            newStatus = 'verified'
        }

        return await db
            .updateTable(knowledgeTable as any)
            .set({
                confidence: newConfidence,
                status: newStatus,
                updated_at: new Date(),
            })
            .where('id', '=', id)
            .returningAll()
            .executeTakeFirstOrThrow()
    }
}
