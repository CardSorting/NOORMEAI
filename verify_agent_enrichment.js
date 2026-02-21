/**
 * Verification Script for Agentic Enrichment
 */
import { NOORMME } from './dist/esm/index.js'
import fs from 'fs'

async function run() {
    const dbPath = './verify-enrichment.sqlite'
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)

    const db = new NOORMME({
        dialect: 'sqlite',
        connection: { database: dbPath }
    })

    try {
        console.log('=== VERIFYING AGENTIC ENRICHMENT ===')
        await db.agent.schema.initializeSchema()
        await db.initialize()

        // 1. Verify Session Compression with Anchors
        const session = await db.agent.sessions.createSession('Test Session')
        const m1 = await db.agent.sessions.addMessage(session.id, 'user', 'Important fact: The sky is blue.')
        const m2 = await db.agent.sessions.addMessage(session.id, 'assistant', 'Acknowledged.')

        await db.agent.cortex.compressor.compress(
            session.id,
            'Summary of important facts',
            m1.id,
            m2.id,
            ['sky_color:blue']
        )
        console.log('[Verify] Session compression with anchors completed.')

        // 2. Verify Evolutionary Pilot
        await db.agent.cortex.metrics.recordMetric('query_latency', 150, { sessionId: session.id })
        const evolutionResult = await db.agent.cortex.pilot.runSelfImprovementCycle()
        console.log(`[Verify] Evolutionary Cycle: ${evolutionResult.evolved ? 'EVOLVED' : 'STABLE'}`)
        console.log(`[Verify] Changes: ${evolutionResult.changes.join(', ')}`)

        // 3. Verify Recursive Reasoner
        const lessons = await db.agent.cortex.reasoner.synthesizeLessons()
        console.log(`[Verify] Synthesized Lessons: ${lessons.length}`)

        // 4. Verify Conflict Resolver
        await db.agent.cortex.rules.defineRule('agent_messages', 'create', 'reflect')
        // Manually insert a conflicting rule for simulation if needed, 
        // but defineRule might already handle or define duplicates.
        const conflicts = await db.agent.cortex.conflicts.auditRuleConflicts()
        console.log(`[Verify] Rule Conflicts: ${conflicts.length}`)

        console.log('\n=== VERIFICATION SUCCESSFUL ===')

    } catch (error) {
        console.error('Verification failed:', error)
    } finally {
        await db.close()
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
    }
}

run()
