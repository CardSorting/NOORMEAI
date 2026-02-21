import type { Kysely } from '../kysely.js'
import type { VectorConfig, AgentMemory } from '../types/index.js'

export interface MemoryTable {
    id: number | string
    session_id: number | string | null
    content: string
    embedding: string | null // JSON string
    metadata: string | null // JSON string
    created_at: string | Date
}

export interface VectorDatabase {
    agent_memories: MemoryTable
}

/**
 * VectorIndexer provides a unified interface for semantic search
 * across different database dialects (PGVector, SQLite-vss) with a manual fallback.
 */
export class VectorIndexer {
    private memoriesTable: string

    constructor(
        private db: Kysely<any>,
        private config: VectorConfig,
        memoriesTable: string = 'agent_memories'
    ) {
        this.memoriesTable = memoriesTable
    }

    private get typedDb(): Kysely<VectorDatabase> {
        return this.db as unknown as Kysely<VectorDatabase>
    }

    /**
     * Add a memory with an embedding
     */
    async addMemory(content: string, embedding: number[], sessionId?: string | number, metadata?: Record<string, any>): Promise<AgentMemory> {
        const memory = await this.typedDb
            .insertInto(this.memoriesTable as any)
            .values({
                content,
                embedding: JSON.stringify(embedding),
                session_id: sessionId || null,
                metadata: metadata ? JSON.stringify(metadata) : null,
                created_at: new Date()
            } as any)
            .returningAll()
            .executeTakeFirstOrThrow()

        return this.parseMemory(memory)
    }

    /**
     * Search for similar memories
     */
    async search(embedding: number[], options: { limit?: number, sessionId?: string | number } = {}): Promise<AgentMemory[]> {
        const { limit = 5, sessionId } = options

        if (this.config.provider === 'pgvector') {
            let query = this.typedDb
                .selectFrom(this.memoriesTable as any)
                .selectAll()
                .orderBy((eb: any) => eb.raw(`embedding <=> '[${embedding.join(',')}]'::vector`))
                .limit(limit)

            if (sessionId) {
                query = query.where('session_id', '=', sessionId)
            }
            const results = await query.execute()
            return results.map(m => this.parseMemory(m))
        }

        if (this.config.provider === 'sqlite-vss') {
            try {
                const result = await this.db
                    .selectFrom(this.memoriesTable as any)
                    .selectAll()
                    .where((eb: any) => eb.raw(`rowid IN (SELECT rowid FROM vss_${this.memoriesTable} WHERE embedding_column = ? LIMIT ?)`, [JSON.stringify(embedding), limit]))
                    .execute()
                return result.map((m: any) => this.parseMemory(m))
            } catch (e) {
                console.warn('[VectorIndexer] SQLite-vss search failed, falling back to manual search:', e)
                // Fallback to manual
            }
        }

        // Manual Fallback (Cosine Similarity in-memory)
        // Warning: This is slow for large datasets, but works universally.
        let query = this.typedDb.selectFrom(this.memoriesTable as any).selectAll()
        if (sessionId) {
            query = query.where('session_id', '=', sessionId)
        }
        
        // Optimization: Retrieve only recent memories if no better index exists
        if (!sessionId) {
            query = query.orderBy('created_at', 'desc').limit(1000)
        }

        const allMemories = await query.execute()
        
        const scored = allMemories.map(mem => {
            const vec = typeof mem.embedding === 'string' ? JSON.parse(mem.embedding) : []
            const score = this.cosineSimilarity(embedding, vec)
            return { memory: mem, score }
        })

        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(item => this.parseMemory(item.memory))
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length || a.length === 0) return 0
        let dot = 0
        let magA = 0
        let magB = 0
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i]
            magA += a[i] * a[i]
            magB += b[i] * b[i]
        }
        return dot / (Math.sqrt(magA) * Math.sqrt(magB))
    }

    private parseMemory(m: any): AgentMemory {
        return {
            id: m.id,
            sessionId: m.session_id,
            content: m.content,
            embedding: typeof m.embedding === 'string' ? JSON.parse(m.embedding) : (m.embedding || []),
            metadata: typeof m.metadata === 'string' ? JSON.parse(m.metadata) : (m.metadata || {}),
            createdAt: new Date(m.created_at)
        }
    }
}
