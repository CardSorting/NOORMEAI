import type { Kysely } from '../kysely.js'
import type {
    AgenticConfig,
    AgentPersona
} from '../types/index.js'

export interface PersonaTable {
    id: number | string
    name: string
    role: string | null
    capabilities: string | null // JSON string
    policies: string | null // JSON string
    metadata: string | null // JSON string
    created_at: string | Date
    updated_at: string | Date
}

export interface PersonaDatabase {
    agent_personas: PersonaTable
}

/**
 * PersonaManager handles persistent agent identities that bridge multiple sessions.
 */
export class PersonaManager {
    private personasTable: string

    constructor(
        private db: Kysely<any>,
        private config: AgenticConfig = {}
    ) {
        this.personasTable = config.personasTable || 'agent_personas'
    }

    private get typedDb(): Kysely<PersonaDatabase> {
        return this.db as unknown as Kysely<PersonaDatabase>
    }

    /**
     * Create or update a persona
     */
    async upsertPersona(
        name: string,
        options: { role?: string, capabilities?: string[], policies?: string[], metadata?: Record<string, any> } = {}
    ): Promise<AgentPersona> {
        const existing = await this.typedDb
            .selectFrom(this.personasTable as any)
            .selectAll()
            .where('name', '=', name)
            .executeTakeFirst()

        const values = {
            name,
            role: options.role || null,
            capabilities: options.capabilities ? JSON.stringify(options.capabilities) : null,
            policies: options.policies ? JSON.stringify(options.policies) : null,
            metadata: options.metadata ? JSON.stringify(options.metadata) : null,
            updated_at: new Date()
        }

        if (existing) {
            const updated = await this.typedDb
                .updateTable(this.personasTable as any)
                .set(values as any)
                .where('id', '=', existing.id)
                .returningAll()
                .executeTakeFirstOrThrow()
            return this.parsePersona(updated)
        }

        const created = await this.typedDb
            .insertInto(this.personasTable as any)
            .values({
                ...values,
                created_at: new Date()
            } as any)
            .returningAll()
            .executeTakeFirstOrThrow()

        return this.parsePersona(created)
    }

    /**
     * Get a persona by name
     */
    async getPersona(name: string): Promise<AgentPersona | null> {
        const persona = await this.typedDb
            .selectFrom(this.personasTable as any)
            .selectAll()
            .where('name', '=', name)
            .executeTakeFirst()

        return persona ? this.parsePersona(persona) : null
    }

    /**
     * Delete a persona by name
     */
    async deletePersona(name: string): Promise<boolean> {
        const result = await this.typedDb
            .deleteFrom(this.personasTable as any)
            .where('name', '=', name)
            .executeTakeFirst()

        return Number(result.numDeletedRows || 0) > 0
    }

    /**
     * List all personas
     */
    async listPersonas(): Promise<AgentPersona[]> {
        const list = await this.typedDb
            .selectFrom(this.personasTable as any)
            .selectAll()
            .orderBy('name', 'asc')
            .execute()

        return list.map(p => this.parsePersona(p))
    }


    private parsePersona(p: any): AgentPersona {
        return {
            id: p.id,
            name: p.name,
            role: p.role || undefined,
            capabilities: typeof p.capabilities === 'string' ? JSON.parse(p.capabilities) : (p.capabilities || []),
            policies: typeof p.policies === 'string' ? JSON.parse(p.policies) : (p.policies || []),
            metadata: typeof p.metadata === 'string' ? JSON.parse(p.metadata) : (p.metadata || {}),
            createdAt: new Date(p.created_at),
            updatedAt: new Date(p.updated_at)
        }
    }
}
