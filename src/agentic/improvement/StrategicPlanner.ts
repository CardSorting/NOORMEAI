import type { Kysely } from '../../kysely.js'
import type {
  AgenticConfig,
  AgentPersona,
} from '../../types/index.js'
import type { Cortex } from '../Cortex.js'
import { PerformanceAnalyst } from './strategy/PerformanceAnalyst.js'
import { MutationEngine } from './strategy/MutationEngine.js'
import { EvolutionVerificator } from './strategy/EvolutionVerificator.js'

export interface PerformanceReport {
  personaId: string | number
  successRate: number
  averageLatency: number
  sampleSize: number
  recommendation:
  | 'maintain'
  | 'optimize_efficiency'
  | 'optimize_accuracy'
  | 'critical_intervention'
}

/**
 * StrategicPlanner proactively suggests mutation to agent personas
 * based on performance trends observed in SovereignMetrics.
 */
export class StrategicPlanner {
  private personasTable: string
  private metricsTable: string

  private analyst: PerformanceAnalyst
  private engine: MutationEngine
  private verificator: EvolutionVerificator

  constructor(
    private db: Kysely<any>,
    private cortex: Cortex,
    private config: AgenticConfig = {},
  ) {
    this.personasTable = config.personasTable || 'agent_personas'
    this.metricsTable = config.metricsTable || 'agent_metrics'

    this.analyst = new PerformanceAnalyst()
    this.engine = new MutationEngine(this.personasTable)
    this.verificator = new EvolutionVerificator()
  }

  /**
   * Analyze performance for all personas and apply mutations where necessary.
   */
  async mutateStrategy(): Promise<string[]> {
    const mutations: string[] = []

    // System Health Check
    const tests = await this.cortex.tests.runAllProbes()
    if (tests.some((t) => !t.success)) {
      console.warn('[StrategicPlanner] Mutation cycle aborted. System health probes failed.')
      return []
    }

    const personaRows = await this.db.selectFrom(this.personasTable as any).selectAll().execute()
    const allPersonas = personaRows.map((p) => this.parsePersona(p))

    const configStrategy = (this.config as any).strategy || {}
    const globalBlacklistDuration = configStrategy.globalBlacklistDuration || 3600000
    const localBlacklistDuration = configStrategy.localBlacklistDuration || 86400000

    for (const persona of allPersonas) {
      const report = await this.analyst.analyze(this.db, this.cortex, this.metricsTable, persona.id)

      // 1. Verification Monitor
      if (persona.metadata?.evolution_status === 'verifying') {
        const result = await this.verificator.verify(
          this.db, this.cortex, this.personasTable, persona, report, allPersonas, (id) => this.rollbackPersona(id)
        )
        if (result) mutations.push(result)
        continue
      }

      // 2. Failure Analysis
      const failures = await this.analyst.analyzeFailurePatterns(this.cortex, persona.id)

      // 3. Blacklist Check
      const lastMutation = persona.metadata?.last_failed_mutation
      const isGloballyBlacklisted = allPersonas.some((mp) => {
        return (
          mp.metadata?.last_failed_mutation?.type === report.recommendation &&
          Date.now() - (mp.metadata?.last_failed_mutation?.timestamp || 0) < globalBlacklistDuration
        )
      })

      if (isGloballyBlacklisted || (lastMutation && report.recommendation === lastMutation.type && Date.now() - lastMutation.timestamp < localBlacklistDuration)) {
        continue
      }

      if (report.recommendation !== 'maintain' || failures.length > 0) {
        const result = await this.engine.applyMutation(
          this.db, this.cortex, persona, report, failures, (r) => this.sanitizeRole(r), (p) => this.parsePersona(p)
        )
        if (result) mutations.push(result)
      }
    }

    return mutations
  }

  /**
   * Directly mutate a persona.
   */
  async evolvePersona(persona: AgentPersona, report: PerformanceReport): Promise<string | null> {
    return this.engine.applyMutation(this.db, this.cortex, persona, report, [], (r) => this.sanitizeRole(r), (p) => this.parsePersona(p))
  }

  /**
   * Revert the last mutation for a persona.
   */
  async rollbackPersona(id: string | number): Promise<string> {
    return this.engine.rollback(this.db, id, (p) => this.parsePersona(p))
  }

  /**
   * Analyze a persona's performance report.
   */
  async analyzePersona(id: string | number): Promise<PerformanceReport> {
    return this.analyst.analyze(this.db, this.cortex, this.metricsTable, id)
  }

  private sanitizeRole(role: string): string {
    return role.slice(0, 500).trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, '').replace(/<\|.*?\|>/g, '')
  }

  private parsePersona(p: any): AgentPersona {
    return {
      id: p.id,
      name: p.name,
      role: p.role,
      capabilities: typeof p.capabilities === 'string' ? JSON.parse(p.capabilities) : p.capabilities || [],
      policies: typeof p.policies === 'string' ? JSON.parse(p.policies) : p.policies || [],
      metadata: typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata || {},
      createdAt: new Date(p.created_at),
      updatedAt: new Date(p.updated_at),
    }
  }
}

