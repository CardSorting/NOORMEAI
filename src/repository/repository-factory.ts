import type { Kysely, SelectQueryBuilder } from '../index.js'
import type {
  Repository,
  TableInfo,
  RelationshipInfo,
  DjangoManager,
} from '../types/index.js'
import {
  RelationshipNotFoundError,
  ColumnNotFoundError,
} from '../errors/NoormError.js'
import { RelationshipEngine } from '../relationships/relationship-engine.js'
import type { Cortex } from '../agentic/Cortex.js'



/**
 * Simple repository factory for creating table repositories
 */
export class RepositoryFactory {
  private relationshipEngine: RelationshipEngine

  constructor(
    private db: Kysely<any>,
    private performanceConfig?: any,
    private cortex?: Cortex,
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
      .filter(
        (col) =>
          col.type.toLowerCase() === 'boolean' ||
          col.type.toLowerCase() === 'bool',
      )
      .map((col) => col.name)

    const dateColumns = table.columns
      .filter((col) => {
        const type = col.type.toLowerCase()
        return (
          type.includes('date') ||
          type.includes('timestamp') ||
          type.includes('time')
        )
      })
      .map((col) => col.name)

    if (booleanColumns.length === 0 && dateColumns.length === 0) return data

    const transformRecord = (record: any): any => {
      if (!record || typeof record !== 'object') return record
      const transformed = { ...record }

      // Transform booleans (especially for SQLite)
      for (const col of booleanColumns) {
        if (col in transformed && transformed[col] !== null) {
          if (typeof transformed[col] === 'number')
            transformed[col] = transformed[col] === 1
          else if (typeof transformed[col] === 'string')
            transformed[col] = transformed[col].toLowerCase() === 'true'
          else transformed[col] = Boolean(transformed[col])
        }
      }

      // Transform dates
      for (const col of dateColumns) {
        if (col in transformed && transformed[col]) {
          if (
            typeof transformed[col] === 'string' ||
            typeof transformed[col] === 'number'
          ) {
            const date = new Date(transformed[col])
            if (!isNaN(date.getTime())) transformed[col] = date
          }
        }
      }

      return transformed
    }

    return Array.isArray(data)
      ? data.map(transformRecord)
      : transformRecord(data)
  }

