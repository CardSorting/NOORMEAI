"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictResolver = void 0;
const similarity_js_1 = require("../../util/similarity.js");
/**
 * ConflictResolver identifies and resolves logical inconsistencies
 * in the agent's cognitive rules and behavior policies.
 */
class ConflictResolver {
    db;
    config;
    rulesTable;
    constructor(db, config = {}) {
        this.db = db;
        this.config = config;
        this.rulesTable = config.rulesTable || 'agent_rules';
    }
    /**
     * Audit rules for direct conflicts and semantic overlaps.
     */
    async auditRuleConflicts() {
        console.log('[ConflictResolver] Auditing cognitive rules for conflicts and overlaps...');
        const rules = await this.db
            .selectFrom(this.rulesTable)
            .selectAll()
            .where('is_enabled', '=', true)
            .execute();
        const conflicts = [];
        // 1. Direct Conflicts: Same Table + Same Operation
        const seen = new Map();
        for (const rule of rules) {
            const key = `${rule.tableName}:${rule.operation}`;
            if (seen.has(key)) {
                const existing = seen.get(key);
                // If they have different actions but same triggers, it's a conflict
                if (existing.action !== rule.action) {
                    conflicts.push(`Direct Conflict: Multiple actions for '${key}' ('${existing.action}' vs '${rule.action}')`);
                }
                else if (existing.condition === rule.condition) {
                    conflicts.push(`Redundant Rules: Duplicate rule detected for '${key}' with same condition.`);
                }
            }
            seen.set(key, rule);
        }
        // 2. Semantic Overlaps: Multiple rules targeting same table with potentially overlapping conditions
        // This is a rudimentary check for similar keywords in conditions
        const tableRules = new Map();
        for (const rule of rules) {
            const list = tableRules.get(rule.tableName) || [];
            list.push(rule);
            tableRules.set(rule.tableName, list);
        }
        for (const [table, list] of tableRules.entries()) {
            if (list.length > 1) {
                // Check for overlapping conditions (e.g., both check 'status' or both check 'priority')
                for (let i = 0; i < list.length; i++) {
                    for (let j = i + 1; j < list.length; j++) {
                        const r1 = list[i];
                        const r2 = list[j];
                        if (r1.condition && r2.condition) {
                            const similarity = (0, similarity_js_1.calculateSimilarity)(r1.condition, r2.condition);
                            if (similarity > 0.6) {
                                conflicts.push(`Potential Semantic Overlap on '${table}': Rules ${r1.id} and ${r2.id} have high condition similarity (${(similarity * 100).toFixed(1)}%)`);
                            }
                        }
                    }
                }
            }
        }
        return conflicts;
    }
    /**
     * Resolve a detected conflict by disabling the older rule.
     * Real implementation: Find all active rules for the conflict, and disable all but the newest one.
     */
    async resolveConflict(tableName, operation) {
        console.log(`[ConflictResolver] Resolving conflict for ${tableName}:${operation}`);
        const rules = await this.db
            .selectFrom(this.rulesTable)
            .selectAll()
            .where('table_name', '=', tableName)
            .where('operation', '=', operation)
            .where('is_enabled', '=', true)
            .orderBy('created_at', 'desc')
            .execute();
        if (rules.length <= 1)
            return;
        // Keep the first (newest) one, disable the rest
        const toDisable = rules.slice(1).map(r => r.id);
        await this.db
            .updateTable(this.rulesTable)
            .set({ is_enabled: false })
            .where('id', 'in', toDisable)
            .execute();
        console.log(`[ConflictResolver] Disabled ${toDisable.length} redundant rules for ${tableName}:${operation}`);
    }
}
exports.ConflictResolver = ConflictResolver;
