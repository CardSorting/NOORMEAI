"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorIndexer = void 0;
/**
 * VectorIndexer provides a unified interface for semantic search
 * across different database dialects (PGVector, SQLite-vss) with a manual fallback.
 */
class VectorIndexer {
    db;
    config;
    memoriesTable;
    constructor(db, config, memoriesTable = 'agent_memories') {
        this.db = db;
        this.config = config;
        this.memoriesTable = memoriesTable;
    }
    get typedDb() {
        return this.db;
    }
    /**
     * Add a memory with an embedding
     */
    async addMemory(content, embedding, sessionId, metadata) {
        const memory = await this.typedDb
            .insertInto(this.memoriesTable)
            .values({
            content,
            embedding: JSON.stringify(embedding),
            session_id: sessionId || null,
            metadata: metadata ? JSON.stringify(metadata) : null,
            created_at: new Date()
        })
            .returningAll()
            .executeTakeFirstOrThrow();
        return this.parseMemory(memory);
    }
    /**
     * Batch add memories
     */
    async addMemories(items) {
        const values = items.map(item => ({
            content: item.content,
            embedding: JSON.stringify(item.embedding),
            session_id: item.sessionId || null,
            metadata: item.metadata ? JSON.stringify(item.metadata) : null,
            created_at: new Date()
        }));
        const memories = await this.typedDb
            .insertInto(this.memoriesTable)
            .values(values)
            .returningAll()
            .execute();
        return memories.map(m => this.parseMemory(m));
    }
    /**
     * Search for similar memories using Hybrid Search (Vector + Keyword)
     * and relevance thresholding.
     */
    async search(embedding, options = {}) {
        const { limit = 5, sessionId, minScore = 0.7, keyword } = options;
        let vectorResults = [];
        if (this.config.provider === 'pgvector') {
            let query = this.typedDb
                .selectFrom(this.memoriesTable)
                .selectAll()
                .orderBy((eb) => eb.raw(`embedding <=> '[${embedding.join(',')}]'::vector`))
                .limit(limit);
            if (sessionId) {
                query = query.where('session_id', '=', sessionId);
            }
            const results = await query.execute();
            vectorResults = results.map(m => this.parseMemory(m));
        }
        else if (this.config.provider === 'sqlite-vss') {
            try {
                const result = await this.db
                    .selectFrom(this.memoriesTable)
                    .selectAll()
                    .where((eb) => eb.raw(`rowid IN (SELECT rowid FROM vss_${this.memoriesTable} WHERE embedding_column = ? LIMIT ?)`, [JSON.stringify(embedding), limit]))
                    .execute();
                vectorResults = result.map((m) => this.parseMemory(m));
            }
            catch (e) {
                console.warn('[VectorIndexer] SQLite-vss search failed, falling back to manual search:', e);
            }
        }
        if (vectorResults.length === 0) {
            // Manual Fallback (Cosine Similarity in-memory)
            let query = this.typedDb.selectFrom(this.memoriesTable).selectAll();
            if (sessionId) {
                query = query.where('session_id', '=', sessionId);
            }
            if (!sessionId) {
                query = query.orderBy('created_at', 'desc').limit(1000);
            }
            const allMemories = await query.execute();
            const scored = allMemories.map(mem => {
                const vec = typeof mem.embedding === 'string' ? JSON.parse(mem.embedding) : (mem.embedding || []);
                const score = this.cosineSimilarity(embedding, vec);
                return { memory: mem, score };
            });
            vectorResults = scored
                .sort((a, b) => b.score - a.score)
                .slice(0, limit)
                .map(item => this.parseMemory(item.memory));
        }
        // Keyword Search (Hybrid component)
        let keywordResults = [];
        if (keyword) {
            keywordResults = await this.keywordSearch(keyword, { limit, sessionId });
        }
        // Merge and fuse using Reciprocal Rank Fusion (RRF)
        const fused = this.mergeWithRRF(vectorResults, keywordResults, limit);
        // Final filtering and confidence assessment
        const finalResults = fused.filter(m => {
            const vec = m.embedding || [];
            const score = this.cosineSimilarity(embedding, vec);
            // Even with RRF, we keep a safety floor for semantic relevance
            return score >= (minScore * 0.8);
        });
        return finalResults.slice(0, limit);
    }
    async keywordSearch(keyword, options) {
        const { limit, sessionId } = options;
        let query = this.typedDb
            .selectFrom(this.memoriesTable)
            .selectAll();
        // Production Hardening: Use native FTS where available
        if (this.config.provider === 'sqlite-vss') {
            // Check for virtual FTS table (convention: table_name_fts)
            try {
                query = query.where((eb) => eb.raw(`rowid IN (SELECT rowid FROM ${this.memoriesTable}_fts WHERE ${this.memoriesTable}_fts MATCH ?)`, [keyword]));
            }
            catch (e) {
                // Fallback to LIKE if FTS table doesn't exist
                query = query.where('content', 'like', `%${keyword}%`);
            }
        }
        else if (this.config.provider === 'pgvector') {
            // Postgres tsvector support
            query = query.where((eb) => eb.raw(`to_tsvector('english', content) @@ plainto_tsquery('english', ?)`, [keyword]));
        }
        else {
            query = query.where('content', 'like', `%${keyword}%`);
        }
        if (sessionId) {
            query = query.where('session_id', '=', sessionId);
        }
        const results = await query.limit(limit).execute();
        return results.map(r => this.parseMemory(r));
    }
    /**
     * Reciprocal Rank Fusion (RRF)
     * score = sum(1 / (k + rank))
     */
    mergeWithRRF(vector, keyword, limit, k = 60) {
        const scores = {};
        // Rank vector results
        vector.forEach((m, i) => {
            const rank = i + 1;
            if (!scores[m.id])
                scores[m.id] = { score: 0, memory: m };
            scores[m.id].score += 1 / (k + rank);
        });
        // Rank keyword results
        keyword.forEach((m, i) => {
            const rank = i + 1;
            if (!scores[m.id])
                scores[m.id] = { score: 0, memory: m };
            scores[m.id].score += 1 / (k + rank);
        });
        // Sort by fused score
        return Object.values(scores)
            .sort((a, b) => b.score - a.score)
            .map(s => s.memory);
    }
    mergeResults(vector, keyword) {
        const seen = new Set();
        const merged = [];
        for (const m of [...keyword, ...vector]) {
            if (!seen.has(m.id)) {
                seen.add(m.id);
                merged.push(m);
            }
        }
        return merged;
    }
    cosineSimilarity(a, b) {
        if (a.length !== b.length || a.length === 0)
            return 0;
        let dot = 0;
        let magA = 0;
        let magB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            magA += a[i] * a[i];
            magB += b[i] * b[i];
        }
        return dot / (Math.sqrt(magA) * Math.sqrt(magB));
    }
    parseMemory(m) {
        return {
            id: m.id,
            sessionId: m.session_id,
            content: m.content,
            embedding: typeof m.embedding === 'string' ? JSON.parse(m.embedding) : (m.embedding || []),
            metadata: typeof m.metadata === 'string' ? JSON.parse(m.metadata) : (m.metadata || {}),
            createdAt: new Date(m.created_at)
        };
    }
}
exports.VectorIndexer = VectorIndexer;
