import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { FactDistiller } from '../../src/agentic/improvement/distillation/FactDistiller.js'

describe('FactDistiller', () => {
    let db: NOORMME
    let distiller: FactDistiller
    const TABLE = 'agent_knowledge_base'

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        await kysely.schema.createTable(TABLE).ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('entity', 'varchar(255)', col => col.notNull())
            .addColumn('fact', 'text', col => col.notNull())
            .addColumn('confidence', 'real', col => col.notNull())
            .addColumn('status', 'varchar(50)')
            .addColumn('source_session_id', 'text')
            .addColumn('tags', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        distiller = new FactDistiller()
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    describe('distillExact', () => {
        it('should return null when no existing fact matches', async () => {
            const kysely = db.getKysely()
            const result = await distiller.distillExact(
                kysely, TABLE, 'TypeScript', 'New fact', 0.7
            )
            expect(result).toBeNull()
        })

        it('should update existing fact with merged tags and boosted confidence', async () => {
            const kysely = db.getKysely()

            // Create initial fact
            await distiller.createInitial(
                kysely, TABLE, 'TypeScript', 'It compiles to JS', 0.5, '1', ['ts']
            )

            // Distill same fact again with new tags
            const result = await distiller.distillExact(
                kysely, TABLE, 'TypeScript', 'It compiles to JS', 0.7, '2', ['javascript']
            )

            expect(result).not.toBeNull()
            const tags = JSON.parse((result as any).tags)
            expect(tags).toContain('ts')
            expect(tags).toContain('javascript')
        })

        it('should boost confidence more for user source', async () => {
            const kysely = db.getKysely()

            await distiller.createInitial(
                kysely, TABLE, 'Python', 'Dynamic typing', 0.5
            )

            const result = await distiller.distillExact(
                kysely, TABLE, 'Python', 'Dynamic typing', 0.7, undefined, [], {}, 'user'
            )

            expect(result).not.toBeNull()
            // User source adds 0.2 boost vs 0.05 for assistant
            expect((result as any).confidence).toBeGreaterThan(0.6)
        })

        it('should set status to verified when source is user', async () => {
            const kysely = db.getKysely()

            await distiller.createInitial(
                kysely, TABLE, 'Rust', 'Memory safe', 0.3
            )

            const result = await distiller.distillExact(
                kysely, TABLE, 'Rust', 'Memory safe', 0.5, undefined, [], {}, 'user'
            )

            expect((result as any).status).toBe('verified')
        })
    })

    describe('createInitial', () => {
        it('should create with proposed status for assistant source', async () => {
            const kysely = db.getKysely()
            const result = await distiller.createInitial(
                kysely, TABLE, 'Go', 'Concurrent by design', 0.6, '1', ['concurrency'], {}, 'assistant'
            )

            expect((result as any).entity).toBe('Go')
            expect((result as any).status).toBe('proposed')
            expect((result as any).confidence).toBe(0.6)
        })

        it('should create with verified status and min 0.8 confidence for user source', async () => {
            const kysely = db.getKysely()
            const result = await distiller.createInitial(
                kysely, TABLE, 'Java', 'Write once run anywhere', 0.3, '1', [], {}, 'user'
            )

            expect((result as any).status).toBe('verified')
            expect((result as any).confidence).toBeGreaterThanOrEqual(0.8)
        })
    })

    describe('verify', () => {
        it('should increase confidence with reinforcement', async () => {
            const kysely = db.getKysely()
            const initial = await distiller.createInitial(
                kysely, TABLE, 'Kotlin', 'Null safe', 0.6, '1', [], {}, 'assistant'
            )

            const verified = await distiller.verify(kysely, TABLE, (initial as any).id, 0.1)

            expect(verified).not.toBeNull()
            expect((verified as any).confidence).toBeGreaterThan(0.6)
        })

        it('should cap non-user source confidence at 0.85 when session_count < 3', async () => {
            const kysely = db.getKysely()
            const initial = await distiller.createInitial(
                kysely, TABLE, 'Swift', 'Protocol oriented', 0.8, '1', [], { source: 'assistant', session_count: 1 }, 'assistant'
            )

            const result = await distiller.verify(kysely, TABLE, (initial as any).id, 0.5)

            expect(result).not.toBeNull()
            // Hallucination guard: source !== 'user' and session_count < 3 → capped at 0.85
            expect((result as any).confidence).toBeLessThanOrEqual(0.85)
        })

        it('should return null for nonexistent id', async () => {
            const kysely = db.getKysely()
            const result = await distiller.verify(kysely, TABLE, 99999)
            expect(result).toBeNull()
        })
    })
})
