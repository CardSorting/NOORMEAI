import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { NOORMME } from '../../src/noormme.js'
import { createTestDatabase, cleanupTestDatabase } from '../../src/testing/test-utils.js'
import { ActionJournal } from '../../src/agentic/ActionJournal.js'

describe('ActionJournal', () => {
    let db: NOORMME
    let journal: ActionJournal

    beforeEach(async () => {
        db = await createTestDatabase({ seed: false })
        const kysely = db.getKysely()

        await kysely.schema
            .createTable('agent_actions')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('session_id', 'integer', col => col.notNull())
            .addColumn('message_id', 'integer')
            .addColumn('tool_name', 'varchar(255)', col => col.notNull())
            .addColumn('arguments', 'text', col => col.notNull())
            .addColumn('outcome', 'text')
            .addColumn('status', 'varchar(50)', col => col.notNull())
            .addColumn('duration_ms', 'integer')
            .addColumn('metadata', 'text')
            .addColumn('created_at', 'timestamp', col => col.defaultTo('now()').notNull())
            .execute()

        journal = new ActionJournal(kysely)
    })

    afterEach(async () => {
        await cleanupTestDatabase(db)
    })

    it('should log and update an action', async () => {
        const action = await journal.logAction(1, 'search', { query: 'test' })
        expect(action.toolName).toBe('search')
        expect(action.status).toBe('pending')

        const updated = await journal.recordOutcome(action.id, 'success', 'Found 10 results', 150)
        expect(updated.status).toBe('success')
        expect(updated.outcome).toBe('Found 10 results')
        expect(updated.durationMs).toBe(150)
    })

    it('should generate failure report', async () => {
        await journal.logAction(1, 'api_call', {})
        const a2 = await journal.logAction(1, 'api_call', {})
        await journal.recordOutcome(a2.id, 'failure', 'Timeout')

        const report = await journal.getFailureReport()
        expect(report).toHaveLength(1)
        expect(report[0].toolName).toBe('api_call')
        expect(report[0].failureCount).toBe(1)
    })
})
