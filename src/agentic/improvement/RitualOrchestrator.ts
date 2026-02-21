import type { Kysely } from '../../kysely.js'
import type {
    AgenticConfig,
    AgentRitual
} from '../../types/index.js'
import type { Cortex } from '../Cortex.js'

/**
 * RitualOrchestrator handles the periodic execution of background tasks
 * such as memory optimization, session compression, and knowledge distillation.
 */
export class RitualOrchestrator {
    private ritualsTable: string

    constructor(
        private db: Kysely<any>,
        private cortex: Cortex,
        private config: AgenticConfig = {}
    ) {
        this.ritualsTable = config.ritualsTable || 'agent_rituals'
    }

    /**
     * Schedule a new ritual
     */
    async scheduleRitual(
        name: string,
        type: AgentRitual['type'],
        frequency: AgentRitual['frequency'],
        definition?: string,
        metadata?: Record<string, any>
    ): Promise<AgentRitual> {
        const nextRun = this.calculateNextRun(frequency)

        const ritual = await this.db
            .insertInto(this.ritualsTable as any)
            .values({
                name,
                type,
                frequency,
                definition,
                next_run: nextRun,
                status: 'pending',
                metadata: metadata ? JSON.stringify(metadata) : null
            } as any)
            .returningAll()
            .executeTakeFirstOrThrow() as unknown as AgentRitual

        return this.parseRitual(ritual)
    }

    /**
     * Run all pending rituals that are due
     */
    async runPendingRituals(): Promise<number> {
        const now = new Date()
        const oneHourAgo = new Date(now.getTime() - 3600000)

        const pending = await this.db
            .selectFrom(this.ritualsTable as any)
            .selectAll()
            .where('next_run', '<=', now)
            .where('status', 'in', ['pending', 'success', 'failure'])
            // Debounce: Ensure last_run was not within the last hour to prevent loops
            .where((eb: any) => eb.or([
                eb('last_run', '<=', oneHourAgo),
                eb('last_run', 'is', null)
            ]))
            .execute() as unknown as AgentRitual[]

        console.log(`[RitualOrchestrator] Found ${pending.length} pending rituals due.`)

        for (const ritual of pending) {
            await this.executeRitual(ritual)
        }

        return pending.length
    }

    /**
     * Execute a specific ritual
     */
    async executeRitual(ritual: AgentRitual): Promise<void> {
        console.log(`[RitualOrchestrator] Executing ritual: ${ritual.name} (${ritual.type})`)
        const ritualMetadata: Record<string, any> = { startedAt: new Date() }

        try {
            switch (ritual.type) {
                case 'compression':
                    const sessionsTable = this.config.sessionsTable || 'agent_sessions'
                    const activeSessions = await this.db
                        .selectFrom(sessionsTable as any)
                        .select('id')
                        .where('status', '=', 'active')
                        .execute()

                    const compressionThreshold = (this.config.contextWindowSize || 20)
                    let compressedCount = 0

                    for (const session of activeSessions) {
                        const messagesTable = this.config.messagesTable || 'agent_messages'
                        const countResult = await this.db
                            .selectFrom(messagesTable as any)
                            .select((eb: any) => eb.fn.countAll().as('count'))
                            .where('session_id', '=', session.id)
                            .executeTakeFirst() as any

                        const count = Number(countResult?.count || 0)
                        if (count > compressionThreshold) {
                            await this.cortex.compressor.semanticPruning(session.id)
                            compressedCount++
                        }
                    }
                    ritualMetadata.sessionsCompressed = compressedCount
                    break

                case 'optimization':
                    const evolution = await this.cortex.pilot.runSelfImprovementCycle()
                    await this.cortex.janitor.optimizeDatabase()
                    ritualMetadata.evolutionChanges = evolution.changes
                    break

                case 'pruning':
                    const prunedKnowledge = await this.cortex.janitor.runPruningRitual()
                    const prunedZombies = await this.cortex.ablation.pruneZombies()
                    const orphans = await this.cortex.janitor.cleanOrphans()
                    ritualMetadata.prunedKnowledge = prunedKnowledge
                    ritualMetadata.prunedZombies = prunedZombies
                    ritualMetadata.orphansCleaned = orphans
                    break
            }

            // Update ritual status and schedule next run
            const nextRun = this.calculateNextRun(ritual.frequency)
            await this.db
                .updateTable(this.ritualsTable as any)
                .set({
                    status: 'success',
                    last_run: new Date(),
                    next_run: nextRun,
                    metadata: JSON.stringify({ ...JSON.parse(JSON.stringify(ritual.metadata || '{}')), ...ritualMetadata })
                } as any)
                .where('id', '=', ritual.id)
                .execute()

        } catch (error) {
            console.error(`[RitualOrchestrator] Ritual ${ritual.name} failed:`, error)
            await this.db
                .updateTable(this.ritualsTable as any)
                .set({ 
                    status: 'failure', 
                    metadata: JSON.stringify({ ...ritualMetadata, error: String(error) }) 
                } as any)
                .where('id', '=', ritual.id)
                .execute()
        }
    }

    private calculateNextRun(frequency: AgentRitual['frequency']): Date {
        const now = Date.now()
        switch (frequency) {
            case 'hourly': return new Date(now + 3600000)
            case 'daily': return new Date(now + 86400000)
            case 'weekly': return new Date(now + 604800000)
            default: return new Date(now + 86400000)
        }
    }

    private parseRitual(r: any): AgentRitual {
        return {
            ...r,
            lastRun: r.last_run ? new Date(r.last_run) : undefined,
            nextRun: r.next_run ? new Date(r.next_run) : undefined,
            metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata
        }
    }
}
