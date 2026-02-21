import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { PolicyEnforcer } from '../../src/agentic/PolicyEnforcer.js'

describe('PolicyEnforcer', () => {
    let db: NOORMME
    let enforcer: PolicyEnforcer

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        // Create policies table
        await kysely.schema
            .createTable('agent_policies')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('name', 'varchar(255)', col => col.notNull())
            .addColumn('type', 'varchar(50)', col => col.notNull())
            .addColumn('definition', 'text', col => col.notNull())
            .addColumn('is_enabled', 'boolean', col => col.notNull().defaultTo(true))
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .addColumn('updated_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        // Create metrics table for budget checks
        await kysely.schema
            .createTable('agent_metrics')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('metric_name', 'varchar(255)', col => col.notNull())
            .addColumn('metric_value', 'real', col => col.notNull())
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        enforcer = new PolicyEnforcer(kysely)
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    describe('threshold policies', () => {
        it('should enforce max threshold', async () => {
            await enforcer.definePolicy('max_tokens', 'safety', { max: 1000 })
            
            const pass = await enforcer.checkPolicy('max_tokens', 500)
            expect(pass.allowed).toBe(true)

            const fail = await enforcer.checkPolicy('max_tokens', 1500)
            expect(fail.allowed).toBe(false)
            expect(fail.reason).toContain('exceeds max 1000')
        })
    })

    describe('pattern policies', () => {
        it('should forbid patterns', async () => {
            await enforcer.definePolicy('no_secrets', 'privacy', { pattern: 'password|api_key', mustMatch: false })
            
            const pass = await enforcer.checkPolicy('no_secrets', 'Hello world')
            expect(pass.allowed).toBe(true)

            const fail = await enforcer.checkPolicy('no_secrets', 'My password is 123')
            expect(fail.allowed).toBe(false)
        })
    })

    describe('budget policies', () => {
        it('should track cumulative budget', async () => {
            const kysely = db.getKysely()
            await enforcer.definePolicy('daily_spend', 'budget', { metricName: 'cost', limit: 0.1, period: 'daily' })

            // Add some existing spend
            await kysely.insertInto('agent_metrics').values({
                metric_name: 'cost',
                metric_value: 0.06,
                created_at: new Date()
            } as any).execute()

            // Next spend of 0.03 should pass (0.06 + 0.03 = 0.09 < 0.1)
            const pass = await enforcer.checkPolicy('daily_spend', 0.03)
            expect(pass.allowed).toBe(true)

            // Next spend of 0.05 should fail (0.06 + 0.05 = 0.11 > 0.1)
            const fail = await enforcer.checkPolicy('daily_spend', 0.05)
            expect(fail.allowed).toBe(false)
            expect(fail.reason).toContain("budget for 'cost' exceeded")
        })
    })

    describe('evaluateContext', () => {
        it('should evaluate multiple policies at once', async () => {
            await enforcer.definePolicy('max_temp', 'safety', { max: 40 })
            await enforcer.definePolicy('pii_filter', 'privacy', { pattern: '\\d{3}-\\d{2}-\\d{4}', mustMatch: false })

            const result = await enforcer.evaluateContext({
                max_temp: 50, // violation
                content: 'My SSN is 123-45-6789' // violation
            })

            expect(result.allowed).toBe(false)
            expect(result.violations).toHaveLength(2)
        })
    })
})
