import type { Kysely } from '../../kysely.js'
import type { AgenticConfig, AgentQuota } from '../../types/index.js'
import type { Cortex } from '../Cortex.js'
import { sql } from '../../raw-builder/sql.js'

/**
 * QuotaManager enforces resource limits across personas and swarms.
 */
export class QuotaManager {
    private resourcesTable: string
    private metricsTable: string
    private rateCache: Map<string, { rate: number; timestamp: number }> = new Map()
    private readonly CACHE_TTL = 1000 * 60 * 60 // 1 hour cache

    constructor(
        private db: Kysely<any>,
        private cortex: Cortex,
        private config: AgenticConfig = {},
    ) {
        this.resourcesTable = config.resourcesTable || 'agent_resource_usage'
        this.metricsTable = config.metricsTable || 'agent_metrics'
    }

    /**
     * Check if a quota is violated for a given target.
     */
    async checkQuota(
        targetType: 'persona' | 'swarm' | 'global',
        targetId: string | null = null,
    ): Promise<{ allowed: boolean; reason?: string }> {
        const quotas = await this.getActiveQuotas(targetType, targetId)

        for (const quota of quotas) {
            const usage = await this.getCurrentUsage(quota)

            // Currency Conversion Logic: Convert usage to target currency if specified
            let normalizedUsage = usage
            if (quota.metric === 'cost' && quota.metadata?.currency && quota.metadata.currency !== 'USD') {
                const rate = await this.getExchangeRate(quota.metadata.currency)
                normalizedUsage = usage * rate
            }

            if (normalizedUsage >= quota.limit) {
                const limitStr = quota.metric === 'cost'
                    ? `${quota.metadata?.currency || '$'}${quota.limit}`
                    : `${quota.limit}`
                return {
                    allowed: false,
                    reason: `Quota exceeded: ${quota.metric} limit is ${limitStr}, current is ${normalizedUsage.toFixed(4)} (${quota.period})`
                }
            }
        }

        return { allowed: true }
    }

    /**
     * Fetches active quotas for a given target.
     */
    private async getActiveQuotas(
        targetType: 'persona' | 'swarm' | 'global',
        targetId: string | null,
    ): Promise<AgentQuota[]> {
        const quotas: AgentQuota[] = []

        // 1. Fetch from PolicyEnforcer (Global & Type-specific)
        const policies = await this.cortex.policies.getActivePolicies()
        for (const policy of policies) {
            if (
                policy.type === 'budget' &&
                (policy.definition.targetType === targetType ||
                    (!policy.definition.targetType && targetType === 'global'))
            ) {
                quotas.push({
                    id: policy.id,
                    targetType: targetType,
                    targetId: targetId,
                    metric: policy.definition.metric || 'cost',
                    limit: policy.definition.limit || 0,
                    period: policy.definition.period || 'hourly',
                    currentUsage: 0,
                    createdAt: policy.createdAt,
                    updatedAt: policy.updatedAt,
                    metadata: policy.metadata
                })
            }
        }

        // 2. Fetch from Persona metadata (Specific override)
        if (targetType === 'persona' && targetId) {
            const persona = await this.db
                .selectFrom(this.config.personasTable || ('agent_personas' as any))
                .select('metadata')
                .where('id', '=', targetId)
                .executeTakeFirst()

            if (persona) {
                const meta =
                    typeof persona.metadata === 'string'
                        ? JSON.parse(persona.metadata)
                        : persona.metadata || {}
                if (meta.quotas) {
                    quotas.push(...(meta.quotas as AgentQuota[]))
                }
            }
        }

        return quotas
    }

    /**
     * Calculates current usage for a specific quota window.
     */
    private async getCurrentUsage(quota: AgentQuota): Promise<number> {
        const windowMs = this.getPeriodInMs(quota.period)
        const startTime = new Date(Date.now() - windowMs)

        let query = this.db
            .selectFrom(this.resourcesTable as any)
            .where('created_at', '>', startTime)

        if (quota.targetType === 'persona' && quota.targetId) {
            query = query.where('agent_id', '=', quota.targetId)
        } else if (quota.targetType === 'swarm' && quota.targetId) {
            query = query.where('metadata', 'like', `%"swarm_id":"${quota.targetId}"%`)
        }

        const metricField = quota.metric === 'cost' ? 'cost' :
            quota.metric === 'tokens_input' ? 'input_tokens' :
                quota.metric === 'tokens_output' ? 'output_tokens' :
                    sql`input_tokens + output_tokens`

        const result = await query
            .select((eb: any) => eb.fn.sum(metricField).as('total'))
            .executeTakeFirst()

        return Number((result as any)?.total || 0)
    }

    /**
     * Resolves exchange rate via persistent metric store or live update.
     * Implements a true Oracle pattern for resource normalization.
     */
    private async getExchangeRate(currency: string): Promise<number> {
        // 1. Check in-memory cache
        const cached = this.rateCache.get(currency)
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.rate
        }

        // 2. Check persistent metric store
        const record = await this.db
            .selectFrom(this.metricsTable as any)
            .select(['metric_value', 'created_at'])
            .where('metric_name', '=', `exchange_rate_${currency}`)
            .orderBy('created_at', 'desc')
            .executeTakeFirst()

        if (record && Date.now() - new Date(record.created_at).getTime() < this.CACHE_TTL * 24) {
            const rate = Number(record.metric_value)
            this.rateCache.set(currency, { rate, timestamp: Date.now() })
            return rate
        }

        // 3. Fallback to base rates if unreachable (Statically hardened)
        const baseRates: Record<string, number> = {
            'ETH': 0.00032,
            'BTC': 0.000015,
            'EUR': 0.92,
            'GBP': 0.79
        }

        const fallback = baseRates[currency] || 1.0

        // Log the need for sync
        console.warn(`[QuotaManager] Exchange rate for ${currency} is stale or missing. Using hardened fallback: ${fallback}`)

        return fallback
    }

    /**
     * Manually sync exchange rates from an external provider (Oracle pulse).
     */
    async syncExchangeRates(rates: Record<string, number>): Promise<void> {
        for (const [currency, rate] of Object.entries(rates)) {
            await this.db
                .insertInto(this.metricsTable as any)
                .values({
                    metric_name: `exchange_rate_${currency}`,
                    metric_value: rate,
                    created_at: new Date()
                } as any)
                .execute()

            this.rateCache.set(currency, { rate, timestamp: Date.now() })
        }
        console.log(`[QuotaManager] Synchronized ${Object.keys(rates).length} exchange rates.`)
    }

    private getPeriodInMs(period: AgentQuota['period']): number {
        switch (period) {
            case 'hourly': return 3600000
            case 'daily': return 86400000
            case 'monthly': return 86400000 * 30
            case 'infinite': return Date.now()
            default: return 3600000
        }
    }
}
