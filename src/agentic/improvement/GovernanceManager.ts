import type { Kysely } from '../../kysely.js'
import type { AgenticConfig } from '../../types/index.js'
import type { Cortex } from '../Cortex.js'
import { BudgetAuditor } from './governance/BudgetAuditor.js'
import { PerformanceAuditor } from './governance/PerformanceAuditor.js'
import { PersonaAuditor } from './governance/PersonaAuditor.js'
import { SkillAuditor } from './governance/SkillAuditor.js'
import { EmergenceAuditor } from './governance/EmergenceAuditor.js'
import { RemediationEngine } from './governance/RemediationEngine.js'
import { MaintenanceOracle } from './governance/MaintenanceOracle.js'
import type { AuditContext } from './governance/AuditContext.js'

/**
 * GovernanceManager monitors agent performance and enforces high-level "sanity"
 * across the entire agentic infrastructure.
 * 
 * Refactored to delegate specialized auditing to modular components.
 */
export class GovernanceManager {
  private metricsTable: string
  private policiesTable: string
  private personasTable: string
  private skillsTable: string

  private budgetAuditor: BudgetAuditor
  private performanceAuditor: PerformanceAuditor
  private personaAuditor: PersonaAuditor
  private skillAuditor: SkillAuditor
  private emergenceAuditor: EmergenceAuditor
  private remediationEngine: RemediationEngine
  private maintenanceOracle: MaintenanceOracle

  constructor(
    private db: Kysely<any>,
    private cortex: Cortex,
    private config: AgenticConfig = {},
  ) {
    this.metricsTable = config.metricsTable || 'agent_metrics'
    this.policiesTable = config.policiesTable || 'agent_policies'
    this.personasTable = config.personasTable || 'agent_personas'
    this.skillsTable = config.capabilitiesTable || 'agent_capabilities'

    this.budgetAuditor = new BudgetAuditor()
    this.performanceAuditor = new PerformanceAuditor()
    this.personaAuditor = new PersonaAuditor()
    this.skillAuditor = new SkillAuditor()
    this.emergenceAuditor = new EmergenceAuditor()
    this.remediationEngine = new RemediationEngine()
    this.maintenanceOracle = new MaintenanceOracle()
  }

  /**
   * Perform a "Panic Check" - looking for critical failures or cost overruns
   */
  async performAudit(): Promise<{ healthy: boolean; issues: string[] }> {
    const issuesList: string[] = []
    let auditMetadata: any = {}

    // Execute core audit gathering phase
    const ctx: AuditContext = {
      db: this.db,
      trx: this.db as any,
      cortex: this.cortex,
      config: this.config,
      metricsTable: this.metricsTable,
      policiesTable: this.policiesTable,
      personasTable: this.personasTable,
      skillsTable: this.skillsTable
    }

    // Run all auditors
    const budget = await this.budgetAuditor.audit(ctx)
    const performance = await this.performanceAuditor.audit(ctx)
    const persona = await this.personaAuditor.audit(ctx)
    const skills = await this.skillAuditor.audit(ctx)
    const emergence = await this.emergenceAuditor.audit(ctx)

    const pooledIssues = [
      ...budget.issues,
      ...performance.issues,
      ...persona.issues,
      ...skills.issues,
      ...emergence.issues
    ]

    const coreAuditResult = {
      issues: pooledIssues,
      metadata: {
        ...budget.metadata,
        ...performance.metadata,
        ...persona.metadata,
        ...skills.metadata,
        ...emergence.metadata
      }
    }

    issuesList.push(...coreAuditResult.issues)

    if (issuesList.length > 0) {
      console.warn(
        `[GovernanceManager] AUDIT FAILED [${new Date().toISOString()}]: ${issuesList.length} compliance issues detected.`,
      )

      const { activePersona, success, hCost, hourlyLimit } = coreAuditResult.metadata

      // Phase 1: Emergency Rollbacks
      if (activePersona && (success < 0.4 || hCost > hourlyLimit * 1.5)) {
        console.error(
          `[GovernanceManager] CRITICAL THRESHOLD BREACH. Initiating emergency containment for persona ${activePersona.id}`,
        )
        await this.personaAuditor.quarantinePersona({ db: this.db, cortex: this.cortex } as any, activePersona.id, 'Critical threshold breach')
        issuesList.push(`Containment: Emergency rollback triggered for persona ${activePersona.id}`)
      }

      await this.cortex.reflections.reflect(
        null as any,
        'failure',
        'Governance Compliance Audit',
        issuesList,
      )

      // Phase 3: Remediation Rituals
      const ctx: AuditContext = {
        db: this.db,
        trx: this.db as any, // Standalone remediation
        cortex: this.cortex,
        config: this.config,
        metricsTable: this.metricsTable,
        policiesTable: this.policiesTable,
        personasTable: this.personasTable,
        skillsTable: this.skillsTable
      }
      await this.remediationEngine.triggerRemediation(ctx, issuesList)
    }

    return {
      healthy: issuesList.length === 0,
      issues: issuesList,
    }
  }

  /**
   * Suggest architectural repairs if performance is degrading
   */
  async suggestRepairs(): Promise<string[]> {
    const ctx: AuditContext = {
      db: this.db,
      trx: this.db as any,
      cortex: this.cortex,
      config: this.config,
      metricsTable: this.metricsTable,
      policiesTable: this.policiesTable,
      personasTable: this.personasTable,
      skillsTable: this.skillsTable
    }
    return this.maintenanceOracle.suggestRepairs(ctx)
  }

  /**
   * Quarantine a persona that is behaving outside safety parameters.
   */
  async quarantinePersona(id: string | number, reason: string): Promise<void> {
    const ctx: AuditContext = {
      db: this.db,
      trx: this.db as any,
      cortex: this.cortex,
      config: this.config,
      metricsTable: this.metricsTable,
      policiesTable: this.policiesTable,
      personasTable: this.personasTable,
      skillsTable: this.skillsTable
    }
    return this.personaAuditor.quarantinePersona(ctx, id, reason)
  }

  /**
   * Blacklist a skill that is causing systemic issues.
   */
  async quarantineSkill(name: string, reason: string): Promise<void> {
    const ctx: AuditContext = {
      db: this.db,
      trx: this.db as any,
      cortex: this.cortex,
      config: this.config,
      metricsTable: this.metricsTable,
      policiesTable: this.policiesTable,
      personasTable: this.personasTable,
      skillsTable: this.skillsTable
    }
    return this.skillAuditor.quarantineSkill(ctx, name, reason)
  }

  /**
   * Monitor cross-node behaviors and flag sudden spikes or malicious patterns.
   */
  async validateEmergentBehavior(trx?: any): Promise<string[]> {
    const ctx: AuditContext = {
      db: this.db,
      trx: trx || this.db,
      cortex: this.cortex,
      config: this.config,
      metricsTable: this.metricsTable,
      policiesTable: this.policiesTable,
      personasTable: this.personasTable,
      skillsTable: this.skillsTable
    }
    const result = await this.emergenceAuditor.audit(ctx)
    return result.issues
  }
}
