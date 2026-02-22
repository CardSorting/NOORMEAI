import type { Kysely } from '../../kysely.js'
import type { AgenticConfig, AgentMetric } from '../../types/index.js'
import type { Cortex } from '../Cortex.js'

/**
 * GovernanceManager monitors agent performance and enforces high-level "sanity"
 * across the entire agentic infrastructure.
 */
export class GovernanceManager {
  private metricsTable: string
  private policiesTable: string
  private personasTable: string

  constructor(
    private db: Kysely<any>,
    private cortex: Cortex,
    private config: AgenticConfig = {},
  ) {
    this.metricsTable = config.metricsTable || 'agent_metrics'
    this.policiesTable = config.policiesTable || 'agent_policies'
    this.personasTable = config.personasTable || 'agent_personas'
  }

  /**
   * Perform a "Panic Check" - looking for critical failures or cost overruns
   */
  async performAudit(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = []

    // Fetch active policies
    const policies = (await this.db
      .selectFrom(this.policiesTable as any)
      .selectAll()
      .where('is_enabled', '=', true)
      .execute()) as any[]

    const getPolicyValue = (name: string, type: string, fallback: number) => {
      const p = policies.find((p) => p.name === name || p.type === type)
      if (!p) return fallback
      const def =
        typeof p.definition === 'string'
          ? JSON.parse(p.definition)
          : p.definition
      return def.threshold ?? fallback
    }

    // 1. Budgetary Governance: Check for cost spikes in various windows
    const hourlyLimit = getPolicyValue('hourly_budget', 'budget', 1.0)
    const dailyLimit = getPolicyValue('daily_budget', 'budget', 10.0)

    const getCostInWindow = async (ms: number) => {
      const result = await this.db
        .selectFrom(this.metricsTable as any)
        .select((eb: any) => eb.fn.sum('metric_value').as('total'))
        .where('metric_name' as any, '=', 'total_cost')
        .where('created_at' as any, '>', new Date(Date.now() - ms))
        .executeTakeFirst()
      return Number((result as any)?.total || 0)
    }

    const hCost = await getCostInWindow(3600000)
    if (hCost > hourlyLimit) {
      issues.push(
        `Budget Violations: Hourly cost ($${hCost.toFixed(2)}) exceeded policy ($${hourlyLimit.toFixed(2)})`,
      )
    }

    const dCost = await getCostInWindow(86400000)
    if (dCost > dailyLimit) {
      issues.push(
        `Budget Violations: Daily cumulative cost ($${dCost.toFixed(2)}) exceeded safety ceiling ($${dailyLimit.toFixed(2)})`,
      )
    }

    // 2. Performance Governance: Success Rates & Success Stability
    const minSuccess = getPolicyValue('min_success_rate', 'safety', 0.6)

    // Statistical Success Rate (last 100 events)
    const recentSuccess = await this.db
      .selectFrom(this.metricsTable as any)
      .select((eb: any) => eb.fn.avg('metric_value').as('avg'))
      .where('metric_name' as any, '=', 'success_rate')
      .orderBy('created_at', 'desc')
      .limit(100)
      .executeTakeFirst()

    const success = Number((recentSuccess as any)?.avg || 1)
    if (success < minSuccess) {
      issues.push(
        `Performance Degradation: Rolling success rate (${Math.round(success * 100)}%) is below policy requirement (${minSuccess * 100}%)`,
      )
    }

    // 3. Infrastructure Integrity: Reliability of Verified Skills
    // Detect if any "verified" skills are participating in "failure" loops
    const reliabiltyLimit = getPolicyValue(
      'reliability_floor',
      'integrity',
      0.7,
    )
    const failingVerified = await this.db
      .selectFrom(
        this.config.capabilitiesTable || ('agent_capabilities' as any),
      )
      .select(['name', 'reliability'])
      .where('status', '=', 'verified')
      .where('reliability', '<', reliabiltyLimit)
      .execute()

    for (const cap of failingVerified) {
      issues.push(
        `Integrity Failure: Verified skill '${cap.name}' reliability (${cap.reliability.toFixed(2)}) dropped below floor (${reliabiltyLimit})`,
      )
    }

    if (issues.length > 0) {
      console.warn(
        `[GovernanceManager] AUDIT FAILED [${new Date().toISOString()}]: ${issues.length} compliance issues detected.`,
      )

      // Phase 1: Emergency Rollbacks
      const activePersona = await this.getActivePersona()
      if (activePersona && (success < 0.4 || hCost > hourlyLimit * 1.5)) {
        console.error(
          `[GovernanceManager] CRITICAL THRESHOLD BREACH. Initiating emergency containment for persona ${activePersona.id}`,
        )
        await this.cortex.strategy.rollbackPersona(activePersona.id)
        issues.push(
          `Containment: Emergency rollback triggered for persona ${activePersona.id}`,
        )
      }

      // Phase 2: Systemic Reflections
      await this.cortex.reflections.reflect(
        null as any,
        'failure',
        'Governance Compliance Audit',
        issues,
      )

      // Phase 3: Remediation Rituals
      await this.triggerRemediation(issues)
    }

    return {
      healthy: issues.length === 0,
      issues,
    }
  }

