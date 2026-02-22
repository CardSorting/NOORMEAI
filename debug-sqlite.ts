import { NOORMME } from './src/noormme.ts'

async function debug() {
    const db = new NOORMME({
        dialect: 'sqlite',
        connection: { database: ':memory:' },
        agentic: {
            evolution: {
                verificationWindow: 5,
                mutationAggressiveness: 0.5,
                maxSandboxSkills: 5,
                enableHiveLink: true
            }
        }
    })

    await db.agent.schema.initializeSchema()
    const cortex = db.agent.cortex

    await cortex.capabilities.registerCapability('calculator', '1.0.0', 'Basic math')

    await cortex.db.insertInto('agent_sessions' as any).values({
        id: 1,
        name: 'Test Session',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
    } as any).execute()

    try {
        await cortex.db.insertInto('agent_actions' as any).values({
            session_id: 1,
            tool_name: 'calculator',
            arguments: '{}',
            outcome: 'error',
            status: 'failure',
            created_at: new Date()
        } as any).execute()
        console.log("INSERT SUCCESS")
    } catch (err) {
        console.error("RAW ERROR", err)
    }

    await db.destroy()
}

debug()
