import type { Kysely } from '../../kysely.js'
import { sql } from '../../raw-builder/sql.js'
import type {
    AgenticConfig,
    AgentPersona,
    AgentMetric
} from '../../types/index.js'
import type { Cortex } from '../Cortex.js'

interface PersonaTable {
    id: number | string
    name: string
    role: string | null
    capabilities: string | null // JSON string
    policies: string | null // JSON string
    metadata: string | null // JSON string
    created_at: string | Date
    updated_at: string | Date
}

export interface MetricTable {
    id: number | string
    metric_name: string
    metric_value: number
    unit: string | null
    metadata: string | null // JSON string
    created_at: string | Date
}

export interface StrategyDatabase {
    agent_personas: PersonaTable
    agent_metrics: MetricTable
}

export interface PerformanceReport {
    personaId: string | number
    successRate: number
    averageLatency: number
    sampleSize: number
    recommendation: 'maintain' | 'optimize_efficiency' | 'optimize_accuracy' | 'critical_intervention'
}

export interface PersonaMutation {
    id: string
    timestamp: number
    type: 'role_update' | 'policy_update' | 'capability_update'
    previousState: Partial<AgentPersona>
    newState: Partial<AgentPersona>
    reason: string
}

/**
 * StrategicPlanner proactively suggests mutation to agent personas
 * based on performance trends observed in SovereignMetrics.
 */
export class StrategicPlanner {
    private personasTable: string
    private metricsTable: string

    constructor(
        private db: Kysely<any>,
        private cortex: Cortex,
        private config: AgenticConfig = {}
    ) {
        this.personasTable = config.personasTable || 'agent_personas'
        this.metricsTable = config.metricsTable || 'agent_metrics'
    }

    private get typedDb(): Kysely<StrategyDatabase> {
        return this.db as unknown as Kysely<StrategyDatabase>
    }

    /**
     * Analyze performance for all personas and apply mutations where necessary.
     */
    async mutateStrategy(): Promise<string[]> {
        const mutations: string[] = []

        const personas = await this.typedDb
            .selectFrom(this.personasTable as any)
            .selectAll()
            .execute()

        for (const p of personas) {
            const persona = this.parsePersona(p)

            // If it's a challenger, check if it's ready for promotion or disposal
            if (persona.metadata?.isChallenger) {
                const promotionResult = await this.evaluateChallenger(persona)
                if (promotionResult) mutations.push(promotionResult)
                continue
            }

            const report = await this.analyzePersona(persona.id)

            if (report.recommendation !== 'maintain') {
                const result = await this.initiateAblationMutation(persona, report)
                if (result) {
                    mutations.push(result)
                }
            }
        }

        return mutations
    }

    /**
     * Initiate a mutation by creating a "Challenger" persona instead of overwriting the original.
     */
    private async initiateAblationMutation(persona: AgentPersona, report: PerformanceReport): Promise<string | null> {
        return await this.db.transaction().execute(async (trx) => {
            console.log(`[StrategicPlanner] Initiating A/B test for persona ${persona.id} (Recommendation: ${report.recommendation})`)

            let updates: Partial<AgentPersona> = {}
            let mutationType: PersonaMutation['type'] = 'role_update'

            switch (report.recommendation) {
                case 'optimize_accuracy':
                    updates = { role: `${persona.role || ''} (Focus strictly on accuracy and step-by-step verification)`.trim() }
                    break
                case 'optimize_efficiency':
                    updates = { policies: [...(persona.policies || []), 'timeout_reduction', 'concise_output'] }
                    mutationType = 'policy_update'
                    break
                case 'critical_intervention':
                    // Critical usually bypasses A/B and rolls back or forces change
                    return await this.rollbackPersona(persona.id)
                default:
                    return null
            }

            // Create Challenger Persona
            const challengerName = `${persona.name} (Challenger v${Date.now()})`
            const challengerMetadata = {
                parentPersonaId: persona.id,
                isChallenger: true,
                challengerSince: Date.now(),
                mutationType
            }

            await trx
                .insertInto(this.personasTable as any)
                .values({
                    name: challengerName,
                    role: updates.role || persona.role,
                    capabilities: JSON.stringify(updates.capabilities || persona.capabilities),
                    policies: JSON.stringify(updates.policies || persona.policies),
                    metadata: JSON.stringify(challengerMetadata),
                    created_at: new Date(),
                    updated_at: new Date()
                } as any)
                .execute()

            return `Created Challenger persona for ${persona.id} to test ${mutationType}`
        })
    }

    /**
     * Evaluate a challenger. If it performs better than the champion, promote it.
     */
    private async evaluateChallenger(challenger: AgentPersona): Promise<string | null> {
        const parentId = challenger.metadata?.parentPersonaId
        if (!parentId) return null

        const challengerReport = await this.analyzePersona(challenger.id)
        const championReport = await this.analyzePersona(parentId)

        // Minimum sample size for promotion
        if (challengerReport.sampleSize < 10) return null

        const daysActive = (Date.now() - (challenger.metadata?.challengerSince || 0)) / 86400000

        if (challengerReport.successRate > championReport.successRate || (challengerReport.successRate >= championReport.successRate && challengerReport.averageLatency < championReport.averageLatency)) {
            // PROMOTION
            return await this.promoteChallenger(challenger, parentId)
        } else if (daysActive > 7 || (challengerReport.sampleSize > 20 && challengerReport.successRate < 0.6)) {
            // DISPOSAL
            await this.db.deleteFrom(this.personasTable as any).where('id', '=', challenger.id).execute()
            return `Disposed failed challenger persona ${challenger.id}`
        }

        return null
    }

