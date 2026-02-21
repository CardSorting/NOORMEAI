import type { Kysely, SelectQueryBuilder } from '../index.js'
import type { Repository, TableInfo, RelationshipInfo, DjangoManager } from '../types/index.js'
import { RelationshipNotFoundError, ColumnNotFoundError } from '../errors/NoormError.js'
import { RelationshipEngine } from '../relationships/relationship-engine.js'
import { CognitiveRepository } from '../agentic/CognitiveRepository.js'
import type { Cortex } from '../agentic/Cortex.js'

/**
 * Implementation of the Django-style objects manager
 */
class DjangoManagerImpl<T> implements DjangoManager<T> {
  private query: SelectQueryBuilder<any, any, T>

  constructor(
    private db: Kysely<any>,
    private table: TableInfo,
    private primaryKey: string,
    private transformer: (data: any) => any,
    initialQuery?: SelectQueryBuilder<any, any, T>
  ) {
    this.query = initialQuery || (this.db.selectFrom(this.table.name as any).selectAll() as any)
  }

  async all(): Promise<T[]> {
    return this.execute()
  }

  async get(idOrFilter: string | number | Partial<T>): Promise<T | null> {
    let q = this.query
    if (typeof idOrFilter === 'object') {
      for (const [key, value] of Object.entries(idOrFilter)) {
        q = q.where(key as any, '=', value as any) as any
      }
    } else {
      q = q.where(this.primaryKey as any, '=', idOrFilter as any) as any
    }
    const result = await q.executeTakeFirst()
    return result ? this.transformer(result) : null
  }

  filter(filter: Partial<T>): DjangoManager<T> {
    let q = this.query
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined) {
        q = q.where(key as any, '=', value as any) as any
      }
    }
    return new DjangoManagerImpl(this.db, this.table, this.primaryKey, this.transformer, q)
  }

  exclude(filter: Partial<T>): DjangoManager<T> {
    let q = this.query
    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined) {
        q = q.where(key as any, '!=', value as any) as any
      }
    }
    return new DjangoManagerImpl(this.db, this.table, this.primaryKey, this.transformer, q)
  }

  order_by(...columns: (keyof T | string)[]): DjangoManager<T> {
    let q = this.query
    for (const col of columns) {
      const direction = String(col).startsWith('-') ? 'desc' : 'asc'
      const actualCol = String(col).startsWith('-') ? String(col).substring(1) : String(col)
      q = q.orderBy(actualCol as any, direction) as any
    }
    return new DjangoManagerImpl(this.db, this.table, this.primaryKey, this.transformer, q)
  }

  async count(): Promise<number> {
    const result = await (this.query as any)
      .clearSelect()
      .select((eb: any) => eb.fn.countAll().as('count'))
      .executeTakeFirst()
    return Number(result?.count || 0)
  }

  async exists(): Promise<boolean> {
    const result = await this.query.select(this.primaryKey as any).executeTakeFirst()
    return result !== undefined
  }

  async first(): Promise<T | null> {
    const result = await this.query.limit(1).executeTakeFirst()
    return result ? this.transformer(result) : null
  }

  async last(): Promise<T | null> {
    const result = await this.query.orderBy(this.primaryKey as any, 'desc').limit(1).executeTakeFirst()
    return result ? this.transformer(result) : null
  }

  async create(data: Partial<T>): Promise<T> {
    const result = await this.db
      .insertInto(this.table.name as any)
      .values(data as any)
      .returningAll()
      .executeTakeFirstOrThrow()
    return this.transformer(result)
  }

  async update(data: Partial<T>): Promise<T[]> {
    const subquery = this.query.select(this.primaryKey as any)
    const results = await this.db
      .updateTable(this.table.name as any)
      .set(data as any)
      .where(this.primaryKey as any, 'in', subquery as any)
      .returningAll()
      .execute()
    return this.transformer(results)
  }

  async delete(): Promise<number> {
    const subquery = this.query.select(this.primaryKey as any)
    const result = await this.db
      .deleteFrom(this.table.name as any)
      .where(this.primaryKey as any, 'in', subquery as any)
      .executeTakeFirst()
    return Number(result.numDeletedRows || 0)
  }

  async execute(): Promise<T[]> {
    const results = await this.query.execute()
    return this.transformer(results)
  }
}

