import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { PersonaManager } from '../../src/agentic/PersonaManager.js'

describe('PersonaManager', () => {
    let db: NOORMME
    let manager: PersonaManager

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        await kysely.schema.createTable('agent_personas').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('name', 'varchar(255)', col => col.notNull())
            .addColumn('role', 'text')
            .addColumn('capabilities', 'text')
            .addColumn('policies', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        manager = new PersonaManager(kysely)
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    describe('upsertPersona', () => {
        it('should create a new persona with full options', async () => {
            const persona = await manager.upsertPersona('TestBot', {
                role: 'analyst',
                capabilities: ['code_review', 'testing'],
                policies: ['no_external_calls'],
                metadata: { tier: 'premium' }
            })

            expect(persona.name).toBe('TestBot')
            expect(persona.role).toBe('analyst')
            expect(persona.capabilities).toEqual(['code_review', 'testing'])
            expect(persona.policies).toEqual(['no_external_calls'])
            expect(persona.metadata).toEqual({ tier: 'premium' })
            expect(persona.createdAt).toBeInstanceOf(Date)
            expect(persona.updatedAt).toBeInstanceOf(Date)
        })

        it('should create a persona with default empty options', async () => {
            const persona = await manager.upsertPersona('MinimalBot')

            expect(persona.name).toBe('MinimalBot')
            expect(persona.role).toBeUndefined()
            expect(persona.capabilities).toEqual([])
            expect(persona.policies).toEqual([])
            expect(persona.metadata).toEqual({})
        })

        it('should update an existing persona on duplicate name', async () => {
            await manager.upsertPersona('Updatable', { role: 'v1' })
            const updated = await manager.upsertPersona('Updatable', {
                role: 'v2',
                capabilities: ['new_skill']
            })

            expect(updated.role).toBe('v2')
            expect(updated.capabilities).toEqual(['new_skill'])

            // Ensure we still have only one persona with this name
            const list = await manager.listPersonas()
            const matches = list.filter(p => p.name === 'Updatable')
            expect(matches).toHaveLength(1)
        })
    })

    describe('getPersona', () => {
        it('should retrieve existing persona', async () => {
            const created = await manager.upsertPersona('Findable', { role: 'finder' })
            const found = await manager.getPersona('Findable')

            expect(found).not.toBeNull()
            expect(found!.id).toBe(created.id)
            expect(found!.role).toBe('finder')
        })

        it('should return null for nonexistent persona', async () => {
            const result = await manager.getPersona('Ghost')
            expect(result).toBeNull()
        })
    })

    describe('deletePersona', () => {
        it('should delete an existing persona and return true', async () => {
            await manager.upsertPersona('Deletable')
            const deleted = await manager.deletePersona('Deletable')

            expect(deleted).toBe(true)
            expect(await manager.getPersona('Deletable')).toBeNull()
        })

        it('should return false when deleting nonexistent persona', async () => {
            const deleted = await manager.deletePersona('Nonexistent')
            expect(deleted).toBe(false)
        })
    })

    describe('listPersonas', () => {
        it('should list all personas ordered by name ascending', async () => {
            await manager.upsertPersona('Charlie')
            await manager.upsertPersona('Alice')
            await manager.upsertPersona('Bob')

            const list = await manager.listPersonas()
            expect(list).toHaveLength(3)
            expect(list[0].name).toBe('Alice')
            expect(list[1].name).toBe('Bob')
            expect(list[2].name).toBe('Charlie')
        })

        it('should return empty array when no personas exist', async () => {
            const list = await manager.listPersonas()
            expect(list).toHaveLength(0)
        })
    })

    describe('parsePersona edge cases', () => {
        it('should handle null JSON fields gracefully', async () => {
            // Insert a persona with null capabilities/policies/metadata directly
            const kysely = db.getKysely()
            await kysely.insertInto('agent_personas' as any)
                .values({
                    name: 'NullFields',
                    role: null,
                    capabilities: null,
                    policies: null,
                    metadata: null,
                    created_at: new Date(),
                    updated_at: new Date(),
                } as any)
                .execute()

            const persona = await manager.getPersona('NullFields')
            expect(persona).not.toBeNull()
            expect(persona!.capabilities).toEqual([])
            expect(persona!.policies).toEqual([])
            expect(persona!.metadata).toEqual({})
        })
    })
})
