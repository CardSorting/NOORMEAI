import type { Kysely } from '../../kysely.js'
import type { AgenticConfig, CognitiveRule } from '../../types/index.js'

export interface RuleTable {
  id: number | string
  table_name: string
  operation: 'insert' | 'update' | 'delete' | 'select' | 'all'
  condition: string | null
  action: 'allow' | 'deny' | 'audit' | 'mask'
  priority: number
  is_enabled: boolean
  script: string | null
  metadata: string | null // JSON string
  created_at: string | Date
}

export interface RuleDatabase {
  agent_rules: RuleTable
}

/**
 * RuleEngine manages agent-defined data triggers and scripted rituals.
 * It evaluates data operations against cognitive guardrails.
 */
export class RuleEngine {
  private rulesTable: string

  constructor(
    private db: Kysely<any>,
    private config: AgenticConfig = {},
  ) {
    this.rulesTable = config.rulesTable || 'agent_rules'
  }

  private get typedDb(): Kysely<RuleDatabase> {
    return this.db as unknown as Kysely<RuleDatabase>
  }

  /**
   * Define a new cognitive rule transactionally.
   */
  async defineRule(
    tableName: string,
    operation: CognitiveRule['operation'] | 'all',
    action: CognitiveRule['action'],
    options: {
      condition?: string
      priority?: number
      script?: string
      metadata?: Record<string, any>
    } = {},
  ): Promise<CognitiveRule> {
    return await this.db.transaction().execute(async (trx) => {
      const rule = (await trx
        .insertInto(this.rulesTable as any)
        .values({
          table_name: tableName,
          operation,
          action,
          condition: options.condition || null,
          priority: options.priority || 0,
          script: options.script || null,
          is_enabled: true,
          metadata: options.metadata ? JSON.stringify(options.metadata) : null,
          created_at: new Date(),
        } as any)
        .returningAll()
        .executeTakeFirstOrThrow()) as unknown as RuleTable

      return this.parseRule(rule)
    })
  }

  /**
   * Evaluate rules against a specific data object.
   * Returns the highest priority rule action that matches.
   */
  async evaluateRules(
    tableName: string,
    operation: CognitiveRule['operation'],
    data: Record<string, any>,
  ): Promise<{
    action: CognitiveRule['action']
    ruleId?: string | number
    reason?: string
  }> {
    const rules = await this.getActiveRules(tableName, operation)

    // Sort by priority desc
    const sortedRules = rules.sort((a, b) => b.priority - a.priority)

    for (const rule of sortedRules) {
      if (!rule.condition || this.evaluateCondition(rule.condition, data)) {
        return {
          action: rule.action,
          ruleId: rule.id,
          reason: `Matched rule ${rule.id} (${rule.action})`,
        }
      }
    }

    return { action: 'allow' } // Default allow if no rules match
  }

  /**
   * Apply data masking based on rule metadata.
   */
  applyMasking(
    data: Record<string, any>,
    rule: CognitiveRule,
  ): Record<string, any> {
    if (rule.action !== 'mask') return data

    const masked = { ...data }
    const fieldsToMask = rule.metadata?.maskFields || []

    for (const field of fieldsToMask) {
      if (masked[field] !== undefined) {
        masked[field] = '*****'
      }
    }

    return masked
  }

  /**
   * Get active rules for a specific table and operation.
   */
  async getActiveRules(
    tableName: string,
    operation: CognitiveRule['operation'],
  ): Promise<CognitiveRule[]> {
    const list = await this.typedDb
      .selectFrom(this.rulesTable as any)
      .selectAll()
      .where('table_name', '=', tableName)
      .where((eb: any) =>
        eb.or([eb('operation', '=', operation), eb('operation', '=', 'all')]),
      )
      .where('is_enabled', '=', true)
      .execute()

    return list.map((r) => this.parseRule(r))
  }

  private evaluateCondition(
    condition: string,
    data: Record<string, any>,
  ): boolean {
    // Simple condition parser: "key op value"
    // Supports: ==, !=, >, <, includes
    const parts = condition.match(/([^\s]+)\s+(==|!=|>|<|includes)\s+(.+)/)
    if (!parts) return false

    const [_, key, op, rawValue] = parts
    const val = data[key]

    // Parse rawValue
    let compareValue: any = rawValue.replace(/['"]/g, '')
    if (!isNaN(Number(compareValue))) compareValue = Number(compareValue)
    if (compareValue === 'true') compareValue = true
    if (compareValue === 'false') compareValue = false

    switch (op) {
      case '==':
        return val == compareValue
      case '!=':
        return val != compareValue
      case '>':
        return val > compareValue
      case '<':
        return val < compareValue
      case 'includes':
        return String(val).includes(String(compareValue))
      default:
        return false
    }
  }

  private parseRule(r: any): CognitiveRule {
    return {
      id: r.id,
      tableName: r.table_name,
      operation: r.operation,
      condition: r.condition,
      action: r.action,
      priority: r.priority,
      isEnabled: !!r.is_enabled,
      metadata:
        typeof r.metadata === 'string'
          ? JSON.parse(r.metadata)
          : r.metadata || {},
      createdAt: new Date(r.created_at),
    }
  }
}