/**
 * Simple repository factory for creating table repositories
 */
export class RepositoryFactory {
  private relationshipEngine: RelationshipEngine

  constructor(
    private db: Kysely<any>,
    private performanceConfig?: any,
    private cortex?: Cortex
  ) {
    this.relationshipEngine = new RelationshipEngine(db, performanceConfig)
  }

  /**
   * Set relationships for the engine
   */
  setRelationships(relationships: RelationshipInfo[]): void {
    this.relationshipEngine.initialize(relationships)
  }

  /**
   * Transform raw database data into clean JavaScript types (booleans, dates)
   */
  private transformData<T>(data: T | T[], table: TableInfo): T | T[] {
    const booleanColumns = table.columns
      .filter(col => col.type.toLowerCase() === 'boolean' || col.type.toLowerCase() === 'bool')
      .map(col => col.name)
    
    const dateColumns = table.columns
      .filter(col => {
        const type = col.type.toLowerCase()
        return type.includes('date') || type.includes('timestamp') || type.includes('time')
      })
      .map(col => col.name)
    
    if (booleanColumns.length === 0 && dateColumns.length === 0) return data
    
    const transformRecord = (record: any): any => {
      if (!record || typeof record !== 'object') return record
      const transformed = { ...record }
      
      // Transform booleans (especially for SQLite)
      for (const col of booleanColumns) {
        if (col in transformed && transformed[col] !== null) {
          if (typeof transformed[col] === 'number') transformed[col] = transformed[col] === 1
          else if (typeof transformed[col] === 'string') transformed[col] = transformed[col].toLowerCase() === 'true'
          else transformed[col] = Boolean(transformed[col])
        }
      }
      
      // Transform dates
      for (const col of dateColumns) {
        if (col in transformed && transformed[col]) {
          if (typeof transformed[col] === 'string' || typeof transformed[col] === 'number') {
            const date = new Date(transformed[col])
            if (!isNaN(date.getTime())) transformed[col] = date
          }
        }
      }
      
      return transformed
    }
    
    return Array.isArray(data) ? data.map(transformRecord) : transformRecord(data)
  }

