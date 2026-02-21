/**
 * Phase 2 Verification Script: Advanced Autonomy
 */
import { NOORMME } from './dist/esm/index.js'
import fs from 'fs'

async function run() {
    const dbPath = './verify-phase2.sqlite'
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)

    const db = new NOORMME({
        dialect: 'sqlite',
        connection: { database: dbPath }
    })

    try {
        console.log('=== VERIFYING PHASE 2: ADVANCED AUTONOMY ===')
        await db.agent.schema.initializeSchema()
        await db.initialize()

        // 1. Verify Goal Deconstruction
        const session = await db.agent.sessions.createSession('Phase 2 Test')
        const mainGoal = await db.agent.sessions.upsertGoal(session.id, 'Build a space station', { priority: 10 })

        console.log('[Verify] Deconstructing goal...')
        const subGoals = await db.agent.cortex.goalArchitect.deconstructGoal(mainGoal.id, [
            'Design the hull',
            'Launch the modules',
            'Assemble in orbit'
        ])
        console.log(`[Verify] Sub-goals created: ${subGoals.length}`)

        // 2. Verify Knowledge Linking
        console.log('[Verify] Distilling and linking knowledge...')
        const k1 = await db.agent.cortex.knowledge.distill('Mars', 'Mars is the red planet.', 1.0, session.id)
        const k2 = await db.agent.cortex.knowledge.distill('Phobos', 'Phobos is a moon of Mars.', 1.0, session.id)

        await db.agent.cortex.curiosity.identifyKnowledgeGaps() // Just to pulse the engine
        await db.agent.cortex.knowledge.linkKnowledge(k2.id, k1.id, 'is_moon_of')
        console.log('[Verify] Knowledge linking successful.')

        // 3. Verify DNA Snapshots
        console.log('[Verify] Taking schema snapshot...')
        await db.agent.cortex.evolution.snapshotSchema('Initial Phase 2 State')
        console.log('[Verify] Snapshot taken.')

        // 4. Verify Curiosity Engine
        const research = await db.agent.cortex.curiosity.proposeResearch()
        console.log(`[Verify] Curiosity proposals: ${research.length}`)

        console.log('\n=== PHASE 2 VERIFICATION SUCCESSFUL ===')

    } catch (error) {
        console.error('Phase 2 Verification failed:', error)
    } finally {
        await db.close()
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
    }
}

run()
