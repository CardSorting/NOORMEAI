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
            const report = await this.analyzePersona(persona.id)

            if (report.recommendation !== 'maintain') {
                const result = await this.evolvePersona(persona, report)
                if (result) {
                    mutations.push(result)
                }
            }
        }

        return mutations
    }

    /**
     * Generate a performance report for a specific persona.
     */
    async analyzePersona(id: string | number): Promise<PerformanceReport> {
        // Fetch recent metrics linked to this persona
        // Note: Assuming metrics have metadata with persona_id, or we filter by some other means.
        // The previous implementation used a LIKE query on metadata.

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
                successRate: 1.0, // Assume innocent until proven guilty
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
        } else if (avgLatency > 1000) { // > 1s average latency
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
     * Evolve a persona based on the performance report.
     */
    async evolvePersona(persona: AgentPersona, report: PerformanceReport): Promise<string | null> {
        return await this.db.transaction().execute(async (trx) => {
            let updates: Partial<AgentPersona> = {}
            let reason = ''
            let mutationType: PersonaMutation['type'] = 'role_update'

            switch (report.recommendation) {
                case 'optimize_accuracy':
                    updates = {
                        role: `${persona.role || ''} (Focus strictly on accuracy and step-by-step verification)`.trim()
                    }
                    reason = `Low success rate (${(report.successRate * 100).toFixed(1)}%)`
                    break

                case 'optimize_efficiency':
                    updates = {
                        policies: [...(persona.policies || []), 'timeout_reduction', 'concise_output']
                    }
                    mutationType = 'policy_update'
                    reason = `High latency (${report.averageLatency.toFixed(0)}ms)`
                    break

                case 'critical_intervention':
                    // Rollback if possible, or drastic change
                    const history = (persona.metadata?.mutationHistory as PersonaMutation[]) || []
                    if (history.length > 0) {
                        return await this.rollbackPersona(persona.id)
                    }
                    updates = {
                        role: `CRITICAL RECOVERY MODE: ${persona.role}`
                    }
                    reason = 'Critical failure rate detected'
                    break

                default:
                    return null
            }

            // Create mutation record
            const mutation: PersonaMutation = {
                id: crypto.randomUUID ? crypto.randomUUID() : `mut_${Date.now()}`,
                timestamp: Date.now(),
                type: mutationType,
                previousState: {
                    role: persona.role,
                    policies: persona.policies,
                    capabilities: persona.capabilities
                },
                newState: updates,
                reason
            }

            const newHistory = [...(persona.metadata?.mutationHistory as PersonaMutation[] || []), mutation]

            // Limit history size
            if (newHistory.length > 10) newHistory.shift()

            const mergedMetadata = {
                ...(persona.metadata || {}),
                mutationHistory: newHistory,
                lastMutation: mutation.timestamp
            }

            // Apply update
            await trx
                .updateTable(this.personasTable as any)
                .set({
                    ...updates,
                    policies: updates.policies ? JSON.stringify(updates.policies) : undefined,
                    metadata: JSON.stringify(mergedMetadata),
                    updated_at: new Date()
                } as any)
                .where('id', '=', persona.id)
                .execute()

            return `Applied ${mutationType} to persona ${persona.id}: ${reason}`
        })
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

            // Restore previous state
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
