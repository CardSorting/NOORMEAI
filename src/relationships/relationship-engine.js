"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelationshipEngine = void 0;
/**
 * Relationship engine that handles foreign key relationships
 */
class RelationshipEngine {
    db;
    config;
    relationships = [];
    constructor(db, config = {}) {
        this.db = db;
        this.config = config;
    }
    /**
     * Initialize the relationship engine with schema relationships
     */
    initialize(relationships) {
        this.relationships = relationships;
    }
    /**
     * Load relationships for entities
     */
    async loadRelationships(entities, relations) {
        if (!this.config.enableBatchLoading) {
            // Load relationships one by one
            for (const entity of entities) {
                await this.loadEntityRelationships(entity, relations);
            }
            return;
        }
        // Batch load relationships for performance
        const batchSize = this.config.maxBatchSize || 100;
        for (let i = 0; i < entities.length; i += batchSize) {
            const batch = entities.slice(i, i + batchSize);
            await this.batchLoadRelationships(batch, relations);
        }
    }
    /**
     * Load relationships for a single entity
     */
    async loadEntityRelationships(entity, relations) {
        for (const relationName of relations) {
            const relationship = this.relationships.find(r => r.name === relationName);
            if (!relationship)
                continue;
            await this.loadSingleRelationship(entity, relationship);
        }
    }
    /**
     * Batch load relationships for multiple entities
     */
    async batchLoadRelationships(entities, relations) {
        for (const relationName of relations) {
            const relationship = this.relationships.find(r => r.name === relationName);
            if (!relationship)
                continue;
            await this.batchLoadSingleRelationship(entities, relationship);
        }
    }
    /**
     * Load a single relationship for an entity
     */
    async loadSingleRelationship(entity, relationship) {
        const entityValue = entity[relationship.fromColumn];
        if (!entityValue)
            return;
        let relatedData;
        switch (relationship.type) {
            case 'many-to-one':
                relatedData = await this.db
                    .selectFrom(relationship.toTable)
                    .selectAll()
                    .where(relationship.toColumn, '=', entityValue)
                    .executeTakeFirst();
                break;
            case 'one-to-many':
                relatedData = await this.db
                    .selectFrom(relationship.toTable)
                    .selectAll()
                    .where(relationship.toColumn, '=', entityValue)
                    .execute();
                break;
            case 'many-to-many':
                relatedData = await this.loadManyToManyRelationship(entity, relationship);
                break;
        }
        entity[relationship.name] = relatedData;
    }
    /**
     * Batch load a single relationship for multiple entities
     */
    async batchLoadSingleRelationship(entities, relationship) {
        const entityValues = entities
            .map(e => e[relationship.fromColumn])
            .filter(v => v !== undefined && v !== null);
        if (entityValues.length === 0)
            return;
        let relatedData;
        switch (relationship.type) {
            case 'many-to-one':
                relatedData = await this.db
                    .selectFrom(relationship.toTable)
                    .selectAll()
                    .where(relationship.toColumn, 'in', entityValues)
                    .execute();
                break;
            case 'one-to-many':
                relatedData = await this.db
                    .selectFrom(relationship.toTable)
                    .selectAll()
                    .where(relationship.toColumn, 'in', entityValues)
                    .execute();
                break;
            case 'many-to-many':
                relatedData = await this.batchLoadManyToManyRelationship(entities, relationship);
                break;
            default:
                relatedData = [];
        }
        // Group related data by foreign key value
        const groupedData = new Map();
        for (const item of relatedData) {
            const key = item[relationship.toColumn];
            if (!groupedData.has(key)) {
                groupedData.set(key, []);
            }
            groupedData.get(key).push(item);
        }
        // Assign related data to entities
        for (const entity of entities) {
            const entityValue = entity[relationship.fromColumn];
            if (entityValue) {
                let entityRelatedData;
                if (relationship.type === 'many-to-one') {
                    entityRelatedData = groupedData.get(entityValue)?.[0];
                }
                else {
                    entityRelatedData = groupedData.get(entityValue) || [];
                }
                entity[relationship.name] = entityRelatedData;
            }
        }
    }
    /**
     * Load many-to-many relationship
     */
    async loadManyToManyRelationship(entity, relationship) {
        if (!relationship.throughTable) {
            throw new Error('Many-to-many relationship requires throughTable');
        }
        const entityValue = entity[relationship.fromColumn];
        if (!entityValue)
            return [];
        return await this.db
            .selectFrom(relationship.toTable)
            .innerJoin(relationship.throughTable, relationship.throughToColumn, `${relationship.toTable}.${relationship.toColumn}`)
            .where(relationship.throughFromColumn, '=', entityValue)
            .selectAll(relationship.toTable)
            .execute();
    }
    /**
     * Batch load many-to-many relationships
     */
    async batchLoadManyToManyRelationship(entities, relationship) {
        if (!relationship.throughTable) {
            throw new Error('Many-to-many relationship requires throughTable');
        }
        const entityValues = entities
            .map(e => e[relationship.fromColumn])
            .filter(v => v !== undefined && v !== null);
        if (entityValues.length === 0)
            return [];
        return await this.db
            .selectFrom(relationship.toTable)
            .innerJoin(relationship.throughTable, relationship.throughToColumn, `${relationship.toTable}.${relationship.toColumn}`)
            .where(relationship.throughFromColumn, 'in', entityValues)
            .selectAll(relationship.toTable)
            .execute();
    }
    /**
     * Get relationships for a specific table
     */
    getRelationshipsForTable(tableName) {
        return this.relationships.filter(r => r.fromTable === tableName);
    }
    /**
     * Get all relationships
     */
    getAllRelationships() {
        return [...this.relationships];
    }
    /**
     * Add a new relationship
     */
    addRelationship(relationship) {
        this.relationships.push(relationship);
    }
    /**
     * Remove a relationship
     */
    removeRelationship(relationshipName) {
        this.relationships = this.relationships.filter(r => r.name !== relationshipName);
    }
}
exports.RelationshipEngine = RelationshipEngine;