    private async promoteChallenger(challenger: AgentPersona, championId: string | number): Promise<string> {
        return await this.db.transaction().execute(async (trx) => {
            const champion = await trx
                .selectFrom(this.personasTable as any)
                .selectAll()
                .where('id', '=', championId)
                .executeTakeFirst() as any

            const parsedChampion = this.parsePersona(champion)

            // Record mutation in champion history
            const mutation: PersonaMutation = {
                id: `prom_${Date.now()}`,
                timestamp: Date.now(),
                type: challenger.metadata?.mutationType || 'role_update',
                previousState: { role: parsedChampion.role, policies: parsedChampion.policies },
                newState: { role: challenger.role, policies: challenger.policies },
                reason: 'Promoted from successful A/B test'
            }

            const history = [...(parsedChampion.metadata?.mutationHistory || []), mutation]
            if (history.length > 10) history.shift()

            await trx
                .updateTable(this.personasTable as any)
                .set({
                    role: challenger.role,
                    policies: JSON.stringify(challenger.policies),
                    metadata: JSON.stringify({ ...parsedChampion.metadata, mutationHistory: history })
                } as any)
                .where('id', '=', championId)
                .execute()

            // Delete challenger
            await trx.deleteFrom(this.personasTable as any).where('id', '=', challenger.id).execute()

            return `Champion ${championId} upgraded via Challenger ${challenger.id} promotion.`
        })
    }

    /**
     * Generate a performance report for a specific persona.
     */
    async analyzePersona(id: string | number): Promise<PerformanceReport> {
        const recentMetrics = await this.typedDb
            .selectFrom(this.metricsTable as any)
            .selectAll()
            .where((eb) => eb.or([
                eb(sql`json_extract(metadata, '$.persona_id')`, '=', id),
                eb(sql`metadata->>'persona_id'`, '=', String(id))
            ]))
            .orderBy('created_at', 'desc')
            .limit(50)
            .execute()

        if (recentMetrics.length === 0) {
            return {
                personaId: id,
                successRate: 1.0,
                averageLatency: 0,
                sampleSize: 0,
                recommendation: 'maintain'
            }
        }

        const successMetrics = recentMetrics.filter(m => m.metric_name === 'task_success_rate')
        const latencyMetrics = recentMetrics.filter(m => m.metric_name === 'query_latency')

        const avgSuccess = successMetrics.length > 0
            ? successMetrics.reduce((sum, m) => sum + Number(m.metric_value), 0) / successMetrics.length
            : 1.0

        const avgLatency = latencyMetrics.length > 0
            ? latencyMetrics.reduce((sum, m) => sum + Number(m.metric_value), 0) / latencyMetrics.length
            : 0

        let recommendation: PerformanceReport['recommendation'] = 'maintain'

        if (avgSuccess < 0.7) {
            recommendation = 'critical_intervention'
        } else if (avgSuccess < 0.9) {
            recommendation = 'optimize_accuracy'
        } else if (avgLatency > 1000) {
            recommendation = 'optimize_efficiency'
        }

        return {
            personaId: id,
            successRate: avgSuccess,
            averageLatency: avgLatency,
            sampleSize: recentMetrics.length,
            recommendation
        }
    }

    /**
     * (Deprecated in favor of initiateAblationMutation) Evolve a persona directly.
     */
    async evolvePersona(persona: AgentPersona, report: PerformanceReport): Promise<string | null> {
        return await this.initiateAblationMutation(persona, report)
    }

    /**
     * Revert the last mutation for a persona.
     */
    async rollbackPersona(id: string | number): Promise<string> {
        return await this.db.transaction().execute(async (trx) => {
            const current = await trx
                .selectFrom(this.personasTable as any)
                .selectAll()
                .where('id', '=', id)
                .executeTakeFirst()

            if (!current) throw new Error(`Persona ${id} not found`)

            const persona = this.parsePersona(current)
            const history = (persona.metadata?.mutationHistory as PersonaMutation[]) || []
            const lastMutation = history.pop()

            if (!lastMutation) {
                return `No mutations to rollback for persona ${id}`
            }

            const previous = lastMutation.previousState
            const newMetadata = {
                ...persona.metadata,
                mutationHistory: history,
                lastRollback: Date.now()
            }

            await trx
                .updateTable(this.personasTable as any)
                .set({
                    role: previous.role,
                    policies: previous.policies ? JSON.stringify(previous.policies) : undefined,
                    capabilities: previous.capabilities ? JSON.stringify(previous.capabilities) : undefined,
                    metadata: JSON.stringify(newMetadata),
                    updated_at: new Date()
                } as any)
                .where('id', '=', id)
                .execute()

            return `Rolled back mutation ${lastMutation.id} for persona ${id}`
        })
    }

    private parsePersona(p: any): AgentPersona {
        return {
            id: p.id,
            name: p.name,
            role: p.role,
            capabilities: typeof p.capabilities === 'string' ? JSON.parse(p.capabilities) : (p.capabilities || []),
            policies: typeof p.policies === 'string' ? JSON.parse(p.policies) : (p.policies || []),
            metadata: typeof p.metadata === 'string' ? JSON.parse(p.metadata) : (p.metadata || {}),
            createdAt: new Date(p.created_at),
            updatedAt: new Date(p.updated_at)
        }
    }
}
