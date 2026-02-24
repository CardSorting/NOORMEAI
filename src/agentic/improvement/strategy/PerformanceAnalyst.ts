import type { Kysely } from '../../../kysely.js'
import { sql } from '../../../raw-builder/sql.js'
import type { Cortex } from '../../Cortex.js'
import type { PerformanceReport } from '../StrategicPlanner.js'

export class PerformanceAnalyst {
    async analyzeFailurePatterns(
        cortex: Cortex,
        personaId: string | number,
        trxOrDb: any = (cortex as any).db,
    ): Promise<string[]> {
        const patterns: string[] = []
        try {
            // NOTE: cortex.actions.getFailureReport might need to be transaction-aware too
            const failureReport = await cortex.actions.getFailureReport(trxOrDb)
            const frequentFailures = failureReport.filter((f) => f.failureCount > 1)
            for (const fail of frequentFailures) {
                patterns.push(`tool_failure_${fail.toolName}`)
            }
        } catch (e) {
            // Fallback handled by orchestrator
        }
        return patterns
    }

    async analyze(
        trxOrDb: any,
        cortex: Cortex,
        metricsTable: string,
        id: string | number
    ): Promise<PerformanceReport> {
        const recentMetrics = await trxOrDb
            .selectFrom(metricsTable as any)
            .selectAll()
            .where((eb: any) =>
                eb.or([
                    eb(sql`json_extract(metadata, '$.persona_id')`, '=', id),
                    eb(sql`metadata->>'persona_id'`, '=', String(id)),
                ]),
            )
            .orderBy('created_at', 'desc')
            .limit(50)
            .execute()

        const globalMetrics = await cortex.metrics.getRecentMetrics(200, trxOrDb)

        const calcStats = (metricName: string) => {
            const vals = globalMetrics
                .filter((m: any) => m.metricName === metricName)
                .map((m: any) => Number(m.metricValue))
            if (vals.length < 10)
                return { mean: metricName === 'query_latency' ? 500 : 0.9, stdDev: 0.1 }
            const mean = vals.reduce((a: number, b: number) => a + b, 0) / vals.length
            const variance = vals.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / vals.length
            return { mean, stdDev: Math.sqrt(variance) || 0.05 }
        }

        const successStats = calcStats('task_success_rate')
        const latencyStats = calcStats('query_latency')

        if (recentMetrics.length === 0) {
            return {
                personaId: id,
                successRate: successStats.mean,
                averageLatency: latencyStats.mean,
                sampleSize: 0,
                recommendation: 'maintain',
            }
        }

        const successMetrics = recentMetrics.filter((m: any) => m.metric_name === 'task_success_rate')
        const latencyMetrics = recentMetrics.filter((m: any) => m.metric_name === 'query_latency')

        const avgSuccess = successMetrics.length > 0
            ? successMetrics.reduce((sum: number, m: any) => sum + Number(m.metric_value), 0) / successMetrics.length
            : successStats.mean

        const avgLatency = latencyMetrics.length > 0
            ? latencyMetrics.reduce((sum: number, m: any) => sum + Number(m.metric_value), 0) / latencyMetrics.length
            : latencyStats.mean

        let recommendation: PerformanceReport['recommendation'] = 'maintain'

        const criticalThreshold = successStats.mean - 2.5 * successStats.stdDev
        const accuracyThreshold = successStats.mean - 1.0 * successStats.stdDev
        const efficiencyThreshold = latencyStats.mean + 2.0 * latencyStats.stdDev

        if (avgSuccess < criticalThreshold) {
            recommendation = 'critical_intervention'
        } else if (avgSuccess < accuracyThreshold) {
            recommendation = 'optimize_accuracy'
        } else if (avgLatency > efficiencyThreshold) {
            recommendation = 'optimize_efficiency'
        }

        return {
            personaId: id,
            successRate: avgSuccess,
            averageLatency: avgLatency,
            sampleSize: recentMetrics.length,
            recommendation,
        }
    }
}
