import type { Kysely } from '../../kysely.js'
import type { AgenticConfig, CognitiveRule } from '../../types/index.js'
import { calculateSimilarity } from '../../util/similarity.js'

/**
 * ConflictResolver identifies and resolves logical inconsistencies
 * in the agent's cognitive rules and behavior policies.
 */
export class ConflictResolver {
  private rulesTable: string

  constructor(
    private db: Kysely<any>,
    private config: AgenticConfig = {},
  ) {
    this.rulesTable = config.rulesTable || 'agent_rules'
  }

  /**
   * Audit rules for direct conflicts and semantic overlaps.
   */
  async auditRuleConflicts(options: { batchSize?: number } = {}): Promise<string[]> {
    const batchSize = options.batchSize ?? 500
    const conflicts: string[] = []
    let offset = 0

    console.log(`[ConflictResolver] Auditing cognitive rules (batchSize=${batchSize})...`)

    const seenDirect = new Map<string, CognitiveRule>()
    const tableRules = new Map<string, CognitiveRule[]>()

    while (true) {
      const rules = (await this.db
        .selectFrom(this.rulesTable as any)
        .selectAll()
        .where('is_enabled' as any, '=', true)
        .limit(batchSize)
        .offset(offset)
        .execute()) as unknown as CognitiveRule[]

      if (rules.length === 0) break

      for (const rule of rules) {
        // 1. Direct Conflicts: Same Table + Same Operation
        const directKey = `${rule.tableName}:${rule.operation}`
        if (seenDirect.has(directKey)) {
          const existing = seenDirect.get(directKey)!
          if (existing.action !== rule.action) {
            conflicts.push(`Direct Conflict: Multiple actions for '${directKey}' ('${existing.action}' vs '${rule.action}')`)
          } else if (existing.condition === rule.condition) {
            conflicts.push(`Redundant Rules: Duplicate rule detected for '${directKey}' with same condition.`)
          }
        }
        seenDirect.set(directKey, rule)

        // Group for semantic check
        const list = tableRules.get(rule.tableName) || []
        if (list.length < 100) { // Audit Phase 16: Quadratic Guard per table
          list.push(rule)
          tableRules.set(rule.tableName, list)
        }
      }

      if (rules.length < batchSize) break
      offset += batchSize
    }

    // 2. Semantic Overlaps: Quadratic check with hard limits
    for (const [table, list] of tableRules.entries()) {
      if (list.length > 1) {
        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) {
            const r1 = list[i]
            const r2 = list[j]
            if (r1.condition && r2.condition) {
              const similarity = calculateSimilarity(r1.condition, r2.condition)
              if (similarity > 0.6) {
                conflicts.push(`Potential Semantic Overlap on '${table}': Rules ${r1.id} and ${r2.id} have high similarity (${(similarity * 100).toFixed(1)}%)`)
              }
            }
          }
        }
      }
    }

    return conflicts
  }

  /**
   * Resolve a detected conflict by disabling the older rule.
   * Real implementation: Find all active rules for the conflict, and disable all but the newest one.
   */
  async resolveConflict(tableName: string, operation: string): Promise<void> {
    console.log(
      `[ConflictResolver] Resolving conflict for ${tableName}:${operation}`,
    )

    return await this.db.transaction().execute(async (trx) => {
      const rules = (await trx
        .selectFrom(this.rulesTable as any)
        .selectAll()
        .where('table_name' as any, '=', tableName)
        .where('operation' as any, '=', operation)
        .where('is_enabled' as any, '=', true)
        .orderBy('created_at' as any, 'desc')
        .forUpdate() // Audit Phase 10: Atomic resolution lock
        .execute()) as any[]

      if (rules.length <= 1) return

      // Keep the first (newest) one, disable the rest
      const toDisable = rules.slice(1).map((r) => r.id)

      await trx
        .updateTable(this.rulesTable as any)
        .set({ is_enabled: false } as any)
        .where('id', 'in', toDisable)
        .execute()

      console.log(
        `[ConflictResolver] Disabled ${toDisable.length} redundant rules for ${tableName}:${operation}`,
      )
    })
  }
}
