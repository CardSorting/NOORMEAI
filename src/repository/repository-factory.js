"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepositoryFactory = void 0;
const NoormError_js_1 = require("../errors/NoormError.js");
const relationship_engine_js_1 = require("../relationships/relationship-engine.js");
const CognitiveRepository_js_1 = require("../agentic/CognitiveRepository.js");
/**
 * Implementation of the Django-style objects manager
 */
class DjangoManagerImpl {
    db;
    table;
    primaryKey;
    transformer;
    query;
    constructor(db, table, primaryKey, transformer, initialQuery) {
        this.db = db;
        this.table = table;
        this.primaryKey = primaryKey;
        this.transformer = transformer;
        this.query = initialQuery || this.db.selectFrom(this.table.name).selectAll();
    }
    async all() {
        return this.execute();
    }
    async get(idOrFilter) {
        let q = this.query;
        if (typeof idOrFilter === 'object') {
            for (const [key, value] of Object.entries(idOrFilter)) {
                q = q.where(key, '=', value);
            }
        }
        else {
            q = q.where(this.primaryKey, '=', idOrFilter);
        }
        const result = await q.executeTakeFirst();
        return result ? this.transformer(result) : null;
    }
    filter(filter) {
        let q = this.query;
        for (const [key, value] of Object.entries(filter)) {
            if (value !== undefined) {
                q = q.where(key, '=', value);
            }
        }
        return new DjangoManagerImpl(this.db, this.table, this.primaryKey, this.transformer, q);
    }
    exclude(filter) {
        let q = this.query;
        for (const [key, value] of Object.entries(filter)) {
            if (value !== undefined) {
                q = q.where(key, '!=', value);
            }
        }
        return new DjangoManagerImpl(this.db, this.table, this.primaryKey, this.transformer, q);
    }
    order_by(...columns) {
        let q = this.query;
        for (const col of columns) {
            const direction = String(col).startsWith('-') ? 'desc' : 'asc';
            const actualCol = String(col).startsWith('-') ? String(col).substring(1) : String(col);
            q = q.orderBy(actualCol, direction);
        }
        return new DjangoManagerImpl(this.db, this.table, this.primaryKey, this.transformer, q);
    }
    async count() {
        const result = await this.query
            .clearSelect()
            .select((eb) => eb.fn.countAll().as('count'))
            .executeTakeFirst();
        return Number(result?.count || 0);
    }
    async exists() {
        const result = await this.query.select(this.primaryKey).executeTakeFirst();
        return result !== undefined;
    }
    async first() {
        const result = await this.query.limit(1).executeTakeFirst();
        return result ? this.transformer(result) : null;
    }
    async last() {
        const result = await this.query.orderBy(this.primaryKey, 'desc').limit(1).executeTakeFirst();
        return result ? this.transformer(result) : null;
    }
    async create(data) {
        const result = await this.db
            .insertInto(this.table.name)
            .values(data)
            .returningAll()
            .executeTakeFirstOrThrow();
        return this.transformer(result);
    }
    async update(data) {
        const subquery = this.query.select(this.primaryKey);
        const results = await this.db
            .updateTable(this.table.name)
            .set(data)
            .where(this.primaryKey, 'in', subquery)
            .returningAll()
            .execute();
        return this.transformer(results);
    }
    async delete() {
        const subquery = this.query.select(this.primaryKey);
        const result = await this.db
            .deleteFrom(this.table.name)
            .where(this.primaryKey, 'in', subquery)
            .executeTakeFirst();
        return Number(result.numDeletedRows || 0);
    }
    async execute() {
        const results = await this.query.execute();
        return this.transformer(results);
    }
}
/**
 * Simple repository factory for creating table repositories
 */
