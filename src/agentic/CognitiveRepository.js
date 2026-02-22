"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CognitiveRepository = void 0;
const NoormError_js_1 = require("../errors/NoormError.js");
/**
 * CognitiveRepository wraps a standard repository and adds agentic side-effects.
 * It uses the Cortex to evaluate data operations against cognitive guardrails.
 */
class CognitiveRepository {
    repository;
    table;
    cortex;
    constructor(repository, table, cortex) {
        this.repository = repository;
        this.table = table;
        this.cortex = cortex;
    }
    /**
     * Helper to evaluate rules and trigger actions
     */
    async triggerRules(operation, data) {
        // Check if rules table exists to avoid errors during initialization
        const rulesTable = this.cortex.config.agentic?.rulesTable || this.cortex.config.rulesTable || 'agent_rules';
        const tables = await this.cortex.db.introspection.getTables();
        if (!tables.some(t => t.name === rulesTable)) {
            return data;
        }
        const result = await this.cortex.rules.evaluateRules(this.table.name, operation, data);
        if (result.action === 'deny') {
            throw new NoormError_js_1.NoormError(`Operation ${operation} on ${this.table.name} denied: ${result.reason}`, {
                operation: 'cognitive_rule_enforcement',
                suggestion: 'Check agent rules or adjust policy'
            });
        }
        if (result.action === 'audit') {
            await this.cortex.reflections.reflect('system', 'success', `Audit trigger: ${operation} on ${this.table.name}`, [`Matched rule ${result.ruleId} for data: ${JSON.stringify(data)}`]);
        }
        if (result.action === 'mask' && result.ruleId) {
            const rules = await this.cortex.rules.getActiveRules(this.table.name, operation);
            const rule = rules.find(r => r.id === result.ruleId);
            if (rule) {
                return this.cortex.rules.applyMasking(data, rule);
            }
        }
        return data;
    }
    async create(data) {
        const processedData = await this.triggerRules('insert', data);
        return await this.repository.create(processedData);
    }
    async update(entity) {
        const processedData = await this.triggerRules('update', entity);
        return await this.repository.update(processedData);
    }
    async delete(id) {
        await this.triggerRules('delete', { id });
        return await this.repository.delete(id);
    }
    // Delegate other methods to the internal repository
    async findById(id) { return this.repository.findById(id); }
    async findAll() { return this.repository.findAll(); }
    async count() { return this.repository.count(); }
    async exists(id) { return this.repository.exists(id); }
    // Dynamic method delegation via Proxy
    static createProxy(repository, table, cortex) {
        const cognitive = new CognitiveRepository(repository, table, cortex);
        return new Proxy(repository, {
            get(target, prop, receiver) {
                if (prop in cognitive) {
                    return cognitive[prop];
                }
                return Reflect.get(target, prop, receiver);
            }
        });
    }
}
exports.CognitiveRepository = CognitiveRepository;
