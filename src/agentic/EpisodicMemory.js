"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EpisodicMemory = void 0;
/**
 * EpisodicMemory groups interactions into semantic chunks (episodes),
 * allowing agents to recall specific scenarios and their outcomes.
 */
class EpisodicMemory {
    db;
    config;
    episodesTable;
    constructor(db, config = {}) {
        this.db = db;
        this.config = config;
        this.episodesTable = config.episodesTable || 'agent_episodes';
    }
    get typedDb() {
        return this.db;
    }
    /**
     * Start a new episode
     */
    async startEpisode(sessionId, name, metadata) {
        const episode = await this.typedDb
            .insertInto(this.episodesTable)
            .values({
            session_id: sessionId,
            name,
            status: 'active',
            start_time: new Date(),
            metadata: metadata ? JSON.stringify(metadata) : null
        })
            .returningAll()
            .executeTakeFirstOrThrow();
        return this.parseEpisode(episode);
    }
    /**
     * Complete an episode with a summary
     */
    async completeEpisode(episodeId, summary, metadata) {
        return await this.db.transaction().execute(async (trx) => {
            const existing = await trx
                .selectFrom(this.episodesTable)
                .select('metadata')
                .where('id', '=', episodeId)
                .executeTakeFirst();
            const oldMeta = typeof existing?.metadata === 'string'
                ? JSON.parse(existing.metadata)
                : existing?.metadata || {};
            const newMeta = { ...oldMeta, ...metadata };
            const episode = await trx
                .updateTable(this.episodesTable)
                .set({
                status: 'completed',
                summary,
                end_time: new Date(),
                metadata: JSON.stringify(newMeta)
            })
                .where('id', '=', episodeId)
                .returningAll()
                .executeTakeFirstOrThrow();
            return this.parseEpisode(episode);
        });
    }
    /**
     * Get all episodes for a session.
     */
    async getSessionEpisodes(sessionId) {
        const list = await this.typedDb
            .selectFrom(this.episodesTable)
            .selectAll()
            .where('session_id', '=', sessionId)
            .orderBy('start_time', 'desc')
            .execute();
        return list.map(e => this.parseEpisode(e));
    }
    /**
     * Get recently completed episodes across all sessions.
     */
    async getRecentEpisodes(limit = 10) {
        const list = await this.typedDb
            .selectFrom(this.episodesTable)
            .selectAll()
            .where('status', '=', 'completed')
            .orderBy('end_time', 'desc')
            .limit(limit)
            .execute();
        return list.map(e => this.parseEpisode(e));
    }
    parseEpisode(episode) {
        return {
            id: episode.id,
            sessionId: episode.session_id,
            name: episode.name,
            summary: episode.summary || undefined,
            status: episode.status,
            startTime: new Date(episode.start_time),
            endTime: episode.end_time ? new Date(episode.end_time) : undefined,
            metadata: typeof episode.metadata === 'string' ? JSON.parse(episode.metadata) : (episode.metadata || {})
        };
    }
}
exports.EpisodicMemory = EpisodicMemory;
