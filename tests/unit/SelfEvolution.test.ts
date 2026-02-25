import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'

/**
 * SelfEvolution test suite.
 *
 * The SelfEvolution constructor instantiates TypeGenerator which performs
 * file system I/O. To avoid timeouts, we mock the module before import
 * and test the core utility methods.
 */

// Mock TypeGenerator to prevent disk I/O
jest.unstable_mockModule('../../src/code-generation/type-generator.js', () => ({
    TypeGenerator: jest.fn().mockImplementation(() => ({
        generate: jest.fn().mockResolvedValue(undefined as never),
    })),
}))

describe('SelfEvolution', () => {
    let db: NOORMME
    let evolution: any
    let SelfEvolution: any

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        await kysely.schema.createTable('agent_snapshots').ifNotExists()
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('name', 'varchar(255)', col => col.notNull())
            .addColumn('dna', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        const mod = await import('../../src/agentic/improvement/SelfEvolution.js')
        SelfEvolution = mod.SelfEvolution
        evolution = new SelfEvolution(kysely, {
            agentic: { dialect: 'sqlite' }
        } as any)
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    describe('invertDDL', () => {
        it('should invert CREATE TABLE to DROP TABLE', () => {
            const inverted = (evolution as any).invertDDL('CREATE TABLE my_table (id INTEGER)')
            expect(inverted).toBeDefined()
            expect(inverted!.toUpperCase()).toContain('DROP TABLE')
            expect(inverted!.toUpperCase()).toContain('MY_TABLE')
        })

        it('should return null for unsupported DDL', () => {
            const inverted = (evolution as any).invertDDL('SELECT * FROM users')
            expect(inverted).toBeNull()
        })
    })

    describe('getDNA', () => {
        it('should return a string representation of the schema', async () => {
            const dna = await evolution.getDNA()
            expect(typeof dna).toBe('string')
            expect(dna.length).toBeGreaterThan(0)
        })
    })

    describe('getEvolutionHistory', () => {
        it('should return ordered snapshots', async () => {
            const kysely = db.getKysely()
            await kysely.insertInto('agent_snapshots' as any).values([
                { name: 'v1', dna: 'schema v1', created_at: new Date('2025-01-01') },
                { name: 'v2', dna: 'schema v2', created_at: new Date('2025-02-01') },
                { name: 'v3', dna: 'schema v3', created_at: new Date('2025-03-01') },
            ] as any).execute()

            const history = await evolution.getEvolutionHistory(2)
            expect(history).toHaveLength(2)
        })
    })

    describe('evolve', () => {
        it('should execute DDL and record a snapshot', async () => {
            await evolution.evolve(
                'CREATE TABLE test_evolved (id INTEGER PRIMARY KEY, name TEXT)',
                { name: 'add_test_evolved_table', metadata: { phase: 'test' } }
            )

            const kysely = db.getKysely()
            const tables = await kysely.introspection.getTables()
            const tableNames = tables.map((t: any) => t.name)
            expect(tableNames).toContain('test_evolved')

            const snapshots = await kysely.selectFrom('agent_snapshots' as any)
                .selectAll()
                .execute()
            expect(snapshots.length).toBeGreaterThanOrEqual(1)
        })
    })

    describe('rollbackToSnapshot', () => {
        it('should rollback by inverting the DDL of the named snapshot', async () => {
            await evolution.evolve(
                'CREATE TABLE rollback_test (id INTEGER PRIMARY KEY, value TEXT)',
                { name: 'rollback_target' }
            )

            const kysely = db.getKysely()
            let tables = await kysely.introspection.getTables()
            expect(tables.map((t: any) => t.name)).toContain('rollback_test')

            await evolution.rollbackToSnapshot('rollback_target')

            tables = await kysely.introspection.getTables()
            expect(tables.map((t: any) => t.name)).not.toContain('rollback_test')
        })
    })
})
