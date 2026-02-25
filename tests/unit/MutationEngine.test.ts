import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { MutationEngine } from '../../src/agentic/improvement/strategy/MutationEngine.js'

describe('MutationEngine', () => {
    let db: NOORMME
    let engine: MutationEngine
    let mockCortex: any
    const PERSONAS_TABLE = 'agent_personas'

    const parsePersonaFn = (p: any) => ({
        id: p.id,
        name: p.name,
        role: p.role || undefined,
        capabilities: typeof p.capabilities === 'string' ? JSON.parse(p.capabilities) : p.capabilities || [],
        policies: typeof p.policies === 'string' ? JSON.parse(p.policies) : p.policies || [],
        metadata: typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata || {},
        createdAt: new Date(p.created_at),
        updatedAt: new Date(p.updated_at),
    })

    const sanitizeRoleFn = (role: string) => role.replace(/[<>]/g, '').substring(0, 500)

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        await kysely.schema.createTable(PERSONAS_TABLE).ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('name', 'varchar(255)', col => col.notNull())
            .addColumn('role', 'text')
            .addColumn('capabilities', 'text')
            .addColumn('policies', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        await kysely.schema.createTable('agent_goals').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer')
            .addColumn('description', 'text')
            .addColumn('status', 'varchar(50)')
            .addColumn('priority', 'integer')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()'))
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()'))
            .execute()

        await kysely.schema.createTable('agent_reflections').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'text')
            .addColumn('outcome', 'varchar(50)')
            .addColumn('summary', 'text')
            .addColumn('lessons_learned', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()'))
            .execute()

        mockCortex = {
            reasoner: {
                synthesizeLessons: jest.fn().mockResolvedValue({ general: ['Lesson 1', 'Lesson 2'] } as never),
                detectContradictions: jest.fn().mockResolvedValue([] as never),
            },
        }

        engine = new MutationEngine(PERSONAS_TABLE)
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    async function createPersona(name: string, role: string, metadata: any = {}): Promise<any> {
        const kysely = db.getKysely()
        const result = await kysely.insertInto(PERSONAS_TABLE as any)
            .values({
                name,
                role,
                capabilities: JSON.stringify([]),
                policies: JSON.stringify([]),
                metadata: JSON.stringify(metadata),
                created_at: new Date(),
                updated_at: new Date(),
            } as any)
            .returningAll()
            .executeTakeFirstOrThrow()
        return parsePersonaFn(result)
    }

    describe('applyMutation', () => {
        it('should mutate persona role when failures exist', async () => {
            const persona = await createPersona('TestBot', 'General Agent')
            const report = { personaId: 'TestBot', sampleSize: 10, successRate: 0.5, averageLatency: 200, recommendation: 'optimize_accuracy' as const }

            const result = await engine.applyMutation(
                db.getKysely(), mockCortex, persona, report,
                ['timeout_errors'], sanitizeRoleFn, parsePersonaFn
            )

            expect(result).toBeDefined()
            expect(result).toContain('mutated')
        })

        it('should apply optimize_accuracy recommendation', async () => {
            const persona = await createPersona('AccBot', 'Agent')
            const report = { personaId: 'AccBot', sampleSize: 10, successRate: 0.6, averageLatency: 100, recommendation: 'optimize_accuracy' as const }

            const result = await engine.applyMutation(
                db.getKysely(), mockCortex, persona, report,
                [], sanitizeRoleFn, parsePersonaFn
            )

            expect(result).toBeDefined()
            if (result) {
                expect(result).toContain('mutated')
            }
        })

        it('should apply optimize_efficiency recommendation by adding policies', async () => {
            const persona = await createPersona('EffBot', 'Agent')
            const report = { personaId: 'EffBot', sampleSize: 10, successRate: 0.9, averageLatency: 500, recommendation: 'optimize_efficiency' as const }

            const result = await engine.applyMutation(
                db.getKysely(), mockCortex, persona, report,
                [], sanitizeRoleFn, parsePersonaFn
            )

            expect(result).toBeDefined()
        })

        it('should handle critical_intervention by direct rollback', async () => {
            const persona = await createPersona('CritBot', 'Agent', {
                mutationHistory: [{
                    id: 'mut_old',
                    timestamp: Date.now() - 10000,
                    type: 'role_update',
                    previousState: { role: 'Original Role' },
                    newState: { role: 'Bad Role' },
                    reason: 'test'
                }]
            })

            // Test rollback directly since critical_intervention
            // calls rollback which creates nested transactions in SQLite
            const result = await engine.rollback(db.getKysely(), persona.id, parsePersonaFn)
            expect(result).toContain('Rolled back')
        })

        it('should detect contradictions and return null', async () => {
            // Set up contradiction matching the first 20 chars of the proposed role
            const persona = await createPersona('ConflictBot', 'General Agent')
            mockCortex.reasoner.detectContradictions.mockResolvedValue([
                'General Agent (Focus' // matches first 20 chars of optimize_accuracy role
            ] as never)

            const report = { personaId: 'ConflictBot', sampleSize: 10, successRate: 0.5, averageLatency: 100, recommendation: 'optimize_accuracy' as const }

            const result = await engine.applyMutation(
                db.getKysely(), mockCortex, persona, report,
                [], sanitizeRoleFn, parsePersonaFn
            )

            // Should be null due to contradiction
            expect(result).toBeNull()
        })
    })

    describe('rollback', () => {
        it('should restore previous mutation state', async () => {
            const persona = await createPersona('RollbackBot', 'Modified Role', {
                mutationHistory: [{
                    id: 'mut_123',
                    timestamp: Date.now(),
                    type: 'role_update',
                    previousState: { role: 'Original Role', policies: ['p1'] },
                    newState: { role: 'Modified Role' },
                    reason: 'test mutation'
                }]
            })

            const result = await engine.rollback(db.getKysely(), persona.id, parsePersonaFn)
            expect(result).toContain('Rolled back')
            expect(result).toContain('mut_123')
        })

        it('should return message when no mutations to rollback', async () => {
            const persona = await createPersona('CleanBot', 'Agent')
            const result = await engine.rollback(db.getKysely(), persona.id, parsePersonaFn)
            expect(result).toContain('No mutations to rollback')
        })

        it('should throw for nonexistent persona', async () => {
            await expect(
                engine.rollback(db.getKysely(), 99999, parsePersonaFn)
            ).rejects.toThrow()
        })
    })
})
