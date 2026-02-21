import type { Repository, TableInfo, CognitiveRule } from '../types/index.js'
import type { Cortex } from './Cortex.js'
import { NoormError } from '../errors/NoormError.js'

/**
 * CognitiveRepository wraps a standard repository and adds agentic side-effects.
 * It uses the Cortex to evaluate data operations against cognitive guardrails.
 */
export class CognitiveRepository<T> {
    constructor(
        private repository: Repository<T>,
        private table: TableInfo,
        private cortex: Cortex
    ) { }

    /**
     * Helper to evaluate rules and trigger actions
     */
    private async triggerRules(operation: CognitiveRule['operation'], data: Partial<T>): Promise<Partial<T>> {
        // Check if rules table exists to avoid errors during initialization
        const rulesTable = (this.cortex.config as any).agentic?.rulesTable || (this.cortex.config as any).rulesTable || 'agent_rules'
        const tables = await this.cortex.db.introspection.getTables()
        if (!tables.some(t => t.name === rulesTable)) {
            return data
        }

        const result = await this.cortex.rules.evaluateRules(this.table.name, operation, data)

        if (result.action === 'deny') {
            throw new NoormError(`Operation ${operation} on ${this.table.name} denied: ${result.reason}`, {
                operation: 'cognitive_rule_enforcement',
                suggestion: 'Check agent rules or adjust policy'
            })
        }

        if (result.action === 'audit') {
            await this.cortex.reflections.reflect(
                'system',
                'success',
                `Audit trigger: ${operation} on ${this.table.name}`,
                [`Matched rule ${result.ruleId} for data: ${JSON.stringify(data)}`]
            )
        }

        if (result.action === 'mask' && result.ruleId) {
            const rules = await this.cortex.rules.getActiveRules(this.table.name, operation)
            const rule = rules.find(r => r.id === result.ruleId)
            if (rule) {
                return this.cortex.rules.applyMasking(data as Record<string, any>, rule) as Partial<T>
            }
        }

        return data
    }

    async create(data: Partial<T>): Promise<T> {
        const processedData = await this.triggerRules('insert', data)
        return await this.repository.create(processedData)
    }

    async update(entity: T): Promise<T> {
        const processedData = await this.triggerRules('update', entity as any)
        return await this.repository.update(processedData as T)
    }

    async delete(id: string | number): Promise<boolean> {
        await this.triggerRules('delete', { id } as any)
        return await this.repository.delete(id)
    }

    // Delegate other methods to the internal repository
    async findById(id: string | number) { return this.repository.findById(id) }
    async findAll() { return this.repository.findAll() }
    async count() { return this.repository.count() }
    async exists(id: string | number) { return this.repository.exists(id) }

    // Dynamic method delegation via Proxy
    static createProxy<T>(repository: Repository<T>, table: TableInfo, cortex: Cortex): Repository<T> {
        const cognitive = new CognitiveRepository<T>(repository, table, cortex)

        return new Proxy(repository, {
            get(target, prop, receiver) {
                if (prop in cognitive) {
                    return (cognitive as any)[prop]
                }
                return Reflect.get(target, prop, receiver)
            }
        }) as unknown as Repository<T>
    }
}
