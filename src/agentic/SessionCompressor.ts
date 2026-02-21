import type { Kysely } from '../kysely.js'
import type {
    AgenticConfig,
    AgentMessage,
    AgentEpoch
} from '../types/index.js'

/**
 * SessionCompressor handles summarizing long conversation segments into Epochs.
 * This keeps the context window lean while preserving high-level history.
 */
export class SessionCompressor {
    private epochsTable: string

    constructor(
        private db: Kysely<any>,
        private config: AgenticConfig = {}
    ) {
        this.epochsTable = config.epochsTable || 'agent_epochs'
    }

    /**
     * Compress a range of messages into an Epoch, preserving key Semantic Anchors.
     */
    async compress(
        sessionId: string | number,
        summary: string,
        startMessageId: string | number,
        endMessageId: string | number,
        anchors: string[] = [],
        metadata?: Record<string, any>
    ): Promise<AgentEpoch> {
        console.log(`[SessionCompressor] Compressing session ${sessionId} with ${anchors.length} semantic anchors.`)

        const epoch = await this.db
            .insertInto(this.epochsTable as any)
            .values({
                session_id: sessionId,
                summary,
                start_message_id: startMessageId,
                end_message_id: endMessageId,
                metadata: metadata || anchors.length > 0
                    ? JSON.stringify({ ...metadata, anchors })
                    : null,
                created_at: new Date()
            } as any)
            .returningAll()
            .executeTakeFirstOrThrow() as unknown as AgentEpoch

        return this.parseEpoch(epoch)
    }

    /**
     * Prune messages that are not marked as anchors or highly relevant.
     * Deletes non-anchor messages for a session to save space and context.
     */
    async semanticPruning(sessionId: string | number, keepAnchors: boolean = true): Promise<number> {
        console.log(`[SessionCompressor] Performing semantic pruning for session ${sessionId}...`)

        const messagesTable = this.config.messagesTable || 'agent_messages'

        let query = this.db
            .deleteFrom(messagesTable as any)
            .where('session_id', '=', sessionId)

        if (keepAnchors) {
            // Assume anchors are marked in metadata. We check for common JSON patterns.
            // This is a best-effort approach that works across SQLite and Postgres.
            query = query.where((eb: any) => eb.or([
                eb('metadata', 'is', null),
                eb.and([
                    eb('metadata', 'not like', '%"anchor":true%'),
                    eb('metadata', 'not like', '%"anchor": true%')
                ])
            ]))
        }

        const result = await query.execute()
        const count = Number(result[0]?.numDeletedRows || 0)

        console.log(`[SessionCompressor] Pruned ${count} non-anchor messages from session ${sessionId}`)
        return count
    }

    /**
     * Get epochs for a session
     */
    async getEpochs(sessionId: string | number): Promise<AgentEpoch[]> {
        const list = await this.db
            .selectFrom(this.epochsTable as any)
            .selectAll()
            .where('session_id' as any, '=', sessionId)
            .orderBy('created_at' as any, 'asc')
            .execute() as unknown as AgentEpoch[]

        return list.map(e => this.parseEpoch(e))
    }

    private parseEpoch(e: any): AgentEpoch {
        return {
            ...e,
            sessionId: e.session_id,
            startMessageId: e.start_message_id,
            endMessageId: e.end_message_id,
            metadata: typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata,
            createdAt: new Date(e.created_at)
        }
    }
}