  /**
   * Create a repository for the specified table
   */
  createRepository<T>(
    table: TableInfo,
    relationships: RelationshipInfo[],
  ): Repository<T> {
    this.setRelationships(relationships)
    const primaryKey = table.columns.find((c) => c.isPrimaryKey)?.name || 'id'
    const transformer = (data: any) => this.transformData(data, table)

    const createDjangoManager = (initialQuery?: SelectQueryBuilder<any, any, T>): DjangoManager<T> => {
      const query = initialQuery || (this.db.selectFrom(table.name as any).selectAll() as any)

      const manager: DjangoManager<T> = {
        all: async () => transformer(await query.execute()),
        get: async (idOrFilter: string | number | Partial<T>) => {
          let q = query
          if (typeof idOrFilter === 'object') {
            for (const [key, value] of Object.entries(idOrFilter as any)) {
              q = q.where(key as any, '=', value as any)
            }
          } else {
            q = q.where(primaryKey as any, '=', idOrFilter as any)
          }
          const result = await q.executeTakeFirst()
          return result ? transformer(result) : null
        },
        filter: (filterOrColumn: Partial<T> | string, operator?: string, value?: any) => {
          let q = query
          if (typeof filterOrColumn === 'object') {
            for (const [key, val] of Object.entries(filterOrColumn as any)) {
              if (val !== undefined) q = q.where(key as any, '=', val as any)
            }
          } else if (operator && value !== undefined) {
            q = q.where(filterOrColumn as any, operator as any, value as any)
          }
          return createDjangoManager(q)
        },
        exclude: (filterOrColumn: Partial<T> | string, operator?: string, value?: any) => {
          let q = query
          if (typeof filterOrColumn === 'object') {
            for (const [key, val] of Object.entries(filterOrColumn as any)) {
              if (val !== undefined) q = q.where(key as any, '!=', val as any)
            }
          } else if (operator && value !== undefined) {
            const negOperator = operator === '=' ? '!=' : operator === '!=' ? '=' : '!='
            q = q.where(filterOrColumn as any, negOperator as any, value as any)
          }
          return createDjangoManager(q)
        },
        order_by: (...columns: (keyof T | string)[]) => {
          let q = query
          for (const col of columns) {
            const direction = String(col).startsWith('-') ? 'desc' : 'asc'
            const actualCol = String(col).startsWith('-') ? String(col).substring(1) : String(col)
            q = q.orderBy(actualCol as any, direction)
          }
          return createDjangoManager(q)
        },
        limit: (count: number) => createDjangoManager(query.limit(count) as any),
        offset: (count: number) => createDjangoManager(query.offset(count) as any),
        count: async () => {
          const result = await (query as any).clearSelect().select((eb: any) => eb.fn.countAll().as('count')).executeTakeFirst()
          return Number(result?.count || 0)
        },
        exists: async () => {
          const result = await query.select(primaryKey as any).executeTakeFirst()
          return result !== undefined
        },
        first: async () => {
          const result = await query.limit(1).executeTakeFirst()
          return result ? transformer(result) : null
        },
        last: async () => {
          const result = await query.orderBy(primaryKey as any, 'desc').limit(1).executeTakeFirst()
          return result ? transformer(result) : null
        },
        create: async (data: Partial<T>) => {
          const result = await this.db.insertInto(table.name as any).values(data as any).returningAll().executeTakeFirstOrThrow()
          return transformer(result)
        },
        update: async (data: Partial<T>) => {
          const subquery = query.select(primaryKey as any)
          const results = await this.db.updateTable(table.name as any).set(data as any).where(primaryKey as any, 'in', subquery as any).returningAll().execute()
          return transformer(results)
        },
        delete: async () => {
          const subquery = query.select(primaryKey as any)
          const result = await this.db.deleteFrom(table.name as any).where(primaryKey as any, 'in', subquery as any).executeTakeFirst()
          return Number(result.numDeletedRows || 0)
        },
        execute: async () => transformer(await query.execute())
      }
      return manager
    }

    const baseRepository: Repository<T> = {
      objects: createDjangoManager(),

      findById: async (id: string | number) => {
        const result = await this.db
          .selectFrom(table.name as any)
          .selectAll()
          .where(primaryKey as any, '=', id)
          .executeTakeFirst()
        return result ? (transformer(result) as T) : null
      },

      findAll: async () => {
        const results = await this.db
          .selectFrom(table.name as any)
          .selectAll()
          .execute()
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
        if (id === undefined)
          throw new Error(`Missing primary key '${primaryKey}'`)
        const result = await this.db
          .updateTable(table.name as any)
          .set(entity as any)
          .where(primaryKey as any, '=', id)
          .returningAll()
          .executeTakeFirstOrThrow()
        return transformer(result) as T
      },

      delete: async (id: string | number) => {
        const result = await this.db
          .deleteFrom(table.name as any)
          .where(primaryKey as any, '=', id)
          .executeTakeFirst()
        return Number(result.numDeletedRows || 0) > 0
      },

      count: async () => {
        const result = await this.db
          .selectFrom(table.name as any)
          .select((eb: any) => eb.fn.countAll().as('count'))
          .executeTakeFirst()
        return Number((result as any)?.count || 0)
      },

      exists: async (id: string | number) => {
        const result = await this.db
          .selectFrom(table.name as any)
          .select(primaryKey as any)
          .where(primaryKey as any, '=', id)
          .executeTakeFirst()
        return result !== undefined
      },

      paginate: async (options) => {
        let query = this.db.selectFrom(table.name as any).selectAll()
        let countQuery = this.db
          .selectFrom(table.name as any)
          .select((eb: any) => eb.fn.countAll().as('count'))

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

        if (options.orderBy)
          query = query.orderBy(
            options.orderBy.column as string,
            options.orderBy.direction,
          )

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
            hasPrev: options.page > 1,
          },
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
        const entity = (await baseRepository.findById(id)) as any
        if (!entity) throw new Error(`Entity ${id} not found`)

        const tableRelationships = relationships.filter(
          (r) => r.fromTable === table.name,
        )
        const counts: Record<string, number> = {}

        for (const name of relationshipNames) {
          const rel = tableRelationships.find((r) => r.name === name)
          if (!rel)
            throw new RelationshipNotFoundError(
              name,
              table.name,
              tableRelationships.map((r) => r.name),
            )

          const val = (entity as any)[rel.fromColumn]
          if (val !== undefined) {
            const res = await this.db
              .selectFrom(rel.toTable as any)
              .select((eb: any) => eb.fn.countAll().as('count'))
              .where(rel.toColumn as any, '=', val)
              .executeTakeFirst()
            counts[`${name}Count`] = Number((res as any)?.count || 0)
          }
        }
        return { ...entity, ...counts }
      },
    }

    return baseRepository
  }
}
