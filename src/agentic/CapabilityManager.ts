import type { Kysely } from '../kysely.js'
import type {
    AgenticConfig,
    AgentCapability
} from '../types/index.js'

export interface CapabilityTable {
    id: number | string
    name: string
    version: string
    description: string | null
    reliability: number
    metadata: string | null // JSON string
    created_at: string | Date
    updated_at: string | Date
}

export interface CapabilityDatabase {
    agent_capabilities: CapabilityTable
}

/**
 * CapabilityManager tracks the skills (tools) available to an agent
 * and their historical reliability.
 */
export class CapabilityManager {
    private capabilitiesTable: string

    constructor(
        private db: Kysely<any>,
        private config: AgenticConfig = {}
    ) {
        this.capabilitiesTable = config.capabilitiesTable || 'agent_capabilities'
    }

    private get typedDb(): Kysely<CapabilityDatabase> {
        return this.db as unknown as Kysely<CapabilityDatabase>
    }

    /**
     * Register or update a capability (skill)
     */
    async registerCapability(
        name: string,
        version: string,
        description?: string,
        metadata: Record<string, any> = {}
    ): Promise<AgentCapability> {
        return await this.db.transaction().execute(async (trx) => {
            const existing = await trx
                .selectFrom(this.capabilitiesTable as any)
                .selectAll()
                .where('name', '=', name)
                .where('version', '=', version)
                .executeTakeFirst()

            if (existing) {
                const updated = await trx
                    .updateTable(this.capabilitiesTable as any)
                    .set({
                        description: description || (existing as any).description,
                        metadata: JSON.stringify({ ...JSON.parse((existing as any).metadata || '{}'), ...metadata }),
                        updated_at: new Date()
                    })
                    .where('id', '=', (existing as any).id)
                    .returningAll()
                    .executeTakeFirstOrThrow()

                return this.parseCapability(updated)
            }

            const created = await trx
                .insertInto(this.capabilitiesTable as any)
                .values({
                    name,
                    version,
                    description: description || null,
                    reliability: 1.0,
                    metadata: JSON.stringify({ ...metadata, successCount: 0, totalCount: 0 }),
                    created_at: new Date(),
                    updated_at: new Date()
                } as any)
                .returningAll()
                .executeTakeFirstOrThrow()

            return this.parseCapability(created)
        })
    }

    /**
     * Update reliability based on action outcome using a damped moving average.
     */
    async reportOutcome(name: string, success: boolean): Promise<void> {
        await this.db.transaction().execute(async (trx) => {
            const capability = await trx
                .selectFrom(this.capabilitiesTable as any)
                .selectAll()
                .where('name', '=', name)
                .orderBy('updated_at', 'desc')
                .executeTakeFirst()

            if (capability) {
                const cap = capability as any
                const metadata = typeof cap.metadata === 'string' ? JSON.parse(cap.metadata) : (cap.metadata || {})
                
                const totalCount = (metadata.totalCount || 0) + 1
                const successCount = (metadata.successCount || 0) + (success ? 1 : 0)
                
                // Damped moving average: weight recent outcomes more but keep history
                // formula: new = old * (1 - alpha) + current * alpha
                const alpha = 0.2
                const currentReliability = cap.reliability
                const newReliability = success
                    ? Math.min(1.0, currentReliability * (1 - alpha) + alpha)
                    : Math.max(0.0, currentReliability * (1 - alpha))

                await trx
                    .updateTable(this.capabilitiesTable as any)
                    .set({
                        reliability: newReliability,
                        metadata: JSON.stringify({ ...metadata, totalCount, successCount }),
                        updated_at: new Date()
                    })
                    .where('id', '=', cap.id)
                    .execute()
            }
        })
    }

    /**
     * Get reliability score for a capability.
     */
    async getReliability(name: string): Promise<number> {
        const cap = await this.typedDb
            .selectFrom(this.capabilitiesTable as any)
            .select('reliability')
            .where('name', '=', name)
            .orderBy('updated_at', 'desc')
            .executeTakeFirst()
        
        return cap ? cap.reliability : 0.0
    }

    /**
     * Get all registered capabilities
     */
    async getCapabilities(): Promise<AgentCapability[]> {
        const list = await this.typedDb
            .selectFrom(this.capabilitiesTable as any)
            .selectAll()
            .orderBy('name', 'asc')
            .execute()

        return list.map(c => this.parseCapability(c))
    }

    private parseCapability(cap: any): AgentCapability {
        return {
            id: cap.id,
            name: cap.name,
            version: cap.version,
            description: cap.description,
            reliability: cap.reliability,
            metadata: typeof cap.metadata === 'string' ? JSON.parse(cap.metadata) : (cap.metadata || {}),
            createdAt: new Date(cap.created_at),
            updatedAt: new Date(cap.updated_at)
        }
    }
}
