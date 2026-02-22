"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyEnforcer = void 0;
/**
 * PolicyEnforcer stores and validates agent autonomous guardrails,
 * such as budgets, safety constraints, and privacy rules.
 */
class PolicyEnforcer {
    db;
    config;
    policiesTable;
    metricsTable;
    constructor(db, config = {}) {
        this.db = db;
        this.config = config;
        this.policiesTable = config.policiesTable || 'agent_policies';
        this.metricsTable = config.metricsTable || 'agent_metrics';
    }
    get typedDb() {
        return this.db;
    }
    /**
     * Define or update a policy with robust validation.
     */
    async definePolicy(name, type, definition, isEnabled = true) {
        return await this.db.transaction().execute(async (trx) => {
            const existing = await trx
                .selectFrom(this.policiesTable)
                .select('id')
                .where('name', '=', name)
                .executeTakeFirst();
            if (existing) {
                const updated = await trx
                    .updateTable(this.policiesTable)
                    .set({
                    type,
                    definition: JSON.stringify(definition),
                    is_enabled: isEnabled,
                    updated_at: new Date()
                })
                    .where('id', '=', existing.id)
                    .returningAll()
                    .executeTakeFirstOrThrow();
                return this.parsePolicy(updated);
            }
            const created = await trx
                .insertInto(this.policiesTable)
                .values({
                name,
                type,
                definition: JSON.stringify(definition),
                is_enabled: isEnabled,
                created_at: new Date(),
                updated_at: new Date()
            })
                .returningAll()
                .executeTakeFirstOrThrow();
            return this.parsePolicy(created);
        });
    }
    /**
     * Comprehensive policy evaluation against a context value.
     * Supports thresholds, regex patterns, and cumulative budgets.
     */
    async checkPolicy(name, value) {
        const policy = await this.typedDb
            .selectFrom(this.policiesTable)
            .selectAll()
            .where('name', '=', name)
            .where('is_enabled', '=', true)
            .executeTakeFirst();
        if (!policy)
            return { allowed: true };
        const def = JSON.parse(policy.definition);
        // 1. Threshold Check (Numeric)
        if (typeof value === 'number') {
            if (def.max !== undefined && value > def.max) {
                return { allowed: false, reason: `Value ${value} exceeds max ${def.max} for policy '${name}'` };
            }
            if (def.min !== undefined && value < def.min) {
                return { allowed: false, reason: `Value ${value} below min ${def.min} for policy '${name}'` };
            }
        }
        // 2. Pattern Check (String/Regex)
        if (typeof value === 'string' && def.pattern) {
            const regex = new RegExp(def.pattern, 'i');
            if (def.mustMatch && !regex.test(value)) {
                return { allowed: false, reason: `Value does not match required pattern for policy '${name}'` };
            }
            if (!def.mustMatch && regex.test(value)) {
                return { allowed: false, reason: `Value contains forbidden pattern for policy '${name}'` };
            }
        }
        // 3. Budget Check (Cumulative)
        if (policy.type === 'budget' && def.metricName) {
            const period = def.period || 'daily';
            const limit = def.limit || 0;
            const total = await this.getCumulativeMetric(def.metricName, period);
            if (total + (typeof value === 'number' ? value : 0) > limit) {
                return { allowed: false, reason: `Cumulative budget for '${def.metricName}' exceeded (${total.toFixed(4)} / ${limit})` };
            }
        }
        return { allowed: true };
    }
    /**
     * Evaluate a full context (object) against all applicable policies.
     */
    async evaluateContext(context) {
        const policies = await this.getActivePolicies();
        const violations = [];
        for (const policy of policies) {
            // If the context has a key matching the policy name, check it
            if (context[policy.name] !== undefined) {
                const result = await this.checkPolicy(policy.name, context[policy.name]);
                if (!result.allowed)
                    violations.push(result.reason);
            }
            // Check for type-specific global policies (e.g. all privacy policies)
            if (policy.type === 'privacy' && context.content) {
                const result = await this.checkPolicy(policy.name, context.content);
                if (!result.allowed)
                    violations.push(result.reason);
            }
        }
        return {
            allowed: violations.length === 0,
            violations
        };
    }
    /**
     * Get all active policies.
     */
    async getActivePolicies() {
        const list = await this.typedDb
            .selectFrom(this.policiesTable)
            .selectAll()
            .where('is_enabled', '=', true)
            .execute();
        return list.map(p => this.parsePolicy(p));
    }
    async getCumulativeMetric(metricName, period) {
        let cutoff = new Date(0); // beginning of time
        const now = new Date();
        if (period === 'daily') {
            cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }
        else if (period === 'hourly') {
            cutoff = new Date(now.getTime() - 3600000);
        }
        const result = await this.typedDb
            .selectFrom(this.metricsTable)
            .select((eb) => eb.fn.sum('metric_value').as('total'))
            .where('metric_name', '=', metricName)
            .where('created_at', '>=', cutoff)
            .executeTakeFirst();
        return Number(result?.total || 0);
    }
    parsePolicy(p) {
        return {
            id: p.id,
            name: p.name,
            type: p.type,
            definition: typeof p.definition === 'string' ? JSON.parse(p.definition) : p.definition,
            isEnabled: !!p.is_enabled,
            metadata: typeof p.metadata === 'string' ? JSON.parse(p.metadata) : (p.metadata || {}),
            createdAt: new Date(p.created_at),
            updatedAt: new Date(p.updated_at)
        };
    }
}
exports.PolicyEnforcer = PolicyEnforcer;
