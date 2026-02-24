import type { Kysely } from '../../../kysely.js'
import type { AgentPersona } from '../../../types/index.js'
import type { Cortex } from '../../Cortex.js'
import type { PerformanceReport } from '../StrategicPlanner.js'

export class EvolutionVerificator {
    async verify(
        db: Kysely<any>,
        cortex: Cortex,
        personasTable: string,
        persona: AgentPersona,
        report: PerformanceReport,
        allPersonas: AgentPersona[],
        rollbackFn: (id: string | number) => Promise<string>
    ): Promise<string | null> {
        const rollbackHistory = (persona.metadata?.rollbackHistory as number[]) || []
        const recentRollbacks = rollbackHistory.filter((ts) => Date.now() - ts < 604800000).length
        const hiveTrusted = allPersonas.filter((p) => p.metadata?.evolution_status === 'stable' && p.metadata?.mutation_reason === persona.metadata?.mutation_reason).length

        let sampleSizeThreshold = 10 + recentRollbacks * 10
        const baseline = persona.metadata?.verification_baseline || { successRate: 0.8, averageLatency: 500 }

        // Accelerated Stabilization
        const earlyZ = (report.successRate - baseline.successRate) / 0.1
        if (earlyZ > 3.0 && report.sampleSize >= 5) sampleSizeThreshold = 5
        if (hiveTrusted >= 3) sampleSizeThreshold = Math.max(5, Math.floor(sampleSizeThreshold / 2))

        if (report.sampleSize < sampleSizeThreshold) return null

        // Dynamic Variance
        const recentMetrics = await cortex.metrics.getRecentMetrics(100)
        const values = recentMetrics.filter((m) => m.metricName === 'success_rate').map((m) => Number(m.metricValue))
        const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1)
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (values.length || 1)
        const stdDev = Math.sqrt(variance) || 0.1
        const zScore = (report.successRate - baseline.successRate) / (stdDev || 1)

        if (zScore < -2.0) return await rollbackFn(persona.id)

        if (report.sampleSize >= sampleSizeThreshold * 2 && zScore >= -0.5) {
            if (persona.metadata?.mutation_reason?.includes('optimize_efficiency')) {
                await cortex.rules.defineRule('all', 'all', 'audit', {
                    condition: 'latency > 500',
                    priority: 10,
                    metadata: { reason: `Distilled from successful persona ${persona.id} optimization` },
                })
            }

            await db.updateTable(personasTable as any)
                .set({ metadata: JSON.stringify({ ...persona.metadata, evolution_status: 'stable' }) } as any)
                .where('id', '=', persona.id)
                .execute()
            return `Evolution stabilized for persona ${persona.id}`
        }

        const timeInVerification = (Date.now() - (persona.metadata?.verification_started_at || 0)) / 1000
        if (timeInVerification > 86400 * 3) return await rollbackFn(persona.id)

        return null
    }
}
