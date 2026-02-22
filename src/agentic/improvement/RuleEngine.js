"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleEngine = void 0;
/**
 * RuleEngine manages agent-defined data triggers and scripted rituals.
 * It evaluates data operations against cognitive guardrails.
 */
class RuleEngine {
    db;
    config;
    rulesTable;
    constructor(db, config = {}) {
        this.db = db;
        this.config = config;
        this.rulesTable = config.rulesTable || 'agent_rules';
    }
    get typedDb() {
        return this.db;
    }
    /**
     * Define a new cognitive rule transactionally.
     */
    async defineRule(tableName, operation, action, options = {}) {
        return await this.db.transaction().execute(async (trx) => {
            const rule = await trx
                .insertInto(this.rulesTable)
                .values({
                table_name: tableName,
                operation,
                action,
                condition: options.condition || null,
                priority: options.priority || 0,
                script: options.script || null,
                is_enabled: true,
                metadata: options.metadata ? JSON.stringify(options.metadata) : null,
                created_at: new Date()
            })
                .returningAll()
                .executeTakeFirstOrThrow();
            return this.parseRule(rule);
        });
    }
    /**
     * Evaluate rules against a specific data object.
     * Returns the highest priority rule action that matches.
     */
    async evaluateRules(tableName, operation, data) {
        const rules = await this.getActiveRules(tableName, operation);
        // Sort by priority desc
        const sortedRules = rules.sort((a, b) => b.priority - a.priority);
        for (const rule of sortedRules) {
            if (!rule.condition || this.evaluateCondition(rule.condition, data)) {
                return {
                    action: rule.action,
                    ruleId: rule.id,
                    reason: `Matched rule ${rule.id} (${rule.action})`
                };
            }
        }
        return { action: 'allow' }; // Default allow if no rules match
    }
    /**
     * Apply data masking based on rule metadata.
     */
    applyMasking(data, rule) {
        if (rule.action !== 'mask')
            return data;
        const masked = { ...data };
        const fieldsToMask = rule.metadata?.maskFields || [];
        for (const field of fieldsToMask) {
            if (masked[field] !== undefined) {
                masked[field] = '*****';
            }
        }
        return masked;
    }
    /**
     * Get active rules for a specific table and operation.
     */
    async getActiveRules(tableName, operation) {
        const list = await this.typedDb
            .selectFrom(this.rulesTable)
            .selectAll()
            .where('table_name', '=', tableName)
            .where((eb) => eb.or([
            eb('operation', '=', operation),
            eb('operation', '=', 'all')
        ]))
            .where('is_enabled', '=', true)
            .execute();
        return list.map(r => this.parseRule(r));
    }
    evaluateCondition(condition, data) {
        // Simple condition parser: "key op value"
        // Supports: ==, !=, >, <, includes
        const parts = condition.match(/([^\s]+)\s+(==|!=|>|<|includes)\s+(.+)/);
        if (!parts)
            return false;
        const [_, key, op, rawValue] = parts;
        const val = data[key];
        // Parse rawValue
        let compareValue = rawValue.replace(/['"]/g, '');
        if (!isNaN(Number(compareValue)))
            compareValue = Number(compareValue);
        if (compareValue === 'true')
            compareValue = true;
        if (compareValue === 'false')
            compareValue = false;
        switch (op) {
            case '==': return val == compareValue;
            case '!=': return val != compareValue;
            case '>': return val > compareValue;
            case '<': return val < compareValue;
            case 'includes': return String(val).includes(String(compareValue));
            default: return false;
        }
    }
    parseRule(r) {
        return {
            id: r.id,
            tableName: r.table_name,
            operation: r.operation,
            condition: r.condition,
            action: r.action,
            priority: r.priority,
            isEnabled: !!r.is_enabled,
            metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata || {}),
            createdAt: new Date(r.created_at)
        };
    }
}
exports.RuleEngine = RuleEngine;
