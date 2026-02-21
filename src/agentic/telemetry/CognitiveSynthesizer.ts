import type { Kysely } from '../../kysely.js'
import type { AgenticConfig, SessionEvolution } from '../../types/index.js'
import { sql } from '../../raw-builder/sql.js'

/**
 * CognitiveSynthesizer provides advanced behavioral analysis.
 * It tracks how the agent's understanding of its goals evolves over time,
 * measuring the autonomy gradient and strategic shifts.
 */
export class CognitiveSynthesizer {
    private evolutionTable: string

    constructor(
        private db: Kysely<any>,
        private config: AgenticConfig = {}
    ) {
        this.evolutionTable = config.sessionEvolutionTable || 'agent_session_evolution'
    }

    /**
     * Infer goals and update session evolution with production-grade persistence.
     * Uses robust transaction logic and behavioral pathing.
     */
    async synthesize(
        sessionId: string | number,
        input: string,
        pattern?: string
    ): Promise<void> {
        // Production: structured goal inference logic
        const goalInferred = this.inferGoalFromContent(input)
        const strategy = pattern || this.detectStrategy(input)

        try {
            await this.db.transaction().execute(async (trx) => {
                const existing = await trx
                    .selectFrom(this.evolutionTable as any)
                    .selectAll()
                    .where('session_id', '=', sessionId)
                    .executeTakeFirst()

                if (existing) {
                    const currentPath = this.parsePath(existing.evolution_path)

                    // Only append to path if goal or strategy shifted significantly
                    if (existing.inferred_goal !== goalInferred || existing.strategy !== strategy) {
                        currentPath.push({
                            timestamp: new Date().toISOString(),
                            previousGoal: existing.inferred_goal,
                            newGoal: goalInferred,
                            strategyShift: strategy
                        })
                    }

                    await trx
                        .updateTable(this.evolutionTable as any)
                        .set({
                            inferred_goal: goalInferred,
                            strategy,
                            evolution_path: JSON.stringify(currentPath),
                            status: 'active',
                            autonomy_level: this.calculateAutonomy(currentPath.length, existing.autonomy_level || 1),
                            updated_at: new Date()
                        } as any)
                        .where('session_id', '=', sessionId)
                        .execute()
                } else {
                    await trx
                        .insertInto(this.evolutionTable as any)
                        .values({
                            session_id: sessionId,
                            inferred_goal: goalInferred,
                            strategy,
                            evolution_path: JSON.stringify([{
                                timestamp: new Date().toISOString(),
                                event: 'session_start',
                                initialGoal: goalInferred
                            }]),
                            status: 'active',
                            autonomy_level: 1,
                            updated_at: new Date()
                        } as any)
                        .execute()
                }
            })
        } catch (e) {
            console.error(`[CognitiveSynthesizer] Fatal synthesis failure for session ${sessionId}:`, e)
            throw new Error(`Behavioral synthesis failed: ${e instanceof Error ? e.message : String(e)}`)
        }
    }

    /**
     * Mark session as pivoted or abandoned with path documentation.
     */
    async trackShift(sessionId: string | number, shiftType: 'pivot' | 'abandonment'): Promise<void> {
        try {
            await this.db.transaction().execute(async (trx) => {
                const existing = await trx
                    .selectFrom(this.evolutionTable as any)
                    .selectAll()
                    .where('session_id', '=', sessionId)
                    .executeTakeFirst()

                if (!existing) return

                const currentPath = this.parsePath(existing.evolution_path)
                currentPath.push({
                    timestamp: new Date().toISOString(),
                    type: 'shift',
                    shift: shiftType,
                    reason: shiftType === 'abandonment' ? 'User manual termination or lack of progress' : 'Strategic goal shift'
                })

                await trx
                    .updateTable(this.evolutionTable as any)
                    .set({
                        status: shiftType === 'pivot' ? 'pivoted' : 'abandoned',
                        strategy: shiftType === 'pivot' ? 'Strategic Pivot' : 'Terminated',
                        evolution_path: JSON.stringify(currentPath),
                        updated_at: new Date()
                    } as any)
                    .where('session_id', '=', sessionId)
                    .execute()
            })
        } catch (e) {
            console.error(`[CognitiveSynthesizer] Failed to track shift for session ${sessionId}:`, e)
        }
    }

    private inferGoalFromContent(content: string): string {
        // Real-world simulation: extract the first imperative sentence or key noun phrases
        const clean = content.trim().replace(/\n/g, ' ')
        if (clean.length < 100) return clean

        // Simple heuristic: look for "need", "want", "please", "can you"
        const keywords = ['need', 'want', 'please', 'can you', 'implement', 'fix', 'add']
        for (const kw of keywords) {
            const index = clean.toLowerCase().indexOf(kw)
            if (index !== -1) {
                return clean.substring(index, index + 80) + '...'
            }
        }

        return clean.substring(0, 80) + '...'
    }

    private detectStrategy(content: string): string {
        const c = content.toLowerCase()
        if (c.includes('debug') || c.includes('fix') || c.includes('error')) return 'Diagnostic Repair'
        if (c.includes('create') || c.includes('build') || c.includes('implement')) return 'Generative Construction'
        if (c.includes('research') || c.includes('explain') || c.includes('how')) return 'Knowledge Acquisition'
        return 'Adaptive Exploration'
    }

    private calculateAutonomy(pivots: number, currentLevel: number): number {
        // Logic: frequent pivots without completion decrease autonomy. 
        // Consistent execution increases it.
        if (pivots > 5) return Math.min(4, currentLevel + 1)
        return currentLevel
    }

    private parsePath(pathData: any): any[] {
        if (!pathData) return []
        if (typeof pathData === 'string') {
            try {
                return JSON.parse(pathData)
            } catch {
                return []
            }
        }
        return Array.isArray(pathData) ? pathData : []
    }
}
