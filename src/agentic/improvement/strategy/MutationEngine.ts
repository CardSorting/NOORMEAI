import type { Kysely } from '../../../kysely.js'
import type { AgentPersona, AgenticConfig, PersonaMutation } from '../../../types/index.js'
import type { Cortex } from '../../Cortex.js'
import type { PerformanceReport } from '../StrategicPlanner.js'

export class MutationEngine {
    constructor(private personasTable: string) { }

    async applyMutation(
        db: Kysely<any>,
        cortex: Cortex,
        persona: AgentPersona,
        report: PerformanceReport,
        failures: string[] = [],
        sanitizeRoleFn: (role: string) => string,
        parsePersonaFn: (p: any) => AgentPersona
    ): Promise<string | null> {
        return await db.transaction().execute(async (trx) => {
            const reason = failures.length > 0 ? `Failure Patterns: ${failures.join(', ')}` : report.recommendation
            let updates: Partial<AgentPersona> = {}
            let mutationType: PersonaMutation['type'] = 'role_update'

            if (failures.length > 0) {
                const lessons = await cortex.reasoner.synthesizeLessons()
                const relevantLessons = (lessons['general'] || []).slice(0, 2)
                updates = {
                    role: `${persona.role || ''} (Optimized for: ${failures.join(', ')}. Patterns: ${relevantLessons.join('; ')})`.trim(),
                }
            } else {
                const allPersonas = await trx.selectFrom(this.personasTable as any).selectAll().execute()
                const winningMutations = allPersonas
                    .map((p) => parsePersonaFn(p))
                    .filter((p) => (p.metadata?.evolution_status === 'stable' || !p.metadata?.evolution_status) && p.metadata?.mutation_reason?.includes(report.recommendation))

                if (winningMutations.length > 0) {
                    const sorted = winningMutations.sort((a, b) => (b.metadata?.anchored_reliability || 0) - (a.metadata?.anchored_reliability || 0))
                    const alphaMatch = sorted[0]
                    updates = { role: sanitizeRoleFn(alphaMatch.role || persona.role || 'Agent') }
                } else {
                    switch (report.recommendation) {
                        case 'optimize_accuracy':
                            updates = { role: sanitizeRoleFn(`${persona.role || ''} (Focus strictly on accuracy and detailed verification)`) }
                            break
                        case 'optimize_efficiency':
                            updates = { policies: [...(persona.policies || []), 'timeout_reduction', 'concise_output'] }
                            mutationType = 'policy_update'
                            break
                        case 'critical_intervention':
                            return await this.rollback(db, persona.id, parsePersonaFn)
                        default:
                            return null
                    }
                }
            }

            if (updates.role) updates.role = sanitizeRoleFn(updates.role)

            // Conflict Detection
            const contradictions = await cortex.reasoner.detectContradictions()
            for (const contradiction of contradictions) {
                if (updates.role && contradiction.includes(updates.role.slice(0, 20))) return null
            }

            const mutation: PersonaMutation = {
                id: `mut_${Date.now()}`,
                timestamp: Date.now(),
                type: mutationType,
                previousState: { role: persona.role, policies: persona.policies, capabilities: persona.capabilities },
                newState: { ...updates },
                reason: `Auto-mutation triggered by ${report.recommendation}`,
            }

            const history = [...(persona.metadata?.mutationHistory || []), mutation].slice(-5)
            const newMetadata = {
                ...persona.metadata,
                mutationHistory: history,
                evolution_status: 'verifying',
                mutation_reason: report.recommendation,
                verification_started_at: Date.now(),
                verification_baseline: { successRate: report.successRate, averageLatency: report.averageLatency },
            }

            await trx.updateTable(this.personasTable as any)
                .set({
                    role: updates.role || persona.role,
                    policies: updates.policies ? JSON.stringify(updates.policies) : undefined,
                    capabilities: updates.capabilities ? JSON.stringify(updates.capabilities) : undefined,
                    metadata: JSON.stringify(newMetadata),
                    updated_at: new Date(),
                } as any)
                .where('id', '=', persona.id)
                .execute()

            return `Persona ${persona.id} mutated and entering verification window.`
        })
    }

    async rollback(db: Kysely<any>, id: string | number, parsePersonaFn: (p: any) => AgentPersona): Promise<string> {
        return await db.transaction().execute(async (trx) => {
            const current = await trx.selectFrom(this.personasTable as any).selectAll().where('id', '=', id).executeTakeFirst()
            if (!current) throw new Error(`Persona ${id} not found`)
            const persona = parsePersonaFn(current)
            const history = (persona.metadata?.mutationHistory as PersonaMutation[]) || []
            const lastMutation = history.pop()
            if (!lastMutation) return `No mutations to rollback for persona ${id}`

            const previous = lastMutation.previousState
            const rollbackHistory = [...(persona.metadata?.rollbackHistory || []), Date.now()]
            const newMetadata = {
                ...persona.metadata,
                mutationHistory: history,
                rollbackHistory: rollbackHistory,
                last_failed_mutation: { type: lastMutation.type, timestamp: Date.now() },
                evolution_status: 'stable',
                lastRollback: Date.now(),
            }

            await trx.updateTable(this.personasTable as any)
                .set({
                    role: previous.role,
                    policies: previous.policies ? JSON.stringify(previous.policies) : undefined,
                    capabilities: previous.capabilities ? JSON.stringify(previous.capabilities) : undefined,
                    metadata: JSON.stringify(newMetadata),
                    updated_at: new Date(),
                } as any)
                .where('id', '=', id)
                .execute()

            return `Rolled back mutation ${lastMutation.id} for persona ${id}`
        })
    }
}
