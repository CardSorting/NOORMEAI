/**
 * NOORMME: The Forever Agent Demonstration
 * This script showcases the full spectrum of NOORMME agentic capabilities:
 * Sessions, Memories, Knowledge, Sovereignty, Evolution, and Governance.
 */
import { NOORMME } from '../dist/esm/index.js'
import fs from 'fs'

async function run() {
    const dbPath = './forever-agent.sqlite'
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)

    const db = new NOORMME({
        dialect: 'sqlite',
        connection: { database: dbPath }
    })

    try {
        console.log('=== NOORMME: THE SOVEREIGN AGENT DEMONSTRATION ===')
        await db.agent.schema.initializeSchema()
        await db.initialize()

        // 1. Identity & Sovereignty
        const persona = await db.agent.cortex.personas.upsertPersona('Alpha-1', {
            role: 'Autonomous System Architect',
            capabilities: ['schema_evolution', 'self_correction']
        })
        console.log(`[Identity] Persona '${persona.name}' manifested.`)

        // 2. Longtail Session Management
        const session = await db.agent.sessions.createSession('Infinite Loop Research')
        await db.agent.sessions.addMessage(session.id, 'user', 'Initiate Phase 8 evolution.')
        console.log(`[Session] Persistent session ${session.id} opened.`)

        // 3. Knowledge Extraction & Distillation
        await db.agent.cortex.knowledge.distill('Phase 8', 'Focuses on Autonomous Governance', 0.95)
        console.log(`[Knowledge] Distilled new facts into Brain.`)

        // 4. Autonomous Governance & Rules
        await db.agent.cortex.rules.defineRule('agent_knowledge_base', 'create', 'reflect')
        console.log(`[Governance] Cognitive rules established.`)

        // 5. Schema Evolution (The Agent changes its own DNA)
        const suggestion = db.agent.evolution.suggestAddColumn('agent_sessions', 'autonomy_index', 'real')
        console.log(`[Evolution] Agent suggesting DNA upgrade: ${suggestion}`)
        await db.agent.evolution.applySuggestion(suggestion)
        console.log(`[Evolution] Schema updated autonomously. DNA upgraded.`)

        // 6. Goal Deconstruction (Phase 2)
        const mainGoal = await db.agent.sessions.upsertGoal(session.id, 'Improve Agent Sovereignty', { priority: 10 })
        console.log(`[Goal] Established new primary directive: ${mainGoal.description}`)

        const subGoals = await db.agent.cortex.goalArchitect.deconstructGoal(mainGoal.id, [
            'Optimize context buffer efficiency',
            'Harden structural DNA security',
            'Synthesize global intelligence'
        ])
        console.log(`[Architecture] Deconstructed goal into ${subGoals.length} actionable directives.`)

        // 7. Knowledge Linking (Phase 2)
        const k1 = await db.agent.cortex.knowledge.distill('Autonomy', 'Autonomy is the state of self-governance.', 1.0, session.id)
        const k2 = await db.agent.cortex.knowledge.distill('NOORMME', 'NOORMME provides the persistence layer for autonomy.', 1.0, session.id)
        await db.agent.cortex.knowledge.linkKnowledge(k2.id, k1.id, 'enables')
        console.log('[Reasoning] Symbolic relationship established between entities.')

        // 8. Final Audit & Self-Improvement Cycle
        console.log('[Pilot] Initiating self-improvement ritual...')
        await db.agent.cortex.evolution.snapshotSchema('Pre-Optimization State')
        const evolution = await db.agent.cortex.pilot.runSelfImprovementCycle()
        if (evolution.evolved) {
            console.log(`[Evolution] System optimized: ${evolution.changes.join(', ')}`)
        }

        // 9. Cross-Session Reasoning
        const globalLessons = await db.agent.cortex.reasoner.synthesizeLessons()
        console.log(`[Reasoning] Global intelligence synthesized: ${globalLessons.length} lessons.`)

        const audit = await db.agent.cortex.governor.performAudit()
        console.log(`[Audit] System state: ${audit.healthy ? 'HEALTHY' : 'UNHEALTHY'}`)

        console.log('\n=== THE AGENT IS NOW SOVEREIGN, SELF-IMPROVING, AND ARCHITECTURALLY MATURE ===')

    } catch (error) {
        console.error('Demonstration failed:', error)
    } finally {
        await db.close()
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
    }
}

run()
