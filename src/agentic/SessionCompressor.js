"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionCompressor = void 0;
/**
 * SessionCompressor handles summarizing long conversation segments into Epochs.
 * This keeps the context window lean while preserving high-level history.
 */
class SessionCompressor {
    db;
    config;
    epochsTable;
    constructor(db, config = {}) {
        this.db = db;
        this.config = config;
        this.epochsTable = config.epochsTable || 'agent_epochs';
    }
    /**
     * Compress a range of messages into an Epoch, preserving key Semantic Anchors.
     */
    async compress(sessionId, summary, startMessageId, endMessageId, anchors = [], metadata) {
        console.log(`[SessionCompressor] Compressing session ${sessionId} with ${anchors.length} semantic anchors.`);
        const epoch = await this.db
            .insertInto(this.epochsTable)
            .values({
            session_id: sessionId,
            summary,
            start_message_id: startMessageId,
            end_message_id: endMessageId,
            metadata: metadata || anchors.length > 0
                ? JSON.stringify({ ...metadata, anchors })
                : null,
            created_at: new Date()
        })
            .returningAll()
            .executeTakeFirstOrThrow();
        return this.parseEpoch(epoch);
    }
    /**
     * Prune messages that are not marked as anchors or highly relevant.
     * Deletes non-anchor messages for a session to save space and context.
     */
    async semanticPruning(sessionId, keepAnchors = true) {
        console.log(`[SessionCompressor] Performing semantic pruning for session ${sessionId}...`);
        const messagesTable = this.config.messagesTable || 'agent_messages';
        let query = this.db
            .deleteFrom(messagesTable)
            .where('session_id', '=', sessionId);
        if (keepAnchors) {
            // Assume anchors are marked in metadata. We check for common JSON patterns.
            query = query.where((eb) => eb.or([
                eb('metadata', 'is', null),
                eb.and([
                    eb('metadata', 'not like', '%"anchor":true%'),
                    eb('metadata', 'not like', '%"anchor": true%')
                ])
            ]));
        }
        const result = await query.execute();
        const count = Number(result[0]?.numDeletedRows || 0);
        // Hierarchical Optimization: If too many epochs exist, consolidate them into an "Era"
        await this.consolidateEpochsIntoEra(sessionId);
        console.log(`[SessionCompressor] Pruned ${count} non-anchor messages from session ${sessionId}`);
        return count;
    }
    /**
     * Consolidate old epochs into a single Era-level summary to preserve extremely long-term context.
     */
    async consolidateEpochsIntoEra(sessionId) {
        const epochs = await this.getEpochs(sessionId);
        if (epochs.length > 10) {
            console.log(`[SessionCompressor] Consolidating ${epochs.length} epochs into a new Era for session ${sessionId}`);
            const summary = `Consolidated era summary of ${epochs.length} epochs: ` +
                epochs.slice(0, 5).map(e => e.summary).join('; ') + '...';
            const eraMetadata = {
                type: 'era',
                original_epochs: epochs.length,
                consolidated_at: new Date().toISOString()
            };
            // In this version, we mark the new epoch as an "Era" in metadata
            const consolidatedEpoch = await this.compress(sessionId, summary, epochs[0].startMessageId, epochs[epochs.length - 1].endMessageId, [], eraMetadata);
            // Era Reification: Inject a special system message into the session history
            // that summarizes this entire era, ensuring permanent narrative continuity.
            const messagesTable = this.config.messagesTable || 'agent_messages';
            await this.db
                .insertInto(messagesTable)
                .values({
                session_id: sessionId,
                role: 'system',
                content: `[ERA SUMMARY] This era covers the initial phases of the session. Key takeaways: ${summary}`,
                metadata: JSON.stringify({ anchor: true, type: 'era_reification', epoch_id: consolidatedEpoch.id }),
                created_at: new Date()
            })
                .execute();
            // Prune old epochs that were consolidated
            const epochIds = epochs.map(e => e.id);
            await this.db
                .deleteFrom(this.epochsTable)
                .where('id', 'in', epochIds)
                .execute();
        }
    }
    /**
     * Get epochs for a session
     */
    async getEpochs(sessionId) {
        const list = await this.db
            .selectFrom(this.epochsTable)
            .selectAll()
            .where('session_id', '=', sessionId)
            .orderBy('created_at', 'asc')
            .execute();
        return list.map(e => this.parseEpoch(e));
    }
    parseEpoch(e) {
        return {
            ...e,
            sessionId: e.session_id,
            startMessageId: e.start_message_id,
            endMessageId: e.end_message_id,
            metadata: typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata,
            createdAt: new Date(e.created_at)
        };
    }
}
exports.SessionCompressor = SessionCompressor;