class RepositoryFactory {
    db;
    performanceConfig;
    cortex;
    relationshipEngine;
    constructor(db, performanceConfig, cortex) {
        this.db = db;
        this.performanceConfig = performanceConfig;
        this.cortex = cortex;
        this.relationshipEngine = new relationship_engine_js_1.RelationshipEngine(db, performanceConfig);
    }
    /**
     * Set relationships for the engine
     */
    setRelationships(relationships) {
        this.relationshipEngine.initialize(relationships);
    }
    /**
     * Transform raw database data into clean JavaScript types (booleans, dates)
     */
    transformData(data, table) {
        const booleanColumns = table.columns
            .filter(col => col.type.toLowerCase() === 'boolean' || col.type.toLowerCase() === 'bool')
            .map(col => col.name);
        const dateColumns = table.columns
            .filter(col => {
            const type = col.type.toLowerCase();
            return type.includes('date') || type.includes('timestamp') || type.includes('time');
        })
            .map(col => col.name);
        if (booleanColumns.length === 0 && dateColumns.length === 0)
            return data;
        const transformRecord = (record) => {
            if (!record || typeof record !== 'object')
                return record;
            const transformed = { ...record };
            // Transform booleans (especially for SQLite)
            for (const col of booleanColumns) {
                if (col in transformed && transformed[col] !== null) {
                    if (typeof transformed[col] === 'number')
                        transformed[col] = transformed[col] === 1;
                    else if (typeof transformed[col] === 'string')
                        transformed[col] = transformed[col].toLowerCase() === 'true';
                    else
                        transformed[col] = Boolean(transformed[col]);
                }
            }
            // Transform dates
            for (const col of dateColumns) {
                if (col in transformed && transformed[col]) {
                    if (typeof transformed[col] === 'string' || typeof transformed[col] === 'number') {
                        const date = new Date(transformed[col]);
                        if (!isNaN(date.getTime()))
                            transformed[col] = date;
                    }
                }
            }
            return transformed;
        };
        return Array.isArray(data) ? data.map(transformRecord) : transformRecord(data);
    }
    /**
     * Create a repository for the specified table
     */
    createRepository(table, relationships) {
        this.setRelationships(relationships);
        const primaryKey = table.columns.find(c => c.isPrimaryKey)?.name || 'id';
        const transformer = (data) => this.transformData(data, table);
        const baseRepository = {
            objects: new DjangoManagerImpl(this.db, table, primaryKey, transformer),
            findById: async (id) => {
                const result = await this.db
                    .selectFrom(table.name)
                    .selectAll()
                    .where(primaryKey, '=', id)
                    .executeTakeFirst();
                return result ? transformer(result) : null;
            },
            findAll: async () => {
                const results = await this.db.selectFrom(table.name).selectAll().execute();
                return transformer(results);
            },
            create: async (data) => {
                const result = await this.db
                    .insertInto(table.name)
                    .values(data)
                    .returningAll()
                    .executeTakeFirstOrThrow();
                return transformer(result);
            },
            update: async (entity) => {
                const id = entity[primaryKey];
                if (id === undefined)
                    throw new Error(`Missing primary key '${primaryKey}'`);
                const result = await this.db
                    .updateTable(table.name)
                    .set(entity)
                    .where(primaryKey, '=', id)
                    .returningAll()
                    .executeTakeFirstOrThrow();
                return transformer(result);
            },
            delete: async (id) => {
                const result = await this.db.deleteFrom(table.name).where(primaryKey, '=', id).executeTakeFirst();
                return Number(result.numDeletedRows || 0) > 0;
            },
            count: async () => {
                const result = await this.db.selectFrom(table.name).select((eb) => eb.fn.countAll().as('count')).executeTakeFirst();
                return Number(result?.count || 0);
            },
            exists: async (id) => {
                const result = await this.db.selectFrom(table.name).select(primaryKey).where(primaryKey, '=', id).executeTakeFirst();
                return result !== undefined;
            },
            paginate: async (options) => {
                let query = this.db.selectFrom(table.name).selectAll();
                let countQuery = this.db.selectFrom(table.name).select((eb) => eb.fn.countAll().as('count'));
                if (options.where) {
                    for (const [key, value] of Object.entries(options.where)) {
                        if (value !== undefined) {
                            query = query.where(key, '=', value);
                            countQuery = countQuery.where(key, '=', value);
                        }
                    }
                }
                const countResult = await countQuery.executeTakeFirst();
                const total = Number(countResult?.count || 0);
                if (options.orderBy)
                    query = query.orderBy(options.orderBy.column, options.orderBy.direction);
                const offset = (options.page - 1) * options.limit;
                const data = await query.limit(options.limit).offset(offset).execute();
                const totalPages = Math.ceil(total / options.limit);
                return {
                    data: transformer(data),
                    pagination: {
                        page: options.page,
                        limit: options.limit,
                        total,
                        totalPages,
                        hasNext: options.page < totalPages,
                        hasPrev: options.page > 1
                    }
                };
            },
            findWithRelations: async (id, relations) => {
                const entity = await baseRepository.findById(id);
                if (!entity)
                    return null;
                await this.relationshipEngine.loadRelationships([entity], relations);
                return entity;
            },
            loadRelationships: async (entities, relations) => {
                if (entities.length === 0)
                    return;
                await this.relationshipEngine.loadRelationships(entities, relations);
            },
            withCount: async (id, relationshipNames) => {
                const entity = await baseRepository.findById(id);
                if (!entity)
                    throw new Error(`Entity ${id} not found`);
                const tableRelationships = relationships.filter(r => r.fromTable === table.name);
                const counts = {};
                for (const name of relationshipNames) {
                    const rel = tableRelationships.find(r => r.name === name);
                    if (!rel)
                        throw new NoormError_js_1.RelationshipNotFoundError(name, table.name, tableRelationships.map(r => r.name));
                    const val = entity[rel.fromColumn];
                    if (val !== undefined) {
                        const res = await this.db.selectFrom(rel.toTable).select((eb) => eb.fn.countAll().as('count')).where(rel.toColumn, '=', val).executeTakeFirst();
                        counts[`${name}Count`] = Number(res?.count || 0);
                    }
                }
                return { ...entity, ...counts };
            }
        };
        let repository = this.wrapWithDynamicMethods(baseRepository, table);
        if (this.cortex)
            repository = CognitiveRepository_js_1.CognitiveRepository.createProxy(repository, table, this.cortex);
        return repository;
    }
    wrapWithDynamicMethods(repository, table) {
        const availableColumns = table.columns.map(c => c.name);
        const db = this.db;
        const transformer = (data) => this.transformData(data, table);
        return new Proxy(repository, {
            get(target, prop, receiver) {
                if (prop in target)
                    return Reflect.get(target, prop, receiver);
                if (typeof prop === 'string' && prop.startsWith('findBy')) {
                    return async (value) => {
                        const columnName = prop.substring(6).replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
                        const actualColumn = availableColumns.find(col => col.toLowerCase() === columnName.toLowerCase());
                        if (!actualColumn)
                            throw new NoormError_js_1.ColumnNotFoundError(columnName, table.name, availableColumns);
                        const result = await db.selectFrom(table.name).selectAll().where(actualColumn, '=', value).executeTakeFirst();
                        return transformer(result || null);
                    };
                }
                return undefined;
            }
        });
    }
}
exports.RepositoryFactory = RepositoryFactory;
