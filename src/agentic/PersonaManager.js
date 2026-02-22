"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersonaManager = void 0;
/**
 * PersonaManager handles persistent agent identities that bridge multiple sessions.
 */
class PersonaManager {
    db;
    config;
    personasTable;
    constructor(db, config = {}) {
        this.db = db;
        this.config = config;
        this.personasTable = config.personasTable || 'agent_personas';
    }
    get typedDb() {
        return this.db;
    }
    /**
     * Create or update a persona
     */
    async upsertPersona(name, options = {}) {
        const existing = await this.typedDb
            .selectFrom(this.personasTable)
            .selectAll()
            .where('name', '=', name)
            .executeTakeFirst();
        const values = {
            name,
            role: options.role || null,
            capabilities: options.capabilities ? JSON.stringify(options.capabilities) : null,
            policies: options.policies ? JSON.stringify(options.policies) : null,
            metadata: options.metadata ? JSON.stringify(options.metadata) : null,
            updated_at: new Date()
        };
        if (existing) {
            const updated = await this.typedDb
                .updateTable(this.personasTable)
                .set(values)
                .where('id', '=', existing.id)
                .returningAll()
                .executeTakeFirstOrThrow();
            return this.parsePersona(updated);
        }
        const created = await this.typedDb
            .insertInto(this.personasTable)
            .values({
            ...values,
            created_at: new Date()
        })
            .returningAll()
            .executeTakeFirstOrThrow();
        return this.parsePersona(created);
    }
    /**
     * Get a persona by name
     */
    async getPersona(name) {
        const persona = await this.typedDb
            .selectFrom(this.personasTable)
            .selectAll()
            .where('name', '=', name)
            .executeTakeFirst();
        return persona ? this.parsePersona(persona) : null;
    }
    /**
     * Delete a persona by name
     */
    async deletePersona(name) {
        const result = await this.typedDb
            .deleteFrom(this.personasTable)
            .where('name', '=', name)
            .executeTakeFirst();
        return Number(result.numDeletedRows || 0) > 0;
    }
    /**
     * List all personas
     */
    async listPersonas() {
        const list = await this.typedDb
            .selectFrom(this.personasTable)
            .selectAll()
            .orderBy('name', 'asc')
            .execute();
        return list.map(p => this.parsePersona(p));
    }
    parsePersona(p) {
        return {
            id: p.id,
            name: p.name,
            role: p.role || undefined,
            capabilities: typeof p.capabilities === 'string' ? JSON.parse(p.capabilities) : (p.capabilities || []),
            policies: typeof p.policies === 'string' ? JSON.parse(p.policies) : (p.policies || []),
            metadata: typeof p.metadata === 'string' ? JSON.parse(p.metadata) : (p.metadata || {}),
            createdAt: new Date(p.created_at),
            updatedAt: new Date(p.updated_at)
        };
    }
}
exports.PersonaManager = PersonaManager;
