import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { RuleEngine } from '../../src/agentic/improvement/RuleEngine.js'

describe('RuleEngine', () => {
    let db: NOORMME
    let engine: RuleEngine

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        // Create rules table
        await kysely.schema
            .createTable('agent_rules')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('table_name', 'varchar(255)', col => col.notNull())
            .addColumn('operation', 'varchar(50)', col => col.notNull())
            .addColumn('action', 'varchar(50)', col => col.notNull())
            .addColumn('condition', 'text')
            .addColumn('priority', 'integer', col => col.notNull().defaultTo(0))
            .addColumn('is_enabled', 'boolean', col => col.notNull().defaultTo(true))
            .addColumn('script', 'text')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        engine = new RuleEngine(kysely)
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    describe('evaluateRules', () => {
        it('should allow by default', async () => {
            const result = await engine.evaluateRules('users', 'insert', { name: 'Alice' })
            expect(result.action).toBe('allow')
        })

        it('should match a simple condition', async () => {
            await engine.defineRule('users', 'insert', 'deny', { condition: 'age < 18' })
            
            const pass = await engine.evaluateRules('users', 'insert', { age: 20 })
            expect(pass.action).toBe('allow')

            const fail = await engine.evaluateRules('users', 'insert', { age: 15 })
            expect(fail.action).toBe('deny')
        })

        it('should respect priority', async () => {
            // Low priority allow
            await engine.defineRule('users', 'insert', 'allow', { condition: 'age > 10', priority: 1 })
            // High priority deny
            await engine.defineRule('users', 'insert', 'deny', { condition: 'age < 20', priority: 10 })

            const result = await engine.evaluateRules('users', 'insert', { age: 15 })
            expect(result.action).toBe('deny') // High priority rule wins
        })
    })

    describe('applyMasking', () => {
        it('should mask sensitive fields', async () => {
            const rule = await engine.defineRule('users', 'select', 'mask', { metadata: { maskFields: ['email', 'phone'] } })
            
            const data = { id: 1, name: 'Alice', email: 'alice@example.com', phone: '123456' }
            const masked = engine.applyMasking(data, rule)

            expect(masked.id).toBe(1)
            expect(masked.name).toBe('Alice')
            expect(masked.email).toBe('*****')
            expect(masked.phone).toBe('*****')
        })
    })
})