  /**
   * Create a repository for the specified table
   */
  createRepository<T>(
    table: TableInfo,
    relationships: RelationshipInfo[]
  ): Repository<T> {
    this.setRelationships(relationships)
    const primaryKey = table.columns.find(c => c.isPrimaryKey)?.name || 'id'
    const transformer = (data: any) => this.transformData(data, table)

    const baseRepository: Repository<T> = {
      objects: new DjangoManagerImpl<T>(this.db, table, primaryKey, transformer),

      findById: async (id: string | number) => {
        const result = await this.db
          .selectFrom(table.name as any)
          .selectAll()
          .where(primaryKey as any, '=', id)
          .executeTakeFirst()
        return result ? (transformer(result) as T) : null
      },

      findAll: async () => {
        const results = await this.db.selectFrom(table.name as any).selectAll().execute()
        return transformer(results) as T[]
      },

      create: async (data: Partial<T>) => {
        const result = await this.db
          .insertInto(table.name as any)
          .values(data as any)
          .returningAll()
          .executeTakeFirstOrThrow()
        return transformer(result) as T
      },

      update: async (entity: T) => {
        const id = (entity as any)[primaryKey]
        if (id === undefined) throw new Error(`Missing primary key '${primaryKey}'`)
        const result = await this.db
          .updateTable(table.name as any)
          .set(entity as any)
          .where(primaryKey as any, '=', id)
          .returningAll()
          .executeTakeFirstOrThrow()
        return transformer(result) as T
      },

      delete: async (id: string | number) => {
        const result = await this.db.deleteFrom(table.name as any).where(primaryKey as any, '=', id).executeTakeFirst()
        return Number(result.numDeletedRows || 0) > 0
      },

      count: async () => {
        const result = await this.db.selectFrom(table.name as any).select((eb: any) => eb.fn.countAll().as('count')).executeTakeFirst()
        return Number((result as any)?.count || 0)
      },

      exists: async (id: string | number) => {
        const result = await this.db.selectFrom(table.name as any).select(primaryKey as any).where(primaryKey as any, '=', id).executeTakeFirst()
        return result !== undefined
      },

      paginate: async (options) => {
        let query = this.db.selectFrom(table.name as any).selectAll()
        let countQuery = this.db.selectFrom(table.name as any).select((eb: any) => eb.fn.countAll().as('count'))

        if (options.where) {
          for (const [key, value] of Object.entries(options.where)) {
            if (value !== undefined) {
              query = query.where(key as any, '=', value)
              countQuery = countQuery.where(key as any, '=', value)
            }
          }
        }
        
        const countResult = await countQuery.executeTakeFirst()
        const total = Number((countResult as any)?.count || 0)
        
        if (options.orderBy) query = query.orderBy(options.orderBy.column as string, options.orderBy.direction)
        
        const offset = (options.page - 1) * options.limit
        const data = await query.limit(options.limit).offset(offset).execute()
        
        const totalPages = Math.ceil(total / options.limit)
        
        return {
          data: transformer(data) as T[],
          pagination: {
            page: options.page,
            limit: options.limit,
            total,
            totalPages,
            hasNext: options.page < totalPages,
            hasPrev: options.page > 1
          }
        }
      },

      findWithRelations: async (id, relations) => {
        const entity = await baseRepository.findById(id)
        if (!entity) return null
        await this.relationshipEngine.loadRelationships([entity], relations)
        return entity
      },

      loadRelationships: async (entities, relations) => {
        if (entities.length === 0) return
        await this.relationshipEngine.loadRelationships(entities, relations)
      },

      withCount: async (id, relationshipNames) => {
        const entity = await baseRepository.findById(id) as any
        if (!entity) throw new Error(`Entity ${id} not found`)
        
        const tableRelationships = relationships.filter(r => r.fromTable === table.name)
        const counts: Record<string, number> = {}
        
        for (const name of relationshipNames) {
          const rel = tableRelationships.find(r => r.name === name)
          if (!rel) throw new RelationshipNotFoundError(name, table.name, tableRelationships.map(r => r.name))
          
          const val = (entity as any)[rel.fromColumn]
          if (val !== undefined) {
            const res = await this.db.selectFrom(rel.toTable as any).select((eb: any) => eb.fn.countAll().as('count')).where(rel.toColumn as any, '=', val).executeTakeFirst()
            counts[`${name}Count`] = Number((res as any)?.count || 0)
          }
        }
        return { ...entity, ...counts }
      }
    }
    
    let repository = this.wrapWithDynamicMethods(baseRepository, table)
    if (this.cortex) repository = CognitiveRepository.createProxy(repository, table, this.cortex)
    return repository
  }
  
  private wrapWithDynamicMethods<T>(repository: Repository<T>, table: TableInfo): Repository<T> {
    const availableColumns = table.columns.map(c => c.name)
    const db = this.db
    const transformer = (data: any) => this.transformData(data, table)
    
    return new Proxy(repository, {
      get(target, prop, receiver) {
        if (prop in target) return Reflect.get(target, prop, receiver)
        if (typeof prop === 'string' && prop.startsWith('findBy')) {
          return async (value: any) => {
            const columnName = prop.substring(6).replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
            const actualColumn = availableColumns.find(col => col.toLowerCase() === columnName.toLowerCase())
            if (!actualColumn) throw new ColumnNotFoundError(columnName, table.name, availableColumns)
            const result = await db.selectFrom(table.name as any).selectAll().where(actualColumn as any, '=', value).executeTakeFirst()
            return transformer(result || null)
          }
        }
        return undefined
      }
    }) as Repository<T>
  }
}
