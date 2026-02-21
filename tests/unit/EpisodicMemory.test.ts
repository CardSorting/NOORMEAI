import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { EpisodicMemory } from '../../src/agentic/EpisodicMemory.js'

describe('EpisodicMemory', () => {
    let db: NOORMME
    let memory: EpisodicMemory

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        await kysely.schema
            .createTable('agent_episodes')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer', col => col.notNull())
            .addColumn('name', 'varchar(255)', col => col.notNull())
            .addColumn('summary', 'text')
            .addColumn('status', 'varchar(50)', col => col.notNull())
            .addColumn('start_time', 'timestamp', col => col.notNull())
            .addColumn('end_time', 'timestamp')
            .addColumn('metadata', 'text')
            .execute()

        memory = new EpisodicMemory(kysely)
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    it('should handle episode lifecycle', async () => {
        const episode = await memory.startEpisode(1, 'Scenario A', { importance: 'high' })
        expect(episode.name).toBe('Scenario A')
        expect(episode.status).toBe('active')

        const completed = await memory.completeEpisode(episode.id, 'Scenario was successful', { learned: 'more info' })
        expect(completed.status).toBe('completed')
        expect(completed.summary).toBe('Scenario was successful')
        expect(completed.metadata?.importance).toBe('high')
        expect(completed.metadata?.learned).toBe('more info')
    })

    it('should retrieve episodes', async () => {
        await memory.startEpisode(1, 'Ep 1')
        const ep2 = await memory.startEpisode(1, 'Ep 2')
        await memory.completeEpisode(ep2.id, 'Done')

        const sessionEpisodes = await memory.getSessionEpisodes(1)
        expect(sessionEpisodes).toHaveLength(2)

        const recent = await memory.getRecentEpisodes()
        expect(recent).toHaveLength(1)
        expect(recent[0].name).toBe('Ep 2')
    })
})
