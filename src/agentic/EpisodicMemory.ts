import type { Kysely } from '../kysely.js'
import type { AgenticConfig, AgentEpisode } from '../types/index.js'

export interface EpisodeTable {
  id: number | string
  session_id: number | string
  name: string
  summary: string | null
  status: 'active' | 'completed'
  start_time: string | Date
  end_time: string | Date | null
  metadata: string | null // JSON string
}

export interface EpisodeDatabase {
  agent_episodes: EpisodeTable
}

/**
 * EpisodicMemory groups interactions into semantic chunks (episodes),
 * allowing agents to recall specific scenarios and their outcomes.
 */
export class EpisodicMemory {
  private episodesTable: string

  constructor(
    private db: Kysely<any>,
    private config: AgenticConfig = {},
  ) {
    this.episodesTable = config.episodesTable || 'agent_episodes'
  }

  private get typedDb(): Kysely<EpisodeDatabase> {
    return this.db as unknown as Kysely<EpisodeDatabase>
  }

  /**
   * Start a new episode
   */
  async startEpisode(
    sessionId: string | number,
    name: string,
    metadata?: Record<string, any>,
  ): Promise<AgentEpisode> {
    const episode = await this.typedDb
      .insertInto(this.episodesTable as any)
      .values({
        session_id: sessionId,
        name,
        status: 'active',
        start_time: new Date(),
        metadata: metadata ? JSON.stringify(metadata) : null,
      } as any)
      .returningAll()
      .executeTakeFirstOrThrow()

    return this.parseEpisode(episode)
  }

  /**
   * Complete an episode with a summary
   */
  async completeEpisode(
    episodeId: string | number,
    summary: string,
    metadata?: Record<string, any>,
  ): Promise<AgentEpisode> {
    return await this.db.transaction().execute(async (trx) => {
      const existing = await trx
        .selectFrom(this.episodesTable as any)
        .selectAll()
        .where('id', '=', episodeId)
        .forUpdate() // Audit Phase 12: Atomic completion lock
        .executeTakeFirst()

      if (!existing) throw new Error(`Episode with ID ${episodeId} not found`)

      const oldMeta =
        typeof (existing as any).metadata === 'string'
          ? JSON.parse((existing as any).metadata)
          : (existing as any).metadata || {}

      const newMeta = { ...oldMeta, ...metadata }

      const episode = await trx
        .updateTable(this.episodesTable as any)
        .set({
          status: 'completed',
          summary,
          end_time: new Date(),
          metadata: JSON.stringify(newMeta),
        } as any)
        .where('id', '=', episodeId)
        .returningAll()
        .executeTakeFirstOrThrow()

      return this.parseEpisode(episode)
    })
  }

  /**
   * Get all episodes for a session.
   * Refactored Phase 12: Paginated retrieval for high-volume sessions.
   */
  async getSessionEpisodes(
    sessionId: string | number,
    options: { limit?: number; offset?: number } = {},
  ): Promise<AgentEpisode[]> {
    const { limit = 100, offset = 0 } = options

    const list = await this.typedDb
      .selectFrom(this.episodesTable as any)
      .selectAll()
      .where('session_id', '=', sessionId)
      .orderBy('start_time', 'desc')
      .limit(limit)
      .offset(offset)
      .execute()

    return list.map((e) => this.parseEpisode(e))
  }

  /**
   * Get recently completed episodes across all sessions.
   */
  async getRecentEpisodes(limit: number = 10): Promise<AgentEpisode[]> {
    const list = await this.typedDb
      .selectFrom(this.episodesTable as any)
      .selectAll()
      .where('status', '=', 'completed')
      .orderBy('end_time', 'desc')
      .limit(limit)
      .execute()

    return list.map((e) => this.parseEpisode(e))
  }

  private parseEpisode(episode: any): AgentEpisode {
    return {
      id: episode.id,
      sessionId: episode.session_id,
      name: episode.name,
      summary: episode.summary || undefined,
      status: episode.status,
      startTime: new Date(episode.start_time),
      endTime: episode.end_time ? new Date(episode.end_time) : undefined,
      metadata:
        typeof episode.metadata === 'string'
          ? JSON.parse(episode.metadata)
          : episode.metadata || {},
    }
  }
}
