import type { Kysely } from '../kysely.js'
import type { AgenticConfig, AgentPolicy } from '../types/index.js'

export interface PolicyTable {
  id: number | string
  name: string
  type: 'budget' | 'safety' | 'privacy' | 'performance'
  definition: string // JSON string
  is_enabled: boolean
  metadata: string | null // JSON string
  created_at: string | Date
  updated_at: string | Date
}

export interface PolicyDatabase {
  agent_policies: PolicyTable
  agent_metrics: {
    metric_name: string
    metric_value: number
    created_at: string | Date
  }
}

/**
 * PolicyEnforcer stores and validates agent autonomous guardrails,
 * such as budgets, safety constraints, and privacy rules.
 */
export class PolicyEnforcer {
  private policiesTable: string
  private metricsTable: string
  private metricCache: Map<string, { value: number; timestamp: number }> = new Map()

  constructor(
    private db: Kysely<any>,
    private config: AgenticConfig = {},
  ) {
    this.policiesTable = config.policiesTable || 'agent_policies'
    this.metricsTable = config.metricsTable || 'agent_metrics'
  }

  private get typedDb(): Kysely<PolicyDatabase> {
    return this.db as unknown as Kysely<PolicyDatabase>
  }

  /**
   * Define or update a policy with robust validation.
   */
  async definePolicy(
    name: string,
    type: AgentPolicy['type'],
    definition: Record<string, any>,
    isEnabled: boolean = true,
  ): Promise<AgentPolicy> {
    return await this.db.transaction().execute(async (trx) => {
      const existing = await trx
        .selectFrom(this.policiesTable as any)
        .select('id')
        .where('name', '=', name)
        .executeTakeFirst()

      if (existing) {
        const updated = await trx
          .updateTable(this.policiesTable as any)
          .set({
            type,
            definition: JSON.stringify(definition),
            is_enabled: isEnabled,
            updated_at: new Date(),
          })
          .where('id', '=', (existing as any).id)
          .returningAll()
          .executeTakeFirstOrThrow()

        return this.parsePolicy(updated)
      }

      const created = await trx
        .insertInto(this.policiesTable as any)
        .values({
          name,
          type,
          definition: JSON.stringify(definition),
          is_enabled: isEnabled,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      return this.parsePolicy(created)
    })
  }

  /**
   * Comprehensive policy evaluation against a context value.
   * Supports thresholds, regex patterns, and cumulative budgets.
   */
  async checkPolicy(
    name: string,
    value: any,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const policy = await this.typedDb
      .selectFrom(this.policiesTable as any)
      .selectAll()
      .where('name', '=', name)
      .where('is_enabled', '=', true)
      .executeTakeFirst()

    if (!policy) return { allowed: true }

    const def = JSON.parse(policy.definition as string)

    // 1. Threshold Check (Numeric)
    if (typeof value === 'number') {
      if (def.max !== undefined && value > def.max) {
        return {
          allowed: false,
          reason: `Value ${value} exceeds max ${def.max} for policy '${name}'`,
        }
      }
      if (def.min !== undefined && value < def.min) {
        return {
          allowed: false,
          reason: `Value ${value} below min ${def.min} for policy '${name}'`,
        }
      }
    }

    // 2. Pattern Check (String/Regex)
    if (typeof value === 'string' && def.pattern) {
      const flags = def.flags || 'i'
      const regex = new RegExp(def.pattern, flags)
      if (def.mustMatch && !regex.test(value)) {
        return {
          allowed: false,
          reason: `Value does not match required pattern for policy '${name}'`,
        }
      }
      if (!def.mustMatch && regex.test(value)) {
        return {
          allowed: false,
          reason: `Value contains forbidden pattern for policy '${name}'`,
        }
      }
    }

    // 3. Budget Check (Cumulative)
    if (policy.type === 'budget' && def.metricName) {
      const period = def.period || 'daily'
      const limit = def.limit || 0

      const total = await this.getCumulativeMetric(def.metricName, period)
      if (total + (typeof value === 'number' ? value : 0) > limit) {
        return {
          allowed: false,
          reason: `Cumulative budget for '${def.metricName}' exceeded (${total.toFixed(4)} / ${limit})`,
        }
      }
    }

    return { allowed: true }
  }

  /**
   * Evaluate a full context (object) against all applicable policies.
   */
  async evaluateContext(
    context: Record<string, any>,
  ): Promise<{ allowed: boolean; violations: string[] }> {
    const policies = await this.getActivePolicies()
    const violations: string[] = []

    for (const policy of policies) {
      // If the context has a key matching the policy name, check it
      if (context[policy.name] !== undefined) {
        const result = await this.checkPolicy(policy.name, context[policy.name])
        if (!result.allowed) violations.push(result.reason!)
      }

      // Check for type-specific global policies (e.g. all privacy policies)
      if (policy.type === 'privacy' && context.content) {
        const result = await this.checkPolicy(policy.name, context.content)
        if (!result.allowed) violations.push(result.reason!)
      }

      // 4. Composite Policy Check: Recursive evaluation of dependencies
      if (policy.definition.dependsOn && Array.isArray(policy.definition.dependsOn)) {
        for (const depName of policy.definition.dependsOn) {
          const result = await this.checkPolicy(depName, context[depName])
          if (!result.allowed) violations.push(`Composite failure: ${policy.name} blocked by ${depName} -> ${result.reason}`)
        }
      }
    }

    return {
      allowed: violations.length === 0,
      violations,
    }
  }

  /**
   * Get all active policies.
   */
  async getActivePolicies(): Promise<AgentPolicy[]> {
    const list = await this.typedDb
      .selectFrom(this.policiesTable as any)
      .selectAll()
      .where('is_enabled', '=', true)
      .execute()

    return list.map((p) => this.parsePolicy(p))
  }

  private async getCumulativeMetric(
    metricName: string,
    period: 'daily' | 'hourly' | 'all',
  ): Promise<number> {
    const cacheKey = `${metricName}:${period}`
    const cached = this.metricCache.get(cacheKey)
    const now = new Date()
    const ttl = (this.config as any).policyCacheTTL || 60000

    if (cached && now.getTime() - cached.timestamp < ttl) {
      return cached.value
    }

    let cutoff = new Date(0) // beginning of time
    if (period === 'daily') {
      cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    } else if (period === 'hourly') {
      cutoff = new Date(now.getTime() - 3600000)
    }

    const result = await this.typedDb
      .selectFrom(this.metricsTable as any)
      .select((eb: any) => eb.fn.sum('metric_value').as('total'))
      .where('metric_name', '=', metricName)
      .where('created_at', '>=', cutoff)
      .executeTakeFirst()

    const total = Number((result as any)?.total || 0)
    this.metricCache.set(cacheKey, { value: total, timestamp: now.getTime() })

    return total
  }

  private parsePolicy(p: any): AgentPolicy {
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      definition:
        typeof p.definition === 'string'
          ? JSON.parse(p.definition)
          : p.definition,
      isEnabled: !!p.is_enabled,
      metadata:
        typeof p.metadata === 'string'
          ? JSON.parse(p.metadata)
          : p.metadata || {},
      createdAt: new Date(p.created_at),
      updatedAt: new Date(p.updated_at),
    }
  }
}