  /**
   * Retrieves the currently active persona.
   */
  private async getActivePersona(): Promise<any | null> {
    const active = await this.db
      .selectFrom(this.personasTable as any)
      .selectAll()
      .where('status', '=', 'active')
      .executeTakeFirst()

    if (!active) return null

    return {
      ...active,
      metadata:
        typeof active.metadata === 'string'
          ? JSON.parse(active.metadata)
          : active.metadata || {},
    }
  }

  /**
   * Trigger autonomous remediation steps based on specific failure modes
   */
  private async triggerRemediation(issues: string[]): Promise<void> {
    for (const issue of issues) {
      if (issue.includes('Budget Violations')) {
        await this.cortex.rituals.scheduleRitual(
          'Budget Remediation',
          'compression',
          'hourly',
          `Automated response to: ${issue}`,
          { priority: 'critical', enforce_limits: true },
        )
      }
      if (issue.includes('Performance Degradation')) {
        await this.cortex.rituals.scheduleRitual(
          'Reliability Sweep',
          'pruning',
          'daily',
          `Sanitizing high-noise memories due to: ${issue}`,
          { priority: 'medium', target: 'longtail' },
        )
      }
      if (issue.includes('Integrity Failure')) {
        // Force demotion of the specific skill back to sandbox or experimental
        const skillName = issue.match(/'([^']+)'/)?.[1]
        if (skillName) {
          console.log(
            `[GovernanceManager] Demoting tainted skill out of verified pool: ${skillName}`,
          )
          await this.db
            .updateTable(
              this.config.capabilitiesTable || ('agent_capabilities' as any),
            )
            .set({ status: 'experimental', updated_at: new Date() } as any)
            .where('name', '=', skillName)
            .execute()
        }
      }
    }
  }

  /**
   * Suggest architectural repairs if performance is degrading
   */
  async suggestRepairs(): Promise<string[]> {
    const repairs: string[] = []

    // 1. Check for chronic high latency
    const latencyStats =
      await this.cortex.metrics.getMetricStats('query_latency')
    if (latencyStats.avg > 500 && latencyStats.count > 10) {
      repairs.push(
        `Average latency is high (${latencyStats.avg.toFixed(2)}ms). Suggesting index audit across hit tables.`,
      )
    }

    // 2. Detect specific slow tables from recent metrics
    const recentSlowQueries = await this.db
      .selectFrom(this.metricsTable as any)
      .select('metadata')
      .where('metric_name' as any, '=', 'query_latency')
      .where('metric_value' as any, '>', 1000)
      .limit(20)
      .execute()

    const slowTables = new Set<string>()
    for (const q of recentSlowQueries) {
      try {
        const meta =
          typeof (q as any).metadata === 'string'
            ? JSON.parse((q as any).metadata)
            : (q as any).metadata || {}
        if (meta.table) slowTables.add(meta.table)
      } catch (e) {
        /* ignore parse errors */
      }
    }

    for (const table of slowTables) {
      repairs.push(
        `Table '${table}' is experiencing periodic latency spikes. Suggesting 'CREATE INDEX' for common filters.`,
      )
    }

    // 3. Check for high cost accumulation
    const totalCost = await this.cortex.metrics.getAverageMetric('total_cost')
    if (totalCost > 0.5) {
      repairs.push(
        'Average query cost is high. Suggesting prompt compression or model switching (e.g., to a smaller model).',
      )
    }

    // 3. Check for cold storage candidates
    const sessionsTable = this.config.sessionsTable || 'agent_sessions'
    const oldThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days
    const oldSessions = (await this.db
      .selectFrom(sessionsTable as any)
      .select((eb: any) => eb.fn.count('id').as('count'))
      .where('created_at', '<', oldThreshold)
      .executeTakeFirst()) as any

    if (Number(oldSessions?.count || 0) > 100) {
      repairs.push(
        `[STORAGE OPTIMIZATION] Found ${oldSessions.count} sessions older than 30 days. Consider moving to cold storage to reduce primary database size and improve backup speed.`,
      )
    }

    return repairs
  }
}
